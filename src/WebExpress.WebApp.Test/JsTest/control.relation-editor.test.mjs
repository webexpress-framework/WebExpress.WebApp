/**
 * End-to-end tests for the relation type administration (wx-webapp-relation-editor)
 * and its editor.
 *
 * They run against the shipped code: the real WebUI runtime, the WebApp engine,
 * the model, the editor and the control. The shared contract covers
 * registration and teardown; the tests below cover what the surface adds - the
 * table it renders from the definitions, the guard that keeps a used relation
 * from being dropped, the activation toggle, the reordering and the editor with
 * its two readings.
 */

import { test } from "node:test";
import assert from "node:assert";
import { contract } from "./controls.contract.mjs";
import { loadControl } from "./controls.harness.mjs";
import { appendServiceIsland } from "./harness.mjs";

const DEPS = [
    // the shipped english bundle, so the assertions read the captions a user
    // sees rather than the raw i18n keys
    "i18n/en.js",
    "webexpress.webapp.relation.view.model.js",
    "webexpress.webapp.relation.editor.model.js",
    "panels/webexpress.webapp.panel.relation.editor.js"
];
const FILE = "webexpress.webapp.relation.editor.js";

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

const RESULT = {
    total: 3,
    active: 2,
    classes: [{ id: "Bug", label: "Bug" }, { id: "Change", label: "Change" }],
    items: [
        {
            id: "blocks",
            label: "blocks",
            inverse: "is blocked by",
            targetClasses: ["Change", "Bug"],
            cardinality: "n:n",
            effect: "blocksCompletion",
            usage: 34,
            active: true,
            builtin: true,
            order: 1
        },
        {
            id: "similar",
            label: "similar to",
            inverse: "similar to",
            symmetric: true,
            cardinality: "n:n",
            effect: "none",
            usage: 0,
            active: true,
            order: 2
        },
        {
            id: "replaces",
            label: "replaces",
            inverse: "is replaced by",
            targetClasses: ["Change"],
            cardinality: "1:1",
            effect: "none",
            usage: 0,
            active: false,
            order: 3
        }
    ]
};

