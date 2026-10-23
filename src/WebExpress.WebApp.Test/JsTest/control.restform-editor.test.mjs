/**
 * Headless tests for the RestFormEditorCtrl control (wx-webapp-restform-editor).
 *
 * The shared contract (controls.contract.mjs) verifies the registration and the construct /
 * teardown lifecycle. What is tested beyond it is the two meanings of save the editor keeps
 * apart: with only the data service declared every mutation is written to the form itself,
 * with a draft service declared it goes to the draft and the form is reached only through
 * publish. Every rule here only shows itself as a bug in production - a save landing after
 * the publication would re-open the draft, a discard that reloads the page would lose the
 * host, and a publish button that is live with nothing to publish lies.
 *
 * The second half covers the failure paths of the same coordination: a failed load that must
 * not turn into an editable stand-in an autosave writes over the form, edits that must stay
 * locked while a publication or a discard runs, a change made during a write that must not be
 * reported as saved, writes that fail, conflict or are refused and must stay retryable, the
 * page going away while a write is open, answers arriving after destroy(), two editors on one
 * page, and the initial state and the ViewState binding.
 *
 * Run with Node 18 or newer from the JsTest folder:
 *   node --test
 */
import { test } from "node:test";
import assert from "node:assert";
import { contract } from "./controls.contract.mjs";
import { loadControl, windowListenerCount, elementListenerCount, keyEvent } from "./controls.harness.mjs";
import { appendServiceIsland, appendResourceIsland, appendStateIsland } from "./harness.mjs";

const FILE = "webexpress.webapp.restform.editor.js";
const SELECTOR = "wx-webapp-restform-editor";

// the shipped words, which the messages are checked against, and the rest form's
// response classification, which the editor reuses for refused writes
const DEPS = ["i18n/en.js", "webexpress.webapp.restform.model.js"];

contract({
    file: FILE,
    selector: SELECTOR,
    ctrl: "RestFormEditorCtrl"
});

/**
 * Lets the pending promises and the debounce timer run.
 * @param {number} [ms] - How long to wait.
 * @returns {Promise<void>} Resolves after the wait.
 */
function settle(ms = 30) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The structure the data endpoint answers with: one tab, one field.
 * @returns {object} A fresh copy.
 */
function published() {
    return {
        catalog: [{ id: "Title", label: "Title", type: "string" }],
        data: {
            formId: "f1",
            formName: "Bug",
            formDescription: "",
            version: 3,
            tabs: [{ id: "t1", name: "Details", children: [{ id: "n1", kind: "field", label: "Title", type: "string" }] }]
        }
    };
}

/**
 * A form with two fields and a group on its first tab and a second tab, for the tests that
 * move, collapse or address nodes.
 * @returns {object} A fresh copy.
 */
function wide() {
    return {
        catalog: [{ id: "Title", label: "Title", type: "string" }],
        data: {
            formId: "f1",
            formName: "Bug",
            formDescription: "",
            version: 3,
            tabs: [
                {
                    id: "t1", name: "Details", children: [
                        { id: "n1", kind: "field", label: "Title", type: "string" },
                        { id: "n2", kind: "field", label: "Severity", type: "enum" },
                        { id: "g1", kind: "group", layout: "vertical", label: "Reported", children: [{ id: "n3", kind: "field", label: "When", type: "timestamp" }] }
                    ]
                },
                { id: "t2", name: "Notes", children: [] }
            ]
        }
    };
}

/**
 * Creates a promise together with the function that settles it, so a test decides when a
 * request answers.
 * @returns {{promise: Promise, resolve: Function}} The gate.
 */
function gate() {
    let resolve;
    const promise = new Promise((r) => { resolve = r; });
    return { promise, resolve };
}

/**
 * Installs a fetch that logs every request and answers per "METHOD /url". An answer is
 * { ok, status, data } or { throws: true } for a network failure; a function is called
 * with the request init and may return a promise, which is how a test holds a request
 * open; an array is a queue whose last entry stays.
 * @param {object} rt - The loaded runtime.
 * @param {object} [overrides] - Answers replacing the defaults.
 * @returns {object} The request log and the mutable answer table.
 */
function server(rt, overrides = {}) {
    const requests = [];
    const answers = Object.assign({
        "GET /api/forms/f1": { data: published() },
        "PUT /api/forms/f1": { data: { data: { version: 4 } } },
        "GET /api/drafts/f1": { data: { draft: false } },
        "PUT /api/drafts/f1": { data: {} },
        "DELETE /api/drafts/f1": { status: 204 }
    }, overrides);

    rt.setFetch(async (url, init) => {
        const method = (init && init.method) || "GET";
        requests.push({ url: String(url), method, body: init && init.body, keepalive: !!(init && init.keepalive) });

        let answer = answers[method + " " + String(url)] || {};
        if (Array.isArray(answer)) {
            answer = answer.length > 1 ? answer.shift() : answer[0];
        }
        if (typeof answer === "function") {
            answer = answer(init);
        }
        answer = (await answer) || {};

        if (answer.throws) {
            throw new TypeError("Failed to fetch");
        }

        return {
            ok: answer.ok !== false,
            status: answer.status || 200,
            headers: { get: () => "application/json" },
            // parsed afresh per answer, as a real response is: a shared object would
            // carry one test step's changes into the next answer
            json: async () => JSON.parse(JSON.stringify(answer.data || {})),
            text: async () => ""
        };
    });

    return { requests, answers };
}

/**
 * Builds an editor host carrying the data service island and, when asked, the draft one,
 * with a fetch that logs every request and answers per url and method.
 * @param {object} rt - The loaded runtime.
 * @param {object} [options] - draft: whether to declare the draft service; answers: keyed
 * "METHOD /url" -> answer (see server); readonly: whether the host is read-only; services:
 * false for a host without any service; state: the wx-state island; server: a server
 * shared with another editor.
 * @returns {object} The host, the controller, the request log and the footer parts.
 */
