/**
 * Headless tests for the REST tile control (View, State and Service).
 *
 * They instantiate the real webexpress.webapp.TileCtrl on the DOM stub with a
 * stubbed WebUI tile base and assert that the control seeds its store from
 * the wx-state island, queries through the configured data service with
 * the default wire vocabulary, and routes search, filter and paging through
 * the tile domain intents.
 *
 * Run with Node 18 or newer from the jstest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, webappAsset, appendServiceIsland, appendStateIsland } from "./harness.mjs";

// the webapp tile extends the static WebUI tile, which the engine harness does
// not load; the stub carries the members the webapp control calls
const TILE_BASE_STUB = `
    webexpress.webui.TileCtrl = class extends webexpress.webui.Ctrl {
        render() { }
        searchTiles() { return []; }
        _markSearchDirty() { }
        _dispatchSortEvent() { }
    };
`;

function load(options) {
    return loadEngine(Object.assign({
        bootstrap: TILE_BASE_STUB,
        extraFiles: [
            webappAsset("webexpress.webapp.tile.model.js"),
            webappAsset("webexpress.webapp.tile.js")
        ]
    }, options));
}

/**
 * Builds a tile host element carrying the common GET/PUT service island and an
 * optional state island.
 * @param {object} engine - The loaded engine.
 * @param {object} [state] - The optional initial state island.
 * @returns {object} The host element.
 */
function createHost(engine, state) {
    const element = engine.createElement("div");
    appendServiceIsland(engine.document, element, {
        name: "data", kind: "rest", baseUri: "/api/tiles", method: "GET", updateMethod: "PUT"
    });
    if (state) {
        appendStateIsland(engine.document, element, state);
    }
    return element;
}

/**
 * Awaits the pending load turns of the control.
 * @returns {Promise<void>} A promise that resolves after the pending turns.
 */
async function settle() {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
}

test("tile seeds its store from the state island and queries with default wire names", async () => {
    const engine = load();
    const urls = [];
    engine.setFetch(async (url) => {
        urls.push(url);
        return { ok: true, status: 200, json: async () => ({ items: [{ id: "a", label: "A" }], total: 9 }) };
    });

    const element = createHost(engine, { page: 1, pageSize: 2 });
    const tile = new engine.wxapp.TileCtrl(element);
    await settle();

    assert.equal(urls.length, 1);
    assert.match(urls[0], /\/api\/tiles\?/);
    assert.match(urls[0], /p=1/);
    assert.match(urls[0], /l=2/);
    assert.match(urls[0], /q=/);
    assert.match(urls[0], /f=/);
    assert.equal(tile._page, 1);
    assert.equal(tile._totalRecords, 9);
});

test("tile search dispatches the tile/search intent and reloads the first page", async () => {
    const engine = load();
    const urls = [];
    engine.setFetch(async (url) => {
        urls.push(url);
        return { ok: true, status: 200, json: async () => ({ items: [], total: 0 }) };
    });

    const element = createHost(engine, { page: 4 });
    const tile = new engine.wxapp.TileCtrl(element);
    await settle();

    tile.search("guybrush");
    await settle();

    assert.equal(urls.length, 2);
    assert.match(urls[1], /q=guybrush/);
    assert.match(urls[1], /p=0/);
    assert.equal(tile._search, "guybrush");
    assert.equal(tile._page, 0);
});

test("tile paging and filter dispatch their intents through the store", async () => {
    const engine = load();
    const urls = [];
    engine.setFetch(async (url) => {
        urls.push(url);
        return { ok: true, status: 200, json: async () => ({ items: [], total: 0 }) };
    });

    const element = createHost(engine);
    const tile = new engine.wxapp.TileCtrl(element);
    await settle();

    tile.paging(3);
    await settle();
    assert.match(urls[1], /p=3/);
    assert.equal(tile._page, 3);

    tile.filter("insult");
    await settle();
    assert.match(urls[2], /f=insult/);
    assert.match(urls[2], /p=0/);
    assert.equal(tile._filter, "insult");
});
