/**
 * Exercises moves that need a dialog: the board stores no such move, opens the dialog in the
 * form dialog of the page with the instruction to keep the page, and loads itself again once
 * the dialog's form reports success.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadControl } from "./controls.harness.mjs";

/**
 * Creates a board whose card "a" needs a dialog to enter "review", and optionally the form
 * dialog of the page, registered the way the controller registers it.
 * @param {object} [options={}] - modal: false to leave the page without form dialog;
 * modalId: the id of the page dialog; boardModal: the id the board is told to use.
 * @returns {object} The runtime, the board, its card, the dialog and the recorded calls.
 */
function setup(options = {}) {
    const rt = loadControl({ file: "webexpress.webapp.kanban.js", deps: [
        "webexpress.webapp.input.selection.js", "webexpress.webapp.kanban.model.js", "webexpress.webapp.kanban.status.js"
    ] });

    let modal = null;
    if (options.modal !== false) {
        const dialog = rt.document.createElement("dialog");
        dialog.id = options.modalId || "modal-form";
        rt.document.body.appendChild(dialog);
        modal = new rt.wx.ModalFormCtrl(dialog);
        rt.wx.Controller.instanceMap.set(dialog, modal);
        // the dialog loads what it shows from the server, which is not what is tested here
        modal.show = () => dialog.showModal();
    }

    const host = rt.document.createElement("div");
    host.id = "board";
    if (options.boardModal) {
        host.dataset.moveDialogModal = options.boardModal;
    }
    rt.document.body.appendChild(host);
    const board = new rt.wxapp.KanbanCtrl(host);
    board.updateData({
        statuses: [{ id: "open", label: "Open" }, { id: "active", label: "In progress" }, { id: "review", label: "Review" }],
        columns: [{ id: "todo", label: "To do", statusIds: ["open"] }, { id: "work", label: "Work", statusIds: ["active", "review"] }],
        items: [
            { id: "a", columnId: "todo", statusId: "open", allowedStatusIds: options.allowed ?? null, moveDialogs: { review: "/transition/a/review" } },
            { id: "b", columnId: "work", statusId: "active" }
        ]
    });

    const updates = [];
    board._sendStateToServer = (payload) => updates.push(JSON.parse(JSON.stringify(payload)));
    let reloads = 0;
    board.update = () => reloads++;

    const location = rt.sandbox.window ? rt.sandbox.window.location : rt.sandbox.location;
    const navigations = [];
    location.assign = (uri) => navigations.push(uri);

    return { ...rt, host, board, card: board._cards[0], modal, updates, navigations, reloads: () => reloads };
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
 * Picks a destination in the board's status dialog and confirms it.
 * @param {object} board - The board owning the status dialog.
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

/**
 * Reports a successful submit of the form shown in the dialog. The form dispatches a bubbling
 * event; the test DOM does not bubble, so it is dispatched where it arrives on a page.
 * @param {object} rt - The runtime.
 * @param {object} modal - The page dialog.
 */
function submitted(rt, modal) {
    const form = rt.document.createElement("form");
    modal._element.appendChild(form);
    modal._element.dispatchEvent({ type: rt.wx.Event.UPLOAD_SUCCESS_EVENT, target: form, detail: { form: form } });
}

test("a move into a status with a dialog opens the dialog and leaves the card where it was", () => {
    const { board, card, modal, updates } = setup();

    board._moveCard(card, "work", null);
    choose(board, "review");

    assert.equal(card.columnId, "todo", "the card stays in its column");
    assert.equal(card.statusId, "open", "the card keeps its status");
    assert.deepEqual(updates, [], "the board stores nothing");
    assert.equal(modal._element.open, true);
    assert.equal(modal.uri, "/transition/a/review");
    assert.equal(modal.successAction, "none", "the dialog's form is told to keep the page");
});

test("a submitted dialog closes, keeps the page and loads the board again", () => {
    const rt = setup();
    const { board, card, modal, navigations } = rt;

    board._moveCard(card, "work", null);
    choose(board, "review");
    submitted(rt, modal);

    assert.equal(rt.reloads(), 1, "the board loads the stored move");
    assert.equal(modal._element.open, false, "the dialog closed");
    assert.deepEqual(navigations, [], "no navigation");
    assert.equal(modal.successAction, null, "the next opener of the dialog gets the form's own action");

    submitted(rt, modal);
    assert.equal(rt.reloads(), 1, "a later form in the same dialog leaves the board alone");
});

test("a cancelled dialog stores nothing and a later form in the dialog does not reload the board", () => {
    const rt = setup();
    const { board, card, modal, updates } = rt;

    board._moveCard(card, "work", null);
    choose(board, "review");
    modal.hide();
    submitted(rt, modal);

    assert.deepEqual(updates, []);
    assert.equal(rt.reloads(), 0);
    assert.equal(card.columnId, "todo");
});

test("a status without a dialog still moves and saves at once", () => {
    const { board, card, modal, updates } = setup();

    board._moveCard(card, "work", null);
    choose(board, "active");

    assert.equal(card.columnId, "work");
    assert.equal(card.statusId, "active");
    assert.deepEqual(updates, [{ cardId: "a", columnId: "work", swimlaneId: null, statusId: "active" }]);
    assert.equal(modal._element.open, false);
});

test("a keyboard move with a single destination opens the dialog without asking", () => {
    const { board, card, host, modal, updates } = setup({ allowed: ["review"] });
    const element = Array.from(host.querySelectorAll(".wx-kanban-card")).find((item) => item.dataset.cardId === "a");

    board._onCardKeyDown({ key: "ArrowRight", altKey: true, target: element, preventDefault() {} }, card, element);

    assert.equal(board._statusDialog, null, "one destination needs no choice");
    assert.equal(modal._element.open, true);
    assert.equal(modal.uri, "/transition/a/review");
    assert.deepEqual(updates, []);
    assert.equal(card.columnId, "todo");
});

test("a reorder within the column needs no dialog", () => {
    const { board, modal, updates } = setup();
    board.updateData({ items: [
        { id: "a", columnId: "todo", statusId: "open", moveDialogs: { open: "/transition/a/open" } },
        { id: "c", columnId: "todo", statusId: "open" }
    ] });

    board._moveCard(board._cards[0], "todo", null, board._cards[1], false);

    assert.equal(modal._element.open, false);
    assert.equal(updates.length, 1);
});

test("a board removed while its dialog was open does nothing when the dialog succeeds", () => {
    const rt = setup();
    const { board, card, modal, host } = rt;

    board._moveCard(card, "work", null);
    choose(board, "review");
    board.destroy();
    host.remove();

    assert.doesNotThrow(() => submitted(rt, modal));
    assert.equal(rt.reloads(), 0);
});

test("a board taken off the page without teardown does not load either", () => {
    const rt = setup();
    const { board, card, modal, host } = rt;

    board._moveCard(card, "work", null);
    choose(board, "review");
    host.remove();
    submitted(rt, modal);

    assert.equal(rt.reloads(), 0);
    assert.equal(modal._element.open, false, "the dialog still closes");
});

test("without a form dialog on the page the dialog opens as a page of its own", () => {
    const { board, card, navigations, updates } = setup({ modal: false });

    board._moveCard(card, "work", null);
    choose(board, "review");

    assert.deepEqual(navigations, ["http://localhost/transition/a/review"]);
    assert.deepEqual(updates, []);
});

test("an address that is no http address is never followed", () => {
    const { board, card, navigations } = setup({ modal: false });
    card.moveDialogs = { review: "javascript:alert(1)" };

    board._moveCard(card, "work", null);
    choose(board, "review");

    assert.deepEqual(navigations, []);
});

test("the board opens its dialogs in the page dialog it is told to use", () => {
    const { board, card, modal, navigations } = setup({ modalId: "transitions", boardModal: "transitions" });

    board._moveCard(card, "work", null);
    choose(board, "review");

    assert.equal(modal._element.open, true);
    assert.deepEqual(navigations, []);
    assert.equal(board._element.hasAttribute("data-move-dialog-modal"), false, "the attribute is consumed");
});

test("a board bound to a ViewState reloads its resource after the dialog", () => {
    const rt = setup();
    const { board, card, modal } = rt;
    delete board.update;
    const reloaded = [];
    board._viewState = { reload: (resource) => reloaded.push(resource) };
    board._resource = "tasks";

    board._moveCard(card, "work", null);
    choose(board, "review");
    submitted(rt, modal);

    assert.deepEqual(reloaded, ["tasks"]);
});
