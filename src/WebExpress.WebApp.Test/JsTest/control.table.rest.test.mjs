/**
 * Regression tests for the REST table (wx-webapp-table) between two loads: the selection
 * follows its row onto the new row object or is given up, the columns of the server and
 * their headings come through over the local layout, a layout change the server refuses
 * is taken back without a reload, and a sort picked in the column dialog reaches the
 * query with its direction.
 */
import { test } from "node:test";
import assert from "node:assert";
import { loadControl } from "./controls.harness.mjs";
import { appendServiceIsland } from "./harness.mjs";

const RESPONSE = {
    columns: [{ id: "name", label: "Name" }, { id: "role", label: "Role" }],
    rows: [
        { id: "r1", cells: [{ content: "Guybrush" }, { content: "Pirate" }] },
        { id: "r2", cells: [{ content: "Elaine" }, { content: "Governor" }] }
    ],
    total: 2
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
 * Waits for the debounce of the layout sync to have run out.
 * @returns {Promise<void>} Resolves after the debounce.
 */
async function afterDebounce() {
    await new Promise((resolve) => setTimeout(resolve, 350));
    await settle();
}

/**
 * Builds a standalone REST table whose reads answer with the response the test holds
 * and whose writes the test may refuse.
 * @returns {object} The runtime, the host, the table and the server.
 */
async function restTable() {
    const rt = loadControl({ deps: ["webexpress.webapp.table.model.js"], file: "webexpress.webapp.table.js" });
    rt.wxapp.MessageQueue = { dispatchLocal() { } };
    const net = { response: RESPONSE, reads: 0, writes: [], refuse: false };
    rt.setFetch(async (url, init) => {
        if (init && init.method && init.method !== "GET") {
            net.writes.push(JSON.parse(init.body));
            return net.refuse
                ? { ok: false, status: 409, headers: { get: () => "application/json" }, json: async () => ({ message: "stale" }) }
                : { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({}) };
        }
        net.reads += 1;
        const body = JSON.parse(JSON.stringify(net.response));
        return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => body };
    });

    const element = rt.createElement("div");
    element.id = "crew";
    appendServiceIsland(rt.document, element, { name: "data", kind: "rest", baseUri: "/api/crew", method: "GET", updateMethod: "PUT" });
    rt.document.body.appendChild(element);
    const table = new rt.wxapp.TableCtrl(element);
    await settle();
    return { rt, element, table, net };
}

/**
 * Builds a copy of the response, changed by the given function.
 * @param {Function} change - Changes the copy.
 * @returns {object} The response.
 */
function responseWith(change) {
    const response = JSON.parse(JSON.stringify(RESPONSE));
    change(response);
    return response;
}

test("after updateData the selection points to the new row object of the selected row", async () => {
    const { table } = await restTable();
    table.selectRow("r2");

    table.updateData(responseWith(() => { }));
    table._store.flush();

    assert.equal(table.getSelectedRow(), table._rows[1], "the selection follows its row onto the new object");
    assert.ok(table._rows[1]._anchorTr.classList.contains("active"));
});

test("after updateData a selection whose row is gone is given up and announced", async () => {
    const { rt, element, table } = await restTable();
    table.selectRow("r2");
    const seen = [];
    element.addEventListener(rt.wx.Event.SELECT_ROW_EVENT, (event) => seen.push(event.detail.row));

    table.updateData(responseWith((r) => { r.rows.pop(); }));
    table._store.flush();

    assert.equal(table.getSelectedRow(), null);
    assert.deepEqual(seen, [null], "the listeners learn that nothing is selected any more");
});

test("a column the server adds and a heading it changes appear, after a local reorder too", async () => {
    const { table } = await restTable();
    const modal = {};
    table._bindModalActions(modal);
    modal.applyOrder(["role", "name"]);
    table._store.flush();

    table.updateData(responseWith((r) => {
        r.columns[0].label = "Full name";
        r.columns.push({ id: "ship", label: "Ship" });
        r.rows[0].cells.push({ content: "Sea Monkey" });
        r.rows[1].cells.push({ content: "Unicorn" });
    }));
    table._store.flush();

    assert.deepEqual(table._columns.map((c) => c.id), ["role", "name", "ship"], "the local order holds and the new column is appended");
    assert.equal(table._columns[1].label, "Full name");
    const headers = table._head.querySelectorAll(".wx-col-header");
    assert.deepEqual(headers.map((h) => h.textContent), ["Role", "Full name", "Ship"]);
    assert.deepEqual(table._rows[0].cells.map((c) => c.content), ["Pirate", "Guybrush", "Sea Monkey"]);
});

test("a column the server no longer sends is dropped", async () => {
    const { table } = await restTable();

    table.updateData(responseWith((r) => {
        r.columns.shift();
        r.rows.forEach((row) => row.cells.shift());
    }));
    table._store.flush();

    assert.deepEqual(table._columns.map((c) => c.id), ["role"]);
    assert.deepEqual(table._rows[0].cells.map((c) => c.content), ["Pirate"]);
});

