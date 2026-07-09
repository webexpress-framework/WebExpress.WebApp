/**
 * Headless tests for the permission control on the Component base (View,
 * State and Service). They instantiate the real control file in the harness
 * (alongside its model) and assert that it extends Component, seeds its
 * assignments from the wx-state island and skips the network load in that
 * case, otherwise loads from the service, renders the table and the pager,
 * assigns through POST and revokes a pair through DELETE. An assignment is
 * the pair (groupId, policyId): a group may carry several policies, so the
 * selects exclude pairs rather than groups.
 *
 * The search box is the embedded webexpress.webui.SearchCtrl, which is not
 * part of the engine harness; the control degrades to a surface without a
 * search box there, and the filter path is driven through the host event.
 *
 * Run with Node 18 or newer from the JsTest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, webappAsset, appendServiceIsland, appendStateIsland } from "./harness.mjs";

function load(options) {
    return loadEngine(Object.assign(
        {
            extraFiles: [
                webappAsset("webexpress.webapp.permission.model.js"),
                webappAsset("webexpress.webapp.permission.js")
            ]
        },
        options
    ));
}

/**
 * Awaits the asynchronous load and the batched store notification.
 * @returns {Promise<void>} Resolves after the macrotask and microtask queues drain.
 */
function settle() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

test("permission extends the component base", () => {
    const { wxapp, createElement, setFetch, document } = load();
    setFetch(async () => ({ ok: true, status: 200, json: async () => ({ items: [], total: 0 }) }));

    const element = createElement("div");
    appendServiceIsland(document, element, { name: "data", kind: "rest", baseUri: "/api/permissions", method: "GET" });

    const ctrl = new wxapp.PermissionCtrl(element);

    assert.ok(ctrl instanceof wxapp.Data);
    assert.equal(typeof ctrl.store, "object");
});

test("permission seeds its assignments from the wx-state island and skips the load", async () => {
    const { wxapp, createElement, setFetch, document } = load();
    let fetchCount = 0;
    setFetch(async () => { fetchCount++; return { ok: true, status: 200, json: async () => ({ items: [], total: 0 }) }; });

    const element = createElement("div");
    appendServiceIsland(document, element, { name: "data", kind: "rest", baseUri: "/api/permissions", method: "GET" });
    appendStateIsland(document, element, {
        assignments: [{ groupId: "g1", groupName: "IT Support", policyId: "p1", policyName: "class_edit_policy" }],
        total: 1
    });

    const ctrl = new wxapp.PermissionCtrl(element);

    // the store is seeded synchronously, so the value is available at once
    assert.equal(ctrl.value.length, 1);
    assert.equal(ctrl.value[0].groupId, "g1");

    // the seed also derives the pair set for the select exclusion
    assert.deepEqual(ctrl.state.assignedPairs, [{ groupId: "g1", policyId: "p1" }]);

    // the table renders the seeded row on mount
    assert.equal(ctrl._tbody.childNodes.length, 1);
    assert.equal(ctrl._tbody.childNodes[0].childNodes[0].textContent, "IT Support");
    assert.equal(ctrl._tbody.childNodes[0].childNodes[1].textContent, "class_edit_policy");

    // the seed avoids the round trip
    await settle();
    assert.equal(fetchCount, 0);
});

test("permission loads from the service when no state island is present", async () => {
    const { wxapp, createElement, setFetch, document } = load();
    const calls = [];
    setFetch(async (url) => {
        calls.push(url);
        return {
            ok: true, status: 200, json: async () => ({
                items: [{ groupId: "g9", groupName: "Incident Managers", policyId: "p3", policyName: "class_admin_policy" }],
                total: 1
            })
        };
    });

    const element = createElement("div");
    appendServiceIsland(document, element, { name: "data", kind: "rest", baseUri: "/api/permissions", method: "GET" });

    const ctrl = new wxapp.PermissionCtrl(element);
    assert.equal(ctrl.value.length, 0);

    await settle();

    assert.equal(calls.length, 1);
    assert.ok(calls[0].includes("p=0"));
    assert.ok(calls[0].includes("l=10"));
    assert.equal(ctrl.value.length, 1);
    assert.equal(ctrl.value[0].groupId, "g9");
});

