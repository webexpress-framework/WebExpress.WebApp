/**
 * Headless unit tests for the watcher model helpers (View, State and Service).
 *
 * These cover the pure logic extracted from webexpress.webapp.watcher.js, namely
 * the list normalisation, the candidate filtering and the removal helpers, plus
 * an end to end path that loads watchers with a query, adds one with a create
 * and deletes one with a remove through a service.
 *
 * Run with Node 18 or newer from the jstest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, webappAsset } from "./harness.mjs";

function load(options) {
    return loadEngine(Object.assign(
        { extraFiles: [webappAsset("webexpress.webapp.watcher.model.js")] },
        options
    ));
}

test("normalize list passes an array through and defaults to empty", () => {
    const { wxapp } = load();
    assert.deepEqual(wxapp.watcherModel.normalizeList([{ id: "a" }]), [{ id: "a" }]);
    assert.deepEqual(wxapp.watcherModel.normalizeList(null), []);
    assert.deepEqual(wxapp.watcherModel.normalizeList({ id: "a" }), []);
});

test("candidates excludes existing watchers and tolerates non arrays", () => {
    const { wxapp } = load();
    const watchers = [{ id: "u1" }, { id: "u2" }];
    const users = [{ id: "u1" }, { id: "u3" }, { id: "u2" }, { id: "u4" }];

    assert.deepEqual(wxapp.watcherModel.candidates(watchers, users).map(u => u.id), ["u3", "u4"]);
    assert.deepEqual(wxapp.watcherModel.candidates(null, users).map(u => u.id), ["u1", "u3", "u2", "u4"]);
    assert.deepEqual(wxapp.watcherModel.candidates(watchers, null), []);
});

test("remove path and remove by id drop the matching watcher", () => {
    const { wxapp } = load();
    assert.equal(wxapp.watcherModel.removePath("a b"), "/a%20b");

    const list = [{ id: "u1" }, { id: "u2" }, { id: "u3" }];
    assert.deepEqual(wxapp.watcherModel.removeById(list, "u2").map(u => u.id), ["u1", "u3"]);
    assert.deepEqual(wxapp.watcherModel.removeById(null, "u2"), []);
});

test("model loads, adds and removes a watcher through a service end to end", async () => {
    const { wxapp, setFetch } = load();
    const calls = [];
    setFetch(async (url, init) => {
        const method = (init && init.method) || "GET";
        calls.push({ url: url, method: method, body: init && init.body });
        if (method === "GET") {
            return { ok: true, status: 200, json: async () => [{ id: "u1", name: "Ann" }] };
        }
        if (method === "POST") {
            return { ok: true, status: 200, json: async () => ({ id: "u2", name: "Bob" }) };
        }
        return { ok: true, status: 204 };
    });

    const service = wxapp.ServiceRegistry.create({ name: "data", kind: "rest", baseUri: "/api/watchers", method: "GET", updateMethod: "PUT" });

    const loaded = await service.query({});
    assert.equal(calls[0].method, "GET");
    assert.deepEqual(wxapp.watcherModel.normalizeList(loaded.data).map(u => u.id), ["u1"]);

    const created = await service.create({ userId: "u2" });
    assert.equal(calls[1].method, "POST");
    assert.deepEqual(JSON.parse(calls[1].body), { userId: "u2" });
    assert.equal(created.data.id, "u2");

    const removed = await service.remove({ path: wxapp.watcherModel.removePath("u1") });
    assert.equal(calls[2].method, "DELETE");
    assert.equal(calls[2].url.endsWith("/u1"), true);
    assert.equal(removed.ok, true);
    assert.equal(removed.data, null);
});
