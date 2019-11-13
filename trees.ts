import * as domdiff from "./domdiff.js"
import {default as pretty} from "json-stringify-pretty-compact"

import {test} from "./test"

import * as utils from "./utils"

declare const module: {hot?: {accept: Function}}
module.hot && module.hot.accept()

const {body, div, style, span} = domdiff
const {css, sheet} = domdiff.class_cache()

css`
  body {
    font-family: Source Sans Pro;
    font-size: 22px;
    font-weight: 400;
  }
  pre {
    font-family: Consolas;
    border-left: 2px #8cf solid;
    padding-left: 2px;
    background: #f8f8f8;
  }
`;

if (!document.querySelector('style')) {
  body(sheet())(document.body)
}

const page = []

interface Node {
  id: string,
  label?: string,
  flabel?: string,
  children?: string[]
}

// type expr = number | {op: 'mid' | 'max', children: expr[]}

const G = (name: string | number, ...spec0: Node[]) => {
  const spec = utils.topo(spec0)
  // console.log({spec0, spec})

  interface State {
    label: string,
    flabel: string,
    text_width: number,
    text_height: number,
    left: number,
    right: number,
    mid: number,
    y: number,
    top: number,
    parent_placed: boolean,
    parent_top: number,
    right_align: boolean,
  }

  const state = {} as Record<string, State>

  const measure_root = document.body

  spec.forEach(s => {
    const span = document.createElement('span')
    span.className = 'measure'
    measure_root.append(span)
    const label = s.label || s.id
    span.innerHTML = label
    const root = span.getBoundingClientRect()
    state[s.id] = {
      id: s.id,
      text_width: root.width,
      text_height: root.height,
      label,
      flabel: s.flabel || ''
    } as any as State
    measure_root.removeChild(span)
  })

  const gap_x = 3 * Object.values(state)[0].text_height / 3
  const gap_y = 2 * Object.values(state)[0].text_height / 3
  let next_terminal_x = 0

  const line_gap = 4
  const line_width = 2

  const msgs: string[] = []

  const lines = [] as any[]

  const has_parent: Record<string, true> = {}
  spec.forEach(e => (e.children || []).forEach(ch => has_parent[ch] = true))

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
        style`z-index: ${100+i};`,
      ))
      lines.push(div(
        css`position: absolute`,
        css`background: black`,
        style`left: ${(x)}px;`,
        style`width: ${line_width}px;`,
        style`bottom: ${(bot)}px;`,
        style`height: ${(top - bot)}px;`,
        style`z-index: ${100+i};`,
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
        parent_placed: !(s.id in has_parent),
      }
      next_terminal_x += state[s.id].text_width + gap_x
    } else {
      const children = s.children
      const my_children = Object.fromEntries(children.map(id => [id, true]))
      const active_below: {x: number, top: number, id: string, mine: boolean}[] =
        Object.entries(state).flatMap(([id, s]) => {
          const active = s.left && !s.parent_placed
          const mine = my_children[id]
          if (mine || active) {
            return [{x: s.left, top: s.top, id, mine}, {x: s.right, top: s.top, id, mine}]
          } else {
            return []
          }
        }).sort((a, b) => a.x - b.x)

      // take the segments that are mine
      const pregroups =
        utils
          .group(active_below, e => e.mine)
          .filter(g => g[0].mine)

      // calculate my segment widths to get the widest
      const groups = pregroups.map(g => {
        const xs = g.map(e => e.x)
        const xmin = Math.min(...xs)
        const xmax = Math.max(...xs)
        const ids = g.map(e => e.id)
        const width = xmax - xmin
        const flabels = ids.map(id => state[id].flabel)
        const has_HD = flabels.some(l => l == 'HD')
        const score = width + 100000 * +has_HD
        return {ids, score}
      }).sort((a, b) => b.score - a.score)

      const above_children = groups[0].ids
      const leftmost_mid = Math.min(...children.map(id => state[id].mid))
      const rightmost_mid = Math.max(...children.map(id => state[id].mid))
      const left_mid = Math.min(...above_children.map(id => state[id].mid))
      const right_mid = Math.max(...above_children.map(id => state[id].mid))
      const left = Math.min(...above_children.map(id => state[id].left))
      const right = Math.max(...above_children.map(id => state[id].right))

      // be above everything from where I begin to where I end
      const my_reach = utils.drop_while_both_ends(active_below, e => !e.mine)
      const tops = state[s.id].text_height + Math.max(...my_reach.map(e => e.top))

      const y = tops + gap_y
      const me = state[s.id] = {
        ...state[s.id],
        left,
        right,
        mid: (left_mid + right_mid) / 2,
        y,
        top: y + state[s.id].text_height,
        parent_placed: false
      }
      children.forEach(id => {
        state[id].parent_placed = true
        state[id].parent_top = me.y - me.text_height
      })
      hline(me.y - gap_y / 2, leftmost_mid, rightmost_mid + line_width)
      vline(me.mid, me.y - gap_y / 2 + line_width, me.y)
      children.forEach(id => {
        vline(state[id].mid, state[id].top, me.y - gap_y / 2 - me.text_height)
        vline(state[id].mid, me.y - gap_y, me.y - gap_y / 2)
      })
    }
  })

  const w = Math.max(...Object.values(state).map(s => s.right))
  const h = 20 + Math.max(...Object.values(state).map(s => s.top > 0 ? s.top : 0))

  page.push(
    domdiff.pre(msgs.join('\n'), css`font-size: 12px`),
    div(
      css`
        display: flex;
        align-items: start;
      `,
      css`
        & > * {
          flex: 1;
          overflow: auto;
        }
      `,
      domdiff.pre(
        name + '', '\n',
        pretty({
          spec,
          // state, w, h
        }),
        css`font-size: 17px`
      ),
      div(
        css`position: relative; order: -1; margin: 40px`,
        style`width: ${w}px;`,
        style`height: ${h}px;`,
        ...utils.mapObject(state, (_id, s) =>
          div(
            css`position: absolute`,
            css`white-space: nowrap`,
            style`left: ${s.mid - s.text_width / 2}px;`,
            style`bottom: ${s.y}px;`,
            {attr: 'note', value: pretty(s)},
            s.label,
          )
        ),
        ...utils.mapObject(state, (_id, s) =>
          div(
            css`position: absolute`,
            css`white-space: nowrap`,
            style`left: ${s.mid}px;`,
            style`bottom: ${s.parent_top}px;`,
            css`transform: translate(-50%, 50%); `,
            s.flabel,
          )
        ),
        ...lines,
      )
    )
  )
}

