/**
 * Headless tests for the ScrumBacklogCtrl control (wx-webapp-scrum-backlog).
 *
 * The shared contract (controls.contract.mjs) verifies that the control registers correctly
 * and survives a construct / teardown lifecycle. The tests below cover the view: the board is
 * a pure function of the state, the sprints and items are changed through copies, and the
 * selection and a drag in progress are state the rows render.
 */
import { test } from "node:test";
import assert from "node:assert";
import { contract } from "./controls.contract.mjs";
import { loadControl } from "./controls.harness.mjs";
import { appendServiceIsland, appendStateIsland } from "./harness.mjs";

const DEPS = ["webexpress.webapp.scrum.backlog.model.js"];
const FILE = "webexpress.webapp.scrum.backlog.js";

contract({
    file: FILE,
    selector: "wx-webapp-scrum-backlog",
    ctrl: "ScrumBacklogCtrl",
    deps: DEPS
});

const SPRINTS = [
    { id: "s1", name: "Sprint 1", status: "active" },
    { id: "s2", name: "Sprint 2", status: "planned" }
];

const ITEMS = [
    { id: "a", key: "Q-1", title: "Active one", sprintId: "s1", status: "todo", points: 3, rank: 1 },
    { id: "b", key: "Q-2", title: "Planned one", sprintId: "s2", status: "todo", points: 5, rank: 1 },
    { id: "c", key: "Q-3", title: "Backlog one", sprintId: null, status: "backlog", points: 2, rank: 1 },
    { id: "d", key: "Q-4", title: "Backlog two", sprintId: null, status: "backlog", points: 1, rank: 2 },
    { id: "e", key: "Q-5", title: "Backlog three", sprintId: null, status: "backlog", points: 8, rank: 3 }
];

/**
 * Builds a seeded backlog whose service records every request.
 * @param {object} [options={}] - readonly, a static configuration instead of the seed.
 * @returns {object} The control, its host, the runtime, the requests and the dispatched events.
 */
function board(options = {}) {
    const requests = [];
    const rt = loadControl({
        deps: DEPS,
        file: FILE,
        fetch: async (url, init) => {
            requests.push({ url: String(url), init: init || {} });
            return { ok: true, status: 200, json: async () => ({}) };
        }
    });
    const host = rt.createElement("div");
    if (options.readonly) {
        host.dataset.readonly = "true";
    }
    if (options.inline) {
        const script = rt.createElement("script");
        script.setAttribute("type", "application/json");
        script.textContent = JSON.stringify(options.inline);
        host.appendChild(script);
    } else {
        appendServiceIsland(rt.document, host, { name: "data", kind: "rest", baseUri: "/api/backlog", method: "GET", updateMethod: "PUT" });
        appendStateIsland(rt.document, host, { sprints: SPRINTS, items: ITEMS });
    }
    rt.document.body.appendChild(host);
    const events = [];
    const dispatch = host.dispatchEvent.bind(host);
    host.dispatchEvent = (event) => { events.push(event); return dispatch(event); };
    const ctrl = new rt.wxapp.ScrumBacklogCtrl(host);
    return { ctrl, host, rt, requests, events };
}

const rowIds = (section) => section.querySelectorAll(".wx-scrum-row").map((row) => row.getAttribute("data-item-id"));
const section = (host, id) => host.querySelectorAll(".wx-scrum-section").find((s) => s.dataset.sprintId === id);
const row = (host, id) => host.querySelectorAll(".wx-scrum-row").find((r) => r.getAttribute("data-item-id") === id);

/**
 * Builds a drag event the stub understands, with a data transfer and a box for the side.
 * @param {string} type - The event type.
 * @param {object} target - The row the event is aimed at.
 * @param {object} [transfer] - The shared data transfer.
 * @param {number} [clientY=0] - The pointer position.
 * @returns {object} The event.
 */
function dragEvent(type, target, transfer, clientY = 0) {
    target.getBoundingClientRect = () => ({ top: 0, height: 40, bottom: 40, left: 0, right: 100, width: 100 });
    return {
        type, target, currentTarget: target, clientX: 10, clientY, defaultPrevented: false,
        dataTransfer: transfer,
        preventDefault() { this.defaultPrevented = true; },
        stopPropagation() { }
    };
}

/**
 * Builds the data transfer a drag carries from dragstart to drop.
 * @returns {object} The data transfer stub.
 */
function transfer() {
    const data = {};
    return { data, setData(kind, value) { data[kind] = value; }, getData(kind) { return data[kind] || ""; } };
}

test("render describes the board without touching the DOM", () => {
    const { ctrl, host } = board();
    const before = host.childNodes.slice();
    const tree = ctrl.render(Object.assign({}, ctrl.state, { sprints: [], items: [] }));
    assert.deepEqual(host.childNodes, before);
    assert.deepEqual(tree.map((node) => node.key), ["toolbar", "section-backlog"]);
});

test("the active sprint leads, then the planned sprints, then the backlog", () => {
    const { host } = board();
    assert.deepEqual(host.querySelectorAll(".wx-scrum-section").map((s) => s.dataset.sprintId), ["s1", "s2", "backlog"]);
    assert.deepEqual(rowIds(section(host, "backlog")), ["c", "d", "e"]);
    const meta = section(host, "backlog").querySelector(".wx-scrum-section-meta").childNodes.map((n) => n.textContent);
    assert.equal(meta[1], "11 pts");
});

