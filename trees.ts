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

type Spec<A> = SpecEntry<A>[]

interface SpecEntry<A> {
  id: string,
  children?: string[]
  label: A,
  flabel?: A,
}

type Diff = (e?: Element) => Element

interface DiffWithRect {
  diff: Diff
  rect: {
    width: number,
    height: number
  }
  from_source?: string
}

const zero_rect = {height: 0, width: 0}
const zero: DiffWithRect = {
  diff: span(px(zero_rect)),
  rect: zero_rect,
}

interface node {
  left: number
  right: number
  mid: number
  top: number
}

function px(d: Record<string, number>): any {
  return style(
    Object.entries(d).map(([k, v]) => `${k}: ${Math.round(v * 10) / 10}px`).join('; ') + ';')
}

function Graphics(
  gap_x = 12,
  gap_under_label = 2,
  gap_under_flabel = 2,
  gap_to_flabel = 8,
  line_width = 2,
  line_gap = 4,
) {

  const hline = (bottom: number, left: number, right: number) =>
    div(
      css`position: absolute`,
      css`background: black`,
      px({
        left,
        width: right - left,
        bottom,
        height: line_width
      }),
      style`z-index: 1;`,
    )

  const vline = (x: number, bottom: number, top: number) => [
    div(
      css`position: absolute`,
      css`background: white`,
      px({
        left: x - line_gap / 2,
        width: line_width + line_gap,
        bottom,
        height: top - bottom,
      }),
      style`z-index: 2;`,
    ),
    div(
      css`position: absolute`,
      css`background: black`,
      px({
        left: x,
        width: line_width,
        bottom,
        height: top - bottom,
      }),
      style`z-index: 3;`,
    )
  ]


  let next_x = 0

  const draw = [] as any
  let width = 0
  let height = 0

  const tapped = (n: node) => {
    width = Math.max(width, n.right)
    height = Math.max(height, n.top)
    return n
  }

  return {
    draw() {
      return div(
        css`position: relative`,
        px({width, height: height + 15}),
        ...draw
      )
    },
    terminal(element: DiffWithRect): node {
      const left = next_x
      next_x += element.rect.width
      const right = next_x
      next_x += gap_x
      const mid = (left + right) / 2
      draw.push(
        div(
          css`position: absolute`,
          px({left, bottom: 0}),
          element.diff,
        ))
      return tapped({
        left,
        right,
        mid,
        top: element.rect.height,
      })
    },
    nonterminal(
      label: DiffWithRect,
      main: {node: node, flabel: DiffWithRect}[],
      other: {node: node, flabel: DiffWithRect}[],
      reach: node[],
    ): node {
      const all = main.concat(other)

      let leftmost_mid = Math.min(...all.map(x => x.node.mid))
      let rightmost_mid = Math.max(...all.map(x => x.node.mid))

      if (all.length == 1) {
        leftmost_mid = main[0].node.mid - label.rect.width / 2
        rightmost_mid = main[0].node.mid + label.rect.width / 2
      }

      const left_mid = Math.min(...main.map(x => x.node.mid))
      const right_mid = Math.max(...main.map(x => x.node.mid))
      const left = Math.min(...main.map(x => x.node.left))
      const right = Math.max(...main.map(x => x.node.right))

      const mid = (left_mid + right_mid) / 2

      const reach_top = Math.max(...reach.map(e => e.top))

      // const flabelled = all.filter(e => e.flabel) as {node: node, flabel: DiffWithRect}[]
      const flabels_height = Math.max(0, ...all.map(r => r.flabel.rect.height))

      const line_y = reach_top + gap_to_flabel + flabels_height + gap_under_flabel

      const top = line_y + line_width + gap_under_label + label.rect.height

      draw.push(
        ...all.map(e =>
          div(
            css`position: absolute`,
            css`white-space: nowrap`,
            px({
              left: e.node.mid,
              bottom: reach_top + gap_to_flabel,
            }),
            css`transform: translate(-50%, 0); `,
            e.flabel.diff,
          )
        ),
        div(
          css`position: absolute`,
          px({
            left: mid - label.rect.width / 2,
            bottom: line_y + gap_under_label,
          }),
          label.diff,
        ),
        hline(line_y, leftmost_mid, rightmost_mid + line_width),
        ...vline(mid, line_y + line_width, line_y + line_width + gap_under_label),
        ...all.flatMap(e => [
          ...vline(e.node.mid, e.node.top, reach_top + gap_to_flabel),
          ...vline(e.node.mid, line_y - gap_under_flabel - (flabels_height - e.flabel.rect.height), line_y),
        ])
      )

      return tapped({
        top,
        mid,
        left,
        right,
      })
    }
  }
}

const try_span = (s?: string) => s ? span(s) : span(px({height: 0, width: 0}))

