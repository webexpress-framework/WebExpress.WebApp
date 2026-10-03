/**
 * Headless tests for the gantt control on the Component base (View, State and
 * Service). The tests assert that it extends Component, seeds its project from
 * the wx-state island and skips the network load in that case, loads from the
 * data service otherwise, renders the grid and the bars, persists task and
 * link mutations REST-fully and raises the mutation events and callbacks.
 *
 * Run with Node 18 or newer from the jstest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, webappAsset, appendServiceIsland, appendStateIsland, tick } from "./harness.mjs";

function load(options) {
    return loadEngine(Object.assign(
        {
            extraFiles: [
                webappAsset("webexpress.webapp.gantt.model.js"),
                webappAsset("webexpress.webapp.gantt.js")
            ]
        },
        options
    ));
}

/**
 * Awaits the asynchronous load and the batched store notification.
 * @returns {Promise<void>} Resolves after the macrotask and microtask queues drain.
 */
function settle() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Collects the elements of a subtree carrying a css class, a stand-in for
 * querySelectorAll on the lean dom stub.
 * @param {object} node - The subtree root.
 * @param {string} name - The css class.
 * @param {Array} [out=[]] - The accumulator.
 * @returns {Array} The matching elements.
 */
function byClass(node, name, out = []) {
    if (node.nodeType === 1) {
        if (node.classList && node.classList.contains(name)) {
            out.push(node);
        }
        for (const child of node.childNodes || []) {
            byClass(child, name, out);
        }
    }
    return out;
}

const SEED = {
    tasks: [
        { id: "p", label: "Container", start: "2026-07-01", duration: 1 },
        { id: "c1", label: "Child", parentId: "p", start: "2026-07-01", duration: 3, progress: 40, resources: "Anna", icon: "fas fa-ship" },
        { id: "t2", label: "Solo", start: "2026-07-06", duration: 2 }
    ],
    links: [
        { id: "l1", from: "c1", to: "t2", type: "FS" }
    ]
};

function seededControl(engine) {
    const element = engine.createElement("div");
    appendServiceIsland(engine.document, element, { name: "data", kind: "rest", baseUri: "/api/plan", method: "GET", updateMethod: "PUT" });
    appendStateIsland(engine.document, element, SEED);
    return new engine.wxapp.GanttCtrl(element);
}

test("gantt extends the component base and seeds from the wx-state island", async () => {
    const engine = load();
    let fetchCount = 0;
    engine.setFetch(async () => { fetchCount++; return { ok: true, status: 200, json: async () => ({}) }; });

    const ctrl = seededControl(engine);

    assert.ok(ctrl instanceof engine.wxapp.Data);
    assert.equal(ctrl.value.tasks.length, 3);
    assert.equal(ctrl.value.links.length, 1);

    // the container derives its dates from the child through the rollup
    const container = ctrl.value.tasks.find((t) => t.id === "p");
    assert.equal(container.start, "2026-07-01");
    assert.equal(container.end, "2026-07-04");
    assert.equal(container.type, "summary");

    await settle();
    assert.equal(fetchCount, 0);
});

test("gantt renders the grid rows, the bars and the dependency layer", () => {
    const engine = load();
    engine.setFetch(async () => ({ ok: true, status: 200, json: async () => ({}) }));

    const ctrl = seededControl(engine);
    const element = ctrl._element;

    assert.equal(byClass(element, "wx-gantt-grid-row").length, 3);
    assert.equal(byClass(element, "wx-gantt-bar").length, 3);
    assert.equal(byClass(element, "wx-gantt-bar--summary").length, 1);
    assert.equal(byClass(element, "wx-gantt-link").length, 1);
    assert.equal(byClass(element, "wx-gantt-toolbar").length, 1);
    assert.equal(byClass(element, "wx-gantt-splitter").length, 1);

    // the child bar carries its progress fill and its resources
    const bars = byClass(element, "wx-gantt-bar");
    const childBar = bars.find((bar) => bar.dataset.taskId === "c1");
    assert.equal(byClass(childBar, "wx-gantt-bar-progress")[0].style.width, "40%");
    assert.equal(byClass(childBar, "wx-gantt-bar-resources")[0].textContent, "Anna");

    // the task icon shows in the grid row and on the bar
    assert.equal(byClass(element, "wx-gantt-grid-icon").length, 1);
    assert.equal(byClass(childBar, "wx-gantt-bar-icon").length, 1);
});

