import { test } from "node:test";
import assert from "node:assert/strict";
import { loadControl } from "./controls.harness.mjs";
import { deferred, settle } from "../../../../WebExpress.WebUI/src/WebExpress.WebUI.Test/JsTest/modal.harness.mjs";

function setup(options = {}) {
    const rt = loadControl({ file: "webexpress.webapp.tab.js", deps: [
        "i18n/en.js", "webexpress.webapp.tab.model.js"
    ] });
    const host = rt.createElement("div");
    if (options.editable !== false) { host.dataset.editableTab = "true"; }
    if (options.readonly) { host.dataset.readonly = "true"; }
    rt.document.body.appendChild(host);
    // the dom stub knows no text selection, no focus tracking and no window focus
    const proto = Object.getPrototypeOf(rt.createElement("input"));
    proto.select = proto.select || function () { };
    proto.focus = function () { rt.document.activeElement = this; };
    let windowFocused = true;
    rt.document.hasFocus = () => windowFocused;
    const ctrl = new rt.wxapp.TabCtrl(host);
    ctrl.updateData(options.tabs || [{ id: "a", label: "Alpha" }, { id: "b", label: "Beta", badge: "3" }]);
    const requests = [];
    if (options.service !== false) {
        ctrl._restUri = "/api/tabs";
        ctrl._service = { update: body => {
            requests.push(body);
            return options.update ? options.update(body) : Promise.resolve({ ok: true });
        } };
    }
    const renamed = [];
    host.addEventListener(rt.wxapp.Event.TAB_RENAMED_EVENT, event => renamed.push({ tabId: event.detail.tabId, label: event.detail.label }));
    return { ...rt, host, ctrl, requests, renamed, setWindowFocus: (value) => { windowFocused = value; } };
}

function header(rt, id) {
    return rt.ctrl._tabs.find(item => item.id === id).headerElement;
}

function button(rt, id) {
    return header(rt, id).querySelector(".nav-link");
}

function labelOf(rt, id) {
    return Array.from(button(rt, id).childNodes).filter(node => node.nodeType === 3).map(node => node.textContent).join("");
}

function field(rt) {
    return rt.ctrl._headerElement.querySelector(".wx-webapp-tab-rename-input");
}

function edit(rt, id) {
    rt.ctrl._startRename(rt.ctrl._tabs.find(item => item.id === id));
    const input = field(rt);
    assert.ok(input, "renaming opens the field");
    return input;
}

function key(input, name, extra = {}) {
    input.dispatchEvent({ type: "keydown", key: name, bubbles: true, preventDefault() { }, stopPropagation() { }, ...extra });
}

function blur(input) {
    input.dispatchEvent({ type: "blur", preventDefault() { }, stopPropagation() { } });
}

test("F2 opens the field in the header row, outside the tab list", () => {
    const rt = setup();
    assert.match(button(rt, "a").getAttribute("aria-keyshortcuts"), /F2/);
    key(button(rt, "a"), "F2");
    const input = field(rt);
    assert.ok(input);
    assert.equal(input.value, "Alpha");
    assert.equal(input.maxLength, 200);
    assert.equal(rt.ctrl._navElement.querySelector("input"), null, "a tab list may hold nothing but tabs");
    assert.ok(header(rt, "a").classList.contains("wx-webapp-tab-renaming"));
});

test("enter persists the trimmed label once the server accepted it and keeps the badge", async () => {
    const request = deferred();
    const rt = setup({ update: () => request.promise });
    const input = edit(rt, "b");
    input.value = "  Gamma  ";
    key(input, "Enter");
    assert.equal(labelOf(rt, "b"), "Beta", "the header waits for the server");
    assert.equal(input.readOnly, true);
    request.resolve({ ok: true });
    await settle();
    assert.equal(field(rt), null);
    assert.equal(header(rt, "b").classList.contains("wx-webapp-tab-renaming"), false);
    assert.equal(labelOf(rt, "b"), "Gamma");
    assert.equal(header(rt, "b").querySelector(".wx-tab-badge").textContent, "3");
    assert.deepEqual(JSON.parse(JSON.stringify(rt.requests)), [{ action: "rename", id: "b", label: "Gamma" }]);
    assert.deepEqual(rt.renamed, [{ tabId: "b", label: "Gamma" }]);
});

test("the enter that confirms an ime candidate does not commit", async () => {
    const rt = setup();
    const input = edit(rt, "a");
    input.value = "かな";
    key(input, "Enter", { isComposing: true });
    await settle();
    assert.ok(field(rt));
    assert.deepEqual(rt.requests, []);
});

test("escape, an empty or an unchanged label send nothing", async () => {
    const rt = setup();
    let input = edit(rt, "a");
    input.value = "Other";
    key(input, "Escape");
    input = edit(rt, "a");
    input.value = "   ";
    key(input, "Enter");
    input = edit(rt, "a");
    key(input, "Enter");
    await settle();
    assert.equal(field(rt), null);
    assert.equal(labelOf(rt, "a"), "Alpha");
    assert.deepEqual(rt.requests, []);
    assert.deepEqual(rt.renamed, []);
});

