/**
 * End-to-end tests for the REST graph viewer (wx-webapp-graph-viewer).
 *
 * These run the whole path against the shipped code: the real WebUI graph
 * viewer base, the WebApp engine and the control itself. They cover the three
 * ways the graph reaches the canvas - the standalone load through the
 * wx-service island, the seed through the wx-state island and the slice of an
 * enclosing ViewState - because those are what the control adds on top of the
 * base viewer.
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadControl } from "./controls.harness.mjs";
import { appendServiceIsland, appendResourceIsland, appendStateIsland } from "./harness.mjs";

const DEPS = ["webexpress.webapp.graph.viewer.model.js"];
const FILE = "webexpress.webapp.graph.viewer.js";

const GRAPH = {
    nodes: [
        { id: "melee", label: "Mêlée Island", x: 80, y: 180 },
        { id: "monkey", label: "Monkey Island" }
    ],
    edges: [
        { id: "voyage", from: "melee", to: "monkey", label: "sets sail" },
        { id: "ghost", from: "melee", to: "lechuck" }
    ]
};

/**
 * Lets the microtask queue drain so a load started in the constructor completes.
 * @param {number} [turns=8] - The number of turns to yield.
 */
async function settle(turns = 8) {
    for (let i = 0; i < turns; i++) {
        await Promise.resolve();
    }
}

test("a standalone graph viewer loads its graph from the service island", async () => {
    const urls = [];
    const rt = loadControl({
        deps: DEPS,
        file: FILE,
        fetch: async (url) => {
            urls.push(url);
            return { ok: true, status: 200, json: async () => GRAPH };
        }
    });

    const host = rt.createElement("div");
    host.classList.add("wx-webapp-graph-viewer");
    appendServiceIsland(rt.document, host, { name: "data", baseUri: "/api/graph", method: "GET" });
    rt.document.body.appendChild(host);

    const events = [];
    host.addEventListener(rt.wx.Event.DATA_REQUESTED_EVENT, () => events.push("requested"));
    host.addEventListener(rt.wx.Event.DATA_ARRIVED_EVENT, () => events.push("arrived"));
    host.addEventListener(rt.wx.Event.UPDATED_EVENT, () => events.push("updated"));

    const ctrl = new rt.wxapp.GraphViewerCtrl(host);
    await settle();

    assert.equal(urls.length, 1, "the graph is loaded exactly once");
    assert.ok(urls[0].includes("/api/graph"), "the load hits the service endpoint");
    assert.deepEqual(ctrl.value.nodes.map((n) => n.id), ["melee", "monkey"]);

    // the second edge points at a node the payload does not carry, so it would
    // never be drawn; the model must not report it either
    assert.deepEqual(ctrl.value.edges.map((e) => e.id), ["voyage"]);

    assert.deepEqual(events, ["requested", "updated", "arrived"], "the data lifecycle events are dispatched");
});

test("a seeded graph viewer paints without a round trip", async () => {
    const urls = [];
    const rt = loadControl({
        deps: DEPS,
        file: FILE,
        fetch: async (url) => {
            urls.push(url);
            return { ok: true, status: 200, json: async () => ({ nodes: [], edges: [] }) };
        }
    });

    const host = rt.createElement("div");
    host.classList.add("wx-webapp-graph-viewer");
    appendStateIsland(rt.document, host, { nodes: GRAPH.nodes, edges: GRAPH.edges });
    appendServiceIsland(rt.document, host, { name: "data", baseUri: "/api/graph", method: "GET" });
    rt.document.body.appendChild(host);

    const ctrl = new rt.wxapp.GraphViewerCtrl(host);
    await settle();

    assert.equal(urls.length, 0, "the seeded graph costs no request");
    assert.deepEqual(ctrl.value.nodes.map((n) => n.label), ["Mêlée Island", "Monkey Island"]);

    // an explicit refresh still goes to the endpoint
    await ctrl.refresh();
    assert.equal(urls.length, 1, "an explicit refresh reloads from the endpoint");
});

test("a graph viewer without a service loads nothing and stays empty", async () => {
    const urls = [];
    const rt = loadControl({
        deps: DEPS,
        file: FILE,
        fetch: async (url) => {
            urls.push(url);
            return { ok: true, status: 200, json: async () => GRAPH };
        }
    });

    const host = rt.createElement("div");
    host.classList.add("wx-webapp-graph-viewer");
    rt.document.body.appendChild(host);

    const ctrl = new rt.wxapp.GraphViewerCtrl(host);
    await settle();

    assert.equal(urls.length, 0, "no service island means no request");
    assert.deepEqual(ctrl.value, { nodes: [], edges: [] });
});

test("a ViewState-bound graph viewer renders the resource slice", async () => {
    const urls = [];
    const rt = loadControl({
        deps: DEPS,
        file: FILE,
        fetch: async (url) => {
            urls.push(url);
            return { ok: true, status: 200, json: async () => GRAPH };
        }
    });

    // the shared ViewState that owns the topology resource
    const vsHost = rt.createElement("div");
    vsHost.id = "map-viewstate";
    vsHost.dataset.wxViewstate = "map-viewstate";
    appendServiceIsland(rt.document, vsHost, { name: "data", baseUri: "/api/graph", method: "GET" });
    appendResourceIsland(rt.document, vsHost, { name: "topology", service: "data", target: "topology" });
    rt.document.body.appendChild(vsHost);

    const vs = new rt.wxapp.ViewState(vsHost);

    // the viewer authored inside the ViewState: it carries the binding alone and
    // owns neither a state nor a service island
    const host = rt.createElement("div");
    host.classList.add("wx-webapp-graph-viewer");
    host.setAttribute("data-wx-resource", "topology");
    host.dataset.wxResource = "topology";
    vsHost.appendChild(host);

    const ctrl = new rt.wxapp.GraphViewerCtrl(host);
    await settle(16);
    vs.flush();

    assert.equal(urls.length, 1, "the ViewState owns the single central load");
    assert.deepEqual(ctrl.value.nodes.map((n) => n.id), ["melee", "monkey"], "the viewer renders the resource slice");
    assert.deepEqual(ctrl.value.edges.map((e) => e.id), ["voyage"]);
});

test("a failed load leaves the viewer empty rather than throwing", async () => {
    const rt = loadControl({
        deps: DEPS,
        file: FILE,
        fetch: async () => ({ ok: false, status: 500, json: async () => ({}), text: async () => "boom" })
    });

    const host = rt.createElement("div");
    host.classList.add("wx-webapp-graph-viewer");
    appendServiceIsland(rt.document, host, { name: "data", baseUri: "/api/graph", method: "GET" });
    rt.document.body.appendChild(host);

    const messages = [];
    const realError = console.error;
    console.error = (...args) => messages.push(args.map(String).join(" "));

    try {
        const ctrl = new rt.wxapp.GraphViewerCtrl(host);
        await settle();

        assert.deepEqual(ctrl.value, { nodes: [], edges: [] });
        assert.ok(messages.some((m) => m.includes("graph viewer load failed")), "the failure is reported");
        assert.equal(host.classList.contains("placeholder-glow"), false, "the loading affordance is cleared again");
    } finally {
        console.error = realError;
    }
});
