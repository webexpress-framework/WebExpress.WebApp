/**
 * Headless tests for the REST backed DNF input (wx-webapp-input-dnf). The shared
 * contract (controls.contract.mjs) verifies that the control registers correctly
 * and survives a construct / teardown lifecycle; the tests below pin what the
 * REST variant adds to the static one - where the terms come from, and that each
 * conjunction keeps its own, independent picker.
 *
 * Run with Node 18 or newer from the JsTest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadControl } from "./controls.harness.mjs";
import { appendServiceIsland } from "./harness.mjs";
import { contract } from "./controls.contract.mjs";

const deps = ["webexpress.webapp.input.selection.model.js", "webexpress.webapp.input.selection.js"];

contract({
    file: "webexpress.webapp.input.dnf.js",
    selector: "wx-webapp-input-dnf",
    ctrl: "InputDnfCtrl",
    deps
});

/**
 * Mounts a REST backed DNF input over a stubbed endpoint.
 * @param {object} [options] - { value, items, maxGroups }.
 * @returns {Promise<object>} The runtime, the host and the recorded requests.
 */
async function mount(options = {}) {
    const requests = [];
    const items = options.items ?? [
        { id: "a", name: "Amsterdam" },
        { id: "b", name: "Berlin" },
        { id: "c", name: "Cairo" }
    ];

    const rt = loadControl({
        deps,
        file: "webexpress.webapp.input.dnf.js",
        fetch: async (uri) => {
            requests.push(uri);
            return {
                ok: true,
                status: 200,
                headers: { get: () => "application/json" },
                json: async () => ({ items })
            };
        }
    });

    const host = rt.createElement("div");
    host.id = "filter";
    host.setAttribute("name", "filter");
    if (options.value) {
        host.dataset.value = options.value;
    }
    if (options.maxGroups) {
        host.dataset.maxGroups = options.maxGroups;
    }
    appendServiceIsland(rt.document, host, { name: "data", baseUri: "/api/terms", method: "GET" });
    rt.document.body.appendChild(host);

    const ctrl = new rt.wxapp.InputDnfCtrl(host);

    // let the fetch promise chain of every group settle
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    return { rt, host, ctrl, requests };
}

test("the terms are queried from the declared endpoint", async () => {
    const { requests } = await mount();

    assert.equal(requests.length, 1, "the single conjunction asks once");
    assert.ok(requests[0].startsWith("/api/terms?"), `unexpected endpoint: ${requests[0]}`);
});

test("each conjunction queries independently, so the two can be searched apart", async () => {
    const { requests } = await mount({ value: "a|b" });

    // the filter of one group must not rewrite the list of the other, which is
    // exactly what one picker per group buys
    assert.equal(requests.length, 2, "one request per conjunction");
});

test("the queried terms label the expression, which is what the read view needs", async () => {
    const { ctrl } = await mount({ value: "a;b" });

    assert.deepEqual(
        ctrl.options.map((item) => item.label),
        ["Amsterdam", "Berlin", "Cairo"],
        "the control reports the terms that arrived, not the (empty) declared ones"
    );
});

test("the expression itself is untouched by the load", async () => {
    const { ctrl, host } = await mount({ value: "a;b|c" });

    assert.deepEqual(ctrl.value, [["a", "b"], ["c"]]);
    assert.equal(host.querySelector("input").value, "a;b|c");
});

test("a conjunction added later starts from the terms already received", async () => {
    const { ctrl, rt } = await mount({ value: "a" });

    ctrl.addGroup();

    // no await: the seeded list is on screen before the new group's own request
    // returns, which is the whole point of keeping it
    const added = ctrl._groups[1];
    assert.deepEqual(
        added.ctrl.options.map((item) => item.id),
        ["a", "b", "c"],
        "the new picker is populated at once"
    );
    assert.ok(rt, "runtime kept for the assertion context");
});

test("the arrival is announced on the control, not only on the group that fetched", async () => {
    const requests = [];
    const rt = loadControl({
        deps,
        file: "webexpress.webapp.input.dnf.js",
        fetch: async (uri) => {
            requests.push(uri);
            return {
                ok: true,
                status: 200,
                headers: { get: () => "application/json" },
                json: async () => ({ items: [{ id: "a", name: "Amsterdam" }] })
            };
        }
    });

    const host = rt.createElement("div");
    appendServiceIsland(rt.document, host, { name: "data", baseUri: "/api/terms", method: "GET" });
    rt.document.body.appendChild(host);

    const arrived = [];
    host.addEventListener(rt.wx.Event.DATA_ARRIVED_EVENT, (e) => arrived.push(e.detail));

    new rt.wxapp.InputDnfCtrl(host);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    // the smart edit rebuilds its read view on this event; without it a finished
    // edit would fall back to showing raw term ids
    assert.equal(arrived.length, 1);
    assert.equal(arrived[0].count, 1);
});

test("the group handling of the static control is inherited unchanged", async () => {
    const { ctrl } = await mount({ value: "a;b|c", maxGroups: "3" });

    assert.equal(ctrl.groupCount, 2);

    ctrl._groups[0].close.dispatchEvent({ type: "click" });
    assert.deepEqual(ctrl.value, [["c"]], "the first conjunction is emptied, not removed");

    assert.equal(ctrl.addGroup(), true);
    assert.equal(ctrl.addGroup(), false, "the declared limit still applies");
});