function build(rt, options = {}) {
    const { requests, answers } = options.server || server(rt, options.answers);

    // the debounce is what the tests wait on, so it is shortened rather than waited out
    rt.wxapp.RestFormEditorCtrl.SAVE_DEBOUNCE = 5;

    const host = rt.createElement("div");
    host.classList.add(SELECTOR);
    if (options.readonly) {
        host.dataset.readonly = "true";
    }

    if (options.services !== false) {
        appendServiceIsland(rt.document, host, { name: "data", baseUri: "/api/forms/f1" });
    }

    if (options.draft) {
        appendServiceIsland(rt.document, host, { name: "draft", baseUri: "/api/drafts/f1", method: "GET", updateMethod: "PUT" });
    }

    if (options.state) {
        appendStateIsland(rt.document, host, options.state);
    }

    rt.document.body.appendChild(host);
    rt.wx.Controller.createInstances(host);

    const events = [];
    for (const type of ["loaded", "saved", "draft.saved", "draft.discarded", "published", "state", "validation.failed"]) {
        host.addEventListener("webexpress.webapp.formeditor." + type, (e) => events.push({ type, detail: e.detail }));
    }

    const ctrl = rt.wx.Controller.getInstanceByElement(host);

    return {
        host,
        requests,
        answers,
        events,
        ctrl,
        state: () => host.querySelector(".wx-form-editor-foot-status"),
        publish: () => host.querySelector(".wx-form-editor-publish"),
        discard: () => host.querySelector(".wx-form-editor-discard"),
        tree: () => host.querySelector(".wx-form-editor-tree"),
        body: () => host.querySelector(".wx-form-editor-body"),
        notice: () => host.querySelector(".wx-form-editor-notice"),
        action: (name) => host.querySelector(".wx-form-editor-notice-action[data-wx-action=" + name + "]"),
        persistence: () => ctrl.store.getState().persistence,
        of: (method, url) => requests.filter((r) => r.method === method && r.url === url),
        tabs: () => (ctrl.getStructure() ? ctrl.getStructure().tabs.length : 0)
    };
}

/**
 * Loads a runtime with the editor and its dependencies.
 * @returns {object} The runtime.
 */
function runtime() {
    return loadControl({ deps: DEPS, file: FILE });
}

test("without a draft service every mutation is written to the form itself", async () => {
    const rt = loadControl({ file: FILE });
    const editor = build(rt);

    await settle();

    assert.equal(editor.publish(), null, "there is no publication apart from the save");
    assert.equal(editor.discard(), null, "and nothing to discard");
    assert.equal(editor.state().getAttribute("data-wx-state"), "idle");

    editor.ctrl.addTab();
    await settle();

    assert.equal(editor.of("PUT", "/api/forms/f1").length, 1, "the save went to the form");
    assert.equal(JSON.parse(editor.of("PUT", "/api/forms/f1")[0].body).tabs.length, 2, "with the tab that was added");
    assert.equal(editor.ctrl.getStructure().version, 4, "the version the endpoint answered is adopted");
    assert.ok(editor.events.some((e) => e.type === "saved"), "and reported as a save");
    assert.ok(!editor.events.some((e) => e.type === "published"), "not as a publication");
});

test("the editor opens on the answer of the draft endpoint, not on a guess", async () => {
    const rt = loadControl({ file: FILE });
    const editor = build(rt, { draft: true, answers: { "GET /api/drafts/f1": { data: { draft: true, updated: "2026-09-03T10:00:00Z" } } } });

    await settle();

    assert.ok(editor.ctrl.drafting, "a declared draft service makes the editor draft");
    assert.equal(editor.of("GET", "/api/drafts/f1").length, 1, "the draft endpoint was asked");
    assert.equal(editor.of("GET", "/api/forms/f1").length, 1, "the structure came from the data endpoint");
    assert.equal(editor.state().getAttribute("data-wx-state"), "saved", "the editor is resuming a draft written at a known time");
    assert.equal(editor.publish().disabled, false, "which can be published");
    assert.equal(editor.discard().hidden, false, "or discarded");
});

test("with nothing unpublished there is nothing to publish or discard", async () => {
    const rt = loadControl({ file: FILE });
    const editor = build(rt, { draft: true });

    await settle();

    assert.equal(editor.state().getAttribute("data-wx-state"), "idle");
    assert.equal(editor.publish().disabled, true, "the form is what the endpoint already has");
    assert.equal(editor.discard().hidden, true);
});

test("a mutation goes to the draft, not to the form", async () => {
    const rt = loadControl({ file: FILE });
    const editor = build(rt, { draft: true });

    await settle();

    editor.ctrl.addNode({ kind: "field", label: "Severity", type: "enum" });

    assert.equal(editor.state().getAttribute("data-wx-state"), "pending", "the change is announced before it is written");

    await settle();

    assert.equal(editor.of("PUT", "/api/drafts/f1").length, 1, "one write to the draft");
    assert.equal(editor.of("PUT", "/api/forms/f1").length, 0, "none to the form");
    assert.equal(JSON.parse(editor.of("PUT", "/api/drafts/f1")[0].body).tabs[0].children.length, 2, "carrying the structure on screen");
    assert.equal(editor.state().getAttribute("data-wx-state"), "saved");
    assert.ok(editor.ctrl.draft, "there is now an unpublished draft");
    assert.equal(editor.publish().disabled, false, "which can be published");
    assert.equal(editor.discard().hidden, false, "or discarded");
    assert.ok(editor.events.some((e) => e.type === "draft.saved"), "and it is reported as a draft save");
    assert.ok(!editor.events.some((e) => e.type === "saved"), "not as a save of the form");
});

test("a draft that could not be written is reported, and the next change retries", async () => {
    const rt = loadControl({ file: FILE });
    const editor = build(rt, { draft: true, answers: { "PUT /api/drafts/f1": { ok: false, status: 500 } } });

    await settle();

    editor.ctrl.addTab();
    await settle();

    assert.equal(editor.state().getAttribute("data-wx-state"), "error");
    assert.ok(!editor.ctrl.draft, "nothing was stored");

    editor.ctrl.addTab();
    await settle();

    assert.equal(editor.of("PUT", "/api/drafts/f1").length, 2, "the next change tried again");
});

test("publishing sends the structure to the form and ends the draft without deleting it", async () => {
    const rt = loadControl({ file: FILE });
    const editor = build(rt, { draft: true, answers: { "GET /api/drafts/f1": { data: { draft: true } } } });

    await settle();

    const accepted = await editor.ctrl.publish();

    assert.ok(accepted);
    assert.equal(editor.of("PUT", "/api/forms/f1").length, 1, "the publication is the PUT on the form");
    assert.equal(editor.of("DELETE", "/api/drafts/f1").length, 0, "ending the draft is the publish endpoint's job");
    assert.equal(editor.ctrl.getStructure().version, 4, "the published version is adopted");
    assert.equal(editor.host.querySelector(".wx-form-editor-version").textContent, "v4", "and shown");
    assert.equal(editor.state().getAttribute("data-wx-state"), "idle");
    assert.ok(!editor.ctrl.draft, "there is no draft left");
    assert.equal(editor.publish().disabled, true, "so there is nothing to publish");
    assert.equal(editor.discard().hidden, true, "and nothing to discard");
    assert.ok(editor.events.some((e) => e.type === "published"));
});

