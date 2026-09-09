/**
 * Enriched DOM stub for the headless control-contract tests (controls.*).
 *
 * Unlike dom-stub.mjs, which models only the surface the View/State/Service
 * engine needs, this stub additionally carries the surface the shipped WebUI
 * and WebApp controls touch when the real controller constructs them: a CSS
 * style declaration, a small CSS selector engine, an iterable attribute view,
 * geometry getters, a no-op canvas context, isConnected and the sibling/parent
 * navigation. It is kept separate so the lean engine tests are unaffected.
 *
 * It is not a browser and it is not jsdom.
 *
 * Elements created through createElementNS in the SVG namespace additionally
 * carry the geometry surface from controls.dom-stub.svg.mjs, because the graph
 * controls (and the workflow editor deriving from them) build their whole
 * interaction model on it.
 */

import { createSvgElementClass, SVG_NAMESPACE } from "./controls.dom-stub.svg.mjs";

class TextNode {
    constructor(text) {
        this.nodeType = 3;
        this.parentNode = null;
        this._text = String(text);
    }
    get nodeName() { return "#text"; }
    get textContent() { return this._text; }
    set textContent(value) { this._text = String(value); }
    get nodeValue() { return this._text; }
    set nodeValue(value) { this._text = String(value); }
    get data() { return this._text; }
    set data(value) { this._text = String(value); }
}

class ClassList {
    constructor(owner) { this._owner = owner; }
    add(...names) { names.forEach((n) => this._owner._classes.add(n)); }
    remove(...names) { names.forEach((n) => this._owner._classes.delete(n)); }
    contains(name) { return this._owner._classes.has(name); }
    toggle(name, force) {
        const has = this._owner._classes.has(name);
        const shouldHave = force === undefined ? !has : !!force;
        if (shouldHave) { this._owner._classes.add(name); } else { this._owner._classes.delete(name); }
        return shouldHave;
    }
}

/**
 * Minimal CSSStyleDeclaration stub. Properties may be set both directly
 * (style.width = "1px") and through setProperty, matching how controls mix
 * the two; getPropertyValue/removeProperty operate on the same storage.
 */
class Style {
    setProperty(name, value) { this[name] = value == null ? "" : String(value); }
    removeProperty(name) { const value = this[name]; delete this[name]; return value; }
    getPropertyValue(name) { return Object.prototype.hasOwnProperty.call(this, name) ? this[name] : ""; }
}

/**
 * Splits a selector list into groups of compound selectors. "a .b, c" becomes
 * [["a", ".b"], ["c"]]. Whitespace combinators are preserved as separate
 * compounds so callers can match the rightmost one.
 * @param {string} selector - The selector text.
 * @returns {string[][]} The parsed groups.
 */
function selectorGroups(selector) {
    return String(selector || "")
        .split(",")
        .map((part) => part.trim().split(/\s+/).filter(Boolean))
        .filter((group) => group.length > 0);
}

/**
 * Tests an element against a single compound selector such as
 * "div.active#id[data-x='y']" or "*".
 * @param {object} el - The candidate element.
 * @param {string} compound - The compound selector.
 * @returns {boolean} True when the element matches.
 */
