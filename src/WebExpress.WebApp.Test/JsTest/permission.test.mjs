/**
 * Headless behaviour tests for the permission control. They instantiate the
 * real control file on the real runtime and assert that it renders the
 * assignments as a table of one row per group and nothing else, assigns a
 * further group through the dialog the toolbar opens, revokes a group through
 * DELETE and replaces a policy set through PUT. The surface derives from the
 * REST table, so the table control and the WebUI column templates are part of
 * the runtime.
 *
 * Run with Node 18 or newer from the JsTest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadControl } from "./controls.harness.mjs";

const GROUPS = [
    { id: "g1", name: "IT Support" },
    { id: "g2", name: "Service Desk" },
    { id: "g3", name: "Incident Managers" }
];

const POLICIES = [
    { id: "p1", name: "class_edit_policy" },
    { id: "p2", name: "class_view_policy" },
    { id: "p3", name: "class_admin_policy" }
];

// the assign dialog is the framework modal, which drives the bootstrap dialog;
// headless it only has to open and close, which is what the surface observes
const BOOTSTRAP_STUB = {
    Modal: class {
        static _instances = new Map();

        static getInstance(element) {
            return BOOTSTRAP_STUB.Modal._instances.get(element) || null;
        }

        constructor(element) {
            this._element = element;
            BOOTSTRAP_STUB.Modal._instances.set(element, this);
        }

        show() {
            this._element.classList.add("show");
        }

        hide() {
            this._element.classList.remove("show");
        }
    }
};

/**
 * Loads the runtime with the permission control on top of the REST table.
 * @returns {object} The loaded runtime.
 */
function load() {
    return loadControl({
        deps: [
            "webexpress.webapp.table.model.js",
            "webexpress.webapp.table.js",
            "webexpress.webapp.permission.model.js"
        ],
        file: "webexpress.webapp.permission.js",
        extraGlobals: { bootstrap: BOOTSTRAP_STUB }
    });
}

/**
 * Builds a fetch mock over an entry store, recording every call.
 * @param {object} rt - The loaded runtime.
 * @param {Array<object>} entries - The entries the data endpoint answers with.
 * @param {object} [options] - A rejectGroup predicate that fails the POST of one group.
 * @returns {Array<object>} The recorded calls.
 */
function stubFetch(rt, entries, options = {}) {
    const calls = [];

    rt.setFetch(async (url, init) => {
        const method = (init && init.method) || "GET";
        calls.push({ url: url, method: method, body: init && init.body });

        if (url.includes("/api/groups")) {
            return { ok: true, status: 200, json: async () => GROUPS };
        }
        if (url.includes("/api/policies")) {
            return { ok: true, status: 200, json: async () => POLICIES };
        }
        if (method === "DELETE") {
            return { ok: true, status: 204 };
        }
        if (method === "POST" && options.rejectGroup === JSON.parse(init.body).groupId) {
            return { ok: false, status: 409, json: async () => ({}) };
        }
        if (method === "POST" || method === "PUT") {
            return { ok: true, status: 200, json: async () => entries[0] };
        }
        return {
            ok: true,
            status: 200,
            json: async () => ({
                items: entries,
                total: entries.length,
                assignedGroupIds: entries.map((x) => x.groupId)
            })
        };
    });

    return calls;
}

/**
 * Builds the host the server renders: the marker class, the page size and the
 * three service islands.
 * @param {object} rt - The loaded runtime.
 * @param {object} [options] - Overrides such as readonly.
 * @returns {object} The host element.
 */
function createHost(rt, options = {}) {
    const element = rt.createElement("div");
    element.id = "permissions";
    element.classList.add("wx-webapp-permission");
    element.setAttribute("data-page-size", String(options.pageSize || 10));
    element.dataset.pageSize = String(options.pageSize || 10);

    if (options.readonly) {
        element.setAttribute("data-readonly", "true");
        element.dataset.readonly = "true";
    }

    for (const descriptor of [
        { name: "data", baseUri: "/api/permissions" },
        { name: "groups", baseUri: "/api/groups" },
        { name: "policies", baseUri: "/api/policies" }
    ]) {
        const island = rt.document.createElement("wx-service");
        island.setAttribute("name", descriptor.name);
        island.setAttribute("kind", "rest");
        island.setAttribute("base-uri", descriptor.baseUri);
        island.setAttribute("method", "GET");
        element.appendChild(island);
    }

    rt.document.body.appendChild(element);
    return element;
}

/**
 * Drains the microtask and macrotask queues so the load, the directories and
 * the batched render have completed.
 * @returns {Promise<void>} Resolves once the queues are drained.
 */
