/**
 * Headless tests for the comment composer control after it was lifted onto the
 * Data base (View, State and Service). The composer keeps its imperative form
 * flow; the lift gives it the service map - a configured island service is
 * preferred over the legacy descriptor - and the Data lifecycle teardown that
 * aborts the service. The categories are preset so the constructor performs no
 * load.
 *
 * Run with Node 18 or newer from the jstest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, webappAsset, appendServiceIsland } from "./harness.mjs";

function load(options) {
    return loadEngine(Object.assign(
        {
            extraFiles: [
                webappAsset("webexpress.webapp.comment.composer.model.js"),
                webappAsset("webexpress.webapp.comment.composer.js")
            ]
        },
        options
    ));
}

const PRESET_CATEGORIES = JSON.stringify([{ id: "general", i18n: "", color: "#000", bg: "#fff" }]);

test("comment composer extends the data base and resolves its service", () => {
    const { wxapp, createElement, setFetch, document } = load();
    setFetch(async () => ({ ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({}) }));

    const element = createElement("div");
    appendServiceIsland(document, element, { name: "data", kind: "rest", baseUri: "/api/comments/INC-1", method: "GET", updateMethod: "PUT" });
    element.dataset.categories = PRESET_CATEGORIES;

    const ctrl = new wxapp.CommentComposerCtrl(element);

    assert.ok(ctrl instanceof wxapp.Data);
    assert.equal(typeof ctrl.store, "object");
    assert.ok(ctrl.useService("data"));
});

test("comment composer destroy tears down without throwing", () => {
    const { wxapp, createElement, setFetch, document } = load();
    setFetch(async () => ({ ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({}) }));

    const element = createElement("div");
    appendServiceIsland(document, element, { name: "data", kind: "rest", baseUri: "/api/comments/INC-1", method: "GET", updateMethod: "PUT" });
    element.dataset.categories = PRESET_CATEGORIES;

    const ctrl = new wxapp.CommentComposerCtrl(element);

    assert.doesNotThrow(() => ctrl.destroy());
});

test("comment composer hands its upload, image and link services to the editor's dialogs", () => {
    const { wxapp, createElement, setFetch, document } = load();
    setFetch(async () => ({ ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({}) }));

    const element = createElement("div");
    appendServiceIsland(document, element, { name: "data", kind: "rest", baseUri: "/api/comments/INC-1", method: "GET", updateMethod: "PUT" });
    appendServiceIsland(document, element, { name: "upload", kind: "rest", baseUri: "/api/upload", method: "POST" });
    appendServiceIsland(document, element, { name: "images", kind: "rest", baseUri: "/api/images", method: "GET" });
    appendServiceIsland(document, element, { name: "links", kind: "rest", baseUri: "/api/links", method: "GET" });
    element.dataset.categories = PRESET_CATEGORIES;

    const ctrl = new wxapp.CommentComposerCtrl(element);

    assert.equal(ctrl._editorHost.dataset.imageUploadUri, "/api/upload");
    assert.equal(ctrl._editorHost.dataset.imageLibraryUri, "/api/images");
    assert.equal(ctrl._editorHost.dataset.linkLibraryUri, "/api/links");
});

// ---------------------------------------------------------------------------
// the view is a pure function of the state; the editor is a nested control
// ---------------------------------------------------------------------------

/**
 * Stands in for the WYSIWYG editor: like the real one it decorates its host and builds
 * children of its own, which a re-render of the composer must leave alone.
 */
const EDITOR_STUB = `
    webexpress.webui.EditorCtrl = class {
        constructor(host) {
            this.host = host;
            this.html = "";
            this.focused = false;
            host.classList.add("wx-editor");
            host.appendChild(document.createElement("div"));
            webexpress.webui.EditorCtrl.instances.push(this);
        }
        exportHtml() { return this.html; }
        set value(v) { this.html = v; }
        focus() { this.focused = true; }
    };
    webexpress.webui.EditorCtrl.instances = [];
`;

/**
 * Builds a composer with preset categories, a data service and the editor stub.
 * @param {object} [options={}] - categories, defaultCategory and a fetch answer.
 * @returns {object} The control, its host, the runtime and the posted bodies.
 */
function composer(options = {}) {
    const runtime = load({ bootstrap: EDITOR_STUB });
    const { wxapp, createElement, setFetch, document } = runtime;
    const posted = [];
    setFetch(async (url, init) => {
        if (init && init.method === "POST") {
            posted.push(JSON.parse(init.body));
            return { ok: true, status: 201, headers: { get: () => "application/json" }, json: async () => ({ id: "c1" }) };
        }
        return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => options.loaded || [] };
    });
    const element = createElement("div");
    appendServiceIsland(document, element, { name: "data", kind: "rest", baseUri: "/api/comments/INC-1", method: "GET", createMethod: "POST" });
    if (options.categories !== null) {
        element.dataset.categories = JSON.stringify(options.categories || [{ id: "general", i18n: "" }, { id: "bug", i18n: "" }]);
    }
    if (options.defaultCategory) {
        element.dataset.defaultCategory = options.defaultCategory;
    }
    const ctrl = new wxapp.CommentComposerCtrl(element);
    return { ctrl, element, runtime, posted, editors: runtime.wx.EditorCtrl.instances };
}

