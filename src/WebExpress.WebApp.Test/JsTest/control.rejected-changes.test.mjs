/**
 * Headless tests for a layout or card change the server refuses. The table and the
 * kanban board apply a change on screen before it is stored; when the store says no,
 * the stored state has to come back over the screen and the user has to be told.
 *
 * Run with Node 18 or newer from the jstest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, webappAsset, appendServiceIsland, appendStateIsland, appendResourceIsland } from "./harness.mjs";
import { loadControl } from "./controls.harness.mjs";

/**
 * A fetch that answers reads and refuses writes, counting both.
 */
function refusingFetch(body) {
    const calls = { reads: 0, writes: 0 };
    return {
        calls,
        fetch: async (url, init) => {
            if (init && init.method && init.method !== "GET") {
                calls.writes += 1;
                return { ok: false, status: 409, headers: { get: () => "application/json" }, json: async () => ({ message: "stale" }) };
            }
            calls.reads += 1;
            return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => body };
        }
    };
}

/**
 * Captures the popups a control puts in front of the user.
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

test("a table layout change the server refuses is taken back and reported", async () => {
    const engine = loadEngine({
        bootstrap: `
            webexpress.webui.TableReorderableCtrl = class extends webexpress.webui.Ctrl {
                constructor(element) {
                    super(element);
                    this._table = document.createElement("table");
                    this._columns = [];
                    this._rows = [];
                    this._options = [];
                    this._hasOptions = false;
                }
                render() { }
            };
        `,
        extraFiles: [webappAsset("webexpress.webapp.table.model.js"), webappAsset("webexpress.webapp.table.js")]
    });
    const net = refusingFetch({ columns: [{ id: "c1", label: "C1" }], rows: [{ id: "r1", cells: [{ content: "A" }] }], total: 1 });
    engine.setFetch(net.fetch);
    const popups = capturePopups(engine.wxapp);
    // the engine harness carries no event names; the one the refusal is announced
    // with needs a name of its own, or every listener of the host would hear it
    engine.wx.Event.DATA_ERROR_EVENT = "webexpress.webui.data.error";

    const host = engine.createElement("div");
    host.dataset.wxViewstate = "catalog";
    appendStateIsland(engine.document, host, { page: 0, search: "" });
    appendServiceIsland(engine.document, host, { name: "data", baseUri: "/api/catalog", method: "GET", updateMethod: "PUT", response: { rows: "rows", total: "total" } });
    appendResourceIsland(engine.document, host, { name: "rows", service: "data", target: "rows", auto: false, params: [] });
    const vs = new engine.wxapp.ViewState(host);

    const tableHost = engine.createElement("div");
    tableHost.dataset.wxResource = "rows";
    host.appendChild(tableHost);
    const table = new engine.wxapp.TableCtrl(tableHost);
    const errors = [];
    tableHost.addEventListener(engine.wx.Event.DATA_ERROR_EVENT, (e) => errors.push(e.detail));

    await vs.load("rows");
    await settle();
    const readsBefore = net.calls.reads;

    // act - the user rearranged the columns and the server does not take it
    table._sendStateToServer({ c: [{ id: "c1", visible: false, width: 0 }] });
    await settle();

    // assert
    assert.equal(net.calls.writes, 1, "the change was sent");
    assert.equal(net.calls.reads, readsBefore + 1, "the stored layout is loaded back over the refused one");
    assert.equal(popups.length, 1, "the refusal is put in front of the user");
    assert.equal(popups[0].notification.type, "alert-danger");
    assert.equal(errors.length, 1, "the host announces the refusal");
    assert.equal(errors[0].action, "columns");
});

test("a card move the server refuses is taken back and reported", async () => {
    const net = refusingFetch({ columns: [{ id: "todo", name: "Todo" }], swimlanes: [], cards: [] });
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
    const errors = [];
    boardHost.addEventListener(rt.wx.Event.DATA_ERROR_EVENT, (e) => errors.push(e.detail));

    await vs.load("board");
    await settle();
    const readsBefore = net.calls.reads;

    // act - a card was dropped into a column the server does not accept
    board._sendStateToServer({ cardId: "c1", columnId: "done", swimlaneId: null });
    await settle();

    // assert
    assert.equal(net.calls.writes, 1);
    assert.equal(net.calls.reads, readsBefore + 1, "the stored board is loaded back over the refused move");
    assert.equal(popups.length, 1, "the refusal is put in front of the user");
    assert.equal(errors.length, 1);
    assert.equal(errors[0].action, "move");
});
