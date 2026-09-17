/**
 * Headless tests for the ModalEditorCtrl control (wx-webapp-modal-editor).
 *
 * The shared contract (controls.contract.mjs) verifies the registration and the construct /
 * teardown lifecycle. What is tested beyond it are the two concerns the dialog adds to the
 * modal it is derived from, because every part of them is a rule that only shows itself as a
 * bug in production: a hydrating form must not report "saved" to someone who has written
 * nothing, a publish must never be followed by a save that re-opens the draft, a discard must
 * never be a page reload; and the reading view has to be filled from the editor at the moment
 * it is asked for, stand in for the surface rather than beside it, and be gone again when the
 * dialog is next opened.
 *
 * Run with Node 18 or newer from the JsTest folder:
 *   node --test
 */
import { test } from "node:test";
import assert from "node:assert";
import { contract } from "./controls.contract.mjs";
import { loadControl, windowListenerCount } from "./controls.harness.mjs";

const FILE = "webexpress.webapp.modal.editor.js";
const SELECTOR = "wx-webapp-modal-editor";

contract({
    file: FILE,
    selector: SELECTOR,
    ctrl: "ModalEditorCtrl"
});

/**
 * Lets the pending promises and the debounce timer run.
 * @param {number} [ms] - How long to wait.
 * @returns {Promise<void>} Resolves after the wait.
 */
function settle(ms = 20) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Builds the surface the control renders: a form carrying the draft service island and the
 * dialog, whose three sections the base lifts onto the dialog it builds - the surface in the
 * content box, the presence slot, the menu with its discard entry and the publish button on the
 * bar. The form controller, the editor and the content control are stubbed through the
 * _wx_controller hook and the registry the real page also uses, because what the dialog has to
 * prove is what it reads from them and what it writes into them.
 * @param {object} rt - The loaded runtime.
 * @param {object} [options] - answers: the draft endpoint's replies by method; values: the
 *   payload the form serializes; channel: the collaboration channel; draft: false for a form
 *   that declares no draft service; preview: false for a dialog without the reading view;
 *   quiet: true for a hidden save state; wrapped: whether the surface sits in a container;
 *   value: what the editor holds.
 * @returns {object} The surface parts and the request log.
 */
