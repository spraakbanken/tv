import {test} from "./test.ts"

export function maybe<A, B>(x?: A, z: B, f: (a: A) => B): B {
  return x === undefined ? z : f(x)
}

test(maybe, undefined, -1, x => x + ' ok').is = -1
test(maybe, 'seems', -1, x => x + ' ok').is = 'seems ok'

export function nub<A>(xs: A[]): A[] {
  const seen = new Set<A>()
  return xs.filter(x => {
    const duplicate = seen.has(x)
    duplicate || seen.add(x)
    return !duplicate
  })
}

test(nub, [1, 2, 2, 3, 4, 3, 1]).is = [1, 2, 3, 4]

export function words(s: string): string[] {
  return s.trim().split(/\s+/g)
}

test(words, ' apa bepa cepa ').is = ['apa', 'bepa', 'cepa']

export function group<A, B>(xs: A[], f: (a: A) => B, free?: (a: A) => boolean): A[][] {
  if (xs.length == 0) {
    return []
  }
  const out = [] as A[][]
  let free_cursor: A[] = []
  let cursor: A[]
  let last: string
  xs.forEach(x => {
    const fx = f(x)
    if (free && free(x)) {
      free_cursor.push(x)
    } else {
      const now = JSON.stringify([fx === undefined, fx])
      if (now !== last) {
        if (free_cursor.length) {
          out.push(free_cursor)
          free_cursor = []
        }
        cursor = []
        out.push(cursor)
      } else {
        cursor.push(...free_cursor)
        free_cursor = []
      }
      last = now
      cursor.push(x)
    }
  })
  if (free_cursor.length) {
    out.push(free_cursor)
  }
  return out
}

test(group, [], (x: string) => x).is = []
test(group, [1, 2, 3, 4, 5, 6], (x: number) => Math.floor(x / 2)).is = [[1], [2, 3], [4, 5], [6]]
test(group, [0, 1, 2, 3, 4, 5, 6, 7, 8], (x: number) => x < 3.5, (x: number) => x % 2 == 0).is = [
  [0],
  [1, 2, 3],
  [4],
  [5, 6, 7],
  [8],
]

export function mapObject<K extends string, A, B>
    (obj: Record<K, A>, f: (k: K, v: A, i: number) => B): B[] {
  return Object.entries(obj).map(([k, v], i) => f(k as K, v as A, i))
}

export function mapEntries<K extends string, A, B>
    (obj: Record<K, A>, f: (k: K, v: A, i: number) => B): Record<K, B> {
  return Object.fromEntries(mapObject(obj, (k, v, i) => [k, f(k, v, i)])) as any
}

export function range(from: number, to: number) {
  const out = []
  for (let i = from; i <= to; ++i) {
    out.push(i)
  }
  return out
}

test(range, 2, 4).is = [2,3,4]
test(range, 2, 2).is = [2]
test(range, 2, 1).is = []

export const show_table = (xss: string[][]) => {
  const widthss = xss[0].map<number[]>(_ => [])
  xss.map(xs => xs.map((x, i) => widthss[i].push(x.length)))
  const widths = widthss.map(ws => Math.max(...ws))
  const leftpad = (x: string, w: number) => (new Array(w - x.length).fill(' ')).join('') + x
  return xss.map(xs => xs.map((x, i) => leftpad(x, widths[i])).join(' ')).join('\n')
}

test(show_table, [['apa', '1'], ['2', 'bepa']]).is =
  'apa    1' + '\n' +
  '  2 bepa'

export function lines(xs: TemplateStringsArray) {
  return xs[0].trim().split(/\n/mg).map(words)
}

export function perms<A>(xs: A[]): A[][] {
  if (xs.length == 0) {
    return [[]]
  } else {
    return perms(xs.slice(1))
      .flatMap(ys =>
        range(0, ys.length)
          .map(i => [...ys.slice(0, i), xs[0], ...ys.slice(i)]))
  }
}

test(perms, [1, 2]).is = [[1, 2], [2, 1]]

test(() => perms([1, 2, 3]).length).is = 6

export function toposort<A extends {id: string, children?: string[]}>(spec: A[]): A[] {
  const placed: Record<string, boolean> = {}
  const queue: Record<string, A[]> = {}
  const out: A[] = []
  function place(e: A) {
    for (const ch of e.children || []) {
      if (!placed[ch]) {
        queue[ch] = [...(queue[ch] || []), e]
        return
      }
    }
    const q = queue[e.id] || []
    delete queue[e.id]
    out.push(e)
    placed[e.id] = true
    q.forEach(place)
  }
  spec.forEach(place)
  return out
}

{
  const subject = [{id: 1}, {id: 2, children: [1]}, {id: 3, children: [2]}]
  perms(subject).forEach(ys => test(toposort, ys).is = subject)
}

export function drop_while<A>(xs: A[], p: (a: A) => boolean) {
  for (let i = 0; i < xs.length; ++i) {
    if (!p(xs[i])) {
      return xs.slice(i)
    }
  }
  return []
}

export function drop_while_end<A>(xs: A[], p: (a: A) => boolean) {
  for (let i = xs.length - 1; i >= 0; --i) {
    if (!p(xs[i])) {
      return xs.slice(0, i+1)
    }
  }
  return []
}

test(drop_while, [1,2,3], i => true).is = []
test(drop_while, [1,2,3], i => i < 2).is = [2, 3]
test(drop_while, [1,2,3], i => false).is = [1, 2, 3]

