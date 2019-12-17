# tv: tree visualiser

This library draws syntax trees in the browser using SVG. It has support for:
* categorical labels
* functional labels
* discontinuous constituencies
* secondary edges
* reading the Tiger-XML format used in the Koala korpus Eukalyptus.

A live version is running on http://demo.spraakdata.gu.se/dan/koala/

## Installing locally

Install the dependencies by running:

```
yarn
```

## Running locally

Bundling the typescript code is done with parcel:

```
yarn run serve
```

Hot module reloading is enabled and sentences from `examples.ts` can be viewed by tacking on `#examples` to the url.

## Deploying

There is as script to build and deploy at Språkbanken's demo server:

```
yarn run deploy
```

# API

The main export is `draw_tree` in `trees.ts`. It takes a specification
in the internal format outlined below and returns a function
`() => Element` which when run produces a DOM Element Node to be
attached into the document. As a side effect it will add a `<style>`
node into `<head>`.

# Layouting strategy

The trees are layouted in `trees.ts`. It is built bottom up:
starting with placing all the terminals as blocks in a row,
then letting blocks merge when they are connected by a phrase.
This can make the blocks wider: the categorical label is wide
or when there are functional labels for the secondary edges.
Disconnected phrases are not merged until something is placed
above them. Calculating the x-positions of the horizontal lines is
postponed to just before the last step of routing the secondary edges.

There are two choices when positioning discontinuous phrases:

1. The side the categorical label is positioned. By default it takes the section which
has a HD label and if there is none it picks the widest.
2. The order they are positioned. They are then placed in the order
they are in the input representation (and thus in the XML if it comes from there).

Secondary edges are routed using Euclidean shortest path.  The implementation
is not optimised, it is cubic in the number on non-terminals and is rerun
for each edge.  The path is interpolated using a uniform catmull-rom spline,
this could be improved to use a centripetal if one could find a sensible
javascript implementation of that.

# Internal format

The typescript types are in `trees.ts`. Here is an example:

![example](https://raw.githubusercontent.com/spraakbanken/tv/master/example_efterlangtat.png)

```javascript
[
  {"id": "0", "label": "-"},
  {"id": "1", "label": "Det", "flabel": "ME"},
  {"id": "2", "label": "här", "flabel": "ME"},
  {"id": "3", "label": "har", "flabel": "HD"},
  {"id": "4", "label": "varit", "flabel": "HD"},
  {"id": "5", "label": "ett", "flabel": "DT"},
  {"id": "6", "label": "efterlängtat", "flabel": "MD"},
  {"id": "7", "label": "beslut", "flabel": "HD"},
  {"id": "8", "label": "."},
  {
    "id": "9",
    "label": "POM",
    "children": ["1", "2"],
    "flabel": "SB"
  },
  {
    "id": "10",
    "label": "NP",
    "children": ["5", "6", "7"],
    "flabel": "SP"
  },
  {
    "id": "11",
    "label": "VP",
    "children": ["4", "10"],
    "secondary": [{"id": "9", "label": "SB"}],
    "flabel": "IV"
  },
  {
    "id": "12",
    "label": "S",
    "children": ["9", "3", "11"]
  }
]
```

The tiger xml is converted to this format in `parse_koala.ts`.

The entries are topologically sorted so that children are placed
before their parents. The sorting makes no unnecessary reorderings.

# License

MIT