test("permission fills the assign selects from the groups and policies services", async () => {
    const { wxapp, createElement, setFetch, document } = load();
    setFetch(async (url) => {
        if (url.includes("/api/groups")) {
            return { ok: true, status: 200, json: async () => [{ id: "g1", name: "IT Support" }] };
        }
        if (url.includes("/api/policies")) {
            return { ok: true, status: 200, json: async () => [{ id: "p1", name: "class_edit_policy", description: "Edit" }] };
        }
        return { ok: true, status: 200, json: async () => ({ items: [], total: 0 }) };
    });

    const element = createElement("div");
    appendServiceIsland(document, element, { name: "data", kind: "rest", baseUri: "/api/permissions", method: "GET" });
    appendServiceIsland(document, element, { name: "groups", kind: "rest", baseUri: "/api/groups", method: "GET" });
    appendServiceIsland(document, element, { name: "policies", kind: "rest", baseUri: "/api/policies", method: "GET" });

    const ctrl = new wxapp.PermissionCtrl(element);
    await settle();

    // one placeholder option plus the loaded record each
    assert.equal(ctrl._groupSelect.select.childNodes.length, 2);
    assert.equal(ctrl._groupSelect.select.childNodes[1].textContent, "IT Support");
    assert.equal(ctrl._policySelect.select.childNodes.length, 2);
    assert.equal(ctrl._policySelect.select.childNodes[1].textContent, "class_edit_policy");
});

test("permission excludes the selected group's policies from the policy select", async () => {
    const { wxapp, createElement, setFetch, document } = load();
    setFetch(async (url) => {
        if (url.includes("/api/groups")) {
            return {
                ok: true, status: 200, json: async () => [
                    { id: "g1", name: "IT Support" },
                    { id: "g2", name: "Service Desk" }
                ]
            };
        }
        if (url.includes("/api/policies")) {
            return {
                ok: true, status: 200, json: async () => [
                    { id: "p1", name: "class_edit_policy" },
                    { id: "p2", name: "class_view_policy" }
                ]
            };
        }
        return {
            ok: true, status: 200, json: async () => ({
                items: [{ groupId: "g1", groupName: "IT Support", policyId: "p1", policyName: "class_edit_policy" }],
                total: 1,
                assignedPairs: [{ groupId: "g1", policyId: "p1" }]
            })
        };
    });

    const element = createElement("div");
    appendServiceIsland(document, element, { name: "data", kind: "rest", baseUri: "/api/permissions", method: "GET" });
    appendServiceIsland(document, element, { name: "groups", kind: "rest", baseUri: "/api/groups", method: "GET" });
    appendServiceIsland(document, element, { name: "policies", kind: "rest", baseUri: "/api/policies", method: "GET" });

    const ctrl = new wxapp.PermissionCtrl(element);
    await settle();

    // without a selected group the full policy directory is offered, and g1
    // stays selectable because it does not carry every policy yet
    assert.deepEqual(ctrl._groupSelect.select.childNodes.map((o) => o.value), ["", "g1", "g2"]);
    assert.deepEqual(ctrl._policySelect.select.childNodes.map((o) => o.value), ["", "p1", "p2"]);

    // selecting g1 narrows the policies to the unassigned one
    ctrl._groupSelect.select.value = "g1";
    ctrl._renderPolicyOptions();
    assert.deepEqual(ctrl._policySelect.select.childNodes.map((o) => o.value), ["", "p2"]);
});

