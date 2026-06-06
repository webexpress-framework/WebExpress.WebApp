/**
 * Minimal DOM stub for the headless engine tests.
 *
 * It implements only the surface that the View, State and Service engine uses,
 * which is element creation, child node manipulation, attributes, class list,
 * dataset, a simple style object, text content and event listeners. It is not
 * a browser and it is not jsdom. It exists so that the renderer and the
 * component can be exercised in Node without a browser.
 */

class TextNode {
    constructor(text) {
        this.nodeType = 3;
        this.parentNode = null;
        this._text = String(text);
    }
    get textContent() { return this._text; }
    set textContent(value) { this._text = String(value); }
    get nodeValue() { return this._text; }
    set nodeValue(value) { this._text = String(value); }
}

class ClassList {
    constructor(owner) { this._owner = owner; }
    add(name) { this._owner._classes.add(name); }
    remove(name) { this._owner._classes.delete(name); }
    contains(name) { return this._owner._classes.has(name); }
    toggle(name, force) {
        const has = this._owner._classes.has(name);
        const shouldHave = force === undefined ? !has : !!force;
        if (shouldHave) { this._owner._classes.add(name); } else { this._owner._classes.delete(name); }
        return shouldHave;
    }
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
        this._innerHTML = undefined;
        this.dataset = {};
        this.style = makeStyle();
        this.value = "";
        this.checked = false;
    }

    get firstChild() { return this.childNodes[0] || null; }

    get id() { return this._id; }
    set id(value) { this._id = value == null ? null : String(value); }

    get className() { return Array.from(this._classes).join(" "); }
    set className(value) { this._classes = new Set(String(value || "").split(/\s+/).filter(Boolean)); }

    get classList() { return new ClassList(this); }

    appendChild(node) {
        if (node.parentNode) { node.parentNode.removeChild(node); }
        this.childNodes.push(node);
        node.parentNode = this;
        return node;
    }

    insertBefore(node, reference) {
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

    removeChild(node) {
        const index = this.childNodes.indexOf(node);
        if (index !== -1) { this.childNodes.splice(index, 1); }
        node.parentNode = null;
        return node;
    }

    replaceChildren(...nodes) {
        this.childNodes.forEach((n) => { n.parentNode = null; });
        this.childNodes = [];
        for (const node of nodes) { this.appendChild(node); }
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
        this._attrs.set(name, String(value));
    }
    getAttribute(name) {
        if (name === "id") { return this._id; }
        if (name === "class") { return this.className; }
        return this._attrs.has(name) ? this._attrs.get(name) : null;
    }
    hasAttribute(name) {
        if (name === "id") { return this._id != null; }
        return this._attrs.has(name);
    }
    removeAttribute(name) {
        if (name === "id") { this._id = null; return; }
        this._attrs.delete(name);
    }

    querySelector() { return null; }
    querySelectorAll() { return []; }
    closest() { return null; }

    get textContent() {
        return this.childNodes.map((n) => (n.nodeType === 3 ? n._text : n.textContent)).join("");
    }
    set textContent(value) {
        this.childNodes.forEach((n) => { n.parentNode = null; });
        this.childNodes = [];
        if (value != null && value !== "") { this.appendChild(new TextNode(String(value))); }
    }

    get innerHTML() { return this._innerHTML !== undefined ? this._innerHTML : ""; }
    set innerHTML(value) {
        this._innerHTML = String(value);
        this.childNodes.forEach((n) => { n.parentNode = null; });
        this.childNodes = [];
    }

    addEventListener(type, handler) {
        (this._listeners[type] || (this._listeners[type] = new Set())).add(handler);
    }
    removeEventListener(type, handler) {
        if (this._listeners[type]) { this._listeners[type].delete(handler); }
    }
    dispatchEvent(event) {
        const set = this._listeners[event.type];
        if (set) { Array.from(set).forEach((fn) => fn(event)); }
        return true;
    }
}

/**
 * Builds a simple style object that accepts both cssText and individual
 * property assignment.
 * @returns {object} The style object.
 */
function makeStyle() {
    const style = {};
    let cssText = "";
    Object.defineProperty(style, "cssText", {
        get() { return cssText; },
        set(value) { cssText = String(value); },
        enumerable: false
    });
    return style;
}

/**
 * Creates a fresh document stub.
 * @returns {object} The document stub.
 */
export function createDocument() {
    return {
        baseURI: "http://localhost/",
        readyState: "complete",
        cookie: "",
        createElement(tag) { return new Element(tag); },
        createElementNS(namespace, tag) { return new Element(tag); },
        createDocumentFragment() { return new Element("#document-fragment"); },
        createTextNode(text) { return new TextNode(text); },
        addEventListener() {},
        removeEventListener() {}
    };
}

export { Element, TextNode };
