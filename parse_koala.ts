import {Spec, SpecEntry, renumber} from "./trees"

interface Sentence {
  id: string
  tokens: number
  secedges: number
  discontinuous: boolean
  spec: Spec<string>
}

const $ = (base: Element | Document, q: string) => Array.from(base.querySelectorAll(q))

export function* parse_koala(xml_string: string): Generator<Sentence> {
  const p = new DOMParser()
  console.time('parse')
  const xml = p.parseFromString(xml_string, 'text/xml')
  console.timeEnd('parse')
  const sentences: Sentence[] = []
  const err = xml.querySelector('parsererror')
  if (xml && !err) {
    const sents = $(xml, 's')
    let found = 0
    for (let i = 0; i < sents.length; ++i) {
      const spec_by_id = {} as Record<string, SpecEntry<string>>
      const s = sents[i]
      const tokens = $(s, 't').length
      const secedges = $(s, 'secedge').length
      const discontinuous = $(s, '[discontinuous="true"]').length != 0
      if (!secedges) continue
      if (tokens < 20) continue
      // if (!discontinuous) continue
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
        spec_by_id[id].flabel = flabel
      })
      const spec = renumber(Object.values(spec_by_id))
      // console.log(pretty(final))
      yield {
        id: s.attributes.id.value,
        // xml: `${new XMLSerializer().serializeToString(s)}`
        spec,
        tokens,
        secedges,
        discontinuous,
      }
    }
  }
}
