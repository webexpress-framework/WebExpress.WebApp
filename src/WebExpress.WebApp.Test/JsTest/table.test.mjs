/**
 * Headless tests for the REST table control in ViewState mode (View, State and
 * Service).
 *
 * They instantiate the real webexpress.webapp.TableCtrl on the DOM stub with a
 * stubbed WebUI reorderable table base, inside an enclosing ViewState, and
 * assert that the table normalises and renders the raw response the ViewState loads
 * centrally, and that its search re-queries the resource through the shared
 * ViewState state.
 *
 * Run with Node 18 or newer from the jstest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, webappAsset, appendServiceIsland, appendStateIsland, appendResourceIsland } from "./harness.mjs";

// the webapp table extends the static WebUI reorderable table, which the engine
// harness does not load; the stub carries the members the webapp control calls
const TABLE_BASE_STUB = `
    webexpress.webui.TableReorderableCtrl = class extends webexpress.webui.Ctrl {
        constructor(element) {
            super(element);
            this._table = document.createElement("table");
            this._columns = [];
            this._rows = [];
            this._options = [];
            this._hasOptions = false;
        }
        render() { }
    };
`;

function load(options) {
    return loadEngine(Object.assign({
        bootstrap: TABLE_BASE_STUB,
        extraFiles: [
            webappAsset("webexpress.webapp.table.model.js"),
            webappAsset("webexpress.webapp.table.js")
        ]
    }, options));
}

/**
 * Builds a ViewState host with a data service and a rows resource, instantiates the
 * ViewState for it, then appends a table element bound to that resource.
 * @param {object} engine - The loaded engine.
 * @returns {object} The ViewState and the table host element.
 */
function buildViewStateWithTable(engine) {
    const viewStateHost = engine.createElement("div");
    viewStateHost.dataset.wxViewstate = "catalog";
    appendStateIsland(engine.document, viewStateHost, { page: 0, search: "" });
    appendServiceIsland(engine.document, viewStateHost, {
        name: "data", kind: "rest", baseUri: "/api/catalog", method: "GET", updateMethod: "PUT",
        query: { page: "p", search: "q" }, response: { rows: "rows", total: "total" }
    });
    appendResourceIsland(engine.document, viewStateHost, {
        name: "rows", service: "data", target: "rows",
        params: [{ name: "page", state: "page", dir: "inout" }, { name: "search", state: "search", dir: "out" }]
    });

    const viewState = new engine.wxapp.ViewState(viewStateHost);

    const tableHost = engine.createElement("div");
    tableHost.dataset.wxResource = "rows";
    viewStateHost.appendChild(tableHost);

    return { viewState, tableHost };
}

/**
 * Awaits the pending load turns of the ViewState and the control.
 * @returns {Promise<void>} A promise that resolves after the pending turns.
 */
async function settle() {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
}

test("table in a ViewState normalises and renders the raw response the ViewState loads", async () => {
    const engine = load();
    const urls = [];
    engine.setFetch(async (url) => {
        urls.push(url);
        return {
            ok: true, status: 200, json: async () => ({
                columns: [{ id: "c1", label: "C1" }],
                rows: [{ id: "r1", cells: [{ content: "A" }] }, { id: "r2", cells: [{ content: "B" }] }],
                total: 5
            })
        };
    });

    const { viewState, tableHost } = buildViewStateWithTable(engine);
    const table = new engine.wxapp.TableCtrl(tableHost);
    await settle();

    assert.equal(urls.length, 1, "the ViewState loaded the resource centrally");
    assert.equal(table._rows.length, 2, "the table normalises the raw rows");
    assert.equal(table._totalRecords, 5, "the table reads the total from the slice");
    assert.equal(viewState.getState().rows.total, 5);
});

