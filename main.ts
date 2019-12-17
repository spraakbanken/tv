import * as utils from "./utils"
import * as domdiff from "./domdiff.js"
const {body, div, span, select, button, input, datalist, option, textarea} = domdiff
const {css, clear} = domdiff.class_cache()
clear()

css`
  body {
    font-family: 'Source Sans Pro', sans-serif;
    font-size: 16px;
    font-weight: 400;
  }
  pre {
    font-family: Consolas;
    border-left: 2px #8cf solid;
    padding-left: 2px;
    background: #f8f8f8;
  }
  .flabel {
    font-size: 14px;
  }
`;

import * as koala from "./parse_koala"
import {draw_tree, Spec} from "./trees"
import {Store} from "reactive-lens"
import {default as pretty} from "json-stringify-pretty-compact"

declare const module: {hot?: {accept: Function}}
module.hot && module.hot.accept()

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
    } else if (typeof obj === 'string') {
      const cands: string[] = utils.nub([
        ...obj.split(' '),
        ...obj.split('_'),
        ...obj.split('-'),
        ...obj.split(/[_.\-]/g)
      ].filter(s => !s.match(/^[-.\d]+[abc]?$/)))
      out.push(...cands)
    }
  }
}

const pr = console.log.bind(console)

const state0 = {
  message: '',
  sents: [] as koala.Sentence[],
  index: {} as Record<string, koala.Sentence[]>,
  query: '',
  current: {
    pos: 0,
    width: 1,
    sel: [] as koala.Sentence[]
  }
}

type State = typeof state0

declare global {
  interface Window {
    store: Store<State>
  }
}

if (!window.store) {
  window.store = Store.init(state0)
} else {
  window.store = Store.init(window.store.get())
}

const store = window.store as Store<State>
const current = store.at('current')

const run_query = utils.limit(250, () => {
  console.log('run_query', current.get())
  const {query, index, sents} = store.get()
  if (!query) {
    current.update({
      pos: 0,
      sel: sents
    })
    return
  }
  console.time('filter')
  const sets = query.split(/\s+/g).map(s => new Set(index[s] || []))
  const sel = [...intersections(sets)]
  console.timeEnd('filter')
  current.update({
    pos: 0,
    sel
  })
})

store.at('query').ondiff(run_query)
store.at('index').ondiff(run_query)

store.at('message').ondiff(utils.limit(2000, () => store.update({message: ''})))

store.at('sents').ondiff(Sents => {
  console.time('index')
  const Strs = Sents.flatMap(sent => utils.nub(strs_of(sent)).map(s => ({s, sent})))
  const StrS = utils.by_many('s', Strs)
  const index = utils.mapEntries(StrS, (_k, xs) => xs.map(x => x.sent))
  store.update({index})
  console.timeEnd('index')
})

const msg = domdiff.forward(domdiff.template_to_string, (message: string) => {
  console.log(message)
  store.update({message})
})

const koala_files: string[] = [
  './Eukalyptus_Public.xml',
  './Eukalyptus_Blog.xml',
  './Eukalyptus_Europarl.xml',
  './Eukalyptus_Romaner.xml',
  './Eukalyptus_Wikipedia.xml',
]

async function load_koala() {
  const sents: koala.Sentence[] = []
  for (const file of koala_files) {
    msg`loading ${file}...`
    const xml = await fetch(file)
    const text = await xml.text()
    sents.push(...koala.parse_koala(text))
  }
  msg`Eukalyptus loaded!`
  store.update({sents})
}

import {examples} from "./examples"

{
  const {sents} = store.get()
  const load_examples = window.location.hash == '#examples'
  if (load_examples) {
    const {pos} = current.get()
    store.update({
      sents: examples.map(spec => ({example: true, spec})) as any
    })
    console.log({pos})
    let off
    off = current.on(() => {
      current.update({pos})
      off()
    })
    window.onkeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.target && e.target.blur && e.target.blur()
      }
      if (e.target !== document.body) return
      console.log(e.key)
      const N = current.get().sel.length

      const ops = {
        ArrowRight: () => current.at('pos').modify(x => Math.min(x + 1, N - 1)),
        ArrowLeft:  () => current.at('pos').modify(x => Math.max(x - 1, 0)),
        ArrowDown:  () => current.at('width').modify(x => Math.max(x - 1, 1)),
        ArrowUp:    () => current.at('width').modify(x => x + 1),
        "-": () => current.transaction(() => {
          ops.ArrowRight()
          ops.ArrowDown()
        }),
        Enter: () => current.transaction(() => {
          utils.range(1, current.get().width).forEach(() => ops.ArrowRight())
          current.update({width: 1})
        }),
      } as Record<string, Function>

      const op = ops[e.key]
      op && op()
    }
  } else if (sents.length == 0) {
    load_koala()
  }
}

