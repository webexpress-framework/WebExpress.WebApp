/**
 * Headless tests for the EditorFormCtrl control (wx-webapp-editor-form).
 *
 * The shared contract (controls.contract.mjs) verifies the registration and the construct /
 * teardown lifecycle. What is tested beyond it is the autosave loop, because every part of it
 * is a rule that only shows itself as a bug in production: a hydrating form must not report
 * "saved" to someone who has written nothing, a publish must never be followed by a save that
 * re-opens the draft, and a discard must never be a page reload.
 *
 * Run with Node 18 or newer from the JsTest folder:
 *   node --test
 */
import { test } from "node:test";
import assert from "node:assert";
import { contract } from "./controls.contract.mjs";
import { loadControl, windowListenerCount } from "./controls.harness.mjs";

const FILE = "webexpress.webapp.editor.form.js";
const SELECTOR = "wx-webapp-editor-form";

contract({
    file: FILE,
    selector: SELECTOR,
    ctrl: "EditorFormCtrl"
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
 * Builds a document surface: a form carrying the draft service island, and a footer with the
 * indicator, the overflow menu and its discard entry. The form controller is stubbed through
 * the _wx_controller hook the real registry also honours, because what the draft writes is
 * whatever the publish would send.
 * @param {object} rt - The loaded runtime.
 * @param {object} [options] - values: the payload the form serializes.
 * @returns {object} The surface parts and the request log.
 */
function build(rt, options = {}) {
    const requests = [];
    const answers = options.answers || {};
    let loads = 0;

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

    const form = rt.createElement("form");

    const island = rt.createElement("wx-service");
    island.setAttribute("name", "draft");
    island.setAttribute("kind", "rest");
    island.setAttribute("base-uri", "/api/drafts");
    island.setAttribute("method", "GET");
    island.setAttribute("update-method", "PUT");
    form.appendChild(island);

    const footer = rt.createElement("footer");
    const state = rt.createElement("div");
    state.classList.add(SELECTOR);
    state.dataset.wxDebounce = "5";
    state.dataset.wxMaxDelay = "40";
    state.dataset.wxMenu = "menu";
    state.dataset.wxDiscard = "discard";

    if (options.channel) {
        state.dataset.wxChannel = options.channel;
    }
    footer.appendChild(state);

    const menu = rt.createElement("div");
    menu.id = "menu";
    menu.classList.add("wx-editor-form-menu-empty");
    const entry = rt.createElement("a");
    entry.id = "discard";
    menu.appendChild(entry);
    footer.appendChild(menu);

    form.appendChild(footer);
    rt.document.body.appendChild(form);

    form._wx_controller = {
        serialize: () => options.values ? options.values() : { Title: "t", Body: "b" },
        load: () => { loads++; }
    };

    // the dialog the editor is rendered as; the controller closes it through the controller
    // registry, which is what the _wx_controller hook stands in for here
    const dialog = rt.createElement("div");
    let hides = 0;

    dialog.classList.add("modal");
    dialog._wx_controller = { hide: () => { hides++; } };
    rt.document.body.appendChild(dialog);
    dialog.appendChild(form);

    rt.wx.Controller.createInstances(state);

    return {
        form,
        state,
        menu,
        entry,
        dialog,
        requests,
        ctrl: rt.wx.Controller.instanceMap.get(state),
        loads: () => loads,
        hides: () => hides,
        writes: () => requests.filter((r) => r.method === "PUT")
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

test("a published document leaves no draft behind", async () => {
    const rt = loadControl({ file: FILE });
    const surface = build(rt, { answers: { GET: { data: { draft: true } } } });

    await settle();

    fire(surface.form, "submit");
    fire(surface.form, "webexpress.webui.upload.success", { detail: { response: {} } });
    await settle();

    assert.equal(surface.state.getAttribute("data-wx-state"), "idle");
    assert.ok(surface.menu.classList.contains("wx-editor-form-menu-empty"), "there is nothing left to discard");
    assert.equal(surface.hides(), 1, "and the decision the dialog was opened for has been taken");
});

test("discarding drops the draft and re-loads the form rather than the page", async () => {
    const rt = loadControl({ file: FILE });
    const surface = build(rt, { answers: { GET: { data: { draft: true } } } });

    await settle();

    // the click is fired where the controller listens, because the stub does not bubble
    fire(surface.form, "click", { target: surface.entry });
    await settle();

    assert.equal(surface.requests.filter((r) => r.method === "DELETE").length, 1, "the row is dropped");
    assert.equal(surface.loads(), 1, "the surface shows what the readers see");
    assert.equal(surface.hides(), 1, "and the dialog it was written in closes");
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

    // the click is fired where the controller listens, because the stub does not bubble
    fire(surface.form, "click", { target: surface.entry });
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

test("without a draft service the indicator carries no autosave at all", async () => {
    const rt = loadControl({ file: FILE });
    const form = rt.createElement("form");
    const state = rt.createElement("div");

    state.classList.add(SELECTOR);
    form.appendChild(state);
    rt.document.body.appendChild(form);

    let calls = 0;
    rt.setFetch(async () => { calls++; return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({}) }; });

    rt.wx.Controller.createInstances(state);
    await settle();

    fire(form, "keydown");
    fire(form, "input");
    await settle();

    assert.equal(calls, 0, "a form without the endpoint is an ordinary edit form");
    assert.equal(windowListenerCount(rt, "pagehide"), 0, "and it wires nothing");
});

test("the dialog is rebuilt around the indicator without cutting it off from its form", async () => {
    const rt = loadControl({ file: FILE });
    const requests = [];

    rt.setFetch(async (url, init) => {
        requests.push({ url: String(url), method: (init && init.method) || "GET" });
        return {
            ok: true,
            status: 200,
            headers: { get: () => "application/json" },
            json: async () => ({ draft: false })
        };
    });

    // the shape the control renders: the islands and the dialog as the children of the form,
    // and the three sections the modal controller lifts onto the dialog it builds
    const form = rt.createElement("form");

    const island = rt.createElement("wx-service");
    island.setAttribute("name", "draft");
    island.setAttribute("base-uri", "/api/drafts");
    island.setAttribute("update-method", "PUT");
    form.appendChild(island);

    const modal = rt.createElement("div");
    modal.id = "editor";
    modal.classList.add("wx-webui-modal");

    const header = rt.createElement("div");
    header.classList.add("wx-modal-header");

    const content = rt.createElement("div");
    content.classList.add("wx-modal-content");
    const surface = rt.createElement("div");
    surface.setAttribute("data-fill", "true");
    content.appendChild(surface);

    const bar = rt.createElement("div");
    bar.classList.add("wx-modal-footer");
    const state = rt.createElement("div");
    state.classList.add(SELECTOR);
    state.dataset.wxDebounce = "5";
    bar.appendChild(state);

    modal.appendChild(header);
    modal.appendChild(content);
    modal.appendChild(bar);
    form.appendChild(modal);
    rt.document.body.appendChild(form);

    form._wx_controller = { serialize: () => ({ Title: "t", Body: "b" }), load: () => { } };

    rt.wx.Controller.createInstances(form);
    await settle();

    const ctrl = rt.wx.Controller.instanceMap.get(state);

    assert.ok(ctrl, "the indicator carries the editor controller");
    assert.equal(state.closest("form"), form, "and still reaches the form the dialog was built inside");
    assert.equal(requests.length, 1, "so it could ask the draft endpoint what to open on");

    // the listeners live on the form, which the rebuild never moves
    fire(form, "keydown");
    fire(form, "input");
    await settle();

    assert.ok(requests.some((r) => r.method === "PUT"), "and a keystroke still reaches the draft");

    // the body a filling surface was handed stops scrolling and passes its height down
    const body = modal.querySelector(".modal-body");

    assert.ok(body, "the dialog was built");
    assert.ok(body.classList.contains("wx-modal-fill"), "and reserved its body for the writing surface");
});

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
