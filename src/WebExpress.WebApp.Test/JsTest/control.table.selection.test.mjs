/**
 * Headless tests for the multi-selection of the REST table (wx-webapp-table): the checkbox
 * column, Ctrl and Shift on a row, the selection bar with its server rendered actions, the
 * selection changed event, and the rows as sources and targets of the drag-and-drop protocol.
 */
import { test } from "node:test";
import assert from "node:assert";
import { loadControl } from "./controls.harness.mjs";
import { appendServiceIsland } from "./harness.mjs";

const RESPONSE = {
    columns: [{ id: "name", label: "Name", visible: true }],
    rows: [
        { id: "r1", cells: [{ content: "Grace" }] },
        { id: "r2", cells: [{ content: "Emma" }] },
        { id: "r3", cells: [{ content: "Ada" }] },
        { id: "r4", cells: [{ content: "Linus" }] }
    ],
    total: 4
};

/**
 * Drains the queues, so the load and the batched render have completed.
 * @returns {Promise<void>} Resolves once the queues are drained.
 */
async function settle() {
    for (let round = 0; round < 5; round++) {
        for (let i = 0; i < 40; i++) {
            await Promise.resolve();
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
}

/**
 * Builds a loaded table host.
 * @param {object} [attributes={}] - Attributes of the host.
 * @param {object} [options={}] - response: what the server answers; bar: add a selection bar.
 * @returns {Promise<object>} The runtime, the host, the table and the selection events.
 */
async function table(attributes = {}, options = {}) {
    const rt = loadControl({ deps: ["webexpress.webapp.table.model.js"], file: "webexpress.webapp.table.js" });
    const holder = { response: options.response || RESPONSE };
    rt.setFetch(async () => {
        const body = JSON.parse(JSON.stringify(holder.response));
        return { ok: true, status: 200, json: async () => body };
    });

    const element = rt.createElement("div");
    element.id = "crew";
    element.classList.add("wx-webapp-table");
    for (const [name, value] of Object.entries(attributes)) {
        element.setAttribute(name, value);
        // the stub keeps dataset apart from the attributes, and the base reads some through it
        element.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
    }
    appendServiceIsland(rt.document, element, { name: "data", kind: "rest", baseUri: "/api/crew", method: "GET" });
    if (options.bar) {
        const bar = rt.createElement("div");
        bar.className = "wx-table-selection";
        const action = rt.createElement("button");
        action.textContent = "Assign";
        bar.appendChild(action);
        element.appendChild(bar);
    }
    rt.document.body.appendChild(element);

    const ctrl = new rt.wxapp.TableCtrl(element);
    const events = [];
    element.addEventListener(rt.wx.Event.SELECTION_CHANGED_EVENT, (e) => events.push(Array.from(e.detail.ids)));
    await settle();
    return { rt, element, ctrl, events, holder };
}

const rows = (ctrl) => ctrl._body.children.filter((el) => el._dataRowRef);
const checkbox = (row) => row.querySelector("input[type=\"checkbox\"]");
const click = (ctrl, row, modifiers = {}) => ctrl._onBodyClick(Object.assign({ target: row }, modifiers));

test("a multi-select table has a checkbox per row and one to choose all", async () => {
    const { ctrl, element } = await table({ "data-multiselect": "true" });

    assert.equal(rows(ctrl).length, 4);
    assert.ok(rows(ctrl).every((row) => checkbox(row)), "every row has its checkbox");
    assert.ok(element.querySelector("[role=\"columnheader\"] input[type=\"checkbox\"]"), "the header chooses all");
    assert.equal(element.hasAttribute("data-multiselect"), false);
});

test("a checkbox chooses a row, Shift chooses the range, and every change is announced", async () => {
    const { ctrl, events } = await table({ "data-multiselect": "true" });
    const [r1, , r3] = rows(ctrl);

    ctrl._check(r1._dataRowRef, {});
    ctrl._check(r3._dataRowRef, { shiftKey: true });
    ctrl.store.flush();

    assert.deepEqual(ctrl.selection, ["r1", "r2", "r3"]);
    assert.deepEqual(events, [["r1"], ["r1", "r2", "r3"]]);
    assert.deepEqual(rows(ctrl).map((row) => row.getAttribute("aria-selected")), ["true", "true", "true", null]);
    assert.equal(checkbox(rows(ctrl)[1]).checked, true);

    ctrl._check(r1._dataRowRef, {});
    assert.deepEqual(ctrl.selection, ["r2", "r3"], "a chosen row is released again");
});

test("Ctrl on a row adds it, a plain click selects the row as before", async () => {
    const { ctrl } = await table({ "data-multiselect": "true", "data-selectable": "true" });
    const [r1, r2] = rows(ctrl);

    click(ctrl, r1, { ctrlKey: true });
    click(ctrl, r2, { metaKey: true });
    assert.deepEqual(ctrl.selection, ["r1", "r2"]);

    click(ctrl, r2);
    assert.deepEqual(ctrl.selection, ["r1", "r2"], "a plain click leaves the multi-selection alone");
});

test("the header checkbox chooses every row and releases them again", async () => {
    const { ctrl } = await table({ "data-multiselect": "true" });

    ctrl._checkAll();
    assert.deepEqual(ctrl.selection, ["r1", "r2", "r3", "r4"]);
    ctrl._checkAll();
    assert.deepEqual(ctrl.selection, []);
});

test("the selection bar shows while rows are chosen and keeps the server's actions", async () => {
    const { ctrl, element } = await table({ "data-multiselect": "true" }, { bar: true });
    const bar = () => element.children.find((el) => el.classList.contains("wx-table-selection"));

    assert.ok(bar(), "the bar is placed above the table");
    assert.equal(bar().hasAttribute("hidden"), true);
    assert.equal(bar().getAttribute("role"), "toolbar");

    ctrl.selection = ["r2", "r4"];
    ctrl.store.flush();
    assert.equal(bar().hasAttribute("hidden"), false);
    assert.equal(bar().querySelector(".wx-table-selection-count").textContent, "2 selected");
    assert.ok(bar().querySelector("button"), "the action the server rendered stays");
});

test("a reload releases the chosen rows the data no longer shows", async () => {
    const { ctrl, holder } = await table({ "data-multiselect": "true" });
    ctrl.selection = ["r1", "r3"];

    holder.response = { columns: RESPONSE.columns, rows: RESPONSE.rows.filter((x) => x.id !== "r3"), total: 3 };
    ctrl.load();
    await settle();

    assert.deepEqual(ctrl.selection, ["r1"]);
});

test("rows carry their ids as sources and targets of the drag-and-drop protocol", async () => {
    const { ctrl, element } = await table({ "data-multiselect": "true", "data-drag-kind": "person", "data-drop-kind": "team" });
    const [r1] = rows(ctrl);

    assert.equal(r1.getAttribute("draggable"), "true");
    assert.equal(r1.getAttribute("data-wx-drag"), "r1");
    assert.equal(r1.getAttribute("data-wx-drag-kind"), "person");
    assert.equal(r1.getAttribute("data-wx-drop"), "r1");
    assert.equal(r1.getAttribute("data-wx-drop-kind"), "team");
    assert.ok(element.hasAttribute("data-wx-drag-scope"), "a drag of a chosen row carries all chosen rows");
});

test("a table with movable rows keeps its own row moves", async () => {
    const { ctrl } = await table({ "data-movable-row": "true", "data-drag-kind": "person" });

    assert.equal(rows(ctrl)[0].hasAttribute("data-wx-drag"), false);
});
