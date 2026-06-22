/**
 * Headless unit tests for the comment composer model helpers (View, State and
 * Service).
 *
 * These cover the pure logic extracted from webexpress.webapp.comment.composer.js:
 * the legacy descriptor, the categories url, the categories normalisation and
 * the label parsing, plus an end to end path that loads the categories through
 * the shared request and posts a new comment with the service create.
 *
 * Run with Node 18 or newer from the jstest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, webappAsset } from "./harness.mjs";

function load(options) {
    return loadEngine(Object.assign(
        { extraFiles: [webappAsset("webexpress.webapp.comment.composer.model.js")] },
        options
    ));
}

test("categories url appends the segment with a single slash", () => {
    const { wxapp } = load();
    assert.equal(wxapp.commentComposerModel.categoriesUrl("/api/c"), "/api/c/categories");
    assert.equal(wxapp.commentComposerModel.categoriesUrl("/api/c/"), "/api/c/categories");
    assert.equal(wxapp.commentComposerModel.categoriesUrl(""), "/categories");
});

test("normalize categories accepts an array or an object keyed by id", () => {
    const { wxapp } = load();
    assert.deepEqual(
        wxapp.commentComposerModel.normalizeCategories([{ id: "q", label: "Q" }, { label: "noid" }]),
        { q: { id: "q", label: "Q" } }
    );

    const obj = { a: { id: "a" } };
    assert.equal(wxapp.commentComposerModel.normalizeCategories(obj), obj);
    assert.deepEqual(wxapp.commentComposerModel.normalizeCategories(null), {});
});

test("parse labels splits, trims and drops empty entries", () => {
    const { wxapp } = load();
    assert.deepEqual(wxapp.commentComposerModel.parseLabels("a, b ,,c"), ["a", "b", "c"]);
    assert.deepEqual(wxapp.commentComposerModel.parseLabels(""), []);
    assert.deepEqual(wxapp.commentComposerModel.parseLabels(null), []);
});

test("model loads categories and posts a comment through a service end to end", async () => {
    const { wxapp, setFetch } = load();
    const calls = [];
    setFetch(async (url, init) => {
        const method = (init && init.method) || "GET";
        calls.push({ url: url, method: method, body: init && init.body });
        if (method === "GET") {
            return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => [{ id: "q", label: "Q" }] };
        }
        return { ok: true, status: 200, json: async () => ({ id: "c1" }) };
    });

    // categories are loaded through the shared request from the categories url
    const catRes = await wxapp.ServiceRegistry.request(
        wxapp.commentComposerModel.categoriesUrl("/api/comments"),
        { headers: { "Accept": "application/json" } }
    );
    assert.equal(calls[0].url.endsWith("/categories"), true);
    assert.deepEqual(wxapp.commentComposerModel.normalizeCategories(catRes.data), { q: { id: "q", label: "Q" } });

    // the new comment is posted through the service create
    const service = wxapp.ServiceRegistry.create({ name: "data", kind: "rest", baseUri: "/api/comments", method: "GET", updateMethod: "PUT" });
    const created = await service.create({ body: "hi", category: "q", labels: wxapp.commentComposerModel.parseLabels("x, y") });
    assert.equal(calls[1].method, "POST");
    assert.deepEqual(JSON.parse(calls[1].body), { body: "hi", category: "q", labels: ["x", "y"] });
    assert.equal(created.data.id, "c1");
});