function build(rt, options = {}) {
    const requests = [];
    const answers = options.answers || {};
    const written = [];
    let loads = 0;
    let text = options.value ?? "<p>star</p>";

    rt.setFetch(async (url, init) => {
        const method = (init && init.method) || "GET";
        requests.push({ url: String(url), method, body: init && init.body, keepalive: !!(init && init.keepalive) });

        const answer = answers[method];

        return {
            ok: answer ? answer.ok !== false : true,
            status: answer && answer.status ? answer.status : 200,
            headers: { get: () => "application/json" },
            json: async () => (answer && answer.data) || {},
            text: async () => ""
        };
    });

    // the reading view goes through the registry, so the content control is stood in for the
    // way a page registers it
    rt.wx.Controller.registerClass("wx-webui-content", class {
        constructor(element) { this._element = element; }
        set value(value) { written.push(value); }
    });

    const form = rt.createElement("form");

    if (options.draft !== false) {
        const island = rt.createElement("wx-service");
        island.setAttribute("name", "draft");
        island.setAttribute("kind", "rest");
        island.setAttribute("base-uri", "/api/drafts");
        island.setAttribute("method", "GET");
        island.setAttribute("update-method", "PUT");
        form.appendChild(island);
    }

    const dialog = rt.createElement("dialog");
    dialog.id = "editor";
    dialog.classList.add(SELECTOR);
    dialog.setAttribute("data-wx-debounce", "5");
    dialog.setAttribute("data-wx-max-delay", "40");

    if (options.channel) {
        dialog.setAttribute("data-wx-channel", options.channel);
    }
    if (options.preview !== false) {
        dialog.setAttribute("data-wx-preview", "true");
    }
    if (options.quiet) {
        dialog.setAttribute("data-wx-show-state", "false");
    }

    const header = rt.createElement("div");
    header.classList.add("wx-modal-header");

    const box = rt.createElement("div");
    box.classList.add("wx-modal-content", "wx-editor-form-content");
    const main = rt.createElement("main");
    const editor = rt.createElement("div");
    editor.classList.add("wx-editor");
    editor.setAttribute("data-fill", "true");
    editor._wx_controller = { get value() { return text; } };
    main.appendChild(editor);

    if (options.wrapped) {
        const host = rt.createElement("div");
        host.appendChild(main);
        box.appendChild(host);
    } else {
        box.appendChild(main);
    }

    const bar = rt.createElement("div");
    bar.classList.add("wx-modal-footer", "wx-editor-form-footer");

    if (options.channel) {
        const presence = rt.createElement("div");
        presence.id = "editor_presence";
        presence.classList.add("wx-editor-form-presence");
        bar.appendChild(presence);
    }

    const menu = rt.createElement("div");
    menu.id = "editor_menu";
    menu.classList.add("wx-editor-form-menu", "wx-editor-form-menu-empty");
    const entry = rt.createElement("a");
    entry.id = "editor_discard";
    menu.appendChild(entry);

    if (options.draft !== false) {
        bar.appendChild(menu);
    }

    const buttons = rt.createElement("div");
    buttons.appendChild(rt.createElement("button"));
    bar.appendChild(buttons);

    dialog.appendChild(header);
    dialog.appendChild(box);
    dialog.appendChild(bar);
    form.appendChild(dialog);
    rt.document.body.appendChild(form);

    form._wx_controller = {
        serialize: () => options.values ? options.values() : { Title: "t", Body: "b" },
        load: () => { loads++; }
    };

    rt.wx.Controller.createInstances(dialog);

    const slot = bar.querySelector(".wx-editor-form-switch");

    return {
        form,
        dialog,
        box,
        bar,
        menu,
        entry,
        requests,
        written,
        surface: box.children[0],
        preview: box.querySelector(".wx-editor-form-preview"),
        state: bar.querySelector(".wx-editor-form-state"),
        slot,
        ctrl: rt.wx.Controller.instanceMap.get(dialog),
        loads: () => loads,
        writes: () => requests.filter((r) => r.method === "PUT"),
        type: (value) => { text = value; },
        item: (name) => slot ? slot.querySelector(`[data-view-tab="${name}"]`) : null,

        // the switch listens on its group rather than on every entry, and the stub does not
        // bubble - so the click is dispatched where the listener is, naming the entry
        pick: (name) => slot.children[0].dispatchEvent({ type: "click", target: slot.querySelector(`[data-view-tab="${name}"]`) }),

        // the dialog is opened the way a trigger does, and closed the way the base closes it -
        // through the element, whose close event is what the hide event is dispatched from
        open: () => dialog.setAttribute("open", ""),
        bars: () => Array.from(bar.children).map((child) => child.className || child.id || child.tagName.toLowerCase())
    };
}

/**
 * Fires an event on a target of the stub, which does not bubble - so the event is dispatched
 * where the controller listens.
 * @param {object} target - The stub element.
 * @param {string} type - The event type.
 * @param {object} [extra] - Additional event fields.
 */
function fire(target, type, extra = {}) {
    target.dispatchEvent(Object.assign({ type, target, preventDefault() { this.defaultPrevented = true; } }, extra));
}

// ------------------------------------------------------------------------------- the bar

test("the dialog builds the bar around what was rendered: switch, presence, state, menu, publish", () => {
    const rt = loadControl({ file: FILE });
    const surface = build(rt, { channel: "doc-1" });

    assert.deepEqual(surface.bars(), [
        "wx-editor-form-switch",
        "wx-editor-form-presence",
        "wx-editor-form-state",
        "wx-editor-form-menu wx-editor-form-menu-empty",
        "div"
    ]);
    assert.equal(surface.dialog.getAttribute("data-wx-debounce"), null, "the configuration is consumed");
    assert.ok(surface.dialog.classList.contains("modal"), "and the dialog is the modal it is derived from");
});

