/**
 * Headless test for the REST kanban control in ViewState mode (View, State and
 * Service).
 *
 * It instantiates the real webexpress.webapp.KanbanCtrl on the DOM stub with a
 * stubbed WebUI kanban base, inside an enclosing ViewState, and asserts
 * that the board normalises and renders the raw response the ViewState loads
 * centrally, which is the GET/PUT data shape the kanban, dashboard, tab,
 * comment and scrum-backlog families share.
 *
 * Run with Node 18 or newer from the jstest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, webappAsset, appendServiceIsland, appendResourceIsland } from "./harness.mjs";

const KANBAN_BASE_STUB = `
    webexpress.webui.KanbanCtrl = class extends webexpress.webui.Ctrl {
        constructor(element) {
            super(element);
            this._columns = [];
            this._swimlanes = [];
            this._cards = [];
        }
        render() { }
        _isVisible() { return true; }
    };
`;

function load(options) {
    return loadEngine(Object.assign({
        bootstrap: KANBAN_BASE_STUB,
        extraFiles: [
            webappAsset("webexpress.webapp.kanban.model.js"),
            webappAsset("webexpress.webapp.kanban.js")
        ]
    }, options));
}

async function settle() {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
}

test("kanban in a ViewState normalises and renders the raw board the ViewState loads", async () => {
    const engine = load();
    const urls = [];
    engine.setFetch(async (url) => {
        urls.push(url);
        return {
            ok: true, status: 200, json: async () => ({
                columns: [{ id: "c1", label: "To Do" }, { id: "c2", label: "Done" }],
                swimlanes: [],
                items: []
            })
        };
    });

    const viewStateHost = engine.createElement("div");
    viewStateHost.dataset.wxViewstate = "board";
    appendServiceIsland(engine.document, viewStateHost, {
        name: "data", kind: "rest", baseUri: "/api/board", method: "GET", updateMethod: "PUT"
    });
    appendResourceIsland(engine.document, viewStateHost, { name: "board", service: "data", target: "board", params: [] });

    const viewState = new engine.wxapp.ViewState(viewStateHost);

    const kanbanHost = engine.createElement("div");
    kanbanHost.dataset.wxResource = "board";
    viewStateHost.appendChild(kanbanHost);

    const kanban = new engine.wxapp.KanbanCtrl(kanbanHost);
    await settle();

    assert.equal(urls.length, 1, "the ViewState loaded the resource centrally");
    assert.equal(kanban._columns.length, 2, "the board renders the normalised columns from the slice");
    assert.ok(viewState.getState().board.data, "the slice carries the raw board response");
});
