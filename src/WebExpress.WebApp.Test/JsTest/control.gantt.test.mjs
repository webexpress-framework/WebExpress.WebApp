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
    // selection updates use simple class selectors that the shared stub omits
    element.querySelectorAll = (selector) => byClass(element, selector.slice(1));
    element.querySelector = (selector) => element.querySelectorAll(selector)[0] || null;
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

/**
 * Loads a gantt whose server answers reads with the seed and refuses every
 * write, and captures the popups it raises.
 * @param {object|null} fault - The JSON error body, or null for a non-JSON 400.
 * @returns {object} The engine, the control, the popups, the error events and the read count.
 */
function refusingControl(fault) {
    const engine = load();
    const net = { reads: 0 };
    engine.setFetch(async (url, init) => {
        if (init && init.method && init.method !== "GET") {
            if (fault === null) {
                return { ok: false, status: 400, headers: { get: () => "text/html" }, text: async () => "bad request" };
            }
            return { ok: false, status: 400, headers: { get: () => "application/json" }, json: async () => fault };
        }
        net.reads++;
        return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => SEED };
    });
    const popups = [];
    engine.wxapp.MessageQueue = { dispatchLocal(payload) { popups.push(payload.notification); } };
    // the engine harness carries no event names; without one the refusal would go out as "undefined"
    engine.wx.Event.DATA_ERROR_EVENT = "webexpress.webui.data.error";

    const ctrl = seededControl(engine);
    const errors = [];
    ctrl._element.addEventListener("webexpress.webui.data.error", (e) => errors.push(e.detail));
    return { engine, ctrl, popups, errors, net };
}

test("a link the server refuses is withdrawn and its reason shows as a popup", async () => {
    const { ctrl, popups, errors } = refusingControl({ message: "Dependency violates the plan." });

    const link = ctrl.addLink("p", "t2", "SS");
    assert.ok(ctrl.value.links.some((l) => l.id === link.id), "the link shows optimistically");

    await settle();

    assert.deepEqual(ctrl.value.links.map((l) => l.id), ["l1"], "only the stored link remains");
    assert.equal(ctrl.state.selectedLink, null);
    assert.equal(popups.length, 1);
    assert.equal(popups[0].message, "Dependency violates the plan.");
    assert.equal(popups[0].type, "alert-danger");
    assert.equal(errors[0].action, "create link");

    // the refusal must not swap the timeline for the load-failure panel
    assert.equal(ctrl.state.error, null);
    assert.equal(byClass(ctrl._element, "wx-gantt-error").length, 0);
    assert.equal(byClass(ctrl._element, "wx-gantt-bar").length, 3);
});

test("a deletion the server already cascaded is no refusal", async () => {
    // the server drops the subtree and the links with their container, so the
    // deletions of the child and of the link that follow find nothing (404)
    const engine = load();
    const gone = new Set();
    let reads = 0;
    engine.setFetch(async (url, init) => {
        const method = (init && init.method) || "GET";
        if (method === "GET") {
            reads++;
            return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => SEED };
        }
        if (gone.has(url)) {
            return { ok: false, status: 404, headers: { get: () => "application/json" }, json: async () => ({ message: "not found" }) };
        }
        if (url === "/api/plan/tasks/p") {
            ["/api/plan/tasks/c1", "/api/plan/links/l1"].forEach((u) => gone.add(u));
        }
        return { ok: true, status: 204, json: async () => ({}) };
    });
    const popups = [];
    engine.wxapp.MessageQueue = { dispatchLocal(payload) { popups.push(payload.notification); } };
    engine.wx.Event.DATA_ERROR_EVENT = "webexpress.webui.data.error";

    const ctrl = seededControl(engine);
    assert.equal(ctrl.removeTask("p"), true);
    await settle();
    await settle();

    assert.equal(popups.length, 0);
    assert.equal(reads, 0, "nothing is taken back, so nothing is reloaded");
    assert.deepEqual(ctrl.value.tasks.map((t) => t.id), ["t2"]);
});

