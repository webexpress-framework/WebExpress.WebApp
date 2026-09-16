import { test } from "node:test";
import assert from "node:assert/strict";
import { loadControl } from "./controls.harness.mjs";
import { deferred, settle } from "../../../../WebExpress.WebUI/src/WebExpress.WebUI.Test/JsTest/modal.harness.mjs";

function setup(options = {}) {
    const rt = loadControl({ file: "webexpress.webapp.tab.js", deps: [
        "i18n/en.js", "webexpress.webapp.tab.model.js"
    ] });
    const host = rt.createElement("div");
    if (options.readonly) { host.dataset.readonly = "true"; }
    const placeholder = rt.createElement("div");
    placeholder.className = "wx-webapp-tab-empty d-none";
    host.appendChild(placeholder);
    rt.document.body.appendChild(host);
    const ctrl = new rt.wxapp.TabCtrl(host);
    ctrl.updateData(options.tabs || [{ id: "a", label: "Alpha" }, { id: "b", label: "Beta" }]);
    const requests = [];
    ctrl._restUri = "/api/tabs";
    ctrl._service = { remove: request => {
        requests.push(request);
        return options.remove ? options.remove(request) : Promise.resolve({ ok: true });
    } };
    const closed = [];
    host.addEventListener(rt.wxapp.Event.TAB_CLOSED_EVENT, event => closed.push(event.detail.tabId));
    return { ...rt, host, ctrl, requests, closed, placeholder };
}

function open(rt, id = "a") {
    const tab = rt.ctrl._tabs.find(item => item.id === id);
    const header = Array.from(rt.ctrl._navElement.children).find(item => item.querySelector(".nav-link")?.dataset.tabId === tab.id);
    header.querySelector(".wx-webapp-tab-close").click();
    assert.ok(rt.ctrl._confirm, "deleting a tab opens the shared confirmation modal");
    return rt.ctrl._confirm;
}

test("tab deletion requires confirmation and cancellation leaves the tab and service untouched", () => {
    const rt = setup();
    const modal = open(rt);
    assert.deepEqual(rt.requests, []);
    assert.equal(rt.ctrl._tabs.length, 2);
    assert.ok(modal._bodyDiv.textContent.includes("Alpha"));
    modal._cancelButton.click();
    assert.deepEqual(rt.requests, []);
    assert.deepEqual(rt.closed, []);
    assert.equal(rt.ctrl._activeTabId, "a");
});

test("successful deletion waits for the server, tears down the owned pane, and selects a neighbor", async () => {
    const request = deferred();
    const rt = setup({ remove: () => request.promise });
    rt.ctrl.selectTab("b");
    const pane = rt.ctrl._tabs[1].paneElement;
    let destroyed = 0;
    pane._wxCleanup = [() => destroyed++];
    const modal = open(rt, "b");
    const action = modal._confirmButton.onclick();
    modal._confirmButton.onclick();
    assert.equal(rt.requests.length, 1);
    assert.equal(rt.requests[0].params.id, "b");
    assert.equal(pane.isConnected, true);
    assert.deepEqual(rt.closed, []);
    request.resolve({ ok: true });
    await action;
    assert.equal(pane.parentNode, null);
    assert.equal(destroyed, 1);
    assert.equal(rt.ctrl._activeTabId, "a");
    assert.deepEqual(rt.closed, ["b"]);
});

for (const kind of ["http", "network", "abort"]) {
    test(`a ${kind} failure retains the pane and shows a retryable deletion error`, async () => {
        let ok = false;
        const rt = setup({ remove: () => Promise.resolve({ ok, error: { kind } }) });
        const pane = rt.ctrl._tabs[0].paneElement;
        const modal = open(rt);
        await modal._confirmButton.onclick();
        assert.equal(pane.isConnected, true);
        assert.equal(rt.ctrl._activeTabId, "a");
        assert.deepEqual(rt.closed, []);
        assert.ok(modal._bodyDiv.querySelector('[role="alert"]').textContent);
        ok = true;
        await modal._confirmButton.onclick();
        assert.deepEqual(rt.closed, ["a"]);
    });
}

test("deleting the last tab restores the empty state only after confirmation", async () => {
    const rt = setup({ tabs: [{ id: "a", label: "Alpha" }] });
    const modal = open(rt);
    assert.equal(rt.placeholder.parentNode, null);
    await modal._confirmButton.onclick();
    assert.equal(rt.placeholder.parentNode, rt.ctrl._contentElement);
    assert.equal(rt.ctrl._activeTabId, null);
});

