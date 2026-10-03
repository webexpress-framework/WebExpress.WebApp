/**
 * Headless unit tests for the REST list model helpers (phase one).
 *
 * These cover the pure logic extracted from webexpress.webapp.list.js, and an
 * end to end path that feeds the model output through a RestService to confirm
 * the legacy query parameter names survive the migration.
 *
 * Run with Node 18 or newer from the jstest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, webappAsset } from "./harness.mjs";

function load(options) {
    return loadEngine(Object.assign(
        { extraFiles: [webappAsset("webexpress.webapp.list.model.js")] },
        options
    ));
}

test("query params always include the base fields and omit order when unset", () => {
    const { wxapp } = load();
    const params = wxapp.listModel.queryParams({ search: "abc", page: 3, pageSize: 25 });

    assert.equal(params.search, "abc");
    assert.equal(params.wql, "");
    assert.equal(params.filter, "");
    assert.equal(params.page, 3);
    assert.equal(params.pageSize, 25);
    assert.equal("orderBy" in params, false);
    assert.equal("orderDir" in params, false);
});

test("query params include order when an order field is set", () => {
    const { wxapp } = load();
    const params = wxapp.listModel.queryParams({ orderBy: "name", orderDir: "asc" });

    assert.equal(params.orderBy, "name");
    assert.equal(params.orderDir, "asc");
});

test("reduce response extracts paging and clears loading and error", () => {
    const { wxapp } = load();
    const patch = wxapp.listModel.reduceResponse({ page: 0, pageSize: 50 }, { total: 42, page: 1, pageSize: 25 });

    assert.equal(patch.total, 42);
    assert.equal(patch.page, 1);
    assert.equal(patch.pageSize, 25);
    assert.equal(patch.loading, false);
    assert.equal(patch.error, null);
});

test("reduce response falls back to the current state and tolerates alternates", () => {
    const { wxapp } = load();
    const patch = wxapp.listModel.reduceResponse({ page: 2, pageSize: 50 }, { totalCount: 7 });

    assert.equal(patch.total, 7);
    assert.equal(patch.page, 2);
    assert.equal(patch.pageSize, 50);
});

test("reduce response reads the pagination block the rest list result carries", () => {
    const { wxapp } = load();

    // RestApiListResult reports the figures under "pagination" and never at the
    // top level, so a reducer reading only the top level leaves the pager on a
    // single page no matter how much there is to walk through
    const patch = wxapp.listModel.reduceResponse(
        { page: 0, pageSize: 50 },
        { items: [], pagination: { page: 1, pageSize: 25, total: 120, totalPages: 5 } }
    );

    assert.equal(patch.total, 120);
    assert.equal(patch.page, 1);
    assert.equal(patch.pageSize, 25);
});

test("map items projects strings and objects and tolerates a missing array", () => {
    const { wxapp } = load();

    assert.deepEqual(wxapp.listModel.mapItems(null), []);
    assert.deepEqual(wxapp.listModel.mapItems({}), []);

    const items = wxapp.listModel.mapItems({
        items: ["plain", { id: 7, text: "labelled", editable: true, options: [{ a: 1 }] }]
    });

    assert.equal(items.length, 2);
    assert.equal(items[0].id, null);
    assert.deepEqual(items[0].content, { content: "plain" });
    assert.equal(items[1].id, 7);
    assert.equal(items[1].content, "labelled");
    assert.equal(items[1].editable, true);
    assert.deepEqual(items[1].options, [{ a: 1 }]);
});

test("model feeds a rest service with the legacy parameter names end to end", async () => {
    const { wxapp, setFetch } = load();
    let capturedUrl = null;
    setFetch(async (url) => {
        capturedUrl = url;
        return { ok: true, status: 200, json: async () => ({ items: [{ id: 1, text: "a" }], total: 1 }) };
    });

    const service = wxapp.ServiceRegistry.create({
        name: "data",
        kind: "rest",
        baseUri: "/api/orders",
        method: "GET",
        query: { search: "q", wql: "wql", filter: "f", page: "p", pageSize: "l", orderBy: "o", orderDir: "d" },
        response: { items: "items", total: "total" }
    });
    const state = { search: "abc", wql: "", filter: "x", page: 2, pageSize: 25, orderBy: "name", orderDir: "asc" };

    const result = await service.query(wxapp.listModel.queryParams(state));

    assert.equal(result.ok, true);
    assert.match(capturedUrl, /\/api\/orders\?/);
    assert.match(capturedUrl, /q=abc/);
    assert.match(capturedUrl, /f=x/);
    assert.match(capturedUrl, /p=2/);
    assert.match(capturedUrl, /l=25/);
    assert.match(capturedUrl, /o=name/);
    assert.match(capturedUrl, /d=asc/);

    const patch = wxapp.listModel.reduceResponse(state, result.data);
    assert.equal(patch.total, 1);
    assert.equal(patch.loading, false);

    const items = wxapp.listModel.mapItems(result.data);
    assert.equal(items.length, 1);
    assert.equal(items[0].content, "a");
});
