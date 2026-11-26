/**
 * Exercises the loading state of the REST board: the progress bar above it while it loads, and
 * that a reload does not draw the stale board again - which put a card just moved back into its
 * old column until the answer arrived.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadControl } from "./controls.harness.mjs";

/**
 * The board payload of two columns and one card in the first.
 * @param {string} column - The column the card is in.
 * @returns {object} The payload.
 */
function payload(column) {
    return {
        columns: [{ id: "c1", label: "To do" }, { id: "c2", label: "Done" }],
        swimlanes: [],
        items: [{ id: "a", title: "Card", columnId: column }]
    };
}

/**
 * Creates a board that owns its state and loads nothing by itself.
 * @returns {object} The runtime, the host and the board.
 */
function setup() {
    const rt = loadControl({ file: "webexpress.webapp.kanban.js", deps: [
        "webexpress.webapp.input.selection.js", "webexpress.webapp.kanban.model.js", "webexpress.webapp.kanban.status.js"
    ] });
    const host = rt.document.createElement("div");
    host.id = "board";
    rt.document.body.appendChild(host);
    const board = new rt.wxapp.KanbanCtrl(host);

    return { ...rt, host, board };
}

/**
 * Returns the progress bars of the board.
 * @param {HTMLElement} host - The board host.
 * @returns {Array<HTMLElement>} The bars.
 */
function bars(host) {
    return Array.from(host.children).filter((x) => x.classList.contains("wx-kanban-progress"));
}

/**
 * Returns the id of the column whose cell shows the card.
 * @param {HTMLElement} host - The board host.
 * @param {string} id - The card id.
 * @returns {string|null} The column id.
 */
function columnShowing(host, id) {
    const card = Array.from(host.querySelectorAll(".wx-kanban-card")).find((x) => x.dataset.cardId === id);
    return card ? card.closest(".wx-kanban-cell")?.dataset.colId ?? null : null;
}

test("the progress bar shows while the board loads and keeps its place while hidden", () => {
    const { host, board } = setup();
    board.updateData(payload("c1"));

    assert.equal(bars(host).length, 1, "the board carries one progress bar");
    assert.equal(bars(host)[0].style.visibility, "hidden", "nothing loads yet");

    board._loading = true;
    board.render();

    assert.equal(bars(host).length, 1, "a render places the same bar again, not a second one");
    assert.equal(bars(host)[0].style.visibility, "visible", "the bar shows the load in flight");
    assert.equal(host.classList.contains("placeholder-glow"), false, "a board on screen does not pulse");

    board._loading = false;
    assert.equal(bars(host)[0].style.visibility, "hidden", "the bar hides once the load is over");
});

test("an empty board shimmers while its first load is on the way", () => {
    const { host, board } = setup();

    board._loading = true;

    assert.equal(host.classList.contains("placeholder-glow"), true);
});

test("a reload does not draw the board it is about to replace", () => {
    const { host, board } = setup();
    const stored = payload("c1");
    board._applySlice({ data: stored, loading: false });

    // the card is moved on screen; the reload that follows marks the slice loading and still
    // carries the board as it was stored before the move
    board._moveCard(board._cards[0], "c2", null);
    board._applySlice({ data: stored, loading: true });

    assert.equal(columnShowing(host, "a"), "c2", "the moved card stays where it was dropped");
    assert.equal(bars(host)[0].style.visibility, "visible", "the reload shows as progress");

    board._applySlice({ data: payload("c2"), loading: false });

    assert.equal(columnShowing(host, "a"), "c2", "the stored board is rendered once it arrives");
    assert.equal(bars(host)[0].style.visibility, "hidden");
});