test(drop_while_end, [1,2,3], i => true).is = []
test(drop_while_end, [1,2,3], i => i > 2).is = [1, 2]
test(drop_while_end, [1,2,3], i => false).is = [1, 2, 3]

export function drop_while_both_ends<A>(xs: A[], p: (a: A) => boolean) {
  return drop_while(drop_while_end(xs, p), p)
}

test(drop_while_both_ends, [1,2,3], i => true).is = []
test(drop_while_both_ends, [1,2,3], i => i != 1).is = [1]
test(drop_while_both_ends, [1,2,3], i => i != 2).is = [2]
test(drop_while_both_ends, [1,2,3], i => i == 1).is = [2, 3]
test(drop_while_both_ends, [1,2,3], i => false).is = [1, 2, 3]

export function partition<A>(xs: A[], p: (a: A, i: number) => boolean) {
  const yes = [] as A[]
  const no = [] as A[]
  xs.forEach((x, i) => (p(x, i) ? yes : no).push(x))
  return [yes, no]
}

test(partition, [1,2,3,4,5], (x: number) => x % 2 == 0).is = [[2, 4], [1, 3, 5]]

export function by<T extends Record<string, any>>(k: keyof T, xs: T[]): Record<string, T> {
  return Object.fromEntries(xs.map(s => [s[k], s])) as any
}

{
  const a = {id: 'a', v: 1}
  const b = {id: 'b', w: 2}
  test(by, 'id', [a, b]).is = {a, b}
}

export function by_many<T extends Record<string, any>>(k: keyof T, xs: T[]): Record<string, T[]> {
  const res: any = {}
  xs.forEach(s => {
    const sk = s[k]
    if (!(sk in res)) {
      res[sk] = new Set()
    }
    res[sk].add(s)
  })
  for (const k in res) {
    res[k] = [...res[k].values()]
  }
  return res
}

{
  const a = {id: 'a', v: 1}
  const b = {id: 'a', w: 2}
  test(by_many, 'id', [a, b]).is = {a: [a, b]}
}


export function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0)
}

test(sum, [1, 2, 30]).is = 33

export function* take<A>(n: number, xs: Iterable<A>): Generator<A> {
  let i = 0
  if (i >= n) return
  for (const x of xs) {
    yield x
    i++
    if (i >= n) return
  }
}

test(Array.from, take(2, [0, 1, 2, 3, 4])).is = [0, 1]
test(Array.from, take(2, [0])).is = [0]

export const id_supply = () => {
  let id = 0
  return () => id+++''
}

{
  const us = id_supply()
  test(us).is = '0'
  test(us).is = '1'
  test(us).is = '2'
  const us2 = id_supply()
  test(us2).is = '0'
  test(us).is = '3'
}

export const limit = <A extends Array<any>, B>(ms: number, f: (...args: A) => B) => {
  let timer: number | undefined
  let last_args: A
  return (...args: A) => {
    last_args = args
    clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      f(...last_args)
    }, ms)
  }
}

export function splits<A>(xs: A[]): [A[], A[]][] {
  return range(0, xs.length).map(i => [
    xs.slice(0, i),
    xs.slice(i, xs.length)
  ])
}

test(splits, [1, 2, 3]).is = [
  [[], [1, 2, 3]],
  [[1], [2, 3]],
  [[1, 2], [3]],
  [[1, 2, 3], []],
]

export function sequence(xs: A[][]): A[][] {
  if (xs.length == 0) {
    return [[]]
  } else {
    const [h, ...t] = xs
    return h.flatMap(h => sequence(t).map(t => [h, ...t]))
  }
}

const io = [1, 0]
test(sequence, [io, io, io]).is = [
  [1, 1, 1],
  [1, 1, 0],
  [1, 0, 1],
  [1, 0, 0],
  [0, 1, 1],
  [0, 1, 0],
  [0, 0, 1],
  [0, 0, 0],
]

export function insertions<A>(x: A, xs: A[]): A[][] {
  return splits(xs).map(([l, r]) => [...l, x, ...r])
}

test(insertions, 'x', [1, 2, 3]).is = [
  ['x', 1, 2, 3],
  [1, 'x', 2, 3],
  [1, 2, 'x', 3],
  [1, 2, 3, 'x'],
]

export function insertion_sides<A>(x: A, xs: A[]): A[][] {
  const to_left = xs.map(_ => [false, true])
  return sequence(to_left).map(w => w.reverse()).map(to_left => {
    const [l, r] = partition(xs, (_, i) => to_left[i])
    return [...l, x, ...r]
  })
}

test(insertion_sides, 'x', [1, 2]).is = [
  ['x', 1, 2],
  [1, 'x', 2],
  [2, 'x', 1],
  [1, 2, 'x'],
]

export function invert<A extends Array<any>, B, C>(
  f: (...args: A[]) => B[],
  g: (f: (...args: A[]) => B) => C,
): C[] {
  const out: C[] = []
  out.push(g((...args: A[]) => {
    const bs = f(...args).slice()
    const [b_last] = bs.splice(bs.length - 1, 1)
    bs.forEach(b => out.push(g(() => b)))
    return b_last
  }))
  return out
}

test(invert, insertions, k => `hello ${k(0, [8, 9])}!`).is = [
  'hello 0,8,9!',
  'hello 8,0,9!',
  'hello 8,9,0!',
]