test("gantt loads the project from the service when no seed is present", async () => {
    const engine = load();
    let fetchCount = 0;
    engine.setFetch(async () => {
        fetchCount++;
        return {
            ok: true, status: 200, json: async () => ({
                tasks: [{ id: "r1", label: "Remote", start: "2026-07-06", duration: 3 }],
                links: []
            })
        };
    });

    const element = engine.createElement("div");
    appendServiceIsland(engine.document, element, { name: "data", kind: "rest", baseUri: "/api/plan", method: "GET", updateMethod: "PUT" });
    const ctrl = new engine.wxapp.GanttCtrl(element);

    assert.equal(ctrl.value.tasks.length, 0);
    await settle();

    assert.equal(fetchCount, 1);
    assert.equal(ctrl.value.tasks.length, 1);
    assert.equal(ctrl.value.tasks[0].end, "2026-07-09");
});

test("add task posts to /tasks, raises the event and adopts the server id", async () => {
    const engine = load();
    const calls = [];
    engine.setFetch(async (url, init) => {
        calls.push({ url: url, method: (init && init.method) || "GET", body: init && init.body });
        return { ok: true, status: 200, json: async () => ({ id: "srv1" }) };
    });

    const ctrl = seededControl(engine);

    let callbackDetail = null;
    let eventDetail = null;
    ctrl.onTaskCreate = (detail) => { callbackDetail = detail; };
    ctrl._element.addEventListener(engine.wxapp.GanttCtrl.TASK_CREATE_EVENT, (e) => { eventDetail = e.detail; });

    const task = ctrl.addTask({ label: "Neu", start: "2026-07-10", duration: 2 });
    assert.ok(task);
    assert.equal(task.end, "2026-07-12");
    assert.equal(callbackDetail.task.label, "Neu");
    assert.equal(eventDetail.task.id, task.id);

    await settle();

    const post = calls.find((c) => c.method === "POST");
    assert.equal(post.url, "/api/plan/tasks");
    assert.equal(JSON.parse(post.body).label, "Neu");

    // the server assigned id replaced the client id
    assert.ok(ctrl.value.tasks.some((t) => t.id === "srv1"));
    assert.equal(ctrl.value.tasks.some((t) => t.id === task.id), false);
});

test("update task puts to /tasks/{id} and re-derives the end date", async () => {
    const engine = load();
    const calls = [];
    engine.setFetch(async (url, init) => {
        calls.push({ url: url, method: (init && init.method) || "GET", body: init && init.body });
        return { ok: true, status: 200, json: async () => ({}) };
    });

    const ctrl = seededControl(engine);

    let updated = null;
    ctrl.onTaskUpdate = (detail) => { updated = detail; };

    const task = ctrl.updateTask("t2", { duration: 5 });
    assert.equal(task.end, "2026-07-11");
    assert.equal(updated.patch.duration, 5);

    await settle();

    const put = calls.find((c) => c.method === "PUT");
    assert.equal(put.url, "/api/plan/tasks/t2");
    assert.equal(JSON.parse(put.body).end, "2026-07-11");
});

test("remove task cascades over the subtree and the attached links", async () => {
    const engine = load();
    const calls = [];
    engine.setFetch(async (url, init) => {
        calls.push({ url: url, method: (init && init.method) || "GET" });
        return { ok: true, status: 204, json: async () => ({}) };
    });

    const ctrl = seededControl(engine);

    const deletedTasks = [];
    const deletedLinks = [];
    ctrl.onTaskDelete = (detail) => deletedTasks.push(detail);
    ctrl.onLinkDelete = (detail) => deletedLinks.push(detail);

    assert.equal(ctrl.removeTask("p"), true);

    assert.deepEqual(ctrl.value.tasks.map((t) => t.id), ["t2"]);
    assert.equal(ctrl.value.links.length, 0);
    assert.deepEqual(deletedTasks[0].removedIds.sort(), ["c1", "p"]);
    assert.equal(deletedLinks[0].link.id, "l1");

    await settle();

    const deletes = calls.filter((c) => c.method === "DELETE").map((c) => c.url).sort();
    assert.deepEqual(deletes, ["/api/plan/links/l1", "/api/plan/tasks/c1", "/api/plan/tasks/p"]);
});

test("add link validates self, duplicate and cycle before posting", async () => {
    const engine = load();
    const calls = [];
    engine.setFetch(async (url, init) => {
        calls.push({ url: url, method: (init && init.method) || "GET", body: init && init.body });
        return { ok: true, status: 200, json: async () => ({}) };
    });

    const ctrl = seededControl(engine);

    let created = null;
    ctrl.onLinkCreate = (detail) => { created = detail; };

    assert.equal(ctrl.addLink("c1", "t2"), null);
    assert.equal(ctrl.addLink("t2", "c1"), null);
    assert.equal(ctrl.addLink("t2", "t2"), null);

    const link = ctrl.addLink("p", "t2", "SS");
    assert.ok(link);
    assert.equal(link.type, "SS");
    assert.equal(created.link.from, "p");

    await settle();

    const posts = calls.filter((c) => c.method === "POST");
    assert.equal(posts.length, 1);
    assert.equal(posts[0].url, "/api/plan/links");
    assert.equal(JSON.parse(posts[0].body).type, "SS");
});

