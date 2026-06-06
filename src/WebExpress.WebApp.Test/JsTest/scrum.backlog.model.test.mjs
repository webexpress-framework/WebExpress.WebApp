/**
 * Headless unit tests for the scrum backlog model helpers (View, State and
 * Service).
 *
 * These cover the pure logic extracted from webexpress.webapp.scrum.backlog.js:
 * the legacy descriptor, the board and sprint normalisation, the sprint and item
 * paths, the request bodies, the sprint group filter and sort, the rank rewrite
 * and the active sprint crossing classification, plus an end to end path that
 * loads the board with a query, persists a sprint and an item rank with an
 * update on a path and deletes a sprint with a remove through a service.
 *
 * Run with Node 18 or newer from the jstest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, webappAsset } from "./harness.mjs";

function load(options) {
    return loadEngine(Object.assign(
        { extraFiles: [webappAsset("webexpress.webapp.scrum.backlog.model.js")] },
        options
    ));
}

test("legacy descriptor loads with get and uses put for the update", () => {
    const { wxapp } = load();
    const descriptor = wxapp.scrumBacklogModel.legacyDescriptor("/api/backlog");

    assert.equal(descriptor.kind, "rest");
    assert.equal(descriptor.baseUri, "/api/backlog");
    assert.equal(descriptor.method, "GET");
    assert.equal(descriptor.updateMethod, "PUT");
});

test("normalize data returns sprint and item arrays and tolerates absence", () => {
    const { wxapp } = load();
    const norm = wxapp.scrumBacklogModel.normalizeData({ sprints: [{ id: "s1" }], items: [{ id: "i1" }] });
    assert.deepEqual(norm.sprints.map(s => s.id), ["s1"]);
    assert.deepEqual(norm.items.map(i => i.id), ["i1"]);

    const empty = wxapp.scrumBacklogModel.normalizeData(null);
    assert.deepEqual(empty.sprints, []);
    assert.deepEqual(empty.items, []);
});

test("normalize sprint applies defaults and keeps caller supplied fields", () => {
    const { wxapp } = load();
    const s = wxapp.scrumBacklogModel.normalizeSprint({ id: "s1", name: "Sprint 1", capacity: 5, extra: "x" });
    assert.equal(s.id, "s1");
    assert.equal(s.name, "Sprint 1");
    assert.equal(s.status, "planned");
    assert.equal(s.goal, "");
    assert.equal(s.start, null);
    assert.equal(s.capacity, 5);
    assert.equal(s.extra, "x");

    const d = wxapp.scrumBacklogModel.normalizeSprint({ id: "s2" });
    assert.equal(d.status, "planned");
    assert.equal(d.capacity, 0);

    const active = wxapp.scrumBacklogModel.normalizeSprint({ id: "s3", status: "active" });
    assert.equal(active.status, "active");
});

test("paths build the sprint, item rank and batch endpoints", () => {
    const { wxapp } = load();
    assert.equal(wxapp.scrumBacklogModel.sprintPath("s 1"), "/sprints/s%201");
    assert.equal(wxapp.scrumBacklogModel.itemRankPath("i 1"), "/items/i%201/rank");
    assert.equal(wxapp.scrumBacklogModel.rankBatchPath(), "/items/rank-batch");
});

test("request bodies carry the rank payloads", () => {
    const { wxapp } = load();
    assert.deepEqual(wxapp.scrumBacklogModel.itemRankBody({ id: "i1", sprintId: "s1", rank: 3 }), { sprintId: "s1", rank: 3 });
    assert.deepEqual(wxapp.scrumBacklogModel.itemRankBody({ id: "i2", rank: 1 }), { sprintId: null, rank: 1 });

    const batch = wxapp.scrumBacklogModel.rankBatchBody([{ id: "i1", sprintId: "s1", rank: 1 }, { id: "i2", rank: 2 }]);
    assert.deepEqual(batch, { ranks: [{ id: "i1", sprintId: "s1", rank: 1 }, { id: "i2", sprintId: null, rank: 2 }] });
    assert.deepEqual(wxapp.scrumBacklogModel.rankBatchBody(null), { ranks: [] });
});

test("items for sprint sorted filters by group and sorts by rank then key", () => {
    const { wxapp } = load();
    const items = [
        { id: "a", sprintId: "s1", rank: 2, key: "A" },
        { id: "b", sprintId: "s1", rank: 1, key: "B" },
        { id: "c", sprintId: null, status: "backlog", key: "C" },
        { id: "d", status: "backlog", key: "D" }
    ];

    assert.deepEqual(wxapp.scrumBacklogModel.itemsForSprintSorted(items, "s1").map(i => i.id), ["b", "a"]);
    assert.deepEqual(wxapp.scrumBacklogModel.itemsForSprintSorted(items, null).map(i => i.id), ["c", "d"]);
    assert.deepEqual(wxapp.scrumBacklogModel.itemsForSprintSorted(null, "s1"), []);
});

test("rewrite ranks assigns a one based rank and the sprint id", () => {
    const { wxapp } = load();
    const items = [{ id: "x" }, { id: "y" }, { id: "z" }];
    wxapp.scrumBacklogModel.rewriteRanks("s1", items);
    assert.deepEqual(items.map(i => i.rank), [1, 2, 3]);
    assert.deepEqual(items.map(i => i.sprintId), ["s1", "s1", "s1"]);

    const backlog = [{ id: "x", sprintId: "s1" }];
    wxapp.scrumBacklogModel.rewriteRanks(null, backlog);
    assert.equal(backlog[0].sprintId, null);
    assert.equal(backlog[0].rank, 1);
});

test("crosses active sprint detects entering or leaving the active sprint", () => {
    const { wxapp } = load();
    const m = wxapp.scrumBacklogModel;

    assert.equal(m.crossesActiveSprint([{ sprintId: "s1" }], "s2", null), false);
    assert.equal(m.crossesActiveSprint([{ sprintId: null }], "act", "act"), true);
    assert.equal(m.crossesActiveSprint([{ sprintId: "act" }], null, "act"), true);
    assert.equal(m.crossesActiveSprint([{ sprintId: "act" }], "act", "act"), false);
    assert.equal(m.crossesActiveSprint([{ sprintId: "s1" }], "s2", "act"), false);
});

test("model loads, persists and deletes through a service end to end", async () => {
    const { wxapp, setFetch } = load();
    const calls = [];
    setFetch(async (url, init) => {
        const method = (init && init.method) || "GET";
        calls.push({ url: url, method: method, body: init && init.body });
        if (method === "GET") {
            return { ok: true, status: 200, json: async () => ({ sprints: [{ id: "s1" }], items: [{ id: "i1", sprintId: "s1" }] }) };
        }
        if (method === "DELETE") {
            return { ok: true, status: 204 };
        }
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
    });

    const service = wxapp.ServiceRegistry.create(wxapp.scrumBacklogModel.legacyDescriptor("/api/backlog"));

    const loaded = await service.query({});
    const norm = wxapp.scrumBacklogModel.normalizeData(loaded.data);
    assert.equal(norm.sprints[0].id, "s1");
    assert.equal(norm.items[0].id, "i1");

    await service.update({ id: "s1", status: "active" }, { path: wxapp.scrumBacklogModel.sprintPath("s1") });
    assert.equal(calls[1].method, "PUT");
    assert.equal(calls[1].url.endsWith("/sprints/s1"), true);

    await service.update(
        wxapp.scrumBacklogModel.itemRankBody({ id: "i1", sprintId: "s1", rank: 3 }),
        { path: wxapp.scrumBacklogModel.itemRankPath("i1") }
    );
    assert.equal(calls[2].url.endsWith("/items/i1/rank"), true);
    assert.deepEqual(JSON.parse(calls[2].body), { sprintId: "s1", rank: 3 });

    const removed = await service.remove({ path: wxapp.scrumBacklogModel.sprintPath("s1") });
    assert.equal(calls[3].method, "DELETE");
    assert.equal(calls[3].url.endsWith("/sprints/s1"), true);
    assert.equal(removed.ok, true);
});
