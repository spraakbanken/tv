import {Spec, SpecEntry, renumber} from "./trees"

export interface Sentence {
  id: string
  tokens: string[]
  secedges: boolean
  discontinuous: boolean
  spec: Spec<string>
}

const $ = (base: Element | Document, q: string) => Array.from(base.querySelectorAll(q))

export function sentences(xml_string: string): Element[] {
  const p = new DOMParser()
  // console.time('parse')
  const xml = p.parseFromString(xml_string, 'text/xml')
  // console.timeEnd('parse')
  const err = xml.querySelector('parsererror')
  if (xml && !err) {
    return $(xml, 's')
  }
  console.warn(err.innerText)
  return []
}

export function parse_sentence(s: Element): Sentence {
  const spec_by_id = {} as Record<string, SpecEntry<string>>
  const terminals  = $(s, 't')
  const nonterminals = $(s, 'nt')
  terminals.forEach(t => {
    // console.log(t, t.attributes)
    const id = t.attributes.id.value
    spec_by_id[id] = {
      id,
      label: t.attributes.word.value
    }
  })
  const flabels = {} as Record<string, string>
  nonterminals.forEach(nt => {
    // console.log(nt, nt.attributes)
    const id = nt.attributes.id.value
    spec_by_id[id] = {
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
    // console.log(spec_by_id, id, flabel)
    if (id in spec_by_id) {
      spec_by_id[id].flabel = flabel
    }
  })
  const spec = renumber(Object.values(spec_by_id))
  // console.log(pretty(final))
  const tokens = $(s, 't').map(t => t.attributes.word.value)
  const secedges = $(s, 'secedge').length > 0
  const discontinuous = $(s, '[discontinuous="true"]').length > 0
  return {
    id: s.attributes.id.value,
    // xml: `${new XMLSerializer().serializeToString(s)}`
    spec,
    tokens,
    secedges,
    discontinuous,
  }
}

export function* parse_koala(xml_string: string): Generator<Sentence> {
  for (const s of sentences(xml_string)) {
    yield parse_sentence(s)
  }
}
