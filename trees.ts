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

const default_options = {
  gap_x: 12,
  gap_under_label: 4,
  gap_under_flabel: 4,
  gap_over_flabel: 4,
  line_width: 2,
  line_gap: 4,
}

type id = string

type Content = Readonly<
  | {tag: 'diff', diff: Diff[], x?: number, y?: number}
  | {tag: 'block', block: Block, x?: number, y?: number}
  | {tag: 'hline', left: id, right: id, height: number}
>


interface Block {
  readonly id: id
  readonly mid: number
  right: number
  top: number
  min_height: number
  contents: Content[]
}

function Graphics(
  options?: Partial<typeof default_options>
) {
  const opts = {...default_options, ...options}

  const next_id = (() => {
    let id = 0
    return () => '' + id++
  })()

  let row: Block[] = []
  const blocks: Record<id, Block> = {}

  const hline = (bottom: number, left: number, right: number) =>
    div(
      css`position: absolute`,
      css`background: black`,
      px({
        left,
        width: right - left,
        bottom,
        height: opts.line_width
      }),
      style`z-index: 1;`,
    )

  const vline = (x: number, bottom: number, top: number) => [
    div(
      css`position: absolute`,
      css`background: white`,
      px({
        left: x - opts.line_gap / 2,
        width: opts.line_width + opts.line_gap,
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
        width: opts.line_width,
        bottom,
        height: top - bottom,
      }),
      style`z-index: 3;`,
    )
  ]

  function terminal(element: DiffWithRect): id {
    const id = next_id()
    const block: Block = {
      id,
      right: element.rect.width + opts.gap_x,
      mid: element.rect.width / 2,
      top: element.rect.height,
      min_height: element.rect.height,
      contents: [{
        tag: 'diff',
        diff: [element.diff]
      }],
    }
    row.push(block)
    blocks[id] = block
    return id
  }

  function label(child_id: id, element: DiffWithRect, desired_height?: number): id {
    const child_block = blocks[child_id]
    const halfwidth = element.rect.width / 2
    let mid = child_block.mid
    let label_x = mid - halfwidth
    let child_x = 0
    if (label_x < 0) {
      child_x = -label_x
      label_x = 0
      mid = halfwidth
    }
    const right = Math.max(
      child_block.right,
      mid + halfwidth + opts.gap_x
    )
    let line_height = opts.gap_under_label
    if (desired_height !== undefined) {
      line_height = desired_height - child_block.top - element.rect.height
      console.assert(line_height >= 0, 'desired_height too low')
      // could also make the desired height by keeping line_height and instead float the element upwards
    }
    const top = child_block.top + line_height + element.rect.height
    const id = next_id()
    const block: Block = {
      id,
      right,
      mid,
      top,
      min_height: top,
      contents: [
        {tag: 'diff', diff: [element.diff], x: label_x, y: child_block.top + line_height},
        {tag: 'diff', diff: vline(mid, 0, line_height), y: child_block.top},
        {tag: 'block', block: child_block, x: child_x},
      ],
    }
    blocks[id] = block
    row = row.map(b => b.id == child_id ? block : b)
    return id
  }

  function nonterminal(
    children_ids: id[],
    main?:
      | {group: 'widest'}
      | {group: 'contains', id: id}
      | {group: 'only', id: id},
    flabels?: Record<string, DiffWithRect>,
  ): id {
    const children_id_remap = new Map(children_ids.map(id => [id, id]))
    const children_blocks_0 = row.filter(block => children_id_remap.has(block.id))
    const children_pos = row.flatMap((block, i) => children_id_remap.has(block.id) ? [i] : [])
    const leftmost = children_pos[0]
    const rightmost = children_pos[children_pos.length - 1]
    const reach = utils.range(leftmost, rightmost)

    const flabels_ = flabels || {}

    const desired_height = Math.max(
      ...reach.map(i => row[i].min_height),
      ...children_blocks_0.map(block => block.min_height + opts.gap_under_flabel + utils.maybe(flabels_[block.id], 0, i => i.rect.height))
    )

    const new_min_height = desired_height + opts.gap_over_flabel

    row = row.map((block, i) => {
      const flabel = flabels_[block.id]
      if (flabel !== undefined) {
        const new_id = label(block.id, flabel, desired_height)
        children_id_remap.set(block.id, new_id)
        children_id_remap.set(new_id, new_id)
        const new_block = blocks[new_id]
        new_block.min_height = new_min_height
        return new_block
      } else if (leftmost <= i && i <= rightmost) {
        console.assert(new_min_height >= block.min_height, 'new_min_height too low')
        block.min_height = new_min_height
        return block
      } else {
        return block
      }
    })

    const children_blocks = Array.from(children_id_remap.values()).map(id => blocks[id])

    children_blocks.forEach(block => {
      // this is making the line up to the bar. do we need a new id here?
      // we might if there are no flabels but sec-edges
      const old_top = block.top
      block.top = block.min_height
      block.contents.push({
        tag: 'diff',
        diff: vline(block.mid, old_top, block.top)
      })
    })

    const main_ = main || {group: 'widest'}

    const annotated_row = row.map((b, i) => ({
      ix: i,
      id: b.id,
      mine: children_id_remap.has(b.id),
      only: main_.group == 'only' && children_id_remap.get(main_.id) == b.id,
      contains: main_.group == 'contains' && children_id_remap.get(main_.id) == b.id,
      block: b,
    }))

    const pregroups = utils.group(annotated_row, e => +e.mine + 2*+e.only).filter(g => g[0].mine)

    const groups = pregroups.map(g => {
      const contains = g.some(e => e.contains)
      const only = g[0].only
      console.assert(!only || g.length == 1)
      console.assert(!only || !contains)
      const width = utils.sum(g.map(e => e.block.right))
      const score = width + 100000 * +(only || contains)
      const ixs = g.map(e => e.ix)
      const left = ixs[0]
      const right = ixs[ixs.length - 1]
      const ids = g.map(e => e.id)
      return {score, left, right, ixs, ids, blocks: g.map(e => e.block), g}
    })

    const group = groups.sort((a, b) => b.score - a.score)[0]

    const gblocks = group.blocks

    const id = next_id()
    const right = utils.sum(gblocks.map(b => b.right))
    const top = gblocks[0].top
    const min_height = top

    const leftmost_mid = gblocks[0].mid

    let x = 0
    let rightmost_mid = 0
    const contents: Content[] = gblocks.map(block => {
      const d: Content = {
        tag: 'block',
        block,
        x,
      }
      rightmost_mid = x + block.mid
      x += block.right
      return d
    })

    const mid = (leftmost_mid + rightmost_mid) / 2

    contents.push({
      tag: 'hline',
      left: row[leftmost].id,
      right: row[rightmost].id,
      height: top
    })

    const block = {
      id,
      mid,
      right,
      top,
      min_height,
      contents,
    }

    row.splice(group.left, group.right - group.left + 1, block)
    blocks[id] = block

    children_blocks.forEach(block => {
      if (!gblocks.some(b => b.id == block.id)) {
        seal(block.id)
      }
    })

    return id
  }

  function seal(child_id: id) {
    const ix = row.findIndex(b => b.id == child_id)
    if (ix != -1 && ix != 0) {
      const seal_block = row[ix]
      const left_block = row[ix-1]
      left_block.contents.push({
        tag: 'block',
        block: seal_block,
        x: left_block.right,
      })
      left_block.right += seal_block.right
      left_block.min_height = Math.max(left_block.min_height, seal_block.min_height)
      row.splice(ix, 1)
    }
  }

  function draw() {
    const children = []

    const mids: Record<string, number> = {}
    const hlines: {left: id, right: id, height: number}[] = []

    let width = 0, height = 0

    function rec(block: Block, x: number, y: number) {
      width = Math.max(width, x + block.right)
      height = Math.max(height, y + block.top)
      mids[block.id] = x + block.mid
      block.contents.forEach((c: Content) => {
        const dx = x + (c.tag == 'hline' ? 0 : c.x || 0)
        const dy = y + (c.tag == 'hline' ? 0 : c.y || 0)
        if (c.tag == 'block') {
          rec(c.block, dx, dy)
        } else if (c.tag == 'diff') {
          children.push(
            div(
              css`position: absolute`,
              px({left: dx, bottom: dy}),
              ...c.diff
            )
          )
        } else if (c.tag == 'hline') {
          hlines.push({
            left: c.left,
            right: c.right,
            height: c.height + y
          })
        }
      })
    }

    {
      let x = 0
      row.forEach(block => {
        rec(block, x, 0)
        x += block.right
      })
    }

    hlines.forEach(h => {
      children.push(hline(h.height, mids[h.left], mids[h.right]))
    })

    return div(
      css`position: relative`,
      px({width, height}),
      ...children
    )
  }

  return {terminal, label, nonterminal, seal, draw}
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

  const state = {} as Record<string, id>
  const has_parent = {} as Record<string, boolean>

  spec.forEach(s => (s.children || []).forEach(c => has_parent[c] = true))

  const msgs = []

  const graphics = Graphics()

  spec.forEach(s => {
    if (!s.children || s.children.length == 0) {
      state[s.id] = graphics.terminal(s.label)
      has_parent[s.id] || graphics.seal(state[s.id])
    } else {
      const children = s.children.map(id => state[id])
      const HDs = s.children.flatMap(id => utils.maybe(spec_by_id[id].flabel, false, x => x.from_source == 'HD') ? [state[id]] : [])
      const only = s.only ? state[s.only] : undefined
      const nt = graphics.nonterminal(
        children,
        only ? {group: 'only', id: only} :
        HDs.length > 0 ? {group: 'contains', id: HDs[0]} : {group: 'widest'},
        Object.fromEntries(s.children.map(id => [state[id], spec_by_id[id].flabel || zero])),
      )
      state[s.id] = graphics.label(nt, s.label, undefined)
      has_parent[s.id] || graphics.seal(state[s.id])
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
        css`display: none`,
        name + '', '\n',
        pretty({
          spec: renumber(spec0) // : utils.topo(spec0),
          // state, w, h
        }),
        css`font-size: 17px`
      ),
    )
  )
}

