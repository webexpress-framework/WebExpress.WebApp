/**
 * Headless tests for the ModalSpreadsheetCtrl control (wx-webapp-modal-spreadsheet).
 *
 * The shared contract (controls.contract.mjs) verifies the registration and the construct /
 * teardown lifecycle. Drafting, publishing, sharing and the bar are the document dialog's and are
 * tested in control.modal-editor.test.mjs; what is tested here is what a workbook changes: the
 * value the reading view is filled with is the spreadsheet's, the reading view is a read-only
 * spreadsheet in the language of the surface, and its own change never reaches the form as an
 * edit - which would draft a workbook nobody touched.
 *
 * Run with Node 18 or newer from the JsTest folder:
 *   node --test
 */
import { test } from "node:test";
import assert from "node:assert";
import { contract } from "./controls.contract.mjs";
import { loadControl } from "./controls.harness.mjs";

const FILE = "webexpress.webapp.modal.spreadsheet.js";
const DEPS = ["webexpress.webapp.modal.editor.js"];
const SELECTOR = "wx-webapp-modal-spreadsheet";

contract({
    file: FILE,
    deps: DEPS,
    selector: SELECTOR,
    ctrl: "ModalSpreadsheetCtrl"
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
 * Fires an event on a target of the stub, which does not bubble - so the event is dispatched
 * where the controller listens.
 * @param {object} target - The stub element.
 * @param {string} type - The event type.
 * @param {object} [extra] - Additional event fields.
 */
function fire(target, type, extra = {}) {
    target.dispatchEvent(Object.assign({ type, target, preventDefault() { this.defaultPrevented = true; } }, extra));
}

/**
 * Builds the surface the control renders: a form with the draft island and the dialog, whose
 * content box holds the spreadsheet the author works in. The spreadsheet of the surface and the
 * one of the reading view are stood in for through the hook and the registry a page uses,
 * because what the dialog has to prove is what it reads from the one and writes into the other.
 * @param {object} rt - The loaded runtime.
 * @param {object} [options] - values: the payload the form serializes; locale: the language of
 *   the surface; workbook: what the surface holds.
 * @returns {object} The surface parts and the request log.
 */
function build(rt, options = {}) {
    const requests = [];
    const previews = [];
    let workbook = options.workbook ?? "{\"sheets\":[{\"name\":\"Plan\"}]}";

    rt.setFetch(async (url, init) => {
        const method = (init && init.method) || "GET";
        requests.push({ method, body: init && init.body });
        return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({ draft: false }), text: async () => "" };
    });

    rt.wx.Controller.registerClass("wx-webui-spreadsheet", class {
        constructor(element) {
            this._element = element;
            this.written = [];
            previews.push(this);
        }
        set value(value) { this.written.push(value); }
    });

    const form = rt.createElement("form");
    const island = rt.createElement("wx-service");
    island.setAttribute("name", "draft");
    island.setAttribute("kind", "rest");
    island.setAttribute("base-uri", "/api/drafts");
    island.setAttribute("method", "GET");
    island.setAttribute("update-method", "PUT");
    form.appendChild(island);

    const dialog = rt.createElement("dialog");
    dialog.id = "sheet";
    dialog.classList.add(SELECTOR);
    dialog.setAttribute("data-wx-debounce", "5");
    dialog.setAttribute("data-wx-max-delay", "40");
    dialog.setAttribute("data-wx-preview", "true");

    const header = rt.createElement("div");
    header.classList.add("wx-modal-header");

    const box = rt.createElement("div");
    box.classList.add("wx-modal-content", "wx-editor-form-content");
    const main = rt.createElement("main");
    const spreadsheet = rt.createElement("div");
    spreadsheet.classList.add("wx-spreadsheet");
    spreadsheet.setAttribute("data-fill", "true");

    if (options.locale) {
        spreadsheet.setAttribute("data-locale", options.locale);
    }

    spreadsheet._wx_controller = { get value() { return workbook; } };
    main.appendChild(spreadsheet);
    box.appendChild(main);

    const bar = rt.createElement("div");
    bar.classList.add("wx-modal-footer", "wx-editor-form-footer");
    const menu = rt.createElement("div");
    menu.id = "sheet_menu";
    menu.classList.add("wx-editor-form-menu", "wx-editor-form-menu-empty");
    bar.appendChild(menu);
    bar.appendChild(rt.createElement("button"));

    dialog.appendChild(header);
    dialog.appendChild(box);
    dialog.appendChild(bar);
    form.appendChild(dialog);
    rt.document.body.appendChild(form);

    form._wx_controller = {
        serialize: () => options.values ? options.values() : { Title: "t", Body: workbook },
        load: () => { }
    };

    rt.wx.Controller.createInstances(dialog);

    const slot = bar.querySelector(".wx-editor-form-switch");

    return {
        form,
        dialog,
        box,
        requests,
        previews,
        surface: box.children[0],
        preview: box.querySelector(".wx-editor-form-preview"),
        state: bar.querySelector(".wx-editor-form-state"),
        ctrl: rt.wx.Controller.instanceMap.get(dialog),
        writes: () => requests.filter((r) => r.method === "PUT"),
        enter: (value) => { workbook = value; },
        pick: (name) => slot.children[0].dispatchEvent({ type: "click", target: slot.querySelector(`[data-view-tab="${name}"]`) })
    };
}

test("the reading view is a read-only spreadsheet without editing chrome, in the language of the surface", () => {
    const rt = loadControl({ deps: DEPS, file: FILE });
    const surface = build(rt, { locale: "de" });

    assert.ok(surface.ctrl instanceof rt.wxapp.ModalEditorCtrl, "the dialog is a document dialog");
    assert.equal(surface.previews.length, 1, "the reading view went through the registry");
    assert.equal(surface.preview.parentNode, surface.box, "beside the surface");
    assert.ok(surface.preview.hasAttribute("hidden"), "out of sight");
    assert.deepEqual(
        ["data-readonly", "data-toolbar", "data-formula-bar", "data-fill", "data-locale"].map((name) => surface.preview.getAttribute(name)),
        ["true", "false", "false", "true", "de"]
    );
});

test("picking the preview fills the reading view with the workbook of the surface", () => {
    const rt = loadControl({ deps: DEPS, file: FILE });
    const surface = build(rt, { workbook: "{\"sheets\":[{\"name\":\"Q1\"}]}" });

    surface.pick("preview");

    assert.deepEqual(surface.previews[0].written, ["{\"sheets\":[{\"name\":\"Q1\"}]}"], "the view holds what the surface holds");
    assert.ok(!surface.preview.hasAttribute("hidden"));
    assert.ok(surface.surface.hasAttribute("hidden"), "and stands in for the surface");

    surface.enter("{\"sheets\":[{\"name\":\"Q2\"}]}");
    fire(surface.form, rt.wx.Event.CHANGE_VALUE_EVENT);

    assert.equal(surface.previews[0].written.at(-1), "{\"sheets\":[{\"name\":\"Q2\"}]}", "a showing view follows the workbook");
});

test("the surface is found past the reading view, which is a spreadsheet too", () => {
    const rt = loadControl({ deps: DEPS, file: FILE });
    const surface = build(rt);

    // the reading view is a spreadsheet host as well once its control ran
    surface.preview.classList.add("wx-spreadsheet");
    surface.surface.parentNode.insertBefore(surface.preview, surface.surface);

    surface.pick("preview");

    assert.deepEqual(surface.previews[0].written, ["{\"sheets\":[{\"name\":\"Plan\"}]}"], "not the reading view's own value");
});

test("a change of the reading view stays inside it and is never drafted", () => {
    const rt = loadControl({ deps: DEPS, file: FILE });
    const surface = build(rt);
    let stopped = false;

    fire(surface.preview, rt.wx.Event.CHANGE_VALUE_EVENT, { stopPropagation() { stopped = true; } });

    assert.ok(stopped, "the change event of the view does not bubble to the form");
});

test("an edit in the workbook is drafted with the payload the publish would send", async () => {
    const rt = loadControl({ deps: DEPS, file: FILE });
    const surface = build(rt, { values: () => ({ Title: "Budget", Body: "{\"sheets\":[]}" }) });

    await settle();

    fire(surface.form, "keydown");
    fire(surface.form, rt.wx.Event.CHANGE_VALUE_EVENT);
    await settle();

    const writes = surface.writes();

    assert.equal(writes.length, 1);
    assert.deepEqual(JSON.parse(writes[0].body), { Title: "Budget", Body: "{\"sheets\":[]}" });
    assert.equal(surface.state.getAttribute("data-wx-state"), "saved");
});
