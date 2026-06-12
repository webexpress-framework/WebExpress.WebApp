/**
 * Headless unit tests for the REST kanban model helpers (phase two).
 *
 * These cover the pure logic extracted from webexpress.webapp.kanban.js, namely
 * the board normalisation, plus an end to end path that loads the board with a
 * query and persists a card move with an update through a service.
 *
 * Run with Node 18 or newer from the jstest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, webappAsset } from "./harness.mjs";

function load(options) {
    return loadEngine(Object.assign(
        { extraFiles: [webappAsset("webexpress.webapp.kanban.model.js")] },
        options
    ));
}

test("normalize board maps columns, swimlanes and cards with defaults", () => {
    const { wxapp } = load();
    const board = wxapp.kanbanModel.normalizeBoard({
        columns: [{ id: "c1", label: "To Do" }, { id: "c2", label: "Done", size: "2fr" }],
        swimlanes: [{ id: "s1", label: "Lane", expanded: false }],
        items: [{ id: "i1", columnId: "c1", swimlaneId: "s1", label: "Card" }]
    });

    assert.equal(board.columns.length, 2);
    assert.equal(board.columns[0].size, "1fr");
    assert.equal(board.columns[1].size, "2fr");
    assert.equal(board.swimlanes[0].expanded, false);
    assert.equal(board.cards[0].id, "i1");
    assert.equal(board.cards[0].label, "Card");
    assert.deepEqual(board.cards[0].primaryAction, {});
});

test("normalize board returns only the present parts and tolerates empties", () => {
    const { wxapp } = load();

    const partial = wxapp.kanbanModel.normalizeBoard({ items: [{ id: "x" }] });
    assert.equal("columns" in partial, false);
    assert.equal("swimlanes" in partial, false);
    assert.equal(partial.cards.length, 1);

    const lanes = wxapp.kanbanModel.normalizeBoard({ swimlanes: [{ id: "s", label: "L" }] });
    assert.equal(lanes.swimlanes[0].expanded, true);

    assert.deepEqual(wxapp.kanbanModel.normalizeBoard(null), {});
});

test("model loads the board and persists a move through a service", async () => {
    const { wxapp, setFetch } = load();
    const calls = [];
    setFetch(async (url, init) => {
        const method = (init && init.method) || "GET";
        calls.push({ url: url, method: method, body: init && init.body });
        if (method === "GET") {
            return { ok: true, status: 200, json: async () => ({ columns: [{ id: "c1", label: "To Do" }], items: [{ id: "i1", columnId: "c1" }] }) };
        }
        return { ok: true, status: 200, json: async () => ({}) };
    });

    const service = wxapp.ServiceRegistry.create({ name: "data", kind: "rest", baseUri: "/api/board", method: "GET", updateMethod: "PUT" });

    const loaded = await service.query({});
    assert.equal(calls[0].method, "GET");
    const board = wxapp.kanbanModel.normalizeBoard(loaded.data);
    assert.equal(board.columns[0].id, "c1");
    assert.equal(board.cards[0].id, "i1");

    const moved = await service.update({ cardId: "i1", columnId: "c2", swimlaneId: null });
    assert.equal(calls[1].method, "PUT");
    assert.deepEqual(JSON.parse(calls[1].body), { cardId: "i1", columnId: "c2", swimlaneId: null });
    assert.equal(moved.ok, true);
});
