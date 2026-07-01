/**
 * Focused tests for the StatusTaskCtrl. They verify that the control consumes
 * the same MessageQueue task pipeline as the progress bar and maps the task
 * state to a colored dot (running -> blue, done -> green, canceled -> red,
 * created -> gray), filters by task id, and that a task-less host renders the
 * static data-status (the only way to reach the warning color).
 */
import { test } from "node:test";
import assert from "node:assert";
import { loadControl } from "./controls.harness.mjs";

/**
 * Builds a connected host carrying the control marker class and data attributes.
 * @param {object} rt - The loaded runtime.
 * @param {object} attrs - The data-* attributes to set (camelCase keys).
 * @returns {object} The host element.
 */
function host(rt, attrs = {}) {
    const element = rt.createElement("div");
    element.classList.add("wx-webapp-status-task");
    for (const [key, value] of Object.entries(attrs)) {
        element.dataset[key] = value;
    }
    rt.document.body.appendChild(element);
    return element;
}

/**
 * Pushes a synthetic progress task update through the real MessageQueue.
 * @param {object} rt - The loaded runtime.
 * @param {object} update - The update fields (taskId, state, message).
 */
function pushUpdate(rt, update) {
    rt.wxapp.MessageQueue.dispatchLocal(Object.assign({
        type: "webexpress.webapp.progresstask.update"
    }, update));
}

test("a task update maps the task state to the dot color", () => {
    const rt = loadControl({ file: "webexpress.webapp.status.task.js" });
    const element = host(rt, { task: "t1" });

    rt.wx.Controller.createInstances(element);
    const ctrl = rt.wx.Controller.instanceMap.get(element);
    const dot = element.querySelector(".wx-status-dot");

    pushUpdate(rt, { taskId: "t1", state: 1 });
    assert.equal(ctrl.value, "running", "STATE_RUN -> running");
    assert.ok(dot.classList.contains("wx-status-dot-running"), "the dot is painted blue/running");

    pushUpdate(rt, { taskId: "t1", state: 3 });
    assert.equal(ctrl.value, "done", "STATE_FINISH -> done");

    pushUpdate(rt, { taskId: "t1", state: 2 });
    assert.equal(ctrl.value, "error", "STATE_CANCELED -> error");

    pushUpdate(rt, { taskId: "t1", state: 0 });
    assert.equal(ctrl.value, "pending", "STATE_CREATED -> pending");
});

test("updates for a different task id are ignored", () => {
    const rt = loadControl({ file: "webexpress.webapp.status.task.js" });
    const element = host(rt, { task: "t1" });

    rt.wx.Controller.createInstances(element);
    const ctrl = rt.wx.Controller.instanceMap.get(element);

    pushUpdate(rt, { taskId: "t1", state: 1 });
    pushUpdate(rt, { taskId: "other", state: 2 });

    assert.equal(ctrl.value, "running", "a foreign task id does not repaint the dot");
});

test("finishing a task dispatches the finish event once", () => {
    const rt = loadControl({ file: "webexpress.webapp.status.task.js" });
    const element = host(rt, { task: "t1" });

    let finishes = 0;
    element.addEventListener(rt.wx.Event.TASK_FINISH_EVENT, () => { finishes++; });

    rt.wx.Controller.createInstances(element);

    pushUpdate(rt, { taskId: "t1", state: 1 });
    pushUpdate(rt, { taskId: "t1", state: 3 });
    pushUpdate(rt, { taskId: "t1", state: 3 });

    assert.equal(finishes, 1, "the finish event fires once when the task reaches finish");
});

test("a task-less host renders the static data-status (warning)", () => {
    const rt = loadControl({ file: "webexpress.webapp.status.task.js" });
    const element = host(rt, { status: "warning" });

    rt.wx.Controller.createInstances(element);
    const ctrl = rt.wx.Controller.instanceMap.get(element);
    const dot = element.querySelector(".wx-status-dot");

    assert.equal(ctrl.value, "warning", "the static warning status is reflected");
    assert.ok(dot.classList.contains("wx-status-dot-warning"), "the dot is painted yellow/warning");
});
