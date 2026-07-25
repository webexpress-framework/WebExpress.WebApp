/**
 * Behaviour tests for the WorkflowEditorCtrl beyond the registration contract.
 *
 * Three properties are asserted here that the control previously got wrong in
 * ways that cost the user work: a teardown inside the autosave debounce window
 * must push the pending save through rather than drop it, a failed save or load
 * must become visible instead of ending in the console, and the preflight must
 * reason from the states the model declares as entry points rather than from
 * whichever state happened to be serialized first.
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadControl, keyEvent, windowListenerCount } from "./controls.harness.mjs";

/**
 * Builds a workflow editor on a bare host. Without a service island the
 * control stays offline, which is what the tests that do not exercise REST
 * want; the ones that do install a stub service afterwards.
 * @param {object} [options] - Optional overrides for loadControl.
 * @returns {{rt: object, host: object, ctrl: object}} The fixture.
 */
function createEditor(options = {}) {
    const rt = loadControl(Object.assign({
        deps: ["webexpress.webapp.workflow.editor.model.js"],
        file: "webexpress.webapp.workflow.editor.js"
    }, options));

    const host = rt.document.createElement("div");
    host.id = "workflow";
    rt.document.body.appendChild(host);

    const ctrl = new rt.wxapp.WorkflowEditorCtrl(host);
    ctrl._svg._rect = { left: 0, top: 0, width: 800, height: 600 };
    return { rt, host, ctrl };
}

/**
 * Installs a stub REST service that records the calls it receives.
 * @param {object} ctrl - The editor.
 * @param {Function} update - The update implementation.
 * @returns {object[]} The recorded update payloads.
 */
function stubService(ctrl, update) {
    const calls = [];
    ctrl._restUri = "/api/workflow";
    ctrl._service = {
        baseUri: "/api/workflow",
        query: async () => ({ ok: true, status: 200, data: {} }),
        update: async (payload, options) => {
            calls.push({ payload, options });
            return update ? update(payload, options) : { ok: true, status: 200, data: {} };
        }
    };
    return calls;
}

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

test("a teardown inside the debounce window still saves the pending change", async () => {
    const { ctrl } = createEditor();
    const calls = stubService(ctrl);

    ctrl.model = WORKFLOW;
    ctrl._scheduleSave();
    assert.ok(ctrl._saveDebounce !== null, "the save is queued but has not fired");

    ctrl.destroy();

    assert.equal(calls.length, 1, "the teardown flushed the queued save");
    assert.equal(ctrl._saveDebounce, null, "no timer survives the teardown");
});

test("a teardown without a pending change saves nothing", () => {
    const { ctrl } = createEditor();
    const calls = stubService(ctrl);

    ctrl.destroy();

    assert.equal(calls.length, 0, "an idle editor does not write on teardown");
});

test("the teardown releases the shortcut and unload handlers", () => {
    const { rt, ctrl } = createEditor();

    assert.ok(windowListenerCount(rt, "keydown") > 0, "the shortcuts are registered while alive");
    assert.ok(windowListenerCount(rt, "beforeunload") > 0, "the unload guard is registered while alive");

    ctrl.destroy();

    assert.equal(windowListenerCount(rt, "keydown"), 0, "no shortcut handler survives");
    assert.equal(windowListenerCount(rt, "beforeunload"), 0, "no unload guard survives");
});

test("a failed save becomes visible and offers a retry", async () => {
    const { ctrl } = createEditor();
    const calls = stubService(ctrl, () => ({ ok: false, status: 500 }));

    ctrl.model = WORKFLOW;
    ctrl._flushSave();
    await Promise.resolve();
    await Promise.resolve();

    assert.equal(ctrl._saveState, "error", "the failure is recorded as an error state");
    assert.ok(ctrl._statusText.textContent.length > 0, "the indicator says something");
    assert.equal(ctrl._statusRetry.style.display, "", "a retry is offered");

    ctrl._statusRetry.dispatchEvent({ type: "click", stopPropagation() { } });
    assert.equal(calls.length, 2, "the retry sent the payload again");
});