test("a quiet bar keeps its indicator hidden rather than dropping it", () => {
    const rt = loadControl({ file: FILE });
    const surface = build(rt, { quiet: true });

    assert.ok(surface.state, "the state is still tracked");
    assert.ok(surface.state.hasAttribute("hidden"), "it just says nothing");
    assert.equal(surface.state.getAttribute("data-wx-state"), "idle");
});

// ----------------------------------------------------------------------------- the draft

test("the indicator opens on the answer of the draft endpoint, not on a guess", async () => {
    const rt = loadControl({ file: FILE });
    const surface = build(rt, { answers: { GET: { data: { draft: true, updated: "2026-09-03T10:00:00Z" } } } });

    await settle();

    assert.equal(surface.state.getAttribute("data-wx-state"), "draft", "the editor is resuming a draft");
    assert.ok(!surface.menu.classList.contains("wx-editor-form-menu-empty"), "there is now something to discard");
    assert.equal(surface.requests[0].method, "GET", "the state came from the endpoint");
});

test("hydrating the form saves nothing", async () => {
    const rt = loadControl({ file: FILE });
    const surface = build(rt, { answers: { GET: { data: { draft: false, updated: null } } } });

    await settle();

    // this is the event the rest form fires while it fills the fields from the server
    fire(surface.form, "input");
    await settle();

    assert.deepEqual(surface.writes(), [], "a load is not an edit");
    assert.equal(surface.state.getAttribute("data-wx-state"), "idle");
});

test("a keystroke stores what the publish would send", async () => {
    const rt = loadControl({ file: FILE });
    const surface = build(rt, {
        answers: { GET: { data: { draft: false } } },
        values: () => ({ Title: "Kleene", Body: "<p>star</p>" })
    });

    await settle();

    fire(surface.form, "keydown");
    fire(surface.form, "input");
    await settle();

    const writes = surface.writes();

    assert.equal(writes.length, 1, "one write left");
    assert.equal(JSON.parse(writes[0].body).Title, "Kleene");
    assert.equal(JSON.parse(writes[0].body).Body, "<p>star</p>");
    assert.equal(surface.state.getAttribute("data-wx-state"), "saved");
    assert.ok(!surface.menu.classList.contains("wx-editor-form-menu-empty"), "the draft can now be discarded");
});

test("an unchanged payload is not written a second time", async () => {
    const rt = loadControl({ file: FILE });
    const surface = build(rt, { answers: { GET: { data: { draft: false } } } });

    await settle();

    fire(surface.form, "keydown");
    fire(surface.form, "input");
    await settle();

    // the editor reports a change for a caret move through a formatting command as readily as
    // for a typed character
    fire(surface.form, "webexpress.webui.change.value");
    await settle();

    assert.equal(surface.writes().length, 1, "the second report carried nothing new");
});

test("publishing drops the queued save and never deletes the draft", async () => {
    const rt = loadControl({ file: FILE });
    const surface = build(rt, { answers: { GET: { data: { draft: true } } } });

    await settle();

    fire(surface.form, "keydown");
    fire(surface.form, "input");
    fire(surface.form, "submit");
    await settle();

    assert.deepEqual(surface.writes(), [], "the save would have landed after the publication");
    assert.deepEqual(surface.requests.filter((r) => r.method === "DELETE"), [], "ending the draft is the publish endpoint's job");
    assert.equal(surface.state.getAttribute("data-wx-state"), "publishing");
});

test("a published document leaves no draft behind, and the dialog closes", async () => {
    const rt = loadControl({ file: FILE });
    const surface = build(rt, { answers: { GET: { data: { draft: true } } } });

    await settle();
    surface.open();

    fire(surface.form, "submit");
    fire(surface.form, "webexpress.webui.upload.success", { detail: { response: {} } });
    await settle();

    assert.equal(surface.state.getAttribute("data-wx-state"), "idle");
    assert.ok(surface.menu.classList.contains("wx-editor-form-menu-empty"), "there is nothing left to discard");
    assert.ok(!surface.dialog.open, "and the decision the dialog was opened for has been taken");
});

