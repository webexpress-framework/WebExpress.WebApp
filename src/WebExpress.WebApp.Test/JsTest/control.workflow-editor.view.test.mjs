/**
 * Headless tests for the view of the WorkflowEditorCtrl (wx-webapp-workflow-editor): the
 * canvas renders into its pane of the split, which renders never reconcile; the
 * properties pane is patched from the same state and keeps the field the user types
 * in; the loading mark and the save status follow the state.
 */
import { test } from "node:test";
import assert from "node:assert";
import { loadControl } from "./controls.harness.mjs";

// the label is the first text field of a properties view; the stub keeps dataset apart from
// the attributes, so the field is found by its class
const LABEL = ".wx-workflow-editor-prop-row__input";

const WORKFLOW = {
    nodes: [
        { id: "draft", label: "Draft", x: 0, y: 0, isStart: true },
        { id: "review", label: "Review", x: 200, y: 0 },
        { id: "done", label: "Done", x: 400, y: 0, isEnd: true }
    ],
    edges: [
        { id: "t1", from: "draft", to: "review" },
        { id: "t2", from: "review", to: "done" }
    ]
};

/**
 * Builds an offline workflow editor with the workflow loaded.
 * @returns {{rt: object, host: object, ctrl: object}} The fixture.
 */
function createEditor() {
    const rt = loadControl({
        deps: ["webexpress.webapp.workflow.editor.model.js"],
        file: "webexpress.webapp.workflow.editor.js"
    });
    const host = rt.document.createElement("div");
    host.id = "workflow";
    rt.document.body.appendChild(host);
    const ctrl = new rt.wxapp.WorkflowEditorCtrl(host);
    ctrl._svg._rect = { left: 0, top: 0, width: 800, height: 600 };
    ctrl.model = WORKFLOW;
    return { rt, host, ctrl };
}

test("the canvas renders into its pane and the split it sits in is left to the split control", () => {
    const { rt, ctrl } = createEditor();

    // what the split control puts between the panes when it instantiates
    const handle = rt.document.createElement("div");
    handle.className = "wx-split-splitter";
    ctrl._splitHost.insertBefore(handle, ctrl._propsPane);

    ctrl._selectedNodeId = "draft";
    ctrl.render();

    assert.equal(ctrl._renderRoot, ctrl._canvasPane);
    assert.ok(ctrl._canvasPane.querySelector(".wx-graph-svg"), "the canvas is in its pane");
    assert.ok(ctrl._canvasPane.querySelector(".wx-graph-simple-toolbar"), "so is the toolbar");
    assert.equal(handle.parentNode, ctrl._splitHost, "the split's own handle survives the render");
});

test("the properties pane follows the selection and keeps the field being typed in", () => {
    const { ctrl } = createEditor();

    ctrl._selectedNodeId = "draft";
    ctrl.render();
    const input = ctrl._propsHost.querySelector(LABEL);
    assert.ok(input, "the state properties are shown");

    input.value = "Draft v2";
    input.dispatchEvent({ type: "input", target: input });

    assert.equal(ctrl._model.nodes[0].label, "Draft v2", "the edit reached the model");
    assert.equal(ctrl._propsHost.querySelector(LABEL), input, "the field was not rebuilt under the hands of the user");
    assert.equal(ctrl._canvasPane.querySelector(".wx-graph-node[data-id='draft']").getAttribute("aria-label"), "Draft v2",
        "the canvas shows the new label");

    ctrl._selectedNodeId = null;
    ctrl._selectedEdgeId = "t1";
    ctrl.render();
    assert.equal(ctrl._propsHost.querySelector(LABEL).value, "", "a new selection shows its own properties");
});

test("the add-transition action shows the mode, which is state", () => {
    const { ctrl } = createEditor();

    ctrl._toggleAddEdgeMode(true);

    assert.equal(ctrl.state.addEdge, true);
    assert.equal(ctrl._btnNewTransition.getAttribute("aria-pressed"), "true");
    assert.ok(ctrl._btnNewTransition.classList.contains("is-active"));
});

test("the loading mark of the host follows the state", () => {
    const { host, ctrl } = createEditor();

    ctrl._isLoading = true;
    ctrl._store.flush();
    assert.ok(host.classList.contains("placeholder-glow"));

    ctrl._isLoading = false;
    ctrl._store.flush();
    assert.equal(host.classList.contains("placeholder-glow"), false);
});

test("the save status is state and shows the moment it changes", () => {
    const { ctrl } = createEditor();

    ctrl._statusMessage = "500";
    ctrl._setSaveState("error", () => { });

    assert.deepEqual({ ...ctrl.state.status, savedAt: null }, { state: "error", message: "500", savedAt: null, retry: true });
    assert.ok(ctrl._statusEl.classList.contains("wx-workflow-editor-status--error"));
    assert.equal(ctrl._statusRetry.style.display, "", "the retry is offered at once");
});

test("the first undo after a load takes back the edit, not the workflow", () => {
    const { ctrl } = createEditor();

    ctrl._selectedEdgeId = "t1";
    ctrl._requestDelete();
    ctrl._undo();

    // an undo saves what it restores, so an empty canvas here would be saved to the server
    assert.equal(ctrl._model.nodes.length, 3, "the loaded states stay");
    assert.equal(ctrl._model.edges.length, 2, "the deleted transition is back");
});
