/**
 * Headless contract test for the TabCtrl control (wx-webapp-tab).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle. The
 * focused test below covers the badge of a REST-loaded tab header.
 */
import { test } from "node:test";
import assert from "node:assert";
import { loadControl } from "./controls.harness.mjs";
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.tab.js",
    selector: "wx-webapp-tab",
    ctrl: "TabCtrl",
    deps: ["webexpress.webapp.tab.model.js"]
});

test("wx-webapp-tab renders REST-loaded tabs with badge and badge color", () => {
    const rt = loadControl({
        file: "webexpress.webapp.tab.js",
        deps: ["webexpress.webapp.tab.model.js"]
    });

    const host = rt.createElement("div");
    rt.document.body.appendChild(host);

    const ctrl = new rt.wxapp.TabCtrl(host);

    // feed the tab set the same way a REST load does
    ctrl.updateData([
        { id: "tab-islands", label: "Islands", badge: "7", badgeColor: "text-bg-danger" },
        { id: "tab-styled", label: "Styled", badge: "3", badgeStyle: "background:#7c3aed;" },
        { id: "tab-plain", label: "Plain" }
    ]);

    const badges = host.querySelectorAll(".wx-tab-badge");
    assert.equal(badges.length, 2, "only badged tabs carry a badge");

    const colored = badges.find((b) => b.classList.contains("text-bg-danger"));
    assert.ok(colored, "the system color lands as a css class");
    assert.equal(colored.textContent, "7", "the badge carries the count");

    const styled = badges.find((b) => (b.style.cssText || "").includes("#7c3aed"));
    assert.ok(styled, "the user color lands as an inline style");
});

test("wx-webapp-tab shows the empty-state placeholder while no tab item exists", () => {
    const rt = loadControl({
        file: "webexpress.webapp.tab.js",
        deps: ["webexpress.webapp.tab.model.js"]
    });

    const host = rt.createElement("div");
    const placeholder = rt.createElement("div");
    placeholder.className = "wx-webapp-tab-empty d-none";
    placeholder.appendChild(rt.createElement("div"));
    host.appendChild(placeholder);
    rt.document.body.appendChild(host);

    const ctrl = new rt.wxapp.TabCtrl(host);
    const content = host.querySelector(".wx-tab-content");

    // no data source, so the tab set is known to be empty right away
    assert.equal(placeholder.parentNode, content, "the placeholder sits in the pane host");
    assert.equal(placeholder.classList.contains("d-none"), false, "the server-side hiding is lifted");

    ctrl.updateData([{ id: "tab-plain", label: "Plain" }]);
    assert.equal(placeholder.parentNode, null, "a tab item replaces the placeholder");
    assert.equal(placeholder._wxDetached, true, "the detach is flagged, so the controller keeps its instances");

    ctrl.updateData([]);
    assert.equal(placeholder.parentNode, content, "an empty payload brings the placeholder back");
});

test("wx-webapp-tab keeps the empty-state placeholder away while the first load is in flight", () => {
    const rt = loadControl({
        file: "webexpress.webapp.tab.js",
        deps: ["webexpress.webapp.tab.model.js"]
    });

    const host = rt.createElement("div");
    const island = rt.createElement("wx-service");
    island.setAttribute("name", "data");
    island.setAttribute("base-uri", "/api/1/tab");
    host.appendChild(island);

    const placeholder = rt.createElement("div");
    placeholder.className = "wx-webapp-tab-empty d-none";
    host.appendChild(placeholder);
    rt.document.body.appendChild(host);

    new rt.wxapp.TabCtrl(host);

    assert.equal(placeholder.parentNode, null, "a pending load must not read as an empty tab set");
});

test("wx-webapp-tab takes the header layout from the server-rendered data-layout", () => {
    const rt = loadControl({
        file: "webexpress.webapp.tab.js",
        deps: ["webexpress.webapp.tab.model.js"]
    });

    const host = rt.createElement("div");
    host.dataset.layout = "underline";
    rt.document.body.appendChild(host);

    new rt.wxapp.TabCtrl(host);

    const nav = host.querySelector(".wx-tab-nav");
    assert.ok(nav.classList.contains("nav-underline"), "the authored layout reaches the header list");
    assert.equal(nav.classList.contains("nav-tabs"), false, "the default layout no longer applies");
});
