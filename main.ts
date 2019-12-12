import {parse_koala} from "./parse_koala"

import * as utils from "./utils"

import * as domdiff from "./domdiff.js"
const {body} = domdiff
const {css, sheet} = domdiff.class_cache()

import {G} from "./trees"

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

console.time('G examples')
examples.forEach(spec => page.push(G('', ...spec)))
console.timeEnd('G examples')

body(sheet(), ...page)(document.body)

const koala: string[] = [
  './Eukalyptus_Blog.xml',
  './Eukalyptus_Europarl.xml',
  './Eukalyptus_Public.xml',
  './Eukalyptus_Romaner.xml',
  './Eukalyptus_Wikipedia.xml',
]

;(async () => {
  for (const file of koala) {
    console.log('loading', file)
    const xml = await fetch(file)
    const text = await xml.text()
    // page.splice(0, page.length)
    // page.push(pre(text))
    const sents = Array.from(
      utils.take(10, parse_koala(text))
    )
    console.time('G sents')
    sents.forEach(({id, spec}) => page.push(G(id, ...spec)))
    console.timeEnd('G sents')
    body(sheet(), ...page)(document.body)
  }
})()


