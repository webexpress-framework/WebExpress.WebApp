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
    if (options.deletable !== false) { host.dataset.deletableTab = "true"; }
    if (options.readonly) { host.dataset.readonly = "true"; }
    rt.document.body.appendChild(host);
    // the dom stub knows no text selection and no focus tracking
    const proto = Object.getPrototypeOf(rt.createElement("input"));
    proto.select = proto.select || function () { };
    proto.focus = function () { rt.document.activeElement = this; };
    rt.document.hasFocus = () => true;
    const ctrl = new rt.wxapp.TabCtrl(host);
    ctrl.updateData(options.tabs || [{ id: "a", label: "Alpha" }, { id: "b", label: "Beta", tabColor: "#198754" }]);
    const requests = [];
    ctrl._restUri = "/api/tabs";
    ctrl._service = { update: body => {
        requests.push(JSON.parse(JSON.stringify(body)));
        return options.update ? options.update(body) : Promise.resolve({ ok: true });
    } };
    const recolored = [];
    host.addEventListener(rt.wxapp.Event.TAB_RECOLORED_EVENT, event => recolored.push({ tabId: event.detail.tabId, color: event.detail.color }));
    return { ...rt, host, ctrl, requests, recolored };
}

function tabOf(rt, id) {
    return rt.ctrl._tabs.find(item => item.id === id);
}

function openMenu(rt, id) {
    const tab = tabOf(rt, id);
    tab.headerElement.querySelector(".wx-webapp-tab-menu").click();
    assert.ok(tab.menuElement, "the glyph opens the tab menu");
    return tab.menuElement;
}

function entries(menu) {
    return Array.from(menu.querySelectorAll(".dropdown-item")).map(item => item.textContent);
}

function entry(menu, label) {
    return Array.from(menu.querySelectorAll(".dropdown-item")).find(item => item.textContent === label);
}

test("the menu offers rename, color and delete, the way the kanban column menu does", () => {
    const rt = setup();
    const menu = openMenu(rt, "a");
    assert.deepEqual(entries(menu), ["Rename tab", "Color", "Delete tab"]);
    assert.ok(menu.querySelector(".dropdown-divider"), "the destructive entry stands apart");
    assert.equal(menu.matches(":popover-open"), true);
});

test("glyph and menu stay out of the tab list, which may hold nothing but tabs", () => {
    const rt = setup();
    const glyph = tabOf(rt, "a").headerElement.querySelector(".wx-webapp-tab-menu");
    assert.notEqual(glyph.tagName, "BUTTON", "a second control in the tab list is not allowed there");
    assert.equal(glyph.getAttribute("aria-hidden"), "true");
    assert.equal(glyph.closest('[role="tab"]'), null);
    const menu = openMenu(rt, "a");
    assert.equal(rt.ctrl._navElement.contains(menu), false);
    assert.equal(rt.ctrl._headerElement.contains(menu), true);
});

test("the entries follow the flags, and without any the menu is gone", () => {
    assert.deepEqual(entries(openMenu(setup({ deletable: false }), "a")), ["Rename tab", "Color"]);
    assert.deepEqual(entries(openMenu(setup({ editable: false }), "a")), ["Delete tab"]);
    for (const options of [{ editable: false, deletable: false }, { readonly: true }]) {
        const rt = setup(options);
        assert.equal(rt.host.querySelector(".wx-webapp-tab-menu"), null, JSON.stringify(options));
        assert.equal(rt.ctrl._navElement.querySelector(".nav-link").hasAttribute("aria-keyshortcuts"), false);
    }
});

test("the keyboard reaches the menu as a context menu and lands on its first entry", () => {
    const rt = setup();
    const link = tabOf(rt, "a").headerElement.querySelector(".nav-link");
    assert.equal(link.getAttribute("aria-keyshortcuts"), "Shift+F10 F2 Delete");
    let prevented = false;
    link.dispatchEvent({ type: "contextmenu", preventDefault: () => { prevented = true; } });
    assert.ok(prevented, "the browser's own context menu stays closed");
    const menu = tabOf(rt, "a").menuElement;
    assert.equal(menu.matches(":popover-open"), true);
    assert.equal(rt.document.activeElement, entry(menu, "Rename tab"));
});

test("closing the menu hands focus back to the tab, which the glyph cannot take", () => {
    const rt = setup();
    const menu = openMenu(rt, "a");
    entry(menu, "Rename tab").focus();
    rt.wx.NativeMenu.hide(menu);
    assert.equal(rt.document.activeElement, tabOf(rt, "a").headerElement.querySelector(".nav-link"));
});

test("a click on the glyph of an open menu closes it instead of reopening it", () => {
    const rt = setup();
    const menu = openMenu(rt, "a");
    const glyph = tabOf(rt, "a").headerElement.querySelector(".wx-webapp-tab-menu");
    // the browser dismisses the open menu on pointerdown, before the click arrives
    glyph.dispatchEvent({ type: "pointerdown" });
    rt.wx.NativeMenu.hide(menu);
    glyph.click();
    assert.equal(menu.matches(":popover-open"), false);
});

test("rename from the menu opens the rename field", () => {
    const rt = setup();
    entry(openMenu(rt, "a"), "Rename tab").click();
    assert.equal(tabOf(rt, "a").menuElement.matches(":popover-open"), false);
    assert.ok(rt.ctrl._headerElement.querySelector(".wx-webapp-tab-rename-input"));
});