test("permission drops a fully assigned group from the group select", async () => {
    const { wxapp, createElement, setFetch, document } = load();
    setFetch(async (url) => {
        if (url.includes("/api/groups")) {
            return {
                ok: true, status: 200, json: async () => [
                    { id: "g1", name: "IT Support" },
                    { id: "g2", name: "Service Desk" }
                ]
            };
        }
        if (url.includes("/api/policies")) {
            return {
                ok: true, status: 200, json: async () => [
                    { id: "p1", name: "class_edit_policy" },
                    { id: "p2", name: "class_view_policy" }
                ]
            };
        }
        return {
            ok: true, status: 200, json: async () => ({
                items: [{ groupId: "g1", groupName: "IT Support", policyId: "p1", policyName: "class_edit_policy" }],
                total: 3,
                assignedPairs: [
                    { groupId: "g1", policyId: "p1" },
                    { groupId: "g1", policyId: "p2" },
                    { groupId: "g2", policyId: "p1" }
                ]
            })
        };
    });

    const element = createElement("div");
    appendServiceIsland(document, element, { name: "data", kind: "rest", baseUri: "/api/permissions", method: "GET" });
    appendServiceIsland(document, element, { name: "groups", kind: "rest", baseUri: "/api/groups", method: "GET" });
    appendServiceIsland(document, element, { name: "policies", kind: "rest", baseUri: "/api/policies", method: "GET" });

    const ctrl = new wxapp.PermissionCtrl(element);
    await settle();

    // g1 carries every policy (even though only one row is on this page), g2
    // can still receive p2
    assert.deepEqual(ctrl._groupSelect.select.childNodes.map((o) => o.value), ["", "g2"]);
});

test("permission assigns through POST and reloads the page", async () => {
    const { wxapp, createElement, setFetch, document } = load();
    const calls = [];
    setFetch(async (url, init) => {
        const method = (init && init.method) || "GET";
        calls.push({ url: url, method: method, body: init && init.body });
        if (method === "POST") {
            return {
                ok: true, status: 200, json: async () =>
                    ({ groupId: "g2", groupName: "Service Desk", policyId: "p2", policyName: "class_view_policy" })
            };
        }
        return {
            ok: true, status: 200, json: async () => ({
                items: [{ groupId: "g2", groupName: "Service Desk", policyId: "p2", policyName: "class_view_policy" }],
                total: 1
            })
        };
    });

    const element = createElement("div");
    appendServiceIsland(document, element, { name: "data", kind: "rest", baseUri: "/api/permissions", method: "GET" });
    appendStateIsland(document, element, { assignments: [{ groupId: "g1", groupName: "IT", policyId: "p1", policyName: "x" }], total: 1 });

    const ctrl = new wxapp.PermissionCtrl(element);

    ctrl._groupSelect.select.value = "g2";
    ctrl._policySelect.select.value = "p2";
    await ctrl._assign();

    assert.equal(calls[0].method, "POST");
    assert.deepEqual(JSON.parse(calls[0].body), { groupId: "g2", policyId: "p2" });

    // the reload keeps paging and filtering authoritative on the server
    assert.equal(calls[1].method, "GET");
    assert.equal(ctrl.value.length, 1);
    assert.equal(ctrl.value[0].groupId, "g2");

    // the selects return to the placeholder after a successful assign
    assert.equal(ctrl._groupSelect.select.value, "");
    assert.equal(ctrl._policySelect.select.value, "");
});

test("permission revokes a pair through DELETE and reloads the page", async () => {
    const { wxapp, createElement, setFetch, document } = load();
    const calls = [];
    setFetch(async (url, init) => {
        const method = (init && init.method) || "GET";
        calls.push({ url: url, method: method });
        if (method === "DELETE") {
            return { ok: true, status: 204 };
        }
        return { ok: true, status: 200, json: async () => ({ items: [], total: 0 }) };
    });

    const element = createElement("div");
    appendServiceIsland(document, element, { name: "data", kind: "rest", baseUri: "/api/permissions", method: "GET" });
    appendStateIsland(document, element, { assignments: [{ groupId: "g 1", groupName: "IT", policyId: "p1", policyName: "x" }], total: 1 });

    const ctrl = new wxapp.PermissionCtrl(element);
    await ctrl._remove(ctrl.value[0]);

    assert.equal(calls[0].method, "DELETE");
    // both pair segments are encoded into the path
    assert.equal(calls[0].url.endsWith("/g%201/p1"), true);
    assert.equal(calls[1].method, "GET");
    assert.equal(ctrl.value.length, 0);
});

