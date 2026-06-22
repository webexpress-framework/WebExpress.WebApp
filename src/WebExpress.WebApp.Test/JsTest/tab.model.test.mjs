/**
 * Headless unit tests for the REST tab model helpers (phase two).
 *
 * These cover the pure logic extracted from webexpress.webapp.tab.js, and an
 * end to end path that drives the four operations (list, create, reorder,
 * close) through a service to confirm the methods and bodies survive the
 * migration.
 *
 * Run with Node 18 or newer from the jstest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, webappAsset } from "./harness.mjs";

function load(options) {
    return loadEngine(Object.assign(
        { extraFiles: [webappAsset("webexpress.webapp.tab.model.js")] },
        options
    ));
}

test("map tabs reads the items array and tolerates a missing one", () => {
    const { wxapp } = load();

    assert.deepEqual(wxapp.tabModel.mapTabs({ items: [{ id: 1 }, { id: 2 }] }), [{ id: 1 }, { id: 2 }]);
    assert.deepEqual(wxapp.tabModel.mapTabs({}), []);
    assert.deepEqual(wxapp.tabModel.mapTabs(null), []);
});

test("create and reorder bodies carry the action and payload", () => {
    const { wxapp } = load();

    assert.deepEqual(wxapp.tabModel.createBody("t"), { action: "create", templateId: "t" });
    assert.deepEqual(wxapp.tabModel.reorderBody(["a", "b"]), { action: "reorder", order: ["a", "b"] });
});

test("extract new tab applies the requested template id and tolerates absence", () => {
    const { wxapp } = load();

    assert.deepEqual(wxapp.tabModel.extractNewTab({ newTab: { id: 1 } }, "t"), { id: 1, templateId: "t" });
    assert.deepEqual(wxapp.tabModel.extractNewTab({ newTab: { id: 1, templateId: "x" } }, "t"), { id: 1, templateId: "x" });
    assert.equal(wxapp.tabModel.extractNewTab({}, "t"), null);
    assert.equal(wxapp.tabModel.extractNewTab(null, "t"), null);
});

test("parse multiplicity yields a non negative integer or null", () => {
    const { wxapp } = load();

    assert.equal(wxapp.tabModel.parseMultiplicity("3"), 3);
    assert.equal(wxapp.tabModel.parseMultiplicity("0"), 0);
    assert.equal(wxapp.tabModel.parseMultiplicity(""), null);
    assert.equal(wxapp.tabModel.parseMultiplicity(undefined), null);
    assert.equal(wxapp.tabModel.parseMultiplicity("-1"), null);
    assert.equal(wxapp.tabModel.parseMultiplicity("abc"), null);
});

test("is template available respects the multiplicity limit", () => {
    const { wxapp } = load();

    assert.equal(wxapp.tabModel.isTemplateAvailable(null, 5), true);
    assert.equal(wxapp.tabModel.isTemplateAvailable({ multiplicity: null }, 5), true);
    assert.equal(wxapp.tabModel.isTemplateAvailable({ multiplicity: 3 }, 2), true);
    assert.equal(wxapp.tabModel.isTemplateAvailable({ multiplicity: 3 }, 3), false);
});

test("model drives the four operations through a service end to end", async () => {
    const { wxapp, setFetch } = load();
    const calls = [];
    setFetch(async (url, init) => {
        const method = (init && init.method) || "GET";
        calls.push({ url: url, method: method, body: init && init.body });
        if (method === "GET") {
            return { ok: true, status: 200, json: async () => ({ items: [{ id: 1 }] }) };
        }
        if (method === "POST") {
            return { ok: true, status: 200, json: async () => ({ newTab: { id: 9 } }) };
        }
        if (method === "PUT") {
            return { ok: true, status: 200, json: async () => ({}) };
        }
        return { ok: true, status: 204 };
    });

    const service = wxapp.ServiceRegistry.create({
        name: "data",
        kind: "rest",
        baseUri: "/api/tabs",
        method: "GET",
        updateMethod: "PUT",
        query: { id: "id" },
        response: { items: "items" }
    });

    const list = await service.query({});
    assert.equal(calls[0].method, "GET");
    assert.deepEqual(wxapp.tabModel.mapTabs(list.data), [{ id: 1 }]);

    const created = await service.create(wxapp.tabModel.createBody("t"));
    assert.equal(calls[1].method, "POST");
    assert.deepEqual(JSON.parse(calls[1].body), { action: "create", templateId: "t" });
    assert.equal(wxapp.tabModel.extractNewTab(created.data, "t").id, 9);

    const reordered = await service.update(wxapp.tabModel.reorderBody(["a", "b"]));
    assert.equal(calls[2].method, "PUT");
    assert.deepEqual(JSON.parse(calls[2].body), { action: "reorder", order: ["a", "b"] });
    assert.equal(reordered.ok, true);

    const removed = await service.remove({ params: { id: "x" } });
    assert.equal(calls[3].method, "DELETE");
    assert.match(calls[3].url, /id=x/);
    assert.equal(removed.ok, true);
});
