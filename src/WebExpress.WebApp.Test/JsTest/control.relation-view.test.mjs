/**
 * End-to-end tests for the link surface (wx-webapp-relation-view) and its add dialog.
 *
 * They run the whole path against the shipped code: the real WebUI runtime, the
 * WebApp engine, the model, the dialog, the two native panels and the control
 * itself. The shared contract covers registration and teardown; the tests below
 * cover what the surface adds on top of the engine - the grouping it renders,
 * the perspective that decides which end of a link is shown, the category tabs
 * that re-query the endpoint, the lifecycle actions and the dialog that reads
 * its sidebar from the registered systems.
 */

import { test } from "node:test";
import assert from "node:assert";
import { contract } from "./controls.contract.mjs";
import { loadControl } from "./controls.harness.mjs";
import { appendServiceIsland, appendStateIsland } from "./harness.mjs";

const DEPS = [
    // the shipped english bundle, so the assertions read the captions a user
    // sees rather than the raw i18n keys
    "i18n/en.js",
    "webexpress.webapp.input.selection.model.js",
    "webexpress.webapp.input.selection.js",
    "webexpress.webapp.relation.view.model.js",
    "panels/webexpress.webapp.panel.relation.object.js",
    "panels/webexpress.webapp.panel.relation.web.js"
];

// the modal base drives the bootstrap dialog; headless it only has to open and
// close, which is what the surface observes
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
const FILE = "webexpress.webapp.relation.view.js";

const RESULT = {
    total: 4,
    objectCount: 3,
    externalCount: 1,
    groups: [
        {
            type: "blocks",
            label: "blocks",
            counterpart: "is blocked by",
            icon: "flag",
            count: 1,
            items: [{
                id: "l1",
                type: "blocks",
                status: "active",
                inverse: false,
                created: "2026-08-19T10:00:00Z",
                comment: "same gateway",
                source: { key: "INC-00123" },
                target: { key: "CHG-00045", class: "Change", title: "Firmware update", status: "Approved", statusColor: "success", uri: "/change/45" }
            }]
        },
        {
            type: "causes",
            label: "is caused by",
            counterpart: "causes",
            inverse: true,
            icon: "bolt",
            count: 2,
            items: [
                {
                    id: "l2",
                    type: "causes",
                    status: "active",
                    inverse: true,
                    created: "2026-08-17T10:00:00Z",
                    source: { key: "CHG-00041", class: "Change", title: "Firmware patch", status: "Closed", statusColor: "info" },
                    target: { key: "INC-00123" }
                },
                {
                    id: "l3",
                    type: "causes",
                    status: "obsolete",
                    inverse: true,
                    created: "2026-08-15T10:00:00Z",
                    source: { key: "CHG-00040", class: "Change", title: "Older patch" },
                    target: { key: "INC-00123" }
                }
            ]
        },
        {
            type: "weblink",
            label: "Web link",
            icon: "arrow-up-right-from-square",
            count: 1,
            items: [{
                id: "l4",
                type: "weblink",
                status: "active",
                inverse: false,
                direction: "unidirectional",
                created: "2026-08-11T10:00:00Z",
                source: { key: "INC-00123" },
                target: { uri: "https://example.com/advisory", title: "Vendor advisory" }
            }]
        }
    ]
};

const SYSTEMS = [
    {
        id: "webexpress.webapp.relation.object",
        label: "Object",
        description: "Link to another item.",
        kind: "object",
        badge: "OBJ",
        types: [{ id: "blocks", label: "blocks" }, { id: "references", label: "references" }]
    },
    {
        id: "webexpress.webapp.relation.web",
        label: "Website",
        kind: "external",
        badge: "WEB",
        types: [{ id: "weblink", label: "Web link" }]
    },
    {
        id: "acme.github",
        label: "GitHub",
        kind: "object",
        badge: "GH",
        plugin: "acme.github",
        version: "1.4.0",
        types: [{ id: "gh.pull", label: "pull request" }]
    },
    {
        id: "acme.slack",
        label: "Slack",
        kind: "external",
        badge: "SL",
        plugin: "acme.slack",
        enabled: false,
        types: []
    }
];

contract({
    file: FILE,
    selector: "wx-webapp-relation-view",
    ctrl: "RelationViewCtrl",
    deps: DEPS
});

/**
 * Lets the pending work of the control complete: the microtask queue drains and
 * a macrotask turn follows, so a load started in the constructor has answered
 * and the batched store notification has re-rendered. The macrotask matters -
 * the number of microtask hops a request takes depends on how the stubbed fetch
 * is written, and a fixed turn count would make a test depend on that.
 * @param {number} [turns=8] - The number of microtask turns to yield first.
 */