test("publishing drops the queued draft save rather than racing it", async () => {
    const rt = loadControl({ file: FILE });
    const editor = build(rt, { draft: true });

    await settle();

    // the mutation queues a draft save that has not fired yet when publish is clicked
    editor.ctrl.addTab();
    await editor.ctrl.publish();
    await settle();

    assert.equal(editor.of("PUT", "/api/drafts/f1").length, 0, "the save would have landed after the publication");
    assert.equal(editor.of("PUT", "/api/forms/f1").length, 1);
    assert.equal(JSON.parse(editor.of("PUT", "/api/forms/f1")[0].body).tabs.length, 2, "the publication carries the structure on screen");
});

test("a rejected publication leaves the draft standing and writes the dropped change to it", async () => {
    const rt = loadControl({ file: FILE });
    const editor = build(rt, {
        draft: true,
        answers: {
            "GET /api/drafts/f1": { data: { draft: true } },
            "PUT /api/forms/f1": { ok: false, status: 400, data: { validation: ["a tab needs a name"] } }
        }
    });

    await settle();

    editor.ctrl.addTab();
    const accepted = await editor.ctrl.publish();
    await settle();

    assert.ok(!accepted);
    assert.ok(editor.ctrl.draft, "the draft still stands");
    assert.equal(editor.state().getAttribute("data-wx-state"), "saved", "and the queued change reached it after all");
    assert.equal(editor.of("PUT", "/api/drafts/f1").length, 1);
    assert.deepEqual(editor.events.find((e) => e.type === "validation.failed").detail.validation, ["a tab needs a name"]);
});

test("discarding drops the draft and re-loads the form rather than the page", async () => {
    const rt = loadControl({ file: FILE });
    const editor = build(rt, { draft: true, answers: { "GET /api/drafts/f1": { data: { draft: true } } } });

    await settle();

    editor.ctrl.addTab();
    editor.ctrl.addTab();
    assert.equal(editor.ctrl.getStructure().tabs.length, 3, "the draft on screen has grown");

    const accepted = await editor.ctrl.discard();

    assert.ok(accepted);
    assert.equal(editor.of("DELETE", "/api/drafts/f1").length, 1, "the draft is dropped");
    assert.equal(editor.of("GET", "/api/forms/f1").length, 2, "and the form re-loaded");
    assert.equal(editor.ctrl.getStructure().tabs.length, 1, "which is what the forms in use see");
    assert.equal(editor.state().getAttribute("data-wx-state"), "idle");
    assert.equal(editor.discard().hidden, true);
    assert.ok(editor.events.some((e) => e.type === "draft.discarded"));

    await settle();

    assert.equal(editor.of("PUT", "/api/drafts/f1").length, 0, "the queued save did not land after the delete");
});

test("a discard the endpoint refused keeps the draft on screen", async () => {
    const rt = loadControl({ file: FILE });
    const editor = build(rt, {
        draft: true,
        answers: {
            "GET /api/drafts/f1": { data: { draft: true } },
            "DELETE /api/drafts/f1": { ok: false, status: 500 }
        }
    });

    await settle();

    const accepted = await editor.ctrl.discard();

    assert.ok(!accepted);
    assert.ok(editor.ctrl.draft);
    assert.equal(editor.state().getAttribute("data-wx-state"), "draft");
    assert.equal(editor.of("GET", "/api/forms/f1").length, 1, "nothing was re-loaded over the draft");
});

test("a read-only editor never drafts, whatever is declared", async () => {
    const rt = loadControl({ file: FILE });
    const editor = build(rt, { draft: true, readonly: true });

    await settle();

    assert.ok(!editor.ctrl.drafting);
    assert.equal(editor.of("GET", "/api/drafts/f1").length, 0, "the draft endpoint is not even asked");
    assert.equal(editor.publish(), null);
});

test("leaving the page flushes the queued write with a request that outlives it", async () => {
    const rt = loadControl({ file: FILE });
    const editor = build(rt, { draft: true });

    await settle();

    editor.ctrl.addTab();
    rt.sandbox.window.dispatchEvent({ type: "pagehide" });

    assert.equal(editor.of("PUT", "/api/drafts/f1").length, 1, "the write went out at once");
    assert.ok(editor.of("PUT", "/api/drafts/f1")[0].keepalive, "and survives the document");

    await settle();

    assert.equal(editor.of("PUT", "/api/drafts/f1").length, 1, "the debounced write was dropped, it had nothing left to write");
});

test("tearing down leaves nothing on the window, and a second teardown is harmless", async () => {
    const rt = loadControl({ file: FILE });
    const types = ["keydown", "pagehide", "beforeunload"];
    const before = Object.fromEntries(types.map((type) => [type, windowListenerCount(rt, type)]));
    const editor = build(rt, { draft: true });

    await settle();

    assert.equal(windowListenerCount(rt, "keydown"), before.keydown, "the tree keys are not listened for on the window");
    assert.equal(windowListenerCount(rt, "pagehide"), before.pagehide + 1);
    assert.equal(windowListenerCount(rt, "beforeunload"), before.beforeunload + 1);
    assert.equal(elementListenerCount(editor.body(), "keydown"), 1, "but on the body of the editor");

    editor.ctrl.destroy();
    editor.ctrl.destroy();

    for (const type of types) {
        assert.equal(windowListenerCount(rt, type), before[type], type);
    }
    assert.equal(elementListenerCount(editor.body(), "keydown"), 0);
});

