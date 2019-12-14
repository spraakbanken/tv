import {euclidean_shortest_path, Box, Point, scale_box, points_of_box} from "./euclidean_shortest_path"

import {catmull_rom} from "./catmull_rom"

import {default as pretty} from "json-stringify-pretty-compact"

import * as utils from "./utils"

import * as domdiff from "./domdiff.js"
const {div, style, span} = domdiff
const {css} = domdiff.class_cache()

const svg = domdiff.MakeTag('svg')
const upside_up = css`
  & { transform: scaleY(-1) }
  & text { transform: scaleY(-1) }
`
const path = domdiff.MakeTag('path')
const g = domdiff.MakeTag('g')
const d = domdiff.MakeAttr('d')

export type Spec<A> = SpecEntry<A>[]

export interface SpecEntry<A> {
  id: string
  children?: string[]
  label: A
  flabel?: A
  secondary?: {id: string, label: A}[]
  only?: string
}

export function renumber<A>(spec: Spec<A>): Spec<A> {
  const ids: Record<string, string> = {}
  const next_id = utils.id_supply()
  spec.forEach(x => {
    if (x.id && !(x.id in ids)) {
      ids[x.id] = next_id()
    }
  })
  return spec.map(x => {
    return {
      ...x,
      id: ids[x.id],
      children: (x.children || []).map(z => ids[z]),
      secondary: (x.secondary || []).map(z => ({...z, id: ids[z.id]}))
    }
  })
}

type Diff = (e?: Element) => Element

interface Rect {
  width: number
  height: number
}

function offset_rect(r: Rect, dx: number, dy: number): Box {
  return {
    x1: dx,
    y1: dy,
    x2: dx + r.width,
    y2: dy + r.height,
  }
}

interface DiffWithRect {
  diff: Diff
  rect: Rect,
  from_source?: string
}

function px(d: Record<string, number>): any {
  return style(
    Object.entries(d).map(([k, v]) => `${k}: ${Math.round(v * 10) / 10}px`).join('; ') + ';')
}

const zero_rect = {height: 0, width: 0}
const zero: DiffWithRect = {
  diff: span(px(zero_rect)),
  rect: zero_rect,
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
  sealed: boolean
}