async function settle(turns = 8) {
    for (let i = 0; i < turns; i++) {
        await Promise.resolve();
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Builds a loaded surface with the three service islands the control reads.
 * @param {object} [options={}] - The fetch handler and the host data attributes.
 * @returns {object} The runtime, the host and the recorded requests.
 */
function surface(options = {}) {
    const requests = [];
    const rt = loadControl({
        deps: DEPS,
        file: FILE,
        extraGlobals: { bootstrap: BOOTSTRAP_STUB },
        fetch: async (url, init) => {
            requests.push({ url: String(url), init: init || {} });
            return options.respond
                ? options.respond(String(url), init || {})
                : { ok: true, status: 200, json: async () => RESULT };
        }
    });

    const host = rt.createElement("div");
    host.classList.add("wx-webapp-relation-view");
    host.dataset.subject = options.subject || "INC-00123";

    for (const [name, value] of Object.entries(options.dataset || {})) {
        host.dataset[name] = value;
    }

    appendServiceIsland(rt.document, host, { name: "data", baseUri: "/api/links/INC-00123", method: "GET", updateMethod: "PUT", query: { kind: "kind", type: "type", search: "q" } });
    appendServiceIsland(rt.document, host, { name: "systems", baseUri: "/api/link-systems", method: "GET" });
    appendServiceIsland(rt.document, host, { name: "targets", baseUri: "/api/link-targets", method: "GET", query: { search: "q" } });
    rt.document.body.appendChild(host);

    return { rt, host, requests };
}

test("the surface loads its links and renders one section per relation", async () => {
    const { rt, host, requests } = surface();

    const ctrl = new rt.wxapp.RelationViewCtrl(host);
    await settle();

    assert.equal(requests.length, 1, "the links are loaded exactly once");
    assert.ok(requests[0].url.includes("/api/links/INC-00123"));
    assert.equal(ctrl.value.length, 4);

    const groups = host.querySelectorAll(".wx-relation-view-group");
    assert.equal(groups.length, 3, "each relation is its own section");

    const labels = host.querySelectorAll(".wx-relation-view-group-label").map((x) => x.textContent);
    assert.deepEqual(labels, ["blocks", "is caused by", "Web link"]);
});

test("a link is rendered from the end the surface is on", async () => {
    const { rt, host } = surface();

    new rt.wxapp.RelationViewCtrl(host);
    await settle();

    // the first group is read from the source, so the target is shown; the
    // second is read from the target, so the source is shown instead
    const keys = host.querySelectorAll(".wx-relation-view-key").map((x) => x.textContent);
    assert.deepEqual(keys, ["CHG-00045", "CHG-00041", "CHG-00040", "https://example.com/advisory"]);
});

test("the counterpart of a relation is named next to its heading", async () => {
    const { rt, host } = surface();

    new rt.wxapp.RelationViewCtrl(host);
    await settle();

    const counterparts = host.querySelectorAll(".wx-relation-view-group-counterpart").map((x) => x.textContent);
    assert.equal(counterparts.length, 2);
    assert.ok(counterparts[0].includes("is blocked by"), "the reader sees what the link says on the other side");
});

test("an obsolete link stays visible but is marked as such", async () => {
    const { rt, host } = surface();

    new rt.wxapp.RelationViewCtrl(host);
    await settle();

    const obsolete = host.querySelectorAll(".wx-relation-view-obsolete");
    assert.equal(obsolete.length, 1, "the relation that stopped holding is kept for the history");
});

test("the toolbar carries the add affordance as the primary action", async () => {
    const { rt, host } = surface();

    const ctrl = new rt.wxapp.RelationViewCtrl(host);
    await settle();

    assert.ok(ctrl._addButton.classList.contains("btn-primary"));

    // the surface lists every category together, so the only switch left is
    // the one between the two presentations
    assert.equal(host.querySelectorAll(".wx-relation-view-kind").length, 0);
    assert.equal(host.querySelectorAll(".wx-relation-view-settings").length, 0);
    assert.deepEqual(
        host.querySelectorAll(".wx-relation-view-view").map((x) => x.getAttribute("data-view-tab")),
        ["list", "graph"]);
});

test("the presentation switch needs no round trip", async () => {
    const { rt, host, requests } = surface();

    const ctrl = new rt.wxapp.RelationViewCtrl(host);
    await settle();
    requests.length = 0;

    ctrl._viewTabs.dispatchEvent({ type: "click", target: ctrl._graphTab });
    await settle();

    assert.equal(requests.length, 0, "the graph is derived from the links that are already loaded");
    assert.equal(host.querySelectorAll(".wx-relation-view-graph").length, 1);
    assert.ok(ctrl._graphTab.classList.contains("wx-relation-view-active"));
});

test("the graph marks the object the surface belongs to", async () => {
    const { rt, host } = surface();

    const ctrl = new rt.wxapp.RelationViewCtrl(host);
    await settle();
    ctrl.setState({ view: "graph" });
    await settle();

    const centre = ctrl._graphCtrl.model.nodes.find((node) => node.id === "INC-00123");
    assert.equal(centre.backgroundCss, rt.wxapp.relationViewModel.SUBJECT_NODE_CSS);
});

test("the list shows the object links and the external ones together", async () => {
    const { rt, host, requests } = surface();

    const ctrl = new rt.wxapp.RelationViewCtrl(host);
    await settle();

    assert.ok(!requests[0].url.includes("kind="), "the surface asks for every category at once");
    assert.equal(ctrl.value.length, 4);

    const keys = host.querySelectorAll(".wx-relation-view-key").map((x) => x.textContent);
    assert.ok(keys.includes("https://example.com/advisory"), "a web link is listed next to the object links");
});

test("every row starts with the icon of its relation", async () => {
    const { rt, host } = surface();

    new rt.wxapp.RelationViewCtrl(host);
    await settle();

    const icons = host.querySelectorAll(".wx-relation-view-row-icon");
    assert.equal(icons.length, 4, "one leading icon per row");
    assert.ok(icons[0].className.includes("flag"), "the row carries the icon its relation declares");
});

test("a contributed presentation joins the switch and is shown as its pane", async () => {
    const { rt, host } = surface();

    // the server renders a further presentation as a hidden pane inside the
    // host, carrying the caption and the icon of its switch entry
    const pane = rt.createElement("div");
    pane.classList.add("wx-relation-view-pane");
    pane.setAttribute("data-view", "timeline");
    pane.setAttribute("data-label", "Timeline");
    pane.setAttribute("data-icon", "wx-icon-light wx-icon-light-clock");
    pane.setAttribute("hidden", "hidden");
    pane.textContent = "the timeline";
    host.appendChild(pane);

    const ctrl = new rt.wxapp.RelationViewCtrl(host);
    await settle();

    assert.deepEqual(
        host.querySelectorAll(".wx-relation-view-view").map((x) => x.getAttribute("data-view-tab")),
        ["list", "graph", "timeline"],
        "the contributed presentation follows the built-in ones");

    const tab = host.querySelectorAll(".wx-relation-view-view")[2];
    assert.ok(tab.textContent.includes("Timeline"), "the caption comes from the pane");

    // the list is shown, the contributed pane is not
    assert.equal(pane.hasAttribute("hidden"), true);
    assert.equal(ctrl._body.hasAttribute("hidden"), false);

    ctrl._viewTabs.dispatchEvent({ type: "click", target: tab });
    await settle();

    assert.equal(pane.hasAttribute("hidden"), false, "switching reveals the server rendered pane");
    assert.equal(ctrl._body.hasAttribute("hidden"), true, "the built-in body steps aside");
    assert.ok(tab.classList.contains("wx-relation-view-active"));
});

test("a contributed presentation needs no round trip and keeps its content", async () => {
    const { rt, host, requests } = surface();

    const pane = rt.createElement("div");
    pane.classList.add("wx-relation-view-pane");
    pane.setAttribute("data-view", "timeline");
    pane.setAttribute("data-label", "Timeline");
    pane.setAttribute("hidden", "hidden");
    pane.textContent = "the timeline";
    host.appendChild(pane);

    const ctrl = new rt.wxapp.RelationViewCtrl(host);
    await settle();
    requests.length = 0;

    ctrl.setState({ view: "timeline" });
    await settle();
    ctrl.setState({ view: "list" });
    await settle();

    assert.equal(requests.length, 0, "the pane was rendered by the server, so nothing is fetched");
    assert.equal(pane.textContent, "the timeline", "the pane survives the switch back and forth");
    assert.equal(pane.hasAttribute("hidden"), true);
});

test("the surface opens on a contributed presentation when the page says so", async () => {
    const { rt, host } = surface({ dataset: { view: "timeline" } });

    const pane = rt.createElement("div");
    pane.classList.add("wx-relation-view-pane");
    pane.setAttribute("data-view", "timeline");
    pane.setAttribute("data-label", "Timeline");
    pane.setAttribute("hidden", "hidden");
    host.appendChild(pane);

    const ctrl = new rt.wxapp.RelationViewCtrl(host);
    await settle();

    assert.equal(pane.hasAttribute("hidden"), false);
    assert.equal(ctrl._body.hasAttribute("hidden"), true);
});

test("a seeded surface paints without a round trip", async () => {
    const { rt, host, requests } = surface();
    appendStateIsland(rt.document, host, { groups: RESULT.groups, total: RESULT.total });

    const ctrl = new rt.wxapp.RelationViewCtrl(host);
    await settle();

    assert.equal(requests.length, 0);
    assert.equal(ctrl.value.length, 4);
});

test("picking a row opens the detail dialog of that link", async () => {
    const { rt, host } = surface();

    const ctrl = new rt.wxapp.RelationViewCtrl(host);
    await settle();

    assert.equal(ctrl._detail, null, "the dialog is built on the first pick");

    const row = host.querySelectorAll(".wx-relation-view-row")[0];
    ctrl._body.dispatchEvent({ type: "click", target: row });
    await settle();

    assert.ok(ctrl._detail instanceof rt.wx.ModalCtrl, "the detail is the framework modal");
    assert.ok(ctrl._detailBody.textContent.includes("same gateway"), "the note is shown in the dialog");
    assert.ok(ctrl._detailBody.textContent.includes("CHG-00045"));
});

test("a click on the key follows the link instead of opening the dialog", async () => {
    const { rt, host } = surface();

    const ctrl = new rt.wxapp.RelationViewCtrl(host);
    await settle();

    const key = host.querySelectorAll(".wx-relation-view-key")[0];
    ctrl._body.dispatchEvent({ type: "click", target: key });
    await settle();

    assert.equal(ctrl._detail, null, "the linked object is opened, not the detail dialog");
});

test("the detail dialog offers what may be done with that link", async () => {
    const { rt, host } = surface();

    const ctrl = new rt.wxapp.RelationViewCtrl(host);
    await settle();

    ctrl._openDetail("l1");
    await settle();
    assert.deepEqual(
        ctrl._detailActions.querySelectorAll(".wx-relation-view-action").map((x) => x.getAttribute("data-command")),
        ["navigate", "remove"]);

    // a relation that already stopped holding offers the way back
    ctrl._openDetail("l3");
    await settle();
    assert.deepEqual(
        ctrl._detailActions.querySelectorAll(".wx-relation-view-action").map((x) => x.getAttribute("data-command")),
        ["reactivate", "remove"], "and nothing to navigate to, because the link carries no address");
});

test("a read-only surface still offers the way to the linked object", async () => {
    const { rt, host } = surface({ dataset: { readonly: "true" } });

    const ctrl = new rt.wxapp.RelationViewCtrl(host);
    await settle();

    ctrl._openDetail("l1");
    await settle();

    assert.deepEqual(
        ctrl._detailActions.querySelectorAll(".wx-relation-view-action").map((x) => x.getAttribute("data-command")),
        ["navigate"], "reading where the link points is not a change");
});

test("navigating opens the linked object and closes the dialog", async () => {
    const { rt, host } = surface();

    const ctrl = new rt.wxapp.RelationViewCtrl(host);
    await settle();

    ctrl._openDetail("l1");
    await settle();

    const opened = [];
    rt.sandbox.window.open = (uri, target) => opened.push([uri, target]);
    rt.sandbox.window.location.href = "";

    const navigate = ctrl._detailActions.querySelectorAll(".wx-relation-view-action")
        .find((x) => x.getAttribute("data-command") === "navigate");
    ctrl._detailActions.dispatchEvent({ type: "click", target: navigate });

    assert.equal(rt.sandbox.window.location.href, "/change/45", "an object of the application is opened in place");
    assert.deepEqual(opened, [], "and not beside it");
    assert.ok(!ctrl._detail._element.classList.contains("show"), "the dialog is done");
});

test("navigating to a web link leaves the application in a second tab", async () => {
    const { rt, host } = surface();

    const ctrl = new rt.wxapp.RelationViewCtrl(host);
    await settle();

    ctrl._openDetail("l4");
    await settle();

    const opened = [];
    rt.sandbox.window.open = (uri, target) => opened.push([uri, target]);
    rt.sandbox.window.location.href = "";

    const navigate = ctrl._detailActions.querySelectorAll(".wx-relation-view-action")
        .find((x) => x.getAttribute("data-command") === "navigate");
    ctrl._detailActions.dispatchEvent({ type: "click", target: navigate });

    assert.equal(opened.length, 1);
    assert.equal(opened[0][1], "_blank");
    assert.equal(rt.sandbox.window.location.href, "", "the page the surface sits on stays where it is");
});

test("an action of the detail dialog reaches the link it was opened for", async () => {
    const { rt, host, requests } = surface({
        respond: async (url, init) => (init.method === "DELETE"
            ? { ok: true, status: 204, json: async () => null }
            : { ok: true, status: 200, json: async () => RESULT })
    });

    const ctrl = new rt.wxapp.RelationViewCtrl(host);
    await settle();
    ctrl._openDetail("l2");
    await settle();
    requests.length = 0;

    const remove = ctrl._detailActions.querySelectorAll(".wx-relation-view-action")
        .find((x) => x.getAttribute("data-command") === "remove");
    ctrl._detailActions.dispatchEvent({ type: "click", target: remove });
    await settle();

    assert.equal(requests[0].init.method, "DELETE");
    assert.ok(requests[0].url.endsWith("/l2"));
});

test("a read-only surface offers neither the add affordance nor the link actions", async () => {
    const { rt, host } = surface({ dataset: { readonly: "true" } });

    const ctrl = new rt.wxapp.RelationViewCtrl(host);
    await settle();
    ctrl._openDetail("l1");
    await settle();

    assert.equal(host.querySelectorAll(".wx-relation-view-add").length, 0);
    assert.equal(ctrl._detailActions.querySelectorAll("[data-command=\"remove\"]").length, 0,
        "nothing that changes the link is offered");
});

test("marking a link obsolete persists the status and reloads", async () => {
    const { rt, host, requests } = surface();

    const ctrl = new rt.wxapp.RelationViewCtrl(host);
    await settle();
    requests.length = 0;

    const events = [];
    host.addEventListener(rt.wxapp.Event.RELATION_UPDATED_EVENT, () => events.push("updated"));

    await ctrl._setStatus("l1", "obsolete");
    await settle();

    assert.equal(requests[0].init.method, "PUT");
    assert.ok(requests[0].url.endsWith("/l1"));
    assert.deepEqual(JSON.parse(requests[0].init.body), { status: "obsolete" });
    assert.equal(requests.length, 2, "the surface reloads so the grouping stays authoritative");
    assert.deepEqual(events, ["updated"]);
});

test("removing a link deletes it and reloads", async () => {
    const { rt, host, requests } = surface({
        respond: async (url, init) => (init.method === "DELETE"
            ? { ok: true, status: 204, json: async () => null }
            : { ok: true, status: 200, json: async () => RESULT })
    });

    const ctrl = new rt.wxapp.RelationViewCtrl(host);
    await settle();
    requests.length = 0;

    const events = [];
    host.addEventListener(rt.wxapp.Event.RELATION_REMOVED_EVENT, () => events.push("removed"));

    await ctrl._remove("l1");
    await settle();

    assert.equal(requests[0].init.method, "DELETE");
    assert.ok(requests[0].url.endsWith("/l1"));
    assert.deepEqual(events, ["removed"]);
});

/**
 * Opens the add dialog of a loaded surface.
 * @param {object} ctrl - The link control.
 * @returns {Promise<object>} The dialog.
 */
async function openDialog(ctrl) {
    await ctrl._openDialog();

    // bootstrap announces the opened modal, which is what makes the framework
    // dialog select its first page, run that page's onShow and wire the submit
    // button; the headless bootstrap stub does not, so the test does
    ctrl._dialog._element.dispatchEvent({ type: "shown.bs.modal" });
    await settle();

    return ctrl._dialog;
}

/**
 * Reads the validation message the framework dialog shows.
 * @param {object} dialog - The dialog.
 * @returns {string} The message, or an empty string.
 */
function validationMessage(dialog) {
    const text = dialog._validationEl && dialog._validationEl.querySelector(".wx-alert-text");

    return text ? text.textContent : "";
}

/**
 * Builds a responder that answers the systems endpoint with the catalog and
 * everything else with the seeded links.
 * @param {Function} [extra] - An optional responder consulted first.
 * @returns {Function} The responder.
 */
function withSystems(extra) {
    return async (url, init) => {
        const answered = extra ? await extra(url, init) : null;

        if (answered) {
            return answered;
        }
        if (url.includes("link-systems")) {
            return { ok: true, status: 200, json: async () => SYSTEMS };
        }

        return { ok: true, status: 200, json: async () => RESULT };
    };
}

test("the dialog is the framework sidebar modal", async () => {
    const { rt, host } = surface({ respond: withSystems() });

    const ctrl = new rt.wxapp.RelationViewCtrl(host);
    await settle();
    const dialog = await openDialog(ctrl);

    assert.ok(dialog instanceof rt.wx.ModalSidebarPanelCtrl,
        "the surface opens the framework dialog rather than a modal of its own");

    assert.equal(dialog.size, "modal-lg", "the two panes need the room");
    assert.ok(dialog._linkCtrl === ctrl, "the pages reach the surface through the back reference");
    assert.ok(dialog._linkSystems.length > 0, "the catalog is attached before the pages render");
});

test("the relation picker of a page is filled from the catalog the server answered", async () => {
    const { rt, host } = surface({ respond: withSystems() });

    const ctrl = new rt.wxapp.RelationViewCtrl(host);
    await settle();
    const dialog = await openDialog(ctrl);

    // the pages render as they are added, so the catalog has to be attached
    // first; a page that rendered too early would show an empty picker
    const picked = rt.wxapp.relationViewModel.panelState(dialog, "webexpress.webapp.relation.object").typeCtrl;

    assert.deepEqual(picked.options.map((option) => option.id), ["blocks", "references"]);
    assert.deepEqual(picked.options.map((option) => option.label), ["blocks", "references"]);
});

test("the dialog offers one page per usable system", async () => {
    const { rt, host } = surface({ respond: withSystems() });

    const ctrl = new rt.wxapp.RelationViewCtrl(host);
    await settle();
    const dialog = await openDialog(ctrl);

    const pages = dialog._pages.map((page) => page.id);

    assert.deepEqual(pages, [
        "webexpress.webapp.relation.object",
        "webexpress.webapp.relation.web",
        "acme.github"
    ], "the sidebar follows the catalog the server answered");
});

test("a disabled system is not offered", async () => {
    const { rt, host } = surface({ respond: withSystems() });

    const ctrl = new rt.wxapp.RelationViewCtrl(host);
    await settle();
    const dialog = await openDialog(ctrl);

    assert.ok(!dialog._pages.some((page) => page.id === "acme.slack"),
        "a system that cannot accept links is not offered as a page");
});

test("a contributed system without a panel of its own is rendered by the generic one", async () => {
    const { rt, host } = surface({ respond: withSystems() });

    const ctrl = new rt.wxapp.RelationViewCtrl(host);
    await settle();
    const dialog = await openDialog(ctrl);

    dialog.selectPage("acme.github");
    await settle();

    // the generic object panel carries the type picker and the target search,
    // so a plugin contributes a system without shipping any javascript
    const pane = dialog._pagePanes.get("acme.github");
    assert.equal(pane.querySelectorAll(".wx-relation-view-dialog-type").length, 1);
    assert.equal(pane.querySelectorAll(".wx-relation-view-dialog-search").length, 1);
});

test("the object page keeps the dialog open until a target was picked", async () => {
    const { rt, host, requests } = surface({ respond: withSystems() });

    const ctrl = new rt.wxapp.RelationViewCtrl(host);
    await settle();
    const dialog = await openDialog(ctrl);
    requests.length = 0;

    dialog.submit();
    await settle();

    assert.ok(validationMessage(dialog).includes("object"), "the missing target is named");
    assert.ok(!requests.some((r) => r.init.method === "POST"), "nothing reaches the server");
});

test("the web page refuses an address that is not a web address", async () => {
    const { rt, host } = surface({ respond: withSystems() });

    const ctrl = new rt.wxapp.RelationViewCtrl(host);
    await settle();
    const dialog = await openDialog(ctrl);

    dialog.selectPage("webexpress.webapp.relation.web");
    rt.wxapp.relationViewModel.panelState(dialog, "webexpress.webapp.relation.web").address = "javascript:alert(1)";

    dialog.submit();
    await settle();

    assert.ok(validationMessage(dialog).length > 0);
});

test("a web link is submitted through the framework dialog", async () => {
    const posted = [];
    const { rt, host } = surface({
        respond: withSystems(async (url, init) => (init.method === "POST"
            ? (posted.push(JSON.parse(init.body)), { ok: true, status: 200, json: async () => ({ id: "new" }) })
            : null))
    });

    const ctrl = new rt.wxapp.RelationViewCtrl(host);
    await settle();

    const events = [];
    host.addEventListener(rt.wxapp.Event.RELATION_ADDED_EVENT, () => events.push("added"));

    const dialog = await openDialog(ctrl);
    dialog.selectPage("webexpress.webapp.relation.web");

    const state = rt.wxapp.relationViewModel.panelState(dialog, "webexpress.webapp.relation.web");
    state.address = "https://example.com/advisory";
    state.comment = "vendor advisory";

    dialog.submit();
    await settle();

    assert.deepEqual(posted, [{
        system: "webexpress.webapp.relation.web",
        type: "weblink",
        address: "https://example.com/advisory",
        title: "https://example.com/advisory",
        comment: "vendor advisory"
    }]);
    assert.deepEqual(events, ["added"]);
});

test("an object link picked in the dialog is posted as a target key", async () => {
    const posted = [];
    const { rt, host } = surface({
        respond: withSystems(async (url, init) => {
            if (url.includes("link-targets")) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => [{ key: "CHG-00045", class: "Change", title: "Firmware update" }]
                };
            }
            if (init.method === "POST") {
                posted.push(JSON.parse(init.body));
                return { ok: true, status: 200, json: async () => ({ id: "new" }) };
            }
            return null;
        })
    });

    const ctrl = new rt.wxapp.RelationViewCtrl(host);
    await settle();
    const dialog = await openDialog(ctrl);

    const state = rt.wxapp.relationViewModel.panelState(dialog, "webexpress.webapp.relation.object");
    assert.deepEqual(state.targetCtrl.options.map((option) => option.id), ["CHG-00045"],
        "the page offers candidates before anything was typed");

    state.targetCtrl.value = ["CHG-00045"];

    dialog.submit();
    await settle();

    assert.deepEqual(posted, [{
        system: "webexpress.webapp.relation.object",
        type: "blocks",
        targetKey: "CHG-00045",
        targetClass: "Change",
        title: "Firmware update"
    }]);
});