test("a successful save reports the time it happened", async () => {
    const { ctrl } = createEditor();
    stubService(ctrl);

    ctrl.model = WORKFLOW;
    ctrl._flushSave();
    await Promise.resolve();
    await Promise.resolve();

    assert.equal(ctrl._saveState, "saved");
    // the control runs in its own realm, so the Date identity is not shared
    assert.ok(ctrl._lastSavedAt && typeof ctrl._lastSavedAt.toLocaleTimeString === "function",
        "the time of the last write is kept");
    assert.ok(ctrl._statusText.textContent.length > 0, "the indicator carries the time");
});

test("a pending edit is reported as unsaved", () => {
    const { ctrl } = createEditor();
    stubService(ctrl);

    assert.equal(ctrl._hasUnsavedChanges(), false, "a fresh editor has nothing pending");

    ctrl._scheduleSave();

    assert.equal(ctrl._hasUnsavedChanges(), true, "a queued save counts as unsaved");
    assert.equal(ctrl._saveState, "dirty");
});

test("a conflicting save offers a reload rather than another overwrite", async () => {
    const { ctrl } = createEditor();
    const calls = stubService(ctrl, () => ({ ok: false, status: 409 }));

    ctrl.model = WORKFLOW;
    ctrl._flushSave();
    await Promise.resolve();
    await Promise.resolve();

    assert.equal(ctrl._saveState, "error", "the conflict is surfaced");

    let reloaded = 0;
    ctrl._receiveData = () => { reloaded++; };
    ctrl._statusRetry.dispatchEvent({ type: "click", stopPropagation() { } });

    assert.equal(reloaded, 1, "the offered action reloads the server revision");
    assert.equal(calls.length, 1, "the rejected payload is not sent again");
});

test("a save adopts the version the server hands back", async () => {
    const { ctrl } = createEditor();
    const calls = stubService(ctrl, () => ({ ok: true, status: 200, data: { success: true, version: "7" } }));

    ctrl.model = WORKFLOW;
    ctrl._meta = { id: "wf", name: "", state: "", version: "6", description: "" };
    ctrl._flushSave();
    await Promise.resolve();
    await Promise.resolve();

    assert.equal(calls[0].payload.version, "6", "the save presents the version it loaded");
    assert.equal(ctrl._meta.version, "7", "the next save presents the version the server returned");
});

test("a failed load becomes visible instead of leaving a blank canvas", async () => {
    const { ctrl } = createEditor();
    ctrl._restUri = "/api/workflow";
    ctrl._service = {
        baseUri: "/api/workflow",
        query: async () => ({ ok: false, status: 404, error: { kind: "http", status: 404 } }),
        update: async () => ({ ok: true, status: 200 })
    };

    ctrl._receiveData();
    await Promise.resolve();
    await Promise.resolve();

    assert.equal(ctrl._saveState, "error", "the failed load is reported");
    assert.equal(ctrl._isLoading, false, "the loading state is cleared");
    assert.equal(ctrl._statusRetry.style.display, "", "the load can be retried");
});

test("the preflight starts from the declared entry states", () => {
    const { ctrl } = createEditor();
    ctrl.model = WORKFLOW;

    assert.deepEqual(ctrl._collectPreflightIssues(), [], "a well formed workflow reports nothing");
});

test("the preflight verdict does not depend on the order of the states", () => {
    const { ctrl } = createEditor();

    ctrl.model = WORKFLOW;
    const forward = ctrl._collectPreflightIssues();

    ctrl.model = {
        nodes: WORKFLOW.nodes.slice().reverse(),
        edges: WORKFLOW.edges.slice().reverse()
    };
    const reversed = ctrl._collectPreflightIssues();

    assert.deepEqual(reversed, forward, "the same workflow reports the same verdict either way");
});

