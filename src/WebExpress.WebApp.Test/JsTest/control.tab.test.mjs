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