test("a link the server refuses is reported rather than swallowed", async () => {
    const notifications = [];
    const { rt, host } = surface({
        respond: withSystems(async (url, init) => (init.method === "POST"
            ? {
                ok: false,
                status: 400,
                headers: { get: () => "application/json" },
                json: async () => ({ code: "relation.duplicate", message: "This link already exists." })
            }
            : null))
    });

    const ctrl = new rt.wxapp.RelationViewCtrl(host);
    await settle();

    // the framework dialog submits and closes, so the reason the server gave
    // travels through the popup pipeline the application already listens on
    rt.wxapp.MessageQueue.dispatchLocal = (message) => notifications.push(message);

    const dialog = await openDialog(ctrl);
    dialog.selectPage("webexpress.webapp.relation.web");
    rt.wxapp.relationViewModel.panelState(dialog, "webexpress.webapp.relation.web").address = "https://example.com";

    dialog.submit();
    await settle();

    assert.equal(notifications.length, 1);
    assert.ok(notifications[0].notification.message.includes("already exists"),
        "the reader learns what the server objected to, not just that it failed");
});

test("the header shows its icon, its caption and its count", async () => {
    const { rt, host } = surface();

    const ctrl = new rt.wxapp.RelationViewCtrl(host);
    await settle();

    assert.equal(host.querySelectorAll(".wx-relation-view-heading-icon").length, 1);
    assert.equal(host.querySelectorAll(".wx-relation-view-caption").length, 1);
    assert.equal(ctrl._totalBadge.textContent, "4", "the count is the total the endpoint answered");
});

