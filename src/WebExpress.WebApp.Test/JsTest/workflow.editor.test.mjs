/**
 * Headless tests for the workflow editor control (View, State and Service).
 *
 * They instantiate the real webexpress.webapp.WorkflowEditorCtrl on the DOM
 * stub with a stubbed WebUI graph editor base and assert the id contract of
 * the REST integration: the workflow id authored in the wx-state island
 * rides along as the wire query parameter on the load GET and the autosave
 * PUT, and a load that resolves after destroy leaves the editor untouched.
 * The pure wire-format mapping is covered by workflow.editor.model.test.mjs.
 *
 * Run with Node 18 or newer from the jstest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, webappAsset, appendServiceIsland, appendStateIsland } from "./harness.mjs";

// the workflow editor extends the WebUI graph editor, which the engine harness
// does not load; the stub carries the members the workflow control calls. The
// model setter mirrors the real viewer chain (normalize, then materialize the
// visual nodes the autosave merges positions back from). The keyboard
// shortcuts attach to window, which the DOM stub does not provide.
const GRAPH_EDITOR_BASE_STUB = `
    var window = {
        addEventListener() { },
        removeEventListener() { }
    };
    webexpress.webui.GraphEditorCtrl = class extends webexpress.webui.Ctrl {
        constructor(element) {
            super(element);
            // the real graph viewer base clears the host while building its
            // svg canvas, so the islands must be consumed before super
            element.innerHTML = "";
            this._toolbarContainer = null;
            this._selectedNodeId = null;
            this._selectedEdgeId = null;
            this._model = { nodes: [], edges: [] };
            this._nodes = [];
        }
        get model() { return this._model; }
        set model(val) {
            this._model = this._normalizeModel(val);
            this._nodes = (this._model.nodes || []).map((n) => ({ id: n.id, x: n.x, y: n.y }));
        }
        _normalizeModel(model) {
            const m = model || {};
            return {
                nodes: (m.nodes || []).map((n) => Object.assign({}, n)),
                edges: (m.edges || []).map((e) => Object.assign({}, e))
            };
        }
        _emitChangeSafe() { }
        _updateToolbarState() { }
        _deselectAll() { }
    };
`;

function load(options) {
    const engine = loadEngine(Object.assign({
        bootstrap: GRAPH_EDITOR_BASE_STUB,
        extraFiles: [
            webappAsset("webexpress.webapp.workflow.editor.model.js"),
            webappAsset("webexpress.webapp.workflow.editor.js")
        ]
    }, options));

    // the properties panel renders through querySelector, which the DOM stub
    // does not implement; the spy keeps the call count observable instead
    const propsPanelCalls = { count: 0 };
    engine.wxapp.WorkflowEditorCtrl.prototype._renderPropsPanel = function () {
        propsPanelCalls.count++;
    };

    return { engine, propsPanelCalls };
}

/**
 * Builds a workflow host element carrying the common GET/PUT service island
 * and an optional state island with the authored workflow id.
 * @param {object} engine - The loaded engine.
 * @param {object} [state] - The optional initial state island.
 * @returns {object} The host element.
 */
function createHost(engine, state) {
    const element = engine.createElement("div");
    appendServiceIsland(engine.document, element, {
        name: "data", kind: "rest", baseUri: "/api/workflow", method: "GET", updateMethod: "PUT"
    });
    if (state) {
        appendStateIsland(engine.document, element, state);
    }
    return element;
}

/**
 * Builds the RestApiWorkflowResult shaped response the load consumes.
 * @returns {object} The response payload.
 */
function workflowResponse() {
    return {
        id: "wf1",
        name: "Monkey Island Quest",
        version: "1",
        description: "A pirate's journey.",
        states: [
            { id: "todo", label: "Quest Board", x: 100, y: 120 },
            { id: "done", label: "Legendary Status", x: 850, y: 200 }
        ],
        transitions: [
            { id: "t1", from: "todo", to: "done", label: "Achieve Victory" }
        ],
        guards: [],
        validations: [],
        postfunctions: []
    };
}

/**
 * Awaits the pending load turns of the control.
 * @returns {Promise<void>} A promise that resolves after the pending turns.
 */
async function settle() {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
}

test("workflow editor loads with the workflow id from the state island", async () => {
    const { engine, propsPanelCalls } = load();
    const requests = [];
    engine.setFetch(async (url, init) => {
        requests.push({ url, method: (init && init.method) || "GET" });
        return { ok: true, status: 200, json: async () => workflowResponse() };
    });

    const element = createHost(engine, { id: "monkeyisland" });
    const editor = new engine.wxapp.WorkflowEditorCtrl(element);
    await settle();

    assert.equal(requests.length, 1);
    assert.equal(requests[0].method, "GET");
    assert.equal(requests[0].url, "/api/workflow?id=monkeyisland");
    assert.equal(editor._workflowId, "monkeyisland");
    assert.equal(editor._meta.id, "wf1");
    assert.equal(editor._meta.name, "Monkey Island Quest");
    assert.equal(editor._model.nodes.length, 2);
    assert.equal(editor._model.edges.length, 1);
    assert.equal(editor._isLoading, false);
    assert.equal(element.classList.contains("placeholder-glow"), false);
    // once from the constructor, once after the load completed
    assert.equal(propsPanelCalls.count, 2);
});

test("workflow editor loads without an id when no state island is authored", async () => {
    const { engine } = load();
    const requests = [];
    engine.setFetch(async (url, init) => {
        requests.push({ url, method: (init && init.method) || "GET" });
        return { ok: true, status: 200, json: async () => workflowResponse() };
    });

    const element = createHost(engine);
    const editor = new engine.wxapp.WorkflowEditorCtrl(element);
    await settle();

    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "/api/workflow");
    assert.equal(editor._workflowId, "");
});

test("workflow editor autosave puts the wire payload keyed by the authored id", async () => {
    const { engine } = load();
    const requests = [];
    engine.setFetch(async (url, init) => {
        requests.push({ url, method: (init && init.method) || "GET", body: init && init.body });
        return { ok: true, status: 200, json: async () => workflowResponse() };
    });

    const element = createHost(engine, { id: "monkeyisland" });
    const editor = new engine.wxapp.WorkflowEditorCtrl(element);
    await settle();

    // a drag only moves the visual node; the save must merge the position back
    editor._nodes[0].x = 999;
    editor._flushSave();
    await settle();

    assert.equal(requests.length, 2);
    assert.equal(requests[1].method, "PUT");
    assert.equal(requests[1].url, "/api/workflow?id=monkeyisland");

    const body = JSON.parse(requests[1].body);
    // the body id is the server-issued meta id, the query id stays the authored one
    assert.equal(body.id, "wf1");
    assert.equal(body.states[0].x, 999);
    assert.equal(body.states.length, 2);
    assert.equal(body.transitions.length, 1);
    assert.equal(body.transitions[0].from, "todo");
});

test("workflow editor ignores a load that resolves after destroy", async () => {
    const { engine, propsPanelCalls } = load();
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    engine.setFetch(async () => {
        await gate;
        return { ok: true, status: 200, json: async () => workflowResponse() };
    });

    const element = createHost(engine, { id: "monkeyisland" });
    const editor = new engine.wxapp.WorkflowEditorCtrl(element);

    editor.destroy();
    release();
    await settle();

    assert.equal(editor._destroyed, true);
    assert.equal(editor._model.nodes.length, 0);
    assert.equal(editor._meta.id, "");
    // only the constructor render, the late response must not render again
    assert.equal(propsPanelCalls.count, 1);
});
