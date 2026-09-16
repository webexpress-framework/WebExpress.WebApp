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
 * Run with Node 18 or newer from the JsTest folder:
 *   node --test
 */
import { test } from "node:test";
import assert from "node:assert";
import { contract } from "./controls.contract.mjs";
import { loadControl, windowListenerCount } from "./controls.harness.mjs";

const FILE = "webexpress.webapp.restform.editor.js";
const SELECTOR = "wx-webapp-restform-editor";

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
 * Builds an editor host carrying the data service island and, when asked, the draft one,
 * with a fetch that logs every request and answers per url and method.
 * @param {object} rt - The loaded runtime.
 * @param {object} [options] - draft: whether to declare the draft service; answers: keyed
 * "METHOD /url" -> { ok, status, data }; readonly: whether the host is read-only.
 * @returns {object} The host, the controller, the request log and the footer parts.
 */
function build(rt, options = {}) {
    const requests = [];
    const answers = Object.assign({
        "GET /api/forms/f1": { data: published() },
        "PUT /api/forms/f1": { data: { data: { version: 4 } } },
        "GET /api/drafts/f1": { data: { draft: false } },
        "PUT /api/drafts/f1": { data: {} },
        "DELETE /api/drafts/f1": { status: 204 }
    }, options.answers || {});

    rt.setFetch(async (url, init) => {
        const method = (init && init.method) || "GET";
        requests.push({ url: String(url), method, body: init && init.body, keepalive: !!(init && init.keepalive) });

        const answer = answers[method + " " + String(url)] || {};

        return {
            ok: answer.ok !== false,
            status: answer.status || 200,
            headers: { get: () => "application/json" },
            // parsed afresh per answer, as a real response is: the editor mutates what it
            // loaded in place, and a shared object would carry the draft into the re-load
            json: async () => JSON.parse(JSON.stringify(answer.data || {})),
            text: async () => ""
        };
    });

    // the debounce is what the tests wait on, so it is shortened rather than waited out
    rt.wxapp.RestFormEditorCtrl.SAVE_DEBOUNCE = 5;

    const host = rt.createElement("div");
    host.classList.add(SELECTOR);
    if (options.readonly) {
        host.dataset.readonly = "true";
    }

    const data = rt.createElement("wx-service");
    data.setAttribute("name", "data");
    data.setAttribute("kind", "rest");
    data.setAttribute("base-uri", "/api/forms/f1");
    host.appendChild(data);

    if (options.draft) {
        const draft = rt.createElement("wx-service");
        draft.setAttribute("name", "draft");
        draft.setAttribute("kind", "rest");
        draft.setAttribute("base-uri", "/api/drafts/f1");
        draft.setAttribute("method", "GET");
        draft.setAttribute("update-method", "PUT");
        host.appendChild(draft);
    }

    rt.document.body.appendChild(host);
    rt.wx.Controller.createInstances(host);

    const events = [];
    for (const type of ["saved", "draft.saved", "draft.discarded", "published", "state", "validation.failed"]) {
        host.addEventListener("webexpress.webapp.formeditor." + type, (e) => events.push({ type, detail: e.detail }));
    }

    return {
        host,
        requests,
        events,
        ctrl: rt.wx.Controller.getInstanceByElement(host),
        state: () => host.querySelector(".wx-form-editor-foot-status"),
        publish: () => host.querySelector(".wx-form-editor-publish"),
        discard: () => host.querySelector(".wx-form-editor-discard"),
        of: (method, url) => requests.filter((r) => r.method === method && r.url === url)
    };
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

test("tearing down leaves nothing on the window", async () => {
    const rt = loadControl({ file: FILE });
    const before = { keydown: windowListenerCount(rt, "keydown"), pagehide: windowListenerCount(rt, "pagehide") };
    const editor = build(rt, { draft: true });

    await settle();

    assert.equal(windowListenerCount(rt, "keydown"), before.keydown + 1);
    assert.equal(windowListenerCount(rt, "pagehide"), before.pagehide + 1);

    editor.ctrl.destroy();

    assert.equal(windowListenerCount(rt, "keydown"), before.keydown);
    assert.equal(windowListenerCount(rt, "pagehide"), before.pagehide);
});
