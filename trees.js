// import "./cola.js"
// import {d3} from "./d3v4.js"
import * as domdiff from "./domdiff.js"
const c = console

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

const words = s => s.trim().split(/\s+/g)
const same = (lhs, rhs) => {
  const show = x => JSON.stringify(x)
  const run = side => {
    if (typeof side == 'function') {
      const lit = side.toString().replace(/^\(\)\s*=>\s*/, '')
      const res = show(side())
      return [true, res, lit, `${lit}\n   == ${res}`, `${res}\n   == ${lit}`]
    } else {
      const res = show(side)
      return [false, res, res, res, res]
    }
  }
  const [l_is_fn, l_res, l_lit, l_lit_res, _l] = run(lhs)
  const [r_is_fn, r_res, r_lit, _r, r_res_lit] = run(rhs)
  if (l_res == r_res) {
    const style = `color: green; font-size: 1.4em; font-weight: 1000; margin-top: -1em`
    if (l_is_fn && r_is_fn) {
      console.info(`%c\u2713%c ${l_lit_res}\n   == ${r_lit}`, style, ``)
    } else {
      console.info(`%c\u2713%c ${l_lit} == ${r_lit}`, style, ``)
    }
  } else {
    console.error(`${l_lit_res}\n   != ${r_res_lit}`)
  }
}

same(() => words(' apa bepa cepa '), ['apa', 'bepa', 'cepa'])

const mapEntries = (obj, f) => Object.entries(obj).map(([k, v], i) => f(k, v, i))

const base = s => words(s).map(id => ({id}))
const nodes = o => mapEntries(o, (id, above) => ({id, above: words(above)}))

const j = s => JSON.stringify(s, 2, 2)

const range = (from, to) => {
  const out = []
  for (let i = from; i <= to; ++i) {
    out.push(i)
  }
  return out
}

same(() => range(2, 4), [2,3,4])
same(() => range(2, 2), [2])
same(() => range(2, 1), [])

const show_table = xss => {
  const widthss = xss[0].map(_ => [])
  xss.map(xs => xs.map((x, i) => widthss[i].push(x.length)))
  const widths = widthss.map(ws => Math.max(...ws))
  const leftpad = (x, w) => (new Array(w - x.length).fill(' ')).join('') + x
  return xss.map(xs => xs.map((x, i) => leftpad(x, widths[i])).join(' ')).join('\n')
}

same(() => show_table([['apa', '1'], ['2', 'bepa']]),
    'apa    1' + '\n' +
    '  2 bepa'
  )

const lines = xs => xs[0].trim().split(/\n/mg).map(words)

function grid_table(table_fn) {
  const table = table_fn(m => m.id)
  return table.map(row => row.map(cells => {
    if (cells.length == 0) {
      return '-'
    } else {
      return cells.join('/')
    }
  }))
}

const show_grid_table = fn => show_table(grid_table(fn))

