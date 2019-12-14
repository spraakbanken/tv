import * as Logic from 'logic-solver'
import * as LL from './logic-lib'

// hi inclusive
function range(lo: number, hi: number): number[] {
  return new Array(hi - lo + 1).fill().map((_, i) => i + lo)
}

type id = string

interface Node {
  id: id,
  width: number,
  above: id[],
  terminal_pos?: number
}

interface Sec {
  id: id,
  width: number,
  source: id,
  target: id
}

function graph(nodes: Node[], secs: Sec[], xbits: number, ybits: number, sep: number) {
  const Nodes = {} as
    Record<id,
      & Nodes
      & {
        parent?: id,
        parents: Set<id>,
        cover: Set<id>,
      }>

  nodes.forEach(node => { Nodes[node.id] = {node, ...node} as any })
  nodes.forEach(node => node.above.forEach(id => Nodes[id].parent = node.id))

  const terminals = {} as Record<number, id>
  nodes.forEach(node => {
    if (typeof node.terminal_pos === 'number') {
      terminals[node.terminal_pos] = node.id
    }
  })

  const ids = nodes.map(node => node.id)
  ids.forEach(function parents(id: id): Set<id> {
    if (Nodes[id].parents) {
      return Nodes[id].parents
    }
    const gps = Nodes[id].parents = new Set()
    const p = Nodes[id].parent
    if (p) {
      gps.add(p)
      parents(p).forEach(gp => gps.add(gp))
    }
    return gps
  })

  ids.forEach(function cover(id: id): Set<id> {
    if (Nodes[id].cover) {
      return Nodes[id].cover
    }
    Nodes[id].cover = (id + ' cycle!') as any
    Nodes[id].cover = unions((Nodes[id].above || []).map(cover))
    Nodes[id].cover.add(id)
    return Nodes[id].cover
  })

  const Secs = {} as Record<id, Sec>

  secs.forEach(sec => {
    Secs[sec.id] = {...sec}
  })

  const env: LL.Env = {
    terminal: nodes.filter(n => n.terminal_pos !== undefined).map(n => n.id),
    nonterminal: nodes.filter(n => n.terminal_pos === undefined).map(n => n.id),
    node: nodes.map(n => n.id),
    secedge: secs.map(s => s.id),
    gap: Logic.constantBits(sep),
  }

  const queries = {
    parent: (id: id) => Nodes[id].parent || false,
    preceding: (id: id) => {
      const i = Nodes[id].terminal_pos
      if (i && terminals[i-1]) {
        return terminals[i-1]
      } else {
        return false
      }
    },
    siblings: (a: id, b: id) => !Nodes[a].parents.has(b) && !Nodes[b].parents.has(a),
    child: (a: id, b: id) => Nodes[a].parent == b,
    width: (id: id) => Logic.constantBits(Nodes[id].id.length + 2),
    source: (id: id) => Secs[id].source,
    target: (id: id) => Secs[id].target,
  }

  Object.assign(env, queries)

  const bitsize = name => name == 'slack' ? 1 : name[0] == 'y' ? ybits : xbits

  const {solver, constrain, interpret, minimize} = LL.init(bitsize, env)

  console.time('constrain')

  constrain`
    t: terminal
    y(t) == 0

    when(preceding(t))
    right(preceding(t)) + gap <= left(t)
  `

  constrain`
    i: nonterminal
    j: nonterminal
    when(i != j)
    y(i) == y(j) && mid(i) < mid(j) ==> right(i) + gap <= left(j)
  `

  // constrain`
  //   i: node
  //   j: node
  //   when(siblings(i, j))
  //   left(i) < left(j)  && left(j) < right(i)  ||
  //   left(i) < right(j) && right(j) < right(i)
  //     ==>    y(i) != y(j)
  //         && (y(i) > y(j) ==> blocked?(i))
  //         && (y(j) > y(i) ==> blocked?(j))
  // `

    // left(i) + used_width(i) == right(i)
  constrain`
    i: node
    left(i) + width(i) <= right(i)

    !blocked?(i) ==> mid(i) + mid(i) == left(i) + right(i) + slack(i)
    blocked?(i) ==> mid(i) == right(i)

    when(parent(i))
    y(parent(i)) > y(i)

    left(parent(i)) <= mid(i)
    right(parent(i)) >= mid(i)
  `

  // constrain`
  //   c: node
  //   p: node
  //   when(child(c, p))
  //   left(p) <= left(c)
  //   right(p) >= right(c)
  // `

  constrain`
    s: secedge
    y0(s) == y(source(s))
    y1(s) == y(target(s))

    x0(s) == mid(s)
    x2(s) == mid(target(s))

    y0(s) >  y1(s) ==> top(s) == y0(s) && bot(s) == y1(s)
    y0(s) <= y1(s) ==> top(s) == y1(s) && bot(s) == y0(s)
  `

  constrain`
    s: secedge
    i: node
    colliding?(s, i) <==
         bot(s) < y(i) && y(i) < top(s)
      && left(i) <= x1(s) && x1(s) <= right(i)
  `

  constrain`
    i: node
    max_width >= right(i)
  `

  constrain`
    s: secedge
    max_width >= x0(s)
    max_width >= x1(s)
    max_width >= x2(s)
  `

  constrain`
    i: node
    max_height >= y(i)
  `

  console.timeEnd('constrain')

  minimize(`
    i: node
    blocked?(i)
  `, {strategy: 'bottom-up'})

  minimize`
    s: secedge
    i: node
    colliding?(s, i)
  `

  minimize`max_height`
  minimize`max_width`

  // minimize(`i : node; used_width(i)`, {strategy: 'bottom-up'})
  minimize(`i : node; right(i)`, {strategy: 'bottom-up'})
  minimize(`i : node; left(i)`, {strategy: 'bottom-up'})

/*
  constrain`
    s: secedge
    x1(s) < x0(s) && x1(s) < x2(s) ==> x1(s) + xL(s) >= x0(s)
    x1(s) < x0(s) && x1(s) < x2(s) ==> x1(s) + xL(s) >= x2(s)

    x1(s) > x0(s) && x1(s) > x2(s) ==> x1(s) <= x0(s) + xR(s)
    x1(s) > x0(s) && x1(s) > x2(s) ==> x1(s) <= x2(s) + xR(s)
  `

  minimize`
    s: secedge
    xL(s) + xR(s)
  `
  */

  const sol = solver.solve()

  if (sol === null) {
    console.log('no solution!')
  } else {
    const value = interpret(sol)

    const max_width = value`max_width`
    const max_height = value`max_height`

    const area = range(0, max_height*2).map(y => range(0, max_width).map(_ => ' '))

    const msgs = [] as any[]
    const draw = interpret(sol, {
      path(...args: any[]) { msgs.push(['path', ...args]) },
      log(...args) {
        console.log(args)
      },
      hbar(x0, x1, y) {
        range(x0, x1).forEach(x => area[y*2][x] = '_')
      },
      vbar(x, y0, y1) {
        range(y0*2+1, y1*2-1).forEach(y => {
          area[y][x-1] = ' '
          area[y][x+0] = '|'
          area[y][x+1] = ' '
        })
      },
      label(txt, xmid, xright, y) {
        const L = txt.length
        const xbase = xmid == xright ? xright - L : xmid - Math.floor(L / 2)
        range(0, L-1).forEach(i => area[y*2][xbase + i] = txt[i])
      }
    })
      // log(y(i), left(i), mid(i), right(i), i, blocked?(i))
    draw`
      i: node
      hbar(left(i), right(i), y(i))
      label(i, mid(i), right(i), y(i))
    `
    draw`
      i: node
      when(parent(i))
      vbar(mid(i), y(i), y(parent(i)))
    `
    area.reverse()
    console.log()
    console.log(area.map(l => l.join('')).join('\n'))
    console.log()
    draw`
      s: secedge
      log(x0(s), y0(s))
      log(x1(s), y0(s))
      log(x2(s), y1(s))
    `
  }
}



