function traverse(obj, k) {
  if (Array.isArray(obj)) {
    return obj.map(x => traverse(x, k))
  } else if (typeof obj == 'object') {
    return obj.map(x => traverse(x, k))
  }
}

function renumber(obj) {
  const ids = {}
  obj.forEach(x => {
    if (x.id && !(x.id in ids)) {
      ids[x.id] = Object.keys(ids).length
    }
  })
  return obj.map(x => {
    const y = {...x}
    if (x.id) {
      y.id = ids[x.id]
    }
    if (x.children) {
      y.children = y.children.map(z => ids[z])
    }
    return y
  })
}


/*
function layout() {
  seq = []

  spec.forEach(s => {
    if (!s.mid) {
      s.mid = s.width / 2
    }
  })


  // put side by side can be done either just with bounding boxes or
  // more ambitiously by using their bounding polygon

  // requires: topologically sorted spec
  spec.forEach(s => {

    if (is_terminal(s)) {

      seq.push({
        id: s.id,
        orphan: !has_parent(s.id),
        height: s.height
        left: -s.mid
        right: s.width - s.mid
      })

    } else {

      // figure out which ones are main_children
      // this can be done by looking for HD or widest children somehow

      const pre_label_height = max(
        height of main_children,
        height of all other children,
        height of intermediate trees
      )

      non_main_children.forEach(orphan)

      const height = pre_label_height + self_label_height

      // put all main children next to each other (coord transform) and self on top
      // also remove them from seq and put yourself there

      // set the heights now. every interemediate thing must get their height updated
      // or they might grow underneath us and collide (!!!)

      // flabels:
      // we can just hard-code that children may include a top aligned thing (functional label)

      // seclabels... these... hmm... need to be in the children order somehow.
      // but this should be able to be determined statically ...
      // hmm umm not really because their parent label is not positioned yet (!!!)
      // some kind of heuristic is needed

    }

    // merge orphans
    let done = false
    while (!done) {
      done = true
      for (let i = 0; i < seq.length - 1; ++i) {
        if (seq[i].orphan && seq[i].height <= seq[i+1].height) {
          // merge seq[i] into seq[i+1]
          // by putting seq[i] before seq[i+1]
          done = false
        }
      }
    }
  })
}
*/