test("the color level drills down in place and persists the chosen swatch", async () => {
    const rt = setup();
    const menu = openMenu(rt, "a");
    entry(menu, "Color").click();
    assert.equal(menu.matches(":popover-open"), true, "the sub-level opens in the same menu");
    assert.deepEqual(entries(menu), ["Back", "None"]);
    const swatches = menu.querySelectorAll(".wx-webapp-tab-swatch");
    assert.equal(swatches.length, 12);
    swatches[0].click();
    await settle();
    assert.equal(menu.matches(":popover-open"), false);
    assert.deepEqual(rt.requests, [{ action: "color", id: "a", color: "#0d6efd" }]);
    const header = tabOf(rt, "a").headerElement;
    assert.equal(header.style.getPropertyValue("--wx-webapp-tab-color"), "#0d6efd");
    assert.equal(header.classList.contains("wx-webapp-tab-colored"), true);
    assert.deepEqual(rt.recolored, [{ tabId: "a", color: "#0d6efd" }]);
});

test("the color marks active and inactive tabs alike and stays out of the tab content", () => {
    const rt = setup({ tabs: [
        { id: "a", label: "Alpha", icon: "wx-icon-light wx-icon-light-ship", tabColor: "#dc3545" },
        { id: "b", label: "Beta", tabColor: "#198754" }
    ] });
    rt.ctrl.selectTab("a");
    for (const [id, color] of [["a", "#dc3545"], ["b", "#198754"]]) {
        const header = tabOf(rt, id).headerElement;
        assert.equal(header.classList.contains("wx-webapp-tab-colored"), true, id);
        assert.equal(header.style.getPropertyValue("--wx-webapp-tab-color"), color, id);
    }
    const link = tabOf(rt, "a").headerElement.querySelector(".nav-link");
    assert.deepEqual(Array.from(link.children).map(child => child.tagName), ["I"], "the underline is drawn by css, not by markup");
});

test("a tab carries its color from the payload and marks it in the palette; none removes it", async () => {
    const rt = setup();
    const header = tabOf(rt, "b").headerElement;
    assert.equal(header.style.getPropertyValue("--wx-webapp-tab-color"), "#198754");
    const menu = openMenu(rt, "b");
    entry(menu, "Color").click();
    const active = menu.querySelector(".wx-webapp-tab-swatch.active");
    assert.equal(active.title, "#198754");
    entry(menu, "None").click();
    await settle();
    assert.deepEqual(rt.requests, [{ action: "color", id: "b", color: null }]);
    assert.equal(header.classList.contains("wx-webapp-tab-colored"), false);
    assert.equal(header.style.getPropertyValue("--wx-webapp-tab-color"), "");
});

test("back returns to the top level", () => {
    const rt = setup();
    const menu = openMenu(rt, "a");
    entry(menu, "Color").click();
    entry(menu, "Back").click();
    assert.deepEqual(entries(menu), ["Rename tab", "Color", "Delete tab"]);
});

test("a refused color keeps the old one and is announced", async () => {
    const request = deferred();
    const rt = setup({ update: () => request.promise });
    const action = rt.ctrl._recolorTab("b", "#dc3545");
    assert.equal(tabOf(rt, "b").headerElement.style.getPropertyValue("--wx-webapp-tab-color"), "#198754", "nothing changes before the server agrees");
    request.resolve({ ok: false, error: { kind: "http" } });
    assert.equal(await action, false);
    assert.equal(tabOf(rt, "b").headerElement.style.getPropertyValue("--wx-webapp-tab-color"), "#198754");
    const status = rt.ctrl._headerElement.querySelector(".wx-webapp-tab-status");
    assert.equal(status.getAttribute("role"), "alert");
    assert.equal(status.hidden, false);
    assert.ok(status.textContent);
    assert.deepEqual(rt.recolored, []);
    rt.ctrl.destroy();
});

test("in a ViewState the color is patched into the slice without rebuilding the panes", async () => {
    const rt = setup();
    const data = { items: [{ id: "a", label: "Alpha" }, { id: "b", label: "Beta" }] };
    let state = { tabs: { data: data, items: data.items } };
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
        }
    };
    const pane = tabOf(rt, "a").paneElement;
    assert.equal(await rt.ctrl._recolorTab("a", "#6f42c1"), true);
    assert.equal(state.tabs.data.items[0].tabColor, "#6f42c1");
    assert.equal(tabOf(rt, "a").paneElement, pane, "the pane survives");
});

test("a refresh drops the menus of replaced tabs", () => {
    const rt = setup();
    const menu = openMenu(rt, "a");
    rt.ctrl.updateData([{ id: "a", label: "Alpha" }]);
    assert.equal(menu.isConnected, false);
});

test("without permission the actions refuse even when called directly", async () => {
    const rt = setup({ editable: false, deletable: false });
    assert.equal(await rt.ctrl._recolorTab("a", "#0d6efd"), false);
    assert.equal(await rt.ctrl._renameTab("a", "Nope"), false);
    rt.ctrl._closeTab("a");
    assert.equal(rt.ctrl._confirm, null);
    assert.deepEqual(rt.requests, []);
});