/**
 * Lets the batched render and the asynchronous request run.
 * @returns {Promise<void>} Resolves after a macrotask.
 */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const parts = (element) => {
    const [trigger, form] = element.childNodes;
    const [head, editor, foot] = form.childNodes;
    const [labels, , submit, cancel] = foot.childNodes;
    return { trigger, form, select: head.childNodes[1], editor, labels, submit, cancel };
};

test("render describes the markup without touching the DOM", () => {
    const { ctrl, element } = composer();
    const before = element.childNodes.slice();
    const tree = ctrl.render({ expanded: true, categories: { a: { id: "a" } }, category: "a", labels: "x", submitting: true });
    assert.deepEqual(element.childNodes, before);
    assert.equal(tree.length, 2);
    assert.equal(tree[1].children[1].keep, true, "the editor host is kept from the reconciler");
});

test("the composer starts collapsed with the default category selected", () => {
    const { element } = composer({ defaultCategory: "bug" });
    assert.ok(element.classList.contains("wx-comment-composer-collapsed"));
    assert.equal(parts(element).select.value, "bug");
    assert.deepEqual(parts(element).select.childNodes.map((o) => o.value), ["general", "bug"]);
});

test("an unknown default falls back to the first category, as a select does", () => {
    const { ctrl, element } = composer({ defaultCategory: "missing" });
    assert.equal(parts(element).select.value, "general");
    assert.equal(ctrl._selectedCategory(ctrl.state), "general");
});

test("expanding creates the editor once and later renders leave it intact", async () => {
    const { ctrl, element, editors } = composer();
    parts(element).trigger.dispatchEvent({ type: "click" });
    await settle();
    assert.ok(element.classList.contains("wx-comment-composer-expanded"));
    assert.equal(editors.length, 1);
    assert.equal(editors[0].host, parts(element).editor);
    assert.equal(editors[0].focused, true);

    const labels = parts(element).labels;
    labels.value = "ui, api";
    labels.dispatchEvent({ type: "input", target: labels });
    await settle();
    const host = parts(element).editor;
    assert.ok(host.classList.contains("wx-editor"), "the editor's own class survives the re-render");
    assert.equal(host.childNodes.length, 1, "the editor's children are not reconciled away");
    parts(element).trigger.dispatchEvent({ type: "focus" });
    await settle();
    assert.equal(editors.length, 1, "a second expansion does not create a second editor");
    assert.equal(ctrl.state.labels, "ui, api");
});

test("categories loaded after the first render fill the picker", async () => {
    const { element } = composer({ categories: null, loaded: [{ id: "general" }, { id: "idea" }] });
    assert.equal(parts(element).select.childNodes.length, 0);
    await settle();
    await settle();
    assert.deepEqual(parts(element).select.childNodes.map((o) => o.value), ["general", "idea"]);
    assert.equal(parts(element).select.value, "general");
});

test("sending posts editor text, category and labels, then resets the form", async () => {
    const { element, posted, editors } = composer();
    const { trigger } = parts(element);
    trigger.dispatchEvent({ type: "click" });
    await settle();
    editors[0].html = "<p>Hello</p>";
    const { select, labels } = parts(element);
    select.value = "bug";
    select.dispatchEvent({ type: "change", target: select });
    labels.value = "a, b ,";
    labels.dispatchEvent({ type: "input", target: labels });
    await settle();

    parts(element).submit.dispatchEvent({ type: "click" });
    await settle();
    await settle();

    assert.deepEqual(posted, [{ body: "<p>Hello</p>", category: "bug", labels: ["a", "b"] }]);
    assert.ok(element.classList.contains("wx-comment-composer-collapsed"));
    assert.equal(parts(element).labels.value, "");
    assert.equal(parts(element).select.value, "general");
    assert.equal(editors[0].html, "");
    assert.equal(parts(element).submit.hasAttribute("disabled"), false);
});

test("Ctrl+Enter sends and Escape collapses an empty composer", async () => {
    const { element, posted, editors } = composer();
    parts(element).trigger.dispatchEvent({ type: "click" });
    await settle();
    const editor = parts(element).editor;

    editor.dispatchEvent({ type: "keydown", key: "Escape", preventDefault() { } });
    await settle();
    assert.ok(element.classList.contains("wx-comment-composer-collapsed"));

    parts(element).trigger.dispatchEvent({ type: "click" });
    await settle();
    editors[0].html = "<p>x</p>";
    editor.dispatchEvent({ type: "keydown", key: "Enter", ctrlKey: true, preventDefault() { } });
    await settle();
    await settle();
    assert.equal(posted.length, 1);
});