test("discarding drops the draft and re-loads the form rather than the page", async () => {
    const rt = loadControl({ file: FILE });
    const surface = build(rt, { answers: { GET: { data: { draft: true } } } });

    await settle();
    surface.open();

    // the click is fired where the controller listens, because the stub does not bubble
    fire(surface.dialog, "click", { target: surface.entry });
    await settle();

    assert.equal(surface.requests.filter((r) => r.method === "DELETE").length, 1, "the row is dropped");
    assert.equal(surface.loads(), 1, "the surface shows what the readers see");
    assert.ok(!surface.dialog.open, "and the dialog it was written in closes");
    assert.equal(surface.state.getAttribute("data-wx-state"), "idle");
    assert.ok(surface.menu.classList.contains("wx-editor-form-menu-empty"));
});

test("a form the author has not touched again is not re-saved after a discard", async () => {
    const rt = loadControl({ file: FILE });
    const surface = build(rt, { answers: { GET: { data: { draft: true } } } });

    await settle();

    fire(surface.form, "keydown");
    fire(surface.form, "input");
    await settle();

    fire(surface.dialog, "click", { target: surface.entry });
    await settle();

    const before = surface.writes().length;

    // re-loading the form fires the same events typing does
    fire(surface.form, "input");
    await settle();

    assert.equal(surface.writes().length, before, "the reload did not re-open the draft");
});

test("a failed write is reported and the next change retries", async () => {
    const rt = loadControl({ file: FILE });
    const surface = build(rt, { answers: { GET: { data: { draft: false } }, PUT: { ok: false, status: 500 } } });

    await settle();

    fire(surface.form, "keydown");
    fire(surface.form, "input");
    await settle();

    assert.equal(surface.state.getAttribute("data-wx-state"), "error");

    fire(surface.form, "input");
    await settle();

    assert.ok(surface.writes().length >= 2, "the text is still in the dom, so the write is tried again");
});

test("leaving the page flushes the pending save so it outlives the document", async () => {
    const rt = loadControl({ file: FILE });
    const surface = build(rt, { answers: { GET: { data: { draft: false } } } });

    await settle();

    fire(surface.form, "keydown");
    rt.sandbox.window.dispatchEvent({ type: "pagehide" });
    await settle();

    const writes = surface.writes();

    assert.equal(writes.length, 1);
    assert.ok(writes[0].keepalive, "an ordinary request would be cancelled with the document");
});

test("the teardown takes the page level listeners off and clears the queued save", async () => {
    const rt = loadControl({ file: FILE });
    const surface = build(rt, { answers: { GET: { data: { draft: false } } } });

    await settle();

    assert.equal(windowListenerCount(rt, "pagehide"), 1);

    fire(surface.form, "keydown");
    fire(surface.form, "input");
    surface.ctrl.destroy();
    await settle();

    assert.equal(windowListenerCount(rt, "pagehide"), 0, "nothing of the controller is left on the window");
    assert.deepEqual(surface.writes(), [], "the queued save was dropped with it");
});

test("without a draft service the dialog carries no autosave at all", async () => {
    const rt = loadControl({ file: FILE });
    const surface = build(rt, { draft: false });

    await settle();

    fire(surface.form, "keydown");
    fire(surface.form, "input");
    await settle();

    assert.equal(surface.requests.length, 0, "a form without the endpoint is an ordinary edit form");
    assert.equal(surface.state, null, "with nothing to say about a draft");
    assert.equal(windowListenerCount(rt, "pagehide"), 0, "and it wires nothing");
    assert.ok(surface.slot, "while the reading view is still on offer");
});

test("the dialog reserves its body for the writing surface it was handed", () => {
    const rt = loadControl({ file: FILE });
    const surface = build(rt);
    const body = surface.dialog.querySelector(".modal-body");

    assert.ok(body, "the dialog was built");
    assert.ok(body.classList.contains("wx-modal-fill"), "and reserved its body for the writing surface");
    assert.equal(surface.box.parentNode, body, "which is where the content box went");
});

// ---------------------------------------------------------------------- shared documents