test("clicks select a row, add one with Ctrl and a range with Shift", () => {
    const { ctrl, host, events } = board();
    row(host, "c").dispatchEvent({ type: "click", target: row(host, "c") });
    row(host, "e").dispatchEvent({ type: "click", target: row(host, "e"), shiftKey: true });
    ctrl.store.flush();
    assert.deepEqual(ctrl.selectedItemIds, ["c", "d", "e"]);
    assert.equal(row(host, "d").getAttribute("aria-selected"), "true");
    assert.ok(row(host, "d").classList.contains("wx-scrum-row-active"));

    row(host, "a").dispatchEvent({ type: "click", target: row(host, "a"), ctrlKey: true });
    ctrl.store.flush();
    assert.deepEqual(ctrl.selectedItemIds, ["c", "d", "e", "a"]);
    const last = events.filter((e) => e.detail && Array.isArray(e.detail.itemIds)).at(-1);
    assert.deepEqual(Array.from(last.detail.itemIds), ["c", "d", "e", "a"], "the selection is announced");

    host.dispatchEvent({ type: "keydown", key: "Escape", target: host });
    ctrl.store.flush();
    assert.deepEqual(ctrl.selectedItemIds, []);
    assert.equal(row(host, "d").hasAttribute("aria-selected"), false);
});

test("a move works on a copy: the rendered items stay as they were", () => {
    const { ctrl, host, requests } = board();
    const before = ctrl.items;
    const original = before.find((i) => i.id === "c");
    ctrl.moveItemsToSprint(["c", "d"], "s2");
    ctrl.store.flush();
    assert.equal(original.sprintId, null, "the item object of the previous state is untouched");
    assert.deepEqual(rowIds(section(host, "s2")), ["b", "c", "d"]);
    assert.deepEqual(rowIds(section(host, "backlog")), ["e"]);
    assert.ok(requests.some((r) => r.url.includes("/items/rank-batch")), "the new order is persisted");
});

test("Alt+ArrowDown moves a row within its section and keeps its node", () => {
    const { ctrl, host } = board();
    const moved = row(host, "c");
    moved.dispatchEvent({ type: "keydown", key: "ArrowDown", altKey: true, preventDefault() { } });
    ctrl.store.flush();
    assert.deepEqual(rowIds(section(host, "backlog")), ["d", "c", "e"]);
    assert.equal(row(host, "c"), moved, "the keyed reconciler moved the row");
});

test("a drag renders its marks and a drop on a row inserts before it", () => {
    const { ctrl, host } = board();
    const data = transfer();
    ctrl.selectItems(["d", "e"], false);
    ctrl.store.flush();

    row(host, "e").dispatchEvent(dragEvent("dragstart", row(host, "e"), data));
    ctrl.store.flush();
    assert.ok(row(host, "d").classList.contains("dragging"), "the whole selection is dragged");
    assert.ok(row(host, "e").classList.contains("dragging"));

    row(host, "c").dispatchEvent(dragEvent("dragover", row(host, "c"), data, 5));
    ctrl.store.flush();
    assert.ok(row(host, "c").classList.contains("wx-drop-before"));

    row(host, "c").dispatchEvent(dragEvent("drop", row(host, "c"), data, 5));
    row(host, "e").dispatchEvent(dragEvent("dragend", row(host, "e"), data));
    ctrl.store.flush();
    assert.deepEqual(rowIds(section(host, "backlog")), ["d", "e", "c"]);
    assert.equal(host.querySelectorAll(".dragging, .wx-drop-before, .wx-drop-after").length, 0, "no mark is left behind");
});

test("a move into the active sprint waits for the confirmation", () => {
    const { ctrl, host, rt } = board();
    const dialogs = [];
    rt.wx.ModalCtrl = class {
        constructor(dialog) { this.dialog = dialog; dialogs.push(this); }
        show() { }
        hide() { }
    };
    ctrl.moveItemToSprint("c", "s1");
    ctrl.store.flush();
    assert.equal(dialogs.length, 1);
    assert.deepEqual(rowIds(section(host, "s1")), ["a"], "nothing moved yet");
});

test("assigning an item renders its initials without changing the rendered item", () => {
    const { ctrl, host } = board();
    const before = ctrl.items.find((i) => i.id === "c");
    ctrl.updateItem("c", { assigneeId: "gt", points: 13, assignee: { id: "gt", name: "Guybrush Threepwood", initials: "GT", color: "#36c" } });
    ctrl.store.flush();
    assert.equal(before.assigneeId, undefined);
    const assignee = row(host, "c").querySelector(".wx-scrum-assignee");
    assert.equal(assignee.textContent, "GT");
    assert.equal(row(host, "c").querySelector(".wx-scrum-points").textContent, "13");
});

test("a read-only board renders no affordances", () => {
    const { host } = board({ readonly: true });
    assert.equal(host.querySelector(".wx-scrum-create-sprint"), null);
    assert.equal(host.querySelector(".wx-scrum-sprint-menu"), null);
    assert.equal(row(host, "c").getAttribute("draggable"), "false");
});

test("an inline configuration of the host is read before the first render replaces it", () => {
    const { ctrl, host } = board({ inline: { sprints: [{ id: "x", name: "X", status: "planned" }], items: [{ id: "i", title: "Inline", sprintId: "x" }] } });
    ctrl.store.flush();
    assert.equal(ctrl.sprints.length, 1);
    assert.deepEqual(rowIds(section(host, "x")), ["i"]);
    assert.equal(host.querySelector("script"), null);
});
