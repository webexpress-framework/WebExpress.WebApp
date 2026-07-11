/**
 * Headless tests for the REST list control in ViewState mode (View, State and
 * Service).
 *
 * They instantiate the real webexpress.webapp.ListCtrl on the DOM stub with a
 * stubbed WebUI list base, inside an enclosing ViewState, and assert that
 * the list renders the central resource slice the ViewState loads, and that its
 * search re-queries the resource through the shared ViewState state instead of
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
 * Builds a ViewState host with a data service and an orders resource, instantiates
 * the ViewState for it, then appends a list element bound to that resource.
 * @param {object} engine - The loaded engine.
 * @returns {object} The ViewState and the list host element.
 */
function buildViewStateWithList(engine) {
    const viewStateHost = engine.createElement("div");
    viewStateHost.dataset.wxViewstate = "orders";
    appendStateIsland(engine.document, viewStateHost, { page: 0, search: "" });
    appendServiceIsland(engine.document, viewStateHost, {
        name: "data", kind: "rest", baseUri: "/api/orders", method: "GET",
        query: { page: "p", search: "q" }, response: { items: "items", total: "total" }
    });
    appendResourceIsland(engine.document, viewStateHost, {
        name: "orders", service: "data", target: "orders",
        params: [{ name: "page", state: "page", dir: "inout" }, { name: "search", state: "search", dir: "out" }]
    });

    const viewState = new engine.wxapp.ViewState(viewStateHost);

    const listHost = engine.createElement("div");
    listHost.dataset.wxResource = "orders";
    viewStateHost.appendChild(listHost);

    return { viewState, listHost };
}

/**
 * Awaits the pending load turns of the ViewState and the control.
 * @returns {Promise<void>} A promise that resolves after the pending turns.
 */
async function settle() {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
}

test("list in a ViewState renders the central resource slice the ViewState loads", async () => {
    const engine = load();
    const urls = [];
    engine.setFetch(async (url) => {
        urls.push(url);
        return { ok: true, status: 200, json: async () => ({ items: [{ id: "a", text: "A" }, { id: "b", text: "B" }], total: 7 }) };
    });

    const { viewState, listHost } = buildViewStateWithList(engine);
    const list = new engine.wxapp.ListCtrl(listHost);
    await settle();

    // the ViewState loaded the resource centrally, the list did not load itself
    assert.equal(urls.length, 1);
    assert.match(urls[0], /\/api\/orders\?/);
    assert.match(urls[0], /p=0/);
    assert.equal(list._items.length, 2, "the list renders the slice items");
    assert.equal(list._totalRecords, 7, "the list reads the total from the slice");
    assert.equal(viewState.getState().orders.items.length, 2);
});

test("list search re-queries the resource through the shared ViewState state", async () => {
    const engine = load();
    const urls = [];
    engine.setFetch(async (url) => {
        urls.push(url);
        return { ok: true, status: 200, json: async () => ({ items: [], total: 0 }) };
    });

    const { viewState, listHost } = buildViewStateWithList(engine);
    const list = new engine.wxapp.ListCtrl(listHost);
    await settle();

    list.search("guybrush");
    await settle();

    assert.equal(urls.length, 2, "the search triggers a central re-query, not a private load");
    assert.match(urls[1], /q=guybrush/);
    assert.match(urls[1], /p=0/);
    assert.equal(viewState.getState().search, "guybrush", "the search lives in the shared ViewState state");
});