function Layout(
  options?: Partial<typeof default_options>
) {
  const opts = {...default_options, ...options}

  const next_id = utils.id_supply()

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
      sealed: false,
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
      sealed: false,
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

    if (annotated_row.every(e => !e.mine)) {
      throw new Error(`None of the children in ${children_ids} are in the active row`)
    }

    const pregroups = utils.group(
      annotated_row,
      e => +e.mine + 2*+e.only,
      e => e.block.sealed
    ).filter(g => g[0].mine)

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

    const main_blocks = group.blocks

    let left_id = row[leftmost].id
    let right_id = row[rightmost].id

    // adding more contents for seclabels
    ;(secondary || []).forEach(secedge => {
      const id = next_id()
      const id_source = next_id()
      secs.push({source: id_source, target: secedge.target})
      const content: Content = {
        tag: 'diff',
        id: id_source,
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
        contents: [content],
        sealed: false,
      }
      add_line_to_hbar(block)
      if (secedge.right) {
        if (main_blocks[main_blocks.length - 1].id == right_id) {
          right_id = block.id
        }
        main_blocks.push(block)
      } else {
        if (main_blocks[0].id == left_id) {
          left_id = block.id
        }
        main_blocks.unshift(block)
      }
    })

    const id = next_id()
    const right = utils.sum(main_blocks.map(b => b.right))
    const top = main_blocks[0].top
    const min_height = top
    const leftmost_mid = main_blocks[0].mid

    // this may be upgraded to an as narrow as possible horizonal concat
    let x = 0
    let rightmost_mid = 0
    const contents: Content[] = main_blocks.map(block => {
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
      left: main_blocks[0].id,
      right: main_blocks[main_blocks.length-1].id,
      height: top
    })


    const block = {
      id,
      mid,
      right,
      top,
      min_height,
      contents,
      sealed: false,
    }

    row.splice(group.left, group.right - group.left + 1, block)
    blocks[id] = block

    children_blocks.forEach(block => {
      if (!main_blocks.some(b => b.id == block.id)) {
        seal(block.id)
      }
    })

    return id
  }

  function seal(child_id: id) {
    // seal to make orphan nodes (like punctuation in Eukalyptus)
    // count as consecutive
    const ix = row.findIndex(b => b.id == child_id)
    if (ix != -1 && ix != 0) {
      row[ix].sealed = true
    }
  }

  const white = css`stroke:#fff; stroke-width: ${opts.line_gap}px`
  const black = css`stroke:#000; stroke-width: ${opts.line_width}px`
  const p = (x1: number, y1: number, x2: number, y2: number, ...cls: Diff[]) =>
    y1 <= y2 && path(
      d`M${Math.round(x1)} ${Math.round(y1)} L${Math.round(x2)} ${Math.round(y2)}`,
      ...cls
    )

  const hline = (bottom: number, left: number, right: number) =>
    p(left - 1, bottom, right + 1, bottom, black)

  const vline = (x: number, bottom: number, top: number) => g(
    p(x, bottom+opts.line_width / 2, x, top-opts.line_width / 2, white),
    p(x, bottom, x, top, black)
  )

  function draw() {
    const boxes: Box[] = []
    const children: Diff[] = []
    const svg_children: (Diff | false)[] = []

    const mids: Record<string, number> = {}
    const tops: Record<string, number> = {}
    const bots: Record<string, number> = {}
    const hlines: {left: id, right: id, height: number}[] = []
    const mainlines: {left: id, right: id, height: number}[] = []

    const final_secs: {source: id, target: id}[] = secs.map(s => ({...s, target: s.target()}))

    let width = 0, height = 0

    function position_block(block: Block, x: number, y: number) {
      width = Math.max(width, x + block.right)
      height = Math.max(height, y + block.top)
      mids[block.id] = x + block.mid
      tops[block.id] = y + block.top
      bots[block.id] = y
      block.contents.forEach((c: Content) => {
        if (c.tag == 'block') {
          const dx = x + (c.x || 0)
          const dy = y + (c.y || 0)
          position_block(c.block, dx, dy)
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
        position_block(block, x, 0)
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

    const draw_bounding_boxes = false

    draw_bounding_boxes && boxes.map(b => scale_box(b, 1, 1)).forEach(b => {
      const str = (p: Point) => `${p.x},${p.y}`
      svg_children.push(
        path(
          d('M' + points_of_box(b).map(str).join(' L') + ' Z'),
          css`stroke: maroon; stroke-width: 1px; fill: none`
        )
      )
    })

    final_secs.forEach(sec => {
      const source = {
        x: mids[sec.source],
        y: bots[sec.source],
      }

      const target = {
        x: mids[sec.target],
        y: tops[sec.target],
      }

      const esp = euclidean_shortest_path(source, target, boxes.map(b => scale_box(b, 1, 1)))

      if (esp) {
        svg_children.push(
          path(
            d(catmull_rom(esp.path, 0.25)),
            css`stroke: cornflowerblue; stroke-width: 2px; fill: none`
          )
        )
      } else {
        console.warn('Failed to route edge', sec, source, target)
      }
    })

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

function calc_rightmost(spec: Spec<any>): Record<string, number> {
  const rightmost: Record<string, number> = {}
  let i = 0

  spec.forEach(s => {
    if (!s.children || s.children.length == 0) {
      rightmost[s.id] = i++
    } else {
      rightmost[s.id] = Math.max(...s.children.map(cid => rightmost[cid]))
    }
  })
  return rightmost
}

export function draw_tree(spec0: Spec<string | undefined>) {
  const spec = measure_spec(document.body, utils.toposort(spec0))
  const spec_by_id = utils.by('id', spec)
  const rightmost = calc_rightmost(spec)
  const has_parent = {} as Record<string, boolean>
  spec.forEach(s => (s.children || []).forEach(c => has_parent[c] = true))

  const state = {} as Record<string, id>
  const layout = Layout()

  spec.forEach(s => {
    if (!s.children || s.children.length == 0) {
      state[s.id] = layout.terminal(s.label)
      has_parent[s.id] || layout.seal(state[s.id])
    } else {
      const children = s.children.map(id => state[id])
      let HD_id: string | undefined
      s.children.forEach(id => {
        const {flabel} = spec_by_id[id]
        if (flabel && flabel.from_source == 'HD') {
          HD_id = state[id]
        }
      })
      const only = s.only ? state[s.only] : undefined
      const nt = layout.nonterminal(
        children,
        only ? {group: 'only', id: only} :
        HD_id ? {group: 'contains', id: HD_id} : {group: 'widest'},
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
      state[s.id] = layout.label(nt, s.label, undefined)
      has_parent[s.id] || layout.seal(state[s.id])
    }
  })

  // return div(layout.draw(), domdiff.pre(pretty(spec)))
  return layout.draw()
}