test("a refused link edit restores the previous link and keeps the chart", async () => {
    const { ctrl, popups } = refusingControl({ message: "Type is locked." });

    assert.equal(ctrl.updateLink("l1", { type: "SF" }).type, "SF");

    await settle();

    assert.equal(ctrl.value.links.length, 1);
    assert.equal(ctrl.value.links[0].id, "l1");
    assert.equal(ctrl.value.links[0].type, "FS");
    assert.equal(popups[0].message, "Type is locked.");
    assert.equal(ctrl.state.error, null);
});

test("a refused task change reloads the stored plan and says why in a popup", async () => {
    const { ctrl, popups, errors, net } = refusingControl({ message: "Task is frozen." });

    ctrl.updateTask("t2", { duration: 9 });
    assert.equal(ctrl.value.tasks.find((t) => t.id === "t2").duration, 9);

    await settle();
    await settle();

    assert.equal(net.reads, 1, "the stored plan is read back once");
    assert.equal(ctrl.value.tasks.find((t) => t.id === "t2").duration, 2);
    assert.equal(popups[0].message, "Task is frozen.");
    assert.equal(errors[0].action, "update task");
    assert.equal(ctrl.state.error, null);
});

test("a refusal without a reason falls back to the chart's own words", async () => {
    const { ctrl, popups } = refusingControl(null);

    ctrl.addLink("p", "t2");
    await settle();

    assert.equal(popups[0].message, "The change was not saved and has been taken back.");
    assert.equal(popups[0].heading, "Plan");
});

