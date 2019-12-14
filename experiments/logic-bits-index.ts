import * as bar from './bar'
import * as Logic from 'logic-solver'

function generate<T>(template: (self: T) =>
    {[K in keyof T]: T[K] | (() => T[K][] | undefined | false)}
  ): T[] {
  const current = {} as any
  function go(queue: any): any {
    if (queue.length == 0) {
      return [{...current}]
    }
    const [[key, gen], ...rest] = queue
    if (typeof gen == 'function') {
      return (gen(current) || []).flatMap((x: any) => {
        current[key] = x
        return go(rest)
      })
    } else {
      current[key] = gen
      return go(rest)
    }
  }
  const kvs = Object.entries(template(current))
  return go(kvs)
}

function range(lo: number, hi: number): number[] {
  const out = []
  for (let i = lo; i <= hi; i++) {
    out.push(i)
  }
  return out
}

interface HLine {
  x1: Logic.Bits,
  x2: Logic.Bits
  y: Logic.Bits
}

interface VLine {
  y1: Logic.Bits,
  y2: Logic.Bits
  x: Logic.Bits
}

function left_of(left: HLine, right: HLine, gap: Logic.Bits) {
  return Logic.lessThan(Logic.sum(left.x2, gap), right.x1)
}

function between(lo: Logic.Bits, mid: Logic.Bits, hi: Logic.Bits) {
  return Logic.and(
    Logic.lessThanOrEqual(lo, mid),
    Logic.lessThanOrEqual(mid, hi)
  )
}

function vh_overlap(v: VLine, h: HLine) {
  return Logic.and(
    between(h.x0, v.x, h.x1),
    between(v.y0, h.y, v.y1),
  )
}


































function onload() {

  const words = s => s.trim().split(/\s+/g)
  const mapEntries = (obj, f) => Object.entries(obj).map(([k, v], i) => f(k, v, i))
  const base = s => words(s).map(id => ({id}))
  const nodes = o => mapEntries(o, (id, above) => ({id, above: words(above)}))

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

  const confs = generate<{bits: number, sep: number, minisep: number, num_lines: number, strategy: string}>(conf => ({
    bits: () => range(8, 18),
    sep: 10,
    minisep: 10,
    num_lines: () => [15],
    strategy: () => ['bottom-up'], // , 'default'],
  }))
  confs.forEach(conf => {
    const s = new Logic.Solver()

    const sep = Logic.constantBits(conf.sep)
    const minisep = Logic.constantBits(conf.minisep)
    const {bits, num_lines, strategy} = conf

    interface Line {x0: Logic.Bits, x1: Logic.Bits, y: Logic.Bits, mirrored: boolean}
    const lines = [] as Line[]

    function flip(line: Line) {
      return {x: line.y, y0: line.x0, y1: line.x1}
    }

    for (let i = 0; i < num_lines; ++i) {
      lines.push({
        x0: Logic.variableBits('x0@' + i, bits),
        x1: Logic.variableBits('x1@' + i, bits),
        y: Logic.variableBits('y@' + i, bits),
        mirrored: i % 2 == 0,
      })
    }

    const overlaps = [] as Logic.Formula[]

    const between = (lo: Logic.Bits, mid: Logic.Bits, hi: Logic.Bits) => Logic.and(Logic.lessThanOrEqual(lo, mid), Logic.lessThanOrEqual(mid, hi))

    lines.forEach((line, i) => {

      s.require(Logic.lessThan(Logic.sum(line.x0, sep), line.x1))

      lines.forEach((other, j) => {
        if (!line.mirrored && other.mirrored) {
          const line2 = flip(other)
          overlaps.push(
            Logic.and(
              between(line.x0, line2.x, line.x1),
              between(line2.y0, line.y, line2.y1),
            )
          )
        }
        if (i < j && line.mirrored == other.mirrored) {
          overlaps.push(
            Logic.and(
              Logic.equalBits(line.y, other.y),
              Logic.or(
                between(line.x0, other.x0, line.x1),
                between(other.x0, line.x0, other.x1),
              )
            )
          )
        }
        if (i < j && line.mirrored == other.mirrored) {
          overlaps.push(
            Logic.not(
            Logic.or(
              Logic.lessThan(Logic.sum(line.y, minisep) , other.y),
              Logic.lessThan(Logic.sum(other.y, minisep), line.y)
            ))
          )
        }
      })
    })

    function print(sol: Logic.Solution | null, print=false) {
      let svg = '<svg height=512 width=512>'
      console.warn('Solution found!', overlaps.filter(o => sol.evaluate(o)).length)
      if (sol) {
        // sol.ignoreUnknownVariables()
        lines.forEach(line => {
          let obj: any = line.mirrored ? flip(line) : line
          obj = {...obj}
          Object.entries(obj).forEach(([k, v]) => Logic.isBits(v) && ((obj as any)[k] = sol.evaluate(v)))
          // console.log(JSON.stringify(obj))
          if ('x' in obj) {
            obj.x0 = obj.x1 = obj.x
          }
          if ('y' in obj) {
            obj.y0 = obj.y1 = obj.y
          }
          svg += `\n  <line x1=${obj.x0} x2=${obj.x1} y1=${obj.y0} y2=${obj.y1} style="stroke:rgb(255,0,0);stroke-width:1px" />`
        })
        document.body.innerHTML = svg
      }
    }

    const sol = s.solveAssuming(Logic.or(overlaps))
    const confstr = JSON.stringify(conf)

    console.time(confstr)
    // print(sol)
    // console.timeEnd('sol')
    if (sol) {
      // console.time('opt')
      const opt = (s.minimizeWeightedSum as any)(sol, overlaps, overlaps.map(() => 1), {
        // progress: console.log,
        strategy
      })
      // console.timeEnd('opt')
      console.timeEnd(confstr)
      print(opt)
    }
  })
}


// document.onload = onload
// document.body && onload()
window.requestAnimationFrame(onload)

// for (let i = 0; i < 100; ++i) {
//   const sol = s.solve()
//   console.log(sol)
//   if (sol) {
//     Object.entries(sol.getMap()).forEach(([k, v]) => {
//       // console.log(s.toNumTerm(k), k, v)
//     })
//     s.forbid(sol.getFormula())
//   }
// }

window.count = window.count || 1
window.count++
console.log(window.count)

/*
async function koala() {
  const blog_raw = await fetch('./Eukalyptus_Blog.xml')
  const blog = await blog_raw.text()
  const p = new DOMParser()
  console.log(p.parseFromString(blog, 'text/xml'))
}

koala()

function reload() {
  document.body.innerHTML = '<pre>' + window.count + ', bar:' + bar.val
}

document.body && reload()

const x = 2
console.log('rerunning!', x, bar, window.count, Logic, koala)
*/

declare const module: any
if (module.hot) {
  module.hot.accept(() => {})
}


