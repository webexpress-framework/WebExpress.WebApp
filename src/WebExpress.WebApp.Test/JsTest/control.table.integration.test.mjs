/**
 * Integration tests for the table controls along their real inheritance chain -
 * webexpress.webui.TableCtrl, webexpress.webui.TableReorderableCtrl and
 * webexpress.webapp.TableCtrl - with flows that combine what the focused tests cover one
 * by one: the columns are reordered, the rows sorted and a cell edited, the table is
 * loaded anew and a layout change is refused, and the footer and the selection still
 * line up with what the table shows.
 */
import { test } from "node:test";
import assert from "node:assert";
import { loadControl } from "./controls.harness.mjs";
import { appendServiceIsland } from "./harness.mjs";

const RESPONSE = {
    columns: [{ id: "name", label: "Name" }, { id: "role", label: "Role" }, { id: "ship", label: "Ship" }],
    rows: [
        { id: "r1", cells: [{ content: "Guybrush" }, { content: "Pirate" }, { content: "Sea Monkey" }] },
        { id: "r2", cells: [{ content: "Elaine" }, { content: "Governor" }, { content: "Unicorn" }] },
        { id: "r3", cells: [{ content: "LeChuck" }, { content: "Ghost" }, { content: "Flying Dutchman" }] }
    ],
    total: 3
};
const FOOTER = { name: "3 names", role: "3 roles", ship: "3 ships" };

