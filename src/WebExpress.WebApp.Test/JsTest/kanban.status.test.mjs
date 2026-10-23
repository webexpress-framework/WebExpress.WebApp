/**
 * Exercises status selection through the shipped board, modal, and persistence boundary.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadControl } from "./controls.harness.mjs";

/**
 * Creates an editable board with two destination statuses and captures persistence calls.
 * @param {Array<string>|null} allowed - The card's permitted destination statuses.
 * @returns {object} The runtime, board, card, and captured updates.
 */
function setup(allowed = null) {
    const rt = loadControl({ file: "webexpress.webapp.kanban.js", deps: [
        "webexpress.webapp.input.selection.js", "webexpress.webapp.kanban.model.js", "webexpress.webapp.kanban.status.js"
    ] });
    const host = rt.document.createElement("div");
    host.id = "board";
    host.dataset.editableColumn = "true";
    rt.document.body.appendChild(host);
    const board = new rt.wxapp.KanbanCtrl(host);
    board.updateData({
        statuses: [{ id: "open", label: "Open" }, { id: "active", label: "In progress" }, { id: "review", label: "Review" }],
        columns: [{ id: "todo", label: "To do", statusIds: ["open"] }, { id: "work", label: "Work", statusIds: ["active", "review"] }],
        items: [{ id: "a", columnId: "todo", statusId: "open", allowedStatusIds: allowed }, { id: "b", columnId: "work", statusId: "active" }]
    });
    const updates = [];
    board._sendStateToServer = (payload) => updates.push(JSON.parse(JSON.stringify(payload)));
    return { ...rt, host, board, card: board._cards[0], updates };
}

/**
 * Dispatches a minimal browser-shaped event through the test DOM.
 * @param {HTMLElement} element - The event target.
 * @param {string} type - The event type.
 */
function fire(element, type) {
    element.dispatchEvent({ type, bubbles: true, preventDefault() {}, stopPropagation() {} });
}

/**
 * Selects a destination in the real modal and confirms the move.
 * @param {object} board - The board owning the modal.
 * @param {string} id - The chosen status identifier.
 */
function choose(board, id) {
    const dialog = board._statusDialog;
    for (const input of dialog._bodyDiv.querySelectorAll("input")) {
        input.checked = input.value === id;
    }
    fire(dialog._bodyDiv.querySelector("fieldset"), "change");
    fire(dialog._footerDiv.querySelector(".btn-primary"), "click");
}

test("column status assignments are provisional, support multiple values, and survive layout edits", () => {
    const { board, updates, wxapp } = setup();
    const column = board._columns[0];
    board._openColumnStatuses(column);
    const selection = board._statusDialog._statusSelection;
    assert.ok(selection instanceof wxapp.InputSelectionCtrl);
    assert.equal(selection.multiSelect, true);
    assert.equal(selection.options.length, 3);
    assert.deepEqual(Array.from(selection.value), ["open"]);
    const option = Array.from(selection._dropdownoptions.querySelectorAll("li"))
        .find((item) => item.dataset.id === "active").querySelector("button");
    selection._dropdownoptions.dispatchEvent({ type: "click", target: option });
    assert.deepEqual(Array.from(selection.value), ["open", "active"]);
    board._statusDialog.hide();
    assert.deepEqual(Array.from(column.statusIds), ["open"]);
    assert.equal(updates.length, 0);
    board._openColumnStatuses(column);
    board._statusDialog._statusSelection.value = ["open", "active"];
    fire(board._statusDialog._footerDiv.querySelector(".btn-primary"), "click");
    assert.deepEqual(updates[0].columns[0].statusIds, ["open", "active"]);
    board._setColumnColor(0, "#123456");
    assert.deepEqual(updates[1].columns[0].statusIds, ["open", "active"]);
});

