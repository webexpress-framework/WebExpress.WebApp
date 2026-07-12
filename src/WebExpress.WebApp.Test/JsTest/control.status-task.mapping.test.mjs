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

/**
 * Appends a hidden starter wx-service island to a host, so the control resolves
 * a POST starter service exactly as it does from the server-emitted island.
 * @param {object} rt - The loaded runtime.
 * @param {object} element - The host element.
 * @param {string} baseUri - The start endpoint.
 * @returns {object} The island element.
 */
function appendStarterIsland(rt, element, baseUri) {
    const island = rt.createElement("wx-service");
    island.setAttribute("name", "starter");
    island.setAttribute("kind", "rest");
    island.setAttribute("base-uri", baseUri);
    island.setAttribute("method", "POST");
    element.appendChild(island);
    return island;
}

/**
 * Resolves once the microtask and timer queues drain, so an awaited start() has
 * settled before the next assertion.
 * @returns {Promise<void>} The settle promise.
 */
function tick() {
    return new Promise((resolve) => setTimeout(resolve, 0));
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

test("a starter dot posts on click and follows the started task", async () => {
    let calls = 0;
    const rt = loadControl({
        file: "webexpress.webapp.status.task.js",
        fetch: async () => { calls++; return { ok: true, status: 200, json: async () => ({ taskId: "started-1" }), text: async () => "" }; }
    });
    const element = host(rt);
    appendStarterIsland(rt, element, "/api/start");

    rt.wx.Controller.createInstances(element);
    const ctrl = rt.wx.Controller.instanceMap.get(element);

    assert.equal(calls, 0, "the dot does not post before it is clicked");
    assert.ok(element.classList.contains("wx-status-task-starter"), "a starter dot reads as an actionable trigger");

    element.dispatchEvent({ type: "click" });
    assert.equal(calls, 1, "a click posts to the starter endpoint");

    await tick();

    pushUpdate(rt, { taskId: "started-1", state: 1 });
    assert.equal(ctrl.value, "running", "the dot follows the task id the starter returned");
});

test("a starter dot with auto start posts on load", async () => {
    let calls = 0;
    const rt = loadControl({
        file: "webexpress.webapp.status.task.js",
        fetch: async () => { calls++; return { ok: true, status: 200, json: async () => ({ taskId: "auto-1" }), text: async () => "" }; }
    });
    const element = host(rt, { autoStart: "true" });
    appendStarterIsland(rt, element, "/api/start");

    rt.wx.Controller.createInstances(element);
    const ctrl = rt.wx.Controller.instanceMap.get(element);

    assert.equal(calls, 1, "auto start posts to the starter endpoint on load");

    await tick();

    pushUpdate(rt, { taskId: "auto-1", state: 1 });
    assert.equal(ctrl.value, "running", "the dot follows the auto started task");
});

test("a task-driven dot captions the live server message", () => {
    const rt = loadControl({ file: "webexpress.webapp.status.task.js" });
    const element = host(rt, { task: "t1" });

    rt.wx.Controller.createInstances(element);
    const caption = element.querySelector(".wx-status-task-label");

    assert.equal(caption.textContent, "", "the caption is empty before the first update");

    pushUpdate(rt, { taskId: "t1", state: 1, message: "You fight like a dairy farmer!" });
    assert.equal(caption.textContent, "You fight like a dairy farmer!", "the server message becomes the caption");

    pushUpdate(rt, { taskId: "t1", state: 3, message: "You survived the duel of wits." });
    assert.equal(caption.textContent, "You survived the duel of wits.", "the caption follows the current step");
});

test("a static dot captions its label", () => {
    const rt = loadControl({ file: "webexpress.webapp.status.task.js" });
    const element = host(rt, { status: "warning", label: "Build" });

    rt.wx.Controller.createInstances(element);
    const caption = element.querySelector(".wx-status-task-label");

    assert.equal(caption.textContent, "Build", "a static dot without a task shows its configured label");
});

test("repeat restarts the task after a successful finish but not after a cancel", async () => {
    let calls = 0;
    const rt = loadControl({
        file: "webexpress.webapp.status.task.js",
        fetch: async () => { calls++; return { ok: true, status: 200, json: async () => ({ taskId: "t1" }), text: async () => "" }; }
    });
    const element = host(rt, { task: "t1", repeat: "true" });
    appendStarterIsland(rt, element, "/api/start");

    rt.wx.Controller.createInstances(element);

    pushUpdate(rt, { taskId: "t1", state: 1 });
    assert.equal(calls, 0, "a running update does not start a new task");

    pushUpdate(rt, { taskId: "t1", state: 3 });
    assert.equal(calls, 1, "a successful finish restarts the task");

    await tick();

    pushUpdate(rt, { taskId: "t1", state: 2 });
    assert.equal(calls, 1, "a cancel does not restart the task");
});
