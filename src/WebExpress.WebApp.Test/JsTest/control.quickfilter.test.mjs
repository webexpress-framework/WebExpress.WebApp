/**
 * Headless contract test for the QuickFilterCtrl control (wx-webapp-quickfilter).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle. The
 * focused test below covers the icon and badge visuals of the REST-loaded
 * filter chips.
 */
import { test } from "node:test";
import assert from "node:assert";
import { loadControl } from "./controls.harness.mjs";
import { appendServiceIsland } from "./harness.mjs";
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.quickfilter.js",
    selector: "wx-webapp-quickfilter",
    ctrl: "QuickFilterCtrl"
});

test("wx-webapp-quickfilter renders REST-loaded filters with icon and badge", async () => {
    const rt = loadControl({
        file: "webexpress.webapp.quickfilter.js",
        fetch: async () => ({
            ok: true,
            status: 200,
            headers: { get: () => "application/json" },
            json: async () => ({
                filters: [
                    { id: "classics", name: "Classics", icon: "fas fa-star", badge: "5", badgeColor: "text-bg-danger" },
                    { id: "modern", name: "Modern", badge: "3", badgeStyle: "background:#7c3aed;" },
                    { id: "colored", name: "Colored", color: "btn-success" },
                    { id: "tinted", name: "Tinted", colorValue: "#00aa88" },
                    { id: "plain", name: "Plain" }
                ]
            })
        })
    });

    const host = rt.createElement("div");
    appendServiceIsland(rt.document, host, { name: "data", baseUri: "/api/filters", method: "GET" });
    rt.document.body.appendChild(host);

    new rt.wxapp.QuickFilterCtrl(host);

    // let the fetch promise chain settle before inspecting the rendered chips
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const chips = host.querySelectorAll(".wx-quickfilter-btn-chip");
    assert.equal(chips.length, 5, "every REST filter renders as a chip");

    const classics = chips.find((c) => c.id === "classics");
    assert.ok(classics.querySelector("i.fa-star"), "the icon spec renders as an icon element");
    const classicsBadge = classics.querySelector(".wx-quickfilter-badge");
    assert.ok(classicsBadge, "the chip carries the badge");
    assert.equal(classicsBadge.textContent, "5", "the badge carries the count");
    assert.ok(classicsBadge.classList.contains("text-bg-danger"), "the system color lands as a css class");

    const modern = chips.find((c) => c.id === "modern");
    const modernBadge = modern.querySelector(".wx-quickfilter-badge");
    assert.ok((modernBadge.style.cssText || "").includes("#7c3aed"), "the user color lands as an inline style");

    const plain = chips.find((c) => c.id === "plain");
    assert.equal(plain.querySelectorAll(".wx-quickfilter-badge").length, 0, "a filter without a badge stays unchanged");

    // the system chip color travels as a btn-<color> class through data-color
    // (the button controller consumes it into a class on a real page), the
    // user-defined color feeds the chip accent directly
    const colored = chips.find((c) => c.id === "colored");
    assert.equal(colored.dataset.color, "btn-success", "the system color reaches the chip as its button class");

    const tinted = chips.find((c) => c.id === "tinted");
    assert.equal(tinted.style.getPropertyValue("--wx-quickfilter-accent"), "#00aa88", "the user color feeds the chip accent");
});