test("a failed load offers a retry and leaves nothing an autosave could write", async () => {
    const rt = runtime();
    const editor = build(rt, { draft: true, answers: { "GET /api/forms/f1": { ok: false, status: 500 } } });

    await settle();

    assert.equal(editor.ctrl.phase, "error");
    assert.equal(editor.ctrl.getStructure(), null, "no stand-in structure was made up");
    assert.ok(!editor.events.some((e) => e.type === "loaded"), "and no load is announced");
    assert.equal(editor.of("GET", "/api/drafts/f1").length, 0, "nothing to resume a draft of");
    assert.equal(editor.tree(), null, "nothing to edit");
    assert.ok(editor.host.querySelector(".wx-form-editor-load-error"), "the failure is shown");
    assert.equal(editor.publish().disabled, true);

    editor.ctrl.addTab();
    editor.ctrl.addNode({ kind: "field", label: "Severity", type: "enum" });
    await settle();

    assert.equal(editor.of("PUT", "/api/forms/f1").length + editor.of("PUT", "/api/drafts/f1").length, 0, "nothing was written");

    editor.answers["GET /api/forms/f1"] = { data: published() };
    editor.host.querySelector(".wx-form-editor-retry").click();
    await settle();

    assert.equal(editor.ctrl.phase, "ready");
    assert.equal(editor.tabs(), 1, "the retry loaded the form");
    assert.equal(editor.events.filter((e) => e.type === "loaded").length, 1, "and only that is announced");
    assert.equal(editor.of("PUT", "/api/drafts/f1").length, 0, "loading is not a change");
});

test("a missing form and an answer without a definition are load errors, not new forms", async () => {
    const missing = build(runtime(), { answers: { "GET /api/forms/f1": { ok: false, status: 404 } } });
    const empty = build(runtime(), { answers: { "GET /api/forms/f1": { data: { catalog: [], data: null } } } });

    await settle();

    for (const editor of [missing, empty]) {
        assert.equal(editor.ctrl.phase, "error");
        assert.equal(editor.ctrl.getStructure(), null);
        editor.ctrl.addTab();
    }
    await settle();

    assert.match(missing.host.querySelector(".wx-form-editor-load-error").textContent, /does not exist/);
    assert.equal(empty.persistence().error.kind, "invalid");
    assert.equal(missing.of("PUT", "/api/forms/f1").length + empty.of("PUT", "/api/forms/f1").length, 0);
});

test("a new form asked for through the state is not loaded, and the first save creates it", async () => {
    const rt = runtime();
    const editor = build(rt, {
        state: { create: true, structure: { formName: "Incident", tabs: [] }, catalog: [{ id: "Title", label: "Title", type: "string" }] }
    });

    await settle();

    assert.equal(editor.of("GET", "/api/forms/f1").length, 0, "there is nothing to load");
    assert.equal(editor.ctrl.phase, "create");
    assert.equal(editor.ctrl.getStructure().formName, "Incident");
    assert.equal(editor.events.find((e) => e.type === "loaded").detail.phase, "create");

    editor.ctrl.addTab();
    await settle();

    assert.equal(editor.of("PUT", "/api/forms/f1").length, 1, "the first save creates the form");
    assert.equal(editor.ctrl.phase, "ready", "which then exists");
});

test("without any service the editor works offline and writes nothing", async () => {
    const rt = runtime();
    const editor = build(rt, { services: false });

    await settle();

    assert.equal(editor.ctrl.phase, "offline");
    assert.ok(editor.events.some((e) => e.type === "loaded"));

    editor.ctrl.addTab();
    await settle();

    assert.equal(editor.tabs(), 2, "it can be edited");
    assert.equal(editor.requests.length, 0, "and persists nothing");
    assert.match(editor.state().textContent, /Offline/);
});

/**
 * Tries every change the editor offers, through its methods and the handlers its
 * surface calls.
 * @param {object} ctrl - The editor.
 */
function tryEveryChange(ctrl) {
    ctrl.addTab();
    ctrl.addNode({ kind: "field", label: "Severity", type: "enum" });
    ctrl.removeNode("n1");
    ctrl.renameNode("n1", "Renamed");
    ctrl.renameNode("t1", "Renamed tab");
    ctrl._applyFormName("Renamed form");
    ctrl._applyFormDescription("Renamed description");
    ctrl._applyTabName("t1", "Renamed tab");
    ctrl._dragId = "n1";
    ctrl._dropState = { id: "n2", pos: "after" };
    ctrl._handleDrop({ preventDefault() { } }, { id: "n2" });
}

test("every change is refused while the publication runs, and allowed again when it failed", async () => {
    const rt = runtime();
    const held = gate();
    const editor = build(rt, {
        draft: true,
        answers: {
            "GET /api/forms/f1": { data: wide() },
            "GET /api/drafts/f1": { data: { draft: true } },
            "PUT /api/forms/f1": () => held.promise
        }
    });

    await settle();

    const before = JSON.stringify(editor.ctrl.getStructure());
    const publishing = editor.ctrl.publish();
    await settle();

    assert.equal(editor.ctrl.state, "publishing");
    assert.ok(editor.host.classList.contains("wx-form-editor--locked"));
    assert.equal(editor.host.querySelector(".wx-form-editor-quickadd"), null, "the surface offers no change");
    assert.equal(editor.host.querySelector(".wx-form-editor-tab-add"), null);
    assert.equal(editor.host.querySelector(".wx-form-editor-tree-actions"), null);
    assert.equal(editor.publish().disabled, true);
    assert.equal(editor.discard().disabled, true);

    tryEveryChange(editor.ctrl);
    assert.equal(await editor.ctrl.discard(), false, "nor can the draft be discarded meanwhile");

    assert.equal(JSON.stringify(editor.ctrl.getStructure()), before, "and the methods change nothing");
    assert.equal(editor.ctrl.dirty, false);

    held.resolve({ ok: false, status: 500 });
    assert.equal(await publishing, false);
    await settle();

    assert.equal(editor.of("PUT", "/api/drafts/f1").length, 0, "the refused changes were never queued");
    assert.ok(!editor.host.classList.contains("wx-form-editor--locked"), "the lock is lifted after the failure");
    assert.ok(editor.host.querySelector(".wx-form-editor-quickadd"));
    assert.equal(editor.persistence().error.kind, "server");

    editor.ctrl.addTab();
    assert.equal(editor.tabs(), 3, "and the editor can be changed again");
});