test("deleting a background tab preserves selection and never removes another control's duplicate id", async () => {
    const rt = setup();
    const foreign = rt.createElement("div");
    foreign.id = "b";
    rt.document.body.insertBefore(foreign, rt.host);
    const pane = rt.ctrl._tabs[1].paneElement;
    await open(rt, "b")._confirmButton.onclick();
    assert.equal(foreign.isConnected, true);
    assert.equal(pane.isConnected, false);
    assert.equal(rt.ctrl._activeTabId, "a");
});

test("readonly and unknown tabs cannot request deletion", () => {
    const rt = setup({ readonly: true });
    assert.equal(rt.host.querySelector(".wx-webapp-tab-close"), null);
    rt.ctrl._closeTab("a");
    rt.ctrl._readonly = false;
    rt.ctrl._closeTab("unknown");
    assert.deepEqual(rt.requests, []);
    assert.deepEqual(rt.closed, []);
    assert.equal(rt.ctrl._confirm, null);
});

test("a refresh preserves visible selection and disposes replaced child controls", () => {
    const rt = setup();
    rt.ctrl.selectTab("b");
    let destroyed = 0;
    rt.ctrl._tabs[1].paneElement._wxCleanup = [() => destroyed++];
    rt.ctrl.updateData([{ id: "a" }, { id: "b" }]);
    assert.equal(rt.ctrl._activeTabId, "b");
    assert.equal(rt.ctrl._tabs[1].paneElement.classList.contains("active"), true);
    assert.equal(destroyed, 1);
    rt.ctrl.updateData([{ id: "b" }]);
    assert.equal(rt.ctrl._tabs[0].paneElement.classList.contains("active"), true);
    rt.ctrl.updateData([]);
    assert.equal(rt.ctrl._activeTabId, null);
});

test("a tab removed by a refresh before confirmation causes no DELETE or closed event", async () => {
    const rt = setup();
    const modal = open(rt);
    rt.ctrl.updateData([{ id: "b" }]);
    await modal._confirmButton.onclick();
    assert.deepEqual(rt.requests, []);
    assert.deepEqual(rt.closed, []);
});

test("a successful DELETE racing a refresh emits exactly one closed event", async () => {
    const request = deferred();
    const rt = setup({ remove: () => request.promise });
    const action = open(rt)._confirmButton.onclick();
    rt.ctrl.updateData([{ id: "b" }]);
    request.resolve({ ok: true });
    await action;
    assert.deepEqual(rt.closed, ["a"]);
    assert.equal(rt.ctrl._activeTabId, "b");
    assert.equal(rt.ctrl._tabs[0].paneElement.classList.contains("active"), true);
});

test("destroying the tab control removes its confirmation and ignores a late DELETE response", async () => {
    const request = deferred();
    const rt = setup({ remove: () => request.promise });
    const modal = open(rt);
    const action = modal._confirmButton.onclick();
    rt.ctrl.destroy();
    assert.equal(modal._element.parentNode, null);
    request.resolve({ ok: true });
    await action;
    await settle();
    assert.deepEqual(rt.closed, []);
});

test("the deletion control is a keyboard-accessible button outside the tab selection button", () => {
    const rt = setup();
    const close = rt.host.querySelector(".wx-webapp-tab-close");
    assert.equal(close.tagName, "BUTTON");
    assert.equal(close.type, "button");
    assert.equal(close.closest('[role="tab"]'), null);
    assert.ok(close.getAttribute("aria-label").includes("Alpha"));
});

test("a query started before deletion cannot resurrect the deleted tab", async () => {
    const rt = setup();
    const query = deferred();
    rt.ctrl._service.query = () => query.promise;
    const loading = rt.ctrl._receiveData();
    await open(rt)._confirmButton.onclick();
    query.resolve({ ok: true, data: { items: [{ id: "a" }, { id: "b" }] } });
    await loading;
    assert.deepEqual(Array.from(rt.ctrl._tabs, tab => tab.id), ["b"]);
    assert.equal(rt.ctrl._isLoading, false);
});