test("a page that names the section itself switches the header parts off", async () => {
    const { rt, host } = surface({ dataset: { headerIcon: "false", headerText: "false", headerBadge: "false" } });

    const ctrl = new rt.wxapp.RelationViewCtrl(host);
    await settle();

    assert.equal(host.querySelectorAll(".wx-relation-view-heading-icon").length, 0);
    assert.equal(host.querySelectorAll(".wx-relation-view-caption").length, 0);
    assert.equal(ctrl._totalBadge, null, "nothing counts what is not shown");
    assert.equal(host.querySelectorAll(".wx-relation-view-heading").length, 0,
        "an empty heading would still claim the gap of the toolbar");

    // what the header does not show is still there to be used
    assert.equal(host.querySelectorAll(".wx-relation-view-view").length, 2);
    assert.equal(host.querySelectorAll(".wx-relation-view-add").length, 1);
});

test("one part of the header may go without the others", async () => {
    const { rt, host } = surface({ dataset: { headerBadge: "false" } });

    const ctrl = new rt.wxapp.RelationViewCtrl(host);
    await settle();

    assert.equal(host.querySelectorAll(".wx-relation-view-heading-icon").length, 1);
    assert.equal(host.querySelectorAll(".wx-relation-view-caption").length, 1);
    assert.equal(ctrl._totalBadge, null);
    assert.equal(host.querySelectorAll(".wx-relation-view-heading").length, 1);
});

