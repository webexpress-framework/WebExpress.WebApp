/**
 * Headless unit tests for the REST table model helpers (phase two).
 *
 * These cover the pure logic extracted from webexpress.webapp.table.js, and an
 * end to end path that feeds the model output through a RestService to confirm
 * the legacy query parameter names and the PUT update survive the migration.
 *
 * Run with Node 18 or newer from the jstest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, webappAsset } from "./harness.mjs";

function load(options) {
    return loadEngine(Object.assign(
        { extraFiles: [webappAsset("webexpress.webapp.table.model.js")] },
        options
    ));
}

test("query params include order only when an order field is set", () => {
    const { wxapp } = load();

    const without = wxapp.tableModel.queryParams({ search: "x", page: 1, pageSize: 20 });
    assert.equal(without.search, "x");
    assert.equal(without.page, 1);
    assert.equal(without.pageSize, 20);
    assert.equal("orderBy" in without, false);

    const withOrder = wxapp.tableModel.queryParams({ orderBy: "name", orderDir: "desc" });
    assert.equal(withOrder.orderBy, "name");
    assert.equal(withOrder.orderDir, "desc");
});

test("reduce response uses the response total and clamps the page", () => {
    const { wxapp } = load();
    const patch = wxapp.tableModel.reduceResponse({ page: 5, pageSize: 10 }, { total: 12, rows: [] });

    assert.equal(patch.total, 12);
    assert.equal(patch.page, 1);
    assert.equal(patch.error, null);
});

test("reduce response infers the total from page, size and received rows", () => {
    const { wxapp } = load();
    const patch = wxapp.tableModel.reduceResponse({ page: 2, pageSize: 10 }, { rows: [{}, {}, {}] });

    assert.equal(patch.total, 23);
    assert.equal(patch.page, 2);
});

test("slice rows caps to the page size and tolerates non arrays", () => {
    const { wxapp } = load();

    assert.deepEqual(wxapp.tableModel.sliceRows([1, 2, 3, 4], 2), [1, 2]);
    assert.deepEqual(wxapp.tableModel.sliceRows([1, 2], 5), [1, 2]);
    assert.deepEqual(wxapp.tableModel.sliceRows(null, 5), []);
});

test("normalize columns projects fields and applies the sort", () => {
    const { wxapp } = load();
    const columns = wxapp.tableModel.normalizeColumns({
        columns: [
            { id: "a", label: "A" },
            { id: "b", template: { type: "date", options: { fmt: 1 }, editable: true } }
        ]
    }, "a", "desc");

    assert.equal(columns.length, 2);
    assert.equal(columns[0].id, "a");
    assert.equal(columns[0].label, "A");
    assert.equal(columns[0].sort, "desc");
    assert.equal(columns[1].rendererType, "date");
    assert.equal(columns[1].rendererOptions.fmt, 1);
    assert.equal(columns[1].rendererOptions.editable, true);
    assert.equal(columns[1].sort, null);

    assert.deepEqual(wxapp.tableModel.normalizeColumns({}, null, null), []);
});

test("normalize rows recurses into children and slices to the page size", () => {
    const { wxapp } = load();
    const rows = wxapp.tableModel.normalizeRows({
        rows: [
            { id: 1, cells: [{ content: "x" }], children: [{ id: 2 }] },
            { id: 3 },
            { id: 4 }
        ]
    }, 2);

    assert.equal(rows.length, 2);
    assert.equal(rows[0].id, 1);
    assert.equal(rows[0].expanded, true);
    assert.equal(rows[0].children.length, 1);
    assert.equal(rows[0].children[0].id, 2);
    assert.equal(rows[0].children[0].parent, rows[0]);
});

test("model feeds a rest service for both the query and the put update", async () => {
    const { wxapp, setFetch } = load();
    const calls = [];
    setFetch(async (url, init) => {
        const method = (init && init.method) || "GET";
        calls.push({ url: url, method: method, body: init && init.body });
        if (method === "GET") {
            return { ok: true, status: 200, json: async () => ({ rows: [{ id: 1, cells: [] }], total: 1 }) };
        }
        return { ok: true, status: 204 };
    });

    const service = wxapp.ServiceRegistry.create({
        name: "data",
        kind: "rest",
        baseUri: "/api/table",
        method: "GET",
        updateMethod: "PUT",
        query: { search: "q", wql: "wql", filter: "f", page: "p", pageSize: "l", orderBy: "o", orderDir: "d" },
        response: { rows: "rows", total: "total" }
    });
    const state = { search: "x", wql: "", filter: "", page: 0, pageSize: 50, orderBy: "name", orderDir: "asc" };

    const queryResult = await service.query(wxapp.tableModel.queryParams(state));
    assert.equal(queryResult.ok, true);
    assert.match(calls[0].url, /\/api\/table\?/);
    assert.match(calls[0].url, /q=x/);
    assert.match(calls[0].url, /o=name/);
    assert.match(calls[0].url, /d=asc/);

    const updateResult = await service.update({ c: [{ id: "a", visible: true, width: 100 }] });
    assert.equal(updateResult.ok, true);
    assert.equal(calls[1].method, "PUT");
    const sentBody = JSON.parse(calls[1].body);
    assert.deepEqual(sentBody.c[0], { id: "a", visible: true, width: 100 });
});