function nub<A>(xs: A[]): A[] {
  const seen = {} as Record<string, boolean>
  return xs.filter(x => {
    const s = x.toString()
    const duplicate = s in seen
    seen[s] = true
    return !duplicate
  })
}

function unions<A>(sets: Set<A>[]): Set<A> {
  const [first, ...rest] = sets
  if (first === undefined) {
    return new Set()
  }
  const out = new Set(first)
  rest.forEach(s => s.forEach(x => out.add(x)))
  return out
}

function intersects<A>(a: Set<A>, b: Set<A>): boolean {
  if (a.size > b.size) {
    return intersects(b, a)
  }
  for (let x of a) {
    if (b.has(x)) {
      return true
    }
  }
  return false
}

if (false) {

graph([
  {id: 'jag', width: 3, above: [], terminal_pos: 1},
  {id: 'sitter', width: 6, above: [], terminal_pos: 2},
  {id: 'och', width: 3, above: [], terminal_pos: 3},
  {id: 'läser', width: 5, above: [], terminal_pos: 4},
  {id: 's', width: 1, above: ['jag', 'sitter']},
  {id: 'hd', width: 2, above: ['läser']},
  {id: 's2', width: 2, above: ['hd']},
  {id: 'kop', width: 3, above: ['s', 'och', 's2']},
], [
  {id: 'sb2', width: 3, source: 's2', target: 'jag'}
], 8, 4, 2)

graph([
  {id: 'a', width: 10, above: [], terminal_pos: 1},
  {id: 'b', width: 9, above: [], terminal_pos: 2},
  {id: 'c', width: 8, above: [], terminal_pos: 3},
  {id: 'd', width: 7, above: [], terminal_pos: 4},
  {id: 'ac', width: 8, above: ['a', 'c']},
  {id: 'bd', width: 8, above: ['b', 'd']},
  {id: 'S', width: 8, above: ['ac', 'bd']},
], [], 8, 2, 2)

graph([
  {id: 'a', width: 10, above: [], terminal_pos: 1},
  {id: 'b', width: 9, above: [], terminal_pos: 2},
  {id: 'c', width: 8, above: [], terminal_pos: 3},
  {id: 'd', width: 7, above: [], terminal_pos: 4},
  {id: 'bc', width: 8, above: ['b', 'c']},
  {id: 'ad', width: 8, above: ['a', 'd']},
  {id: 'S', width: 8, above: ['bc', 'ad']},
], [], 8, 2, 2)

graph([
  {id: 'a', width: 16, above: [], terminal_pos: 1},
  {id: 'b', width: 16, above: [], terminal_pos: 2},
  {id: 'c', width: 16, above: [], terminal_pos: 3},
  {id: 'd', width: 16, above: [], terminal_pos: 4},
  {id: 'ab', width: 100, above: ['a', 'b']},
  {id: 'cd', width: 100, above: ['c', 'd']},
  {id: 'S', width: 1, above: ['ab', 'cd']},
], [], 8, 2, 2)

for (let j = 0; j < 0; ++ j) {
  const test = []
  for (let i = 1; i < 5 + j; ++i) {
    test.push({id: 't'+i, width: 1, above: [], terminal_pos: i})
  }
  const active = test.map(x => x.id)
  while (active.length >= 2) {
    const above = []
    while (active.length > 0 && (above.length < 2 || Math.random() > 0.5)) {
      above.push(active.splice(Math.floor(Math.random() * active.length), 1))
    }
    const id = 'nt' + test.length
    test.push({id, width: 1, above})
    active.push(id)
  }
  graph(test, [], 8, 4, 2)
}

}


for (let j = 10; j < 11; ++ j) {
  const test = []
  for (let i = 1; i < 5 + j; ++i) {
    test.push({id: 't'+i, width: 5 + Math.floor(Math.random() * 12), above: [], terminal_pos: i})
  }
  let active = test.map(x => x.id)
  let next = []
  do {
    while (active.length >= 2) {
      const width = 2 + Math.floor(Math.random() * Math.min(active.length - 2, 1))
      const above = active.splice(0, width)
      const id = 'nt' + test.length
      test.push({id, width: 10, above})
      next.push(id)
      // console.dir({start, width, above, active, next})
    }
    active = next
    next = []
  } while (active.length >= 2)
  // console.dir(test)
  graph(test, [], 8, 4, 2)
}

console.log('done')
