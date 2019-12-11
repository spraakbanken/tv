import * as domdiff from "./domdiff.js"
import pretty from "json-stringify-pretty-compact"

import TinyQueue from "tinyqueue"

import {test} from "./test"

import * as utils from "./utils"

declare const module: {hot?: {accept: Function}}
module.hot && module.hot.accept()

const {body, div, style, span, pre} = domdiff
const {css, sheet} = domdiff.class_cache()

const svg = domdiff.MakeTag('svg')
const upside_up = css`
  & { transform: scaleY(-1) }
  & text { transform: scaleY(-1) }
`
const text = domdiff.MakeTag('text')
const path = domdiff.MakeTag('path')
const g = domdiff.MakeTag('g')
const d = domdiff.MakeAttr('d')

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
  id: string
  children?: string[]
  label: A
  flabel?: A
  secondary?: {id: string, label: A}[]
  only?: string
}

type Diff = (e?: Element) => Element

interface Rect {
  width: number
  height: number
}

interface DiffWithRect {
  diff: Diff
  rect: Rect,
  from_source?: string
}

const zero_rect = {height: 0, width: 0}
const zero: DiffWithRect = {
  diff: span(px(zero_rect)),
  rect: zero_rect,
}

interface Box {
  x1: number
  y1: number
  x2: number
  y2: number
}

type Line = VLine | HLine

interface VLine {
  tag: 'V'
  x: number,
  top: number,
  bottom: number,
}

interface HLine {
  tag: 'H'
  y: number,
  left: number,
  right: number,
}

function flip_to_vline(v: HLine): VLine {
  return {
    tag: 'V',
    x: v.y,
    bottom: v.left,
    top: v.right,
  }
}

function flip_point(p: Point): Point {
  return {x: p.y, y: p.x}
}

function offset_rect(r: Rect, dx: number, dy: number): Box {
  return {
    x1: dx,
    y1: dy,
    x2: dx + r.width,
    y2: dy + r.height,
  }
}

interface Point {
  x: number,
  y: number
}

function points_of_box(b: Box): Point[] {
  const {x1, y1, x2, y2} = b
  return [
    {x: x1, y: y1},
    {x: x1, y: y2},
    {x: x2, y: y2},
    {x: x2, y: y1},
  ]
}

function lines_of_box(b: Box): Line[] {
  const {x1, y1, x2, y2} = b
  const left  = Math.min(x1, x2),
  const right = Math.max(x1, x2),
  const bottom= Math.min(y1, y2),
  const top   = Math.max(y1, y2),
  return [
    {tag: 'V', top, bottom, x: left},
    {tag: 'V', top, bottom, x: right},
    {tag: 'H', left, right, y: top},
    {tag: 'H', left, right, y: bottom},
  ]
}

function intersect(p: Point, q: Point, v: Line): boolean {
  if (v.tag == 'H') {
    return intersect(
      flip_point(p),
      flip_point(q),
      flip_to_vline(v),
    )
  }
  const dx = p.x - q.x
  const dy = p.y - q.y
  if (dx === 0) {
    return false
    // const bottom = Math.min(p.y, q.y)
    // const top = Math.max(p.y, q.y)
    // return v.x === p.x && !(bottom < v.top || top > v.bottom)
  }
  const left = Math.min(p.x, q.x)
  const right = Math.max(p.x, q.x)
  if (v.x > right || v.x < left) {
    return false
  }
  const k = dy / dx
  const m = p.y - k * p.x
  const y = k * v.x + m
  return v.bottom < y && y < v.top
}


function visible(p: Point, points: Point[], lines: Line[]): Point[] {
  return points.filter(q => lines.every(l => !intersect(p, q, l)))
}

function distance(p: Point, q: Point) {
  const sq = (x: number) => x * x
  return Math.sqrt(sq(p.x - q.x) + sq(p.y - q.y))
}

interface Backs<A> {
  back: Back<A>
  head: A
}

type Back<A> = Backs<A> | null

function unroll<A>(back: Back<A>): A[] {
  const out = []
  while (back !== null) {
    out.push(back.head)
    back = back.back
  }
  out.reverse()
  return out
}

function scale(b: Box, rx: number, ry: number) {
  const xm = (b.x1 + b.x2) / 2
  const ym = (b.y1 + b.y2) / 2
  const w = Math.abs(b.x1 - b.x2)
  const h = Math.abs(b.y1 - b.y2)
  return {
    x1: xm - w * rx / 2,
    x2: xm + w * rx / 2,
    y1: ym - h * ry / 2,
    y2: ym + h * ry / 2,
  }
}

