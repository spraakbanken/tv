import {Spec} from "./trees"

import * as utils from "./utils"
import {words} from "./utils"

export const examples: Spec<string>[] = []

const base = (s: string) => words(s).map(
  s => {
    const [id, flabel] = s.split('|')
    return {
      id,
      label: id,
      flabel: flabel || undefined,
    }
  }
)
const nodes =
  (o: Record<string, string>) =>
  utils.mapObject(o, (id, child_str) => {
    const children: string[] = []
    const secondary: any[] = []
    words(child_str).forEach(ch => {
      const [label, id] = ch.split('->')
      if (id) {
        secondary.push({label, id})
      } else {
        children.push(ch)
      }
    })
    return {id, label: id, children, secondary}
  })

function secondary_clutter(spec: Spec<string>, r = 0.9) {
  const ids = spec.map(s => s.id)
  const label = utils.id_supply()
  return spec.map(s => {
    if (s.children) {
      return {
        ...s,
        flabel: s.flabel || (label() + ''),
        secondary: ids.filter(_ => Math.random() > r).map(id => ({
          id,
          label: label() + '',
        }))
      }
    }
    return s
  })
}

if (true) {
  const G = (...spec: Spec<string>) => examples.push(
    spec,
    // secondary_clutter(spec, 0.95),
  )

  G(...base('a b c d'),
    ...nodes({
      CD: 'c d',
      AB: 'a b',
    }))

  G(...base('a b c d'),
    ...nodes({
      BC: 'b c',
      AD: 'a d',
    }))

  G(...base('1 a|a b|b 2 3 c|c d|d 4 5'),
    ...nodes({
      ab: 'a b',
      cd: 'c d',
    }))

  G(...base('jag ville åka dit igår'),
    ...nodes({
      IP: 'åka dit',
      IP2: 'IP igår',
      VP: 'IP2 ville',
      S: 'jag VP',
    }))

  G(...base('igår ville jag åka dit'),
    ...nodes({
      B: 'igår åka dit',
      N: 'B',
      B2: 'ville jag N',
      N2: 'B2',
    }))

  G(...base('jag ville åka dit igår'),
    ...nodes({
      IP: 'åka dit',
      VP: 'IP ville',
      VP2: 'VP igår',
      S: 'jag VP2',
    }))

  G(...base('igår ville jag åka dit'),
    ...nodes({
      IP: 'åka dit',
      VP: 'jag ville',
      'VP₂': 'VP IP',
      S: 'igår VP₂',
    }))

  G(...base('igår ville jag åka dit'),
    ...nodes({
      IP: 'åka dit',
      VP: 'jag ville',
      'IP₂': 'IP igår',
      'S? VP?': 'VP IP₂',
    }))

  G(...base('igår ville jag åka dit'),
    ...nodes({
      IP: 'åka dit',
      'IP2?': 'IP igår',
      VP: 'IP2? ville',
      'S?': 'jag VP',
    }))


  G(...base('igår ville jag åka dit'),
    ...nodes({
      IP: 'åka dit',
      VP: 'IP ville',
      VP2: 'VP igår',
      'S?': 'jag VP2',
    }))

  G(...base('jag ville åka dit igår'),
    ...nodes({
      IP: 'igår åka dit',
      S: 'ville jag IP',
    })),

  G(...base('jag ville åka dit igår'),
    ...nodes({
      IP: 'dit åka',
      S: 'ville jag IP igår',
    })),

  G(...base('igår ville jag åka dit'),
    ...nodes({
      IP: 'åka dit',
      S: 'igår ville jag IP',
    }))

  G(...base('igår ville jag åka dit'),
    ...nodes({
      'IP?': 'igår åka dit',
      S: 'ville jag IP?',
    }))

  G(...base('a b c d e'),
    ...nodes({
      C: 'c e',
      S: 'a b C d',
    }))

  G(...base('a b c d e'),
    ...nodes({
      WIDE: 'c e',
      S: 'a b WIDE d',
    }))

  G(...base('a b e d c'),
    ...nodes({
      WIDE: 'c e',
      S: 'a b WIDE d',
    }))

  G(...base('a b c d e f'),
    ...nodes({
      CD: 'c d f',
      S: 'a b CD e',
    }))

  G(...base('a b c d e f'),
    ...nodes({
      EF: 'c e f',
      S: 'a b d EF',
    }))

  G(...base('a b c d e f & h'),
    ...nodes({
      EF: 'c e f',
      S: 'a b d EF',
      'S₂': 'S & h'
    }))

  G(...base('a b c d e f & h g'),
    ...nodes({
      DEF: 'd e f',
      S: 'a b c DEF',
      HG: 'h g',
      'S₂': 'S & HG',
    }))

  // dependency tree experiment
  G(...base('dit vill jag åka'),
    {id: 'SB', label: '', flabel: 'SB', only: 'jag', children: words('jag')},
    {id: 'RA', label: '', flabel: 'RA', only: 'dit', children: words('dit')},
    {id: 'OO', label: '', flabel: 'OO', only: 'åka', children: words('åka RA')},
    {id: 'RT', label: 'RT', flabel: '', only: 'vill', children: words('SB vill OO')},
  )

  // dependency tree experiment
  G(...base('dit vill jag åka'),
    ...nodes({
      SB: 'jag',
      RA: 'dit',
    }),
    {id: 'OO', label: 'OO', only: 'åka', children: words('RA åka')},
    {id: 'root', label: 'root', only: 'vill', children: words('SB vill OO')},
  )

  G({
      id: "0",
      label: "Svenson",
      flabel: "SB",
      children: [],
      secondary: []
    },
    {
      id: "1",
      label: "börjar",
      flabel: "HD",
      children: [],
      secondary: []
    },
    {
      id: "2",
      label: "skrika",
      flabel: "HD",
      children: [],
      secondary: []
    },
    {
      id: "3",
      label: "och",
      flabel: "PH",
      children: [],
      secondary: []
    },
    {
      id: "4",
      label: "gestikulera",
      flabel: "HD",
      children: [],
      secondary: []
    },
    {id: "5", label: ":", children: [], secondary: []},
    {id: "6", label: "KoP", children: ["7", "3", "10"], secondary: []},
    {
      id: "7",
      label: "S",
      children: ["0", "1", "8"],
      secondary: [],
      flabel: "KL"
    },
    {
      id: "8",
      label: "VP",
      children: ["2"],
      secondary: [{id: "0", label: "SB"}],
      flabel: "IV"
    },
    {
      id: "9",
      label: "VP",
      children: ["4"],
      secondary: [{id: "0", label: "SB"}],
      flabel: "IV"
    },
    {
      id: "10",
      label: "S",
      children: ["9"],
      secondary: [{id: "0", label: "SB"}, {id: "1", label: "HD"}],
      flabel: "KL"
    })

  G({id: "0", label: "—", children: [], secondary: []},
    {
      id: "1",
      label: "Men",
      flabel: "DF",
      children: [],
      secondary: []
    },
    {
      id: "2",
      label: "vad",
      flabel: "OO",
      children: [],
      secondary: []
    },
    {
      id: "3",
      label: "ska",
      flabel: "HD",
      children: [],
      secondary: []
    },
    {
      id: "4",
      label: "jag",
      flabel: "SB",
      children: [],
      secondary: []
    },
    {id: "5", label: "då", flabel: "MD", children: [], secondary: []},
    {id: "6", label: "ta", flabel: "ME", children: [], secondary: []},
    {
      id: "7",
      label: "mej",
      flabel: "OO",
      children: [],
      secondary: []
    },
    {
      id: "8",
      label: "till",
      flabel: "HD",
      children: [],
      secondary: []
    },
    {id: "9", label: "!", children: [], secondary: []},
    {
      id: "10",
      label: "VBM",
      children: ["6"],
      secondary: [{id: "8", label: "ME"}, {id: "7", label: "ME"}],
      flabel: "HD"
    },
    {
      id: "11",
      label: "VP",
      children: ["13", "10", "7"],
      secondary: [{id: "4", label: "SB"}],
      flabel: "IV"
    },
    {
      id: "12",
      label: "S",
      children: ["1", "11", "3", "4", "5"],
      secondary: []
    },
    {
      id: "13",
      label: "PP",
      children: ["2", "8"],
      secondary: [],
      flabel: "OA"
    }
  )

  G({id: "0", label: "Ni", flabel: "SB", children: [], secondary: []},
    {
      id: "1",
      label: "kommer",
      flabel: "HD",
      children: [],
      secondary: []
    },
    {
      id: "2",
      label: "att",
      flabel: "HD",
      children: [],
      secondary: []
    },
    {id: "3", label: "bo", flabel: "HD", children: [], secondary: []},
    {id: "4", label: "i", flabel: "HD", children: [], secondary: []},
    {
      id: "5",
      label: "mitt",
      flabel: "DT",
      children: [],
      secondary: []
    },
    {
      id: "6",
      label: "hus",
      flabel: "HD",
      children: [],
      secondary: []
    },
    {id: "7", label: "så", flabel: "ME", children: [], secondary: []},
    {
      id: "8",
      label: "länge",
      flabel: "HD",
      children: [],
      secondary: []
    },
    {id: "9", label: "ni", flabel: "SB", children: [], secondary: []},
    {
      id: "10",
      label: "är",
      flabel: "HD",
      children: [],
      secondary: []
    },
    {id: "11", label: "i", flabel: "HD", children: [], secondary: []},
    {
      id: "12",
      label: "Kaimana",
      flabel: "OO",
      children: [],
      secondary: []
    },
    {id: "13", label: ",", children: [], secondary: []},
    {
      id: "14",
      label: "jag",
      flabel: "SB",
      children: [],
      secondary: []
    },
    {
      id: "15",
      label: "ska",
      flabel: "HD",
      children: [],
      secondary: []
    },
    {
      id: "16",
      label: "nog",
      flabel: "MD",
      children: [],
      secondary: []
    },
    {
      id: "17",
      label: "ordna",
      flabel: "HD",
      children: [],
      secondary: []
    },
    {
      id: "18",
      label: "den",
      flabel: "DT",
      children: [],
      secondary: []
    },
    {
      id: "19",
      label: "saken",
      flabel: "HD",
      children: [],
      secondary: []
    },
    {id: "20", label: ",", children: [], secondary: []},
    {
      id: "21",
      label: "men",
      flabel: "PH",
      children: [],
      secondary: []
    },
    {
      id: "22",
      label: "nu",
      flabel: "MD",
      children: [],
      secondary: []
    },
    {
      id: "23",
      label: "ska",
      flabel: "HD",
      children: [],
      secondary: []
    },
    {
      id: "24",
      label: "vi",
      flabel: "SB",
      children: [],
      secondary: []
    },
    {
      id: "25",
      label: "ombord",
      flabel: "RA",
      children: [],
      secondary: []
    },
    {
      id: "26",
      label: "och",
      flabel: "PH",
      children: [],
      secondary: []
    },
    {
      id: "27",
      label: "äta",
      flabel: "HD",
      children: [],
      secondary: []
    },
    {
      id: "28",
      label: "det",
      flabel: "DT",
      children: [],
      secondary: []
    },
    {
      id: "29",
      label: "sista",
      flabel: "HD",
      children: [],
      secondary: []
    },
    {
      id: "30",
      label: "civiliserade",
      flabel: "MD",
      children: [],
      secondary: []
    },
    {
      id: "31",
      label: "mål",
      flabel: "HD",
      children: [],
      secondary: []
    },
    {
      id: "32",
      label: "mat",
      flabel: "HD",
      children: [],
      secondary: []
    },
    {
      id: "33",
      label: "ni",
      flabel: "SB",
      children: [],
      secondary: []
    },
    {
      id: "34",
      label: "får",
      flabel: "HD",
      children: [],
      secondary: []
    },
    {
      id: "35",
      label: "på",
      flabel: "HD",
      children: [],
      secondary: []
    },
    {
      id: "36",
      label: "två",
      flabel: "DT",
      children: [],
      secondary: []
    },
    {
      id: "37",
      label: "månader",
      flabel: "HD",
      children: [],
      secondary: []
    },
    {id: "38", label: ".", children: [], secondary: []},
    {
      id: "39",
      label: "NP",
      children: ["18", "19"],
      secondary: [],
      flabel: "OO"
    },
    {
      id: "40",
      label: "VP",
      children: ["17", "39"],
      secondary: [{id: "14", label: "SB"}],
      flabel: "IV"
    },
    {
      id: "41",
      label: "S",
      children: ["14", "15", "16", "40"],
      secondary: [],
      flabel: "DF"
    },
    {
      id: "42",
      label: "PP",
      children: ["11", "12"],
      secondary: [],
      flabel: "RA"
    },
    {
      id: "43",
      label: "ABM",
      children: ["7"],
      secondary: [{id: "8", label: "ME"}],
      flabel: "MD"
    },
    {
      id: "44",
      label: "S",
      children: ["9", "10", "42"],
      secondary: [],
      flabel: "OO"
    },
    {
      id: "45",
      label: "NP",
      children: ["5", "6"],
      secondary: [],
      flabel: "OO"
    },
    {
      id: "46",
      label: "PP",
      children: ["4", "45"],
      secondary: [],
      flabel: "RA"
    },
    {
      id: "47",
      label: "VP",
      children: ["3", "46", "62"],
      secondary: [{id: "0", label: "SB"}],
      flabel: "OO"
    },
    {
      id: "48",
      label: "S",
      children: ["0", "1", "58", "41"],
      secondary: [],
      flabel: "KL"
    },
    {
      id: "49",
      label: "NP",
      children: ["36", "37"],
      secondary: [],
      flabel: "OO"
    },
    {
      id: "50",
      label: "PP",
      children: ["35", "49"],
      secondary: [],
      flabel: "MD"
    },
    {
      id: "51",
      label: "S",
      children: ["33", "34"],
      secondary: [{id: "32", label: "OO"}],
      flabel: "MD"
    },
    {
      id: "52",
      label: "NP",
      children: ["28", "59", "30", "31", "60"],
      secondary: [],
      flabel: "OO"
    },
    {
      id: "53",
      label: "VP",
      children: ["27", "52"],
      secondary: [{id: "24", label: "SB"}],
      flabel: "IV"
    },
    {
      id: "54",
      label: "S",
      children: ["22", "23", "24", "25"],
      secondary: [],
      flabel: "KL"
    },
    {
      id: "55",
      label: "KoP",
      children: ["54", "26", "56"],
      secondary: [],
      flabel: "KL"
    },
    {
      id: "56",
      label: "S",
      children: ["53"],
      secondary: [
        {id: "22", label: "MD"},
        {id: "24", label: "SB"},
        {id: "23", label: "HD"}
      ],
      flabel: "KL"
    },
    {
      id: "57",
      label: "KoP",
      children: ["48", "21", "55"],
      secondary: []
    },
    {
      id: "58",
      label: "SuP",
      children: ["2", "47"],
      secondary: [],
      flabel: "IV"
    },
    {
      id: "59",
      label: "AjP",
      children: ["29", "50"],
      secondary: [],
      flabel: "MD"
    },
    {
      id: "60",
      label: "NP",
      children: ["32", "51"],
      secondary: [],
      flabel: "MD"
    },
    {
      id: "61",
      label: "AbP",
      children: ["43", "8"],
      secondary: [],
      flabel: "PH"
    },
    {
      id: "62",
      label: "SuP",
      children: ["61", "44"],
      secondary: [],
      flabel: "MD"
    }
  )


  G(
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

  G(
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

  G(
      {id: "1008", label: "redan"},
      {id: "1009", label: "för"},
      {id: "1010", label: "ett"},
      {id: "1011", label: "par"},
      {id: "1012", label: "månader"},
      {id: "1013", label: "sedan"},
      {id: "6", label: "PEM", children: ["1009", "1013"]},
      {id: "13", label: "POM", children: ["1010"]},
      {id: "5", label: "NP", children: ["13", "1011", "1012"]},
      {id: "7", label: "PP", children: ["1008", "6", "5"]})

  G(
      {id: "1001", label: "För"},
      {id: "1002", label: "tio"},
      {id: "1003", label: "år"},
      {id: "1004", label: "sen"},
      {id: "1", label: "NP", children: ["1002", "1003"]},
      {id: "10", label: "PEM", children: ["1001", "1004"]},
      {id: "2", label: "PP", children: ["10", "1"]}
  )

  G(
      {id: '0', label: "Detta", flabel: "OO"},
      {id: '1', label: "kan", flabel: "HD"},
      {id: '2', label: "åtminstone", flabel: "MD"},
      {id: '3', label: "jag", flabel: "SB"},
      {id: '4', label: "personligen", flabel: "HD"},
      {id: '5', label: "helt", flabel: "KL"},
      {id: '6', label: "och", flabel: "PH"},
      {id: '7', label: "hållet", flabel: "KL"},
      {id: '8', label: "instämma", flabel: "HD"},
      {id: '9', label: "i", flabel: "HD"},
      {id: '10', label: "."},
      {id: '12', label: "S", children: ['15', '1', '14', '3']},
      {id: '13', label: "PP", children: ['0', '9'], flabel: "MD"},
      {id: '14', label: "AbP", children: ['2', '4'], flabel: "MD"},
      {id: '11', label: "KoP", children: ['5', '6', '7'], flabel: "MD"},
      {id: '15', label: "VP", children: ['13', '11', '8'], flabel: "IV"}
  )

  G(
      {id: '0', label: "Detta", flabel: "OO"},
      {id: '1', label: "kan", flabel: "HD"},
      {id: '2', label: "åtminstone", flabel: "MD"},
      {id: '3', label: "jag", flabel: "SB"},
      {id: '4', label: "personligen", flabel: "HD"},
      {id: '5', label: "helt", flabel: "KL"},
      {id: '6', label: "och", flabel: "PH"},
      {id: '7', label: "hållet", flabel: "KL"},
      {id: '8', label: "instämma", flabel: "HD"},
      {id: '9', label: "i", flabel: "HD"},
      {id: '10', label: "."},
      {id: '11', label: "KoP", children: ['5', '6', '7'], flabel: "MD"},
      {id: '12', label: "S", children: ['15', '1', '14', '3']},
      {id: '13', label: "PP", children: ['0', '9'], flabel: "MD"},
      {id: '14', label: "AbP", children: ['2', '4'], flabel: "MD"},
      {id: '15', label: "VP", children: ['13', '11', '8'], flabel: "IV"}
  )

  G(
      {id: '0', label: "Detta", flabel: "OO"},
      {id: '1', label: "kan", flabel: "HD"},
      {id: '2', label: "åtminstone", flabel: "MD"},
      {id: '3', label: "jag", flabel: "SB"},
      {id: '4', label: "personligen", flabel: "HD"},
      {id: '5', label: "helt", flabel: "KL"},
      {id: '6', label: "och", flabel: "PH"},
      {id: '7', label: "hållet", flabel: "KL"},
      {id: '8', label: "instämma", flabel: "HD"},
      {id: '9', label: "i", flabel: "HD"},
      {id: '10', label: "."},
      {id: '14', label: "AbP", children: ['2', '4'], flabel: "MD"},
      {id: '12', label: "S", children: ['15', '1', '14', '3']},
      {id: '13', label: "PP", children: ['0', '9'], flabel: "MD"},
      {id: '11', label: "KoP", children: ['5', '6', '7'], flabel: "MD"},
      {id: '15', label: "VP", children: ['13', '11', '8'], flabel: "IV"}
  )

  G(
      {id: '0', label: "Detta", flabel: "OO"},
      {id: '1', label: "kan", flabel: "HD"},
      {id: '2', label: "åtminstone", flabel: "MD"},
      {id: '3', label: "jag", flabel: "SB"},
      {id: '4', label: "personligen", flabel: "HD"},
      {id: '5', label: "helt", flabel: "KL"},
      {id: '6', label: "och", flabel: "PH"},
      {id: '7', label: "hållet", flabel: "KL"},
      {id: '8', label: "instämma", flabel: "HD"},
      {id: '9', label: "i", flabel: "HD"},
      {id: '10', label: "."},
      {id: '14', label: "AbP", children: ['2', '4'], flabel: "MD"},
      {id: '12', label: "S", children: ['15', '1', '14', '3']},
      {id: '11', label: "KoP", children: ['5', '6', '7'], flabel: "MD"},
      {id: '13', label: "PP", children: ['0', '9'], flabel: "MD"},
      {id: '15', label: "VP", children: ['13', '11', '8'], flabel: "IV"}
  )

  G(
  /*
    {id: 0, label: "Först", flabel: "MD"},
    {id: 1, label: "skulle", flabel: "HD"},
    {id: 2, label: "jag", flabel: "SB"},
    {id: 3, label: "vilja", flabel: "HD"},
    {id: 4, label: "ge", flabel: "HD"},
    {id: 5, label: "er", flabel: "IO"},
    {id: 6, label: "en", flabel: "DT"},
    {id: 7, label: "komplimang", flabel: "HD"},
    {id: 8, label: "för", flabel: "HD"},
    {id: 9, label: "det", flabel: "DT"},
    {id: 10, label: "faktum", flabel: "HD"},
    {id: 11, label: "att", flabel: "HD"},
    {id: 12, label: "ni", flabel: "SB"},
    {id: 13, label: "hållit", flabel: "ME"},
    {id: 14, label: "ert", flabel: "DT"},
    {id: 15, label: "ord", flabel: "HD"},
    {id: 16, label: "och", flabel: "PH"},
    {id: 17, label: "att", flabel: "HD"},
      */
    {id: '18', label: "det", flabel: "SB"},
    {id: '19', label: "nu", flabel: "HD"},
    {id: '20', label: ","},
    {id: '21', label: "under", flabel: "HD"},
    {id: '22', label: "det", flabel: "DT"},
    {id: '23', label: "nya", flabel: "MD"},
    {id: '24', label: "årets", flabel: "HD"},
    {id: '25', label: "första", flabel: "MD"},
    {id: '26', label: "sammanträdesperiod", flabel: "HD"},
    {id: '27', label: ","},
    {id: '28', label: "faktiskt", flabel: "MD"},
    {id: '29', label: "har", flabel: "HD"},
    {id: '30', label: "skett", flabel: "HD"},
    {id: '31', label: "en", flabel: "DT"},
    {id: '32', label: "kraftig", flabel: "MD"},
    {id: '33', label: "utökning", flabel: "HD"},
    {id: '34', label: "av", flabel: "HD"},
    {id: '35', label: "antalet", flabel: "HD"},
    {id: '36', label: "TV-kanaler", flabel: "HD"},
    {id: '37', label: "på", flabel: "HD"},
    {id: '38', label: "våra", flabel: "DT"},
    {id: '39', label: "rum", flabel: "HD"},
    {id: '40', label: "."},
    {id: '41', label: "NP", children: ['38', '39'], flabel: "OO"},
    {id: '42', label: "PP", children: ['37', '41'], flabel: "MD"},
    {id: '43', label: "NP", children: ['35', '63'], flabel: "OO"},
    {id: '44', label: "PP", children: ['34', '43'], flabel: "MD"},
    {id: '45', label: "NP", children: ['31', '32', '33', '44'], flabel: "ES"},
    {id: '46', label: "VP", children: ['30', '45'], flabel: "IV"},
    {id: '47', label: "NP", children: ['22', '23', '24'], flabel: "DT"},
    {id: '48', label: "NP", children: ['47', '25', '26'], flabel: "OO"},
    {id: '49', label: "PP", children: ['21', '48'], flabel: "AN"},
    {id: '50', label: "S", children: ['18', '65', '28', '29', '46'], flabel: "OO"},
    {id: '51', label: "SuP", children: ['17', '50'], flabel: "KL"},
    {id: '52', label: "NP", children: ['14', '15'], flabel: "OO"},
    {id: '53', label: "S", children: ['12', '62'], flabel: "OO"},
    {id: '54', label: "SuP", children: ['11', '53'], flabel: "KL"},
    {id: '55', label: "KoP", children: ['54', '16', '51'], flabel: "MD"},
    {id: '56', label: "NP", children: ['9', '10', '55'], flabel: "OO"},
    {id: '57', label: "PP", children: ['8', '56'], flabel: "MD"},
    {id: '58', label: "NP", children: ['6', '7', '57'], flabel: "OO"},
    {id: '59', label: "VP", children: ['4', '5', '58'], flabel: "IV"},
    {id: '60', label: "VP", children: ['3', '59'], flabel: "IV"},
    {id: '61', label: "S", children: ['0', '1', '2', '60']},
    {id: '62', label: "VP", children: ['64', '52'], flabel: "IV"},
    {id: '63', label: "NP", children: ['36', '42'], flabel: "MD"},
    {id: '64', label: "VBM", children: ['13'], flabel: "HD"},
    {id: '65', label: "AbP", children: ['19', '49'], flabel: "MD"}
  )

}