async function settle() {
    for (let round = 0; round < 5; round++) {
        for (let i = 0; i < 40; i++) {
            await Promise.resolve();
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
}

test("permission renders one row per group with the policies as chips", async () => {
    const rt = load();
    stubFetch(rt, [
        { groupId: "g1", groupName: "IT Support", policyIds: ["p1", "p2"] },
        { groupId: "g2", groupName: "Service Desk", policyIds: ["p2"] }
    ]);

    const ctrl = new rt.wxapp.PermissionCtrl(createHost(rt));
    await settle();

    assert.deepEqual(ctrl.value, [
        { groupId: "g1", policyIds: ["p1", "p2"] },
        { groupId: "g2", policyIds: ["p2"] }
    ]);

    const rows = ctrl._body.children;
    assert.equal(rows.length, 2, "the table holds the stored assignments and nothing else");
    assert.ok(rows[0].textContent.includes("IT Support"), "the first column names the group");

    // the chips resolve their labels through the policy directory
    assert.ok(rows[0].textContent.includes("class_edit_policy"), "the policy chips are labelled");
    assert.ok(rows[0].textContent.includes("class_view_policy"), "every policy of the group is a chip");
});

test("permission assigns through the dialog the toolbar opens, not through a row", async () => {
    const rt = load();
    stubFetch(rt, [{ groupId: "g1", groupName: "IT Support", policyIds: ["p1"] }]);

    const ctrl = new rt.wxapp.PermissionCtrl(createHost(rt));
    await settle();

    assert.ok(ctrl._assignButton, "the assign affordance sits in the toolbar above the table");
    assert.equal(ctrl._body.children.length, 1, "the table carries no row for the assignment");

    ctrl._openAssignDialog();
    await settle();

    // the picker offers the groups that do not own a row yet, as primary chips
    assert.deepEqual(ctrl._groupPicker.options.map((option) => option.id), ["g2", "g3"]);
    assert.ok(ctrl._groupPicker.options.every((option) => option.color === "wx-selection-primary"));

    // at least one group is required, so the dialog cannot be confirmed without one
    assert.equal(ctrl._confirmButton.disabled, true);
    ctrl._groupPicker.value = ["g2"];
    assert.equal(ctrl._confirmButton.disabled, false);

    // several groups receive the same policy set in one pass
    assert.equal(ctrl._groupPicker.multiSelect, true);
    ctrl._groupPicker.value = ["g2", "g3"];
    assert.deepEqual(ctrl._groupPicker.value, ["g2", "g3"]);
});

test("permission disables the assign affordance once every group owns a row", async () => {
    const rt = load();
    stubFetch(rt, GROUPS.map((group) => ({ groupId: group.id, groupName: group.name, policyIds: ["p1"] })));

    const ctrl = new rt.wxapp.PermissionCtrl(createHost(rt));
    await settle();

    assert.equal(ctrl._assignButton.disabled, true);
    assert.ok(ctrl._assignButton.title.length > 0, "the button says why it cannot be used");
});

test("permission assigns the policy set to every picked group and closes the dialog", async () => {
    const rt = load();
    const calls = stubFetch(rt, [{ groupId: "g1", groupName: "IT Support", policyIds: ["p1"] }]);

    const ctrl = new rt.wxapp.PermissionCtrl(createHost(rt));
    await settle();

    const events = [];
    ctrl._element.addEventListener(rt.wxapp.Event.PERMISSION_ASSIGNED_EVENT, (e) => events.push(e.detail.groupId));

    ctrl._openAssignDialog();
    await settle();

    ctrl._groupPicker.value = ["g2", "g3"];
    ctrl._policyEditor.value = ["p2", "p3"];
    await ctrl._assign();
    await settle();

    const posts = calls.filter((call) => call.method === "POST").map((call) => JSON.parse(call.body));
    assert.deepEqual(posts, [
        { groupId: "g2", policyIds: ["p2", "p3"] },
        { groupId: "g3", policyIds: ["p2", "p3"] }
    ], "every picked group is an entry of its own on the endpoint");

    // one event per group, so a listener hears about each assignment
    assert.deepEqual(events, ["g2", "g3"]);

    // the dialog is done once every assignment was written
    assert.equal(ctrl._dialog._element.classList.contains("show"), false);
});

test("permission keeps the dialog open with the groups the endpoint rejected", async () => {
    const rt = load();
    const calls = stubFetch(rt, [{ groupId: "g1", groupName: "IT Support", policyIds: ["p1"] }], { rejectGroup: "g3" });

    const ctrl = new rt.wxapp.PermissionCtrl(createHost(rt));
    await settle();

    ctrl._openAssignDialog();
    await settle();

    ctrl._groupPicker.value = ["g2", "g3"];
    await ctrl._assign();
    await settle();

    assert.equal(calls.filter((call) => call.method === "POST").length, 2, "a rejected group does not stop the batch");
    assert.equal(ctrl._dialog._element.classList.contains("show"), true, "the dialog stays open for the retry");
    assert.deepEqual(ctrl._groupPicker.value, ["g3"], "only what was rejected is still picked");
});

test("permission reopens the dialog empty and against the current state", async () => {
    const rt = load();
    stubFetch(rt, [{ groupId: "g1", groupName: "IT Support", policyIds: ["p1"] }]);

    const ctrl = new rt.wxapp.PermissionCtrl(createHost(rt));
    await settle();

    ctrl._openAssignDialog();
    await settle();
    ctrl._groupPicker.value = ["g2"];
    ctrl._policyEditor.value = ["p2"];
    ctrl._dialog.hide();

    ctrl._openAssignDialog();
    await settle();

    assert.deepEqual(ctrl._groupPicker.value, [], "a discarded pick is not resumed");
    assert.deepEqual(ctrl._policyEditor.value, []);
    assert.equal(ctrl._confirmButton.disabled, true);
});

test("permission writes an inline edit of the chips through PUT", async () => {
    const rt = load();
    const calls = stubFetch(rt, [{ groupId: "g1", groupName: "IT Support", policyIds: ["p1"] }]);

    const ctrl = new rt.wxapp.PermissionCtrl(createHost(rt));
    await settle();

    await ctrl._setPolicies("g1", ["p1", "p3"]);
    await settle();

    const put = calls.find((call) => call.method === "PUT");
    assert.ok(put, "the policy set is written with a PUT");
    assert.ok(put.url.endsWith("/g1"), "the group is addressed through the path");
    assert.deepEqual(JSON.parse(put.body), { policyIds: ["p1", "p3"] });
});

test("permission revokes a group through DELETE and reloads", async () => {
    const rt = load();
    const calls = stubFetch(rt, [{ groupId: "g 1", groupName: "IT Support", policyIds: ["p1"] }]);

    const ctrl = new rt.wxapp.PermissionCtrl(createHost(rt));
    await settle();

    await ctrl._revoke("g 1");
    await settle();

    const remove = calls.find((call) => call.method === "DELETE");
    assert.ok(remove, "the revocation is a DELETE");
    assert.ok(remove.url.endsWith("/g%201"), "the group id is encoded into the path");
});

test("permission offers the revoke entry in the options menu of every row", async () => {
    const rt = load();
    stubFetch(rt, [{ groupId: "g1", groupName: "IT Support", policyIds: ["p1"] }]);

    const ctrl = new rt.wxapp.PermissionCtrl(createHost(rt));
    await settle();

    const options = ctrl._rows[0].options;
    assert.equal(options.length, 1);
    assert.equal(options[0].command, "revoke");
    assert.equal(options[0].groupId, "g1");
});

test("permission readonly drops the toolbar, the options and the inline edit", async () => {
    const rt = load();
    stubFetch(rt, [{ groupId: "g1", groupName: "IT Support", policyIds: ["p1"] }]);

    const ctrl = new rt.wxapp.PermissionCtrl(createHost(rt, { readonly: true }));
    await settle();

    assert.equal(ctrl._assignButton, undefined, "a read-only surface offers no way to assign");
    assert.equal(ctrl._rows[0].options, null);
    assert.equal(ctrl._columns[1].rendererOptions.editable, false);
});

test("permission pages through the pagination control it is bound to", async () => {
    const rt = load();

    const entries = [];
    for (let i = 0; i < 25; i++) {
        entries.push({ groupId: `g${i}`, groupName: `Group ${i}`, policyIds: ["p1"] });
    }

    const calls = stubFetch(rt, entries);

    const host = createHost(rt, { pageSize: 10 });
    host.setAttribute("data-wx-source-paging", "#permissions_pager");
    host.dataset.wxSourcePaging = "#permissions_pager";

    // the pager is created by the controller, exactly as the emitted markup is
    // picked up on a page, so the surface finds its instance
    const pager = rt.createElement("div");
    pager.id = "permissions_pager";
    pager.classList.add("wx-webui-pagination");
    rt.document.body.appendChild(pager);
    rt.wx.Controller.createInstances(pager);
    const pagerCtrl = rt.wx.Controller.getInstanceByElement(pager);

    const ctrl = new rt.wxapp.PermissionCtrl(host);
    await settle();

    // the stub answers with the whole store, so the page count follows the
    // reported total rather than the received rows
    assert.equal(pagerCtrl.total, 3);

    ctrl.paging(2);
    await settle();

    const paged = calls.filter((call) => call.method === "GET" && call.url.includes("/api/permissions"));
    assert.ok(paged[paged.length - 1].url.includes("p=2"), "the requested page reaches the endpoint");
});
