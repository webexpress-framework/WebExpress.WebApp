var webexpress = webexpress || {}
webexpress.webapp = webexpress.webapp || {}

/**
 * View renderer, part of the View, State and Service architecture.
 *
 * The renderer turns a lightweight virtual node tree into DOM through a keyed
 * reconciler. It applies the minimal set of mutations, preserves focus by
 * moving existing nodes rather than recreating them, and preserves nested
 * controls through a keep flag that tells the reconciler not to touch the
 * children of a node. The view layer is a pure function of state, so a render
 * never performs input or output.
 *
 * A virtual node is either an element node produced by h, of the shape
 * { tag, props, key, keep, children }, or a text node of the shape { text }.
 * Props support class, style as a string or an object, dataset as an object,
 * on as a map of event name to handler, value and checked for inputs, html as
 * an inner html escape hatch, ref as a callback, key for reconciliation and
 * keep to protect a subtree.
 */
;(function () {
    "use strict";

    const RESERVED = { key: true, keep: true, ref: true, children: true };

    /**
     * Determines whether a virtual node is a text node.
     * @param {object} vnode - The virtual node.
     * @returns {boolean} True for a text node.
     */
    function isText(vnode) {
        return vnode && vnode.text !== undefined && vnode.tag === undefined;
    }

    /**
     * Flattens a children argument into a list of virtual nodes, dropping null,
     * undefined and boolean values and turning primitives into text nodes.
     * @param {*} children - A child or an array of children.
     * @returns {Array<object>} The normalised list of virtual nodes.
     */
    function normalize(children) {
        const out = [];

        const walk = (child) => {
            if (child === null || child === undefined || child === false || child === true) {
                return;
            }
            if (Array.isArray(child)) {
                child.forEach(walk);
                return;
            }
            if (typeof child === "object" && (child.tag !== undefined || child.text !== undefined)) {
                out.push(child);
                return;
            }
            out.push({ text: String(child) });
        };

        walk(children);

        return out;
    }

    /**
     * Determines whether an existing DOM node has the same type as a virtual
     * node, which is the condition for reusing it instead of recreating it.
     * @param {Node} dom - The existing DOM node.
     * @param {object} vnode - The virtual node.
     * @returns {boolean} True when the types match.
     */
    function sameType(dom, vnode) {
        if (isText(vnode)) {
            return dom.nodeType === 3;
        }
        return dom.nodeType === 1 && dom.tagName && dom.tagName.toLowerCase() === String(vnode.tag).toLowerCase();
    }

    /**
     * Adds, updates and removes event listeners so that the attached set
     * matches the new handler map. Stable handlers are left in place.
     * @param {Element} el - The element.
     * @param {object} newHandlers - A map of event name to handler.
     */
    function updateEvents(el, newHandlers) {
        const attached = el._wxlisteners || (el._wxlisteners = {});
        newHandlers = newHandlers || {};

        for (const type of Object.keys(attached)) {
            if (attached[type] !== newHandlers[type]) {
                el.removeEventListener(type, attached[type]);
                delete attached[type];
            }
        }

        for (const type of Object.keys(newHandlers)) {
            if (typeof newHandlers[type] === "function" && attached[type] !== newHandlers[type]) {
                el.addEventListener(type, newHandlers[type]);
                attached[type] = newHandlers[type];
            }
        }
    }

    /**
     * Applies a single property to an element.
     * @param {Element} el - The element.
     * @param {string} key - The property name.
     * @param {*} value - The new value.
     * @param {*} oldValue - The previous value, used to diff style and dataset.
     */
    function setProp(el, key, value, oldValue) {
        if (key === "class" || key === "className") {
            el.className = Array.isArray(value) ? value.filter(Boolean).join(" ") : (value || "");
        } else if (key === "style") {
            if (typeof value === "string") {
                el.style.cssText = value;
            } else if (value && typeof value === "object") {
                if (oldValue && typeof oldValue === "object") {
                    for (const k of Object.keys(oldValue)) {
                        if (!(k in value)) {
                            el.style[k] = "";
                        }
                    }
                }
                for (const k of Object.keys(value)) {
                    el.style[k] = value[k];
                }
            } else {
                el.style.cssText = "";
            }
        } else if (key === "dataset") {
            const next = value || {};
            const previous = (oldValue && typeof oldValue === "object") ? oldValue : {};
            for (const k of Object.keys(previous)) {
                if (!(k in next)) {
                    delete el.dataset[k];
                }
            }
            for (const k of Object.keys(next)) {
                el.dataset[k] = next[k];
            }
        } else if (key === "on") {
            updateEvents(el, value || {});
        } else if (key === "value") {
            el.value = value == null ? "" : value;
        } else if (key === "checked") {
            el.checked = !!value;
        } else if (key === "html" || key === "innerHTML") {
            const html = value == null ? "" : String(value);
            if (el.innerHTML !== html) {
                el.innerHTML = html;
            }
        } else {
            if (value === false || value === null || value === undefined) {
                el.removeAttribute(key);
            } else {
                el.setAttribute(key, value === true ? "" : String(value));
            }
        }
    }

    /**
     * Removes a property that is present in the old props but absent in the new
     * props.
     * @param {Element} el - The element.
     * @param {string} key - The property name.
     * @param {*} oldValue - The previous value.
     */
    function removeProp(el, key, oldValue) {
        if (key === "class" || key === "className") {
            el.className = "";
        } else if (key === "style") {
            el.style.cssText = "";
        } else if (key === "dataset") {
            const previous = (oldValue && typeof oldValue === "object") ? oldValue : {};
            for (const k of Object.keys(previous)) {
                delete el.dataset[k];
            }
        } else if (key === "on") {
            updateEvents(el, {});
        } else if (key === "value") {
            el.value = "";
        } else if (key === "checked") {
            el.checked = false;
        } else if (key === "html" || key === "innerHTML") {
            el.innerHTML = "";
        } else {
            el.removeAttribute(key);
        }
    }

    /**
     * Diffs and applies the props of an element.
     * @param {Element} el - The element.
     * @param {object} oldProps - The previous props.
     * @param {object} newProps - The new props.
     */
    function applyProps(el, oldProps, newProps) {
        oldProps = oldProps || {};
        newProps = newProps || {};

        for (const key of Object.keys(oldProps)) {
            if (RESERVED[key] || key in newProps) {
                continue;
            }
            removeProp(el, key, oldProps[key]);
        }

        for (const key of Object.keys(newProps)) {
            if (RESERVED[key]) {
                continue;
            }
            setProp(el, key, newProps[key], oldProps[key]);
        }
    }

    /**
     * Creates a DOM node from a virtual node, recursing into children unless the
     * node is marked to keep its subtree.
     * @param {object} vnode - The virtual node.
     * @returns {Node} The created DOM node.
     */
    function createDom(vnode) {
        if (isText(vnode)) {
            return document.createTextNode(String(vnode.text));
        }

        const el = document.createElement(vnode.tag);
        el._wxkey = vnode.key;
        el._wxkeep = !!vnode.keep;
        applyProps(el, {}, vnode.props || {});
        el._wxprops = vnode.props || {};

        if (!vnode.keep) {
            for (const child of normalize(vnode.children)) {
                el.appendChild(createDom(child));
            }
        }

        if (vnode.props && typeof vnode.props.ref === "function") {
            vnode.props.ref(el);
        }

        return el;
    }

    /**
     * Patches an existing DOM node to match a virtual node, replacing it when
     * the types differ. Returns the resulting node, which may be a replacement.
     * @param {Node} dom - The existing DOM node.
     * @param {object} vnode - The virtual node.
     * @returns {Node} The resulting DOM node.
     */
    function patchNode(dom, vnode) {
        if (isText(vnode)) {
            if (dom.nodeType === 3) {
                const text = String(vnode.text);
                if (dom.textContent !== text) {
                    dom.textContent = text;
                }
                return dom;
            }
            const replacement = document.createTextNode(String(vnode.text));
            if (dom.parentNode) {
                dom.parentNode.replaceChild(replacement, dom);
            }
            return replacement;
        }

        if (!sameType(dom, vnode)) {
            const replacement = createDom(vnode);
            if (dom.parentNode) {
                dom.parentNode.replaceChild(replacement, dom);
            }
            return replacement;
        }

        applyProps(dom, dom._wxprops || {}, vnode.props || {});
        dom._wxprops = vnode.props || {};
        dom._wxkey = vnode.key;
        dom._wxkeep = !!vnode.keep;

        if (!vnode.keep) {
            reconcile(dom, vnode.children);
        }

        if (vnode.props && typeof vnode.props.ref === "function") {
            vnode.props.ref(dom);
        }

        return dom;
    }

    /**
     * Reconciles the children of a parent element with a list of virtual nodes
     * using keys where present and position otherwise. Existing nodes are
     * reused and moved rather than recreated, which preserves focus and nested
     * controls.
     * @param {Element} parent - The parent element.
     * @param {*} nextChildren - The new children.
     */
    function reconcile(parent, nextChildren) {
        const next = normalize(nextChildren);
        const existing = Array.prototype.slice.call(parent.childNodes);
        const keyedOld = new Map();

        for (const node of existing) {
            if (node._wxkey !== null && node._wxkey !== undefined) {
                keyedOld.set(node._wxkey, node);
            }
        }

        const used = new Set();
        const result = [];

        for (let i = 0; i < next.length; i++) {
            const vnode = next[i];
            let dom = null;

            if (!isText(vnode) && vnode.key !== null && vnode.key !== undefined && keyedOld.has(vnode.key)) {
                const match = keyedOld.get(vnode.key);
                if (!used.has(match) && sameType(match, vnode)) {
                    dom = patchNode(match, vnode);
                    used.add(match);
                }
            }

            if (dom === null) {
                const candidate = existing[i];
                const candidateReusable = candidate &&
                    (candidate._wxkey === null || candidate._wxkey === undefined) &&
                    !used.has(candidate) &&
                    sameType(candidate, vnode) &&
                    (isText(vnode) || vnode.key === null || vnode.key === undefined);

                if (candidateReusable) {
                    dom = patchNode(candidate, vnode);
                    used.add(candidate);
                } else {
                    dom = createDom(vnode);
                }
            }

            result.push(dom);
        }

        const resultSet = new Set(result);

        for (const node of existing) {
            if (!resultSet.has(node) && node.parentNode === parent) {
                parent.removeChild(node);
            }
        }

        for (let i = 0; i < result.length; i++) {
            const dom = result[i];
            const current = parent.childNodes[i] || null;
            if (current !== dom) {
                parent.insertBefore(dom, current);
            }
        }
    }

    /**
     * Creates an element virtual node.
     * @param {string} tag - The element tag name.
     * @param {object} [props] - The element props.
     * @param {...*} children - The child nodes.
     * @returns {object} The element virtual node.
     */
    function h(tag, props, ...children) {
        props = props || {};
        return {
            tag: tag,
            props: props,
            key: props.key !== undefined && props.key !== null ? props.key : null,
            keep: !!props.keep,
            children: children
        };
    }

    /**
     * Patches a container so that its children match the given virtual node or
     * list of virtual nodes. This is the public entry point for the view layer.
     * @param {Element} container - The container element.
     * @param {object|Array<object>} next - The virtual node tree.
     */
    function patch(container, next) {
        reconcile(container, Array.isArray(next) ? next : [next]);
    }

    webexpress.webapp.h = h;
    webexpress.webapp.Renderer = {
        h: h,
        patch: patch,
        normalize: normalize
    };
})();
