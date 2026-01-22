/**
 * DOM Parser polyfill for Service Worker environment.
 * Uses cheerio to parse HTML and provides a minimal DOM-like interface
 * compatible with dictionary engines.
 */

import * as cheerio from 'cheerio'

// classList-like interface for DOM compatibility
interface DOMClassList {
  add(...tokens: string[]): void
  remove(...tokens: string[]): void
  contains(token: string): boolean
  toggle(token: string, force?: boolean): boolean
}

// Type for our DOM-like wrapper
interface DOMElement {
  tagName: string
  textContent: string
  innerHTML: string
  outerHTML: string
  className: string
  classList: DOMClassList
  id: string
  dataset: Record<string, string | undefined>
  parentNode: DOMElement | null
  parentElement: DOMElement | null
  nextSibling: DOMElement | null
  previousSibling: DOMElement | null
  firstChild: DOMElement | null
  lastChild: DOMElement | null
  childNodes: DOMElement[]
  children: DOMElement[]
  getAttribute(name: string): string | null
  setAttribute(name: string, value: string): void
  removeAttribute(name: string): void
  querySelector(selector: string): DOMElement | null
  querySelectorAll(selector: string): DOMElement[]
  getElementsByTagName(tagName: string): DOMElement[]
  getElementsByClassName(className: string): DOMElement[]
  replaceWith(...nodes: (DOMElement | string)[]): void
  remove(): void
  cloneNode(deep?: boolean): DOMElement
  appendChild(child: DOMElement): DOMElement
  removeChild(child: DOMElement): DOMElement
  contains(node: DOMElement): boolean
  closest(selector: string): DOMElement | null
}

interface DOMDocument {
  querySelector(selector: string): DOMElement | null
  querySelectorAll(selector: string): DOMElement[]
  getElementsByTagName(tagName: string): DOMElement[]
  getElementsByClassName(className: string): DOMElement[]
  getElementById(id: string): DOMElement | null
  createElement(tagName: string): DOMElement
  createTextNode(text: string): DOMElement
  body: DOMElement | null
  documentElement: DOMElement | null
}

type CheerioAPI = ReturnType<typeof cheerio.load>

/**
 * Wraps a cheerio element with a DOM-like interface
 */
function wrapElement($: CheerioAPI, el: cheerio.Element): DOMElement {
  const $el = $(el)

  // Parse data-* attributes into dataset object
  const dataset: Record<string, string | undefined> = {}
  const attribs = (el as cheerio.TagElement).attribs || {}
  Object.keys(attribs).forEach(key => {
    if (key.startsWith('data-')) {
      // Convert data-some-attr to someAttr
      const propName = key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
      dataset[propName] = attribs[key]
    }
  })

  // Store outerHTML value for setter support
  let _outerHTML = $.html(el) || ''

  const wrapper: DOMElement = {
    get tagName() {
      return (el as cheerio.TagElement).tagName?.toUpperCase() || ''
    },
    get textContent() {
      return $el.text() || ''
    },
    set textContent(value: string) {
      $el.text(value)
    },
    get innerHTML() {
      return $el.html() || ''
    },
    set innerHTML(value: string) {
      $el.html(value)
    },
    get outerHTML() {
      return $.html(el) || ''
    },
    set outerHTML(value: string) {
      // Replace the element with new HTML
      $el.replaceWith(value)
      _outerHTML = value
    },
    get className() {
      return $el.attr('class') || ''
    },
    set className(value: string) {
      $el.attr('class', value)
    },
    get classList(): DOMClassList {
      return {
        add: (...tokens: string[]) => {
          const classes = new Set(($el.attr('class') || '').split(/\s+/).filter(Boolean))
          tokens.forEach(t => classes.add(t))
          $el.attr('class', Array.from(classes).join(' '))
        },
        remove: (...tokens: string[]) => {
          const classes = new Set(($el.attr('class') || '').split(/\s+/).filter(Boolean))
          tokens.forEach(t => classes.delete(t))
          $el.attr('class', Array.from(classes).join(' '))
        },
        contains: (token: string): boolean => {
          return ($el.attr('class') || '').split(/\s+/).includes(token)
        },
        toggle: (token: string, force?: boolean): boolean => {
          const currentClasses = ($el.attr('class') || '').split(/\s+/).filter(Boolean)
          const has = currentClasses.includes(token)
          if (force === undefined) {
            if (has) {
              $el.attr('class', currentClasses.filter(c => c !== token).join(' '))
              return false
            } else {
              $el.attr('class', [...currentClasses, token].join(' '))
              return true
            }
          }
          if (force) {
            if (!has) {
              $el.attr('class', [...currentClasses, token].join(' '))
            }
            return true
          } else {
            $el.attr('class', currentClasses.filter(c => c !== token).join(' '))
            return false
          }
        }
      }
    },
    get id() {
      return $el.attr('id') || ''
    },
    set id(value: string) {
      $el.attr('id', value)
    },
    get dataset() {
      return dataset
    },
    get parentNode() {
      const parent = $el.parent()
      if (parent.length === 0) return null
      return wrapElement($, parent[0])
    },
    get parentElement() {
      const parent = $el.parent()
      if (parent.length === 0) return null
      return wrapElement($, parent[0])
    },
    get nextSibling() {
      const next = $el.next()
      if (next.length === 0) return null
      return wrapElement($, next[0])
    },
    get previousSibling() {
      const prev = $el.prev()
      if (prev.length === 0) return null
      return wrapElement($, prev[0])
    },
    get firstChild() {
      const first = $el.children().first()
      if (first.length === 0) return null
      return wrapElement($, first[0])
    },
    get lastChild() {
      const last = $el.children().last()
      if (last.length === 0) return null
      return wrapElement($, last[0])
    },
    get childNodes() {
      const results: DOMElement[] = []
      $el.contents().each((_, elem) => {
        results.push(wrapElement($, elem))
      })
      return results
    },
    get children() {
      const results: DOMElement[] = []
      $el.children().each((_, elem) => {
        results.push(wrapElement($, elem))
      })
      return results
    },
    getAttribute(name: string) {
      return $el.attr(name) ?? null
    },
    setAttribute(name: string, value: string) {
      $el.attr(name, value)
    },
    removeAttribute(name: string) {
      $el.removeAttr(name)
    },
    querySelector(selector: string): DOMElement | null {
      const found = $el.find(selector).first()
      if (found.length === 0) return null
      return wrapElement($, found[0])
    },
    querySelectorAll(selector: string): DOMElement[] {
      const results: DOMElement[] = []
      $el.find(selector).each((_, elem) => {
        if (elem && (elem as cheerio.TagElement).tagName) {
          results.push(wrapElement($, elem))
        }
      })
      return results
    },
    getElementsByTagName(tagName: string): DOMElement[] {
      const results: DOMElement[] = []
      $el.find(tagName).each((_, elem) => {
        results.push(wrapElement($, elem))
      })
      return results
    },
    getElementsByClassName(className: string): DOMElement[] {
      const results: DOMElement[] = []
      $el.find('.' + className.split(' ').join('.')).each((_, elem) => {
        results.push(wrapElement($, elem))
      })
      return results
    },
    replaceWith(...nodes: (DOMElement | string)[]) {
      const html = nodes.map(n => typeof n === 'string' ? n : n.outerHTML).join('')
      $el.replaceWith(html)
    },
    remove() {
      $el.remove()
    },
    cloneNode(deep = true): DOMElement {
      const cloned = $el.clone()
      return wrapElement($, cloned[0])
    },
    appendChild(child: DOMElement): DOMElement {
      $el.append(child.outerHTML)
      return child
    },
    removeChild(child: DOMElement): DOMElement {
      $el.find(child.tagName).filter((_, el) => $(el).html() === child.innerHTML).first().remove()
      return child
    },
    contains(node: DOMElement): boolean {
      return $el.find('*').filter((_, el) => $(el).html() === node.innerHTML).length > 0
    },
    closest(selector: string): DOMElement | null {
      const found = $el.closest(selector)
      if (found.length === 0) return null
      return wrapElement($, found[0])
    }
  }

  return wrapper
}

