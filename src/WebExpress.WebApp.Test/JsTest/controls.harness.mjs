/**
 * Headless harness for the WebApp control-contract tests.
 *
 * Unlike harness.mjs, which boots only the View/State/Service engine with a
 * minimal Ctrl stub, this harness loads the real, shipped runtime so the real
 * controller, the real WebUI base controls and the WebApp engine are all
 * present, exactly as on a page:
 *
 *   1. the WebUI core (webexpress.webui.js) - the real Controller and Ctrl.
 *   2. the WebUI base controls that WebApp controls extend (TileCtrl, ListCtrl,
 *      DashboardCtrl, ...), in dependency order.
 *   3. the WebApp core (webexpress.webapp.js) and the engine modules.
 *   4. the control under test and any control specific dependencies.
 *
 * The browser-shaped globals (window, Popper, observers, WebSocket, ...) are
 * inert stubs, and the timers detach from the event loop so a control that
 * schedules work at construction time cannot keep the Node test runner alive.
 */

import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDocument, Element, SvgElement } from "./controls.dom-stub.mjs";

// a data control may kick off a fetch in its constructor; that promise can
// reject after the synchronous contract test already asserted construction and
// tore the control down. On the headless stub such a late rejection is not what
// the contract verifies, so it is swallowed rather than allowed to fail the
// whole Node test runner.
process.on("unhandledRejection", () => { });

const here = path.dirname(fileURLToPath(import.meta.url));
const webappAssetsJs = path.resolve(here, "..", "..", "WebExpress.WebApp", "Assets", "js");
const webuiAssetsJs = path.resolve(here, "..", "..", "..", "..", "WebExpress.WebUI", "src", "WebExpress.WebUI", "Assets", "js");

/**
 * Resolves the absolute path of a WebExpress.WebApp asset by file name.
 * @param {string} name - The asset file name.
 * @returns {string} The absolute path.
 */
export function webappAsset(name) {
    return path.join(webappAssetsJs, name);
}

// the WebUI base controls that WebApp controls extend, listed so that a base
// always loads before the control deriving from it (modal -> modal.page ->
// modal.form, table -> table.reorderable, graph.viewer -> graph.editor)
const WEBUI_BASE_CONTROLS = [
    "webexpress.webui.modal.js",
    "webexpress.webui.modal.page.js",
    "webexpress.webui.modal.form.js",
    // the sidebar dialog the link surface opens is a split with a tree in it
    "webexpress.webui.split.js",
    "webexpress.webui.tree.js",
    "webexpress.webui.modal.sidebar.panel.js",
    "webexpress.webui.table.js",
    "webexpress.webui.table.reorderable.js",
    "webexpress.webui.graph.viewer.js",
    "webexpress.webui.graph.editor.js",
    // the schedule renders its mini calendar with the framework date control
    "webexpress.webui.input.date.js",
    "webexpress.webui.schedule.js",
    // the velocity chart narrows its sprint window with the framework slider
    "webexpress.webui.input.slider.js",
    // the graph and workflow editors render their colour fields with the
    // framework colour control rather than a bare native input
    "webexpress.webui.input.color.js",
    "webexpress.webui.dashboard.js",
    "webexpress.webui.avatar.dropdown.js",
    "webexpress.webui.login.js",
    "webexpress.webui.input.tile.js",
    "webexpress.webui.kanban.js",
    "webexpress.webui.input.cascading.js",
    "webexpress.webui.dropdown.js",
    // the suggestion search is the framework search box with its suggestions
    // sourced from a service, so the base control has to be present
    "webexpress.webui.search.js",
    "webexpress.webui.list.js",
    "webexpress.webui.input.selection.js",
    "webexpress.webui.input.password.js",
    "webexpress.webui.quickfilter.js",
    "webexpress.webui.input.tag.js",
    "webexpress.webui.tag.js",
    "webexpress.webui.traffic.light.js",
    "webexpress.webui.input.traffic.light.js",
    // the data-driven agreement is the framework agreement with its state
    // sourced from a service, so the base control has to be present
    "webexpress.webui.sla.js",
    "webexpress.webui.tab.js",
    "webexpress.webui.selection.js",
    "webexpress.webui.tile.js",
    "webexpress.webui.sidebar.js",
    "webexpress.webui.smartedit.js",
    // the permission surface picks its policy chips with the move control, in
    // the read-only and in the editable variant
    "webexpress.webui.move.js",
    "webexpress.webui.input.move.js",
    // the table column templates the data tables render their cells with
    "templates/default.js",
    // the pager the data controls bind through the paging bind
    "webexpress.webui.pagination.js"
];