const base = (s: string) => utils.words(s).map(id => ({id}))
const nodes = (o: Record<string, string>) => utils.mapObject(o, (id, children) => ({id, children: utils.words(children)}))

const H = (...spec) =>
  // G(pretty(spec), ...spec)
  undefined

H(...base('igår ville jag åka dit'),
  ...nodes({
    B: 'igår åka dit',
    N: 'B',
    B2: 'ville jag N',
    N2: 'B2',
  }))

H(...base('jag ville åka dit igår'),
  ...nodes({
    IP: 'åka dit',
    IP2: 'IP igår',
    VP: 'IP2 ville',
    S: 'jag VP',
  }))

H(...base('jag ville åka dit igår'),
  ...nodes({
    IP: 'åka dit',
    VP: 'IP ville',
    VP2: 'VP igår',
    S: 'jag VP2',
  }))

H(...base('igår ville jag åka dit'),
  ...nodes({
    IP: 'åka dit',
    VP: 'jag ville',
    'VP₂': 'VP IP',
    S: 'igår VP₂',
  }))

H(...base('igår ville jag åka dit'),
  ...nodes({
    IP: 'åka dit',
    VP: 'jag ville',
    'IP₂': 'IP igår',
    'S? VP?': 'VP IP₂',
  }))

H(...base('igår ville jag åka dit'),
  ...nodes({
    IP: 'åka dit',
    'IP2?': 'IP igår',
    VP: 'IP2? ville',
    'S?': 'jag VP',
  }))

H(...base('igår ville jag åka dit'),
  ...nodes({
    IP: 'åka dit',
    VP: 'IP ville',
    VP2: 'VP igår',
    'S?': 'jag VP2',
  }))

H(...base('jag ville åka dit igår'),
  ...nodes({
    IP: 'igår åka dit',
    S: 'ville jag IP',
  })),

H(...base('jag ville åka dit igår'),
  ...nodes({
    IP: 'dit åka',
    S: 'ville jag IP igår',
  })),

H(...base('igår ville jag åka dit'),
  ...nodes({
    IP: 'åka dit',
    S: 'igår ville jag IP',
  }))

H(...base('igår ville jag åka dit'),
  ...nodes({
    'IP?': 'igår åka dit',
    S: 'ville jag IP?',
  }))

H(...base('a b c d e'),
  ...nodes({
    C: 'c e',
    S: 'a b C d',
  }))

H(...base('a b c d e'),
  ...nodes({
    WIDE: 'c e',
    S: 'a b WIDE d',
  }))


H(...base('a b c d e f'),
  ...nodes({
    CD: 'c d f',
    S: 'a b CD e',
  }))

H(...base('a b c d e f'),
  ...nodes({
    EF: 'c e f',
    S: 'a b d EF',
  }))

H(...base('a b c d e f & h'),
  ...nodes({
    EF: 'c e f',
    S: 'a b d EF',
    'S₂': 'S & h'
  }))

H(...base('a b c d e f & h g'),
  ...nodes({
    DEF: 'd e f',
    S: 'a b c DEF',
    HG: 'h g',
    'S₂': 'S & HG',
  }))