test("a refusal reason is escaped, because the popup renders html", async () => {
    const { ctrl, popups } = refusingControl({ message: "<b>Phase 1</b> & \"Go\"" });

    ctrl.addLink("p", "t2");
    await settle();

    assert.equal(popups[0].message, "&lt;b&gt;Phase 1&lt;/b&gt; &amp; &quot;Go&quot;");
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
    ctrl._element.dispatchEvent({ type: "keydown", key: "Delete", preventDefault() {} });
    assert.equal(ctrl.value.links.length, 0);

    ctrl.select("t2");
    ctrl._element.dispatchEvent({ type: "keydown", key: "Delete", preventDefault() {} });
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

    // the actual CSS column widths reserve enough room for the task name
    assert.equal(grid.classList.contains("wx-gantt-grid--hide-resources"), true);
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


test("calendar-backed bars span calendar dates and retain calendar data across refresh", async () => {
    const engine = load();
    const element = engine.createElement("div");
    appendStateIsland(engine.document, element, { calendar: { holidays: ["2026-07-06"] }, tasks: [
        { id: "a", start: "2026-07-03", duration: 2 },
        { id: "b", start: "2026-07-08", duration: 1 }
    ], links: [{ id: "l", from: "a", to: "b", type: "FS" }] });
    const ctrl = new engine.wxapp.GanttCtrl(element);
    const bar = byClass(element, "wx-gantt-bar")[0];
    assert.equal(bar.style.width, (5 * ctrl._view.pxDay) + "px");
    assert.equal(byClass(element, "wx-gantt-holiday").length, 1);
    assert.equal(ctrl._anchor(ctrl.value.tasks[0], 0, "end", ctrl._view).x,
        ctrl._anchor(ctrl.value.tasks[0], 0, "start", ctrl._view).x + 5 * ctrl._view.pxDay);
    const copy = ctrl.value;
    copy.calendar.holidays.length = 0;
    assert.equal(ctrl.value.calendar.holidays.length, 1);
    ctrl.value = { tasks: [{ id: "c", start: "2026-07-03", duration: 2 }] };
    assert.equal(ctrl.value.tasks[0].end, "2026-07-08");
    ctrl.value = { calendar: null, tasks: [{ id: "c", start: "2026-07-03", duration: 2 }] };
    assert.equal(ctrl.value.tasks[0].end, "2026-07-05");
    await settle();
});

test("all dependency types can be edited and persisted without replacing their id", async () => {
    const engine = load();
    const calls = [];
    engine.setFetch(async (url, init) => {
        calls.push({ url: url, init: init });
        return { ok: true, status: 200, json: async () => ({}) };
    });
    const ctrl = seededControl(engine);
    const changes = [];
    ctrl.onLinkUpdate = (detail) => changes.push(detail.link);
    ctrl.select(null, "l1");
    await settle();
    const select = byClass(ctrl._element, "wx-gantt-link-type")[0];
    assert.equal(select.childNodes.length, 4);
    select.value = "FF";
    select.dispatchEvent({ type: "change" });
    assert.equal(ctrl.value.links[0].type, "FF");
    for (const type of ["FS", "SS", "FF", "SF"]) {
        assert.equal(ctrl.updateLink("l1", { type: type }).type, type);
    }
    assert.equal(ctrl.updateLink("l1", { type: "bad" }), null);
    assert.equal(ctrl.updateLink("l1", { to: "c1" }), null);
    assert.equal(ctrl.addLink("t2", "c1", "bad"), null);
    await settle();
    assert.equal(changes.length, 5);
    assert.equal(calls.length, 5);
    assert.ok(calls.every((call) => call.url === "/api/plan/links/l1" && call.init.method === "PUT"));
    assert.equal(JSON.parse(calls[4].init.body).type, "SF");
    ctrl.setState({ readonly: true });
    assert.equal(ctrl.updateLink("l1", { type: "SS" }), null);
});

test("editing text never turns Backspace or Delete into a task deletion", () => {
    const engine = load();
    const ctrl = seededControl(engine);
    ctrl.select("t2");
    for (const tagName of ["INPUT", "TEXTAREA", "SELECT"]) {
        for (const key of ["Backspace", "Delete"]) {
            ctrl._onKeyDown({ key: key, target: { tagName: tagName }, preventDefault() {} });
            assert.equal(ctrl.value.tasks.length, 3);
        }
    }
});

test("task edits preserve identity and duration and allow milestone conversion", () => {
    const engine = load();
    const ctrl = seededControl(engine);
    const moved = ctrl.updateTask("t2", { start: "2026-07-10", id: "replacement" });
    assert.equal(moved.id, "t2");
    assert.equal(moved.end, "2026-07-12");
    assert.equal(moved.duration, 2);
    assert.equal(ctrl.updateTask("t2", { duration: 0 }).type, "milestone");
    assert.equal(ctrl.updateTask("t2", { duration: 3 }).end, "2026-07-13");
    assert.equal(ctrl.updateTask("t2", { duration: 3 }).type, "task");
    assert.equal(ctrl.updateTask("p", { parentId: "c1" }), null);
    assert.equal(ctrl.addTask({ id: "t2" }), null);
});

test("links to undated tasks do not crash rendering", () => {
    const engine = load();
    const element = engine.createElement("div");
    appendStateIsland(engine.document, element, { tasks: [{ id: "a" }, { id: "b" }],
        links: [{ id: "l", from: "a", to: "b" }] });
    const ctrl = new engine.wxapp.GanttCtrl(element);
    assert.equal(ctrl.value.links.length, 1);
    assert.equal(byClass(element, "wx-gantt-link").length, 0);
});


test("all connector types approach the correct side in both horizontal orders", () => {
    const engine = load();
    const ctrl = seededControl(engine);
    for (const sourceX of [20, 180]) {
        for (const fromSide of ["start", "end"]) {
            for (const toSide of ["start", "end"]) {
                const source = { x: sourceX, y: 16 };
                const target = { x: 100, y: 80 };
                const coordinates = ctrl._linkPath(source, fromSide, target, toSide).match(/-?\d+/g).map(Number);
                assert.equal(Math.sign(coordinates[2] - source.x), fromSide === "start" ? -1 : 1);
                assert.equal(Math.sign(coordinates.at(-2) - coordinates.at(-4)), toSide === "start" ? 1 : -1);
            }
        }
    }
});

test("selection preserves the existing row node for subsequent double-click editing", async () => {
    const engine = load();
    const ctrl = seededControl(engine);
    const row = byClass(ctrl._element, "wx-gantt-grid-row").find((el) => el.dataset.taskId === "t2");
    ctrl.select("t2");
    await settle();
    const selected = byClass(ctrl._element, "wx-gantt-grid-row").find((el) => el.dataset.taskId === "t2");
    assert.equal(selected, row);
    assert.equal(selected.classList.contains("is-selected"), true);
});


test("dropping a source port on either half of a bar creates all four link types", () => {
    for (const [fromSide, toSide, type] of [["end", "start", "FS"], ["start", "start", "SS"],
        ["end", "end", "FF"], ["start", "end", "SF"]]) {
        const engine = load();
        const ctrl = seededControl(engine);
        const source = ctrl.value.tasks.find((task) => task.id === "p");
        const bar = byClass(ctrl._element, "wx-gantt-bar").find((el) => el.dataset.taskId === "t2");
        bar.getBoundingClientRect = () => ({ left: 100, width: 80 });
        const label = byClass(bar, "wx-gantt-bar-label")[0];
        const clientX = toSide === "start" ? 120 : 160;
        ctrl._beginLinkDrag({ clientX: 50, clientY: 10, preventDefault() {}, stopPropagation() {} }, source, fromSide, ctrl._view);
        ctrl._handleDragMove({ target: label, clientX: clientX, clientY: 50 });
        assert.equal(bar.classList.contains("is-link-target"), true);
        assert.equal(bar.dataset.linkTargetSide, toSide);
        ctrl._handleDragUp({ target: label, clientX: clientX, clientY: 50 });
        assert.equal(ctrl.value.links.find((link) => link.from === "p").type, type);
        assert.equal(bar.classList.contains("is-link-target"), false);
    }
});

test("link drops reject self, cycles, duplicates and bars outside this chart", () => {
    const engine = load();
    const ctrl = seededControl(engine);
    const bar = byClass(ctrl._element, "wx-gantt-bar").find((el) => el.dataset.taskId === "t2");
    bar.getBoundingClientRect = () => ({ left: 100, width: 80 });
    assert.equal(ctrl._resolveLinkTarget({ target: bar, clientX: 120 }, "t2"), null);
    assert.equal(ctrl._resolveLinkTarget({ target: bar, clientX: 120 }, "c1"), null);
    const predecessor = byClass(ctrl._element, "wx-gantt-bar").find((el) => el.dataset.taskId === "c1");
    assert.equal(ctrl._resolveLinkTarget({ target: predecessor, clientX: 120 }, "t2"), null);
    const foreign = engine.createElement("div");
    foreign.className = "wx-gantt-bar";
    foreign.dataset.taskId = "t2";
    assert.equal(ctrl._resolveLinkTarget({ target: foreign, clientX: 120 }, "p"), null);
    const port = byClass(bar, "wx-gantt-port--end")[0];
    assert.equal(ctrl._resolveLinkTarget({ target: port, clientX: 101 }, "p").side, "end");
});

/**
 * Loads a gantt that offers the sandbox, with a server that records every
 * request, assigns "srv-<n>" ids on POST and refuses the requests a predicate
 * names.
 * @param {function(string, string): boolean} [refuse] - Refuses a request by method and url.
 * @returns {object} The engine, the control, the recorded calls and the popups.
 */
function sandboxControl(refuse = () => false) {
    const engine = load();
    const calls = [];
    let next = 0;
    engine.setFetch(async (url, init) => {
        const method = (init && init.method) || "GET";
        calls.push({ method: method, url: url, body: init && init.body ? JSON.parse(init.body) : null });
        if (refuse(method, url)) {
            return { ok: false, status: 400, headers: { get: () => "application/json" }, json: async () => ({ message: "No." }) };
        }
        const body = method === "GET" ? SEED : method === "POST" ? { id: "srv-" + (++next) } : {};
        return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => body };
    });
    const popups = [];
    engine.wxapp.MessageQueue = { dispatchLocal(payload) { popups.push(payload.notification); } };
    engine.wx.Event.DATA_ERROR_EVENT = "webexpress.webui.data.error";

    // the engine context has no window; the sandbox guards the page unload on it
    const unload = new Set();
    engine.sandbox.window = {
        addEventListener(type, handler) { if (type === "beforeunload") unload.add(handler); },
        removeEventListener(type, handler) { if (type === "beforeunload") unload.delete(handler); }
    };

    const element = engine.createElement("div");
    element.querySelectorAll = (selector) => byClass(element, selector.slice(1));
    element.querySelector = (selector) => element.querySelectorAll(selector)[0] || null;
    element.dataset.sandbox = "true";
    appendServiceIsland(engine.document, element, { name: "data", kind: "rest", baseUri: "/api/plan", method: "GET", updateMethod: "PUT" });
    appendStateIsland(engine.document, element, SEED);
    const ctrl = new engine.wxapp.GanttCtrl(element);
    return { engine, ctrl, calls, popups, unload };
}

/**
 * Fires the beforeunload handlers the way a navigation does.
 * @param {Set<function>} handlers - The registered handlers.
 * @returns {object} The event, telling whether the browser would ask.
 */
function navigateAway(handlers) {
    const event = { prevented: false, returnValue: undefined, preventDefault() { this.prevented = true; } };
    for (const handler of handlers) {
        handler(event);
    }
    return event;
}

function click(root, name) {
    const button = byClass(root, name)[0];
    assert.ok(button, "the " + name + " action is offered");
    button.dispatchEvent({ type: "click" });
}

test("the sandbox is offered only when configured and never on a read-only plan", async () => {
    const engine = load();
    engine.setFetch(async () => ({ ok: true, status: 200, json: async () => ({}) }));
    const plain = seededControl(engine);
    await settle();
    assert.equal(byClass(plain._element, "wx-gantt-sandbox-enter").length, 0);

    const { ctrl } = sandboxControl();
    await settle();
    const enter = byClass(ctrl._element, "wx-gantt-sandbox-enter");
    assert.equal(enter.length, 1);
    assert.equal(byClass(enter[0], "wx-icon-light-flask").length, 1, "the button shows the flask icon");
    assert.equal(enter[0].childNodes.length, 1, "and no text beside it");
    assert.equal(enter[0].getAttribute("aria-label"), "Sandbox", "the name stays available to assistive technology");

    ctrl.setState({ readonly: true });
    await settle();
    assert.equal(byClass(ctrl._element, "wx-gantt-sandbox-enter").length, 0);
    assert.equal(ctrl.enterSandbox(), false);
});

test("inside the sandbox changes stay local and discarding restores the entry state", async () => {
    const { ctrl, calls } = sandboxControl();
    const left = [];
    ctrl._element.addEventListener(ctrl.constructor.SANDBOX_LEAVE_EVENT, (e) => left.push(e.detail));
    await settle();

    click(ctrl._element, "wx-gantt-sandbox-enter");
    await settle();
    assert.equal(ctrl.inSandbox, true);
    assert.ok(ctrl._element.classList.contains("wx-gantt--sandbox"));
    assert.equal(byClass(ctrl._element, "wx-gantt-sandbox").length, 1);

    ctrl.addTask({ label: "Try", start: "2026-07-10", duration: 2 });
    ctrl.updateTask("t2", { duration: 7 });
    ctrl.removeLink("l1");
    ctrl.updateTask("c1", { progress: 90 });
    await settle();

    assert.equal(calls.length, 0, "nothing reaches the server");
    assert.equal(ctrl.sandboxChangeCount(), 4);

    click(ctrl._element, "wx-gantt-sandbox-end");
    await settle();
    assert.equal(ctrl.state.sandbox, "deciding");
    click(ctrl._element, "wx-gantt-sandbox-discard");
    await settle();

    assert.equal(ctrl.inSandbox, false);
    assert.equal(calls.length, 0, "discarding sends nothing either");
    assert.deepEqual(ctrl.value.tasks.map((t) => t.id), ["p", "c1", "t2"]);
    assert.equal(ctrl.value.tasks.find((t) => t.id === "t2").duration, 2);
    assert.equal(ctrl.value.tasks.find((t) => t.id === "c1").progress, 40);
    assert.equal(ctrl.value.links.length, 1);
    assert.equal(ctrl._element.classList.contains("wx-gantt--sandbox"), false);
    assert.deepEqual(left.map((d) => d.saved), [false]);
});

test("ending a sandbox without changes closes it without asking", () => {
    const { ctrl } = sandboxControl();
    ctrl.enterSandbox();
    ctrl.updateTask("t2", { duration: 7 });
    ctrl.updateTask("t2", { duration: 2 });
    assert.equal(ctrl.sandboxChangeCount(), 0, "a change taken back by hand is no change");

    ctrl.endSandbox();
    assert.equal(ctrl.inSandbox, false);
});

test("saving sends the net result once per resource, in an order the server can follow", async () => {
    const { ctrl, calls } = sandboxControl();
    const left = [];
    ctrl._element.addEventListener(ctrl.constructor.SANDBOX_LEAVE_EVENT, (e) => left.push(e.detail));

    ctrl.enterSandbox();
    const parent = ctrl.addTask({ label: "Phase", start: "2026-07-10", duration: 2 });
    const child = ctrl.addTask({ label: "Step", parentId: parent.id, start: "2026-07-10", duration: 1 });
    ctrl.addLink(child.id, "t2", "FS");
    ctrl.updateTask("t2", { duration: 3 });
    ctrl.updateTask("t2", { duration: 4 });
    ctrl.removeLink("l1");
    const scratch = ctrl.addTask({ label: "Scratch" });
    ctrl.removeTask(scratch.id);

    ctrl.endSandbox();
    assert.equal(ctrl.state.sandbox, "deciding");
    assert.equal(await ctrl.saveSandbox(), true);

    assert.deepEqual(calls.map((c) => c.method + " " + c.url), [
        "POST /api/plan/tasks",
        "POST /api/plan/tasks",
        "PUT /api/plan/tasks/t2",
        "DELETE /api/plan/links/l1",
        "POST /api/plan/links"
    ]);
    assert.equal(calls[0].body.label, "Phase");
    assert.equal(calls[1].body.parentId, "srv-1", "the child refers to the server id of its parent");
    assert.equal(calls[2].body.duration, 4);
    assert.equal(calls[4].body.from, "srv-2", "the link refers to the server id of the child");

    assert.equal(ctrl.inSandbox, false);
    assert.deepEqual(ctrl.value.tasks.map((t) => t.id).sort(), ["c1", "p", "srv-1", "srv-2", "t2"]);
    assert.deepEqual(ctrl.value.links.map((l) => l.id), ["srv-3"]);
    assert.deepEqual(left.map((d) => d.saved), [true]);
});

test("a task moved under a container created after it is still created behind that container", async () => {
    const { ctrl, calls } = sandboxControl();

    ctrl.enterSandbox();
    const first = ctrl.addTask({ label: "First", start: "2026-07-10", duration: 1 });
    const later = ctrl.addTask({ label: "Later", start: "2026-07-10", duration: 1 });
    ctrl.updateTask(first.id, { parentId: later.id });

    assert.equal(await ctrl.saveSandbox(), true);
    assert.deepEqual(calls.map((c) => c.body.label), ["Later", "First"]);
    assert.equal(calls[1].body.parentId, "srv-1");
});

test("a sandbox deletion that finds nothing left still counts as stored", async () => {
    const { ctrl, popups } = sandboxControl();
    ctrl.enterSandbox();
    ctrl.removeLink("l1");
    // the deleted link is already gone on the server
    ctrl._service.remove = async () => ({ ok: false, error: { kind: "http", status: 404, message: "not found" } });

    assert.equal(await ctrl.saveSandbox(), true);
    assert.equal(popups.length, 0);
    assert.equal(ctrl.inSandbox, false);
});

test("a refused save keeps the sandbox open with only the changes not yet stored", async () => {
    let refusing = true;
    const { ctrl, calls, popups } = sandboxControl((method) => refusing && method === "PUT");

    ctrl.enterSandbox();
    ctrl.addTask({ label: "New", start: "2026-07-10", duration: 2 });
    ctrl.updateTask("t2", { duration: 5 });

    assert.equal(await ctrl.saveSandbox(), false);
    assert.equal(ctrl.state.sandbox, "active");
    assert.equal(popups[0].message, "No.");
    assert.equal(ctrl.sandboxChangeCount(), 1, "the stored task no longer counts");
    assert.equal(ctrl.value.tasks.find((t) => t.id === "t2").duration, 5, "the refused change is kept for a retry");

    refusing = false;
    calls.length = 0;
    assert.equal(await ctrl.saveSandbox(), true);
    assert.deepEqual(calls.map((c) => c.method + " " + c.url), ["PUT /api/plan/tasks/t2"]);
    assert.equal(ctrl.inSandbox, false);
});

test("discarding after a partial save reloads, since the entry state is no longer stored", async () => {
    const { ctrl, calls } = sandboxControl((method) => method === "PUT");

    ctrl.enterSandbox();
    ctrl.addTask({ label: "New", start: "2026-07-10", duration: 2 });
    ctrl.updateTask("t2", { duration: 5 });
    await ctrl.saveSandbox();

    calls.length = 0;
    ctrl.discardSandbox();
    await settle();
    assert.deepEqual(calls.map((c) => c.method), ["GET"]);
});

test("a reload while the sandbox is open is held back and caught up when it closes", async () => {
    const { ctrl, calls } = sandboxControl();

    ctrl.enterSandbox();
    ctrl.updateTask("t2", { duration: 5 });
    ctrl.load();
    await settle();
    assert.equal(calls.length, 0);
    assert.equal(ctrl.value.tasks.find((t) => t.id === "t2").duration, 5, "the sandbox survives the reload");

    ctrl.discardSandbox();
    await settle();
    assert.deepEqual(calls.map((c) => c.method), ["GET"]);
});

test("leaving the page with unsaved sandbox changes makes the browser ask", async () => {
    const { ctrl, unload } = sandboxControl();
    assert.equal(unload.size, 0, "no guard outside the sandbox");

    ctrl.enterSandbox();
    assert.equal(unload.size, 1);
    assert.equal(navigateAway(unload).prevented, false, "an untouched sandbox lets the page go");

    ctrl.updateTask("t2", { duration: 5 });
    const event = navigateAway(unload);
    assert.equal(event.prevented, true);
    assert.equal(event.returnValue, "");

    assert.equal(await ctrl.saveSandbox(), true);
    assert.equal(unload.size, 0, "a closed sandbox no longer guards the page");

    ctrl.enterSandbox();
    ctrl.updateTask("t2", { duration: 6 });
    ctrl.destroy();
    assert.equal(unload.size, 0, "teardown releases the guard");
});

test("every event detail says whether the change happened inside the sandbox", () => {
    const { ctrl } = sandboxControl();
    const callbacks = [];
    const events = [];
    ctrl.onTaskUpdate = (detail) => callbacks.push(detail.sandbox);
    ctrl._element.addEventListener(ctrl.constructor.TASK_UPDATE_EVENT, (e) => events.push(e.detail.sandbox));

    ctrl.updateTask("t2", { duration: 3 });
    ctrl.enterSandbox();
    ctrl.updateTask("t2", { duration: 4 });
    ctrl.discardSandbox();
    ctrl.updateTask("t2", { duration: 5 });

    assert.deepEqual(callbacks, [false, true, false]);
    assert.deepEqual(events, [false, true, false]);
});

test("a sandbox being saved refuses further edits", async () => {
    const { ctrl } = sandboxControl();
    ctrl.enterSandbox();
    ctrl.updateTask("t2", { duration: 5 });
    const saving = ctrl.saveSandbox();
    assert.equal(ctrl.state.sandbox, "saving");
    assert.equal(ctrl.updateTask("t2", { duration: 9 }), null);
    assert.equal(ctrl.discardSandbox(), false);
    await saving;
    assert.equal(ctrl.value.tasks.find((t) => t.id === "t2").duration, 5);
});