/**
 * A callable Node stand-in whose instanceof check is satisfied by any stub node
 * (an object carrying a numeric nodeType). The shipped controls test values with
 * "x instanceof Node", which requires the right-hand side to be callable.
 */
const NodeType = function Node() { };
NodeType.ELEMENT_NODE = 1;
NodeType.TEXT_NODE = 3;
NodeType.DOCUMENT_FRAGMENT_NODE = 11;
Object.defineProperty(NodeType, Symbol.hasInstance, {
    value: (value) => !!value && typeof value.nodeType === "number"
});

// the WebApp engine, in the load order the IncludeJavaScript attributes use
const WEBAPP_ENGINE = [
    "webexpress.webapp.js",
    "webexpress.webapp.service.js",
    "webexpress.webapp.renderer.js",
    "webexpress.webapp.template.js",
    "webexpress.webapp.intent.js",
    "webexpress.webapp.data.js",
    "webexpress.webapp.viewstate.js",
    "service/default.js",
    "intent/default.js",
    "bind/default.js"
];

/**
 * Detaches a timer handle from the event loop so a control that schedules a
 * timeout or interval at construction time cannot keep the Node test runner
 * alive after the synchronous tests finished.
 * @param {*} handle - The handle returned by setTimeout/setInterval.
 * @returns {*} The same handle.
 */
function detach(handle) {
    if (handle && typeof handle.unref === "function") { handle.unref(); }
    return handle;
}

const safeSetTimeout = (callback, delay, ...args) => detach(setTimeout(callback, delay, ...args));
const safeSetInterval = (callback, delay, ...args) => detach(setInterval(callback, delay, ...args));

/**
 * Builds a stand-in for one of the per-tag SVG interfaces. The stub models
 * every SVG tag with a single class, so the interface identity a control tests
 * with instanceof is reconstructed from the tag name.
 * @param {string} tagName - The upper case tag name the interface stands for.
 * @returns {Function} The constructor usable on the right-hand side of instanceof.
 */
function svgTagClass(tagName) {
    const constructor = function () { };
    Object.defineProperty(constructor, "name", { value: `SVG${tagName}Element` });
    Object.defineProperty(constructor, Symbol.hasInstance, {
        value: (value) => value instanceof SvgElement && String(value.tagName).toUpperCase() === tagName
    });
    return constructor;
}

/**
 * Builds the inert browser globals the controls touch at construction time.
 * @param {object} document - The document stub the window should expose.
 * @returns {object} The browser globals.
 */