function measure_spec(measure_root: Element, spec: Spec<string | undefined>): Spec<DiffWithRect> {

  const p = {} as Record<string, Element>

  const position = (text: string) => {
    if (text in p) {
      return p[text]
    }
    const diff = try_span(text)
    const e = diff()
    measure_root.appendChild(e)
    p[text] = e
  }

  spec.forEach(e => {
    e.label && position(e.label)
    e.flabel && position(e.flabel)
  })

  function measure(text?: string) {
    if (text === undefined || text === '') {
      return zero
    } else {
      const rect = p[text].getBoundingClientRect()
      const diff = try_span(text)
      return {
        diff,
        from_source: text,
        rect: {width: rect.width, height: rect.height},
      }
    }
  }

  const out_spec = spec.map(e => {
    return {
      ...e,
      label: measure(e.label),
      flabel: measure(e.flabel),
    }
  })

  Object.values(p).forEach(e => measure_root.removeChild(e))

  return out_spec
}

const G = (name: string | number, ...spec0: Spec<string | undefined>) => {
  const spec = measure_spec(document.body, utils.toposort(spec0))
  const spec_by_id = utils.by('id', spec)

  const state = {} as Record<string, node & {parent_placed: boolean}>

  const msgs: string[] = []

  const has_parent = new Set(spec.flatMap(e => e.children || []))

  const graphics = Graphics()

  spec.forEach(s => {

    if (!s.children || s.children.length == 0) {
      state[s.id] = {
        ...graphics.terminal(s.label),
        parent_placed: !has_parent.has(s.id),
      }
    } else {
      const {children} = s
      const children_set = new Set(children)
      const active_below: (node & {x: number, id: string, mine: boolean})[] =
        Object.entries(state).flatMap(([id, s]) => {
          const active = s.left && !s.parent_placed
          const mine = children_set.has(id)
          if (mine || active) {
            return [{...s, x: s.left, id, mine}, {...s, x: s.right, id, mine}]
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
        const flabels = ids.map(id => spec_by_id[id].flabel)
        const has_HD = flabels.some(l => l !== undefined && l.from_source == 'HD')
        const score = width + 100000 * +has_HD
        return {ids, score}
      }).sort((a, b) => b.score - a.score)

      const main_children = new Set(
        s.main_children ||
        groups[0].ids
      )

      const reach = utils.drop_while_both_ends(active_below, e => !e.mine)

      const flabelled_children =
        children.map(id => ({
          id,
          node: state[id],
          flabel: spec_by_id[id].flabel || zero,
        }))

      const [main, other] = utils.partition(
        flabelled_children,
        child => main_children.has(child.id)
      )

      state[s.id] = {
        ...graphics.nonterminal(
          s.label,
          main,
          other,
          reach),
        parent_placed: !has_parent.has(s.id),
      }

      children.forEach(id => state[id].parent_placed = true)
    }
  })

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
      graphics.draw(),
      domdiff.pre(
        name + '', '\n',
        pretty({
          // spec // : utils.topo(spec0),
          // state, w, h
        }),
        css`font-size: 17px`
      ),
    )
  )
}

const base = (s: string) => utils.words(s).map(id => ({id, label:id}))
const nodes =
  (o: Record<string, string>) =>
  utils.mapObject(o, (id, children) => ({id, label: id, children: utils.words(children)}))

const H = (...spec) =>
  G(pretty(spec), ...spec)

// dependency tree
H(...base('dit vill jag åka'),
  {id: 'SB', label: '', flabel: 'SB', main_children: ['jag'], children: utils.words('jag')},
  {id: 'RA', label: '', flabel: 'RA', main_children: ['dit'], children: utils.words('dit')},
  {id: 'OO', label: '', flabel: 'OO', main_children: ['åka'], children: utils.words('åka RA')},
  {id: 'RT', label: 'RT', flabel: '', main_children: ['vill'], children: utils.words('SB vill OO')},
)

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

G(112,
    {id: "1002", label: "Men"},
    {id: "1003", label: "vad"},
    {id: "1004", label: "ska"},
    {id: "1005", label: "jag"},
    {id: "1007", label: "ta"},
    {id: "1008", label: "mej"},
    {id: "1009", label: "till", flabel: "HD"},
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


function xmlToSpec(romaner: string) {
    const p = new DOMParser()
    console.time('parse')
    const xml = p.parseFromString(romaner, 'text/xml')
    console.timeEnd('parse')
    console.time('specs')
    const specs = []
    const err = xml.querySelector('parsererror')
    if (xml && !err) {
      const sents = xml.querySelectorAll('s')
      const $ = (base: Element, q: string) => Array.from(base.querySelectorAll(q))
      let found = 0
      for (let i = 0; i < 1000; ++i) {
        const spec = {} as Record<string, SpecEntry>
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
          // console.log(spec, id, flabel)
          spec[id].flabel = flabel
        })
        specs.push({
          name: `
            ${i}
            ${found}
          `,
            // ${new XMLSerializer().serializeToString(s)}
          spec: Object.values(spec)
        })
      }
    }
    console.timeEnd('specs')
    return specs
}

import {default as romaner} from './romaner.js'
console.log(romaner.length)

const specs = xmlToSpec(romaner)
console.time('G')
specs.forEach(({name, spec}) => G(name, ...spec))
console.timeEnd('G')

console.time('diff')
body(sheet(), ...page)(document.body)
console.timeEnd('diff')


