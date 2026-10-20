/**
 * Headless tests for the saving side of the control contract (WebExpress.WebUI/docs/js/contract.md)
 * on the controls that store a change the moment it is made: a change is announced before it
 * is sent, a listener can veto it - it is then taken back without a word of failure, because
 * nothing failed - and a stored change is announced as saved.
 */
import { test } from "node:test";
import assert from "node:assert";
import { appendServiceIsland, appendStateIsland, appendResourceIsland } from "./harness.mjs";
import { loadControl } from "./controls.harness.mjs";

/**
 * A fetch that answers reads with the given body and stores every write, counting both.
 * @param {object} body - The body of a read.
 * @returns {object} The counters and the fetch.
 */
function storingFetch(body) {
    const calls = { reads: 0, writes: 0 };
    return {
        calls,
        fetch: async (url, init) => {
            if (init && init.method && init.method !== "GET") {
                calls.writes += 1;
                return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({}) };
            }
            calls.reads += 1;
            return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => body };
        }
    };
}

/**
 * Captures the popups a control puts in front of the user.
 * @param {object} wxapp - The webapp namespace.
 * @returns {Array<object>} The popups.
 */
function capturePopups(wxapp) {
    const popups = [];
    wxapp.MessageQueue = { dispatchLocal(payload) { popups.push(payload); } };
    return popups;
}

async function settle(turns = 12) {
    for (let i = 0; i < turns; i++) {
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
}

/**
 * Mounts a table in a ViewState and records the save announcements of its host.
 * @param {object} net - The fetch the table talks to.
 * @returns {Promise<object>} The runtime, the table, its host, the events and the popups.
 */
async function table(net) {
    const rt = loadControl({ deps: ["webexpress.webapp.table.model.js"], file: "webexpress.webapp.table.js" });
    rt.setFetch(net.fetch);
    const popups = capturePopups(rt.wxapp);

    const host = rt.createElement("div");
    host.dataset.wxViewstate = "catalog";
    appendStateIsland(rt.document, host, { page: 0, search: "" });
    appendServiceIsland(rt.document, host, { name: "data", baseUri: "/api/catalog", method: "GET", updateMethod: "PUT", response: { rows: "rows", total: "total" } });
    appendResourceIsland(rt.document, host, { name: "rows", service: "data", target: "rows", auto: false, params: [] });
    const vs = new rt.wxapp.ViewState(host);

    const tableHost = rt.createElement("div");
    tableHost.dataset.wxResource = "rows";
    host.appendChild(tableHost);
    const ctrl = new rt.wxapp.TableCtrl(tableHost);
    const events = [];
    for (const name of ["BEFORE_SAVE_EVENT", "SAVED_EVENT", "DATA_ERROR_EVENT"]) {
        tableHost.addEventListener(rt.wx.Event[name], (e) => events.push({ name: name, detail: e.detail }));
    }

    await vs.load("rows");
    await settle();

    return { rt, ctrl, tableHost, events, popups };
}

const BODY = { columns: [{ id: "c1", label: "C1" }], rows: [{ id: "r1", cells: [{ content: "A" }] }], total: 1 };

test("a stored layout change is announced before it is sent and as saved after", async () => {
    const net = storingFetch(BODY);
    const { ctrl, events } = await table(net);

    ctrl._columns[0].visible = false;
    ctrl._sendStateToServer({ c: [{ id: "c1", visible: false, width: 0 }] });
    await settle();

    assert.equal(net.calls.writes, 1);
    assert.deepEqual(events.map((event) => event.name), ["BEFORE_SAVE_EVENT", "SAVED_EVENT"]);
    assert.equal(events[0].detail.action, "columns");
    assert.equal(events[1].detail.action, "columns");
});

test("a vetoed layout change is not sent and is taken back without a word of failure", async () => {
    const net = storingFetch(BODY);
    const { rt, ctrl, tableHost, events, popups } = await table(net);
    tableHost.addEventListener(rt.wx.Event.BEFORE_SAVE_EVENT, (e) => e.preventDefault());
    const readsBefore = net.calls.reads;

    ctrl._columns[0].visible = false;
    ctrl._sendStateToServer({ c: [{ id: "c1", visible: false, width: 0 }] });
    await settle();

    assert.equal(net.calls.writes, 0, "nothing reaches the server");
    assert.equal(ctrl._columns[0].visible, true, "the confirmed layout is put back");
    assert.equal(net.calls.reads, readsBefore, "without loading the table anew");
    assert.deepEqual(events.map((event) => event.name), ["BEFORE_SAVE_EVENT"]);
    assert.equal(popups.length, 0);
});

test("a listener may change what a stored layout change sends", async () => {
    const bodies = [];
    const net = storingFetch(BODY);
    const fetch = net.fetch;
    net.fetch = async (url, init) => {
        if (init && init.method && init.method !== "GET") {
            bodies.push(JSON.parse(init.body));
        }
        return fetch(url, init);
    };
    const { rt, ctrl, tableHost } = await table(net);
    tableHost.addEventListener(rt.wx.Event.BEFORE_SAVE_EVENT, (e) => {
        e.detail.payload = Object.assign({}, e.detail.payload, { origin: "page" });
    });

    ctrl._sendStateToServer({ c: [{ id: "c1", visible: true, width: 120 }] });
    await settle();

    assert.equal(bodies.length, 1);
    assert.equal(bodies[0].origin, "page");
});

test("a vetoed card move is not sent and the stored board is loaded back silently", async () => {
    const net = storingFetch({ columns: [{ id: "todo", name: "Todo" }], swimlanes: [], cards: [] });
    const rt = loadControl({
        file: "webexpress.webapp.kanban.js",
        deps: ["webexpress.webapp.kanban.model.js"],
        fetch: net.fetch
    });
    const popups = capturePopups(rt.wxapp);
    const host = rt.createElement("div");
    host.dataset.wxViewstate = "board";
    appendServiceIsland(rt.document, host, { name: "data", baseUri: "/api/board", method: "GET", updateMethod: "PUT" });
    appendResourceIsland(rt.document, host, { name: "board", service: "data", target: "board", auto: false, params: [] });
    rt.document.body.appendChild(host);
    const vs = new rt.wxapp.ViewState(host);
    const boardHost = rt.createElement("div");
    boardHost.setAttribute("data-wx-resource", "board");
    boardHost.dataset.wxResource = "board";
    host.appendChild(boardHost);
    const board = new rt.wxapp.KanbanCtrl(boardHost);
    await vs.load("board");
    await settle();
    let reloaded = 0;
    board.update = () => { reloaded += 1; };
    boardHost.addEventListener(rt.wx.Event.BEFORE_SAVE_EVENT, (e) => e.preventDefault());

    board._sendStateToServer({ cardId: "c1", columnId: "done", swimlaneId: null });
    await settle();

    assert.equal(net.calls.writes, 0);
    assert.equal(reloaded, 1, "the stored board comes back over the vetoed move");
    assert.equal(popups.length, 0);
});
