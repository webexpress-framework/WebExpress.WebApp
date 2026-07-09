/**
 * Headless unit tests for the permission model helpers (View, State and
 * Service). These cover the pure logic extracted from
 * webexpress.webapp.permission.js, namely the page normalisation, the pager
 * math and the pair-based select exclusion, plus an end to end path that
 * loads assignments with a query, assigns one with a create and revokes one
 * with a remove through a service. An assignment is the pair (groupId,
 * policyId): a group may carry several policies.
 *
 * Run with Node 18 or newer from the JsTest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, webappAsset } from "./harness.mjs";

function load(options) {
    return loadEngine(Object.assign(
        { extraFiles: [webappAsset("webexpress.webapp.permission.model.js")] },
        options
    ));
}

test("normalize list handles pages, flat arrays and malformed payloads", () => {
    const { wxapp } = load();
    assert.deepEqual(
        wxapp.permissionModel.normalizeList({
            items: [{ groupId: "g1", policyId: "p1" }],
            total: 7,
            assignedPairs: [{ groupId: "g1", policyId: "p1" }, { groupId: "g2", policyId: "p1" }]
        }),
        {
            items: [{ groupId: "g1", policyId: "p1" }],
            total: 7,
            assignedPairs: [{ groupId: "g1", policyId: "p1" }, { groupId: "g2", policyId: "p1" }]
        });
    assert.deepEqual(
        wxapp.permissionModel.normalizeList([{ groupId: "g1", policyId: "p1" }]),
        { items: [{ groupId: "g1", policyId: "p1" }], total: 1, assignedPairs: [{ groupId: "g1", policyId: "p1" }] });
    // a response without the explicit pair set derives it from the items
    assert.deepEqual(
        wxapp.permissionModel.normalizeList({ items: [{ groupId: "g1", policyId: "p1" }] }),
        { items: [{ groupId: "g1", policyId: "p1" }], total: 1, assignedPairs: [{ groupId: "g1", policyId: "p1" }] });
    assert.deepEqual(wxapp.permissionModel.normalizeList(null), { items: [], total: 0, assignedPairs: [] });
    assert.deepEqual(wxapp.permissionModel.normalizeList({ total: 3 }), { items: [], total: 0, assignedPairs: [] });
});

test("available groups drops a group only once it carries every policy", () => {
    const { wxapp } = load();
    const groups = [{ id: "g1" }, { id: "g2" }, { id: "g3" }];
    const policies = [{ id: "p1" }, { id: "p2" }];
    const pairs = [
        { groupId: "g1", policyId: "p1" },
        { groupId: "g1", policyId: "p2" },
        { groupId: "g2", policyId: "p1" }
    ];

    // g1 carries every policy and drops out, g2 can still receive p2
    assert.deepEqual(
        wxapp.permissionModel.availableGroups(groups, pairs, policies).map((g) => g.id), ["g2", "g3"]);
    // without a policy directory coverage cannot be determined, nothing drops
    assert.deepEqual(
        wxapp.permissionModel.availableGroups(groups, pairs, []).map((g) => g.id), ["g1", "g2", "g3"]);
    assert.deepEqual(
        wxapp.permissionModel.availableGroups(groups, null, policies).map((g) => g.id), ["g1", "g2", "g3"]);
    assert.deepEqual(wxapp.permissionModel.availableGroups(null, pairs, policies), []);
});

test("available policies excludes the policies the selected group carries", () => {
    const { wxapp } = load();
    const policies = [{ id: "p1" }, { id: "p2" }, { id: "p3" }];
    const pairs = [
        { groupId: "g1", policyId: "p1" },
        { groupId: "g1", policyId: "p3" },
        { groupId: "g2", policyId: "p2" }
    ];

    assert.deepEqual(
        wxapp.permissionModel.availablePolicies(policies, pairs, "g1").map((p) => p.id), ["p2"]);
    assert.deepEqual(
        wxapp.permissionModel.availablePolicies(policies, pairs, "g3").map((p) => p.id), ["p1", "p2", "p3"]);
    // without a selected group there is no pair to exclude yet
    assert.deepEqual(
        wxapp.permissionModel.availablePolicies(policies, pairs, "").map((p) => p.id), ["p1", "p2", "p3"]);
    assert.deepEqual(wxapp.permissionModel.availablePolicies(null, pairs, "g1"), []);
});

test("page count spans at least one page and rounds up", () => {
    const { wxapp } = load();
    assert.equal(wxapp.permissionModel.pageCount(0, 10), 1);
    assert.equal(wxapp.permissionModel.pageCount(10, 10), 1);
    assert.equal(wxapp.permissionModel.pageCount(11, 10), 2);
    assert.equal(wxapp.permissionModel.pageCount(25, 10), 3);
    assert.equal(wxapp.permissionModel.pageCount(5, 0), 5);
});

test("clamp page keeps the index inside the valid range", () => {
    const { wxapp } = load();
    assert.equal(wxapp.permissionModel.clampPage(0, 3), 0);
    assert.equal(wxapp.permissionModel.clampPage(2, 3), 2);
    assert.equal(wxapp.permissionModel.clampPage(5, 3), 2);
    assert.equal(wxapp.permissionModel.clampPage(-1, 3), 0);
    assert.equal(wxapp.permissionModel.clampPage(4, 0), 0);
});

test("pages windows around the current page and clamps to the ends", () => {
    const { wxapp } = load();
    assert.deepEqual(wxapp.permissionModel.pages(0, 3), [0, 1, 2]);
    assert.deepEqual(wxapp.permissionModel.pages(0, 10), [0, 1, 2, 3, 4]);
    assert.deepEqual(wxapp.permissionModel.pages(5, 10), [3, 4, 5, 6, 7]);
    assert.deepEqual(wxapp.permissionModel.pages(9, 10), [5, 6, 7, 8, 9]);
    assert.deepEqual(wxapp.permissionModel.pages(1, 10, 3), [0, 1, 2]);
});

test("remove path encodes both pair segments", () => {
    const { wxapp } = load();
    assert.equal(wxapp.permissionModel.removePath("a b", "p/1"), "/a%20b/p%2F1");
});

test("model loads, assigns and revokes through a service end to end", async () => {
    const { wxapp, setFetch } = load();
    const calls = [];
    setFetch(async (url, init) => {
        const method = (init && init.method) || "GET";
        calls.push({ url: url, method: method, body: init && init.body });
        if (method === "GET") {
            return {
                ok: true, status: 200, json: async () => ({
                    items: [{ groupId: "g1", groupName: "IT Support", policyId: "p1", policyName: "class_edit_policy" }],
                    total: 1,
                    assignedPairs: [{ groupId: "g1", policyId: "p1" }]
                })
            };
        }
        if (method === "POST") {
            return {
                ok: true, status: 200, json: async () =>
                    ({ groupId: "g2", groupName: "Service Desk", policyId: "p2", policyName: "class_view_policy" })
            };
        }
        return { ok: true, status: 204 };
    });

    const service = wxapp.ServiceRegistry.create({ name: "data", kind: "rest", baseUri: "/api/permissions", method: "GET" });

    const loaded = await service.query({ search: "desk", page: 1, pageSize: 10 });
    assert.equal(calls[0].method, "GET");
    // the logical vocabulary maps onto the historical wire names
    assert.ok(calls[0].url.includes("q=desk"));
    assert.ok(calls[0].url.includes("p=1"));
    assert.ok(calls[0].url.includes("l=10"));
    const page = wxapp.permissionModel.normalizeList(loaded.data);
    assert.deepEqual(page.items.map((a) => a.groupId), ["g1"]);
    assert.deepEqual(page.assignedPairs, [{ groupId: "g1", policyId: "p1" }]);

    const created = await service.create({ groupId: "g2", policyId: "p2" });
    assert.equal(calls[1].method, "POST");
    assert.deepEqual(JSON.parse(calls[1].body), { groupId: "g2", policyId: "p2" });
    assert.equal(created.data.groupId, "g2");

    const removed = await service.remove({ path: wxapp.permissionModel.removePath("g1", "p1") });
    assert.equal(calls[2].method, "DELETE");
    assert.equal(calls[2].url.endsWith("/g1/p1"), true);
    assert.equal(removed.ok, true);
    assert.equal(removed.data, null);
});