const base = (s: string) => utils.words(s).map(id => ({id, label:id}))
const nodes =
  (o: Record<string, string>) =>
  utils.mapObject(o, (id, children) => ({id, label: id, children: utils.words(children)}))

boo:
if (true) {
  const H = (...spec) =>
    G(pretty(spec), ...spec)

  // dependency tree
  H(...base('dit vill jag åka'),
    {id: 'SB', label: '', flabel: 'SB', only: 'jag', children: utils.words('jag')},
    {id: 'RA', label: '', flabel: 'RA', only: 'dit', children: utils.words('dit')},
    {id: 'OO', label: '', flabel: 'OO', only: 'åka', children: utils.words('åka RA')},
    {id: 'RT', label: 'RT', flabel: '', only: 'vill', children: utils.words('SB vill OO')},
  )

  H(...base('jag ville åka dit igår'),
    ...nodes({
      IP: 'åka dit',
      IP2: 'IP igår',
      VP: 'IP2 ville',
      S: 'jag VP',
    }))

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
}

G('europarl',
    {"id": '0', "label": "Detta", "flabel": "OO"},
    {"id": '1', "label": "kan", "flabel": "HD"},
    {"id": '2', "label": "åtminstone", "flabel": "MD"},
    {"id": '3', "label": "jag", "flabel": "SB"},
    {"id": '4', "label": "personligen", "flabel": "HD"},
    {"id": '14', "label": "AbP", "children": ['2', '4'], "flabel": "MD"},
    {"id": '15', "label": "VP", "children": ['0', '1', '3', '14'], "flabel": "IV"}
)