test("the preflight reports a missing entry state rather than guessing one", () => {
    const { ctrl } = createEditor();
    ctrl.model = {
        nodes: [{ id: "a", label: "A", x: 0, y: 0 }, { id: "b", label: "B", x: 100, y: 0, isEnd: true }],
        edges: [{ id: "t", from: "a", to: "b" }]
    };

    const issues = ctrl._collectPreflightIssues();
    assert.equal(issues.length, 1, "exactly the missing marker is reported");
    assert.match(issues[0].toLowerCase(), /entry|start/, "the finding names the missing entry state");
});

test("the preflight reports a state that cannot be reached", () => {
    const { ctrl } = createEditor();
    ctrl.model = {
        nodes: [
            { id: "a", label: "A", x: 0, y: 0, isStart: true },
            { id: "b", label: "B", x: 100, y: 0, isEnd: true },
            { id: "orphan", label: "Orphan", x: 200, y: 0, isEnd: true }
        ],
        edges: [{ id: "t", from: "a", to: "b" }]
    };

    const issues = ctrl._collectPreflightIssues();
    assert.ok(issues.length > 0, "the unreachable state is reported");
});

test("the preflight reports a transition that points at a missing state", () => {
    const { ctrl } = createEditor();
    ctrl.model = {
        nodes: [{ id: "a", label: "A", x: 0, y: 0, isStart: true }],
        edges: [{ id: "t", from: "a", to: "ghost" }]
    };

    assert.equal(ctrl._collectPreflightIssues().length, 1, "the broken reference is reported");
});

test("the preflight reports a state that traps the workflow", () => {
    const { ctrl } = createEditor();
    ctrl.model = {
        nodes: [
            { id: "a", label: "A", x: 0, y: 0, isStart: true },
            { id: "trap", label: "Trap", x: 100, y: 0 }
        ],
        edges: [{ id: "t", from: "a", to: "trap" }]
    };

    const issues = ctrl._collectPreflightIssues();
    assert.ok(issues.some((i) => i.includes("Trap")), "the finding names the trapping state");
});

test("the state markers survive normalization and the wire round trip", () => {
    const { rt, ctrl } = createEditor();
    ctrl.model = WORKFLOW;

    assert.equal(ctrl._model.nodes.find((n) => n.id === "draft").isStart, true,
        "the entry marker is preserved");
    assert.equal(ctrl._model.nodes.find((n) => n.id === "done").isEnd, true,
        "the end marker is preserved");

    const payload = rt.wxapp.workflowEditorModel.toWirePayload(ctrl._meta, ctrl._model);
    assert.equal(payload.states.find((n) => n.id === "draft").isStart, true,
        "the marker reaches the wire payload");
});

test("the colour rows use the framework colour control", () => {
    const { ctrl } = createEditor();
    ctrl.model = WORKFLOW;

    assert.ok(ctrl._colorControlAvailable(), "the framework control is part of the bundle");

    ctrl._selectedNodeId = "draft";
    ctrl._renderPropsPanel();

    const pickers = ctrl._propsHost.querySelectorAll(".wx-workflow-editor-prop-row__color-control");
    assert.equal(pickers.length, 2, "background and text colour both use the framework picker");
    assert.equal(ctrl._propsHost.querySelector(".wx-workflow-editor-prop-row__color-input"), null,
        "no bare native colour input is rendered");
});

test("the state panel exposes the entry and end markers", () => {
    const { ctrl } = createEditor();
    ctrl.model = WORKFLOW;

    ctrl._selectedNodeId = "draft";
    ctrl._renderPropsPanel();

    const toggles = ctrl._propsHost.querySelectorAll(".wx-workflow-editor-prop-row__toggle");
    assert.equal(toggles.length, 2, "both markers are editable");
    assert.equal(toggles[0].checked, true, "the entry marker reflects the model");
    assert.equal(toggles[1].checked, false, "the end marker reflects the model");
});

