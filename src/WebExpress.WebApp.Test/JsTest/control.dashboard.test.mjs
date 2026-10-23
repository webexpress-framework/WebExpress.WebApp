/**
 * Headless contract test for the DashboardCtrl control (wx-webapp-dashboard).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 *
 * The remaining tests pin the persistence: every save carries a full board
 * snapshot, so the saves reach the server in the order they were made, a load
 * cannot overtake a save in flight, and a refused save is taken back and told.
 */
import { test } from "node:test";
import assert from "node:assert";
import { appendServiceIsland, appendResourceIsland } from "./harness.mjs";
import { contract } from "./controls.contract.mjs";
import { loadControl } from "./controls.harness.mjs";

contract({
    file: "webexpress.webapp.dashboard.js",
    selector: "wx-webapp-dashboard",
    ctrl: "DashboardCtrl",
    deps: ["webexpress.webapp.dashboard.model.js"]
});

async function settle(turns = 12) {
    for (let i = 0; i < turns; i++) {
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
}

/**
 * A fetch that answers reads at once and holds every write until the test
 * releases it, so the order of the requests can be observed.
 * @returns {object} The recorded calls, the release function and the fetch.
 */
function gatedFetch() {
    const calls = { reads: 0, writes: [] };
    const gates = [];
    return {
        calls,
        release(ok = true) {
            gates.shift()(ok);
        },
        fetch: async (url, init) => {
            if (init && init.method && init.method !== "GET") {
                calls.writes.push(JSON.parse(init.body).action);
                const ok = await new Promise((resolve) => gates.push(resolve));
                return ok
                    ? { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({}) }
                    : { ok: false, status: 409, headers: { get: () => "application/json" }, json: async () => ({ message: "stale" }) };
            }
            calls.reads += 1;
            return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({ columns: [{ id: "c1", label: "C1", widgets: [] }] }) };
        }
    };
}

/**
 * Mounts a dashboard in a ViewState backed by the given fetch.
 * @param {object} net - The gated fetch.
 * @returns {Promise<object>} The dashboard, its host and the captured popups.
 */
async function mount(net) {
    const rt = loadControl({
        file: "webexpress.webapp.dashboard.js",
        deps: ["webexpress.webapp.dashboard.model.js"],
        fetch: net.fetch
    });
    const popups = [];
    rt.wxapp.MessageQueue = { dispatchLocal(payload) { popups.push(payload); } };

    const host = rt.createElement("div");
    host.dataset.wxViewstate = "board";
    appendServiceIsland(rt.document, host, { name: "data", baseUri: "/api/dashboard", method: "GET", updateMethod: "PUT" });
    appendResourceIsland(rt.document, host, { name: "board", service: "data", target: "board", auto: false, params: [] });
    rt.document.body.appendChild(host);
    const vs = new rt.wxapp.ViewState(host);

    const boardHost = rt.createElement("div");
    boardHost.setAttribute("data-wx-resource", "board");
    boardHost.dataset.wxResource = "board";
    host.appendChild(boardHost);
    const dashboard = new rt.wxapp.DashboardCtrl(boardHost);

    await vs.load("board");
    await settle();

    return { rt, dashboard, boardHost, popups };
}

test("the saves reach the server one after the other, in the order they were made", async () => {
    const net = gatedFetch();
    const { dashboard } = await mount(net);

    dashboard._sendStateToServer({ action: "first" });
    dashboard._sendStateToServer({ action: "second" });
    await settle();
    assert.equal(net.calls.writes.length, 1, "the second snapshot waits for the first");

    net.release();
    await settle();
    assert.equal(net.calls.writes.join(","), "first,second");

    net.release();
    await settle();
});

test("a load arriving during a save waits for it instead of undoing the change on screen", async () => {
    const net = gatedFetch();
    const { dashboard } = await mount(net);

    dashboard._sendStateToServer({ action: "reorder" });
    await settle();
    const reads = net.calls.reads;

    dashboard.updateData({ columns: [{ id: "stale", widgets: [] }] });
    assert.equal(dashboard._columns[0].id, "c1", "a board loaded during the save is not shown");

    dashboard._reload();
    await settle();
    assert.equal(net.calls.reads, reads, "no load overtakes the save");

    net.release();
    await settle();
    assert.ok(net.calls.reads > reads, "the held load follows once the save is through");
});

test("a save the server refuses is taken back and reported", async () => {
    const net = gatedFetch();
    const { rt, dashboard, boardHost, popups } = await mount(net);
    const errors = [];
    boardHost.addEventListener(rt.wx.Event.DATA_ERROR_EVENT, (e) => errors.push(e.detail));

    dashboard._sendStateToServer({ action: "reorder" });
    await settle();
    const reads = net.calls.reads;

    net.release(false);
    await settle();

    assert.equal(popups.length, 1, "the refusal is put in front of the user");
    assert.equal(errors.length, 1);
    assert.equal(errors[0].action, "reorder");
    assert.equal(net.calls.reads, reads + 1, "the stored board is loaded back over the refused change");
});