async function settle() {
    for (let round = 0; round < 5; round++) {
        for (let i = 0; i < 40; i++) {
            await Promise.resolve();
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
}

async function afterDebounce() {
    await new Promise((resolve) => setTimeout(resolve, 350));
    await settle();
}

/**
 * Builds a selectable REST table with movable rows on a server whose writes the test
 * may refuse, with a footer per column.
 * @returns {Promise<object>} The runtime, the table and the server.
 */
async function crewTable() {
    const rt = loadControl({ deps: ["webexpress.webapp.table.model.js"], file: "webexpress.webapp.table.js" });
    rt.wxapp.MessageQueue = { dispatchLocal() { } };
    const net = { reads: 0, writes: 0, refuse: false };
    rt.setFetch(async (url, init) => {
        if (init && init.method && init.method !== "GET") {
            net.writes += 1;
            return net.refuse
                ? { ok: false, status: 409, headers: { get: () => "application/json" }, json: async () => ({ message: "stale" }) }
                : { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({}) };
        }
        net.reads += 1;
        const body = JSON.parse(JSON.stringify(RESPONSE));
        return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => body };
    });

    const element = rt.createElement("div");
    element.id = "crew";
    Object.assign(element.dataset, { selectable: "true", movableRow: "true" });
    appendServiceIsland(rt.document, element, { name: "data", kind: "rest", baseUri: "/api/crew", method: "GET", updateMethod: "PUT" });
    rt.document.body.appendChild(element);
    // the stub does not bubble; the table hears its sort on the document
    element.addEventListener(rt.wx.Event.TABLE_SORT_EVENT, (event) => rt.document.dispatchEvent(event));

    const table = new rt.wxapp.TableCtrl(element);
    await settle();
    table._footer = RESPONSE.columns.map((column) => FOOTER[column.id]);
    table._store.flush();
    return { rt, table, net };
}

const columnIds = (table) => table._head.querySelectorAll(".wx-col-header").map((el) => el.dataset.columnId);

/**
 * Asserts that the footer row lines up with the header row, cell by cell.
 * @param {object} table - The table control.
 */
function assertFooterUnderHeaders(table) {
    const headerRow = table._head.firstChild;
    const footerRow = table._foot.firstChild;
    assert.equal(footerRow.children.length, headerRow.children.length, "the footer has a cell under every header cell");
    headerRow.children.forEach((header, i) => {
        const columnId = header.dataset.columnId;
        if (columnId) {
            assert.equal(footerRow.children[i].textContent, FOOTER[columnId], `the footer of ${columnId} stands under its header`);
        }
    });
}

/**
 * Asserts that the selection is a row the table shows, marked as selected.
 * @param {object} table - The table control.
 * @param {string} id - The id of the selected row.
 */
function assertSelected(table, id) {
    const selected = table.getSelectedRow();
    assert.ok(selected, "a row is selected");
    assert.equal(selected.id, id);
    assert.ok(table._rows.includes(selected), "the selection is one of the rows on screen");
    assert.ok(selected._anchorTr.classList.contains("active"), "and is marked as selected");
}

test("reorder, sort, edit, reload and a refused change leave footer and selection in line", async () => {
    const { rt, table, net } = await crewTable();
    const modal = {};
    table._bindModalActions(modal);
    assertSelected(table, "r1");

    // the reader moves the ship to the front, and the server stores it
    modal.applyOrder(["ship", "name", "role"]);
    await afterDebounce();
    assert.deepEqual(columnIds(table), ["ship", "name", "role"]);
    assertFooterUnderHeaders(table);

    // a sort by the name sorts by the name, wherever its column stands now
    const nameHeader = table._head.querySelectorAll(".wx-col-header").find((el) => el.dataset.columnId === "name");
    table._onHeadClick({ target: nameHeader });
    table._store.flush();
    assert.deepEqual(table._rows.map((r) => r.id), ["r2", "r1", "r3"], "Elaine, Guybrush, LeChuck");
    assert.equal(table._orderBy, "name");
    assert.equal(table._orderDir, "asc");
    await settle();

    // an edit in the role of the selected row changes that cell only
    table.selectRow("r2");
    const elaine = table.getSelectedRow();
    const roleCell = elaine._anchorTr.children.find((el) => el.dataset.columnId === "role");
    const input = rt.document.createElement("input");
    roleCell.appendChild(input);
    input.value = "Captain";
    table._onBodyInput({ target: input });
    assert.deepEqual(elaine.cells.map((c) => c.content), ["Unicorn", "Elaine", "Captain"]);

    // the table is loaded anew: the order holds and the selection follows its row
    await table._load();
    await settle();
    assert.deepEqual(columnIds(table), ["ship", "name", "role"]);
    assert.deepEqual(table._rows[1].cells.map((c) => c.content), ["Unicorn", "Elaine", "Governor"], "the cells follow the columns");
    assertSelected(table, "r2");
    assertFooterUnderHeaders(table);

    // a drag the server refuses goes back to the order it stored
    net.refuse = true;
    const reads = net.reads;
    table._dropColumn("role", "ship", true);
    table._store.flush();
    assert.deepEqual(columnIds(table), ["role", "ship", "name"]);
    await afterDebounce();
    table._store.flush();

    assert.deepEqual(columnIds(table), ["ship", "name", "role"], "the refused order is taken back");
    assert.equal(net.reads, reads, "without a reload");
    assertFooterUnderHeaders(table);
    assertSelected(table, "r2");
    assert.deepEqual(rt.wx.LocalStorage.getJson("crew").order, ["ship", "name", "role"]);
});

test("a refused row move after a reload goes back to the rows of that reload", async () => {
    const { table, net } = await crewTable();
    table.selectRow("r3");

    await table._load();
    await settle();
    net.refuse = true;
    table._moveRowByStep(table._rows[2], -1);
    table._store.flush();
    assert.deepEqual(table._rows.map((r) => r.id), ["r1", "r3", "r2"]);
    await afterDebounce();
    table._store.flush();

    assert.deepEqual(table._rows.map((r) => r.id), ["r1", "r2", "r3"]);
    assertSelected(table, "r3");
    assertFooterUnderHeaders(table);
});

test("a hidden column keeps the footer and the cells of the others under their headers", async () => {
    const { table } = await crewTable();
    const modal = {};
    table._bindModalActions(modal);

    modal.applyOrder(["role", "ship", "name"]);
    modal.applyVisibility("ship", false);
    await afterDebounce();
    await table._load();
    await settle();

    assert.deepEqual(columnIds(table), ["role", "name"]);
    assertFooterUnderHeaders(table);
    const cells = table._rows[0]._anchorTr.children.filter((el) => el.dataset.columnId);
    assert.deepEqual(cells.map((el) => el.dataset.columnId), ["role", "name"]);
    assert.deepEqual(cells.map((el) => el.textContent), ["Pirate", "Guybrush"]);
});