test("a stored draft is announced to the other authors of the document", async () => {
    const rt = loadControl({ file: FILE });
    const sent = [];

    rt.sandbox.webexpress.webapp.MessageQueue = {
        status: "online",
        register() { }, unregister() { },
        send(message) { sent.push(message); }
    };

    const surface = build(rt, { answers: { GET: { data: { draft: false } } }, channel: "doc-1" });

    await settle();

    fire(surface.form, "keydown");
    fire(surface.form, "input");
    await settle();

    const announcement = sent.find((m) => m.type === "webexpress.webapp.collaborative.draft");

    assert.ok(announcement, "the peers are told the draft moved");
    assert.equal(announcement.containerId, "doc-1", "on the channel the document is shared on");
    assert.ok(announcement.author, "and by an author, so the sender can skip its own");
});

test("a document that is not shared announces nothing", async () => {
    const rt = loadControl({ file: FILE });
    const sent = [];

    rt.sandbox.webexpress.webapp.MessageQueue = {
        status: "online",
        register() { }, unregister() { },
        send(message) { sent.push(message); }
    };

    const surface = build(rt, { answers: { GET: { data: { draft: false } } } });

    await settle();

    fire(surface.form, "keydown");
    fire(surface.form, "input");
    await settle();

    assert.deepEqual(sent, [], "there is nobody to tell");
});

test("an announcement from another author is picked up from the endpoint", async () => {
    const rt = loadControl({ file: FILE });
    let listener = null;

    rt.sandbox.webexpress.webapp.MessageQueue = {
        status: "online",
        register(fn) { listener = fn; },
        unregister() { },
        send() { }
    };

    const surface = build(rt, { answers: { GET: { data: { draft: false } } }, channel: "doc-1" });

    await settle();

    listener({ type: "webexpress.webapp.collaborative.draft", containerId: "doc-1", author: "somebody-else" });
    await settle();

    assert.equal(surface.loads(), 1, "the surface reloads what was stored rather than trusting the message");
    assert.equal(surface.state.getAttribute("data-wx-state"), "draft");
});

test("an announcement is not adopted over somebody who is still writing", async () => {
    const rt = loadControl({ file: FILE });
    let listener = null;

    rt.sandbox.webexpress.webapp.MessageQueue = {
        status: "online",
        register(fn) { listener = fn; },
        unregister() { },
        send() { }
    };

    const surface = build(rt, { answers: { GET: { data: { draft: false } } }, channel: "doc-1" });

    await settle();

    // a save of this author's own is queued, so their next write is what the others will adopt
    fire(surface.form, "keydown");
    fire(surface.form, "input");
    listener({ type: "webexpress.webapp.collaborative.draft", containerId: "doc-1", author: "somebody-else" });

    assert.equal(surface.loads(), 0, "the text on screen is not replaced under the caret");
});

test("an announcement for another document is ignored", async () => {
    const rt = loadControl({ file: FILE });
    let listener = null;

    rt.sandbox.webexpress.webapp.MessageQueue = {
        status: "online",
        register(fn) { listener = fn; },
        unregister() { },
        send() { }
    };

    const surface = build(rt, { answers: { GET: { data: { draft: false } } }, channel: "doc-1" });

    await settle();

    listener({ type: "webexpress.webapp.collaborative.draft", containerId: "doc-2", author: "somebody-else" });
    await settle();

    assert.equal(surface.loads(), 0, "the channel is what decides");
});

// --------------------------------------------------------------------------- the preview

test("the reading view is a content control beside the surface, hidden, and the switch opens on writing", () => {
    // the shipped catalogue, so the captions are tested against the words a page shows
    const rt = loadControl({ deps: ["i18n/en.js"], file: FILE });
    const surface = build(rt);

    assert.equal(surface.ctrl.view, "write");
    assert.ok(surface.preview, "the reading view was built");
    assert.equal(surface.preview.parentNode, surface.box, "beside the surface");
    assert.ok(surface.preview.hasAttribute("hidden"), "out of sight");
    assert.equal(surface.preview.getAttribute("data-fill"), "true", "and taking part in the fill contract");
    assert.equal(surface.preview.getAttribute("data-placeholder"), "Nothing to show yet.");
    assert.equal(surface.item("write").getAttribute("aria-pressed"), "true", "the surface is the one pressed");
    assert.equal(surface.item("preview").textContent, "Preview", "the entry carries the shipped caption");
});

