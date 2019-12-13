import * as koala from "./parse_koala"

import * as utils from "./utils"

import * as domdiff from "./domdiff.js"
const {body, div, span, select, button, input, datalist, option, } = domdiff
const {css, sheet} = domdiff.class_cache()

import {G} from "./trees"

import {Store} from "reactive-lens"

declare const module: {hot?: {accept: Function}}
module.hot && module.hot.accept()

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

import {examples} from "./examples"

// console.log(store)

function redraw() {
  console.log('redrawing 6')
  // const sents = Array.from(koala.parse_koala(store.get()))
  // const trees = sents.map(s => G('', ...s.spec))
  let trees = undefined
  try {
    trees = G('', ...JSON.parse(store.get()))
  } catch {
  }
  body(
    sheet(),
    textarea(
      store.get(),
      rows(25),
      cols(120),
      domdiff.input(
        (e: InputEvent) => {
          store.set(e.target.value)
        }
      ),
    ),
    trees,
  )(document.body)
}

// redraw()
// store.on(redraw)

const pr = console.log.bind(console)

const Sents: koala.Sentence[] = (window.Sents = (window.Sents || []))

// console.time('G examples')
// examples.forEach(spec => page.push(G('', ...spec)))
// console.timeEnd('G examples')

// body(sheet(), ...page)(document.body)

const koala_files: string[] = [
  './Eukalyptus_Public.xml',
  './Eukalyptus_Blog.xml',
  './Eukalyptus_Europarl.xml',
  './Eukalyptus_Romaner.xml',
  './Eukalyptus_Wikipedia.xml',
]

async function load_koala() {
  for (const file of koala_files) {
    console.log('loading', file)
    const xml = await fetch(file)
    const text = await xml.text()
    // page.splice(0, page.length)
    // page.push(pre(text))
    // console.log(file, koala.sentences(text).length)
    Sents.push(...koala.parse_koala(text))
    const sents = Array.from(
      utils.take(1, koala.parse_koala(text))
    )
    console.time('G sents')
    sents.forEach(({id, spec}) => page.push(G(id, ...spec)))
    console.timeEnd('G sents')
    // body(sheet(), ...page)(document.body)
  }
}

if (Sents.length == 0) {
  load_koala()
}

const st0 = {
  index: 0,
  width: 1,
  sel: Sents
}

type St = typeof st0

declare global {
  interface Window {
    store: Store<St>
  }
}

if (!window.store) {
  window.store = Store.init(st0)
} else {
  window.store = Store.init(window.store.get())
}

const store = window.store as Store<St>

console.log(Sents.length)

function strs_of(x: any): string[] {
  const out: string[] = []
  rec(x)
  return out
  function rec(obj: any) {
    if (Array.isArray(obj)) {
      obj.forEach(rec)
    } else if (obj && typeof obj === 'object') {
      for (const k in obj) {
        const v = obj[k]
        if (typeof v === 'boolean') {
          out.push(k + ':' + v)
        }
        rec(v)
      }
    } else if (typeof obj === 'string' && !obj.match(/^\d*$/)) {
      out.push(obj)
    }
  }
}

console.time('Strs')
const Strs = Sents.flatMap(sent => utils.nub(strs_of(sent)).map(s => ({s, sent})))
console.timeEnd('Strs')
console.time('Strs sort')
const StrS = utils.by_many('s', Strs)
console.timeEnd('Strs sort')
pr(Object.keys(StrS).length, StrS, Strs)

const track = <A, Dom>(store: Store<A>, k: (a: A) => (b: Dom, ns: string) => Dom, ms?: number) => (dom: Dom, ns: string) => {
  const dom0 = k(store.get())(dom, ns)
  let k2 = () => k(store.get())(dom0, ns)
  if (ms) {
    k2 = limit(ms, k2)
  }
  let raf = window.requestAnimationFrame
  store.ondiff(() => {
    // k(store.get())(dom0)
    raf(() => {
      k2()
      raf = window.requestAnimationFrame
    })
    raf = () => 0
  })
  return dom0
}

const limit = <A extends Array<any>, B>(ms: number, f: (...args: A) => B) => {
  let timer: number | undefined
  let last_args: A
  return (...args: A) => {
    last_args = args
    clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      f(...last_args)
    }, ms)
  }
}


function intersections<A>(ss: Set<A>[]): Set<A> {
  if (ss.length == 0) {
    return new Set()
  } else {
    let out = ss[0]
    for (const s of ss) {
      if (s === out) continue
      const next = new Set<A>()
      out.forEach(e => {
        if (s.has(e)) {
          next.add(e)
        }
      })
      out = next
    }
    return out
  }
}

const with_ref = (f, g) => (dom0, ns) => {
  const dom = g(dom0, ns)
  f(dom)
  return dom
}

body(
  div(
    css`display: flex; flex-direction: row`,
    css`& > * { margin: 0 10px }`,
    input({
      list: 'x',
      placeholder: 'input query...',
      autofocus: true,
      oninput: limit(250, (e: InputEvent) => {
        if (!e.target || !(e.target instanceof HTMLInputElement)) return
        const inp = e.target.value as string
        console.time('filter')
        const tgts = inp.split(/\s+/g).map(s => {
          const tgt = new Set((StrS[s] || []).map(x => x.sent))
          // ^ using StrS, but should be stored in the store
          pr(s, tgt.size, tgt)
          return tgt
        })
        const sel = [...intersections(tgts)]
        console.timeEnd('filter')
        pr(inp, sel.length, sel)
        store.update({
          index: 0,
          sel
        })
      }),
    }),
    datalist(
      {id: 'x'},
      ...Object.keys(StrS).sort().map(k => option(k))
    ),
    track(store, ({index, sel, width}) => span(
      width == 1
        ? `${index+1} of ${sel.length}`
        : `${index+1} to ${index+width} of ${sel.length}`
    )),
    button('prev', { onclick: () => store.at('index').modify(x => x - store.get().width) }),
    button('next', { onclick: () => store.at('index').modify(x => x + store.get().width) }),
    'width:',
    with_ref(
      (dom: HTMLSelectElement) => dom.value = '' + store.get().width,
      select(
        ...[1, 2, 5, 10, 20, 50].map(x => option(x + '')),
        {
          oninput(e: InputEvent) {
            if (!e.target || !(e.target instanceof HTMLSelectElement)) return
            store.at('width').set(Number(e.target.value))
          }
        }
      )
    )
  ),
  track(store, ({index, sel, width}) => {
    const sl = sel.slice(index, index + width)
    console.log(sl, index, sel)
    console.time('trees')
    const trees = sl.map(sent => G(sent.id, ...sent.spec))
    console.timeEnd('trees')
    return div(
      ...trees
    )
  }, 500),
  track(store, sheet),
)(document.body)

