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
import { createDocument, Element } from "./controls.dom-stub.mjs";

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
    "webexpress.webui.table.js",
    "webexpress.webui.table.reorderable.js",
    "webexpress.webui.graph.viewer.js",
    "webexpress.webui.graph.editor.js",
    "webexpress.webui.dashboard.js",
    "webexpress.webui.avatar.dropdown.js",
    "webexpress.webui.login.js",
    "webexpress.webui.input.tile.js",
    "webexpress.webui.kanban.js",
    "webexpress.webui.input.cascading.js",
    "webexpress.webui.dropdown.js",
    "webexpress.webui.list.js",
    "webexpress.webui.input.selection.js",
    "webexpress.webui.input.password.js",
    "webexpress.webui.quickfilter.js",
    "webexpress.webui.input.tag.js",
    "webexpress.webui.tag.js",
    "webexpress.webui.traffic.light.js",
    "webexpress.webui.input.traffic.light.js",
    "webexpress.webui.tab.js",
    "webexpress.webui.selection.js",
    "webexpress.webui.tile.js",
    "webexpress.webui.smartedit.js"
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
 * Builds the inert browser globals the controls touch at construction time.
 * @param {object} document - The document stub the window should expose.
 * @returns {object} The browser globals.
 */
function createBrowserGlobals(document) {
    const matchMedia = (query) => ({
        matches: false, media: query || "", onchange: null,
        addEventListener() { }, removeEventListener() { }, addListener() { }, removeListener() { }
    });

    const window = {
        addEventListener() { }, removeEventListener() { }, dispatchEvent() { return true; },
        document, name: "", innerWidth: 1024, innerHeight: 768, devicePixelRatio: 1,
        scrollX: 0, scrollY: 0, pageXOffset: 0, pageYOffset: 0,
        location: { href: "http://localhost/", origin: "http://localhost", pathname: "/", search: "", hash: "" },
        history: { pushState() { }, replaceState() { }, back() { }, forward() { } },
        matchMedia,
        getComputedStyle: () => new Proxy({}, { get: () => "", has: () => true }),
        requestAnimationFrame: (callback) => safeSetTimeout(() => callback(Date.now()), 0),
        cancelAnimationFrame: (handle) => clearTimeout(handle),
        getSelection: () => ({ rangeCount: 0, isCollapsed: true, removeAllRanges() { }, addRange() { }, getRangeAt() { return null; } }),
        scrollTo() { }, scrollBy() { },
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
