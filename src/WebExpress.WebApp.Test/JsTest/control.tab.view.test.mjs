/**
 * Headless tests for the view of the REST tab control (wx-webapp-tab): the headers, the
 * add button, the drag marks and the rename field are rendered from the state, a refresh
 * patches the headers of the tabs that stay instead of rebuilding them, and inside a
 * ViewState the control keeps its own state.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadControl } from "./controls.harness.mjs";
import { deferred, settle } from "../../../../WebExpress.WebUI/src/WebExpress.WebUI.Test/JsTest/modal.harness.mjs";

/**
 * Builds a tab control with the given host attributes and templates.
 * @param {object} [options={}] - movable, templates (ids with an optional multiplicity).
 * @returns {object} The runtime, the host and the control.
 */
function setup(options = {}) {
    const rt = loadControl({ file: "webexpress.webapp.tab.js", deps: ["i18n/en.js", "webexpress.webapp.tab.model.js"] });
    const host = rt.createElement("div");
    if (options.movable) {
        host.dataset.movableTab = "true";
    }
    for (const template of options.templates || []) {
        const node = rt.createElement("template");
        node.id = template.id;
        if (template.multiplicity !== undefined) {
            node.dataset.multiplicity = String(template.multiplicity);
        }
        host.appendChild(node);
    }
    rt.document.body.appendChild(host);
    const ctrl = new rt.wxapp.TabCtrl(host);
    return { ...rt, host, ctrl };
}

/**
 * Builds a drag event the stub understands, aimed at a header box of 100 pixels.
 * @param {string} type - The event type.
 * @param {number} clientX - The pointer position.
 * @returns {object} The event.
 */
function drag(type, clientX = 0) {
    return { type, clientX, dataTransfer: { setData() { } }, preventDefault() { }, stopPropagation() { } };
}

test("render describes the tabs without touching the DOM", () => {
    const rt = setup();
    rt.ctrl.updateData([{ id: "a", label: "Alpha" }]);
    const before = rt.host.childNodes.slice();

    const tree = rt.ctrl.render(Object.assign({}, rt.ctrl.state, { tabs: [] }));

    assert.equal(rt.host.childNodes.length, before.length);
    assert.ok(rt.host.childNodes.every((node, i) => node === before[i]));
    assert.deepEqual(Array.from(tree, (node) => node.key), ["header", "content"]);
});

test("a refresh patches the headers of the tabs that stay and rebuilds only the panes", () => {
    const rt = setup();
    rt.ctrl.updateData([{ id: "a", label: "Alpha" }, { id: "b", label: "Beta" }]);
    const header = rt.ctrl._headers.get("a");
    const link = header.querySelector(".nav-link");
    const pane = rt.ctrl._panes.get("a");

    rt.ctrl.updateData([{ id: "a", label: "Alpha 2", badge: 4 }, { id: "c", label: "Gamma" }]);

    assert.equal(rt.ctrl._headers.get("a"), header, "the header keeps its node, and with it a focus");
    assert.equal(header.querySelector(".nav-link"), link);
    assert.ok(link.textContent.startsWith("Alpha 2"));
    assert.equal(link.querySelector(".wx-tab-badge").textContent, "4");
    assert.notEqual(rt.ctrl._panes.get("a"), pane, "the pane is built anew from its template");
    assert.equal(pane.parentNode, null);
    assert.deepEqual(rt.ctrl._navElement.querySelectorAll(".nav-link").map((l) => l.dataset.tabId), ["a", "c"]);
});