test("leaving the window keeps the edit open, leaving the field commits it", async () => {
    const rt = setup();
    const input = edit(rt, "a");
    input.value = "Pir";
    rt.setWindowFocus(false);
    blur(input);
    await settle();
    assert.ok(field(rt), "a window switch is no end of the edit");
    assert.deepEqual(rt.requests, []);
    rt.setWindowFocus(true);
    input.value = "Pirates";
    blur(input);
    await settle();
    assert.equal(field(rt), null);
    assert.equal(labelOf(rt, "a"), "Pirates");
});

test("a blur commit does not pull focus back to the tab", async () => {
    const rt = setup();
    const input = edit(rt, "a");
    const elsewhere = rt.createElement("input");
    rt.document.body.appendChild(elsewhere);
    let tabFocused = 0;
    button(rt, "a").focus = () => { tabFocused++; };
    input.value = "Elsewhere";
    elsewhere.focus();
    blur(input);
    await settle();
    assert.equal(field(rt), null);
    assert.equal(tabFocused, 0);
});

test("enter hands focus back to the tab", async () => {
    const rt = setup();
    const input = edit(rt, "a");
    let tabFocused = 0;
    button(rt, "a").focus = () => { tabFocused++; };
    input.value = "Focused";
    key(input, "Enter");
    await settle();
    assert.equal(tabFocused, 1);
});

test("a refused rename keeps the field open with an error and allows a retry", async () => {
    let ok = false;
    const rt = setup({ update: () => Promise.resolve(ok ? { ok: true } : { ok: false, error: { kind: "http" } }) });
    const input = edit(rt, "a");
    input.value = "Delta";
    key(input, "Enter");
    await settle();
    const error = rt.ctrl._headerElement.querySelector(".wx-webapp-tab-rename-error");
    assert.ok(field(rt), "the field stays where the label was typed");
    assert.equal(error.hidden, false);
    assert.ok(error.textContent);
    assert.equal(error.getAttribute("role"), "alert");
    assert.equal(input.getAttribute("aria-invalid"), "true");
    assert.equal(labelOf(rt, "a"), "Alpha");
    assert.deepEqual(rt.renamed, []);
    ok = true;
    key(input, "Enter");
    await settle();
    assert.equal(field(rt), null);
    assert.equal(labelOf(rt, "a"), "Delta");
});

test("a load that lands during the request does not undo the rename", async () => {
    const request = deferred();
    const rt = setup({ update: () => request.promise });
    const action = rt.ctrl._renameTab("a", "Delta");
    const before = rt.ctrl._queryVersion;
    rt.ctrl.updateData([{ id: "a", label: "Alpha" }, { id: "b", label: "Beta" }]);
    request.resolve({ ok: true });
    assert.equal(await action, true);
    assert.equal(labelOf(rt, "a"), "Delta");
    assert.ok(rt.ctrl._queryVersion > before, "a GET still in flight is superseded");
});

test("without a service the rename stays local", async () => {
    const rt = setup({ service: false });
    assert.equal(await rt.ctrl._renameTab("a", "Local"), true);
    assert.equal(labelOf(rt, "a"), "Local");
    assert.deepEqual(rt.renamed, [{ tabId: "a", label: "Local" }]);
});

test("in a ViewState the label is patched into the slice without rebuilding the panes", async () => {
    const rt = setup();
    const data = { items: [{ id: "a", label: "Alpha" }, { id: "b", label: "Beta" }] };
    let state = { tabs: { data: data, items: data.items } };
    let loads = 0;
    rt.ctrl._resource = "tabs";
    rt.ctrl._lastSliceData = data;
    rt.ctrl._viewState = {
        sliceKey: () => "tabs",
        setState: (fn) => {
            const patch = fn(state);
            if (patch) {
                state = { ...state, ...patch };
                rt.ctrl._applySlice(state.tabs);
            }
        },
        load: () => { loads++; }
    };
    const pane = rt.ctrl._tabs[0].paneElement;
    assert.equal(await rt.ctrl._renameTab("a", "Delta"), true);
    assert.equal(state.tabs.data.items[0].label, "Delta");
    assert.equal(state.tabs.items[0].label, "Delta");
    assert.equal(loads, 0);
    assert.equal(rt.ctrl._tabs[0].paneElement, pane, "the pane survives");
    assert.equal(labelOf(rt, "a"), "Delta");
});

test("a refresh during the edit closes the field instead of renaming the replaced tab", async () => {
    const rt = setup();
    const input = edit(rt, "a");
    input.value = "Stale";
    rt.ctrl.updateData([{ id: "a", label: "Alpha" }]);
    assert.equal(field(rt), null);
    key(input, "Enter");
    await settle();
    assert.deepEqual(rt.requests, []);
    assert.equal(labelOf(rt, "a"), "Alpha");
});

test("readonly and disabled controls cannot rename", async () => {
    for (const options of [{ readonly: true }, { editable: false }]) {
        const rt = setup(options);
        key(button(rt, "a"), "F2");
        assert.equal(field(rt), null);
        assert.equal(await rt.ctrl._renameTab("a", "Nope"), false);
        assert.deepEqual(rt.requests, []);
    }
});
