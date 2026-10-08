/**
 * Headless unit tests for the REST tile model helpers (View, State and Service).
 *
 * These cover the pure logic extracted from webexpress.webapp.tile.js: the
 * legacy descriptor, the page slice, the total reduction and the item to tile
 * mapping, plus an end to end path that loads tiles with a query and persists
 * the state with an update through a service.
 *
 * Run with Node 18 or newer from the jstest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, webappAsset } from "./harness.mjs";

function load(options) {
    return loadEngine(Object.assign(
        { extraFiles: [webappAsset("webexpress.webapp.tile.model.js")] },
        options
    ));
}

test("slice items caps to the page size and tolerates non arrays", () => {
    const { wxapp } = load();
    assert.deepEqual(wxapp.tileModel.sliceItems([1, 2, 3], 2), [1, 2]);
    assert.deepEqual(wxapp.tileModel.sliceItems([1, 2], 5), [1, 2]);
    assert.deepEqual(wxapp.tileModel.sliceItems(null, 5), []);
});

test("query params always carry search, wql and filter and include order only when set", () => {
    const { wxapp } = load();

    assert.deepEqual(
        wxapp.tileModel.queryParams({ search: "abc", page: 2, pageSize: 25 }),
        { search: "abc", wql: "", filter: "", page: 2, pageSize: 25 });

    assert.deepEqual(
        wxapp.tileModel.queryParams({ orderBy: "label", orderDir: "desc" }),
        { search: "", wql: "", filter: "", page: 0, pageSize: 50, orderBy: "label", orderDir: "desc" });

    assert.deepEqual(
        wxapp.tileModel.queryParams(null),
        { search: "", wql: "", filter: "", page: 0, pageSize: 50 });
});

test("reduce total uses the response total and otherwise infers it", () => {
    const { wxapp } = load();
    assert.equal(wxapp.tileModel.reduceTotal({ total: 42 }, 10, 0, 50), 42);
    assert.equal(wxapp.tileModel.reduceTotal({}, 10, 2, 50), 110);
    // a figure that is not a number is no figure: inferring beats reporting a
    // zero that would claim the result is empty while a full page is on screen
    assert.equal(wxapp.tileModel.reduceTotal({ total: "x" }, 3, 0, 50), 3);
    assert.equal(wxapp.tileModel.reduceTotal(null, 4, 1, 50), 54);
});

test("reduce total reads the pagination block the rest tile result carries", () => {
    const { wxapp } = load();

    // RestApiTileResult reports page, pageSize and total under "pagination";
    // reading only a top level total makes a full page look like the whole
    // result and leaves the pager with a single page
    assert.equal(wxapp.tileModel.reduceTotal({ pagination: { page: 0, pageSize: 50, total: 120 } }, 50, 0, 50), 120);
});

test("map tiles projects field aliases and defaults the visibility", () => {
    const { wxapp } = load();
    const tiles = wxapp.tileModel.mapTiles({
        items: [
            { id: "t1", title: "T", color: "red", visible: false, options: [1, 2] },
            { name: "N", content: "<b/>" }
        ]
    });

    assert.equal(tiles.length, 2);
    assert.equal(tiles[0].id, "t1");
    assert.equal(tiles[0].label, "T");
    assert.equal(tiles[0].colorCss, "red");
    assert.equal(tiles[0].visible, false);
    assert.deepEqual(tiles[0].options, [1, 2]);

    assert.equal(tiles[1].id, null);
    assert.equal(tiles[1].label, "N");
    assert.equal(tiles[1].html, "<b/>");
    assert.equal(tiles[1].visible, true);
    assert.equal(tiles[1].options, null);

    assert.deepEqual(wxapp.tileModel.mapTiles(null), []);
    assert.deepEqual(wxapp.tileModel.mapTiles({}), []);
});

test("model loads tiles and persists the state through a service end to end", async () => {
    const { wxapp, setFetch } = load();
    const calls = [];
    setFetch(async (url, init) => {
        const method = (init && init.method) || "GET";
        calls.push({ url: url, method: method, body: init && init.body });
        if (method === "GET") {
            return { ok: true, status: 200, json: async () => ({ items: [{ id: "t1", title: "Tile" }], total: 1 }) };
        }
        return { ok: true, status: 200, json: async () => ({}) };
    });

    const service = wxapp.ServiceRegistry.create({ name: "data", kind: "rest", baseUri: "/api/tiles", method: "GET", updateMethod: "PUT" });

    const loaded = await service.query({});
    assert.equal(calls[0].method, "GET");
    const tiles = wxapp.tileModel.mapTiles(loaded.data);
    assert.equal(tiles[0].id, "t1");
    assert.equal(wxapp.tileModel.reduceTotal(loaded.data, tiles.length, 0, 50), 1);

    const saved = await service.update({ layout: "x" });
    assert.equal(calls[1].method, "PUT");
    assert.deepEqual(JSON.parse(calls[1].body), { layout: "x" });
    assert.equal(saved.ok, true);
});