test("a reorder is state: the grip drag renders its marks and a drop moves the header", () => {
    const rt = setup({ movable: true });
    rt.ctrl.updateData([{ id: "a", label: "Alpha" }, { id: "b", label: "Beta" }, { id: "c", label: "Gamma" }]);
    const orders = [];
    rt.ctrl._restUri = "/api/tabs";
    rt.ctrl._service = { update: (body) => { orders.push(Array.from(body.order)); return Promise.resolve({ ok: true }); } };
    for (const id of ["a", "b", "c"]) {
        rt.ctrl._headers.get(id).getBoundingClientRect = () => ({ left: 0, width: 100, top: 0, height: 30 });
    }
    const header = (id) => rt.ctrl._headers.get(id);
    const moved = header("c");

    header("c").querySelector(".wx-webapp-tab-grip").dispatchEvent(drag("dragstart"));
    header("a").dispatchEvent(drag("dragover", 10));
    rt.ctrl.store.flush();
    assert.ok(header("c").classList.contains("wx-webapp-tab-dragging"));
    assert.ok(header("a").classList.contains("wx-webapp-tab-drop-before"));

    header("a").dispatchEvent(drag("drop", 10));
    header("c").querySelector(".wx-webapp-tab-grip").dispatchEvent(drag("dragend"));
    rt.ctrl.store.flush();

    assert.deepEqual(rt.ctrl._navElement.querySelectorAll(".nav-link").map((l) => l.dataset.tabId), ["c", "a", "b"]);
    assert.equal(header("c"), moved, "the header moved, it was not rebuilt");
    assert.equal(rt.host.querySelectorAll(".wx-webapp-tab-dragging, .wx-webapp-tab-drop-before, .wx-webapp-tab-drop-after").length, 0);
    assert.deepEqual(orders, [["c", "a", "b"]]);
});

test("the add button shows a create in flight and refuses a second one", async () => {
    const rt = setup({ templates: [{ id: "default" }] });
    const request = deferred();
    let creates = 0;
    rt.ctrl._restUri = "/api/tabs";
    rt.ctrl._service = { create: () => { creates++; return request.promise; } };
    const button = rt.ctrl._addTabButton;

    button.dispatchEvent({ type: "click", preventDefault() { } });
    rt.ctrl.store.flush();
    assert.equal(button.disabled, true);
    assert.ok(button.querySelector("i").classList.contains("wx-icon-spin"));
    button.dispatchEvent({ type: "click", preventDefault() { } });
    assert.equal(creates, 1);

    request.resolve({ ok: true, data: { newTab: { id: "n", label: "New" } } });
    await settle();
    assert.equal(button.disabled, false);
    assert.equal(rt.ctrl._activeTabId, "n");
    assert.ok(rt.ctrl._panes.get("n").parentNode, "the new pane is placed");
});

test("a template whose multiplicity is used up is offered disabled", () => {
    const rt = setup({ templates: [{ id: "single", multiplicity: 1 }, { id: "many" }] });
    const entry = (id) => rt.ctrl._addTemplateMenu.querySelectorAll(".dropdown-item")[id === "single" ? 0 : 1];
    assert.equal(entry("single").disabled, false);

    rt.ctrl.updateData([{ id: "a", label: "Alpha", templateId: "single" }]);

    assert.equal(entry("single").disabled, true);
    assert.ok(entry("single").classList.contains("disabled"));
    assert.equal(entry("many").disabled, false);
    assert.equal(rt.ctrl._addTabButton.disabled, false, "another template is still available");
});

test("inside a ViewState the control keeps its own state and renders the slice", () => {
    const rt = setup();
    const data = { items: [{ id: "a", label: "Alpha" }] };
    let watcher = null;
    const viewState = {
        serviceForResource: () => null,
        watch: (select, listener) => { watcher = listener; return () => { }; },
        slice: () => ({ data: data, loading: false })
    };
    rt.wxapp.ViewStateRegistry.whenReady = (element, id, callback) => callback(viewState);
    rt.ctrl._resource = "tabs";

    rt.ctrl._attachToViewState(rt.host);

    assert.notEqual(rt.ctrl.store, viewState, "the region's ViewState holds resources, not the keys of every control");
    assert.equal(rt.ctrl._viewState, viewState);
    assert.deepEqual(rt.ctrl._tabs.map((tab) => tab.id), ["a"]);
    watcher({ data: { items: [{ id: "a", label: "Alpha" }, { id: "b", label: "Beta" }] }, loading: false });
    assert.deepEqual(rt.ctrl._tabs.map((tab) => tab.id), ["a", "b"]);
});
