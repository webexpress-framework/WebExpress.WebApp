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

/**
 * Loads a quickfilter bound to a REST endpoint that serves one application
 * filter and one user-defined filter, and returns the runtime, the host and the
 * calls the endpoint received.
 * @param {object} [options] - Optional overrides: write (the write response).
 * @returns {Promise<object>} The runtime, the host element and the calls.
 */
async function loadCustomQuickfilter(options = {}) {
    const calls = [];
    const rt = loadControl({
        file: "webexpress.webapp.quickfilter.js",
        fetch: async (url, init) => {
            const method = (init && init.method) || "GET";
            calls.push({ url: String(url), method: method, body: init && init.body });

            const payload = method === "GET"
                ? {
                    filters: [
                        { id: "classics", name: "Classics" },
                        { id: "mine", name: "Mine", custom: true, criteria: "author:me" }
                    ]
                }
                : (options.write !== undefined ? options.write : { filters: [{ id: "fresh", name: "Fresh", custom: true }] });

            return {
                ok: true,
                status: method === "DELETE" ? 204 : 200,
                headers: { get: () => "application/json" },
                json: async () => payload
            };
        }
    });

    const host = rt.createElement("div");
    appendServiceIsland(rt.document, host, { name: "data", baseUri: "/api/filters", method: "GET" });

    // the authored edit action, which the client copies onto the options menu of
    // every user-defined chip
    if (options.editAction !== false) {
        const prototype = rt.createElement("div");
        prototype.classList.add("wx-quickfilter-edit-action");
        prototype.dataset.wxPrimaryAction = "modal";
        prototype.dataset.wxPrimaryTarget = "#filtereditor";
        prototype.dataset.wxPrimaryUri = "/games";
        host.appendChild(prototype);
    }

    rt.document.body.appendChild(host);

    const ctrl = new rt.wxapp.QuickFilterCtrl(host);

    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    return { rt, host, ctrl, calls };
}

test("wx-webapp-quickfilter offers the options menu only on a user-defined filter", async () => {
    const { host } = await loadCustomQuickfilter();

    const mine = host.querySelectorAll(".wx-quickfilter-btn-chip").find((c) => c.id === "mine");
    assert.ok(mine.querySelector(".wx-quickfilter-menu-toggle"), "the user-defined chip carries the options toggle");

    // a button holds no buttons, so the menu is a sibling of the chip inside the
    // wrapper the two share
    const wrapper = host.querySelectorAll(".wx-quickfilter-chip-wrap")
        .find((w) => w.querySelector(".wx-quickfilter-btn-chip")?.id === "mine");
    assert.ok(wrapper, "the user-defined chip sits in a wrapper");
    const entries = wrapper.querySelectorAll(".wx-quickfilter-menu .dropdown-item");
    assert.equal(entries.length, 2, "the menu offers edit and remove");
    assert.equal(mine.querySelectorAll("button").length, 0, "the chip nests no buttons");

    // editing runs the authored action, so the dialog behind it is the
    // application's; the uri names the filter it opens on
    assert.equal(entries[0].dataset.wxPrimaryAction, "modal", "the edit entry carries the authored action");
    assert.equal(entries[0].dataset.wxPrimaryUri, "/games?id=mine", "the uri names the filter being edited");

    const classics = host.querySelectorAll(".wx-quickfilter-btn-chip").find((c) => c.id === "classics");
    assert.equal(classics.querySelectorAll(".wx-quickfilter-menu-toggle").length, 0, "an application filter carries no menu");
});

test("wx-webapp-quickfilter removes a user-defined filter at once", async () => {
    const { rt, host, ctrl, calls } = await loadCustomQuickfilter();

    assert.ok(rt.wx.FilterRegistry.getFilterConfig("mine"), "the filter is known before the removal");

    ctrl._removeFilter({ id: "mine" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const del = calls.find((c) => c.method === "DELETE");
    assert.ok(del, "the removal reaches the endpoint");
    assert.ok(del.url.includes("id=mine"), "the removal names the filter");

    const ids = host.querySelectorAll(".wx-quickfilter-btn-chip").map((c) => c.id);
    assert.ok(!ids.includes("mine"), "the chip is gone without a reload");
    assert.ok(ids.includes("classics"), "the remaining filters stay");
    assert.equal(rt.wx.FilterRegistry.getFilterConfig("mine"), null, "the definition is dropped from the registry");
});

test("wx-webapp-quickfilter shows a created filter at once and applies it", async () => {
    const { rt, host, ctrl, calls } = await loadCustomQuickfilter();

    ctrl._saveFilter({ id: null, name: "Fresh", icon: null, color: "#123456", criteria: "state:open" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const post = calls.find((c) => c.method === "POST");
    assert.ok(post, "the creation reaches the endpoint");
    assert.ok(post.body.includes("state:open"), "the criteria travel to the endpoint");

    const ids = host.querySelectorAll(".wx-quickfilter-btn-chip").map((c) => c.id);
    assert.ok(ids.includes("fresh"), "the new chip appears without a reload");
    assert.ok(rt.wx.FilterRegistry.getActiveFilters().includes("fresh"), "the new filter is applied right away");
});

test("wx-webapp-quickfilter adopts a changed filter without a reload", async () => {
    const { rt, host, ctrl } = await loadCustomQuickfilter({
        write: { filters: [{ id: "mine", name: "Renamed", custom: true, criteria: "author:me" }] }
    });

    ctrl._saveFilter({ id: "mine", name: "Renamed", icon: null, color: null, criteria: "author:me" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const mine = host.querySelectorAll(".wx-quickfilter-btn-chip").find((c) => c.id === "mine");
    assert.ok(mine.textContent.includes("Renamed"), "the chip shows the new name at once");
    assert.equal(rt.wx.FilterRegistry.getFilterConfig("mine").name, "Renamed", "the registry carries the new name");
});