const track = <A, Dom>(store: Store<A>, k: (a: A) => (b: Dom, ns: string) => Dom, ms?: number) => (dom: Dom, ns: string) => {
  const dom0 = k(store.get())(dom, ns)
  let k2 = () => k(store.get())(dom0, ns)
  if (ms) {
    k2 = utils.limit(ms, k2)
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
    css`display: inline-block`,
    css`
      &, & > * { display: inline-block; }
      & > * > * { margin: 5px; }
    `,
    div(
      with_ref(
        (dom: HTMLInputElement) => dom.value = store.get().query,
        input({
          list: 'x',
          placeholder: 'input query...',
          autofocus: true,
          oninput: utils.limit(250, (e: InputEvent) => {
            if (!e.target || !(e.target instanceof HTMLInputElement)) return
            const query = e.target.value as string
            store.update({query})
          }),
        }),
      ),
      track(store.at('index'), index => datalist(
        {id: 'x'},
        ...Object.keys(index).sort().map(k => option(k))
      )),
    ),
    div(
      track(current, ({pos, sel, width}) => span(
        {id: 'boo'},
        css`display: inline-block;`,
        sel.length != 0 && (
          width == 1
            ? `${pos+1} of ${sel.length}`
            : `${pos+1} to ${Math.min(pos+width, sel.length)} of ${sel.length}`
        )
      )),
      button('prev', { onclick: () => current.at('pos').modify(x => Math.max(x - current.get().width, 0)) }),
      button('next', { onclick: () => current.at('pos').modify(x => Math.min(x + current.get().width, current.get().sel.length - 1)) }),
      'width:',
      with_ref(
        (dom: HTMLSelectElement) => {
          current.at('width').ondiff(x => {
            const y = x + ''
            y == dom.value || (dom.value = y)
          })
        },
        select(
          ...[1, 2, 5, 10, 20, 50].map(x => option(x + '')),
          {
            oninput(e: InputEvent) {
              if (!e.target || !(e.target instanceof HTMLSelectElement)) return
              current.at('width').set(Number(e.target.value))
            }
          }
        )
      ),
    ),
    div(
      track(store.at('message'), span)
    )
  ),
  track(current, ({pos, sel, width}) => {
    const sl = sel.slice(pos, pos + width)
    console.time('trees')
    const trees = sl.map(sent => div(
      css`
        border-top: 2px #e2e2e2 solid;
        margin-top: 10px;
        padding-top: 10px;
        display: flex;
        flex-direction: column;
      `,
      css`
        & > * {
          overflow-x: auto;
          overflow-y: hidden;
        }
      `,
      div(
        sent.id,
        css`
          font-style: italic;
          align-self: flex-end;
        `
      ),
      ...edit_tree(sent.spec)
    ))
    console.timeEnd('trees')
    return div(
      ...trees
    )
  }, 500 // this can be decreased when working with examples
  ),
)(document.body)

function edit_tree(spec0: Spec<string>) {
  const tmp = Store.init(spec0)
  const vis = Store.init(false)
  function try_(m, f) {
    try {
      return m()
    } catch (e) {
      return f(e)
    }
  }

  return [
    div(
      css`display: flex; flex-direction: row`,
      css`& > * { margin-right: 10px }`,

      track(tmp,
        spec => div(
          css`flex-grow: 1`,
          try_(() => draw_tree(spec), e => div(e.toString())),
          { ondblclick: () => vis.modify(b => !b) }
        )
      ),

      track(vis, v => div(
        v && json_textarea(tmp, { onblur: () => false && vis.set(false) })
      )),

    )
  ]
}

function json_textarea(tmp: Store<any>, ...opts: any[]) {
  return with_ref(
    (dom: HTMLTextAreaElement) => dom.value = pretty(tmp.get()),
    textarea({
      rows: '20',
      cols: '80',
      oninput(e: InputEvent) {
        if (!e.target || !(e.target instanceof HTMLTextAreaElement)) return
        try {
          const json = (0, eval)(e.target.value)
          tmp.set(json)
        } catch (e) {
          msg`${e}`
        }
      }
    }, ...opts))
}