function grid(...nodes) {
  c.time('grid')
  const meta = {}

  const nodes_with_meta = () => Object.fromEntries(nodes.map(node => [
    node.id,
    {...node, ...(meta[node.id] || {error: 'unplaceable'})}
  ]))

  const w = () => Math.max(...mapEntries(meta, (_, v) => v.x1))
  const h = () => Math.max(...mapEntries(meta, (_, v) => v.y1 || v.y0))

  function table(f = cell => cell) {
    const current = nodes_with_meta()
    const try_f = id => meta[id] === undefined ? undefined : f(current[id])

    return (
      range(0, h()).map(y =>
      range(0, w()).map(x =>
        Object.values(meta).filter(m => {
          const res = m.ex0 <= x && x <= m.ex1 && m.y0 <= y && y <= m.y1
          // console.log({x, y, res, ...m})
          return res
        }).reverse().map(m => try_f(m.id))
      )).reverse()
    )
  }

  const active = [] // one for each pane, y1 does not yet exist
  let progress = true
  while (progress) {
    progress = false
    nodes.forEach(node => {
      const {id, above} = node
      const ready = (above || []).every(id => id in meta)
      if (ready && !(id in meta)) {
        progress = true
        if (!above || above.length == 0) {
          const x = active.length
          meta[id] = {id, ex0: x, x0: x, x1: x, ex1: x, y0: 0, y1: 0}
          active.push(meta[id])
        } else {
          const meta_above = above.map(i => meta[i]).sort((m1, m2) => m1.x0 - m2.x0)
          const spans = [[meta_above[0]]]
          const last = xs => xs[xs.length-1]
          meta_above.forEach((_, i) => {
            if (i > 0) {
              const left = meta_above[i-1]
              const right = meta_above[i]
              if (left.x1 + 1 == right.x0) {
                last(spans).push(right)
              } else {
                spans.push([right])
              }
            }
          })
          const span_widths = spans.map(span => ({
            span,
            width: last(span).x1 - span[0].x0
          })).sort((s1, s2) => s2.width - s1.width)
          const widest = span_widths[0].span
          const x0 = widest[0].x0
          const x1 = last(widest).x1
          const ex0 = Math.min(...above.map(id => meta[id].x0))
          const ex1 = Math.max(...above.map(id => meta[id].x1))
          const exs = range(ex0, ex1)
          const xs = range(x0, x1)
          const y0 = 1 + Math.max(...exs.map(i => active[i].y1 || active[i].y0 || 0))
          meta[id] = {id, ex0, x0, x1, ex1, y0, y1: y0}
          const bumped = {}
          range(ex0, ex1).forEach(i => bumped[i] = 'bumps')
          meta_above.forEach(m => range(m.x0, m.x1).forEach(i => bumped[i] = 'seals'))
          active[ex0].leftmost = true
          active[ex1].rightmost = true
          Object.entries(bumped).forEach(([i, verb]) => {
            if (verb == 'seals' && above.every(aid => aid != active[i].id)) {
              if (above.length == 1) {
                console.warn(id, verb, active[i].id, 'but is above', above[0])
                active[i] = meta[above[0]]
              } else {
                console.error(id, verb, active[i].id, 'but is above', above)
              }
            }
            if (active[i]) {
              if (verb == 'bumps') {
                // console.log('bump from', active[i].y1, 'to', y0)
                active[i].y1 = y0
              } else if (verb == 'seals') {
                // console.log('seal from', active[i].y1, 'to', y0-1)
                active[i].y1 = y0 - 1
                active[i] = {}
              }
            } else {
              console.warn(id, 'wants to', verb, i, 'but is not active!')
            }
          })
          xs.forEach(i => { active[i] = meta[id] })
          if (exs.every(i => !active[i].id || active[i].id == id)) {
            // we can make xs := exs because everything under us is sealed
            // this is not strictly necessary
            exs.forEach(i => { active[i] = meta[id] })
            meta[id].x0 = meta[id].ex0
            meta[id].x1 = meta[id].ex1
          }
        }
        // console.log(show_grid_table(table))
      }
    })
  }

  Object.values(meta).forEach(m => m.y1 = m.y1 || m.y0)

  c.timeEnd('grid')
  return {table, nodes: nodes_with_meta(), width: w(), height: h()}
}

const {div, style, id, cls, MakeAttr} = domdiff
const {css, sheet, generate_class} = domdiff.class_cache()

const page = []

