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
    // a faithful minimal copy of the webexpress.webui.Icon factory so control
    // files that build their icons through it can be instantiated in the harness;
    // the css-versus-image decision itself is covered by the WebUI icon tests.
    webexpress.webui.Icon = {
        create(spec, extraClass) {
            var value = (spec || "").trim();
            if (!value) { return null; }
            var extra = (extraClass || "").trim();
            if (this._isImage(value)) {
                var img = document.createElement("img");
                img.className = ("wx-icon-img " + extra).trim();
                img.src = value;
                img.alt = "";
                return img;
            }
            var i = document.createElement("i");
            i.className = (value + " " + extra).trim();
            return i;
        },
        _isImage(value) {
            return /^(https?:|data:|\\.{0,2}\\/)/i.test(value)
                || /\\.(svg|png|jpe?g|gif|webp|ico|bmp|avif)(\\?.*)?$/i.test(value);
        }
    };
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

/**
 * Appends a wx-service island element to a host, mirroring the C# emission in
 * DataServiceDescriptor.ToIslandElement, so the control tests configure their
 * hosts through the same channel the server renders.
 * @param {object} document - The document stub of the loaded engine.
 * @param {object} element - The host element.
 * @param {object} descriptor - The service descriptor shape.
 * @returns {object} The island element.
 */
export function appendServiceIsland(document, element, descriptor) {
    descriptor = descriptor || {};

    const island = document.createElement("wx-service");
    island.setAttribute("hidden", "");
    island.setAttribute("name", descriptor.name || "data");
    island.setAttribute("kind", descriptor.kind || "rest");
    island.setAttribute("base-uri", descriptor.baseUri || "");

    if (descriptor.method) {
        island.setAttribute("method", descriptor.method);
    }
    if (descriptor.updateMethod) {
        island.setAttribute("update-method", descriptor.updateMethod);
    }
    if (Array.isArray(descriptor.domains) && descriptor.domains.length > 0) {
        island.setAttribute("domains", descriptor.domains.join(";"));
    }
    if (descriptor.retry) {
        island.setAttribute("retry-count", String(descriptor.retry.count));
        island.setAttribute("retry-delay", String(descriptor.retry.delayMs || 0));
    }

    const mappings = [
        ["wx-query", "name", "wire", descriptor.query],
        ["wx-response", "name", "wire", descriptor.response],
        ["wx-header", "name", "value", descriptor.headers],
        ["wx-error", "status", "message", descriptor.errors]
    ];

    for (const [tag, keyAttribute, valueAttribute, mapping] of mappings) {
        for (const [key, value] of Object.entries(mapping || {})) {
            const child = document.createElement(tag);
            child.setAttribute(keyAttribute, key);
            child.setAttribute(valueAttribute, value);
            island.appendChild(child);
        }
    }

    element.appendChild(island);
    return island;
}

/**
 * Appends a wx-resource island element to a ViewState host, mirroring the C#
 * emission in DataResourceDescriptor.ToIslandElement, so the ViewState tests
 * configure their ViewStates through the same channel the server renders. Each
 * parameter declares the bidirectional binding between a state key and a query
 * parameter.
 * @param {object} document - The document stub of the loaded engine.
 * @param {object} element - The ViewState host element.
 * @param {object} resource - The resource descriptor shape.
 * @returns {object} The island element.
 */
export function appendResourceIsland(document, element, resource) {
    resource = resource || {};

    const island = document.createElement("wx-resource");
    island.setAttribute("name", resource.name || "default");
    island.setAttribute("service", resource.service || "data");
    island.setAttribute("target", resource.target || resource.name || "default");

    if (resource.auto === false) {
        island.setAttribute("auto", "false");
    }

    for (const param of resource.params || []) {
        const child = document.createElement("wx-param");
        child.setAttribute("name", param.name);
        child.setAttribute("state", param.state || param.name);
        child.setAttribute("dir", param.dir || "inout");
        island.appendChild(child);
    }

    element.appendChild(island);
    return island;
}

/**
 * Appends a wx-state island element to a host, mirroring the C# emission in
 * DataState.ToIslandElement, with the same type markers the engine coerces.
 * @param {object} document - The document stub of the loaded engine.
 * @param {object} element - The host element.
 * @param {object} state - The initial state values.
 * @returns {object} The island element.
 */
export function appendStateIsland(document, element, state) {
    const island = document.createElement("wx-state");
    island.setAttribute("hidden", "");

    for (const [name, value] of Object.entries(state || {})) {
        const prop = document.createElement("wx-prop");
        prop.setAttribute("name", name);

        if (typeof value === "number") {
            prop.setAttribute("type", "number");
            prop.textContent = String(value);
        } else if (typeof value === "boolean") {
            prop.setAttribute("type", "boolean");
            prop.textContent = String(value);
        } else if (typeof value === "string") {
            prop.textContent = value;
        } else {
            prop.setAttribute("type", "json");
            prop.textContent = JSON.stringify(value);
        }

        island.appendChild(prop);
    }

    element.appendChild(island);
    return island;
}
