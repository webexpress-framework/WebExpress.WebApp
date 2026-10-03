/**
 * Headless unit tests for the gantt model helpers.
 *
 * These cover the pure logic extracted from webexpress.webapp.gantt.js, namely
 * the task and link normalisation, the container rollup, the tree flattening,
 * the dependency validation, the timeline scale construction and the drag
 * geometry, plus an end to end path that loads a project with a query and
 * persists a task move with an update through a service.
 *
 * Run with Node 18 or newer from the jstest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, webappAsset } from "./harness.mjs";

function load(options) {
    return loadEngine(Object.assign(
        { extraFiles: [webappAsset("webexpress.webapp.gantt.model.js")] },
        options
    ));
}

test("normalize task derives end, duration, progress and resources", () => {
    const { wxapp } = load();
    const model = wxapp.ganttModel;

    const fromDuration = model.normalizeTask({ id: 1, label: "A", start: "2026-07-06", duration: 3 });
    assert.equal(fromDuration.id, "1");
    assert.equal(fromDuration.end, "2026-07-09");
    assert.equal(fromDuration.type, "task");

    const fromDates = model.normalizeTask({ id: "b", start: "2026-07-06", end: "2026-07-10" });
    assert.equal(fromDates.duration, 4);

    const clamped = model.normalizeTask({ id: "c", start: "2026-07-06", progress: 150 });
    assert.equal(clamped.progress, 100);
    assert.equal(clamped.duration, 1);

    const resources = model.normalizeTask({ id: "d", start: "2026-07-06", resources: "Anna, Bob" });
    assert.deepEqual(resources.resources, ["Anna", "Bob"]);

    const objects = model.normalizeTask({ id: "e", start: "2026-07-06", resources: [{ name: "Carla" }] });
    assert.deepEqual(objects.resources, ["Carla"]);

    const milestone = model.normalizeTask({ id: "m", start: "2026-07-06", duration: 0 });
    assert.equal(milestone.type, "milestone");
    assert.equal(milestone.end, "2026-07-06");

    // the optional icon rides along into the model and back onto the wire
    const withIcon = model.normalizeTask({ id: "i", start: "2026-07-06", icon: "fas fa-ship" });
    assert.equal(withIcon.icon, "fas fa-ship");
    assert.equal(model.taskToWire(withIcon).icon, "fas fa-ship");
    assert.equal(fromDuration.icon, null);

    assert.equal(model.normalizeTask({ label: "no id" }), null);
});

test("normalize project drops broken, duplicate, self and cyclic links", () => {
    const { wxapp } = load();
    const model = wxapp.ganttModel;

    const project = model.normalizeProject({
        tasks: [
            { id: "t1", start: "2026-07-01", duration: 2 },
            { id: "t2", start: "2026-07-03", duration: 2, parentId: "ghost" },
            { id: "t3", start: "2026-07-05", duration: 2 }
        ],
        links: [
            { id: "l1", from: "t1", to: "t2" },
            { from: "t1", to: "t2" },
            { from: "t2", to: "t1" },
            { from: "t1", to: "t1" },
            { from: "t1", to: "missing" },
            { source: "t2", target: "t3", type: "ss" }
        ]
    });

    assert.equal(project.tasks.length, 3);
    // an orphaned parent reference would hide the task from the tree walk
    assert.equal(project.tasks[1].parentId, null);

    assert.equal(project.links.length, 2);
    assert.equal(project.links[0].id, "l1");
    assert.equal(project.links[1].type, "SS");
});

test("rollup derives container dates and duration weighted progress", () => {
    const { wxapp } = load();
    const model = wxapp.ganttModel;

    const tasks = model.normalizeProject({
        tasks: [
            { id: "p", start: "2026-01-01", duration: 1 },
            { id: "a", parentId: "p", start: "2026-07-01", duration: 2, progress: 50 },
            { id: "b", parentId: "p", start: "2026-07-05", duration: 4, progress: 100 }
        ]
    }).tasks;

    model.rollup(tasks);
    const parent = tasks[0];

    assert.equal(parent.type, "summary");
    assert.equal(parent.start, "2026-07-01");
    assert.equal(parent.end, "2026-07-09");
    assert.equal(parent.duration, 8);
    // (2 * 50 + 4 * 100) / 6 = 83
    assert.equal(parent.progress, 83);
});

test("flatten orders children after their parent and honours collapse", () => {
    const { wxapp } = load();
    const model = wxapp.ganttModel;

    const tasks = model.normalizeProject({
        tasks: [
            { id: "x", start: "2026-07-01", duration: 1 },
            { id: "p", start: "2026-07-01", duration: 1 },
            { id: "c", parentId: "p", start: "2026-07-02", duration: 1 }
        ]
    }).tasks;

    const rows = model.flatten(tasks);
    assert.deepEqual(rows.map((row) => row.task.id), ["x", "p", "c"]);
    assert.equal(rows[1].hasChildren, true);
    assert.equal(rows[2].depth, 1);

    tasks[1].collapsed = true;
    const collapsed = model.flatten(tasks);
    assert.deepEqual(collapsed.map((row) => row.task.id), ["x", "p"]);
});

test("canLink names the violated rule", () => {
    const { wxapp } = load();
    const model = wxapp.ganttModel;

    const tasks = [{ id: "t1" }, { id: "t2" }, { id: "t3" }];
    const links = [{ id: "l1", from: "t1", to: "t2", type: "FS" }];

    assert.equal(model.canLink(tasks, links, "t2", "t3").ok, true);
    assert.equal(model.canLink(tasks, links, "t1", "t1").reason, "self");
    assert.equal(model.canLink(tasks, links, "t1", "t2").reason, "duplicate");
    assert.equal(model.canLink(tasks, links, "t2", "t1").reason, "cycle");
    assert.equal(model.canLink(tasks, links, "t1", "nope").reason, "missing");

    // transitive cycles are refused, too
    const chain = links.concat([{ id: "l2", from: "t2", to: "t3", type: "FS" }]);
    assert.equal(model.canLink(tasks, chain, "t3", "t1").reason, "cycle");
});

test("day scale emits one unit per day with weekend flags and month groups", () => {
    const { wxapp } = load();
    const model = wxapp.ganttModel;

    // monday 2026-06-29 to monday 2026-07-06 spans a month boundary
    const scale = model.buildScale("day", model.parseDate("2026-06-29"), model.parseDate("2026-07-06"));

    assert.equal(scale.units.length, 7);
    assert.equal(scale.units[0].label, "29");
    assert.deepEqual(scale.units.map((u) => u.weekend), [false, false, false, false, false, true, true]);

    assert.equal(scale.groups.length, 2);
    assert.equal(scale.groups[0].days, 2);
    assert.equal(scale.groups[1].days, 5);
});

test("week and month scales clip their units to the range", () => {
    const { wxapp } = load();
    const model = wxapp.ganttModel;

    const weeks = model.buildScale("week", model.parseDate("2026-07-01"), model.parseDate("2026-07-15"));
    assert.equal(weeks.units.length, 3);
    // the first unit is clipped to the range start inside its week
    assert.equal(weeks.units[0].days, 5);
    assert.equal(weeks.units[1].days, 7);
    assert.equal(weeks.units[0].label, "27");

    const months = model.buildScale("month", model.parseDate("2026-11-15"), model.parseDate("2027-02-15"));
    assert.equal(months.units.length, 4);
    assert.deepEqual(months.groups.map((g) => g.start.getUTCFullYear()), [2026, 2027]);
});

test("date to offset roundtrips and the zoom is clamped", () => {
    const { wxapp } = load();
    const model = wxapp.ganttModel;

    const start = model.parseDate("2026-07-01");
    const pxDay = model.pxPerDay("day", 1);

    const offset = model.dateToOffset(model.parseDate("2026-07-11"), start, pxDay);
    assert.equal(offset, 10 * pxDay);
    assert.equal(model.formatIso(model.offsetToDate(offset, start, pxDay)), "2026-07-11");

    assert.equal(model.pxPerDay("day", 1000), model.SCALE_BASE.day * model.MAX_ZOOM);
    assert.equal(model.pxPerDay("day", 0.0001), model.SCALE_BASE.day * model.MIN_ZOOM);
});

test("move and resize compute whole day patches with a one day minimum", () => {
    const { wxapp } = load();
    const model = wxapp.ganttModel;

    const task = model.normalizeTask({ id: "t", start: "2026-07-06", duration: 3 });

    assert.deepEqual(model.moveTask(task, 2), { start: "2026-07-08", end: "2026-07-11" });
    assert.equal(model.moveTask(task, 0), null);

    assert.deepEqual(model.resizeTask(task, "end", 2), { start: "2026-07-06", end: "2026-07-11", duration: 5 });
    assert.deepEqual(model.resizeTask(task, "start", -1), { start: "2026-07-05", end: "2026-07-09", duration: 4 });

    // the duration bottoms out at one day instead of collapsing the bar
    assert.deepEqual(model.resizeTask(task, "end", -10).duration, 1);

    const milestone = model.normalizeTask({ id: "m", start: "2026-07-06", duration: 0 });
    assert.equal(model.resizeTask(milestone, "end", 3), null);
});

test("model loads the project and persists a move through a service", async () => {
    const { wxapp, setFetch } = load();
    const calls = [];
    setFetch(async (url, init) => {
        const method = (init && init.method) || "GET";
        calls.push({ url: url, method: method, body: init && init.body });
        if (method === "GET") {
            return {
                ok: true, status: 200, json: async () => ({
                    tasks: [{ id: "t1", label: "Task", start: "2026-07-06", duration: 3 }],
                    links: []
                })
            };
        }
        return { ok: true, status: 200, json: async () => ({}) };
    });

    const service = wxapp.ServiceRegistry.create({ name: "data", kind: "rest", baseUri: "/api/plan", method: "GET", updateMethod: "PUT" });

    const loaded = await service.query({});
    const project = wxapp.ganttModel.normalizeProject(loaded.data);
    assert.equal(project.tasks[0].end, "2026-07-09");

    const patch = wxapp.ganttModel.moveTask(project.tasks[0], 1);
    const moved = await service.update(
        Object.assign(wxapp.ganttModel.taskToWire(project.tasks[0]), patch),
        { path: "/tasks/t1" }
    );

    assert.equal(moved.ok, true);
    assert.equal(calls[1].method, "PUT");
    assert.equal(calls[1].url, "/api/plan/tasks/t1");
    assert.equal(JSON.parse(calls[1].body).start, "2026-07-07");
});