// the two pickers of the object page: the framework selection control, with the
// target one answered by the targets service of the surface

const CANDIDATES = [
    { key: "CHG-00045", class: "Change", title: "Firmware update" },
    { key: "INC-00777", class: "Incident", title: "Radio silence" }
];

/**
 * Opens the add dialog on the object page with candidates in its target picker.
 * @param {Function} [answer] - An optional responder for the targets endpoint.
 * @returns {Promise<object>} The dialog, the page state and the two pickers.
 */
async function picker(answer) {
    const { rt, host, requests } = surface({
        respond: withSystems(async (url, init) => (url.includes("link-targets")
            ? (answer ? answer(url, init) : { ok: true, status: 200, json: async () => CANDIDATES })
            : null))
    });

    const ctrl = new rt.wxapp.RelationViewCtrl(host);
    await settle();

    const dialog = await openDialog(ctrl);
    const state = rt.wxapp.relationViewModel.panelState(dialog, "webexpress.webapp.relation.object");

    return {
        rt,
        ctrl,
        dialog,
        state,
        requests,
        pane: dialog._pagePanes.get("webexpress.webapp.relation.object"),
        options: () => state.targetCtrl.options.map((option) => option.id)
    };
}

test("both fields of the object page are the framework selection control", async () => {
    const { rt, state, pane } = await picker();

    assert.ok(state.typeCtrl instanceof rt.wx.InputSelectionCtrl,
        "the relation is picked with the control everything else is picked with");
    assert.ok(state.targetCtrl instanceof rt.wxapp.InputSelectionCtrl,
        "and the target with its rest-backed variant");
    assert.equal(pane.querySelectorAll(".wx-relation-view-dialog-type").length, 1);
    assert.equal(pane.querySelectorAll(".wx-relation-view-dialog-search").length, 1);
});

