import {test, test_eval} from "./test.ts"

export function nub<A>(xs: A[]): A[] {
  const seen = new Set<A>()
  return xs.filter(x => {
    const duplicate = seen.has(x)
    duplicate || seen.add(x)
    return !duplicate
  })
}

test(nub, [1, 2, 3, 3]).is = [1, 2, 3]

export const words = (s: string) => s.trim().split(/\s+/g)

test(words, ' apa bepa cepa ').is = ['apa', 'bepa', 'cepa']

export function group<A, B>(xs: A[], f: (a: A) => B): A[][] {
  if (xs.length == 0) {
    return []
  }
  const out = [] as A[][]
  let cursor: A[]
  let last: string
  xs.forEach(x => {
    const fx = f(x)
    const now = JSON.stringify([fx === undefined, fx])
    if (now !== last) {
      cursor = []
      out.push(cursor)
    }
    cursor.push(x)
    last = now
  })
  return out
}

test(group, [], (x: string) => x).is = []
test(group, [1, 2, 3, 4, 5, 6], (x: number) => Math.floor(x / 2)).is = [[1], [2, 3], [4, 5], [6]]

export function mapObject<K extends string, A, B>
    (obj: Record<K, A>, f: (k: K, v: A, i: number) => B): B[] {
  return Object.entries(obj).map(([k, v], i) => f(k as K, v as A, i))
}

export function mapEntries<K extends string, A, B>
    (obj: Record<K, A>, f: (k: K, v: A, i: number) => B): Record<K, B> {
  return Object.fromEntries(mapObject(obj, (k, v, i) => [k, f(k, v, i)])) as any
}

export const range = (from: number, to: number) => {
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

export const lines = xs => xs[0].trim().split(/\n/mg).map(words)

export function perms(xs) {
  if (xs.length == 0) {
    return [[]]
  } else {
    const out = []
    perms(xs.slice(1)).forEach(ys => {
      range(0, ys.length).forEach(i => {
        out.push([...ys.slice(0, i), xs[0], ...ys.slice(i)])
      })
    })
    return out
  }
}

test(perms, [1, 2]).is = [[1, 2], [2, 1]]

test(() => perms([1, 2, 3]).length).is = 6

export function toposort<A extends {id: Id, children?: Id[]}>(spec: A[]): A[] {
  const placed = {}
  const queue = {}
  const out = []
  function place(e) {
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

export function partition<A>(xs: A[], p: (a: A) => boolean) {
  const yes = [] as A[]
  const no = [] as A[]
  xs.forEach(x => (p(x) ? yes : no).push(x))
  return [yes, no]
}

test(partition, [1,2,3,4,5], x => x % 2 == 0).is = [[2, 4], [1, 3, 5]]

export function by<T extends Record<string, any>>(k: keyof T, xs: T[]): Record<string, T> {
  return Object.fromEntries(xs.map(s => [s[k], s])) as any
}

{
  const a = {id: 'a', v: 1}
  const b = {id: 'b', w: 2}
  test(by, 'id', [a, b]).is = {a, b}
}
