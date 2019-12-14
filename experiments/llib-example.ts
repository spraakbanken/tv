import * as Logic from 'logic-solver'
import * as LL from './logic-lib'

const test_env: LL.Env = {
  node: [0, 1, 2, 3].map(x => x.toString()),
  child: (i: LL.Arg) => {
    const x = Number(i) - 1
    return (x >= 0) ? '' + x : false
  },
}

const {solver, constrain, interpret, minimize} = LL.init(_ => 8, test_env)

constrain`
  x: node
  a(x) == 2 <==> two?(x)
`

constrain`
  s? || t? || u?
`

constrain`
  x: node
  when(child(x))
  a(child(x)) < a(x)
`

constrain`
  x: node
  y: node
  sum(x, y) == a(x) + a(y)
  lt?(x, y) <==> a(x) < a(y)
`

constrain`
  x: node
  y: node
  z: node
  when(x < y)
  when(y < z)
  a(x) + a(y) < a(z) + 1
`

constrain`
  a('0') == 3
`

constrain`
  x: node
  max_width >= a(x)
`

let opts = {progress: console.log}

const sol = minimize(cost => {
  cost`max_width`
  cost`x: node; a(x)`
}, opts)

if (sol === null) {
  throw 'no solution'
}

const msgs = [] as any[]
const draw = interpret(sol, {
  path(...args: any[]) { msgs.push(['path', ...args]) },
  text(...args: any[]) { msgs.push(['text', ...args]) }
})

draw`text(max_width)`

draw`text(s?, t?, u?)`

draw`text(a('0'))`

draw`
  i: node
  j: node
  k: node
  when(i < j && j < k)
  path(i, j, k, a(i), a(j), a(k))
`

console.log(msgs)
