/**
 * Headless contract test for the SearchCtrl control (wx-webapp-search).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 */
import { contract } from "./controls.contract.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadControl } from "./controls.harness.mjs";

contract({
    file: "webexpress.webapp.search.js",
    selector: "wx-webapp-search",
    ctrl: "SearchCtrl"
});

function runtime(storage) {
    return loadControl({
        file: "webexpress.webapp.search.js",
        deps: ["webexpress.webapp.wql.prompt.model.js", "webexpress.webapp.wql.prompt.view.js", "webexpress.webapp.wql.prompt.js"],
        extraGlobals: storage ? { localStorage: storage } : {}
    });
}

function search(rt, id, initial = "basic", persistKey) {
    const element = rt.createElement("div");
    element.id = id;
    element.dataset.initial = initial;
    if (persistKey) element.dataset.persistKey = persistKey;
    rt.document.body.appendChild(element);
    return new rt.wxapp.SearchCtrl(element);
}

test("AdvancedSearch remembers its mode per control across page loads", () => {
    const first = runtime();
    const ctrl = search(first, "issues");
    ctrl._toggleModeLink.dispatchEvent({ type: "click", preventDefault() {} });
    assert.equal(first.sandbox.localStorage.getItem("wx_search_mode_issues"), "wql");
    assert.equal(ctrl._wqlHost.style.display, "block");
    assert.equal(search(first, "people")._initialMode, "basic", "another search keeps its own mode");
    assert.equal(first.document.cookie, "");
    const next = runtime(first.sandbox.localStorage);
    const restored = search(next, "issues");
    assert.equal(restored._initialMode, "wql");
    assert.equal(restored._basicHost.style.display, "none");
    restored._toggleModeLink.dispatchEvent({ type: "click", preventDefault() {} });
    assert.equal(next.sandbox.localStorage.getItem("wx_search_mode_issues"), "basic");
});

test("AdvancedSearch supports a stable explicit key and ignores invalid preferences", () => {
    const rt = runtime();
    const first = search(rt, "generated-1", "wql", "issue-search");
    assert.equal(first._initialMode, "wql");
    assert.equal(search(rt, "generated-2", "basic", "issue-search")._initialMode, "wql");
    rt.sandbox.localStorage.setItem("issue-search", "invalid");
    assert.equal(search(rt, "generated-3", "basic", "issue-search")._initialMode, "basic");
});

test("AdvancedSearch stays usable when localStorage is blocked", () => {
    const rt = runtime({ getItem() { throw new Error("SecurityError"); }, setItem() { throw new Error("QuotaExceededError"); } });
    const ctrl = search(rt, "issues", "wql");
    assert.doesNotThrow(() => ctrl._toggleModeLink.dispatchEvent({ type: "click", preventDefault() {} }));
    assert.equal(ctrl._basicHost.style.display, "block");
    assert.equal(rt.document.cookie, "");
});

test("AdvancedSearch keeps the authored children in its extended content", () => {
    const rt = runtime();
    const element = rt.createElement("div");
    element.id = "children";
    const button = rt.createElement("button");
    button.textContent = "Save";
    element.appendChild(button);
    rt.document.body.appendChild(element);
    const ctrl = new rt.wxapp.SearchCtrl(element);
    assert.equal(ctrl._extendedContent.childNodes.length, 1, "the child survives the host being cleared");
    assert.equal(ctrl._extendedContent.childNodes[0], button);
});

test("AdvancedSearch opens a given WQL query in WQL mode, ahead of the remembered mode", () => {
    const rt = runtime();
    rt.sandbox.localStorage.setItem("wx_search_mode_saved", "basic");
    const element = rt.createElement("div");
    element.id = "saved";
    element.setAttribute("data-wql", "state = 'open'");
    rt.document.body.appendChild(element);
    const ctrl = new rt.wxapp.SearchCtrl(element);
    assert.equal(ctrl._initialMode, "wql");
    assert.equal(ctrl._wqlHost.style.display, "block");
    assert.equal(ctrl._wqlCtrl.value, "state = 'open'");
    assert.equal(element.hasAttribute("data-wql"), false, "the host carries no authoring attribute");
});

test("AdvancedSearch reports the WQL text when switching to WQL mode", () => {
    const rt = runtime();
    const ctrl = search(rt, "switch", "basic");
    ctrl._wqlCtrl.value = "priority > 2";
    const filters = [];
    ctrl._element.addEventListener(rt.wx.Event.CHANGE_FILTER_EVENT, (e) => filters.push(e.detail));
    ctrl._toggleModeLink.dispatchEvent({ type: "click", preventDefault() {} });
    assert.equal(filters.length, 1);
    assert.equal(filters[0].searchType, "wql");
    assert.equal(filters[0].value, "priority > 2", "the query is read from the prompt, not from its contenteditable");
});