test("permission filters through the search host event with a debounce", async () => {
    const { wxapp, createElement, setFetch, document } = load();
    const calls = [];
    setFetch(async (url) => {
        calls.push(url);
        return { ok: true, status: 200, json: async () => ({ items: [], total: 0 }) };
    });

    const element = createElement("div");
    appendServiceIsland(document, element, { name: "data", kind: "rest", baseUri: "/api/permissions", method: "GET" });
    appendStateIsland(document, element, { assignments: [{ groupId: "g1", groupName: "IT", policyId: "p1", policyName: "x" }], total: 1 });

    const ctrl = new wxapp.PermissionCtrl(element);

    // the embedded search control announces its value through the filter
    // event on its host; the harness drives the host directly, because the
    // webui control itself is not part of the engine harness (the event name
    // resolves to undefined in the stub, on both sides)
    ctrl._searchHost.dispatchEvent({ type: undefined, detail: { value: "desk" } });

    // the debounce delays the query
    assert.equal(calls.length, 0);
    await new Promise((resolve) => setTimeout(resolve, 300));

    assert.equal(calls.length, 1);
    assert.ok(calls[0].includes("q=desk"));
    assert.ok(calls[0].includes("p=0"));
    assert.equal(ctrl.state.search, "desk");
});

test("permission renders the pager window and hides it for a single page", () => {
    const { wxapp, createElement, setFetch, document } = load();
    setFetch(async () => ({ ok: true, status: 200, json: async () => ({ items: [], total: 0 }) }));

    const element = createElement("div");
    appendServiceIsland(document, element, { name: "data", kind: "rest", baseUri: "/api/permissions", method: "GET" });
    appendStateIsland(document, element, {
        assignments: [{ groupId: "g1", groupName: "IT", policyId: "p1", policyName: "x" }],
        total: 25
    });

    const ctrl = new wxapp.PermissionCtrl(element);

    // prev, three pages (25 rows at page size 10) and next
    assert.equal(ctrl._pager.childNodes.length, 5);
    assert.equal(ctrl._pager.childNodes[0].disabled, true);
    assert.equal(ctrl._pager.childNodes[1].textContent, "1");
    assert.ok(ctrl._pager.childNodes[1].classList.contains("wx-permission-pager-current"));
    assert.equal(ctrl._pager.childNodes[4].disabled, false);

    // a single page renders no pager
    ctrl.setState({ total: 5 });
    ctrl._renderPager();
    assert.equal(ctrl._pager.childNodes.length, 0);
});

test("permission readonly suppresses the assign row and the remove affordance", () => {
    const { wxapp, createElement, setFetch, document } = load();
    setFetch(async () => ({ ok: true, status: 200, json: async () => ({ items: [], total: 0 }) }));

    const element = createElement("div");
    element.dataset.readonly = "true";
    element.setAttribute("data-readonly", "true");
    appendServiceIsland(document, element, { name: "data", kind: "rest", baseUri: "/api/permissions", method: "GET" });
    appendStateIsland(document, element, { assignments: [{ groupId: "g1", groupName: "IT", policyId: "p1", policyName: "x" }], total: 1 });

    const ctrl = new wxapp.PermissionCtrl(element);

    assert.equal(ctrl._assignRow, undefined);
    // the action cell of the row stays empty
    assert.equal(ctrl._tbody.childNodes[0].childNodes[2].childNodes.length, 0);
});
