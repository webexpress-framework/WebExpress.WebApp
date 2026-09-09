/**
 * Headless unit tests for the permission model helpers (View, State and
 * Service). These cover the pure logic extracted from
 * webexpress.webapp.permission.js, namely the page normalisation, the policy
 * set parsing, the group exclusion of the assign dialog and the pager math, plus an
 * end to end path that loads entries with a query, adds one with a create,
 * replaces a policy set with an update and revokes a group with a remove
 * through a service. A row is a group with all of its policies.
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
            items: [{ groupId: "g1", policyIds: ["p1"] }],
            total: 7,
            assignedGroupIds: ["g1", "g2"]
        }),
        {
            items: [{ groupId: "g1", policyIds: ["p1"] }],
            total: 7,
            assignedGroupIds: ["g1", "g2"]
        });

    // a flat array is a single page, and the group set is derived from it
    assert.deepEqual(
        wxapp.permissionModel.normalizeList([{ groupId: "g1", policyIds: ["p1"] }]),
        { items: [{ groupId: "g1", policyIds: ["p1"] }], total: 1, assignedGroupIds: ["g1"] });

    // a page without an explicit group set falls back to the items
    assert.deepEqual(
        wxapp.permissionModel.normalizeList({ items: [{ groupId: "g3" }] }),
        { items: [{ groupId: "g3" }], total: 1, assignedGroupIds: ["g3"] });

    assert.deepEqual(wxapp.permissionModel.normalizeList(null), { items: [], total: 0, assignedGroupIds: [] });
    assert.deepEqual(wxapp.permissionModel.normalizeList({ nope: 1 }), { items: [], total: 0, assignedGroupIds: [] });
});

test("policy ids accept an entry, an array and the serialized chip value", () => {
    const { wxapp } = load();
    assert.deepEqual(wxapp.permissionModel.policyIds({ groupId: "g1", policyIds: ["p1", "p2"] }), ["p1", "p2"]);
    assert.deepEqual(wxapp.permissionModel.policyIds(["p1", "p2"]), ["p1", "p2"]);

    // the move control serializes its value with semicolons
    assert.deepEqual(wxapp.permissionModel.policyIds("p1;p2"), ["p1", "p2"]);
    assert.deepEqual(wxapp.permissionModel.policyIds(" p1 ; ; p2 "), ["p1", "p2"]);

    assert.deepEqual(wxapp.permissionModel.policyIds(""), []);
    assert.deepEqual(wxapp.permissionModel.policyIds(null), []);
    assert.deepEqual(wxapp.permissionModel.policyIds({ groupId: "g1" }), []);
});

test("available groups drop the ones that already own a row", () => {
    const { wxapp } = load();
    const groups = [{ id: "g1", name: "IT Support" }, { id: "g2", name: "Service Desk" }];

    assert.deepEqual(wxapp.permissionModel.availableGroups(groups, ["g1"]).map((g) => g.id), ["g2"]);
    assert.deepEqual(wxapp.permissionModel.availableGroups(groups, []).map((g) => g.id), ["g1", "g2"]);
    assert.deepEqual(wxapp.permissionModel.availableGroups(groups, ["g1", "g2"]), []);
    assert.deepEqual(wxapp.permissionModel.availableGroups(null, ["g1"]), []);
});

test("policy options carry the id and fall back to the id as the label", () => {
    const { wxapp } = load();
    assert.deepEqual(
        wxapp.permissionModel.policyOptions([{ id: "p1", name: "class_edit_policy" }, { id: "p2" }]),
        [{ id: "p1", label: "class_edit_policy" }, { id: "p2", label: "p2" }]);
    assert.deepEqual(wxapp.permissionModel.policyOptions(undefined), []);
});

test("group options label the primary chip and escape the dropdown markup", () => {
    const { wxapp } = load();
    assert.deepEqual(
        wxapp.permissionModel.groupOptions([{ id: "g1", name: "IT Support" }, { id: "g2" }]),
        [
            { id: "g1", value: "g1", label: "IT Support", color: "wx-selection-primary", content: "IT Support" },
            { id: "g2", value: "g2", label: "g2", color: "wx-selection-primary", content: "g2" }
        ]);

    // the dropdown entry is built from markup, so a directory name never becomes one
    assert.equal(
        wxapp.permissionModel.groupOptions([{ id: "g1", name: "<b>A</b> & B" }])[0].content,
        "&lt;b&gt;A&lt;/b&gt; &amp; B");

    assert.deepEqual(wxapp.permissionModel.groupOptions(undefined), []);
});

test("page count never drops below one page", () => {
    const { wxapp } = load();
    assert.equal(wxapp.permissionModel.pageCount(0, 10), 1);
    assert.equal(wxapp.permissionModel.pageCount(10, 10), 1);
    assert.equal(wxapp.permissionModel.pageCount(11, 10), 2);
    assert.equal(wxapp.permissionModel.pageCount(25, 10), 3);
    assert.equal(wxapp.permissionModel.pageCount(5, 0), 5);
});

test("clamp page keeps the index inside the range", () => {
    const { wxapp } = load();
    assert.equal(wxapp.permissionModel.clampPage(0, 3), 0);
    assert.equal(wxapp.permissionModel.clampPage(2, 3), 2);
    assert.equal(wxapp.permissionModel.clampPage(5, 3), 2);
    assert.equal(wxapp.permissionModel.clampPage(-1, 3), 0);
    assert.equal(wxapp.permissionModel.clampPage(4, 0), 0);
});

test("entry path encodes the group segment", () => {
    const { wxapp } = load();
    assert.equal(wxapp.permissionModel.entryPath("a b/c"), "/a%20b%2Fc");
});

test("model loads, adds, updates and revokes through a service end to end", async () => {
    const { wxapp, setFetch } = load();
    const calls = [];
    setFetch(async (url, init) => {
        const method = (init && init.method) || "GET";
        calls.push({ url: url, method: method, body: init && init.body });
        if (method === "GET") {
            return {
                ok: true, status: 200, json: async () => ({
                    items: [{ groupId: "g1", groupName: "IT Support", policyIds: ["p1"] }],
                    total: 1,
                    assignedGroupIds: ["g1"]
                })
            };
        }
        if (method === "DELETE") {
            return { ok: true, status: 204 };
        }
        return {
            ok: true, status: 200, json: async () =>
                ({ groupId: "g2", groupName: "Service Desk", policyIds: ["p2"] })
        };
    });

    const service = wxapp.ServiceRegistry.create({ name: "data", kind: "rest", baseUri: "/api/permissions", method: "GET" });

    const loaded = await service.query({ search: "desk", page: 1, pageSize: 10 });
    assert.equal(calls[0].method, "GET");
    // the logical vocabulary maps onto the historical wire names
    assert.ok(calls[0].url.includes("q=desk"));
    assert.ok(calls[0].url.includes("p=1"));
    assert.ok(calls[0].url.includes("l=10"));
    const page = wxapp.permissionModel.normalizeList(loaded.data);
    assert.deepEqual(page.items.map((x) => x.groupId), ["g1"]);
    assert.deepEqual(page.assignedGroupIds, ["g1"]);

    const created = await service.create({ groupId: "g2", policyIds: ["p2"] });
    assert.equal(calls[1].method, "POST");
    assert.deepEqual(JSON.parse(calls[1].body), { groupId: "g2", policyIds: ["p2"] });
    assert.equal(created.data.groupId, "g2");

    const updated = await service.update({ policyIds: ["p2"] }, { path: wxapp.permissionModel.entryPath("g2") });
    assert.equal(calls[2].method, "PUT");
    assert.equal(calls[2].url.endsWith("/g2"), true);
    assert.deepEqual(JSON.parse(calls[2].body), { policyIds: ["p2"] });
    assert.equal(updated.ok, true);

    const removed = await service.remove({ path: wxapp.permissionModel.entryPath("g1") });
    assert.equal(calls[3].method, "DELETE");
    assert.equal(calls[3].url.endsWith("/g1"), true);
    assert.equal(removed.ok, true);
    assert.equal(removed.data, null);
});