test("table search re-queries the resource through the shared ViewState state", async () => {
    const engine = load();
    const urls = [];
    engine.setFetch(async (url) => {
        urls.push(url);
        return { ok: true, status: 200, json: async () => ({ columns: [], rows: [], total: 0 }) };
    });

    const { viewState, tableHost } = buildViewStateWithTable(engine);
    const table = new engine.wxapp.TableCtrl(tableHost);
    await settle();

    table.search("plunder");
    await settle();

    assert.equal(urls.length, 2, "the search triggers a central re-query");
    assert.match(urls[1], /q=plunder/);
    assert.equal(viewState.getState().search, "plunder");
});

/**
 * Names the event constants the table dispatches and listens for. The harness
 * leaves webexpress.webui.Event empty, so every constant reads as undefined -
 * a listener registered for undefined then matches every dispatch of undefined,
 * and the table's own data-arrived event re-enters its persistence listeners
 * without end. Naming them is what makes the standalone load path testable.
 * @param {object} engine - The loaded engine.
 */
function nameEvents(engine) {
    Object.assign(engine.wx.Event, {
        CHANGE_VISIBILITY_EVENT: "webexpress.webui.change.visibility",
        DATA_ARRIVED_EVENT: "webexpress.webui.data.arrived",
        UPDATED_EVENT: "webexpress.webui.updated",
        COLUMN_REORDER_EVENT: "webexpress.webui.column.reorder",
        COLUMN_VISIBILITY_EVENT: "webexpress.webui.column.visibility",
        ROW_REORDER_EVENT: "webexpress.webui.row.reorder",
        TABLE_SORT_EVENT: "webexpress.webui.table.sort"
    });
}

/**
 * Builds a standalone table (no ViewState) over a rest service island.
 * @param {object} engine - The loaded engine.
 * @returns {HTMLElement} The table host element.
 */
function buildStandaloneTable(engine) {
    const tableHost = engine.createElement("div");
    appendServiceIsland(engine.document, tableHost, {
        name: "data", kind: "rest", baseUri: "/api/issues/table", method: "GET"
    });
    engine.document.body.appendChild(tableHost);

    return tableHost;
}

test("a hidden table defers its query and runs it when the view becomes visible", async () => {
    const engine = load();
    nameEvents(engine);

    const urls = [];
    engine.setFetch(async (url) => {
        urls.push(url);
        return { ok: true, status: 200, json: async () => ({ columns: [], rows: [], pagination: { page: 0, pageSize: 50, total: 0 } }) };
    });

    const table = new engine.wxapp.TableCtrl(buildStandaloneTable(engine));
    await settle();

    assert.equal(urls.length, 1, "the standalone table loads once on construction");

    // the presentations of one view share the search box and the quickfilter bar,
    // so a term is applied to the hidden ones as well - they must not query while
    // off screen, but they must not forget the term either
    table._isVisible = () => false;
    table.filter("qf_mine");
    await settle();

    assert.equal(urls.length, 1, "a hidden table does not query");
    assert.equal(table._store.getState().filter, "qf_mine", "but it keeps the filter it was given");

    table._isVisible = () => true;
    engine.document.dispatchEvent({ type: engine.wx.Event.CHANGE_VISIBILITY_EVENT, detail: { visible: true } });
    await settle();

    assert.equal(urls.length, 2, "showing the table runs the deferred query");
    assert.match(urls[1], /f=qf_mine/, "and it carries the filter entered while it was hidden");
});

test("a visible table is not re-queried by a visibility change", async () => {
    const engine = load();
    nameEvents(engine);

    const urls = [];
    engine.setFetch(async (url) => {
        urls.push(url);
        return { ok: true, status: 200, json: async () => ({ columns: [], rows: [], pagination: { page: 0, pageSize: 50, total: 0 } }) };
    });

    new engine.wxapp.TableCtrl(buildStandaloneTable(engine));
    await settle();

    engine.document.dispatchEvent({ type: engine.wx.Event.CHANGE_VISIBILITY_EVENT, detail: { visible: true } });
    await settle();

    assert.equal(urls.length, 1, "nothing was deferred, so switching back changes nothing");
});