function matchesCompound(el, compound) {
    if (!el || el.nodeType !== 1 || !compound) { return false; }
    if (compound === "*") { return true; }

    const idMatch = compound.match(/#([\w-]+)/);
    if (idMatch && el.id !== idMatch[1]) { return false; }

    const classMatches = compound.match(/\.([\w-]+)/g) || [];
    for (const cls of classMatches) {
        if (!el.classList.contains(cls.slice(1))) { return false; }
    }

    const attrRegex = /\[([\w-]+)(?:([~|^$*]?=)(["']?)(.*?)\3)?\]/g;
    let attr;
    while ((attr = attrRegex.exec(compound)) !== null) {
        const [, name, operator, , value] = attr;
        if (!el.hasAttribute(name)) { return false; }
        if (operator && el.getAttribute(name) !== value) { return false; }
    }

    // a type selector matches the local name; SVG keeps that name lower case,
    // HTML reports it upper case, so the comparison ignores case
    const tagMatch = compound.match(/^[\w-]+/);
    if (tagMatch && String(el.tagName).toUpperCase() !== tagMatch[0].toUpperCase()) { return false; }

    return true;
}

/**
 * Depth-first walk over the element descendants. The visitor may stop the walk
 * early by returning true.
 * @param {object} root - The subtree root (not visited itself).
 * @param {Function} visit - The visitor, returning true to stop.
 * @returns {boolean} True when the walk was stopped early.
 */
function descend(root, visit) {
    for (const child of root.childNodes) {
        if (child.nodeType === 1) {
            if (visit(child)) { return true; }
            if (descend(child, visit)) { return true; }
        }
    }
    return false;
}

class Element {
    constructor(tag) {
        this.nodeType = 1;
        this.tagName = String(tag).toUpperCase();
        this.childNodes = [];
        this.parentNode = null;
        this._attrs = new Map();
        this._classes = new Set();
        this._listeners = {};
        this._id = null;
        this.dataset = {};
        this.style = new Style();
        this.value = "";
        this.checked = false;
    }

    get nodeName() { return this.tagName; }

    get id() { return this._id; }
    set id(value) { this._id = value == null ? null : String(value); }

    get className() { return Array.from(this._classes).join(" "); }
    set className(value) { this._classes = new Set(String(value || "").split(/\s+/).filter(Boolean)); }

    get classList() { return new ClassList(this); }

    // url-valued properties reflect their content attribute, the way an anchor
    // or an image does in the browser. A control that writes the property and
    // reads the attribute back - which is how a link target is authored and how
    // it is resolved again - would otherwise lose the value in between.
    get href() { return this.getAttribute("href"); }
    set href(value) { this.setAttribute("href", value); }

    get src() { return this.getAttribute("src"); }
    set src(value) { this.setAttribute("src", value); }

    get children() { return this.childNodes.filter((n) => n.nodeType === 1); }

    get innerText() { return this.textContent; }
    set innerText(value) { this.textContent = value; }

    /**
     * An element is connected when its ancestor chain reaches the document
     * body, which the stub marks as the root.
     */
    get isConnected() {
        let current = this;
        while (current) {
            if (current._isRoot) { return true; }
            current = current.parentNode;
        }
        return false;
    }

    appendChild(node) {
        // a fragment is a transport, not a node: inserting it moves its
        // children, which is what the batched renderers of the controls rely on
        if (node.nodeType === 11) {
            for (const child of node.childNodes.slice()) { this.appendChild(child); }
            return node;
        }
        if (node.parentNode) { node.parentNode.removeChild(node); }
        this.childNodes.push(node);
        node.parentNode = this;
        return node;
    }

    insertBefore(node, reference) {
        if (node.nodeType === 11) {
            for (const child of node.childNodes.slice()) { this.insertBefore(child, reference); }
            return node;
        }
        if (node.parentNode) { node.parentNode.removeChild(node); }
        if (reference == null) {
            this.childNodes.push(node);
            node.parentNode = this;
            return node;
        }
        const index = this.childNodes.indexOf(reference);
        if (index === -1) { this.childNodes.push(node); } else { this.childNodes.splice(index, 0, node); }
        node.parentNode = this;
        return node;
    }

    prepend(...nodes) {
        const reference = this.childNodes[0] || null;
        for (const node of nodes) {
            this.insertBefore(typeof node === "string" ? new TextNode(node) : node, reference);
        }
    }

    removeChild(node) {
        const index = this.childNodes.indexOf(node);
        if (index !== -1) { this.childNodes.splice(index, 1); }
        node.parentNode = null;
        return node;
    }

    replaceChild(newNode, oldNode) {
        if (newNode.parentNode) { newNode.parentNode.removeChild(newNode); }
        const index = this.childNodes.indexOf(oldNode);
        if (index !== -1) {
            this.childNodes.splice(index, 1, newNode);
            newNode.parentNode = this;
            oldNode.parentNode = null;
        }
        return oldNode;
    }

    setAttribute(name, value) {
        if (name === "id") { this._id = String(value); return; }
        // the browser reflects the class content attribute into classList, which
        // is how an SVG element (whose className is not string-assignable) still
        // becomes selectable by class
        if (name === "class") { this.className = String(value); return; }
        this._attrs.set(name, String(value));
    }
    getAttribute(name) {
        if (name === "id") { return this._id; }
        // always the serialized attribute value; an SVG element exposes
        // className as an SVGAnimatedString, which getAttribute must not leak
        if (name === "class") { return Array.from(this._classes).join(" "); }
        return this._attrs.has(name) ? this._attrs.get(name) : null;
    }
    hasAttribute(name) {
        if (name === "id") { return this._id != null; }
        if (name === "class") { return this._classes.size > 0; }
        return this._attrs.has(name);
    }
    removeAttribute(name) {
        if (name === "id") { this._id = null; return; }
        if (name === "class") { this._classes.clear(); return; }
        this._attrs.delete(name);
    }

    /**
     * Tests the element against a comma separated selector list. Only simple
     * compound selectors are supported (tag, #id, .class, [attr], [attr=value]
     * and *); combinators are matched loosely by their rightmost compound,
     * which is sufficient for the lookups controls perform.
     */
    matches(selector) {
        return selectorGroups(selector).some((group) => matchesCompound(this, group[group.length - 1]));
    }

    closest(selector) {
        let current = this;
        while (current && current.nodeType === 1) {
            if (current.matches(selector)) { return current; }
            current = current.parentNode;
        }
        return null;
    }

    querySelector(selector) {
        const groups = selectorGroups(selector);
        let found = null;
        descend(this, (node) => {
            if (groups.some((group) => matchesCompound(node, group[group.length - 1]))) {
                found = node;
                return true;
            }
            return false;
        });
        return found;
    }

    querySelectorAll(selector) {
        const groups = selectorGroups(selector);
        const result = [];
        descend(this, (node) => {
            if (groups.some((group) => matchesCompound(node, group[group.length - 1]))) {
                result.push(node);
            }
            return false;
        });
        return result;
    }

    get textContent() {
        return this.childNodes.map((n) => (n.nodeType === 3 ? n._text : n.textContent)).join("");
    }
    set textContent(value) {
        this.childNodes.forEach((n) => { n.parentNode = null; });
        this.childNodes = [];
        if (value != null && value !== "") { this.appendChild(new TextNode(String(value))); }
    }

    /**
     * The stub does not parse or serialize markup; innerHTML exposes only the
     * concatenated text of the descendants, which is enough for the emptiness
     * checks controls run, and assigning clears the children.
     */
    get innerHTML() {
        return this.childNodes.map((n) => (n.nodeType === 3 ? n._text : n.textContent)).join("");
    }
    set innerHTML(value) {
        this.childNodes.forEach((n) => { n.parentNode = null; });
        this.childNodes = [];
        if (value != null && value !== "") { this.appendChild(new TextNode(String(value))); }
    }

    addEventListener(type, handler) {
        (this._listeners[type] || (this._listeners[type] = new Set())).add(handler);
    }
    removeEventListener(type, handler) {
        if (this._listeners[type]) { this._listeners[type].delete(handler); }
    }
    dispatchEvent(event) {
        if (event && event.target == null) { event.target = this; }
        // handlers routinely suppress the default action or the bubbling; the
        // stub dispatches directly, so it only has to record the intent - but the
        // methods have to exist, because a real event always carries them
        if (event && typeof event.preventDefault !== "function") {
            event.defaultPrevented = false;
            event.preventDefault = () => { event.defaultPrevented = true; };
        }
        if (event && typeof event.stopPropagation !== "function") {
            event.stopPropagation = () => { };
        }
        const set = this._listeners[event.type];
        if (set) { Array.from(set).forEach((fn) => fn(event)); }
        return true;
    }

    /**
     * The parent element, or null when the parent is the document or absent.
     * The body stub marks itself as the root and has no element parent.
     */
    get parentElement() {
        return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null;
    }

    get firstChild() { return this.childNodes[0] || null; }
    get lastChild() { return this.childNodes[this.childNodes.length - 1] || null; }
    get firstElementChild() { return this.children[0] || null; }
    get lastElementChild() { const c = this.children; return c[c.length - 1] || null; }

    get nextSibling() {
        if (!this.parentNode) { return null; }
        const siblings = this.parentNode.childNodes;
        return siblings[siblings.indexOf(this) + 1] || null;
    }
    get previousSibling() {
        if (!this.parentNode) { return null; }
        const siblings = this.parentNode.childNodes;
        return siblings[siblings.indexOf(this) - 1] || null;
    }
    get nextElementSibling() {
        let sibling = this.nextSibling;
        while (sibling && sibling.nodeType !== 1) { sibling = sibling.nextSibling; }
        return sibling || null;
    }

    /**
     * An array-like, iterable view of the attributes, matching how controls
     * spread or iterate element.attributes.
     */
    get attributes() {
        const list = [];
        if (this._id != null) { list.push({ name: "id", value: this._id }); }
        if (this._classes.size) { list.push({ name: "class", value: this.className }); }
        for (const [name, value] of this._attrs) { list.push({ name, value }); }
        return list;
    }

    hasChildNodes() { return this.childNodes.length > 0; }

    append(...nodes) {
        for (const node of nodes) {
            this.appendChild(typeof node === "string" ? new TextNode(node) : node);
        }
    }

    replaceChildren(...nodes) {
        this.childNodes.forEach((n) => { n.parentNode = null; });
        this.childNodes = [];
        this.append(...nodes);
    }

    replaceWith(...nodes) {
        if (!this.parentNode) { return; }
        for (const node of nodes) {
            this.parentNode.insertBefore(typeof node === "string" ? new TextNode(node) : node, this);
        }
        this.parentNode.removeChild(this);
    }

    remove() {
        if (this.parentNode) { this.parentNode.removeChild(this); }
    }

    insertAdjacentElement(position, element) {
        if (position === "beforebegin" && this.parentNode) { this.parentNode.insertBefore(element, this); }
        else if (position === "afterbegin") { this.insertBefore(element, this.childNodes[0] || null); }
        else if (position === "beforeend") { this.appendChild(element); }
        else if (position === "afterend" && this.parentNode) { this.parentNode.insertBefore(element, this.nextSibling); }
        return element;
    }
    insertAdjacentHTML() { /* parsing markup is out of scope for the stub */ }

    contains(node) {
        let current = node;
        while (current) {
            if (current === this) { return true; }
            current = current.parentNode;
        }
        return false;
    }

    cloneNode(deep) {
        // the concrete class carries behaviour (an SVG element clones to an SVG
        // element), so the copy is built from the same constructor
        const copy = new this.constructor(this.tagName);
        copy._id = this._id;
        copy._classes = new Set(this._classes);
        copy._attrs = new Map(this._attrs);
        copy.dataset = { ...this.dataset };
        copy.value = this.value;
        copy.checked = this.checked;
        copy._rect = this._rect;
        if (deep) {
            for (const child of this.childNodes) {
                copy.appendChild(child.nodeType === 3 ? new TextNode(child._text) : child.cloneNode(true));
            }
        }
        return copy;
    }

    focus() { }
    blur() { }
    // a synthesized click carries the members a handler expects of a real event; a bare
    // { type } would trip over the preventDefault that every link handler calls
    click() {
        this.dispatchEvent({
            type: "click",
            target: this,
            defaultPrevented: false,
            preventDefault() { this.defaultPrevented = true; },
            stopPropagation() { }
        });
    }
    scrollIntoView() { }
    scroll() { }
    scrollTo() { }

    // pointer capture is a routing detail of the real event system; the stub
    // dispatches directly, so capturing is recorded but has no further effect
    setPointerCapture(pointerId) { this._capturedPointer = pointerId; }
    releasePointerCapture() { this._capturedPointer = null; }
    hasPointerCapture(pointerId) { return this._capturedPointer === pointerId; }

    get offsetWidth() { return 0; }
    get offsetHeight() { return 0; }
    get clientWidth() { return 0; }
    get clientHeight() { return 0; }
    get scrollWidth() { return 0; }
    get scrollHeight() { return 0; }
    get offsetParent() { return this.parentElement; }

    /**
     * The stub has no layout, so every box is empty unless a test assigns one
     * through _rect. Controls that lay themselves out against the host size
     * (the graph viewport is the prominent one) need a non-empty box to do
     * anything observable at all.
     */
    getBoundingClientRect() {
        const rect = this._rect || {};
        const left = rect.left !== undefined ? rect.left : (rect.x || 0);
        const top = rect.top !== undefined ? rect.top : (rect.y || 0);
        const width = rect.width || 0;
        const height = rect.height || 0;
        return { x: left, y: top, top, left, right: left + width, bottom: top + height, width, height };
    }

    /**
     * Returns a no-op 2D drawing context for canvas elements; every method is a
     * no-op and measureText reports a zero width, which is enough to let canvas
     * based controls initialize headlessly.
     */
    getContext() {
        return new Proxy({}, {
            get(_target, property) {
                if (property === "measureText") { return () => ({ width: 0 }); }
                if (property === "getImageData") { return () => ({ data: [], width: 0, height: 0 }); }
                if (property === "createLinearGradient" || property === "createRadialGradient") {
                    return () => ({ addColorStop() { } });
                }
                return () => { };
            },
            set() { return true; }
        });
    }
}

const SvgElement = createSvgElementClass(Element);

/**
 * Finds an element with the given id in a subtree.
 * @param {Element} node - The subtree root.
 * @param {string} id - The id to find.
 * @returns {Element|null} The element or null.
 */
function findById(node, id) {
    if (node.nodeType === 1 && node.id === id) {
        return node;
    }
    for (const child of node.childNodes || []) {
        const found = findById(child, id);
        if (found) {
            return found;
        }
    }
    return null;
}

/**
 * Creates a fresh document stub for the control-contract tests.
 * @returns {object} The document stub.
 */
export function createDocument() {
    const body = new Element("body");
    body._isRoot = true;
    const documentElement = new Element("html");
    const head = new Element("head");
    documentElement._isRoot = true;
    documentElement.appendChild(head);
    documentElement.appendChild(body);
    const listeners = {};

    return {
        baseURI: "http://localhost/",
        readyState: "complete",
        cookie: "",
        body,
        head,
        documentElement,
        activeElement: body,
        defaultView: null,
        createElement(tag) { return new Element(tag); },
        createElementNS(namespace, tag) {
            return namespace === SVG_NAMESPACE ? new SvgElement(tag) : new Element(tag);
        },
        createDocumentFragment() {
            const fragment = new Element("#document-fragment");
            fragment.nodeType = 11;
            return fragment;
        },
        createTextNode(text) { return new TextNode(text); },
        getElementById(id) { return findById(body, String(id)); },
        getElementsByClassName(name) { return documentElement.querySelectorAll("." + name); },
        getElementsByTagName(tag) { return documentElement.querySelectorAll(String(tag)); },
        querySelector(selector) { return documentElement.querySelector(selector); },
        querySelectorAll(selector) { return documentElement.querySelectorAll(selector); },
        addEventListener(type, handler) {
            (listeners[type] || (listeners[type] = new Set())).add(handler);
        },
        removeEventListener(type, handler) {
            if (listeners[type]) { listeners[type].delete(handler); }
        },
        dispatchEvent(event) {
            const set = listeners[event.type];
            if (set) { Array.from(set).forEach((fn) => fn(event)); }
            return true;
        }
    };
}

export { Element, SvgElement, TextNode };