function createBrowserGlobals(document) {
    const matchMedia = (query) => ({
        matches: false, media: query || "", onchange: null,
        addEventListener() { }, removeEventListener() { }, addListener() { }, removeListener() { }
    });

    // window listeners are tracked rather than dropped: a control that registers
    // a global key or pointer handler has to be able to prove, in a test, both
    // that the handler runs and that its teardown removed it again
    const listeners = {};
    const window = {
        _listeners: listeners,
        addEventListener(type, handler) {
            (listeners[type] || (listeners[type] = new Set())).add(handler);
        },
        removeEventListener(type, handler) {
            if (listeners[type]) { listeners[type].delete(handler); }
        },
        dispatchEvent(event) {
            const set = listeners[event.type];
            if (set) { Array.from(set).forEach((handler) => handler(event)); }
            return !event.defaultPrevented;
        },
        document, name: "", innerWidth: 1024, innerHeight: 768, devicePixelRatio: 1,
        scrollX: 0, scrollY: 0, pageXOffset: 0, pageYOffset: 0,
        location: { href: "http://localhost/", origin: "http://localhost", pathname: "/", search: "", hash: "" },
        history: { pushState() { }, replaceState() { }, back() { }, forward() { } },
        matchMedia,
        getComputedStyle: () => new Proxy({}, { get: () => "", has: () => true }),
        requestAnimationFrame: (callback) => safeSetTimeout(() => callback(Date.now()), 0),
        cancelAnimationFrame: (handle) => clearTimeout(handle),
        getSelection: () => ({ rangeCount: 0, isCollapsed: true, removeAllRanges() { }, addRange() { }, getRangeAt() { return null; } }),
        scrollTo() { }, scrollBy() { }, open() { },
        setTimeout: safeSetTimeout, clearTimeout, setInterval: safeSetInterval, clearInterval
    };
    window.window = window;
    window.self = window;
    document.defaultView = window;

    const storage = () => {
        const map = new Map();
        return {
            getItem: (key) => (map.has(key) ? map.get(key) : null),
            setItem: (key, value) => { map.set(key, String(value)); },
            removeItem: (key) => { map.delete(key); },
            clear: () => { map.clear(); },
            key: (index) => Array.from(map.keys())[index] ?? null,
            get length() { return map.size; }
        };
    };

    // a WebSocket that never opens; the WebApp message queue references it but
    // only connects on demand, which the contract tests do not trigger
    class WebSocketStub {
        static get CONNECTING() { return 0; }
        static get OPEN() { return 1; }
        static get CLOSING() { return 2; }
        static get CLOSED() { return 3; }
        constructor() { this.readyState = 0; }
        send() { }
        close() { this.readyState = 3; }
        addEventListener() { }
        removeEventListener() { }
    }

    return {
        window,
        requestAnimationFrame: window.requestAnimationFrame,
        cancelAnimationFrame: window.cancelAnimationFrame,
        getComputedStyle: window.getComputedStyle,
        getSelection: window.getSelection,
        matchMedia,
        localStorage: storage(),
        sessionStorage: storage(),
        WebSocket: WebSocketStub,
        // the graph editor narrows a drag target with an instanceof check, so
        // the SVG constructors have to exist and have to accept the stub's SVG
        // elements; the stub has one element class for every SVG tag, so the
        // distinction is drawn on the tag name
        SVGElement: SvgElement,
        SVGSVGElement: svgTagClass("SVG"),
        SVGGElement: svgTagClass("G"),
        SVGCircleElement: svgTagClass("CIRCLE"),
        SVGPathElement: svgTagClass("PATH"),
        SVGRectElement: svgTagClass("RECT"),
        SVGTextElement: svgTagClass("TEXT"),
        ResizeObserver: class { observe() { } unobserve() { } disconnect() { } },
        IntersectionObserver: class { constructor() { this.root = null; } observe() { } unobserve() { } disconnect() { } takeRecords() { return []; } },
        Event: class { constructor(type, init) { init = init || {}; this.type = type; this.bubbles = !!init.bubbles; this.cancelable = !!init.cancelable; this.defaultPrevented = false; } preventDefault() { this.defaultPrevented = true; } stopPropagation() { } },
        Popper: {
            createPopper: () => ({
                update: async () => { }, forceUpdate: () => { }, setOptions: async () => { },
                destroy: () => { }, state: { elements: {}, modifiersData: {}, rects: {} }
            })
        }
    };
}

/**
 * Loads a fresh, isolated runtime for a single control.
 * @param {object} [options] - Optional overrides: fetch, deps (webapp asset file
 *   names loaded before the control), file (the control file), extraGlobals.
 * @returns {object} The runtime: { wx, wxapp, document, createElement, setFetch }.
 */
