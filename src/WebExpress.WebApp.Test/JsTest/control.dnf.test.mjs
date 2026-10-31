/**
 * Headless tests for the REST backed read-only DNF view (wx-webapp-dnf). The
 * shared contract (controls.contract.mjs) verifies that the control registers
 * correctly and survives a construct / teardown lifecycle; the tests below pin
 * the one thing the REST variant adds - turning stored term ids into labels a
 * reader can act on.
 *
 * Run with Node 18 or newer from the JsTest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadControl } from "./controls.harness.mjs";
import { appendServiceIsland } from "./harness.mjs";
import { contract } from "./controls.contract.mjs";

const deps = ["webexpress.webapp.selection.model.js"];

contract({
    file: "webexpress.webapp.dnf.js",
    selector: "wx-webapp-dnf",
    ctrl: "DnfCtrl",
    deps
});

/**
 * Mounts a REST backed read-only view over a stubbed endpoint.
 * @param {object} [options] - { value, items, failing, compact }.
 * @returns {Promise<object>} The runtime, the host and the control.
 */
async function mount(options = {}) {
    const items = options.items ?? [
        { id: "a", name: "Amsterdam" },
        { id: "b", name: "Berlin" },
        { id: "c", name: "Cairo" }
    ];

    const rt = loadControl({
        deps,
        file: "webexpress.webapp.dnf.js",
        fetch: async () => {
            if (options.failing) {
                return { ok: false, status: 500, headers: { get: () => "application/json" }, json: async () => ({}) };
            }
            return {
                ok: true,
                status: 200,
                headers: { get: () => "application/json" },
                json: async () => ({ items })
            };
        }
    });

    const host = rt.createElement("div");
    if (options.value) {
        host.dataset.value = options.value;
    }
    if (options.compact) {
        host.dataset.compact = "true";
    }
    appendServiceIsland(rt.document, host, { name: "data", baseUri: "/api/terms", method: "GET" });
    rt.document.body.appendChild(host);

    const ctrl = new rt.wxapp.DnfCtrl(host);

    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    return { rt, host, ctrl };
}

test("the stored term ids become labels once the terms arrive", async () => {
    const { ctrl } = await mount({ value: "a;b|c" });

    assert.equal(ctrl.text, "(Amsterdam and Berlin) or Cairo");
});

test("the expression is readable before the terms arrive, as its ids", async () => {
    const rt = loadControl({
        deps,
        file: "webexpress.webapp.dnf.js",
        fetch: async () => new Promise(() => { })
    });

    const host = rt.createElement("div");
    host.dataset.value = "a;b";
    appendServiceIsland(rt.document, host, { name: "data", baseUri: "/api/terms", method: "GET" });
    rt.document.body.appendChild(host);

    const ctrl = new rt.wxapp.DnfCtrl(host);

    // a filter that renders as nothing while its request is open would claim the
    // rows are unfiltered, which is the one thing it must never say falsely
    assert.equal(ctrl.text, "a and b");
});

test("a failed request leaves the expression standing rather than blanking it", async () => {
    const { ctrl } = await mount({ value: "a;b", failing: true });

    assert.equal(ctrl.text, "a and b");
    assert.deepEqual(ctrl.value, [["a", "b"]]);
});

test("the compact view keeps the full expression in the title", async () => {
    const { host } = await mount({ value: "a;b|c", compact: true });

    assert.equal(host.getAttribute("title"), "(Amsterdam and Berlin) or Cairo");
});

test("without an endpoint the view stays a plain read of what it was given", async () => {
    const rt = loadControl({ deps, file: "webexpress.webapp.dnf.js" });

    const host = rt.createElement("div");
    host.dataset.value = "a";
    rt.document.body.appendChild(host);

    const ctrl = new rt.wxapp.DnfCtrl(host);

    assert.equal(ctrl.text, "a");
});
