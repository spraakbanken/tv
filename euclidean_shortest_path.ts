import TinyQueue from "tinyqueue"

export interface Box {
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface Point {
  x: number
  y: number
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

export function points_of_box(b: Box): Point[] {
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
  const left  = Math.min(x1, x2)
  const right = Math.max(x1, x2)
  const bottom= Math.min(y1, y2)
  const top   = Math.max(y1, y2)
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

export function scale_box(b: Box, rx: number, ry: number) {
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

export function euclidean_shortest_path(source: Point, target: Point, boxes: Box[]) {
  const str = (p: Point) => `${p.x},${p.y}`
  const points = [target, ...boxes.flatMap(points_of_box)]
  const lines = [
    ...boxes.map(b => scale_box(b, 0.999, 0.998)).flatMap(lines_of_box),
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