test("a column reorder the server refuses is taken back on screen and in the local store", async () => {
    const { rt, table, net } = await restTable();
    const modal = {};
    table._bindModalActions(modal);
    net.refuse = true;
    const readsBefore = net.reads;

    modal.applyOrder(["role", "name"]);
    table._store.flush();
    assert.deepEqual(table._columns.map((c) => c.id), ["role", "name"], "the change shows while it is on its way");
    await afterDebounce();
    table._store.flush();

    assert.equal(net.writes.length, 1, "the change was sent");
    assert.deepEqual(table._columns.map((c) => c.id), ["name", "role"], "the refused order is taken back");
    assert.deepEqual(table._rows[0].cells.map((c) => c.content), ["Guybrush", "Pirate"], "with the cells");
    assert.deepEqual(table._head.querySelectorAll(".wx-col-header").map((h) => h.dataset.columnId), ["name", "role"]);
    const stored = rt.wx.LocalStorage.getJson("crew");
    assert.deepEqual(stored && stored.order, ["name", "role"], "the local store holds the confirmed order");
    assert.equal(net.reads, readsBefore, "the confirmed state is restored without a reload");
});

test("a column reorder the server accepts is kept and stored locally", async () => {
    const { rt, table, net } = await restTable();
    const modal = {};
    table._bindModalActions(modal);

    modal.applyOrder(["role", "name"]);
    await afterDebounce();
    table.updateData(responseWith(() => { }));
    table._store.flush();

    assert.deepEqual(net.writes.map((w) => w.c && w.c.map((c) => c.id)), [["role", "name"]]);
    assert.deepEqual(table._columns.map((c) => c.id), ["role", "name"], "a reload keeps the confirmed order");
    assert.deepEqual(table._rows[0].cells.map((c) => c.content), ["Pirate", "Guybrush"]);
    assert.deepEqual(rt.wx.LocalStorage.getJson("crew").order, ["role", "name"]);
});

test("a row move the server refuses is taken back without a reload", async () => {
    const { table, net } = await restTable();
    net.refuse = true;
    const readsBefore = net.reads;

    table._moveRowByStep(table._rows[0], 1);
    assert.deepEqual(table._rows.map((r) => r.id), ["r2", "r1"]);
    await afterDebounce();
    table._store.flush();

    assert.deepEqual(table._rows.map((r) => r.id), ["r1", "r2"]);
    assert.equal(net.reads, readsBefore);
});

test("a sort picked in the column dialog reaches the query with its direction", async () => {
    const { rt, element, table, net } = await restTable();
    // the stub does not bubble; the table listens for the sort on the document
    element.addEventListener(rt.wx.Event.TABLE_SORT_EVENT, (event) => rt.document.dispatchEvent(event));
    const modal = {};
    table._bindModalActions(modal);
    const readsBefore = net.reads;

    modal.applySort("role", "desc");
    await settle();

    assert.equal(table._orderBy, "role");
    assert.equal(table._orderDir, "desc");
    assert.equal(net.reads, readsBefore + 1, "the sorted page is queried");
    assert.equal(table._columns.find((c) => c.id === "role").sort, "desc", "the header shows the direction of the query");
});

test("a selectable table selects its first loaded row rather than a placeholder", async () => {
    const rt = loadControl({ deps: ["webexpress.webapp.table.model.js"], file: "webexpress.webapp.table.js" });
    rt.setFetch(async () => ({ ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => JSON.parse(JSON.stringify(RESPONSE)) }));
    const element = rt.createElement("div");
    element.dataset.selectable = "true";
    appendServiceIsland(rt.document, element, { name: "data", kind: "rest", baseUri: "/api/crew", method: "GET" });
    rt.document.body.appendChild(element);

    const table = new rt.wxapp.TableCtrl(element);
    assert.equal(table.getSelectedRow(), null, "nothing is selected while the placeholders stand in");
    await settle();

    assert.equal(table.getSelectedRow(), table._rows[0]);
    assert.equal(table.getSelectedRow().id, "r1");
});

test("a column reorder the server stores with an empty answer is kept, not taken back", async () => {
    const rt = loadControl({ deps: ["webexpress.webapp.table.model.js"], file: "webexpress.webapp.table.js" });
    const popups = [];
    rt.wxapp.MessageQueue = { dispatchLocal(payload) { popups.push(payload); } };
    rt.setFetch(async (url, init) => {
        if (init && init.method && init.method !== "GET") {
            // what RestApiTable.Configure answers: 200 without a body
            return { ok: true, status: 200, headers: { get: (name) => (name.toLowerCase() === "content-length" ? "0" : null) }, json: async () => { throw new SyntaxError("Unexpected end of JSON input"); } };
        }
        return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => JSON.parse(JSON.stringify(RESPONSE)) };
    });
    const element = rt.createElement("div");
    element.id = "crew";
    appendServiceIsland(rt.document, element, { name: "data", kind: "rest", baseUri: "/api/crew", method: "GET", updateMethod: "PUT" });
    rt.document.body.appendChild(element);
    const table = new rt.wxapp.TableCtrl(element);
    await settle();
    const modal = {};
    table._bindModalActions(modal);

    modal.applyOrder(["role", "name"]);
    await afterDebounce();
    table._store.flush();

    assert.deepEqual(table._columns.map((c) => c.id), ["role", "name"], "the stored order stays");
    assert.deepEqual(table._rows[0].cells.map((c) => c.content), ["Pirate", "Guybrush"]);
    assert.equal(popups.length, 0, "no refusal is reported for a write that succeeded");
    assert.deepEqual(rt.wx.LocalStorage.getJson("crew").order, ["role", "name"]);
});