/**
 * Wraps cheerio instance with a DOM-like document interface
 */
function wrapDocument($: CheerioAPI): DOMDocument {
  return {
    querySelector(selector: string): DOMElement | null {
      const found = $(selector).first()
      if (found.length === 0) return null
      return wrapElement($, found[0])
    },
    querySelectorAll(selector: string): DOMElement[] {
      const results: DOMElement[] = []
      $(selector).each((_, elem) => {
        if (elem && (elem as cheerio.TagElement).tagName) {
          results.push(wrapElement($, elem))
        }
      })
      return results
    },
    getElementsByTagName(tagName: string): DOMElement[] {
      const results: DOMElement[] = []
      $(tagName).each((_, elem) => {
        if (elem && (elem as cheerio.TagElement).tagName) {
          results.push(wrapElement($, elem))
        }
      })
      return results
    },
    getElementsByClassName(className: string): DOMElement[] {
      const results: DOMElement[] = []
      $('.' + className.split(' ').join('.')).each((_, elem) => {
        if (elem && (elem as cheerio.TagElement).tagName) {
          results.push(wrapElement($, elem))
        }
      })
      return results
    },
    getElementById(id: string): DOMElement | null {
      const found = $('#' + id).first()
      if (found.length === 0) return null
      return wrapElement($, found[0])
    },
    createElement(tagName: string): DOMElement {
      // Create a new element using cheerio
      const newEl = $(`<${tagName}></${tagName}>`)[0]
      return wrapElement($, newEl)
    },
    createTextNode(text: string): DOMElement {
      // Create a text node - cheerio doesn't have true text nodes,
      // so we create a wrapper that behaves like one
      const noopClassList: DOMClassList = {
        add: () => {},
        remove: () => {},
        contains: () => false,
        toggle: () => false
      }
      const textNode = {
        tagName: '',
        textContent: text,
        innerHTML: text,
        outerHTML: text,
        className: '',
        classList: noopClassList,
        id: '',
        dataset: {},
        parentNode: null,
        parentElement: null,
        nextSibling: null,
        previousSibling: null,
        firstChild: null,
        lastChild: null,
        childNodes: [],
        children: [],
        getAttribute: () => null,
        setAttribute: () => {},
        removeAttribute: () => {},
        querySelector: () => null,
        querySelectorAll: () => [],
        getElementsByTagName: () => [],
        getElementsByClassName: () => [],
        replaceWith: () => {},
        remove: () => {},
        cloneNode: () => textNode,
        appendChild: () => textNode,
        removeChild: () => textNode,
        contains: () => false,
        closest: () => null
      } as DOMElement
      return textNode
    },
    get body() {
      const found = $('body').first()
      if (found.length === 0) return null
      return wrapElement($, found[0])
    },
    get documentElement() {
      const found = $('html').first()
      if (found.length === 0) {
        // Return root element if no html tag
        const root = $.root().children().first()
        if (root.length === 0) return null
        return wrapElement($, root[0])
      }
      return wrapElement($, found[0])
    }
  }
}

/**
 * Parse HTML string to a DOM-like document.
 * Works in Service Worker environment without native DOM APIs.
 */
export function parseHTMLToDocument(html: string): DOMDocument {
  const $ = cheerio.load(html)
  return wrapDocument($)
}