test("a cell drop waits for a choice and cancel leaves both location and status unchanged", () => {
    const { board, card, updates } = setup();
    board._dragCard = card;
    board._onDropCell({ preventDefault() {} }, "work", null, null);
    assert.equal(card.columnId, "todo");
    assert.equal(card.statusId, "open");
    assert.equal(updates.length, 0);
    assert.equal(board._statusDialog._footerDiv.querySelector(".btn-primary").disabled, true);
    fire(board._statusDialog._cancelButton, "click");
    assert.equal(updates.length, 0);
    board._dragCard = card;
    board._onDropCell({ preventDefault() {} }, "work", null, null);
    choose(board, "review");
    assert.equal(card.columnId, "work");
    assert.equal(card.statusId, "review");
    assert.deepEqual(updates, [{ cardId: "a", columnId: "work", swimlaneId: null, statusId: "review" }]);
});

test("a card-relative drop preserves its insertion anchor while awaiting a choice", () => {
    const { board, card, updates } = setup();
    board._dragCard = card;
    board._onDropWidget({ preventDefault() {} }, board._cards[1], "work", null, true);
    board._dragCard = null;
    choose(board, "active");
    assert.equal(board._cards[0], card);
    assert.equal(updates.length, 1);
});

test("one permitted status moves immediately and an empty permission list blocks the move", () => {
    const single = setup(["review"]);
    single.board._moveCard(single.card, "work", null);
    assert.equal(single.card.statusId, "review");
    assert.equal(single.board._statusDialog, null);
    assert.equal(single.updates.length, 1);
    const blocked = setup([]);
    blocked.board._moveCard(blocked.card, "work", null);
    assert.equal(blocked.card.columnId, "todo");
    assert.equal(blocked.updates.length, 0);
    assert.equal(blocked.board._statusDialog._bodyDiv.querySelectorAll("input").length, 0);
    assert.equal(blocked.board._statusDialog._footerDiv.querySelector(".btn-primary").disabled, true);
});

test("keyboard column moves obey status selection while same-column reordering preserves status", () => {
    const { board, card, host, updates } = setup();
    const element = host.querySelector(".wx-kanban-card");
    board._onCardKeyDown({ key: "ArrowRight", altKey: true, target: element, preventDefault() {} }, card, element);
    assert.equal(card.columnId, "todo");
    choose(board, "active");
    card.allowedStatusIds = [];
    board._moveCard(card, "work", null, board._cards.find((item) => item.id === "b"), true);
    assert.equal(updates.length, 2);
    assert.equal(card.statusId, "active");
});

test("reloading invalidates a pending selection and teardown removes the owned dialog", () => {
    const { board, card, document, updates } = setup();
    board._moveCard(card, "work", null);
    board.updateData({ items: [{ id: "a", columnId: "todo", statusId: "open", allowedStatusIds: [] }] });
    assert.equal(board._statusDialog._element.open, false);
    choose(board, "review");
    assert.equal(updates.length, 0);
    board.destroy();
    assert.equal(document.querySelectorAll("dialog").length, 0);
});

test("unknown status assignments cannot become a destination and absent catalogs keep position-only boards usable", () => {
    const { board, card, updates } = setup();
    board._columns[1].statusIds = ["missing"];
    board._moveCard(card, "work", null);
    assert.equal(updates.length, 0);
    board.updateData({ statuses: null });
    board._moveCard(card, "work", null);
    assert.equal(updates.length, 1);
});

/**
 * Finds the status chip of a rendered card.
 * @param {HTMLElement} host - The board host.
 * @param {string} id - The card identifier.
 * @returns {HTMLElement|null} The chip, or null when the card shows no status.
 */
function statusChip(host, id) {
    const card = Array.from(host.querySelectorAll(".wx-kanban-card")).find((item) => item.dataset.cardId === id);
    return card.querySelector(".wx-kanban-card-status");
}