console.time()
import {default as romaner} from './romaner.js'
console.log(romaner.length)

G(112,
    {id: "1002", label: "Men"},
    {id: "1003", label: "vad"},
    {id: "1004", label: "ska"},
    {id: "1005", label: "jag"},
    {id: "1007", label: "ta"},
    {id: "1008", label: "mej"},
    {id: "1009", label: "till"},
    {id: "1010", label: "?"},
    {id: "1", label: "VBM", children: ["1007"]},
    {id: "4", label: "PP", children: ["1003", "1009"]},
    {id: "2", label: "VP", children: ["4", "1", "1008"]},
    {
      id: "3",
      label: "S",
      children: ["1002", "2", "1004", "1005"]
    })

G(6,
    {id: "1008", label: "både"},
    {id: "1008a", label: "i"},
    {id: "1009", label: "egna"},
    {id: "1010", label: "och"},
    {id: "1011", label: "andras"},
    {id: "1012", label: "ögon"},
    {id: "1", label: "NP", children: ["1011", "1012"]},
    {id: "2", label: "NP", children: ["1009"]},
    {id: "5", label: "AjP", children: ["1004", "1005"]},
    {id: "8", label: "KOM", children: ["1008", "1010"]},
    {id: "3", label: "KoP", children: ["8", "2", "1"]},
    {id: "4", label: "PP", children: ["1008a", "3"]},
    {
      id: "6",
      label: "NP",
      children: ["1003", "5", "1006", "4"]
    },
  )

G(37,
    {"id": "1008", "label": "redan"},
    {"id": "1009", "label": "för"},
    {"id": "1010", "label": "ett"},
    {"id": "1011", "label": "par"},
    {"id": "1012", "label": "månader"},
    {"id": "1013", "label": "sedan"},
    {"id": "6", "label": "PEM", "children": ["1009", "1013"]},
    {"id": "13", "label": "POM", "children": ["1010"]},
    {"id": "5", "label": "NP", "children": ["13", "1011", "1012"]},
    {"id": "7", "label": "PP", "children": ["1008", "6", "5"]})

G(110,
    {"id": "1001", "label": "För"},
    {"id": "1002", "label": "tio"},
    {"id": "1003", "label": "år"},
    {"id": "1004", "label": "sen"},
    {"id": "1", "label": "NP", "children": ["1002", "1003"]},
    {"id": "10", "label": "PEM", "children": ["1001", "1004"]},
    {"id": "2", "label": "PP", "children": ["10", "1"]}
)


{
    const p = new DOMParser()
    const xml = p.parseFromString(romaner, 'text/xml')
    const err = xml.querySelector('parsererror')
    if (xml && !err) {
      const sents = xml.querySelectorAll('s')
      const $ = (base: Element, q: string) => Array.from(base.querySelectorAll(q))
      let found = 0
      for (let i = 0; i < 1000; ++i) {
        const spec = {} as Record<string, Node>
        const s = sents[i]
        const no_secedge = $(s, 'secedge').length == 0
        const no_discont = $(s, '[discontinuous="true"]').length == 0
        const long_sent = $(s, 't').length > 12
        if ((no_discont) || long_sent) {
          continue
        }
        if (found++ > 30) {
          break
        }
        const terminals  = $(s, 't')
        const nonterminals = $(s, 'nt')
        const simp = (x: string) => {
          const m = x.match(/[^\d]*(.*)$/)
          return m && m[1] || x
        }
        terminals.forEach(t => {
          // console.log(t, t.attributes)
          const id = simp(t.attributes.id.value)
          spec[id] = {
            id,
            label: t.attributes.word.value
          }
        })
        const flabels = {} as Record<string, string>
        nonterminals.forEach(nt => {
          // console.log(nt, nt.attributes)
          const id = simp(nt.attributes.id.value)
          spec[id] = {
            id,
            label: nt.attributes.cat.value,
            children: $(nt, 'edge').map(edge => {
              const child_id = simp(edge.attributes.idref.value)
              flabels[child_id] = edge.attributes.label.value
              return child_id
            })
          }
        })
        Object.entries(flabels).forEach(([id, flabel]) => {
          console.log(spec, id, flabel)
          spec[id].flabel = flabel
        })
        const spec_rec = spec
        {
          const spec = Object.values(spec_rec)
          G(
            i
            + '\n' + found
            // + '\n' + (new XMLSerializer().serializeToString(s))
          ,
            ...spec
          )
        }

        // page.push(
        //   domdiff.pre(
        //     css`font-size: 12px`,
        //     pretty({i, spec}),
        //     '\n',
        //     new XMLSerializer().serializeToString(s)))
      }
    }
}
console.timeEnd()


console.time()
body(sheet(), ...page)(document.body)
console.timeEnd()