const G = (...spec) => {
  const g = grid(...spec)
  const gt = grid_table(g.table)
  c.log(show_table(gt))
  c.log(g)

  const grid_column = (x0, x1) => css`grid-column: ${x0 + 1} / ${x1 + 2};`
  const grid_row = (y0, y1) => css`grid-row: ${-2 * y0 - 1} / ${-2 * y1 - 1};`

  const T = div(
    css`
      display: inline-grid;
      width: max-content;
      grid-column-gap: 10px;
      grid-row-gap: 5px;
      --line-width: 2px;
      --line-overlap-erase-width: calc(3 * var(--line-width));
    `,
    // css`
    //   grid-template-columns: repeat(${g.width}, max-content);
    //   grid-template-rows: repeat(${g.height}, 1px max-content);
    // `,
    css`
      // & > div { border: 1px #f009 solid }
    `,
    css`
      margin: 40px;
    `,
    ...mapEntries(g.nodes, (_, node) => {
      const {id, x0, x1, y0, y1, ex0, ex1} = node
      const note = x => MakeAttr('note')(id + ': ' + x)
      return [
        y0 > 0 && div(grid_column(ex0, ex1), grid_row(y0-0.5, y0),
          note`horizontal bar`,
          css`
            z-index: 1;
            background: black;
            width: 100%;
            height: var(--line-width);
          `),
        y1 < g.height && node.leftmost && div(grid_column(x0, x1), grid_row(y1+0.5, y1+1),
          note`leftmost horizontal bar erase`,
          css`z-index: 2; background: #fff; width: 50%;`,
          css`justify-self: start;`),
        y1 < g.height && node.rightmost && div(grid_column(x0, x1), grid_row(y1+0.5, y1+1),
          note`rightmost horizontal bar erase`,
          css`z-index: 2; background: #fff; width: 50%;`,
          css`justify-self: end;`),
        y1 < g.height && y1 > 0 && div(grid_column(x0, x1), grid_row(y0+0.5, y1+0.5),
          note`vertical bar overlap erase`,
          css`
            z-index: 2;
            background: #fff;
            width: calc(2 * var(--line-overlap-erase-width));
            justify-self: center;
          `),
        y1 < g.height && div(grid_column(x0, x1), grid_row(y0+0.5, y1+1),
          note`vertical bar`,
          css`
            z-index: 3;
            background: black;
            width: var(--line-width);
            justify-self: center;
          `),
        y1 < g.height && div(grid_column(x0, x1), grid_row(y0, y0+1),
          note`vertical bar above label`,
          css`
            z-index: 3;
            background: black;
            width: var(--line-width);
            justify-self: center;
            align-self: start;
            height: 50%;
          `),
        y0 > 0 && div(grid_column(x0, x1), grid_row(y0-0.5, y0+0.5),
          note`vertical bar below label`,
          css`
            z-index: 3;
            background: black;
            width: var(--line-width);
            justify-self: center;
            align-self: end;
            height: 50%;
          `),
        div(grid_column(x0, x1), grid_row(y0+0.5, y0+0.5),
          note`label`,
          css`
            z-index: 5;
            background: white;
            align-self: center;
            justify-self: stretch;
            text-align: center;
            padding: 4px;
            margin: 4px;
          `,
          node.id)
      ]
    }).flatMap(x => x))

  page.push(T)

  return gt
}

/*
same(() =>
  G(...base('igår ville jag åka dit'),
    ...nodes({
      B: 'igår åka dit',
      N: 'B',
      B2: 'ville jag N',
      N2: 'B2',
    })),
  () => lines`
      -       N2       N2    N2   N2
      -       B2       B2    B2   B2
      -       ville    jag   N    N
      B     B/ville  B/jag   B    B
      igår    ville    jag   åka  dit
  `)
  */

same(() =>
  G(...base('jag ville åka dit igår'),
    ...nodes({
      IP: 'åka dit',
      IP2: 'IP igår',
      VP: 'IP2 ville',
      S: 'jag VP',
    })),
  () => lines`
      S     S   S   S    S
    jag    VP  VP  VP   VP
    jag ville IP2 IP2  IP2
    jag ville  IP  IP igår
    jag ville åka dit igår
  `)

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

if (false) {
  // dependency tree
  same(() =>
    G(...base('igår ville jag åka dit'),
      ...nodes({
        W1: 'igår',
        W3: 'jag',
        W5: 'dit',
         B: 'W1 åka W5',
        W4: 'åka',
        B2: 'ville W3 W4',
        W2: 'ville',
      })),
    () => lines`
         -       W2      -      -   -
         - B2/ville     B2     B2   -
         -    ville     W3     W4   -
         B  B/ville   B/W3  B/åka   B
        W1    ville     W3    åka  W5
      igår    ville    jag    åka dit
    `)

  same(() =>
    G(...base('igår ville jag åka dit'),
      ...nodes({
        W1: 'igår',
        W5: 'dit',
         B: 'W1 åka W5',
        W4: 'åka',
        W3: 'jag',
        B2: 'ville W3 W4',
        W2: 'ville',
      })),
    () => lines`
         -       W2      -      -   -
         - B2/ville     B2     B2   -
         -    ville     W3     W4   -
         B  B/ville  B/jag  B/åka   B
        W1    ville    jag    åka  W5
      igår    ville    jag    åka dit
    `)

  G(...base('igår ville jag åka dit'),
    ...nodes({
      W1: 'igår',
      W5: 'dit',
       B: 'W1 åka W5',
      W4: 'åka',
      W3: 'jag',
      B2: 'ville W3 W4',
      W2: 'ville',
    }))
}

// window.update_flags()
// window.schedule_refresh()

css`
  body { font-family: Source Sans Pro; font-size: 20px; font-weight: 400 }
`;

let root = document.querySelector('#root')
if (!root) {
  document.body.innerHTML = '<div id="root">'
  root = document.querySelector('#root')
}

div(id`root`, sheet(), ...page)(root)