test("the delete key removes the selection", async () => {
    const engine = load();
    const calls = [];
    engine.setFetch(async (url, init) => {
        calls.push({ url: url, method: (init && init.method) || "GET" });
        return { ok: true, status: 204, json: async () => ({}) };
    });

    const ctrl = seededControl(engine);

    ctrl.select(null, "l1");
    ctrl._element.dispatchEvent({ type: "keydown", key: "Delete" });
    assert.equal(ctrl.value.links.length, 0);

    ctrl.select("t2");
    ctrl._element.dispatchEvent({ type: "keydown", key: "Delete" });
    assert.equal(ctrl.value.tasks.some((t) => t.id === "t2"), false);

    await settle();
    assert.equal(calls.filter((c) => c.method === "DELETE").length, 2);
});

test("scale, zoom and collapse drive the view state", async () => {
    const engine = load();
    engine.setFetch(async () => ({ ok: true, status: 200, json: async () => ({}) }));

    const ctrl = seededControl(engine);

    assert.equal(ctrl.state.scale, "day");
    ctrl.setScale("week");
    assert.equal(ctrl.state.scale, "week");
    ctrl.setScale("bogus");
    assert.equal(ctrl.state.scale, "week");

    ctrl.zoomIn();
    assert.equal(ctrl.state.zoom, 1.25);
    ctrl.setZoom(1000);
    assert.equal(ctrl.state.zoom, engine.wxapp.ganttModel.MAX_ZOOM);

    ctrl.toggleCollapse("p");
    await tick();
    assert.equal(byClass(ctrl._element, "wx-gantt-grid-row").length, 2);
    assert.equal(byClass(ctrl._element, "wx-gantt-bar").length, 2);
});

test("a read-only gantt refuses every mutation and hides the add action", async () => {
    const engine = load();
    let fetchCount = 0;
    engine.setFetch(async () => { fetchCount++; return { ok: true, status: 200, json: async () => ({}) }; });

    const element = engine.createElement("div");
    appendServiceIsland(engine.document, element, { name: "data", kind: "rest", baseUri: "/api/plan", method: "GET", updateMethod: "PUT" });
    appendStateIsland(engine.document, element, Object.assign({ readonly: true }, SEED));
    const ctrl = new engine.wxapp.GanttCtrl(element);

    assert.equal(ctrl.addTask({ label: "X" }), null);
    assert.equal(ctrl.updateTask("t2", { duration: 9 }), null);
    assert.equal(ctrl.removeTask("t2"), false);
    assert.equal(ctrl.addLink("p", "t2"), null);
    assert.equal(byClass(element, "wx-gantt-add").length, 0);

    await settle();
    assert.equal(fetchCount, 0);
});

test("the configured columns restrict the grid, keeping the name column", () => {
    const engine = load();
    engine.setFetch(async () => ({ ok: true, status: 200, json: async () => ({}) }));

    const element = engine.createElement("div");
    appendServiceIsland(engine.document, element, { name: "data", kind: "rest", baseUri: "/api/plan", method: "GET", updateMethod: "PUT" });
    appendStateIsland(engine.document, element, Object.assign({ columns: "name,start,duration" }, SEED));
    const ctrl = new engine.wxapp.GanttCtrl(element);

    const head = byClass(ctrl._element, "wx-gantt-grid-head")[0];
    assert.equal(head.childNodes.length, 3);

    // the name column survives even when the configuration omits it
    assert.deepEqual(engine.wxapp.GanttCtrl._parseColumns("progress"), ["label", "progress"]);
    assert.deepEqual(engine.wxapp.GanttCtrl._parseColumns("bogus"), engine.wxapp.GanttCtrl.COLUMNS);
});

test("dragging a bar reroutes its connectors live and commits on release", async () => {
    const engine = load();
    const calls = [];
    engine.setFetch(async (url, init) => {
        calls.push({ url: url, method: (init && init.method) || "GET" });
        return { ok: true, status: 200, json: async () => ({}) };
    });

    const ctrl = seededControl(engine);
    const bar = byClass(ctrl._element, "wx-gantt-bar").find((b) => b.dataset.taskId === "c1");
    const before = ctrl._linkPaths.get("l1").path.getAttribute("d");

    // drag the bar two days (72px at 36px per day) to the right
    bar.dispatchEvent({ type: "mousedown", clientX: 0 });
    engine.document.dispatchEvent({ type: "mousemove", clientX: 72 });

    // the connector follows the previewed bar instead of waiting for the drop
    const during = ctrl._linkPaths.get("l1").path.getAttribute("d");
    assert.notEqual(during, before);

    engine.document.dispatchEvent({ type: "mouseup", clientX: 72 });

    const task = ctrl.value.tasks.find((t) => t.id === "c1");
    assert.equal(task.start, "2026-07-03");
    assert.equal(task.end, "2026-07-06");

    await settle();
    const put = calls.find((c) => c.method === "PUT");
    assert.equal(put.url, "/api/plan/tasks/c1");
});