function euclidean_shortest_path(source: Point, target: Point, boxes: Box[]) {
  const str = (p: Point) => `${p.x},${p.y}`
  const points = [target, ...boxes.flatMap(points_of_box)]
  const lines = [
    ...boxes.map(b => scale(b, 0.999, 0.998)).flatMap(lines_of_box),
    // ^ scale down a bit (and asymmetrically) because line collisions are not stable
  ]
  const queue = new TinyQueue([{point: source, dist: 0, back: {back: null as Back<Point>, head: source}}], (a, b) => a.dist - b.dist)
  const visited = {} as Record<string, true>
  while (queue.length > 0) {
    const popped = queue.pop()
    if (popped === undefined) break
    const {point, dist, back} = popped
    if (str(point) === str(target)) {
      return {dist, path: unroll(back)}
    }
    if (visited[str(point)]) continue
    visited[str(point)] = true
    visible(point, points, lines).forEach(q => {
      if (visited[str(q)]) return
      queue.push({point: q, dist: dist + distance(point, q), back: {back, head: q}})
    })
  }
  return null
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
  | {tag: 'diff', id?: id, diff: Diff, rect?: Rect, x?: number, y?: number}
  | {tag: 'block', block: Block, x?: number, y?: number}
  | {tag: 'hline', left: id, right: id, height: number}
  | {tag: 'mainline', left: id, right: id, height: number}
  | {tag: 'vline', x: number, bottom: number, top: number}
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
    return () => id+++''
  })()

  let row: Block[] = []
  const blocks: Record<id, Block> = {}

  const secs: {source: id, target: () => id}[] = []

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
        diff: element.diff,
        rect: element.rect
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
        {tag: 'diff', diff: element.diff, rect: element.rect, x: label_x, y: child_block.top + line_height},
        {tag: 'vline', x: mid, bottom: child_block.top, top: line_height + child_block.top},
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
    secondary?: {label: DiffWithRect, target: () => id, right?: boolean}[]
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
    ) + (secondary && secondary.length > 0 ? 10 : 0)

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

    function add_line_to_hbar(block: Block) {
      // this is making the line up to the bar. do we need a new id here?
      // we might if there are no flabels but sec-edges
      const old_top = block.top
      block.top = block.min_height
      block.contents.push({
        tag: 'vline',
        x: block.mid,
        bottom: old_top,
        top: block.top,
      })
    }

    children_blocks.forEach(add_line_to_hbar)

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

    let left_id = row[leftmost].id
    let right_id = row[rightmost].id

    // adding more contents for seclabels
    ;(secondary || []).forEach(secedge => {
      const id = next_id()
      const id$source = id + '$source'
      secs.push({source: id$source, target: secedge.target})
      const content: Content = {
        tag: 'diff',
        id: id$source,
        diff: secedge.label.diff,
        rect: secedge.label.rect,
        y: desired_height - secedge.label.rect.height
      }
      const block: Block = {
        id,
        right: secedge.label.rect.width + opts.gap_x,
        mid: secedge.label.rect.width / 2,
        top: desired_height,
        min_height: new_min_height,
        contents: [content]
      }
      add_line_to_hbar(block)
      if (secedge.right) {
        if (gblocks[gblocks.length - 1].id == right_id) {
          right_id = block.id
        }
        gblocks.push(block)
      } else {
        if (gblocks[0].id == left_id) {
          left_id = block.id
        }
        gblocks.unshift(block)
      }
    })

    const id = next_id()
    const right = utils.sum(gblocks.map(b => b.right))
    const top = gblocks[0].top
    const min_height = top
    const leftmost_mid = gblocks[0].mid

    // this may be upgraded to an as narrow as possible horizonal concat
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
      left: left_id,
      right: right_id,
      height: top
    })
    contents.push({
      tag: 'mainline',
      left: gblocks[0].id,
      right: gblocks[gblocks.length-1].id,
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
    // seal to make orphan nodes (like punctiation in Eukalyptus)
    // count as consecutive
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

  const white = css`stroke:#fff; stroke-width: ${opts.line_gap}px`
  const black = css`stroke:#000; stroke-width: ${opts.line_width}px`
  const p = (x1: number, y1: number, x2: number, y2: number, ...cls: Diff[]) =>
    y1 <= y2 && path(
      d`M${Math.round(x1)} ${Math.round(y1)} L${Math.round(x2)} ${Math.round(y2)}`,
      ...cls
    ),

  const hline = (bottom: number, left: number, right: number) =>
    p(left - 1, bottom, right + 1, bottom, black)

  const vline = (x: number, bottom: number, top: number) => g(
    p(x, bottom+opts.line_width / 2, x, top-opts.line_width / 2, white),
    p(x, bottom, x, top, black)
  )

  function draw() {
    const boxes: Box[] = []
    const children: Diff[] = []
    const svg_children: Diff[] = []

    const mids: Record<string, number> = {}
    const tops: Record<string, number> = {}
    const bots: Record<string, number> = {}
    const hlines: {left: id, right: id, height: number}[] = []
    const mainlines: {left: id, right: id, height: number}[] = []

    const final_secs: {source: id, target: id}[] = secs.map(s => ({...s, target: s.target()}))

    let width = 0, height = 0

    const blocks_by_id: Record<id, any> = {}

    function rec(block: Block, x: number, y: number) {
      width = Math.max(width, x + block.right)
      height = Math.max(height, y + block.top)
      mids[block.id] = x + block.mid
      tops[block.id] = y + block.top
      bots[block.id] = y
      block.contents.forEach((c: Content) => {
        if (c.tag == 'block') {
          const dx = x + (c.x || 0)
          const dy = y + (c.y || 0)
          rec(c.block, dx, dy)
        } else if (c.tag == 'diff') {
          const dx = x + (c.x || 0)
          const dy = y + (c.y || 0)
          children.push(
            div(
              css`position: absolute`,
              px({left: dx, bottom: dy}),
              c.diff
            )
          )
          c.rect && c.rect.width && dy > 0 && boxes.push(offset_rect(c.rect, dx, dy))
          if (c.id && c.rect) {
            mids[c.id] = dx + c.rect.width / 2
            tops[c.id] = dy + c.rect.height
            bots[c.id] = dy
          }
        } else if (c.tag == 'vline') {
          svg_children.push(vline(c.x + x, c.bottom + y, c.top + y))
        } else if (c.tag == 'hline') {
          hlines.push({
            left: c.left,
            right: c.right,
            height: c.height + y
          })
        } else if (c.tag == 'mainline') {
          mainlines.push({
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

    height += 15 // for height of horizontal scrollbar

    width = Math.round(width)
    height = Math.round(height)

    hlines.forEach(h => {
      svg_children.push(
        hline(h.height, mids[h.left], mids[h.right]))
    })

    mainlines.forEach(h => {
      const rect = {
        height: opts.gap_over_flabel + opts.gap_under_label + 4,
        width: mids[h.right] - mids[h.left]
      }
      boxes.push(offset_rect(rect, mids[h.left], h.height - opts.gap_over_flabel - 2))
    })

    svg_children.reverse()

    const str = p => `${p.x},${p.y}`

    boxes.map(b => scale(b, 1, 1)).forEach(b => {
      return
      svg_children.push(
        path(
          d('M' + points_of_box(b).map(str).join(' L')),
          css`stroke: blue; stroke-width: 1px; fill: none`
        )
      )
    })

    function catmull_rom(data0: Point[], k: number) {
      // https://codepen.io/osublake/pen/BowJed
      const data: number[] = []
      data0.forEach(p => {
        data.push(p.x)
        data.push(p.y)
      })

      if (k == null) k = 1;

      var size = data.length;
      var last = size - 4;

      var path = "M" + [data[0], data[1]];

      for (var i = 0; i < size - 2; i +=2) {

        var x0 = i ? data[i - 2] : data[0];
        var y0 = i ? data[i - 1] : data[1];

        var x1 = data[i + 0];
        var y1 = data[i + 1];

        var x2 = data[i + 2];
        var y2 = data[i + 3];

        var x3 = i !== last ? data[i + 4] : x2;
        var y3 = i !== last ? data[i + 5] : y2;

        var cp1x = x1 + (x2 - x0) / 6 * k;
        var cp1y = y1 + (y2 - y0) / 6 * k;

        var cp2x = x2 - (x3 - x1) / 6 * k;
        var cp2y = y2 - (y3 - y1) / 6 * k;

        path += "C" + [cp1x, cp1y, cp2x, cp2y, x2, y2];
      }

      return path;
    }

    final_secs.forEach(sec => {

      const source = {
        x: mids[sec.source],
        y: bots[sec.source],
      }

      const target = {
        x: mids[sec.target],
        y: tops[sec.target],
      }

      const esp = euclidean_shortest_path(source, target, boxes.map(b => scale(b, 1, 1)))

      if (esp) {
        svg_children.push(
          path(
            d(catmull_rom(esp.path, 0.3)),
            css`stroke: red; stroke-width: 2px; fill: none`
          )
        )
      }

      // esp && esp.path.forEach((p, i) => {
      //   i != 0 && i != esp.path.length - 1 && boxes.push({
      //     x1: p.x - 3,
      //     y1: p.y - 3,
      //     x2: p.x + 3,
      //     y2: p.y + 3,
      //   })
      // })

    })

    if (false) {
      let source = {x: 33, y: 20}
      let target = {x: 128, y: 128}
      for (let count = 22; count < 27; ++count) {

        const i = (33 * count + 17) % boxes.length // Math.floor(Math.random() * boxes.length)
        const j = (37 * count + 19) % boxes.length // Math.floor(Math.random() * boxes.length)
        source = {
          x: (boxes[i].x1 + boxes[i].x2) / 2,
          y: boxes[i].y1 - 2,
        }

        target = {
          x: (boxes[j].x1 + boxes[j].x2) / 2,
          y: boxes[j].y2 + 2,
        }

        const esp = euclidean_shortest_path(source, target, boxes.map(b => scale(b, 1.1, 0.95))

        esp && esp.path.length > 2 && svg_children.push(
          path(
            d('M' + esp.path.map(str).join(' L')),
            css`stroke: red; stroke-width: 2px; fill: none`
          )
        )

        console.log(esp)

        ;[source, target] = [0, 1].map(_ => ({x: Math.random() * width, y: Math.random() * height}))
      }
    }

    const svg_lines = svg(
      upside_up,
      css`position: absolute`,
      px({width, height, bottom: 0, left: 0}),
      ...svg_children)

    return div(
      css`position: relative`,
      px({width, height}),
      ...children,
      svg_lines,
    )
  }

  return {terminal, label, nonterminal, seal, draw}
}

const try_span = (s?: string) => s ? span(style`white-space: pre; display: inline-block;`, s) : span(px({height: 0, width: 0}))

function measure_spec(measure_root: Element, spec: Spec<string | undefined>): Spec<DiffWithRect> {

  const spec_by_id = utils.by('id', spec)

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
    e.secondary && e.secondary.forEach(secedge => {
      secedge.label && position(secedge.label)
    })
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
      secondary:
        (e.secondary || []).map(
          secedge => ({
            ...secedge,
            label: measure(secedge.label)
          }))
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

  const rightmost: Record<string, number> = {}
  let i = 0

  spec.forEach(s => {
    if (!s.children || s.children.length == 0) {
      rightmost[s.id] = i++
    } else {
      rightmost[s.id] = Math.max(...s.children.map(cid => rightmost[cid]))
    }
  })

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
        (s.secondary || []).sort((s1, s2) => {
          const d = rightmost[s2.id] - rightmost[s1.id]
          const r = rightmost[s1.id] > rightmost[s.id]
          return r ? -d : d
        }).map(secedge => ({
          label: secedge.label,
          target: () => state[secedge.id],
          right: rightmost[secedge.id] > rightmost[s.id]
        }))
      )
      state[s.id] = graphics.label(nt, s.label, undefined)
      has_parent[s.id] || graphics.seal(state[s.id])
    }
  })

  page.push(
    pre(msgs.join('\n'), css`font-size: 12px`),
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
      pre(
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

function renumber<A>(obj: Spec<A>): Spec<A> {
  const ids: Record<string, string> = {}
  obj.forEach(x => {
    if (x.id && !(x.id in ids)) {
      ids[x.id] = Object.keys(ids).length + ''
    }
  })
  return obj.map(x => {
    return {
      ...x,
      id: ids[x.id],
      children: (x.children || []).map(z => ids[z]),
      secondary: (x.secondary || []).map(z => ({...z, id: ids[z.id]}))
    }
  })
}

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

  G('hm2',
    {
      "id": "0",
      "label": "Svenson",
      "flabel": "SB",
      "children": [],
      "secondary": []
    },
    {
      "id": "1",
      "label": "börjar",
      "flabel": "HD",
      "children": [],
      "secondary": []
    },
    {
      "id": "2",
      "label": "skrika",
      "flabel": "HD",
      "children": [],
      "secondary": []
    },
    {
      "id": "3",
      "label": "och",
      "flabel": "PH",
      "children": [],
      "secondary": []
    },
    {
      "id": "4",
      "label": "gestikulera",
      "flabel": "HD",
      "children": [],
      "secondary": []
    },
    {"id": "5", "label": ":", "children": [], "secondary": []},
    {"id": "6", "label": "KoP", "children": ["7", "3", "10"], "secondary": []},
    {
      "id": "7",
      "label": "S",
      "children": ["0", "1", "8"],
      "secondary": [],
      "flabel": "KL"
    },
    {
      "id": "8",
      "label": "VP",
      "children": ["2"],
      "secondary": [{"id": "0", "label": "SB"}],
      "flabel": "IV"
    },
    {
      "id": "9",
      "label": "VP",
      "children": ["4"],
      "secondary": [{"id": "0", "label": "SB"}],
      "flabel": "IV"
    },
    {
      "id": "10",
      "label": "S",
      "children": ["9"],
      "secondary": [{"id": "0", "label": "SB"}, {"id": "1", "label": "HD"}],
      "flabel": "KL"
    })

  G('hm',
    {"id": "0", "label": "—", "children": [], "secondary": []},
    {
      "id": "1",
      "label": "Men",
      "flabel": "DF",
      "children": [],
      "secondary": []
    },
    {
      "id": "2",
      "label": "vad",
      "flabel": "OO",
      "children": [],
      "secondary": []
    },
    {
      "id": "3",
      "label": "ska",
      "flabel": "HD",
      "children": [],
      "secondary": []
    },
    {
      "id": "4",
      "label": "jag",
      "flabel": "SB",
      "children": [],
      "secondary": []
    },
    {"id": "5", "label": "då", "flabel": "MD", "children": [], "secondary": []},
    {"id": "6", "label": "ta", "flabel": "ME", "children": [], "secondary": []},
    {
      "id": "7",
      "label": "mej",
      "flabel": "OO",
      "children": [],
      "secondary": []
    },
    {
      "id": "8",
      "label": "till",
      "flabel": "HD",
      "children": [],
      "secondary": []
    },
    {"id": "9", "label": "!", "children": [], "secondary": []},
    {
      "id": "10",
      "label": "VBM",
      "children": ["6"],
      "secondary": [{"id": "8", "label": "ME"}, {"id": "7", "label": "ME"}],
      "flabel": "HD"
    },
    {
      "id": "11",
      "label": "VP",
      "children": ["13", "10", "7"],
      "secondary": [{"id": "4", "label": "SB"}],
      "flabel": "IV"
    },
    {
      "id": "12",
      "label": "S",
      "children": ["1", "11", "3", "4", "5"],
      "secondary": []
    },
    {
      "id": "13",
      "label": "PP",
      "children": ["2", "8"],
      "secondary": [],
      "flabel": "OA"
    }
  )

  G('76 116',
    {"id": "0", "label": "Ni", "flabel": "SB", "children": [], "secondary": []},
    {
      "id": "1",
      "label": "kommer",
      "flabel": "HD",
      "children": [],
      "secondary": []
    },
    {
      "id": "2",
      "label": "att",
      "flabel": "HD",
      "children": [],
      "secondary": []
    },
    {"id": "3", "label": "bo", "flabel": "HD", "children": [], "secondary": []},
    {"id": "4", "label": "i", "flabel": "HD", "children": [], "secondary": []},
    {
      "id": "5",
      "label": "mitt",
      "flabel": "DT",
      "children": [],
      "secondary": []
    },
    {
      "id": "6",
      "label": "hus",
      "flabel": "HD",
      "children": [],
      "secondary": []
    },
    {"id": "7", "label": "så", "flabel": "ME", "children": [], "secondary": []},
    {
      "id": "8",
      "label": "länge",
      "flabel": "HD",
      "children": [],
      "secondary": []
    },
    {"id": "9", "label": "ni", "flabel": "SB", "children": [], "secondary": []},
    {
      "id": "10",
      "label": "är",
      "flabel": "HD",
      "children": [],
      "secondary": []
    },
    {"id": "11", "label": "i", "flabel": "HD", "children": [], "secondary": []},
    {
      "id": "12",
      "label": "Kaimana",
      "flabel": "OO",
      "children": [],
      "secondary": []
    },
    {"id": "13", "label": ",", "children": [], "secondary": []},
    {
      "id": "14",
      "label": "jag",
      "flabel": "SB",
      "children": [],
      "secondary": []
    },
    {
      "id": "15",
      "label": "ska",
      "flabel": "HD",
      "children": [],
      "secondary": []
    },
    {
      "id": "16",
      "label": "nog",
      "flabel": "MD",
      "children": [],
      "secondary": []
    },
    {
      "id": "17",
      "label": "ordna",
      "flabel": "HD",
      "children": [],
      "secondary": []
    },
    {
      "id": "18",
      "label": "den",
      "flabel": "DT",
      "children": [],
      "secondary": []
    },
    {
      "id": "19",
      "label": "saken",
      "flabel": "HD",
      "children": [],
      "secondary": []
    },
    {"id": "20", "label": ",", "children": [], "secondary": []},
    {
      "id": "21",
      "label": "men",
      "flabel": "PH",
      "children": [],
      "secondary": []
    },
    {
      "id": "22",
      "label": "nu",
      "flabel": "MD",
      "children": [],
      "secondary": []
    },
    {
      "id": "23",
      "label": "ska",
      "flabel": "HD",
      "children": [],
      "secondary": []
    },
    {
      "id": "24",
      "label": "vi",
      "flabel": "SB",
      "children": [],
      "secondary": []
    },
    {
      "id": "25",
      "label": "ombord",
      "flabel": "RA",
      "children": [],
      "secondary": []
    },
    {
      "id": "26",
      "label": "och",
      "flabel": "PH",
      "children": [],
      "secondary": []
    },
    {
      "id": "27",
      "label": "äta",
      "flabel": "HD",
      "children": [],
      "secondary": []
    },
    {
      "id": "28",
      "label": "det",
      "flabel": "DT",
      "children": [],
      "secondary": []
    },
    {
      "id": "29",
      "label": "sista",
      "flabel": "HD",
      "children": [],
      "secondary": []
    },
    {
      "id": "30",
      "label": "civiliserade",
      "flabel": "MD",
      "children": [],
      "secondary": []
    },
    {
      "id": "31",
      "label": "mål",
      "flabel": "HD",
      "children": [],
      "secondary": []
    },
    {
      "id": "32",
      "label": "mat",
      "flabel": "HD",
      "children": [],
      "secondary": []
    },
    {
      "id": "33",
      "label": "ni",
      "flabel": "SB",
      "children": [],
      "secondary": []
    },
    {
      "id": "34",
      "label": "får",
      "flabel": "HD",
      "children": [],
      "secondary": []
    },
    {
      "id": "35",
      "label": "på",
      "flabel": "HD",
      "children": [],
      "secondary": []
    },
    {
      "id": "36",
      "label": "två",
      "flabel": "DT",
      "children": [],
      "secondary": []
    },
    {
      "id": "37",
      "label": "månader",
      "flabel": "HD",
      "children": [],
      "secondary": []
    },
    {"id": "38", "label": ".", "children": [], "secondary": []},
    {
      "id": "39",
      "label": "NP",
      "children": ["18", "19"],
      "secondary": [],
      "flabel": "OO"
    },
    {
      "id": "40",
      "label": "VP",
      "children": ["17", "39"],
      "secondary": [{"id": "14", "label": "SB"}],
      "flabel": "IV"
    },
    {
      "id": "41",
      "label": "S",
      "children": ["14", "15", "16", "40"],
      "secondary": [],
      "flabel": "DF"
    },
    {
      "id": "42",
      "label": "PP",
      "children": ["11", "12"],
      "secondary": [],
      "flabel": "RA"
    },
    {
      "id": "43",
      "label": "ABM",
      "children": ["7"],
      "secondary": [{"id": "8", "label": "ME"}],
      "flabel": "MD"
    },
    {
      "id": "44",
      "label": "S",
      "children": ["9", "10", "42"],
      "secondary": [],
      "flabel": "OO"
    },
    {
      "id": "45",
      "label": "NP",
      "children": ["5", "6"],
      "secondary": [],
      "flabel": "OO"
    },
    {
      "id": "46",
      "label": "PP",
      "children": ["4", "45"],
      "secondary": [],
      "flabel": "RA"
    },
    {
      "id": "47",
      "label": "VP",
      "children": ["3", "46", "62"],
      "secondary": [{"id": "0", "label": "SB"}],
      "flabel": "OO"
    },
    {
      "id": "48",
      "label": "S",
      "children": ["0", "1", "58", "41"],
      "secondary": [],
      "flabel": "KL"
    },
    {
      "id": "49",
      "label": "NP",
      "children": ["36", "37"],
      "secondary": [],
      "flabel": "OO"
    },
    {
      "id": "50",
      "label": "PP",
      "children": ["35", "49"],
      "secondary": [],
      "flabel": "MD"
    },
    {
      "id": "51",
      "label": "S",
      "children": ["33", "34"],
      "secondary": [{"id": "32", "label": "OO"}],
      "flabel": "MD"
    },
    {
      "id": "52",
      "label": "NP",
      "children": ["28", "59", "30", "31", "60"],
      "secondary": [],
      "flabel": "OO"
    },
    {
      "id": "53",
      "label": "VP",
      "children": ["27", "52"],
      "secondary": [{"id": "24", "label": "SB"}],
      "flabel": "IV"
    },
    {
      "id": "54",
      "label": "S",
      "children": ["22", "23", "24", "25"],
      "secondary": [],
      "flabel": "KL"
    },
    {
      "id": "55",
      "label": "KoP",
      "children": ["54", "26", "56"],
      "secondary": [],
      "flabel": "KL"
    },
    {
      "id": "56",
      "label": "S",
      "children": ["53"],
      "secondary": [
        {"id": "22", "label": "MD"},
        {"id": "24", "label": "SB"},
        {"id": "23", "label": "HD"}
      ],
      "flabel": "KL"
    },
    {
      "id": "57",
      "label": "KoP",
      "children": ["48", "21", "55"],
      "secondary": []
    },
    {
      "id": "58",
      "label": "SuP",
      "children": ["2", "47"],
      "secondary": [],
      "flabel": "IV"
    },
    {
      "id": "59",
      "label": "AjP",
      "children": ["29", "50"],
      "secondary": [],
      "flabel": "MD"
    },
    {
      "id": "60",
      "label": "NP",
      "children": ["32", "51"],
      "secondary": [],
      "flabel": "MD"
    },
    {
      "id": "61",
      "label": "AbP",
      "children": ["43", "8"],
      "secondary": [],
      "flabel": "PH"
    },
    {
      "id": "62",
      "label": "SuP",
      "children": ["61", "44"],
      "secondary": [],
      "flabel": "MD"
    }
  )

  break boo

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

  // break boo

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

  H(...base('a b e d c'),
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

  G('europarl',
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

  G('europarl',
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
      {"id": '11', "label": "KoP", "children": ['5', '6', '7'], "flabel": "MD"},
      {"id": '12', "label": "S", "children": ['15', '1', '14', '3']},
      {"id": '13', "label": "PP", "children": ['0', '9'], "flabel": "MD"},
      {"id": '14', "label": "AbP", "children": ['2', '4'], "flabel": "MD"},
      {"id": '15', "label": "VP", "children": ['13', '11', '8'], "flabel": "IV"}
  )

  G('europarl',
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
      {"id": '14', "label": "AbP", "children": ['2', '4'], "flabel": "MD"},
      {"id": '12', "label": "S", "children": ['15', '1', '14', '3']},
      {"id": '13', "label": "PP", "children": ['0', '9'], "flabel": "MD"},
      {"id": '11', "label": "KoP", "children": ['5', '6', '7'], "flabel": "MD"},
      {"id": '15', "label": "VP", "children": ['13', '11', '8'], "flabel": "IV"}
  )

  G('europarl',
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
      {"id": '14', "label": "AbP", "children": ['2', '4'], "flabel": "MD"},
      {"id": '12', "label": "S", "children": ['15', '1', '14', '3']},
      {"id": '11', "label": "KoP", "children": ['5', '6', '7'], "flabel": "MD"},
      {"id": '13', "label": "PP", "children": ['0', '9'], "flabel": "MD"},
      {"id": '15', "label": "VP", "children": ['13', '11', '8'], "flabel": "IV"}
  )

  G('europarl-TV',
  /*
    {"id": 0, "label": "Först", "flabel": "MD"},
    {"id": 1, "label": "skulle", "flabel": "HD"},
    {"id": 2, "label": "jag", "flabel": "SB"},
    {"id": 3, "label": "vilja", "flabel": "HD"},
    {"id": 4, "label": "ge", "flabel": "HD"},
    {"id": 5, "label": "er", "flabel": "IO"},
    {"id": 6, "label": "en", "flabel": "DT"},
    {"id": 7, "label": "komplimang", "flabel": "HD"},
    {"id": 8, "label": "för", "flabel": "HD"},
    {"id": 9, "label": "det", "flabel": "DT"},
    {"id": 10, "label": "faktum", "flabel": "HD"},
    {"id": 11, "label": "att", "flabel": "HD"},
    {"id": 12, "label": "ni", "flabel": "SB"},
    {"id": 13, "label": "hållit", "flabel": "ME"},
    {"id": 14, "label": "ert", "flabel": "DT"},
    {"id": 15, "label": "ord", "flabel": "HD"},
    {"id": 16, "label": "och", "flabel": "PH"},
    {"id": 17, "label": "att", "flabel": "HD"},
      */
    {"id": 18, "label": "det", "flabel": "SB"},
    {"id": 19, "label": "nu", "flabel": "HD"},
    {"id": 20, "label": ","},
    {"id": 21, "label": "under", "flabel": "HD"},
    {"id": 22, "label": "det", "flabel": "DT"},
    {"id": 23, "label": "nya", "flabel": "MD"},
    {"id": 24, "label": "årets", "flabel": "HD"},
    {"id": 25, "label": "första", "flabel": "MD"},
    {"id": 26, "label": "sammanträdesperiod", "flabel": "HD"},
    {"id": 27, "label": ","},
    {"id": 28, "label": "faktiskt", "flabel": "MD"},
    {"id": 29, "label": "har", "flabel": "HD"},
    {"id": 30, "label": "skett", "flabel": "HD"},
    {"id": 31, "label": "en", "flabel": "DT"},
    {"id": 32, "label": "kraftig", "flabel": "MD"},
    {"id": 33, "label": "utökning", "flabel": "HD"},
    {"id": 34, "label": "av", "flabel": "HD"},
    {"id": 35, "label": "antalet", "flabel": "HD"},
    {"id": 36, "label": "TV-kanaler", "flabel": "HD"},
    {"id": 37, "label": "på", "flabel": "HD"},
    {"id": 38, "label": "våra", "flabel": "DT"},
    {"id": 39, "label": "rum", "flabel": "HD"},
    {"id": 40, "label": "."},
    {"id": 41, "label": "NP", "children": [38, 39], "flabel": "OO"},
    {"id": 42, "label": "PP", "children": [37, 41], "flabel": "MD"},
    {"id": 43, "label": "NP", "children": [35, 63], "flabel": "OO"},
    {"id": 44, "label": "PP", "children": [34, 43], "flabel": "MD"},
    {"id": 45, "label": "NP", "children": [31, 32, 33, 44], "flabel": "ES"},
    {"id": 46, "label": "VP", "children": [30, 45], "flabel": "IV"},
    {"id": 47, "label": "NP", "children": [22, 23, 24], "flabel": "DT"},
    {"id": 48, "label": "NP", "children": [47, 25, 26], "flabel": "OO"},
    {"id": 49, "label": "PP", "children": [21, 48], "flabel": "AN"},
    {"id": 50, "label": "S", "children": [18, 65, 28, 29, 46], "flabel": "OO"},
    {"id": 51, "label": "SuP", "children": [17, 50], "flabel": "KL"},
    {"id": 52, "label": "NP", "children": [14, 15], "flabel": "OO"},
    {"id": 53, "label": "S", "children": [12, 62], "flabel": "OO"},
    {"id": 54, "label": "SuP", "children": [11, 53], "flabel": "KL"},
    {"id": 55, "label": "KoP", "children": [54, 16, 51], "flabel": "MD"},
    {"id": 56, "label": "NP", "children": [9, 10, 55], "flabel": "OO"},
    {"id": 57, "label": "PP", "children": [8, 56], "flabel": "MD"},
    {"id": 58, "label": "NP", "children": [6, 7, 57], "flabel": "OO"},
    {"id": 59, "label": "VP", "children": [4, 5, 58], "flabel": "IV"},
    {"id": 60, "label": "VP", "children": [3, 59], "flabel": "IV"},
    {"id": 61, "label": "S", "children": [0, 1, 2, 60]},
    {"id": 62, "label": "VP", "children": [64, 52], "flabel": "IV"},
    {"id": 63, "label": "NP", "children": [36, 42], "flabel": "MD"},
    {"id": 64, "label": "VBM", "children": [13], "flabel": "HD"},
    {"id": 65, "label": "AbP", "children": [19, 49], "flabel": "MD"}
  )
}

function xmlToSpec(romaner: string) {
  // return []
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
        const spec = {} as Record<string, SpecEntry<string>>
        const s = sents[i]
        const no_secedge = $(s, 'secedge').length == 0
        const no_discont = $(s, '[discontinuous="true"]').length == 0
        const long_sent = $(s, 't').length > 12
        if (no_secedge) continue
        if (!long_sent) continue
        // if (no_discont) continue
        if (++found > 100) {
          break
        }
        const terminals  = $(s, 't')
        const nonterminals = $(s, 'nt')
        terminals.forEach(t => {
          // console.log(t, t.attributes)
          const id = t.attributes.id.value
          spec[id] = {
            id,
            label: t.attributes.word.value
          }
        })
        const flabels = {} as Record<string, string>
        nonterminals.forEach(nt => {
          // console.log(nt, nt.attributes)
          const id = nt.attributes.id.value
          spec[id] = {
            id,
            label: nt.attributes.cat.value,
            children: $(nt, 'edge').map(edge => {
              const child_id = edge.attributes.idref.value
              flabels[child_id] = edge.attributes.label.value
              return child_id
            }),
            secondary: $(nt, 'secedge').map(edge => {
              return {
                id: edge.attributes.idref.value,
                label: edge.attributes.label.value
              }
            })
          }
        })
        Object.entries(flabels).forEach(([id, flabel]) => {
          // console.log(spec, id, flabel)
          spec[id].flabel = flabel
        })
        const final = renumber(Object.values(spec))
        // console.log(pretty(final))
        specs.push({
          name: `${found} ${i}`
          // + `\n${new XMLSerializer().serializeToString(s)}`
          ,
          spec: final
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