test("the relations of the system are the options of the picker", async () => {
    const { state } = await picker();

    assert.deepEqual(state.typeCtrl.options.map((option) => option.id), ["blocks", "references"]);
    assert.deepEqual(state.typeCtrl.value, ["blocks"], "the first relation is picked up front");
    assert.equal(state.type, "blocks", "and the draft says so");
});

test("the candidates the service answers become the options of the target picker", async () => {
    const { state, options } = await picker();

    assert.deepEqual(options(), ["CHG-00045", "INC-00777"]);
    assert.equal(state.targetCtrl.options[0].label, "CHG-00045 - Firmware update",
        "the caption of a picked target names what it is");
});

test("picking a target adopts the reference behind the option", async () => {
    const { state } = await picker();

    state.targetCtrl.value = ["INC-00777"];

    assert.equal(state.target.key, "INC-00777");
    assert.equal(state.target.class, "Incident", "the whole reference is kept, not only its key");

    state.targetCtrl.value = [];
    assert.equal(state.target, null, "clearing the field clears the draft");
});

test("changing the relation drops the picked target and asks again", async () => {
    const { state, requests } = await picker();

    state.targetCtrl.value = ["CHG-00045"];
    requests.length = 0;

    state.typeCtrl.value = ["references"];
    await settle();

    assert.equal(state.type, "references");
    assert.equal(state.target, null, "what was picked need not be linkable by the new relation");
    assert.ok(requests.some((r) => r.url.includes("link-targets") && r.url.includes("references")),
        "the candidates are asked for again rather than filtered");
});