test("dragging the start handle left grows the task towards the past", async () => {
    const engine = load();
    engine.setFetch(async () => ({ ok: true, status: 200, json: async () => ({}) }));

    const ctrl = seededControl(engine);
    const bar = byClass(ctrl._element, "wx-gantt-bar").find((b) => b.dataset.taskId === "t2");
    const handle = byClass(bar, "wx-gantt-handle--start")[0];

    // one day left at 36px per day: the start moves earlier, the end stays
    handle.dispatchEvent({ type: "mousedown", clientX: 0 });
    engine.document.dispatchEvent({ type: "mousemove", clientX: -36 });
    engine.document.dispatchEvent({ type: "mouseup", clientX: -36 });

    const task = ctrl.value.tasks.find((t) => t.id === "t2");
    assert.equal(task.start, "2026-07-05");
    assert.equal(task.end, "2026-07-08");
    assert.equal(task.duration, 3);

    await settle();
});

test("shrinking the grid hides the columns right to left, keeping the name", async () => {
    const engine = load();
    engine.setFetch(async () => ({ ok: true, status: 200, json: async () => ({}) }));

    const ctrl = seededControl(engine);
    const grid = ctrl._gridEl;

    // at the default width every configured column shows
    assert.equal(grid.classList.contains("wx-gantt-grid--hide-resources"), false);
    assert.equal(grid.classList.contains("wx-gantt-grid--hide-start"), false);

    // 300px keeps name, start and end; duration, progress and resources hide
    ctrl._applySplit(300);
    assert.equal(grid.classList.contains("wx-gantt-grid--hide-resources"), true);
    assert.equal(grid.classList.contains("wx-gantt-grid--hide-progress"), true);
    assert.equal(grid.classList.contains("wx-gantt-grid--hide-duration"), true);
    assert.equal(grid.classList.contains("wx-gantt-grid--hide-end"), false);
    assert.equal(grid.classList.contains("wx-gantt-grid--hide-start"), false);

    // the minimum width leaves the name column alone, which never hides
    ctrl._applySplit(160);
    assert.equal(grid.classList.contains("wx-gantt-grid--hide-start"), true);
    assert.equal(grid.classList.contains("wx-gantt-grid--hide-end"), true);
    assert.equal(grid.classList.contains("wx-gantt-grid--hide-label"), false);

    // the fit survives a re-render, because the render reapplies the width
    ctrl.select("t2");
    await tick();
    assert.equal(ctrl._gridEl.classList.contains("wx-gantt-grid--hide-start"), true);
});

test("the grid pane collapses through the toggle and the seeded option", async () => {
    const engine = load();
    engine.setFetch(async () => ({ ok: true, status: 200, json: async () => ({}) }));

    const ctrl = seededControl(engine);
    assert.equal(byClass(ctrl._element, "wx-gantt-grid-toggle").length, 1);
    assert.equal(byClass(ctrl._element, "wx-gantt-grid--collapsed").length, 0);

    ctrl.toggleGrid();
    await tick();
    assert.equal(byClass(ctrl._element, "wx-gantt-grid--collapsed").length, 1);

    ctrl.toggleGrid();
    await tick();
    assert.equal(byClass(ctrl._element, "wx-gantt-grid--collapsed").length, 0);

    // the seeded option starts the control with a collapsed grid
    const element = engine.createElement("div");
    appendServiceIsland(engine.document, element, { name: "data", kind: "rest", baseUri: "/api/plan", method: "GET", updateMethod: "PUT" });
    appendStateIsland(engine.document, element, Object.assign({ gridCollapsed: true }, SEED));
    new engine.wxapp.GanttCtrl(element);
    assert.equal(byClass(element, "wx-gantt-grid--collapsed").length, 1);
});

test("the configured scales restrict the toolbar and the initial scale", () => {
    const engine = load();
    engine.setFetch(async () => ({ ok: true, status: 200, json: async () => ({}) }));

    const element = engine.createElement("div");
    appendServiceIsland(engine.document, element, { name: "data", kind: "rest", baseUri: "/api/plan", method: "GET", updateMethod: "PUT" });
    appendStateIsland(engine.document, element, Object.assign({ scale: "month", scales: "week,month" }, SEED));
    const ctrl = new engine.wxapp.GanttCtrl(element);

    assert.equal(ctrl.state.scale, "month");
    assert.equal(byClass(element, "wx-gantt-scale-btn").length, 2);

    ctrl.setScale("day");
    assert.equal(ctrl.state.scale, "month");
});