contract({
    file: FILE,
    selector: "wx-webapp-relation-editor",
    ctrl: "RelationEditorCtrl",
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
 * Opens the editor of a type and announces the opened modal, which is what makes
 * the framework dialog run the page's onShow; the headless bootstrap stub does
 * not fire that event, so the test does.
 * @param {object} ctrl - The administration control.
 * @param {object|null} item - The type to edit, or null for a new definition.
 * @returns {Promise<object>} The dialog.
 */
async function openEditor(ctrl, item) {
    ctrl._edit(item);
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
 * Returns the scratch state of the editor page.
 * @param {object} rt - The loaded runtime.
 * @param {object} dialog - The dialog.
 * @returns {object} The state.
 */
function editorState(rt, dialog) {
    return rt.wxapp.relationEditorModel.panelState(dialog);
}

/**
 * Builds a loaded administration surface.
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
    host.classList.add("wx-webapp-relation-editor");
    host.dataset.class = options.class || "Bug";
    host.dataset.sample = options.sample || "BUG-00123";

    for (const [name, value] of Object.entries(options.dataset || {})) {
        host.dataset[name] = value;
    }

    appendServiceIsland(rt.document, host, {
        name: "data",
        baseUri: "/api/link-types",
        method: "GET",
        updateMethod: "PUT",
        query: { search: "q", class: "class" }
    });
    rt.document.body.appendChild(host);

    return { rt, host, requests };
}

test("the surface loads the types of its class and renders one row each", async () => {
    const { rt, host, requests } = surface();

    const ctrl = new rt.wxapp.RelationEditorCtrl(host);
    await settle();

    assert.equal(requests.length, 1);
    assert.ok(requests[0].url.includes("class=Bug"), "the class narrows the catalog on the server");
    assert.equal(host.querySelectorAll(".wx-relation-editor-row").length, 3);
    assert.deepEqual(ctrl.value.map((x) => x.id), ["blocks", "similar", "replaces"]);
});

test("a row states the relation from both ends", async () => {
    const { rt, host } = surface();

    new rt.wxapp.RelationEditorCtrl(host);
    await settle();

    const forward = host.querySelectorAll(".wx-relation-editor-forward").map((x) => x.textContent);
    const backward = host.querySelectorAll(".wx-relation-editor-backward").map((x) => x.textContent);

    assert.deepEqual(forward, ["→ blocks", "→ similar to", "→ replaces"]);
    assert.deepEqual(backward, ["← is blocked by", "← similar to", "← is replaced by"]);
});

test("a symmetric relation is marked as such", async () => {
    const { rt, host } = surface();

    new rt.wxapp.RelationEditorCtrl(host);
    await settle();

    const badges = host.querySelectorAll(".wx-relation-editor-symmetric");
    assert.equal(badges.length, 1, "only the reciprocal relation carries the badge");
});

test("a relation without target classes reads as accepting every class", async () => {
    const { rt, host } = surface();

    new rt.wxapp.RelationEditorCtrl(host);
    await settle();

    const rows = host.querySelectorAll(".wx-relation-editor-row");
    const similar = rows.find((row) => row.dataset.type === "similar");

    assert.equal(similar.querySelectorAll(".wx-relation-editor-chip-all").length, 1);
});

test("the caption reports how many relations may be used and how many exist", async () => {
    const { rt, host } = surface();

    const ctrl = new rt.wxapp.RelationEditorCtrl(host);
    await settle();

    assert.equal(ctrl._counts.textContent, "2 active · 3 defined");
});

test("a deactivated relation is rendered muted and unticked", async () => {
    const { rt, host } = surface();

    new rt.wxapp.RelationEditorCtrl(host);
    await settle();

    const rows = host.querySelectorAll(".wx-relation-editor-row");
    const replaces = rows.find((row) => row.dataset.type === "replaces");

    assert.ok(replaces.classList.contains("wx-relation-editor-inactive"));
    assert.equal(replaces.querySelectorAll(".wx-relation-editor-switch")[0].checked, false);
});

test("a relation that is shipped or still in use offers no removal", async () => {
    const { rt, host } = surface();

    new rt.wxapp.RelationEditorCtrl(host);
    await settle();

    const rows = host.querySelectorAll(".wx-relation-editor-row");
    const commands = (id) => rows.find((row) => row.dataset.type === id)
        .querySelectorAll(".wx-relation-editor-option")
        .map((x) => x.getAttribute("data-command"));

    assert.deepEqual(commands("blocks"), ["edit"], "a shipped relation is edited, never dropped");
    assert.deepEqual(commands("similar"), ["edit", "remove"], "an unused relation of its own may go");
});

test("toggling a relation persists it and reloads", async () => {
    const { rt, host, requests } = surface();

    const ctrl = new rt.wxapp.RelationEditorCtrl(host);
    await settle();
    requests.length = 0;

    const events = [];
    host.addEventListener(rt.wxapp.Event.RELATION_TYPE_SAVED_EVENT, () => events.push("saved"));

    await ctrl.saveType(Object.assign({}, ctrl.value[2], { active: true }));
    await settle();

    assert.equal(requests[0].init.method, "PUT");
    assert.ok(requests[0].url.endsWith("/replaces"));
    assert.equal(JSON.parse(requests[0].init.body).active, true);
    assert.deepEqual(events, ["saved"]);
});

test("a new relation is posted without an id", async () => {
    const { rt, host, requests } = surface();

    const ctrl = new rt.wxapp.RelationEditorCtrl(host);
    await settle();
    requests.length = 0;

    await ctrl.saveType({ label: "relates to", inverse: "is related to", allClasses: true, cardinality: "n:n", effect: "none", active: true });
    await settle();

    assert.equal(requests[0].init.method, "POST");
    assert.ok(!requests[0].url.includes("/relates"), "the endpoint derives the id");
    assert.deepEqual(JSON.parse(requests[0].init.body).targetClasses, []);
});

test("a rejected definition is reported by what the server objected to", async () => {
    const { rt, host } = surface({
        respond: async (url, init) => (init.method === "POST"
            ? {
                ok: false,
                status: 400,
                headers: { get: () => "application/json" },
                json: async () => ({ code: "relation.type.duplicate", message: "A link type with this id already exists." })
            }
            : { ok: true, status: 200, json: async () => RESULT })
    });

    const ctrl = new rt.wxapp.RelationEditorCtrl(host);
    await settle();

    const notifications = [];
    rt.wxapp.MessageQueue.dispatchLocal = (message) => notifications.push(message);

    await ctrl.saveType({ label: "blocks", inverse: "is blocked by", allClasses: true });

    assert.ok(notifications[0].notification.message.includes("already exists"));
});

test("reordering shows the new order at once and sends exactly that order", async () => {
    const { rt, host, requests } = surface();

    const ctrl = new rt.wxapp.RelationEditorCtrl(host);
    await settle();
    requests.length = 0;

    const events = [];
    host.addEventListener(rt.wxapp.Event.RELATION_TYPE_REORDERED_EVENT, (e) => events.push(e.detail.ids));

    await ctrl._move("replaces", "blocks");
    await settle();

    assert.deepEqual(ctrl.value.map((x) => x.id), ["replaces", "blocks", "similar"]);
    assert.equal(requests[0].init.method, "POST");
    assert.ok(requests[0].url.endsWith("/order"));
    assert.deepEqual(JSON.parse(requests[0].init.body), { ids: ["replaces", "blocks", "similar"] });
    assert.deepEqual(events, [["replaces", "blocks", "similar"]]);
});

test("removing an unused relation deletes it and reloads", async () => {
    const { rt, host, requests } = surface({
        respond: async (url, init) => (init.method === "DELETE"
            ? { ok: true, status: 204, json: async () => null }
            : { ok: true, status: 200, json: async () => RESULT })
    });

    const ctrl = new rt.wxapp.RelationEditorCtrl(host);
    await settle();
    requests.length = 0;

    const events = [];
    host.addEventListener(rt.wxapp.Event.RELATION_TYPE_REMOVED_EVENT, () => events.push("removed"));

    await ctrl._remove(ctrl.value[1]);
    await settle();

    assert.equal(requests[0].init.method, "DELETE");
    assert.ok(requests[0].url.endsWith("/similar"));
    assert.deepEqual(events, ["removed"]);
});

test("a read-only surface offers neither the define affordance nor the row options", async () => {
    const { rt, host } = surface({ dataset: { readonly: "true" } });

    new rt.wxapp.RelationEditorCtrl(host);
    await settle();

    assert.equal(host.querySelectorAll(".wx-relation-editor-new").length, 0);
    assert.equal(host.querySelectorAll(".wx-relation-editor-option").length, 0);
    assert.equal(host.querySelectorAll(".wx-relation-editor-switch")[0].disabled, true);
});

test("the editor is one page of the framework modal and opens large", async () => {
    const { rt, host } = surface();

    const ctrl = new rt.wxapp.RelationEditorCtrl(host);
    await settle();
    const dialog = await openEditor(ctrl, ctrl.value[0]);

    assert.ok(dialog instanceof rt.wx.ModalSidebarPanelCtrl);
    assert.equal(dialog.size, "modal-lg");
    assert.equal(dialog._pages.length, 1, "a single page renders without the sidebar tree");
    assert.ok(dialog._linkTypeCtrl === ctrl, "the page reaches the surface through the back reference");
});

test("the editor opens on the picked relation and previews both readings", async () => {
    const { rt, host } = surface();

    const ctrl = new rt.wxapp.RelationEditorCtrl(host);
    await settle();
    const dialog = await openEditor(ctrl, ctrl.value[0]);

    const rows = editorState(rt, dialog).preview.querySelectorAll(".wx-relation-editor-dialog-preview-row");
    assert.equal(rows.length, 2);
    assert.ok(rows[0].textContent.includes("BUG-00123"), "the reading starts from the class being administered");
    assert.ok(rows[0].textContent.includes("blocks"));
    assert.ok(rows[1].textContent.includes("is blocked by"));
    assert.equal(editorState(rt, dialog).impact.textContent, "34 existing links affected");
});

test("the editor mirrors the label into the counterpart of a symmetric relation", async () => {
    const { rt, host } = surface();

    const ctrl = new rt.wxapp.RelationEditorCtrl(host);
    await settle();
    const dialog = await openEditor(ctrl, ctrl.value[0]);
    const state = editorState(rt, dialog);

    state.symmetricInput.checked = true;
    state.labelInput.value = "conflicts with";
    state.symmetricInput.dispatchEvent({ type: "change", target: state.symmetricInput });

    assert.equal(state.inverseInput.value, "conflicts with");
    assert.equal(state.inverseInput.disabled, true, "the counterpart is not an independent value");
});

test("the editor refuses an incomplete definition before it reaches the server", async () => {
    const { rt, host, requests } = surface();

    const ctrl = new rt.wxapp.RelationEditorCtrl(host);
    await settle();
    const dialog = await openEditor(ctrl, null);
    requests.length = 0;

    dialog.submit();
    await settle();

    assert.equal(requests.length, 0, "nothing is sent while the relation has no name");
    assert.ok(validationMessage(dialog).includes("name the relation"));
});

test("the editor stores the definition the page collected", async () => {
    const { rt, host, requests } = surface();

    const ctrl = new rt.wxapp.RelationEditorCtrl(host);
    await settle();
    const dialog = await openEditor(ctrl, null);
    const state = editorState(rt, dialog);

    state.labelInput.value = "relates to";
    state.inverseInput.value = "is related to";
    requests.length = 0;

    dialog.submit();
    await settle();

    assert.equal(requests[0].init.method, "POST");
    const body = JSON.parse(requests[0].init.body);
    assert.equal(body.label, "relates to");
    assert.equal(body.inverse, "is related to");
});

test("ticking all classes clears the individual picks", async () => {
    const { rt, host } = surface();

    const ctrl = new rt.wxapp.RelationEditorCtrl(host);
    await settle();
    const dialog = await openEditor(ctrl, ctrl.value[0]);
    const state = editorState(rt, dialog);

    // the shipped relation accepts two of the offered classes
    assert.deepEqual(state.classChecks.filter((x) => x.checked).map((x) => x.value), ["Bug", "Change"]);

    state.allClassesInput.checked = true;
    state.classesHost.dispatchEvent({ type: "change", target: state.allClassesInput });

    assert.equal(state.draft.allClasses, true);
    assert.deepEqual(state.draft.targetClasses, []);
    assert.deepEqual(state.classChecks.filter((x) => x.checked), [], "the two statements cannot both hold");
});

test("a click on the type pair opens the editor on that relation", async () => {
    const { rt, host } = surface();

    const ctrl = new rt.wxapp.RelationEditorCtrl(host);
    await settle();

    // the heading row carries the same column class, so the row is located by
    // the relation it renders rather than by position
    const row = host.querySelectorAll(".wx-relation-editor-row").find((x) => x.dataset.type === "replaces");
    const pair = row.querySelectorAll(".wx-relation-editor-pair")[0];
    ctrl._rows.dispatchEvent({ type: "click", target: pair });
    await settle();

    assert.equal(ctrl._dialog._linkTypeDraft.id, "replaces", "the row the user pointed at is the one that opens");
});

test("a click on the delete option removes that relation", async () => {
    const { rt, host, requests } = surface({
        respond: async (url, init) => (init.method === "DELETE"
            ? { ok: true, status: 204, json: async () => null }
            : { ok: true, status: 200, json: async () => RESULT })
    });

    const ctrl = new rt.wxapp.RelationEditorCtrl(host);
    await settle();
    requests.length = 0;

    const remove = host.querySelectorAll(".wx-relation-editor-option")
        .find((x) => x.getAttribute("data-command") === "remove");
    assert.ok(remove, "the unused relation offers a removal");
    ctrl._rows.dispatchEvent({ type: "click", target: remove });
    await settle();

    assert.equal(requests[0].init.method, "DELETE");
    assert.ok(requests[0].url.endsWith("/similar"));
});

test("flipping the switch persists the activation of that relation", async () => {
    const { rt, host, requests } = surface();

    const ctrl = new rt.wxapp.RelationEditorCtrl(host);
    await settle();
    requests.length = 0;

    const toggle = host.querySelectorAll(".wx-relation-editor-switch")[2];
    toggle.checked = true;
    ctrl._rows.dispatchEvent({ type: "change", target: toggle });
    await settle();

    assert.equal(requests[0].init.method, "PUT");
    assert.ok(requests[0].url.endsWith("/replaces"));
    assert.equal(JSON.parse(requests[0].init.body).active, true);
});

/**
 * Builds a drag event the stub understands, carrying the pointer position the
 * insertion side is computed from.
 * @param {string} type - The event type.
 * @param {object} target - The element the event is aimed at.
 * @param {number} [clientY=0] - The pointer position.
 * @returns {object} The event.
 */
function dragEvent(type, target, clientY = 0) {
    return { type: type, target: target, clientY: clientY, preventDefault() { } };
}

/**
 * Gives a row a box, because the stub reports every dimension as zero and the
 * insertion side is read from the pointer against that box.
 * @param {object} row - The row.
 * @param {number} top - The upper edge.
 * @param {number} height - The height.
 */
function box(row, top, height) {
    row.getBoundingClientRect = () => ({ top: top, height: height, bottom: top + height, left: 0, right: 100, width: 100 });
}

test("dragging over a row marks where the relation would land", async () => {
    const { rt, host } = surface();

    const ctrl = new rt.wxapp.RelationEditorCtrl(host);
    await settle();

    const rows = host.querySelectorAll(".wx-relation-editor-row");
    rows.forEach((row, index) => box(row, index * 40, 40));

    ctrl._rows.dispatchEvent(dragEvent("dragstart", rows[2]));

    // the upper half of a row means the dragged one goes above it
    ctrl._rows.dispatchEvent(dragEvent("dragover", rows[0], 5));
    assert.ok(rows[0].classList.contains("wx-drop-before"));
    assert.ok(rows[0].classList.contains("wx-drop-target"));

    // the lower half means below, and the earlier mark is gone
    ctrl._rows.dispatchEvent(dragEvent("dragover", rows[0], 35));
    assert.ok(rows[0].classList.contains("wx-drop-after"));
    assert.ok(!rows[0].classList.contains("wx-drop-before"));

    // and the row the pointer left carries no mark any more
    ctrl._rows.dispatchEvent(dragEvent("dragover", rows[1], 45));
    assert.ok(!rows[0].classList.contains("wx-drop-target"));
    assert.ok(rows[1].classList.contains("wx-drop-before"));
});

test("the dragged row is marked and never marks itself as a target", async () => {
    const { rt, host } = surface();

    const ctrl = new rt.wxapp.RelationEditorCtrl(host);
    await settle();

    const rows = host.querySelectorAll(".wx-relation-editor-row");
    rows.forEach((row, index) => box(row, index * 40, 40));

    ctrl._rows.dispatchEvent(dragEvent("dragstart", rows[0]));
    assert.ok(rows[0].classList.contains("wx-relation-editor-dragging"));

    ctrl._rows.dispatchEvent(dragEvent("dragover", rows[0], 5));
    assert.ok(!rows[0].classList.contains("wx-drop-target"), "a relation is not dropped onto itself");
});

test("dropping below a row puts the relation after it", async () => {
    const { rt, host, requests } = surface();

    const ctrl = new rt.wxapp.RelationEditorCtrl(host);
    await settle();

    const rows = host.querySelectorAll(".wx-relation-editor-row");
    rows.forEach((row, index) => box(row, index * 40, 40));
    requests.length = 0;

    // blocks, similar, replaces -> drop replaces below blocks
    ctrl._rows.dispatchEvent(dragEvent("dragstart", rows[2]));
    ctrl._rows.dispatchEvent(dragEvent("dragover", rows[0], 35));
    ctrl._rows.dispatchEvent(dragEvent("drop", rows[0], 35));
    await settle();

    assert.deepEqual(ctrl.value.map((x) => x.id), ["blocks", "replaces", "similar"]);
    assert.deepEqual(JSON.parse(requests[0].init.body), { ids: ["blocks", "replaces", "similar"] });
});

test("dropping below the last row puts the relation at the end", async () => {
    const { rt, host, requests } = surface();

    const ctrl = new rt.wxapp.RelationEditorCtrl(host);
    await settle();

    const rows = host.querySelectorAll(".wx-relation-editor-row");
    rows.forEach((row, index) => box(row, index * 40, 40));
    requests.length = 0;

    ctrl._rows.dispatchEvent(dragEvent("dragstart", rows[0]));
    ctrl._rows.dispatchEvent(dragEvent("dragover", rows[2], 115));
    ctrl._rows.dispatchEvent(dragEvent("drop", rows[2], 115));
    await settle();

    assert.deepEqual(ctrl.value.map((x) => x.id), ["similar", "replaces", "blocks"]);
});

test("a drop leaves no mark behind", async () => {
    const { rt, host } = surface();

    const ctrl = new rt.wxapp.RelationEditorCtrl(host);
    await settle();

    const rows = host.querySelectorAll(".wx-relation-editor-row");
    rows.forEach((row, index) => box(row, index * 40, 40));

    ctrl._rows.dispatchEvent(dragEvent("dragstart", rows[2]));
    ctrl._rows.dispatchEvent(dragEvent("dragover", rows[0], 5));
    ctrl._rows.dispatchEvent(dragEvent("drop", rows[0], 5));

    for (const row of rows) {
        assert.ok(!row.classList.contains("wx-drop-target"));
        assert.ok(!row.classList.contains("wx-drop-before"));
        assert.ok(!row.classList.contains("wx-drop-after"));
        assert.ok(!row.classList.contains("wx-relation-editor-dragging"));
    }
});