test("the transition panel offers the stroke pattern graphically", () => {
    const { ctrl } = createEditor();
    ctrl.model = WORKFLOW;

    ctrl._selectedEdgeId = "t1";
    ctrl._renderPropsPanel();

    const options = ctrl._propsHost.querySelectorAll(".wx-graph-dash-option");
    assert.ok(options.length > 0, "the patterns are offered as samples");
    assert.equal(ctrl._propsHost.querySelector("[data-edit-key='dasharray']"), null,
        "no raw dasharray text field is rendered");

    options[1].dispatchEvent({ type: "click", stopPropagation() { } });

    const edge = ctrl._model.edges.find((e) => e.id === "t1");
    assert.equal(edge.dasharray, options[1].dataset.dash, "picking writes the pattern to the model");
});

test("creating and editing live in the panel, not in the toolbar", () => {
    const { ctrl } = createEditor();
    ctrl.model = WORKFLOW;

    const toolbarIds = ctrl._toolbarContainer.children
        .filter((c) => String(c.tagName).toUpperCase() === "BUTTON")
        .map((c) => c.id);

    assert.ok(!toolbarIds.includes("btn-add-node"), "adding a state moved out of the toolbar");
    assert.ok(!toolbarIds.includes("btn-add-edge"), "adding a transition moved out of the toolbar");
    assert.ok(!toolbarIds.includes("btn-edit"), "the panel already shows the properties");
    assert.ok(!toolbarIds.includes("btn-delete"), "deleting sits on the element it removes");
    assert.ok(toolbarIds.includes("btn-undo"), "undo stays");
    assert.ok(toolbarIds.includes("btn-export"), "export stays");

    const actions = ctrl._propsActions.querySelectorAll(".wx-workflow-editor-btn");
    assert.equal(actions.length, 2, "the panel offers both creation actions");
});

test("the panel action adds a state", () => {
    const { ctrl } = createEditor();
    ctrl.model = WORKFLOW;

    ctrl._btnNewState.dispatchEvent({ type: "click", stopPropagation() { } });

    assert.equal(ctrl._model.nodes.length, 4, "a state was added");
    assert.ok(ctrl._selectedNodeId, "the new state is selected for editing");
});

test("the panel action toggles the add-transition mode and shows it", () => {
    const { ctrl } = createEditor();
    ctrl.model = WORKFLOW;

    ctrl._btnNewTransition.dispatchEvent({ type: "click", stopPropagation() { } });

    assert.equal(ctrl._isAddEdgeMode, true, "the mode is on");
    assert.equal(ctrl._btnNewTransition.getAttribute("aria-pressed"), "true",
        "the button reports the mode, which nothing else shows any more");
    assert.ok(ctrl._btnNewTransition.classList.contains("is-active"));

    ctrl._btnNewTransition.dispatchEvent({ type: "click", stopPropagation() { } });

    assert.equal(ctrl._isAddEdgeMode, false, "clicking again leaves the mode");
    assert.equal(ctrl._btnNewTransition.getAttribute("aria-pressed"), "false");
});

test("the panel actions survive a selection change", () => {
    const { ctrl } = createEditor();
    ctrl.model = WORKFLOW;

    const bar = ctrl._propsActions;

    ctrl._selectedNodeId = "draft";
    ctrl._renderPropsPanel();
    ctrl._selectedNodeId = null;
    ctrl._renderPropsPanel();

    assert.equal(ctrl._propsActions, bar, "the action bar is not rebuilt");
    assert.ok(bar.parentNode, "and stays in the pane");
});

test("a shortcut in another editor on the page is ignored", () => {
    const { rt, ctrl } = createEditor();
    ctrl.model = WORKFLOW;

    const otherHost = rt.document.createElement("div");
    rt.document.body.appendChild(otherHost);
    const other = new rt.wxapp.WorkflowEditorCtrl(otherHost);
    other._svg._rect = { left: 0, top: 0, width: 800, height: 600 };
    other.model = WORKFLOW;

    ctrl._selectedEdgeId = "t1";
    other._selectedEdgeId = "t1";

    rt.sandbox.window.dispatchEvent(keyEvent("Delete", { target: other._svg }));

    assert.equal(ctrl._model.edges.length, 2, "the unfocused editor keeps its transitions");
    assert.equal(other._model.edges.length, 1, "the focused editor deleted its transition");
});
