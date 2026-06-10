/**
 * Headless test harness for the View, State and Service engine.
 *
 * It loads the engine modules into an isolated vm context that carries the
 * host globals the engine needs, which are console, queueMicrotask, URL,
 * AbortController, fetch and a minimal document. A small Ctrl base is defined
 * in the context so that the Component module can extend it without the full
 * browser runtime. Each call to loadEngine returns a fresh, isolated engine, so
 * that tests do not share state.
 */

import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDocument } from "./dom-stub.mjs";

// the harness lives in WebExpress.WebApp/src/WebExpress.WebApp.Test/JsTest and
// loads the shipped engine sources from the sibling WebExpress.WebApp project
const here = path.dirname(fileURLToPath(import.meta.url));
const webappAssetsJs = path.resolve(here, "..", "..", "WebExpress.WebApp", "Assets", "js");

/**
 * Resolves the absolute path of a WebExpress.WebApp asset by file name, so that
 * application modules can be loaded into the engine for testing.
 * @param {string} name - The asset file name, for example "webexpress.webapp.list.model.js".
 * @returns {string} The absolute path.
 */
export function webappAsset(name) {
    return path.join(webappAssetsJs, name);
}

// load order mirrors the Asset attribute order in IncludeJavaScript
// the engine lives in WebExpress.WebApp (WebUI carries only static controls)
const ENGINE_FILES = [
    "webexpress.webapp.store.js",
    "webexpress.webapp.service.js",
    "webexpress.webapp.renderer.js",
    "webexpress.webapp.template.js",
    "webexpress.webapp.intent.js",
    "webexpress.webapp.data.js",
    "service/default.js",
    "intent/default.js",
    "bind/default.js"
];

// a minimal Ctrl base, defined inside the context, that mirrors the parts of
// webexpress.webui.Ctrl the Component relies on, without the DOM heavy runtime
const BOOTSTRAP = `
    var webexpress = { webui: {}, webapp: {} };
    // a minimal CustomEvent so the engine's mount and error events construct
    // without a browser runtime
    class CustomEvent {
        constructor(type, init) {
            init = init || {};
            this.type = type;
            this.detail = init.detail;
            this.bubbles = !!init.bubbles;
        }
    }
    webexpress.webui.Ctrl = class {
        constructor(element) { this._element = element; }
        render() { }
        update() { this.render(); }
        destroy() { }
        _dispatch(type, detail) {
            if (this._element && typeof this._element.dispatchEvent === "function") {
                this._element.dispatchEvent({ type: type, detail: detail });
            }
        }
        _i18n(key, fallback) { return fallback; }
        _isVisible() { return true; }
        _iconTheme() { return "dark"; }
        _iconClass(faClass, lightClass) { return faClass || lightClass || ""; }
    };
    // a minimal Controller registry so that application control files, which
    // register their class at the end, can be loaded into the harness alongside
    // the models. The engine itself does not depend on it.
    webexpress.webui.Controller = {
        registerClass() { },
        getInstance() { return null; },
        getInstanceByElement() { return null; },
        getClosestInstance() { return null; }
    };
    // a minimal Binds registry so the webapp bind defaults, which register the
    // state and model binds, can be loaded and exercised in the harness
    webexpress.webui.Binds = {
        _binds: new Map(),
        register(name, definition) { this._binds.set(name, definition); return this; },
        get(name) { return this._binds.get(name) || null; },
        unregister(name) { this._binds.delete(name); }
    };
    // event name constants live in the full webexpress.webui.js, which the engine
    // harness does not load; an empty map lets controls dispatch without throwing
    // (the dispatched type is simply undefined, which the stub element ignores).
    webexpress.webui.Event = {};
    webexpress.webapp.Event = {};
`;

/**
 * Loads a fresh, isolated engine.
 * @param {object} [options] - Optional overrides such as a fetch mock.
 * @returns {object} An object with the engine namespace, the document and helpers.
 */
export function loadEngine(options = {}) {
    const document = createDocument();

    const sandbox = {
        console,
        queueMicrotask,
        setTimeout,
        clearTimeout,
        URL,
        URLSearchParams,
        AbortController,
        document,
        fetch: options.fetch || (async () => { throw new Error("fetch is not stubbed for this test"); })
    };

    vm.createContext(sandbox);
    vm.runInContext(BOOTSTRAP, sandbox, { filename: "bootstrap" });

    for (const file of ENGINE_FILES) {
        const full = path.join(webappAssetsJs, file);
        const code = fs.readFileSync(full, "utf8");
        vm.runInContext(code, sandbox, { filename: full });
    }

    // optional test specific bootstrap, for example a base class stub that an
    // application control file extends, run before the extra files load
    if (options.bootstrap) {
        vm.runInContext(options.bootstrap, sandbox, { filename: "test-bootstrap" });
    }

    // optional additional modules (for example application level helpers),
    // loaded after the engine so they can build on it
    for (const full of options.extraFiles || []) {
        const code = fs.readFileSync(full, "utf8");
        vm.runInContext(code, sandbox, { filename: full });
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
 * Awaits a turn of the microtask queue, so that batched store notifications run.
 * @returns {Promise<void>} A promise that resolves after the microtask queue drains.
 */
export async function tick() {
    await Promise.resolve();
    await Promise.resolve();
}