test("every change is refused while the draft is discarded", async () => {
    const rt = runtime();
    const held = gate();
    const editor = build(rt, {
        draft: true,
        answers: {
            "GET /api/forms/f1": { data: wide() },
            "GET /api/drafts/f1": { data: { draft: true } },
            "DELETE /api/drafts/f1": () => held.promise
        }
    });

    await settle();

    const before = JSON.stringify(editor.ctrl.getStructure());
    const discarding = editor.ctrl.discard();
    await settle();

    assert.equal(editor.ctrl.state, "discarding");
    assert.ok(editor.host.classList.contains("wx-form-editor--locked"));

    tryEveryChange(editor.ctrl);
    assert.equal(await editor.ctrl.publish(), false, "nor can it be published meanwhile");
    assert.equal(JSON.stringify(editor.ctrl.getStructure()), before);

    held.resolve({ ok: false, status: 500 });
    assert.equal(await discarding, false);

    assert.ok(!editor.host.classList.contains("wx-form-editor--locked"), "the lock is lifted after the failure");
    assert.equal(editor.ctrl.state, "draft");
});

test("a change made while a write is open stays unsaved and is written afterwards", async () => {
    const rt = runtime();
    const held = gate();
    const editor = build(rt, { answers: { "PUT /api/forms/f1": [() => held.promise, { data: { data: { version: 5 } } }] } });

    await settle();

    editor.ctrl.addTab();
    await settle();

    assert.equal(editor.of("PUT", "/api/forms/f1").length, 1);
    assert.equal(editor.ctrl.state, "saving");

    editor.ctrl.addTab();
    assert.equal(editor.ctrl.state, "pending", "the newer change is not covered by the open write");
    await settle();

    assert.equal(editor.of("PUT", "/api/forms/f1").length, 1, "one write at a time");

    held.resolve({ data: { data: { version: 4 } } });
    await settle();

    const puts = editor.of("PUT", "/api/forms/f1");
    const states = editor.events.filter((e) => e.type === "state").map((e) => e.detail.state);

    assert.equal(puts.length, 2, "the newer change followed");
    assert.equal(JSON.parse(puts[0].body).tabs.length, 2, "the first write kept the revision it took");
    assert.equal(JSON.parse(puts[1].body).tabs.length, 3, "the second carries everything since");
    assert.equal(JSON.parse(puts[1].body).version, 4, "on top of the version the first one answered");
    assert.ok(states.indexOf("saved") > states.lastIndexOf("saving"), "saved only after the last write answered");
    assert.equal(editor.ctrl.state, "saved");
    assert.equal(editor.ctrl.dirty, false);
});

test("a failed write keeps the changes and is repeated on request", async () => {
    const rt = runtime();
    const editor = build(rt, { draft: true, answers: { "PUT /api/drafts/f1": [{ ok: false, status: 503 }, { data: {} }] } });

    await settle();

    editor.ctrl.addTab();
    await settle();

    assert.equal(editor.ctrl.state, "error");
    assert.ok(editor.ctrl.dirty, "the change is still unsaved");
    assert.equal(editor.tabs(), 2, "and still on screen");
    assert.ok(editor.notice(), "the failure is explained");

    editor.action("retry").click();
    await settle();

    assert.equal(editor.of("PUT", "/api/drafts/f1").length, 2);
    assert.equal(JSON.parse(editor.of("PUT", "/api/drafts/f1")[1].body).tabs.length, 2);
    assert.equal(editor.ctrl.state, "saved");
    assert.equal(editor.ctrl.dirty, false);
    assert.equal(editor.notice(), null);
});

test("an unreachable server, a technical failure and a refused definition are told apart", async () => {
    const network = build(runtime(), { answers: { "PUT /api/forms/f1": { throws: true } } });
    const failure = build(runtime(), { answers: { "PUT /api/forms/f1": { ok: false, status: 500 } } });
    const refused = build(runtime(), {
        answers: {
            "GET /api/forms/f1": { data: wide() },
            "PUT /api/forms/f1": { ok: false, status: 400, data: { errors: { n2: "Severity needs a value list" } } }
        }
    });

    await settle();
    // a node rather than a tab, so the tree keeps showing the rows the answer names
    for (const editor of [network, failure, refused]) {
        editor.ctrl.addNode({ kind: "field", label: "Due", type: "timestamp" });
    }
    await settle();

    assert.equal(network.persistence().error.kind, "network");
    assert.match(network.notice().textContent, /not reachable/);
    assert.equal(failure.persistence().error.kind, "server");
    assert.match(failure.notice().textContent, /status 500/);
    assert.equal(refused.persistence().error.kind, "validation");
    assert.match(refused.notice().textContent, /Severity needs a value list/);

    const row = refused.host.querySelector(".wx-form-editor-tree-row[data-id=n2]");
    assert.ok(row.classList.contains("invalid"), "the message is put on the element it names");
    assert.equal(row.getAttribute("title"), "Severity needs a value list");
    assert.ok(refused.events.some((e) => e.type === "validation.failed"));
    assert.ok(!network.events.some((e) => e.type === "validation.failed"), "an outage is no validation failure");

    for (const editor of [network, failure, refused]) {
        assert.ok(editor.ctrl.dirty, "every one of them keeps the changes");
    }
});

test("a version conflict overwrites nothing until the user decides", async () => {
    const rt = runtime();
    const editor = build(rt, { answers: { "PUT /api/forms/f1": { ok: false, status: 409, data: { message: "changed", version: 7 } } } });

    await settle();

    editor.ctrl.addTab();
    await settle();

    assert.equal(editor.ctrl.state, "conflict");
    assert.ok(editor.ctrl.dirty, "the local changes are kept");
    assert.ok(editor.action("overwrite") && editor.action("discard-local"), "and both ways out are offered");

    editor.ctrl.addTab();
    await settle();

    assert.equal(editor.of("PUT", "/api/forms/f1").length, 1, "nothing is written while the conflict stands");
    assert.equal(editor.ctrl.state, "conflict");
    assert.equal(await editor.ctrl.publish(), false);

    editor.answers["PUT /api/forms/f1"] = { data: { data: { version: 8 } } };
    assert.ok(await editor.ctrl.resolveConflict("overwrite"));

    const last = JSON.parse(editor.of("PUT", "/api/forms/f1").at(-1).body);
    assert.equal(last.version, 7, "the local version is written on top of the one the server holds");
    assert.equal(last.tabs.length, 3);
    assert.equal(editor.ctrl.state, "saved");
    assert.equal(editor.ctrl.getStructure().version, 8);
});