export function loadControl(options = {}) {
    const document = createDocument();

    const sandbox = {
        console,
        queueMicrotask,
        setTimeout: safeSetTimeout,
        clearTimeout,
        setInterval: safeSetInterval,
        clearInterval,
        URL,
        URLSearchParams,
        AbortController,
        document,
        navigator: { language: "en-US", languages: ["en-US"], userAgent: "node", platform: "node", clipboard: { writeText: async () => { }, readText: async () => "" } },
        performance: { now: () => Date.now() },
        Node: NodeType,
        HTMLElement: Element,
        MutationObserver: class { constructor(cb) { this.callback = cb; } observe() { } disconnect() { } takeRecords() { return []; } },
        CustomEvent: class { constructor(type, init) { init = init || {}; this.type = type; this.detail = init.detail; this.bubbles = !!init.bubbles; } },
        fetch: options.fetch || (async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => "" })),
        ...createBrowserGlobals(document),
        ...(options.extraGlobals || {})
    };

    vm.createContext(sandbox);

    const run = (full) => {
        const code = fs.readFileSync(full, "utf8");
        vm.runInContext(code, sandbox, { filename: full });
    };

    // 1. the real WebUI runtime and the base controls WebApp derives from
    run(path.join(webuiAssetsJs, "webexpress.webui.js"));
    for (const file of WEBUI_BASE_CONTROLS) {
        run(path.join(webuiAssetsJs, file));
    }

    // 2. the WebApp core and engine
    for (const file of WEBAPP_ENGINE) {
        run(path.join(webappAssetsJs, file));
    }

    // 3. control specific dependencies (models and WebApp base controls)
    for (const dep of options.deps || []) {
        run(path.join(webappAssetsJs, dep));
    }

    // 4. the control under test
    if (options.file) {
        run(path.join(webappAssetsJs, options.file));
    }

    return {
        wx: sandbox.webexpress.webui,
        wxapp: sandbox.webexpress.webapp,
        document,
        sandbox,
        setFetch(fn) { sandbox.fetch = fn; },
        createElement(tag) { return document.createElement(tag); }
    };
}

/**
 * Counts the handlers currently registered on the window for an event type.
 * A teardown test asserts against this rather than against the control's own
 * bookkeeping, so a handler that is dropped without being unregistered still
 * shows up as a leak.
 * @param {object} rt - The loaded runtime.
 * @param {string} type - The event type, for example "keydown".
 * @returns {number} The handler count.
 */
export function windowListenerCount(rt, type) {
    const set = rt.sandbox.window._listeners[type];
    return set ? set.size : 0;
}

/**
 * Counts the handlers a stub element carries for an event type.
 * @param {object} element - The stub element.
 * @param {string} type - The event type.
 * @returns {number} The handler count.
 */
export function elementListenerCount(element, type) {
    const set = element._listeners[type];
    return set ? set.size : 0;
}

/**
 * Builds a synthetic keyboard event carrying the fields the graph controls read.
 * @param {string} key - The key value, for example "Delete".
 * @param {object} [init] - Overrides for the remaining event fields.
 * @returns {object} The event.
 */
export function keyEvent(key, init = {}) {
    return {
        type: init.type || "keydown",
        key,
        ctrlKey: !!init.ctrlKey,
        metaKey: !!init.metaKey,
        shiftKey: !!init.shiftKey,
        altKey: !!init.altKey,
        target: init.target || null,
        defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; },
        stopPropagation() { this.propagationStopped = true; }
    };
}

/**
 * Builds a synthetic childList mutation record for handleMutations.
 * @param {object} changes - { added, removed } node arrays.
 * @returns {object} The mutation record.
 */
export function childListMutation(changes = {}) {
    return {
        type: "childList",
        addedNodes: changes.added || [],
        removedNodes: changes.removed || []
    };
}