test("a card shows its status as a chip in the status color, in front of the application chips", () => {
    const { board, host } = setup();
    board.updateData({
        statuses: [
            { id: "open", label: "Open", colorCss: "text-bg-secondary" },
            { id: "active", label: "In progress", colorStyle: "background:#7c3aed;color:#fff;" },
            { id: "review", label: "Review" }
        ],
        items: [
            { id: "a", columnId: "todo", statusId: "open", footer: [{ label: "P1" }] },
            { id: "b", columnId: "work", statusId: "active" },
            { id: "c", columnId: "work", statusId: "review" },
            { id: "d", columnId: "work" },
            { id: "e", columnId: "work", statusId: "missing" }
        ]
    });

    const open = statusChip(host, "a");
    assert.equal(open.textContent, "Open");
    assert.ok(open.classList.contains("card-footer-chip"), "the chip shares the footer chip look");
    assert.ok(open.classList.contains("text-bg-secondary"), "a system color arrives as a class");
    assert.equal(open.parentElement.firstElementChild, open, "the status leads the footer");
    assert.equal(open.parentElement.children.length, 2, "the application chip stays");

    const active = statusChip(host, "b");
    assert.equal(active.style.cssText, "background:#7c3aed;color:#fff;", "a user-defined color arrives as a style");
    assert.ok(active.parentElement.classList.contains("card-footer"), "a card without footer chips gains a footer");

    const review = statusChip(host, "c");
    assert.equal(review.className, "card-footer-chip wx-kanban-card-status", "an uncolored status keeps the neutral chip");

    assert.equal(statusChip(host, "d"), null, "a card without status shows none");
    assert.equal(statusChip(host, "e"), null, "an unknown status shows none");
});

test("a moved card shows its new status, and a board without catalog shows none", () => {
    const { board, card, host } = setup();
    board._moveCard(card, "work", null);
    choose(board, "review");
    assert.equal(statusChip(host, "a").textContent, "Review");
    board.updateData({ statuses: null });
    assert.equal(statusChip(host, "a"), null);
});

test("the status dialogs carry the status colors", () => {
    const { board, card } = setup();
    board.updateData({ statuses: [
        { id: "open", label: "Open" },
        { id: "active", label: "In progress", colorCss: "text-bg-primary" },
        { id: "review", label: "Review", colorStyle: "background:#7c3aed;color:#fff;" }
    ] });

    board._moveCard(card, "work", null);
    const labels = Array.from(board._statusDialog._bodyDiv.querySelectorAll("label"));
    assert.equal(labels.length, 2);
    assert.ok(labels[0].querySelector(".badge").classList.contains("text-bg-primary"));
    assert.equal(labels[1].querySelector(".badge").style.cssText, "background:#7c3aed;color:#fff;");
    board._statusDialog.hide();

    board._openColumnStatuses(board._columns[1]);
    const selection = board._statusDialog._statusSelection;
    selection.value = ["open", "active", "review"];
    const chips = Array.from(selection._selection.querySelectorAll(".wx-chip"));
    assert.ok(chips[0].classList.contains("wx-selection-primary"), "an uncolored status keeps the selection color");
    assert.ok(chips[1].classList.contains("text-bg-primary"));
    assert.ok(!chips[1].classList.contains("wx-selection-primary"));
    assert.equal(chips[2].style.cssText, "background:#7c3aed;color:#fff;");
    assert.ok(!chips[2].classList.contains("wx-selection-primary"));
});

test("a changed filter reloads the board only once the server has stored it", async () => {
    const { board } = setup();
    delete board._sendStateToServer;
    const sent = [];
    let store;
    board._restUri = "/api/board";
    board._service = { name: "data", update: (payload) => {
        sent.push(JSON.parse(JSON.stringify(payload)));
        return new Promise((resolve) => { store = resolve; });
    } };
    let reloads = 0;
    board.update = () => reloads++;

    board._filter = "priority = 'high'";
    board._dispatchBoardSettings();
    assert.deepEqual(sent, [{ action: "settings", filter: "priority = 'high'" }]);
    assert.equal(reloads, 0, "a load sent now could overtake the write and bring the old filter back");

    store({ ok: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(reloads, 1);
});
