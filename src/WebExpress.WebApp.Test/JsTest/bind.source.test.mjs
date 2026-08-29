/**
 * Headless unit tests for the source binds: search, paging, filter and upload.
 *
 * These are the read direction of a surface that produces a value for someone
 * else. BindSearch and BindPaging declare them on the data component - the
 * reader - together with a selector naming the surface, so a search box or a
 * pager stays reusable and knows nothing about who listens. The bind subscribes
 * to the surface's event and translates it into the component's own dispatch
 * surface (search, page), which is where the meaning of a search or a page
 * change lives.
 *
 * The tests exercise the shipped bind/default.js through the engine harness.
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine } from "./harness.mjs";

const CHANGE_FILTER_EVENT = "webexpress.webui.change.filter";
const CHANGE_PAGE_EVENT = "webexpress.webui.change.page";
const UPLOAD_SUCCESS_EVENT = "webexpress.webui.upload.success";

/**
 * Loads an engine whose Event constants are the real ones and whose controller
 * resolves a component the test hands it. The harness stubs both away by
 * default, and the source binds need them: the event names to subscribe with,
 * and the controller to find the reader that the bound element stands for.
 * @param {object} [component] - The component the bound element resolves to.
 * @returns {object} The engine plus the element and event helpers.
 */
function loadRuntime(component) {
    const engine = loadEngine();

    engine.wx.Event.CHANGE_FILTER_EVENT = CHANGE_FILTER_EVENT;
    engine.wx.Event.CHANGE_PAGE_EVENT = CHANGE_PAGE_EVENT;
    engine.wx.Event.UPLOAD_SUCCESS_EVENT = UPLOAD_SUCCESS_EVENT;

    const instances = new Map();
    engine.wx.Controller.getInstanceByElement = (element) => instances.get(element) || null;

    return {
        engine,
        /**
         * Builds the surface a bind names and the reader that binds to it.
         * @param {string} name - The bind name.
         * @param {string} sourceId - The id of the surface.
         * @returns {object} The reader element.
         */
        bind(name, sourceId) {
            const source = engine.document.createElement("div");
            source.id = sourceId;
            engine.document.body.appendChild(source);

            const reader = engine.document.createElement("div");
            reader.setAttribute("data-wx-source-" + name, "#" + sourceId);
            engine.document.body.appendChild(reader);

            if (component) {
                instances.set(reader, component);
            }

            engine.wx.Binds.get(name).bind(reader);

            return { reader, source };
        },
        /**
         * Dispatches one of the surface events on the document, which is where
         * the bind listens because the events bubble.
         * @param {string} type - The event type.
         * @param {object} detail - The event detail, including the sender.
         */
        fire(type, detail) {
            engine.document.dispatchEvent({ type: type, detail: detail });
        }
    };
}

/**
 * Builds a data component recording what the binds asked it to do.
 * @returns {object} The component.
 */
function recorder() {
    return {
        store: {},
        searched: [],
        paged: [],
        uploads: [],
        search(pattern, type) { this.searched.push({ pattern, type }); },
        page(index) { this.paged.push(index); },
        uploaded(file) { this.uploads.push(file); }
    };
}

test("a search bind applies the term of the named search box to the component", () => {
    const component = recorder();
    const rt = loadRuntime(component);
    const { source } = rt.bind("search", "search-box");

    rt.fire(CHANGE_FILTER_EVENT, { sender: source, value: "vpn" });

    assert.deepEqual(component.searched, [{ pattern: "vpn", type: "basic" }], "the term reaches the component");
});

test("a search bind carries the search type the surface reports", () => {
    const component = recorder();
    const rt = loadRuntime(component);
    const { source } = rt.bind("search", "search-box");

    rt.fire(CHANGE_FILTER_EVENT, { sender: source, value: "state = open", searchType: "wql" });

    assert.equal(component.searched[0].type, "wql", "an advanced search stays an advanced search");
});

test("a search bind ignores a search box it does not name", () => {
    const component = recorder();
    const rt = loadRuntime(component);
    rt.bind("search", "search-box");

    const other = rt.engine.document.createElement("div");
    other.id = "another-box";
    rt.engine.document.body.appendChild(other);

    // the events bubble to the document, so without the sender check every
    // search box on a page would drive every list on it
    rt.fire(CHANGE_FILTER_EVENT, { sender: other, value: "vpn" });

    assert.deepEqual(component.searched, [], "a foreign search box changes nothing");
});

test("an empty term reaches the component, so clearing the box restores the full result", () => {
    const component = recorder();
    const rt = loadRuntime(component);
    const { source } = rt.bind("search", "search-box");

    rt.fire(CHANGE_FILTER_EVENT, { sender: source, value: "" });

    assert.deepEqual(component.searched, [{ pattern: "", type: "basic" }], "the reset is forwarded like any other term");
});

test("a paging bind applies the page the named pager was moved to", () => {
    const component = recorder();
    const rt = loadRuntime(component);
    const { source } = rt.bind("paging", "pager");

    rt.fire(CHANGE_PAGE_EVENT, { sender: source, page: 3 });

    assert.deepEqual(component.paged, [3], "the page reaches the component");
});

