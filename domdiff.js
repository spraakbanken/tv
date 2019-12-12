function template_to_string(value, ...more) {
  if (typeof value == 'string') {
    return value
  }
  return value.map((s, i) => s + (more[i] === undefined ? '' : more[i])).join('')
}

function forward(f, g) {
  return (...args) => g(f(...args))
}

export function Tag(name, children) {
  const next_attrs = {}
  const next_handlers = {}
  children = children.filter(function filter_child(child) {
    if (!child) return false
    const type = typeof child
    if (type == 'object' && child.attr) {
      const {attr, value} = child
      if (attr in next_attrs) {
        next_attrs[attr] += ' ' + value
      } else {
        next_attrs[attr] = value
      }
      return false
    } else if (type == 'object' && child.handler) {
      const {handler, value} = child
      if (handler in next_handlers) {
        next_handlers[handler].push(value)
      } else {
        next_handlers[handler] = [value]
      }
      return false
    } else if (child && type != 'string' && type != 'function') {
      throw new Error('Child needs to be false, string, function or DOM Element')
    }
    return child
  })

  return function morph(elem, ns) {
    if (name == 'svg') {
      ns = 'http://www.w3.org/2000/svg'
    }
    if (!elem || elem.tagName != name.toUpperCase()) {
      if (ns) {
        elem = document.createElementNS(ns, name)
      } else {
        elem = document.createElement(name)
      }
    }
    for (const attr of [...elem.attributes]) {
      if (!next_attrs[attr.name]) {
        elem.removeAttribute(attr.name)
      }
    }
    for (const attr in next_attrs) {
      const now = elem.getAttribute(attr) || ''
      const next = next_attrs[attr] || ''
      if (now != next && next) {
        elem.setAttribute(attr, next)
      }
    }
    if (elem.handlers === undefined) {
      elem.handlers = {}
    }
    for (const type in elem.handlers) {
      if (!next_handlers[type]) {
        elem.handlers[type] = undefined
        elem['on' + type] = undefined
      }
    }
    for (const type in next_handlers) {
      if (!elem.handlers[type]) {
        elem['on' + type] = e => e.currentTarget.handlers[type].forEach(h => h(e))
      }
      elem.handlers[type] = next_handlers[type]
    }
    while (elem.childNodes.length > children.length) {
      elem.removeChild(elem.lastChild)
    }
    for (let i = 0; i < children.length; ++i) {
      const child = children[i]
      if (i < elem.childNodes.length) {
        const prev = elem.childNodes[i]
        let next = child
        if (typeof child == 'function') {
          next = child(prev, ns)
        } else if (typeof child == 'string') {
          if (prev instanceof Text && prev.textContent == child) {
            next = prev
          } else {
            next = document.createTextNode(child)
          }
        }
        if (prev !== next) {
          elem.replaceChild(next, prev)
        }
      } else {
        elem.append(typeof child == 'function' ? child(null, ns) : child)
      }
    }
    return elem
  }
}

export const MakeTag = name => (...children) => Tag(name, children)
export const div = MakeTag('div')
export const pre = MakeTag('pre')
export const code = MakeTag('code')
export const span = MakeTag('span')
export const body = MakeTag('body')
export const head = MakeTag('head')
export const html = MakeTag('html')

export const h1 = MakeTag('h1')
export const h2 = MakeTag('h2')
export const h3 = MakeTag('h3')
export const h4 = MakeTag('h4')
export const h5 = MakeTag('h5')
export const h6 = MakeTag('h6')
export const h7 = MakeTag('h7')

export const table = MakeTag('table')
export const tbody = MakeTag('tbody')
export const thead = MakeTag('thead')
export const tfoot = MakeTag('tfoot')
export const tr = MakeTag('tr')
export const td = MakeTag('td')
export const th = MakeTag('th')

export const a = MakeTag('a')

export const MakeAttr = attr => forward(template_to_string, value => ({attr, value}))

export const style = MakeAttr('style')
export const cls = MakeAttr('class')
export const id = MakeAttr('id')
export const href = MakeAttr('href')

export const Handler = handler => value => ({handler, value})

export const mousemove  = Handler('mousemove')
export const mouseover  = Handler('mouseover')
export const mousedown  = Handler('mousedown')
export const mouseup    = Handler('mouseup')
export const mousewheel = Handler('mousewheel')
export const scroll     = Handler('scroll')
export const click      = Handler('click')

export function make_class_cache(class_prefix='c') {
  const generated = new Map()
  const lines = []

  function generate_class(key, gen_code) {
    if (!generated.has(key)) {
      const code = gen_code().trim().replace(/\n\s*/g, '\n').replace(/[:{;]\s*/g, g => g[0])
      const name = class_prefix + generated.size
      generated.set(key, name)
      if (-1 == code.search('{')) {
        lines.push(`.${name} {${code}}\n`)
      } else {
        lines.push(code.replace(/&/g, _ => `.${name}`) + '\n')
      }
    }
    return {attr: 'class', value: generated.get(key)}
  }

  const css = forward(template_to_string, s => generate_class(s, () => s))

  return {sheet: () => Tag('style', lines), css, generate_class}
}

const caches = {}
export function class_cache(class_prefix='c') {
  if (!caches[class_prefix]) {
    caches[class_prefix] = make_class_cache(class_prefix)
  }
  return caches[class_prefix]
}

function test_domdiff() {
  const tests = [
    div(cls`boo`, pre(id`heh`, 'hello')),
    div(cls`foo`, 'hello', h1('heh')),
    div(cls`foo`, 'hello', h2('heh')),
    div(cls`foo`, 'hello', h2('meh')),
    div(style`background: black`, 'hello'),
    span(),
    span(false),
    span(null),
    span(undefined),
    span(click(e => 1)),
    span(scroll(e => 3), click(e => 1)),
    span('apa'),
    span(cls`a`),
    span(cls`b`),
    span(div('apa')),
    span(h1('a'), h2('b')),
    span(h1('a'), h3('b')),
    span(h2('a'), h3('b')),
    span(h2('a'), 'zoo', h3('b')),
    span(h2('a'), 'zoo', h3('b')),
    span(h2('a'), 'zoo', h3('boo')),
    span(cls`z`, id`g`, h2('a'), 'zoo', h3('b')),
    span(cls`z`, style`color: red`, id`g`),
    span(style`color: red`, id`g`),
    span(style`color: red`, id`g`, cls`z`),
  ]

  function equal(doms) {
    const htmls = {}
    Object.keys(doms).forEach(k1 => {
      Object.keys(doms).forEach(k2 => {
        if (k1 < k2) {
          const doms1 = doms[k1]
          const doms2 = doms[k2]
          const html1 = doms[k1].outerHTML
          const html2 = doms[k2].outerHTML
          console.assert(doms1.isEqualNode(doms2), {[k1]: html1, [k2]: html2})
        }
      })
    })
  }

  tests.forEach((a, i) => {
    equal({
      scratch: a(),
      idem: a(a()),
    })
    tests.forEach((b, i) => {
      equal({
        scratch: a(),
        btoa: a(b()),
      })
    })
  })
}

console.time('test domdiff')
test_domdiff()
console.timeEnd('test domdiff')

