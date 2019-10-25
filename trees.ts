// import "./cola.js"
// import {d3} from "./d3v4.js"
import * as domdiff from "./domdiff.js"
import {default as pretty} from "json-stringify-pretty-compact"
const c = console

declare const module: {hot?: {accept: Function}}
module.hot && module.hot.accept()

window.viewers = window.viewers || {}
window.viewers.tree = (mimes, blob) => {
  const plain = mimes['text/plain']
  if (plain) {
    const p = new DOMParser()
    const xml = p.parseFromString(mimes['text/plain'], 'text/xml')
    const err = xml.querySelector('parsererror')
    if (xml && !err) {
      c.log(blob.id, xml)
      const sents = xml.querySelectorAll('s')
      for (let i = 331; i < 332; ++i) {
        const s = sents[i]
        const ts  = Array.from(s.querySelectorAll('t'))
        const nts = Array.from(s.querySelectorAll('nt'))
        const simp = x => {
          const m = x.match(/[^\d]*(.*)$/)
          return m && m[1] || x
        }
        const token = 'id word pos msd'.split(/ /g)
        const T = ts.map(t => Object.fromEntries(token.map(k => [k, simp(t.attributes[k].value)])))
        const NT = nts.map(nt => ({
          id: simp(nt.id),
          cat: nt.attributes.cat.value,
          ...Object.fromEntries(Array.from(nt.children).flatMap((edge, i) => [
              [`lbl${i}`, edge.tagName.replace('edge', '').replace('sec', 'sec-') + edge.attributes.label.value],
              [`ref${i}`, simp(edge.attributes.idref.value)]
          ]))}))
        c.log(i, s)
        c.table(T)
        c.table(NT)
      }
      return {text: '<xml/>'}
    }
  }
}

// function test_eval(lhs_str: any, rhs: any) {
//   test_impl(lhs_str, eval(lhs_str), rhs)
// }

function test_impl(lhs_str: string, lhs: any, rhs: any) {
  const l_res = pretty(lhs)
  const r_res = pretty(rhs)
  if (l_res == r_res) {
    const style = `color: green; font-size: 1.4em; font-weight: 1000; margin-top: -1em`
    console.info(`%c\u2713%c ${lhs_str} == ${r_res}`, style, ``)
  } else {
    console.error(`${lhs_str}\n  == ${l_res}\n  != ${r_res}`)
  }
}

interface Settable<B> {
  is: B
  set(this: this, prop: string, rhs: B): void
}
const t = {}
function test<B>(fn: () => B): Settable<B>
function test<A, B>(fn: (a: A) => B, a: A): Settable<B>
function test<A, A2, B>(fn: (a: A, a2: A2) => B, a: A, a2: A2): Settable<B>
function test<A, A2, A3, B>(fn: (a: A, a2: A2, a3: A3) => B, a: A, a2: A2, a3: A3): Settable<B>
function test<A, A2, A3, A4, B>(fn: (a: A, a2: A2, a3: A3, a4: A4) => B, a: A, a2: A2, a3: A3, a4: A4): Settable<B>
function test<B>(fn: (...a: any[]) => B, ...args: any[]): Settable<B> {
  const m = fn.toString().match(/^function\s*(\w+)/)
  const fn_name = m ? m[1] : `(${fn.toString()})`
  return Object.create(null, {
    is: {
      set(rhs) {
        test_impl(`${fn_name}(${args.map(pretty).join(", ")})`, fn(...args), rhs)
      }
    }
  })
}

const words = (s: string) => s.trim().split(/\s+/g)

test(words, ' apa bepa cepa ').is = ['apa', 'bepa', 'cepa']

