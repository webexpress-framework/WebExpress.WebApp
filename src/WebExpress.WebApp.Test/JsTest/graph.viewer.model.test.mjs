/**
 * Headless unit tests for the REST graph viewer model helpers.
 *
 * These cover the pure logic extracted from webexpress.webapp.graph.viewer.js,
 * namely the wire format read with its aliases, the node, edge and waypoint
 * normalisation and the removal of dangling edges, plus an end to end path that
 * loads a graph through a service.
 *
 * Run with Node 18 or newer from the jstest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, webappAsset } from "./harness.mjs";

function load(options) {
    return loadEngine(Object.assign(
        { extraFiles: [webappAsset("webexpress.webapp.graph.viewer.model.js")] },
        options
    ));
}

test("normalize graph maps nodes and edges with defaults", () => {
    const { wxapp } = load();
    const graph = wxapp.graphViewerModel.normalizeGraph({
        nodes: [
            { id: "a", label: "Scumm Bar", x: 100, y: 120, icon: "fas fa-beer" },
            { id: "b" }
        ],
        edges: [{ id: "e1", from: "a", to: "b", label: "walk" }]
    });

    assert.equal(graph.nodes.length, 2);
    assert.equal(graph.nodes[0].label, "Scumm Bar");
    assert.equal(graph.nodes[0].x, 100);
    assert.equal(graph.nodes[0].y, 120);
    assert.equal(graph.nodes[0].icon, "fas fa-beer");
    // a node without a label falls back to its id, so it is never unlabelled
    assert.equal(graph.nodes[1].label, "b");
    assert.deepEqual(graph.edges, [{
        id: "e1", from: "a", to: "b", label: "walk",
        color: "", colorCss: "", dasharray: "", waypoints: []
    }]);
});

test("normalize graph reads the items and links aliases", () => {
    const { wxapp } = load();
    const graph = wxapp.graphViewerModel.normalizeGraph({
        items: [{ id: "a" }, { id: "b" }],
        links: [{ source: "a", target: "b" }]
    });

    assert.deepEqual(graph.nodes.map((n) => n.id), ["a", "b"]);
    assert.equal(graph.edges[0].from, "a");
    assert.equal(graph.edges[0].to, "b");
});

test("normalize graph tolerates a missing or malformed payload", () => {
    const { wxapp } = load();

    assert.deepEqual(wxapp.graphViewerModel.normalizeGraph(null), { nodes: [], edges: [] });
    assert.deepEqual(wxapp.graphViewerModel.normalizeGraph({}), { nodes: [], edges: [] });
    assert.deepEqual(wxapp.graphViewerModel.normalizeGraph({ nodes: "nope", edges: 7 }), { nodes: [], edges: [] });

    // entries that are not objects carry nothing the renderer could draw
    const graph = wxapp.graphViewerModel.normalizeGraph({ nodes: [null, "a", { id: "b" }], edges: [null] });
    assert.deepEqual(graph.nodes.map((n) => n.id), ["b"]);
    assert.deepEqual(graph.edges, []);
});

test("normalize node keeps a position only when both coordinates are usable", () => {
    const { wxapp } = load();
    const model = wxapp.graphViewerModel;

    // the stringified form endpoints deliver is accepted
    const stringified = model.normalizeNode({ id: "a", x: "40", y: "-12.5" });
    assert.equal(stringified.x, 40);
    assert.equal(stringified.y, -12.5);

    // a half position would place the node at the origin on one axis, so it is
    // dropped entirely and the simulation places the node instead
    assert.equal("x" in model.normalizeNode({ id: "a", x: 40 }), false);
    assert.equal("y" in model.normalizeNode({ id: "a", x: 40 }), false);
    assert.equal("x" in model.normalizeNode({ id: "a", x: "left", y: 10 }), false);
    assert.equal("x" in model.normalizeNode({ id: "a" }), false);
});

test("normalize node coerces the identifier and drops non-text fields", () => {
    const { wxapp } = load();
    const node = wxapp.graphViewerModel.normalizeNode({ id: 42, shape: "CIRCLE", layout: "Label-Below", icon: {}, backgroundCss: "bg-primary" });

    assert.equal(node.id, "42");
    assert.equal(node.label, "42");
    assert.equal(node.shape, "circle");
    assert.equal(node.layout, "label-below");
    assert.equal(node.icon, "");
    assert.equal(node.backgroundCss, "bg-primary");
});

test("normalize waypoints accepts the array and the json string form", () => {
    const { wxapp } = load();
    const model = wxapp.graphViewerModel;

    assert.deepEqual(model.normalizeWaypoints([{ x: 1, y: 2 }]), [{ x: 1, y: 2 }]);
    assert.deepEqual(model.normalizeWaypoints('[{"x":3,"y":4}]'), [{ x: 3, y: 4 }]);

    // malformed json and incomplete points carry no routing information
    assert.deepEqual(model.normalizeWaypoints("{oops"), []);
    assert.deepEqual(model.normalizeWaypoints([{ x: 1 }, null, "nope", { x: 5, y: 6 }]), [{ x: 5, y: 6 }]);
    assert.deepEqual(model.normalizeWaypoints(undefined), []);
});

test("normalize graph drops the edges whose endpoints are missing", () => {
    const { wxapp } = load();
    const graph = wxapp.graphViewerModel.normalizeGraph({
        nodes: [{ id: "a" }, { id: "b" }],
        edges: [
            { id: "kept", from: "a", to: "b" },
            { id: "unknown-target", from: "a", to: "ghost" },
            { id: "unknown-source", from: "ghost", to: "b" },
            { id: "no-endpoints" }
        ]
    });

    assert.deepEqual(graph.edges.map((e) => e.id), ["kept"]);
});

test("model loads a graph through a service", async () => {
    const { wxapp, setFetch } = load();
    const calls = [];
    setFetch(async (url, init) => {
        calls.push({ url: url, method: (init && init.method) || "GET" });
        return {
            ok: true, status: 200, json: async () => ({
                nodes: [{ id: "melee", label: "Mêlée Island", x: 0, y: 0 }, { id: "monkey", label: "Monkey Island" }],
                edges: [{ id: "voyage", from: "melee", to: "monkey", waypoints: [{ x: 120, y: 40 }] }]
            })
        };
    });

    const service = wxapp.ServiceRegistry.create({ name: "data", kind: "rest", baseUri: "/api/graph", method: "GET" });

    const loaded = await service.query({});
    assert.equal(calls[0].method, "GET");

    const graph = wxapp.graphViewerModel.normalizeGraph(loaded.data);
    assert.deepEqual(graph.nodes.map((n) => n.label), ["Mêlée Island", "Monkey Island"]);
    assert.equal("x" in graph.nodes[1], false);
    assert.deepEqual(graph.edges[0].waypoints, [{ x: 120, y: 40 }]);
});