test("a conflict resolved by reloading takes the server version and drops the local changes", async () => {
    const rt = runtime();
    const editor = build(rt, { answers: { "PUT /api/forms/f1": { ok: false, status: 409, data: { version: 7 } } } });

    await settle();

    editor.ctrl.addTab();
    await settle();

    const theirs = published();
    theirs.data.version = 7;
    theirs.data.formName = "Changed elsewhere";
    editor.answers["GET /api/forms/f1"] = { data: theirs };

    editor.action("discard-local").click();
    await settle();

    assert.equal(editor.ctrl.state, "idle");
    assert.equal(editor.ctrl.dirty, false);
    assert.equal(editor.ctrl.getStructure().formName, "Changed elsewhere");
    assert.equal(editor.tabs(), 1);
    assert.equal(editor.of("PUT", "/api/forms/f1").length, 1, "nothing more was written");
});

test("a discard whose re-load fails is no success, and the former draft is not saved again unnoticed", async () => {
    const rt = runtime();
    const editor = build(rt, {
        draft: true,
        answers: {
            "GET /api/forms/f1": [{ data: published() }, { ok: false, status: 500 }],
            "GET /api/drafts/f1": { data: { draft: true } }
        }
    });

    await settle();

    editor.ctrl.addTab();
    editor.ctrl.addTab();

    assert.equal(await editor.ctrl.discard(), false, "the discard is not reported as a success");
    assert.equal(editor.of("DELETE", "/api/drafts/f1").length, 1, "although the draft is gone");
    assert.equal(editor.ctrl.phase, "stale");
    assert.equal(editor.tabs(), 3, "the former draft is kept for recovery");
    assert.ok(!editor.ctrl.draft);
    assert.equal(editor.notice().className.includes("stale"), true, "and marked as no longer stored");
    assert.equal(editor.events.find((e) => e.type === "draft.discarded").detail.reloaded, false);
    assert.equal(editor.events.filter((e) => e.type === "loaded").length, 1, "nothing new was loaded");

    tryEveryChange(editor.ctrl);
    rt.sandbox.window.dispatchEvent({ type: "pagehide" });
    await settle();

    assert.equal(editor.of("PUT", "/api/drafts/f1").length, 0, "it is neither changed nor written");

    editor.action("restore").click();
    await settle();

    assert.equal(editor.of("PUT", "/api/drafts/f1").length, 1, "only the explicit restore writes it");
    assert.equal(JSON.parse(editor.of("PUT", "/api/drafts/f1")[0].body).tabs.length, 3);
    assert.equal(editor.ctrl.phase, "ready");
    assert.ok(editor.ctrl.draft);
});