test("a paging bind ignores a pager it does not name", () => {
    const component = recorder();
    const rt = loadRuntime(component);
    rt.bind("paging", "pager");

    const other = rt.engine.document.createElement("div");
    other.id = "another-pager";
    rt.engine.document.body.appendChild(other);

    rt.fire(CHANGE_PAGE_EVENT, { sender: other, page: 3 });

    assert.deepEqual(component.paged, [], "a foreign pager changes nothing");
});

test("a component that binds a source late is still driven once it mounts", () => {
    const component = recorder();
    const engine = loadEngine();

    engine.wx.Event.CHANGE_FILTER_EVENT = CHANGE_FILTER_EVENT;

    const instances = new Map();
    engine.wx.Controller.getInstanceByElement = (element) => instances.get(element) || null;

    const source = engine.document.createElement("div");
    source.id = "search-box";
    engine.document.body.appendChild(source);

    const reader = engine.document.createElement("div");
    reader.setAttribute("data-wx-source-search", "#search-box");
    engine.document.body.appendChild(reader);

    // the bind runs before the controller constructs the element's own instance,
    // which is the real order on a page
    engine.wx.Binds.get("search").bind(reader);

    rtFire(engine, CHANGE_FILTER_EVENT, { sender: source, value: "early" });
    assert.deepEqual(component.searched, [], "nothing is forwarded while the component does not exist");

    instances.set(reader, component);
    engine.document.dispatchEvent({ type: "webexpress.webapp.data.mount", detail: {} });

    rtFire(engine, CHANGE_FILTER_EVENT, { sender: source, value: "late" });
    assert.deepEqual(component.searched, [{ pattern: "late", type: "basic" }], "the mounted component is driven");
});

test("a bind without a source selector wires nothing instead of throwing", () => {
    const component = recorder();
    const rt = loadRuntime(component);

    const reader = rt.engine.document.createElement("div");
    rt.engine.document.body.appendChild(reader);

    rt.engine.wx.Binds.get("search").bind(reader);

    assert.deepEqual(component.searched, [], "an incomplete declaration stays inert");
});

test("a component without a search method is reported rather than called", () => {
    const component = { store: {}, paged: [], page(index) { this.paged.push(index); } };
    const rt = loadRuntime(component);
    const { source } = rt.bind("search", "search-box");

    // the guard exists because the binds are declared on the server, where
    // nothing checks that the target control implements the dispatch surface
    assert.doesNotThrow(() => rt.fire(CHANGE_FILTER_EVENT, { sender: source, value: "vpn" }));
});

test("an upload bind shows the file the named upload control uploaded", () => {
    const component = recorder();
    const rt = loadRuntime(component);
    const { source } = rt.bind("upload", "upload-box");
    const file = { name: "Photo.jpg", size: 2048 };

    rt.fire(UPLOAD_SUCCESS_EVENT, { sender: source, file: file });

    assert.deepEqual(component.uploads, [file], "the file reaches the component that lists the files");
});

test("an upload bind matches the upload control even after it moved its id inward", () => {
    const component = recorder();
    const rt = loadRuntime(component);
    const { source } = rt.bind("upload", "upload-box");

    // the upload control takes the id off its host and puts it on the hidden
    // file input it builds, so the selector resolves to a descendant of the
    // sender rather than to the sender itself
    source.id = null;
    const input = rt.engine.document.createElement("input");
    input.id = "upload-box";
    source.appendChild(input);

    rt.fire(UPLOAD_SUCCESS_EVENT, { sender: source, file: { name: "Photo.jpg" } });

    assert.equal(component.uploads.length, 1, "an identity check alone would never match");
});

test("an upload bind ignores an upload control it does not name", () => {
    const component = recorder();
    const rt = loadRuntime(component);
    rt.bind("upload", "upload-box");

    const other = rt.engine.document.createElement("div");
    other.id = "another-box";
    rt.engine.document.body.appendChild(other);

    rt.fire(UPLOAD_SUCCESS_EVENT, { sender: other, file: { name: "Photo.jpg" } });

    assert.deepEqual(component.uploads, [], "a foreign upload changes nothing");
});

test("a component without an uploaded method is reported rather than called", () => {
    const component = { store: {}, searched: [], search(pattern) { this.searched.push(pattern); } };
    const rt = loadRuntime(component);
    const { source } = rt.bind("upload", "upload-box");

    assert.doesNotThrow(() => rt.fire(UPLOAD_SUCCESS_EVENT, { sender: source, file: {} }));
});

test("the filter bind is registered, so declaring it is not reported as unknown", () => {
    const engine = loadEngine();

    assert.ok(engine.wx.Binds.get("filter"), "the quickfilter driven components declare it");
});

/**
 * Dispatches an event on the document of an engine.
 * @param {object} engine - The loaded engine.
 * @param {string} type - The event type.
 * @param {object} detail - The event detail.
 */
function rtFire(engine, type, detail) {
    engine.document.dispatchEvent({ type: type, detail: detail });
}