test("picking the preview fills the reading view from the editor and puts it in the place of the surface", () => {
    const rt = loadControl({ file: FILE });
    const surface = build(rt, { value: "<p>Kleene</p>" });

    surface.pick("preview");

    assert.equal(surface.ctrl.view, "preview");
    assert.deepEqual(surface.written, ["<p>Kleene</p>"], "the view holds what the editor holds");
    assert.ok(!surface.preview.hasAttribute("hidden"), "the reading view is on screen");
    assert.ok(surface.surface.hasAttribute("hidden"), "and the surface is not");
    assert.equal(surface.item("preview").getAttribute("aria-pressed"), "true");
    assert.equal(surface.item("write").getAttribute("aria-pressed"), "false");
});

test("the surface is the one thing in the content box, so a wrapped one is swapped whole", () => {
    const rt = loadControl({ file: FILE });
    const surface = build(rt, { wrapped: true });

    surface.pick("preview");

    assert.ok(surface.surface.hasAttribute("hidden"), "the container around the surface is hidden");
    assert.ok(!surface.surface.children[0].hasAttribute("hidden"), "not the surface inside it");

    surface.pick("write");

    assert.ok(!surface.surface.hasAttribute("hidden"), "and comes back whole");
});

test("picking the surface again takes the reading view away without reading the editor", () => {
    const rt = loadControl({ file: FILE });
    const surface = build(rt);

    surface.pick("preview");
    surface.pick("write");

    assert.equal(surface.ctrl.view, "write");
    assert.equal(surface.written.length, 1, "the view was filled once, on the way in");
    assert.ok(surface.preview.hasAttribute("hidden"));
    assert.ok(!surface.surface.hasAttribute("hidden"));
});

test("a change of the text follows into a showing reading view, and nowhere else", () => {
    const rt = loadControl({ file: FILE });
    const surface = build(rt, { value: "<p>one</p>" });

    // this is the event the editor reports every change with, bubbling up to the form
    fire(surface.form, rt.wx.Event.CHANGE_VALUE_EVENT);
    assert.deepEqual(surface.written, [], "a change under the surface is not rendered into a view nobody sees");

    surface.pick("preview");
    surface.type("<p>two</p>");
    fire(surface.form, rt.wx.Event.CHANGE_VALUE_EVENT);

    assert.deepEqual(surface.written, ["<p>one</p>", "<p>two</p>"], "a showing view follows the text");
});

test("closing the dialog returns it to the writing surface", () => {
    const rt = loadControl({ file: FILE });
    const surface = build(rt);

    surface.open();
    surface.pick("preview");
    surface.ctrl.hide();

    assert.ok(!surface.dialog.open);
    assert.equal(surface.ctrl.view, "write");
    assert.ok(surface.preview.hasAttribute("hidden"));
    assert.ok(!surface.surface.hasAttribute("hidden"));
});

test("the switch announces which view is showing", () => {
    const rt = loadControl({ file: FILE });
    const surface = build(rt);
    const seen = [];

    surface.dialog.addEventListener(rt.wx.Event.CHANGE_VISIBILITY_EVENT, (event) => seen.push(event.detail.view));

    surface.pick("preview");
    surface.pick("preview");
    surface.pick("write");

    assert.deepEqual(seen, ["preview", "write"], "once per change, not per click");
});

test("without the offer the dialog builds neither the switch nor the reading view", () => {
    const rt = loadControl({ file: FILE });
    const surface = build(rt, { preview: false });

    assert.equal(surface.slot, null);
    assert.equal(surface.preview, null);
    assert.equal(surface.ctrl.view, "write");

    surface.ctrl.view = "preview";

    assert.equal(surface.ctrl.view, "write", "and there is nothing to switch to");
});
