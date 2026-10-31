/**
 * Headless unit tests for the workflow editor model helpers (View, State and
 * Service).
 *
 * These cover the pure logic extracted from webexpress.webapp.workflow.editor.js:
 * the legacy descriptor, the meta and catalog normalisation, the wire format
 * read (nodes/states and edges/transitions aliases with source/target mapping)
 * and the wire payload build, plus an end to end path that loads the workflow
 * with a query and persists it with an update through a service.
 *
 * Run with Node 18 or newer from the jstest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, webappAsset } from "./harness.mjs";

function load(options) {
    return loadEngine(Object.assign(
        { extraFiles: [webappAsset("webexpress.webapp.workflow.editor.model.js")] },
        options
    ));
}

test("normalize meta and catalog read fields and default them", () => {
    const { wxapp } = load();
    const meta = wxapp.workflowEditorModel.normalizeMeta({ id: "w1", name: "W" });
    assert.equal(meta.id, "w1");
    assert.equal(meta.name, "W");
    assert.equal(meta.state, "");
    assert.equal(meta.version, "");

    const cat = wxapp.workflowEditorModel.normalizeCatalog({ guards: [{ id: "g" }] });
    assert.deepEqual(cat.guards, [{ id: "g" }]);
    assert.deepEqual(cat.validations, []);
    assert.deepEqual(cat.postfunctions, []);
    assert.deepEqual(wxapp.workflowEditorModel.normalizeCatalog(null).guards, []);
});

test("from wire format accepts aliases and maps source and target", () => {
    const { wxapp } = load();
    const resp = { states: [{ id: "n1" }], transitions: [{ id: "e1", source: "n1", target: "n2" }] };
    const graph = wxapp.workflowEditorModel.fromWireFormat(resp);

    assert.equal(graph.nodes[0].id, "n1");
    assert.equal(graph.edges[0].from, "n1");
    assert.equal(graph.edges[0].to, "n2");
    assert.notEqual(graph.nodes[0], resp.states[0]);

    const resp2 = { nodes: [{ id: "x" }], states: [{ id: "y" }], edges: [{ id: "e", from: "a", to: "b" }] };
    const g2 = wxapp.workflowEditorModel.fromWireFormat(resp2);
    assert.equal(g2.nodes[0].id, "x");
    assert.equal(g2.edges[0].from, "a");

    assert.deepEqual(wxapp.workflowEditorModel.fromWireFormat({}), { nodes: [], edges: [] });
    assert.deepEqual(wxapp.workflowEditorModel.fromWireFormat(null), { nodes: [], edges: [] });
});

test("to wire payload mirrors nodes and edges under states and transitions", () => {
    const { wxapp } = load();
    const nodes = [{ id: "n1" }];
    const edges = [{ id: "e1" }];
    const p = wxapp.workflowEditorModel.toWirePayload(
        { id: "w1", name: "W", state: "draft", version: "1", description: "d" },
        { nodes: nodes, edges: edges }
    );

    assert.equal(p.id, "w1");
    assert.equal(p.name, "W");
    assert.equal(p.description, "d");
    assert.deepEqual(p.nodes, nodes);
    assert.deepEqual(p.edges, edges);

    // the two spellings are the same array, which is what lets a backend read
    // either one
    assert.equal(p.states, p.nodes);
    assert.equal(p.transitions, p.edges);

    const p2 = wxapp.workflowEditorModel.toWirePayload(null, null);
    assert.deepEqual(p2.nodes, []);
    assert.deepEqual(p2.states, []);
});

test("to wire payload rounds the positions to whole numbers", () => {
    const { wxapp } = load();

    // the canvas works in continuous space; a consumer that models a coordinate
    // as a whole number rejects the whole payload over a fractional one, which
    // would turn the first drag into the last successful save
    const p = wxapp.workflowEditorModel.toWirePayload({}, {
        nodes: [{ id: "n1", x: 40.5, y: 119.6 }],
        edges: [{ id: "e1", waypoints: [{ x: 12.4, y: -7.5 }] }]
    });

    assert.equal(p.states[0].x, 41);
    assert.equal(p.states[0].y, 120);
    assert.equal(p.transitions[0].waypoints[0].x, 12);
    assert.equal(p.transitions[0].waypoints[0].y, -7);
});

test("to wire payload leaves a node without a position untouched", () => {
    const { wxapp } = load();

    const p = wxapp.workflowEditorModel.toWirePayload({}, {
        nodes: [{ id: "n1", label: "A" }],
        edges: [{ id: "e1" }]
    });

    assert.equal(p.states[0].x, undefined, "no coordinate is invented");
    assert.equal(p.states[0].label, "A", "the remaining fields survive");
    assert.equal(p.transitions[0].waypoints, undefined, "an edge without waypoints keeps none");
});

test("model loads and persists the workflow through a service end to end", async () => {
    const { wxapp, setFetch } = load();
    const calls = [];
    setFetch(async (url, init) => {
        const method = (init && init.method) || "GET";
        calls.push({ url: url, method: method, body: init && init.body });
        if (method === "GET") {
            return { ok: true, status: 200, json: async () => ({ id: "w1", states: [{ id: "n1" }], transitions: [{ id: "e1", source: "n1", target: "n2" }] }) };
        }
        return { ok: true, status: 200, json: async () => ({}) };
    });

    const service = wxapp.ServiceRegistry.create({ name: "data", kind: "rest", baseUri: "/api/wf", method: "GET", updateMethod: "PUT" });

    const loaded = await service.query({});
    const meta = wxapp.workflowEditorModel.normalizeMeta(loaded.data);
    const graph = wxapp.workflowEditorModel.fromWireFormat(loaded.data);
    assert.equal(meta.id, "w1");
    assert.equal(graph.edges[0].from, "n1");

    const saved = await service.update(wxapp.workflowEditorModel.toWirePayload(meta, graph));
    assert.equal(calls[1].method, "PUT");
    const sentBody = JSON.parse(calls[1].body);
    assert.equal(sentBody.states[0].id, "n1");
    assert.equal(sentBody.transitions[0].from, "n1");
    assert.equal(saved.ok, true);
});