function group<A, B>(xs: A[], f: (a: A) => B): A[][] {
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

function mapObject<K extends string, A, B>
    (obj: Record<K, A>, f: (k: K, v: A, i: number) => B): B[] {
  return Object.entries(obj).map(([k, v], i) => f(k as K, v as A, i))
}

function mapEntries<K extends string, A, B>
    (obj: Record<K, A>, f: (k: K, v: A, i: number) => B): Record<K, B> {
  return Object.fromEntries(mapObject(obj, (k, v, i) => [k, f(k, v, i)])) as any
}

const range = (from: number, to: number) => {
  const out = []
  for (let i = from; i <= to; ++i) {
    out.push(i)
  }
  return out
}

test(range, 2, 4).is = [2,3,4]
test(range, 2, 2).is = [2]
test(range, 2, 1).is = []

const show_table = (xss: string[][]) => {
  const widthss = xss[0].map<number[]>(_ => [])
  xss.map(xs => xs.map((x, i) => widthss[i].push(x.length)))
  const widths = widthss.map(ws => Math.max(...ws))
  const leftpad = (x: string, w: number) => (new Array(w - x.length).fill(' ')).join('') + x
  return xss.map(xs => xs.map((x, i) => leftpad(x, widths[i])).join(' ')).join('\n')
}

test(show_table, [['apa', '1'], ['2', 'bepa']]).is =
  'apa    1' + '\n' +
  '  2 bepa'

const lines = xs => xs[0].trim().split(/\n/mg).map(words)

const {div, style, id, MakeAttr} = domdiff
const {css, sheet} = domdiff.class_cache()

css`
  body {
    font-family: Source Sans Pro;
    font-size: 22px;
    font-weight: 400
  }
  pre {
    font-family: Consolas;
    border-left: 2px #8cf solid;
    padding-left: 2px;
    background: #f8f8f8;
  }
`;

const page = []

const G = (...spec: {id: string, children?: string[]}[]) => {
  // c.log({spec})

  interface State {
    text_width: number,
    text_height: number,
    left: number,
    right: number,
    mid: number,
    y: number,
    top: number,
    parent_placed: boolean,
    right_align: boolean,
  }
  function autofill(s: State): State {
    if (s.mid === undefined) {
    }
    return s
    // return mapEntries(s, (_, v: number | boolean) => typeof v === 'boolean' ? v : Math.round(v * 100) / 100) as any
  }
  const state = {} as Record<string, State>

  const measure_root = document.body

  spec.forEach(s => {
    const span = document.createElement('span')
    span.className = 'measure'
    measure_root.append(span)
    span.innerHTML = s.id
    const root = span.getBoundingClientRect()
    state[s.id] = {text_width: root.width, text_height: root.height} as State
    measure_root.removeChild(span)
  })

  const gap_x = Object.values(state)[0].text_height / 3
  const gap_y = Object.values(state)[0].text_height / 3
  let next_terminal_x = 0

  const line_gap = 4
  const line_width = 2

  const msgs = []

  const lines = [] as any[]
  spec.forEach((s, i) => {

    const hline = (y: number, left: number, right: number) => {
      lines.push(div(
        css`position: absolute`,
        css`background: black`,
        style`left: ${(left)}px;`,
        style`width: ${(right - left)}px;`,
        style`bottom: ${(y)}px;`,
        style`height: ${line_width}px;`,
        style`z-index: ${i+1};`,
      ))
    }

    const vline = (x: number, bot: number, top: number) => {
      lines.push(div(
        css`position: absolute`,
        css`background: white`,
        style`left: ${(x - line_gap / 2)}px;`,
        style`width: ${line_width + line_gap}px;`,
        style`bottom: ${(bot)}px;`,
        style`height: ${(top - bot)}px;`,
        style`z-index: ${i};`,
      ))
      lines.push(div(
        css`position: absolute`,
        css`background: black`,
        style`left: ${(x)}px;`,
        style`width: ${line_width}px;`,
        style`bottom: ${(bot)}px;`,
        style`height: ${(top - bot)}px;`,
        style`z-index: ${i};`,
      ))
    }

    if (!s.children || s.children.length == 0) {
      state[s.id] = {
        ...state[s.id],
        left: next_terminal_x,
        right: next_terminal_x + state[s.id].text_width,
        mid: next_terminal_x + state[s.id].text_width / 2,
        y: 0,
        top: state[s.id].text_height,
        parent_placed: false
      }
      next_terminal_x += state[s.id].text_width + gap_x
    } else {
      const children = s.children
      const my_children = Object.fromEntries(children.map(id => [id, true]))
      const active_below: {x: number, id: string}[] =
        Object.entries(state).flatMap(([id, s]) => {
          const active = s.left && !s.parent_placed
          if (my_children[id] || active) {
            return [{x: s.left, id}, {x: s.right, id}]
          } else {
            return []
          }
        }).sort((a, b) => a.x - b.x)
      const pregroups = group(active_below, e => my_children[e.id]).filter(g => my_children[g[0].id)
      const groups = pregroups.map(g => {
        const xs = g.map(e => e.x)
        const xmin = Math.min(...xs)
        const xmax = Math.max(...xs)
        return {
          ids: g.map(e => e.id),
          width: xmax - xmin
        }
      }).sort((a, b) => b.width - a.width)
      const above_children = groups[0].ids
      const leftmost_mid = Math.min(...children.map(id => state[id].mid))
      const rightmost_mid = Math.max(...children.map(id => state[id].mid))
      const left_mid = Math.min(...above_children.map(id => state[id].mid))
      const right_mid = Math.max(...above_children.map(id => state[id].mid))
      const left = Math.min(...above_children.map(id => state[id].left))
      const right = Math.max(...above_children.map(id => state[id].right))
      const tops = Math.max(...children.map(id => state[id].top))
      children.forEach(id => state[id].parent_placed = true)
      const y = tops + gap_y
      state[s.id] = {
        ...state[s.id],
        left,
        right,
        mid: (left_mid + right_mid) / 2,
        y,
        top: y + state[s.id].text_height,
        parent_placed: false
      }
      hline(state[s.id].y - gap_y / 2, leftmost_mid, rightmost_mid + line_width)
      vline(state[s.id].mid, state[s.id].y - gap_y / 2, state[s.id].y)
      children.forEach(id =>
        vline(state[id].mid, state[id].top, state[s.id].y - gap_y / 2)
      )
    }
  })

  const w = Math.max(...Object.values(state).map(s => s.right))
  const h = Math.max(...Object.values(state).map(s => s.top))

  page.push(
    domdiff.pre(msgs.join('\n'), css`font-size: 12px`),
    div(
      css`
        display: flex;
        align-items: start;
      `,
      // domdiff.pre(pretty({spec, state, w, h}), css`margin-left: auto`),
      div(
        css`position: relative; order: -1; margin: 40px`,
        style`width: ${w}px;`,
        style`height: ${h}px;`,
        ...mapObject(state, (id, s) =>
          div(
            css`position: absolute`,
            style`left: ${s.mid - s.text_width / 2}px;`,
            style`bottom: ${s.y}px;`,
            {attr: 'note', value: pretty(s)},
            id
          )
        ),
        ...lines,
      )
    )
  )
}

const base = (s: string) => words(s).map(id => ({id}))
const nodes = (o: Record<string, string>) => mapObject(o, (id, children) => ({id, children: words(children)}))

G(...base('igår ville jag åka dit'),
  ...nodes({
    B: 'igår åka dit',
    N: 'B',
    B2: 'ville jag N',
    N2: 'B2',
  }))

G(...base('jag ville åka dit igår'),
  ...nodes({
    IP: 'åka dit',
    IP2: 'IP igår',
    VP: 'IP2 ville',
    S: 'jag VP',
  }))

G(...base('jag ville åka dit igår'),
  ...nodes({
    IP: 'åka dit',
    VP: 'IP ville',
    VP2: 'VP igår',
    S: 'jag VP2',
  }))

G(...base('igår ville jag åka dit'),
  ...nodes({
    IP: 'åka dit',
    VP: 'jag ville',
    'VP₂': 'VP IP',
    S: 'igår VP₂',
  }))

G(...base('igår ville jag åka dit'),
  ...nodes({
    IP: 'åka dit',
    VP: 'jag ville',
    'IP₂': 'IP igår',
    'S? VP?': 'VP IP₂',
  }))

G(...base('igår ville jag åka dit'),
  ...nodes({
    IP: 'åka dit',
    'IP2?': 'IP igår',
    VP: 'IP2? ville',
    'S?': 'jag VP',
  }))

G(...base('igår ville jag åka dit'),
  ...nodes({
    IP: 'åka dit',
    VP: 'IP ville',
    VP2: 'VP igår',
    'S?': 'jag VP2',
  }))

G(...base('jag ville åka dit igår'),
  ...nodes({
    IP: 'igår åka dit',
    S: 'ville jag IP',
  })),

G(...base('jag ville åka dit igår'),
  ...nodes({
    IP: 'dit åka',
    S: 'ville jag IP igår',
  })),

G(...base('igår ville jag åka dit'),
  ...nodes({
    IP: 'åka dit',
    S: 'igår ville jag IP',
  }))

G(...base('igår ville jag åka dit'),
  ...nodes({
    'IP?': 'igår åka dit',
    S: 'ville jag IP?',
  }))

G(...base('a b c d e'),
  ...nodes({
    C: 'c e',
    S: 'a b C d',
  }))

G(...base('a b c d e'),
  ...nodes({
    WIDE: 'c e',
    S: 'a b WIDE d',
  }))


G(...base('a b c d e f'),
  ...nodes({
    CD: 'c d f',
    S: 'a b CD e',
  }))

G(...base('a b c d e f'),
  ...nodes({
    EF: 'c e f',
    S: 'a b d EF',
  }))

G(...base('a b c d e f & h'),
  ...nodes({
    EF: 'c e f',
    S: 'a b d EF',
    'S₂': 'S & h'
  }))

G(...base('a b c d e f & h g'),
  ...nodes({
    DEF: 'd e f',
    S: 'a b c DEF',
    HG: 'h g',
    'S₂': 'S & HG',
  }))

// window.update_flags()
// window.schedule_refresh()

let root = document.querySelector('#root')
if (!root) {
  document.body.innerHTML = '<div id="root">'
  root = document.querySelector('#root')
}

console.time()
div(id`root`, sheet(), ...page)(root)
console.timeEnd()