G('europarl',
    {"id": '0', "label": "Detta", "flabel": "OO"},
    {"id": '1', "label": "kan", "flabel": "HD"},
    {"id": '2', "label": "åtminstone", "flabel": "MD"},
    {"id": '3', "label": "jag", "flabel": "SB"},
    {"id": '4', "label": "personligen", "flabel": "HD"},
    {"id": '5', "label": "helt", "flabel": "KL"},
    {"id": '5.5', "label": ",", "flabel": "PH"},
    {"id": '6', "label": "och", "flabel": "PH"},
    {"id": '7', "label": "hållet", "flabel": "KL"},
    {"id": '8', "label": "instämma", "flabel": "HD"},
    {"id": '9', "label": "i", "flabel": "HD"},
    {"id": '10', "label": "."},
    {"id": '11', "label": "KoP", "children": ['5', '6', '7'], "flabel": "MD"},
    {"id": '12', "label": "S", "children": ['15', '1', '14', '3']},
    {"id": '13', "label": "PP", "children": ['0', '9'], "flabel": "MD"},
    {"id": '14', "label": "AbP", "children": ['2', '4'], "flabel": "MD"},
    {"id": '15', "label": "VP", "children": ['13', '11', '8'], "flabel": "IV"}
)

// note: it's the PP being early that makes the problems
G('europarl-bug',
    {"id": '0', "label": "Detta", "flabel": "OO"},
    {"id": '1', "label": "kan", "flabel": "HD"},
    {"id": '2', "label": "åtminstone", "flabel": "MD"},
    {"id": '3', "label": "jag", "flabel": "SB"},
    {"id": '4', "label": "personligen", "flabel": "HD"},
    {"id": '5', "label": "helt", "flabel": "KL"},
    {"id": '6', "label": "och", "flabel": "PH"},
    {"id": '7', "label": "hållet", "flabel": "KL"},
    {"id": '8', "label": "instämma", "flabel": "HD"},
    {"id": '9', "label": "i", "flabel": "HD"},
    {"id": '10', "label": "."},
    {"id": '12', "label": "S", "children": ['15', '1', '14', '3']},
    {"id": '13', "label": "PP", "children": ['0', '9'], "flabel": "MD"},
    {"id": '14', "label": "AbP", "children": ['2', '4'], "flabel": "MD"},
    {"id": '11', "label": "KoP", "children": ['5', '6', '7'], "flabel": "MD"},
    {"id": '15', "label": "VP", "children": ['13', '11', '8'], "flabel": "IV"}
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
      for (let i = 0; i < sents.length; ++i) {
        const spec = {} as Record<string, SpecEntry>
        const s = sents[i]
        const no_secedge = $(s, 'secedge').length == 0
        const no_discont = $(s, '[discontinuous="true"]').length == 0
        const long_sent = $(s, 't').length > 12
        if ((no_discont) || long_sent) {
          continue
        }
        if (found++ > 100) {
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
          name: `${found} ${i}`
          // + `\n${new XMLSerializer().serializeToString(s)}`
          ,
          spec: Object.values(spec)
        })
      }
    }
    console.timeEnd('specs')
    return specs
}

import {default as romaner} from './europarl.js'
console.log(romaner.length)
const specs = xmlToSpec(romaner)
console.time('G')
specs.forEach(({name, spec}) => G(name, ...spec))
console.timeEnd('G')

console.time('diff')
body(sheet(), ...page)(document.body)
console.timeEnd('diff')


