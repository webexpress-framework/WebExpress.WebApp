/**
 * Headless contract and behaviour test for the DropdownCtrl control (wx-webapp-dropdown).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle. The focused test below
 * pins where the parts of the menu land: the loaded items inside the scroll region, the search
 * field and the static entries outside it, so only the list scrolls.
 */
import { test } from "node:test";
import assert from "node:assert";
import { loadControl } from "./controls.harness.mjs";
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.dropdown.js",
    selector: "wx-webapp-dropdown",
    ctrl: "DropdownCtrl"
});

test("wx-webapp-dropdown scrolls only the loaded items, never the search or the static entries", () => {
    const rt = loadControl({ file: "webexpress.webapp.dropdown.js" });

    const host = rt.createElement("div");
    host.classList.add("wx-webapp-dropdown");
    const manage = rt.createElement("div");
    manage.classList.add("wx-dropdown-item");
    manage.textContent = "Manage";
    host.appendChild(manage);
    rt.document.body.appendChild(host);

    const ctrl = new rt.wxapp.DropdownCtrl(host);
    ctrl._updateDynamicItems([{ id: "a", text: "Alpha" }, { id: "b", text: "Beta" }]);

    const menu = host.querySelector("ul.dropdown-menu");
    const region = host.querySelector(".wx-dropdown-scroll");
    assert.ok(region, "the menu carries a scroll region");
    assert.equal(region.parentNode, menu, "the region is an entry of the menu itself, where the css finds it");

    const texts = (root) => Array.from(root.querySelectorAll("a.dropdown-item")).map((a) => a.textContent);
    assert.deepEqual(texts(region), ["Alpha", "Beta"], "the loaded items sit inside the region");
    assert.ok(!region.querySelector("input"), "the search field stays above the region");
    assert.ok(texts(menu).includes("Manage") && !texts(region).includes("Manage"), "a static entry stays below the region");

    ctrl._updateDynamicItems([{ id: "c", text: "Gamma" }]);
    assert.deepEqual(texts(region), ["Gamma"], "a new result replaces the previous one inside the region");
    assert.equal(texts(menu).filter((t) => t === "Manage").length, 1, "the static entry is neither lost nor doubled");
});