test("deletion updates the central resource and replaces any older resource query", async () => {
    const rt = setup();
    const items = [{ id: "a" }, { id: "b" }];
    const viewState = new rt.wxapp.ViewState(rt.host, { standalone: true, state: {
        tabs: { items, total: 2, data: { items }, loading: false, error: null }
    } });
    const reloaded = [];
    viewState.load = name => { reloaded.push(name); return Promise.resolve({ ok: true }); };
    rt.ctrl._resource = "tabs";
    rt.ctrl._viewState = viewState;
    rt.ctrl._store = viewState;
    await open(rt)._confirmButton.onclick();
    const slice = viewState.getState().tabs;
    assert.deepEqual(Array.from(slice.data.items, item => item.id), ["b"]);
    assert.deepEqual(Array.from(slice.items, item => item.id), ["b"]);
    assert.equal(slice.total, 1);
    assert.deepEqual(reloaded, ["tabs"]);
    rt.ctrl._applySlice({ ...slice, loading: true });
    assert.equal(rt.ctrl._tabs.length, 1);
});

test("loading flags do not rebuild unchanged ViewState panes or overwrite central loading", () => {
    const rt = setup();
    const slice = { data: { items: [{ id: "a" }, { id: "b" }] }, loading: false };
    rt.ctrl._applySlice(slice);
    const pane = rt.ctrl._tabs[0].paneElement;
    rt.ctrl._store.setState({ loading: true });
    rt.ctrl._applySlice({ ...slice, loading: true });
    assert.equal(rt.ctrl._tabs[0].paneElement, pane);
    assert.equal(rt.ctrl._store.getState().loading, true);
    assert.equal(rt.host.classList.contains("placeholder-glow"), true);
    rt.ctrl._applySlice({ loading: false });
    assert.equal(rt.ctrl._tabs.length, 0);
    assert.equal(rt.placeholder.parentNode, rt.ctrl._contentElement);
});

test("tabs without a service still require confirmation before local deletion", async () => {
    const rt = setup();
    rt.ctrl._service = null;
    rt.ctrl._restUri = "";
    const modal = open(rt);
    assert.equal(rt.ctrl._tabs.length, 2);
    await modal._confirmButton.onclick();
    assert.equal(rt.ctrl._tabs.length, 1);
    assert.deepEqual(rt.requests, []);
    assert.deepEqual(rt.closed, ["a"]);
});

test("an unresolved central resource cannot silently fall back to local deletion", async () => {
    const rt = setup();
    rt.ctrl._resource = "tabs";
    rt.ctrl._service = null;
    await open(rt)._confirmButton.onclick();
    assert.equal(rt.ctrl._tabs.length, 2);
    assert.deepEqual(rt.closed, []);
});

test("authored readonly tabs do not gain deletion buttons during base construction", () => {
    const rt = setup();
    const host = rt.createElement("div");
    host.dataset.readonly = "true";
    const pane = rt.createElement("div");
    pane.className = "wx-tab-view";
    pane.id = "authored";
    host.appendChild(pane);
    rt.document.body.appendChild(host);
    new rt.wxapp.TabCtrl(host);
    assert.equal(host.querySelector(".wx-webapp-tab-close"), null);
});

// light dismiss of the template menu belongs to the browser, so the control
// neither takes a document click listener nor has one to release on teardown
test("the template menu takes no document listener and teardown releases the detached empty-state controls", () => {
    const rt = setup();
    const host = rt.createElement("div");
    for (const id of ["first", "second"]) {
        const template = rt.createElement("template");
        template.id = id;
        host.appendChild(template);
    }
    const empty = rt.createElement("div");
    empty.className = "wx-webapp-tab-empty";
    host.appendChild(empty);
    rt.document.body.appendChild(host);
    let destroyed = 0;
    empty._wxCleanup = [() => destroyed++];
    const listeners = new Set();
    const add = rt.document.addEventListener.bind(rt.document);
    const remove = rt.document.removeEventListener.bind(rt.document);
    rt.document.addEventListener = (type, handler) => {
        if (type === "click") { listeners.add(handler); }
        add(type, handler);
    };
    rt.document.removeEventListener = (type, handler) => {
        if (type === "click") { listeners.delete(handler); }
        remove(type, handler);
    };
    const ctrl = new rt.wxapp.TabCtrl(host);
    ctrl.updateData([{ id: "a" }]);
    assert.equal(listeners.size, 0);
    assert.equal(ctrl._addTemplateMenu.getAttribute("popover"), "auto", "the menu dismisses through the top layer instead");
    ctrl.destroy();
    assert.equal(listeners.size, 0);
    assert.equal(destroyed, 1);
});