test("leaving while a write is open waits for it, and the request that outlives the page counts once answered", async () => {
    const rt = runtime();
    const first = gate();
    const second = gate();
    const editor = build(rt, { draft: true, answers: { "PUT /api/drafts/f1": [() => first.promise, () => second.promise] } });

    await settle();

    editor.ctrl.addTab();
    await settle();
    editor.ctrl.addTab();

    rt.document.visibilityState = "hidden";
    rt.document.dispatchEvent({ type: "visibilitychange" });
    rt.sandbox.window.dispatchEvent({ type: "pagehide" });

    const unload = { type: "beforeunload", defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    rt.sandbox.window.dispatchEvent(unload);

    assert.equal(editor.of("PUT", "/api/drafts/f1").length, 1, "nothing overtakes the open write");
    assert.ok(unload.defaultPrevented, "the user is asked before the unsaved change is left behind");

    first.resolve({ data: {} });
    await settle();

    const puts = editor.of("PUT", "/api/drafts/f1");
    assert.equal(puts.length, 2, "the change follows as soon as the open write answered");
    assert.ok(puts[1].keepalive, "as a request that outlives the page");
    assert.equal(JSON.parse(puts[1].body).tabs.length, 3);
    assert.equal(editor.ctrl.state, "saving", "sent is not saved");
    assert.ok(editor.ctrl.dirty);

    second.resolve({ data: {} });
    await settle();

    assert.equal(editor.ctrl.state, "saved");
    assert.equal(editor.ctrl.dirty, false);
});

test("destroy writes a pending change after the open write and then stays silent", async () => {
    const rt = runtime();
    const held = gate();
    const editor = build(rt, { answers: { "PUT /api/forms/f1": [() => held.promise, { data: { data: { version: 10 } } }] } });

    await settle();

    editor.ctrl.addTab();
    await settle();
    editor.ctrl.addTab();

    const status = editor.state();
    const text = status.textContent;
    editor.ctrl.destroy();
    const events = editor.events.length;

    held.resolve({ data: { data: { version: 9 } } });
    await settle();

    const puts = editor.of("PUT", "/api/forms/f1");
    assert.equal(puts.length, 2, "the change pending at the teardown was not dropped");
    assert.equal(JSON.parse(puts[1].body).tabs.length, 3);
    assert.equal(JSON.parse(puts[1].body).version, 9, "and carries the version the open write answered");
    assert.equal(editor.events.length, events, "no event after the teardown");
    assert.equal(status.textContent, text, "and no update of the detached surface");
});

test("an answer arriving after destroy changes nothing", async () => {
    const rt = runtime();
    const held = gate();
    const editor = build(rt, { draft: true, answers: { "GET /api/forms/f1": () => held.promise } });

    await settle();
    editor.ctrl.destroy();

    held.resolve({ data: published() });
    await settle();

    assert.equal(editor.ctrl.phase, "loading", "the late answer was not taken over");
    assert.equal(editor.ctrl.getStructure(), null);
    assert.equal(editor.tree(), null);
    assert.ok(!editor.events.some((e) => e.type === "loaded"));
    assert.equal(editor.of("GET", "/api/drafts/f1").length, 0);
});

test("two editors on one page each answer only the keys of their own focused tree", async () => {
    const rt = runtime();
    const shared = server(rt, { "GET /api/forms/f1": { data: wide() } });
    const a = build(rt, { server: shared });
    const b = build(rt, { server: shared });

    await settle();

    a.host.querySelector(".wx-form-editor-tree-row[data-id=n1]").click();
    b.host.querySelector(".wx-form-editor-tree-row[data-id=n1]").click();

    assert.equal(windowListenerCount(rt, "keydown"), 0, "no editor listens on the window");
    assert.notEqual(a.host.querySelector(".wx-form-editor-split").id, b.host.querySelector(".wx-form-editor-split").id);

    a.body().dispatchEvent(keyEvent("Delete", { target: a.tree() }));

    assert.equal(a.ctrl.getStructure().tabs[0].children.length, 2, "the focused editor deleted its selection");
    assert.equal(b.ctrl.getStructure().tabs[0].children.length, 3, "the other one did not");

    a.body().dispatchEvent(keyEvent("Delete", { target: b.tree() }));
    assert.equal(b.ctrl.getStructure().tabs[0].children.length, 3, "a key of the other tree is not taken up");

    b.body().dispatchEvent(keyEvent("ArrowDown", { target: b.tree() }));
    assert.equal(b.ctrl.store.getState().ui.selectedId, "n2", "the other editor navigates its own tree");

    b.body().dispatchEvent(keyEvent("F2", { target: b.tree() }));
    const input = b.host.querySelector(".wx-form-editor-tree-input");
    assert.ok(input, "F2 opens the rename");
    // the stub input has no text selection, which the rename asks for once it is attached
    input.select = () => { };

    b.body().dispatchEvent(keyEvent("Delete", { target: input }));
    assert.equal(b.ctrl.getStructure().tabs[0].children.length, 3, "a field keeps its own keys");

    const quick = b.host.querySelector(".wx-form-editor-quickadd-input");
    b.body().dispatchEvent(keyEvent("Backspace", { target: quick }));
    assert.equal(b.ctrl.getStructure().tabs[0].children.length, 3);
});

test("the initial state is read from the state island before the host is cleared", async () => {
    const rt = runtime();
    const editor = build(rt, {
        answers: { "GET /api/forms/f1": { data: wide() } },
        state: { activeTab: "t1", collapsed: ["g1"], preview: false }
    });

    await settle();

    const ui = editor.ctrl.store.getState().ui;
    assert.equal(ui.activeTabId, "t1");
    assert.deepEqual(JSON.parse(JSON.stringify(ui.collapsed)), ["g1"]);
    assert.equal(editor.ctrl.preview, false);
    assert.equal(editor.host.querySelector(".wx-form-editor-split"), null, "the preview is off");
    assert.equal(editor.host.querySelector(".wx-form-editor-tree-row[data-id=n3]"), null, "the collapsed group hides its child");
    assert.equal(editor.host.querySelector("wx-state"), null);

    const definition = editor.ctrl.store.getState().definition;
    assert.equal(definition.tabs.length, 2, "the definition, the surface and the persistence are kept apart");
    assert.equal(editor.persistence().phase, "ready");
});

test("bound to a ViewState, the editor renders the slice, writes through its service and keeps unsaved work", async () => {
    const rt = runtime();
    const { requests, answers } = server(rt);
    rt.wxapp.RestFormEditorCtrl.SAVE_DEBOUNCE = 5;

    const vsHost = rt.createElement("div");
    vsHost.id = "designer";
    vsHost.dataset.wxViewstate = "designer";
    appendServiceIsland(rt.document, vsHost, { name: "data", baseUri: "/api/forms/f1", method: "GET", updateMethod: "PUT" });
    appendResourceIsland(rt.document, vsHost, { name: "form", service: "data", target: "form" });
    rt.document.body.appendChild(vsHost);
    const vs = new rt.wxapp.ViewState(vsHost);

    const host = rt.createElement("div");
    host.classList.add(SELECTOR);
    host.setAttribute("data-wx-resource", "form");
    vsHost.appendChild(host);
    rt.wx.Controller.createInstances(host);
    const ctrl = rt.wx.Controller.getInstanceByElement(host);

    await settle();
    vs.flush();

    assert.equal(requests.filter((r) => r.method === "GET").length, 1, "the ViewState owns the single load");
    assert.equal(ctrl.phase, "ready");
    assert.equal(ctrl.getStructure().formName, "Bug");

    const held = gate();
    answers["PUT /api/forms/f1"] = [() => held.promise, { data: { data: { version: 5 } } }];

    ctrl.addTab();
    await settle();

    assert.equal(requests.filter((r) => r.method === "PUT").length, 1, "the write goes through the ViewState's service");

    const theirs = published();
    theirs.data.formName = "Refreshed";
    answers["GET /api/forms/f1"] = { data: theirs };
    await vs.reload("form");
    vs.flush();
    await settle();

    assert.equal(ctrl.getStructure().formName, "Bug", "a refresh does not replace the unsaved change");
    assert.equal(ctrl.getStructure().tabs.length, 2);

    held.resolve({ data: { data: { version: 4 } } });
    await settle();

    assert.equal(ctrl.state, "saved");
    assert.equal(ctrl.getStructure().formName, "Bug", "the held-back refresh predates the write and is dropped");
    assert.equal(ctrl.getStructure().tabs.length, 2);

    const later = published();
    later.data.version = 5;
    later.data.formName = "Changed elsewhere";
    answers["GET /api/forms/f1"] = { data: later };
    await vs.reload("form");
    vs.flush();
    await settle();

    assert.equal(ctrl.getStructure().formName, "Changed elsewhere", "a newer version is taken over once nothing is unsaved");
});

test("a refresh held back during a write is taken over afterwards when it is newer", async () => {
    const rt = runtime();
    const { requests, answers } = server(rt);
    rt.wxapp.RestFormEditorCtrl.SAVE_DEBOUNCE = 5;

    const vsHost = rt.createElement("div");
    vsHost.dataset.wxViewstate = "designer";
    appendServiceIsland(rt.document, vsHost, { name: "data", baseUri: "/api/forms/f1", method: "GET", updateMethod: "PUT" });
    appendResourceIsland(rt.document, vsHost, { name: "form", service: "data", target: "form" });
    rt.document.body.appendChild(vsHost);
    const vs = new rt.wxapp.ViewState(vsHost);

    const host = rt.createElement("div");
    host.classList.add(SELECTOR);
    host.setAttribute("data-wx-resource", "form");
    vsHost.appendChild(host);
    rt.wx.Controller.createInstances(host);
    const ctrl = rt.wx.Controller.getInstanceByElement(host);

    await settle();
    vs.flush();

    const held = gate();
    answers["PUT /api/forms/f1"] = () => held.promise;
    ctrl.addNode({ kind: "field", label: "Severity", type: "enum" });
    await settle();

    // someone else saved twice on top of the write the editor is waiting for
    const theirs = published();
    theirs.data.version = 6;
    theirs.data.formName = "Theirs";
    answers["GET /api/forms/f1"] = { data: theirs };
    await vs.reload("form");
    vs.flush();
    await settle();

    assert.equal(ctrl.getStructure().formName, "Bug", "nothing is replaced while the write is open");

    held.resolve({ data: { data: { version: 4 } } });
    await settle();

    assert.equal(requests.filter((r) => r.method === "PUT").length, 1);
    assert.equal(ctrl.getStructure().formName, "Theirs", "the newer refresh follows once everything is confirmed");
    assert.equal(ctrl.getStructure().version, 6);
});

test("a draft save presents the draft revision, and a draft conflict is resolved on top of the stored one", async () => {
    const rt = runtime();
    const editor = build(rt, {
        draft: true,
        answers: {
            "GET /api/drafts/f1": { data: { draft: true, revision: 2 } },
            "PUT /api/drafts/f1": [{ data: { draft: true, revision: 3 } }, { ok: false, status: 409, data: { message: "changed", revision: 7 } }, { data: { revision: 8 } }]
        }
    });

    await settle();

    editor.ctrl.addTab();
    await settle();
    editor.ctrl.addTab();
    await settle();

    const puts = editor.of("PUT", "/api/drafts/f1");
    assert.equal(JSON.parse(puts[0].body).draftRevision, 2, "the first save presents the revision the draft endpoint answered");
    assert.equal(JSON.parse(puts[1].body).draftRevision, 3, "the next one the revision the first save answered");
    assert.equal(editor.ctrl.state, "conflict", "another editor's draft save is not overwritten");

    assert.ok(await editor.ctrl.resolveConflict("overwrite"));

    const last = JSON.parse(editor.of("PUT", "/api/drafts/f1").at(-1).body);
    assert.equal(last.draftRevision, 7, "the decision to keep the local draft writes on top of the stored revision");
    assert.equal(last.tabs.length, 3);
    assert.equal(editor.persistence().draftRevision, 8);
    assert.equal(editor.of("PUT", "/api/forms/f1").length, 0, "and still nothing is published");
});

test("changes the server had not confirmed when the page went away are offered on the next load", async () => {
    const rt = runtime();
    const KEY = "wx-form-editor:recovery:/api/drafts/f1";
    const first = build(rt, { draft: true, answers: { "PUT /api/drafts/f1": () => new Promise(() => { }) } });

    await settle();

    first.ctrl.addTab();
    await settle();
    rt.sandbox.window.dispatchEvent({ type: "pagehide" });

    const kept = JSON.parse(rt.sandbox.localStorage.getItem(KEY));
    assert.equal(kept.definition.tabs.length, 2, "the browser keeps the change the open write may not deliver");

    // the next visit: the write never arrived, the server still has one tab
    const second = build(rt, { draft: true });
    await settle();

    assert.ok(second.notice().className.includes("recovery"), "the kept changes are offered");
    assert.equal(second.tabs(), 1, "but not taken over on their own");
    assert.equal(second.of("PUT", "/api/drafts/f1").length, 0);

    second.action("recover").click();
    await settle();

    assert.equal(second.of("PUT", "/api/drafts/f1").length, 1, "restoring writes them");
    assert.equal(JSON.parse(second.of("PUT", "/api/drafts/f1")[0].body).tabs.length, 2);
    assert.equal(second.ctrl.state, "saved");
    assert.equal(rt.sandbox.localStorage.getItem(KEY), null, "and the copy is dropped once the server confirmed them");
});

test("a kept copy the server already holds is dropped silently, and one the user dismisses is gone", async () => {
    const rt = runtime();
    const KEY = "wx-form-editor:recovery:/api/forms/f1";

    rt.sandbox.localStorage.setItem(KEY, JSON.stringify({ definition: published().data, version: 3, savedAt: Date.now() }));
    const same = build(rt);
    await settle();

    assert.equal(same.notice(), null, "the write arrived after all");
    assert.equal(rt.sandbox.localStorage.getItem(KEY), null);

    const other = published().data;
    other.formName = "Kept";
    rt.sandbox.localStorage.setItem(KEY, JSON.stringify({ definition: other, version: 2, savedAt: Date.now() }));
    const changed = build(rt);
    await settle();

    assert.match(changed.notice().textContent, /changed since/, "a copy older than the stored form says so");
    changed.action("dismiss-recovery").click();

    assert.equal(changed.notice(), null);
    assert.equal(rt.sandbox.localStorage.getItem(KEY), null);
    assert.equal(changed.ctrl.getStructure().formName, "Bug");
});

test("a kept copy survives a failed load and is offered once the retry succeeds", async () => {
    const rt = runtime();
    const KEY = "wx-form-editor:recovery:/api/forms/f1";
    const other = published().data;
    other.formName = "Kept";
    rt.sandbox.localStorage.setItem(KEY, JSON.stringify({ definition: other, version: 3, savedAt: Date.now() }));

    const editor = build(rt, { answers: { "GET /api/forms/f1": [{ ok: false, status: 503 }, { data: published() }] } });
    await settle();

    assert.equal(editor.ctrl.phase, "error");
    assert.ok(rt.sandbox.localStorage.getItem(KEY), "a failed load drops nothing");

    editor.host.querySelector(".wx-form-editor-retry").click();
    await settle();

    assert.equal(editor.ctrl.phase, "ready");
    assert.ok(editor.notice().className.includes("recovery"), "the copy is offered after the retry");
});

test("a change destroy() could not write is kept for the next load", async () => {
    const rt = runtime();
    const KEY = "wx-form-editor:recovery:/api/forms/f1";
    const held = gate();
    const editor = build(rt, { answers: { "PUT /api/forms/f1": [() => held.promise, { ok: false, status: 503 }] } });

    await settle();

    editor.ctrl.addTab();
    await settle();
    editor.ctrl.addTab();
    editor.ctrl.destroy();

    held.resolve({ data: { data: { version: 4 } } });
    await settle();

    assert.equal(editor.of("PUT", "/api/forms/f1").length, 2, "the teardown tried");
    const kept = JSON.parse(rt.sandbox.localStorage.getItem(KEY));
    assert.equal(kept.definition.tabs.length, 3, "and the change it could not deliver stays in the browser");
});

test("a body over the keepalive budget leaves as an ordinary request instead of failing", async () => {
    const rt = runtime();
    const editor = build(rt, { draft: true });

    await settle();

    editor.ctrl.addNode({ kind: "field", label: "Notes", type: "text", help: "x".repeat(70000) });
    rt.sandbox.window.dispatchEvent({ type: "pagehide" });
    await settle();

    const puts = editor.of("PUT", "/api/drafts/f1");
    assert.equal(puts.length, 1);
    assert.equal(puts[0].keepalive, false, "a keepalive request of this size would be refused");
    assert.equal(editor.ctrl.state, "saved");
});
