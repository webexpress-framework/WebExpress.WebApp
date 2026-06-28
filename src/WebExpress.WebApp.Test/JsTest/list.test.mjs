/**
 * Headless tests for the REST list control in scope mode (View, State and
 * Service at scope scope).
 *
 * They instantiate the real webexpress.webapp.ListCtrl on the DOM stub with a
 * stubbed WebUI list base, inside an enclosing ViewState scope, and assert that
 * the list renders the central resource slice the scope loads, and that its
 * search re-queries the resource through the shared scope state instead of
 * loading the data itself.
 *
 * Run with Node 18 or newer from the jstest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, webappAsset, appendServiceIsland, appendStateIsland, appendResourceIsland } from "./harness.mjs";

// the webapp list extends the static WebUI list, which the engine harness does
// not load; the stub carries the members the webapp control calls
const LIST_BASE_STUB = `
    webexpress.webui.ListCtrl = class extends webexpress.webui.Ctrl {
        constructor(element) {
            super(element);
            this._items = [];
            this._selectable = false;
            this._selectedItem = null;
        }
        render() { }
        setItems(items) { this._items = Array.isArray(items) ? items : (items == null ? [] : [items]); }
        _handleSelectionChange() { }
        _triggerPrimaryAction() { }
    };
`;

function load(options) {
    return loadEngine(Object.assign({
        bootstrap: LIST_BASE_STUB,
        extraFiles: [
            webappAsset("webexpress.webapp.list.model.js"),
            webappAsset("webexpress.webapp.list.js")
        ]
    }, options));
}

/**
 * Builds a scope host with a data service and an orders resource, instantiates
 * the ViewState for it, then appends a list element bound to that resource.
 * @param {object} engine - The loaded engine.
 * @returns {object} The scope ViewState and the list host element.
 */
function buildScopeWithList(engine) {
    const scopeHost = engine.createElement("div");
    scopeHost.dataset.wxScope = "orders";
    appendStateIsland(engine.document, scopeHost, { page: 0, search: "" });
    appendServiceIsland(engine.document, scopeHost, {
        name: "data", kind: "rest", baseUri: "/api/orders", method: "GET",
        query: { page: "p", search: "q" }, response: { items: "items", total: "total" }
    });
    appendResourceIsland(engine.document, scopeHost, {
        name: "orders", service: "data", target: "orders",
        params: [{ name: "page", state: "page", dir: "inout" }, { name: "search", state: "search", dir: "out" }]
    });

    const viewState = new engine.wxapp.ViewState(scopeHost);

    const listHost = engine.createElement("div");
    listHost.dataset.wxResource = "orders";
    scopeHost.appendChild(listHost);

    return { viewState, listHost };
}

/**
 * Awaits the pending load turns of the scope and the control.
 * @returns {Promise<void>} A promise that resolves after the pending turns.
 */
async function settle() {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
}

test("list in a scope renders the central resource slice the scope loads", async () => {
    const engine = load();
    const urls = [];
    engine.setFetch(async (url) => {
        urls.push(url);
        return { ok: true, status: 200, json: async () => ({ items: [{ id: "a", text: "A" }, { id: "b", text: "B" }], total: 7 }) };
    });

    const { viewState, listHost } = buildScopeWithList(engine);
    const list = new engine.wxapp.ListCtrl(listHost);
    await settle();

    // the scope loaded the resource centrally, the list did not load itself
    assert.equal(urls.length, 1);
    assert.match(urls[0], /\/api\/orders\?/);
    assert.match(urls[0], /p=0/);
    assert.equal(list._items.length, 2, "the list renders the slice items");
    assert.equal(list._totalRecords, 7, "the list reads the total from the slice");
    assert.equal(viewState.getState().orders.items.length, 2);
});

test("list search re-queries the resource through the shared scope state", async () => {
    const engine = load();
    const urls = [];
    engine.setFetch(async (url) => {
        urls.push(url);
        return { ok: true, status: 200, json: async () => ({ items: [], total: 0 }) };
    });

    const { viewState, listHost } = buildScopeWithList(engine);
    const list = new engine.wxapp.ListCtrl(listHost);
    await settle();

    list.search("guybrush");
    await settle();

    assert.equal(urls.length, 2, "the search triggers a central re-query, not a private load");
    assert.match(urls[1], /q=guybrush/);
    assert.match(urls[1], /p=0/);
    assert.equal(viewState.getState().search, "guybrush", "the search lives in the shared scope state");
});
