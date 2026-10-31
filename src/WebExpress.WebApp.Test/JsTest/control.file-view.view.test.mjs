/**
 * Headless tests for the view of the FileViewCtrl control (wx-webapp-file-view): the
 * control renders on the Data base, its cards and their inline editors keep their
 * nodes across renders, and inside a ViewState the query state belongs to the
 * ViewState while the view state stays the control's own.
 */
import { test } from "node:test";
import assert from "node:assert";
import { loadControl } from "./controls.harness.mjs";

/**
 * Builds a file view of statically rendered files with the list and the tile board.
 * @param {object} [options={}] - editable, a resource name, a ViewState to live in.
 * @returns {object} The runtime, the host and the control.
 */
function view(options = {}) {
    const rt = options.rt || loadControl({
        deps: ["i18n/en.js", "webexpress.webapp.file.view.model.js"],
        file: "webexpress.webapp.file.view.js"
    });
    const element = rt.createElement("div");
    element.id = "files";
    element.dataset.views = "list,tile";
    if (options.editable) {
        element.dataset.editableDescription = "true";
    }
    if (options.resource) {
        element.dataset.wxResource = options.resource;
    }
    (options.parent || rt.document.body).appendChild(element);
    const ctrl = new rt.wxapp.FileViewCtrl(element);
    ctrl.files = [
        { id: "1", name: "Timetable.pdf", description: "the current plan", versions: [{ version: 1, date: "14.03.2026" }] },
        { id: "2", name: "Guidelines.txt", description: "" }
    ];
    ctrl._store.flush();
    return { rt, element, ctrl };
}

const card = (element, name) => element.querySelectorAll(".wx-file-view-card").find((c) => c.dataset.fileName === name);

test("the file view renders on the Data base and describes itself without touching the DOM", () => {
    const { rt, element, ctrl } = view();
    const before = element.childNodes.slice();

    const tree = ctrl.render(Object.assign({}, ctrl.state, { files: [] }));

    assert.ok(ctrl instanceof rt.wxapp.Data);
    assert.ok(ctrl instanceof rt.wx.StateCtrl);
    assert.equal(element.childNodes.length, before.length);
    assert.ok(element.childNodes.every((node, i) => node === before[i]));
    assert.deepEqual(Array.from(tree, (node) => node.key), ["toolbar", "progress", "body", "status"]);
});

test("a card keeps its node across a reload, and so does its inline editor while the description stays", () => {
    const { element, ctrl } = view({ editable: true });
    const map = card(element, "Timetable.pdf");
    const editor = map.querySelector(".wx-file-view-description");

    // a reload delivers new file objects with the same content
    ctrl.files = ctrl.files.map((file) => Object.assign({}, file));
    ctrl._store.flush();
    assert.equal(card(element, "Timetable.pdf"), map, "the card is patched, not rebuilt");
    assert.equal(map.querySelector(".wx-file-view-description"), editor, "the editor is not rebuilt under the hands of the user");

    ctrl.files = ctrl.files.map((file) => file.name === "Timetable.pdf" ? Object.assign({}, file, { description: "updated plan" }) : file);
    ctrl._store.flush();
    assert.notEqual(map.querySelector(".wx-file-view-description"), editor, "a changed description is shown anew");
});

test("the versions of a card unfold from the state and stay unfolded across a reload", () => {
    const { element, ctrl } = view();
    const toggle = card(element, "Timetable.pdf").querySelector(".wx-file-view-card-versions");

    toggle.dispatchEvent({ type: "click", preventDefault() { } });
    ctrl._store.flush();
    assert.equal(toggle.getAttribute("aria-expanded"), "true");
    assert.deepEqual(Array.from(ctrl.state.expanded), ["Timetable.pdf"]);

    ctrl.files = ctrl.files.map((file) => Object.assign({}, file));
    ctrl._store.flush();
    assert.equal(card(element, "Timetable.pdf").querySelector(".wx-file-view-card-version-list").style.display, "");
});

test("a switch of the presentation is rendered before it is announced", () => {
    const { rt, element, ctrl } = view();
    const seen = [];
    element.addEventListener(rt.wx.Event.CHANGE_VISIBILITY_EVENT, (event) => {
        const pane = element.querySelectorAll(".wx-file-view-pane").find((p) => p.dataset.view === event.detail.view);
        seen.push(pane.style.display);
    });

    ctrl._activate("tile");

    assert.deepEqual(seen, [""], "a listener finds the pane it is told about shown");
});

test("inside a ViewState the query goes to the ViewState and the view state stays the control's", () => {
    const rt = loadControl({
        deps: ["i18n/en.js", "webexpress.webapp.file.view.model.js"],
        file: "webexpress.webapp.file.view.js"
    });
    const host = rt.createElement("div");
    host.dataset.wxViewstate = "documents";
    rt.document.body.appendChild(host);
    const viewState = new rt.wxapp.ViewState(host, {
        services: { data: { query: async () => ({ ok: true, data: { items: [] } }), abort() { } } },
        resources: { files: { name: "files", service: "data", target: "files", auto: false, params: [] } }
    });
    let reloads = 0;
    viewState.reload = () => { reloads += 1; return Promise.resolve(); };

    const { ctrl } = view({ rt, resource: "files", parent: host });
    ctrl._activate("tile");
    ctrl.search("report");

    assert.equal(ctrl.store, viewState, "binds and intents address the ViewState");
    assert.equal(viewState.getState().search, "report", "the central query reads the search from there");
    assert.ok(reloads >= 1, "and the ViewState re-queries");
    for (const key of ["files", "activePane", "expanded"]) {
        assert.equal(key in viewState.getState(), false, `the ViewState holds no ${key} of the control`);
    }
    assert.equal(ctrl.state.activePane, "tile");
});