test("the term travels to the service together with the relation and the source", async () => {
    const { state, requests } = await picker();
    requests.length = 0;

    await state.targetCtrl.receiveData("radio");

    const url = requests.find((r) => r.url.includes("link-targets")).url;
    assert.match(url, /[?&]q=radio(&|$)/);
    assert.match(url, /[?&]type=blocks(&|$)/);
    assert.match(url, /[?&]source=INC-00123(&|$)/);
});

test("an answer without a candidate says so instead of offering something", async () => {
    const { state } = await picker(() => ({ ok: true, status: 200, json: async () => [] }));

    assert.equal(state.targetCtrl.options.length, 1);
    assert.ok(state.targetCtrl.options[0].disabled, "the empty state is read, not picked");
    assert.ok(state.targetCtrl.options[0].content.includes("No matches"));
});

test("a search a newer keystroke aborted leaves the options alone", async () => {
    const { state, options } = await picker();

    assert.deepEqual(options(), ["CHG-00045", "INC-00777"]);

    // the service reports an aborted request the way the shared request does
    state.targetCtrl._element._wxRelationTarget.ctrl = {
        subject: { key: "INC-00123" },
        targets: { query: async () => ({ ok: false, error: { kind: "abort" } }) }
    };
    await state.targetCtrl.receiveData("rad");

    assert.deepEqual(options(), ["CHG-00045", "INC-00777"], "what is shown belongs to the newer search");
});

test("a failed search empties the options rather than keeping a stale answer", async () => {
    const { state, options } = await picker();

    state.targetCtrl._element._wxRelationTarget.ctrl = {
        subject: { key: "INC-00123" },
        targets: { query: async () => ({ ok: false, status: 500 }) }
    };
    await state.targetCtrl.receiveData("rad");

    assert.deepEqual(options(), []);
});

test("what an object is called cannot become markup of the dropdown", async () => {
    const { state } = await picker(() => ({
        ok: true,
        status: 200,
        json: async () => [{ key: "CHG-1", class: "Change", title: "<img src=x onerror=alert(1)>" }]
    }));

    const content = state.targetCtrl.options[0].content;
    assert.ok(!content.includes("<img"), "the title of an object is text, not markup");
    assert.ok(content.includes("&lt;img"));
});
