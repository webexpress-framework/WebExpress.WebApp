/**
 * Headless tests for the link and image pages WebApp adds to the editor's dialogs. The pages
 * run against a stand-in of the dialog context WebUI hands them (modal.editorDialog), so a case
 * sees exactly what a page reads and what it applies; the network is the fetch the service layer
 * uses and the upload adapter of the transport.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadControl } from "./controls.harness.mjs";

const FILES = ["webexpress.webapp.editor.library.js", "panels/webexpress.webapp.panel.editor.image.js", "panels/webexpress.webapp.panel.editor.link.js"];

/**
 * Collects what a multipart upload would carry.
 */
class FormDataStub {
    constructor() { this.entries = []; }
    append(name, value) { this.entries.push([name, value]); }
}

/**
 * Loads the pages with a fetch that answers every GET from a map of urls to items.
 * @param {object} [responses={}] - The items per requested url.
 * @returns {object} The runtime, with the requested urls in requests.
 */
function load(responses = {}) {
    const requests = [];
    const rt = loadControl({
        deps: FILES,
        extraGlobals: { FormData: FormDataStub },
        fetch: async (url) => {
            requests.push(url);
            return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({ items: responses[url] || [] }) };
        }
    });
    rt.requests = requests;
    return rt;
}

/**
 * Builds a dialog stand-in with the context WebUI's EditorImage.dialog and EditorLink.dialog provide.
 * @param {object} editor - The editor addresses.
 * @param {object} [context={}] - The mode and prefill of the opening.
 * @returns {object} The modal, with every apply() call in applied.
 */
function dialog(editor, context = {}) {
    const applied = [];
    return {
        applied,
        submitted: 0,
        submit() { this.submitted++; },
        editorDialog: {
            editor,
            mode: context.mode || "insert",
            prefill: Object.assign({ url: "", text: "", alt: "", image: false }, context.prefill),
            address: value => (/^javascript:/i.test(String(value)) ? "" : String(value)),
            apply: values => { applied.push(values); return true; }
        }
    };
}

/**
 * Renders a page into a pane and shows it, as ModalSidebarPanelCtrl does.
 * @param {object} rt - The runtime.
 * @param {string} key - The dialog key.
 * @param {object} modal - The dialog stand-in.
 * @returns {object} The page and its pane.
 */
function open(rt, key, modal) {
    const page = rt.wx.DialogPanels.get(key).find(p => p.id.startsWith("webexpress.webapp."));
    const pane = rt.createElement("div");
    rt.document.body.appendChild(pane);
    page.render(pane, modal);
    page.onShow(modal);
    return { page, pane };
}

const settle = () => new Promise(resolve => setTimeout(resolve, 0));
// the pages run in their own realm; values are compared without its prototypes
const plain = value => JSON.parse(JSON.stringify(value));
const entries = pane => Array.from(pane.querySelectorAll(".wx-webapp-editor-library-item"));

test("the pages are offered only to editors that name their services", () => {
    const rt = load();
    const image = rt.wx.DialogPanels.get("editor-image").find(p => p.id === "webexpress.webapp.editor.image.library");
    const link = rt.wx.DialogPanels.get("editor-link").find(p => p.id === "webexpress.webapp.editor.link.library");
    assert.equal(image.available({ imageUploadUri: "/up", imageLibraryUri: "" }), true);
    assert.equal(image.available({ imageUploadUri: "", imageLibraryUri: "/images" }), true);
    assert.equal(image.available({ imageUploadUri: "", imageLibraryUri: "", linkLibraryUri: "/links" }), false);
    assert.equal(link.available({ linkLibraryUri: "/links" }), true);
    assert.equal(link.available({ imageUploadUri: "/up" }), false);
});

test("an image chosen from the library is inserted with its name as alternative text", async () => {
    const rt = load({ "/api/images": [{ name: "logo.png", uri: "/files/logo.png" }, { name: "evil", uri: "javascript:alert(1)" }] });
    const modal = dialog({ imageLibraryUri: "/api/images" });
    const { page, pane } = open(rt, "editor-image", modal);
    await settle();
    assert.deepEqual(rt.requests, ["/api/images"]);
    assert.equal(entries(pane).length, 1, "an address the document rejects is not offered");
    assert.equal(page.validate(modal).valid, false);
    entries(pane)[0].dispatchEvent({ type: "click" });
    assert.equal(page.validate(modal), true);
    page.onSubmit(modal);
    assert.deepEqual(plain(modal.applied), [{ src: "/files/logo.png", alt: "logo" }]);
});

test("the library search asks the service and drops an answer that arrives too late", async () => {
    const rt = load();
    let release;
    const answers = { "/api/images?q=old": new Promise(r => { release = r; }), "/api/images?q=new": Promise.resolve([{ name: "new.png", uri: "/new.png" }]) };
    rt.setFetch(async (url) => {
        const items = await (answers[url] || []);
        return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({ items }) };
    });
    const modal = dialog({ imageLibraryUri: "/api/images" });
    const { pane } = open(rt, "editor-image", modal);
    const library = modal._webappImage.library;
    const search = library._search;
    search.value = "old";
    const first = library.load();
    search.value = "new";
    await library.load();
    release([{ name: "old.png", uri: "/old.png" }]);
    await first;
    assert.deepEqual(entries(pane).map(entry => entry.title), ["/new.png"]);
    assert.equal(rt.wxapp.EditorLibrary.url("/api/images?scope=a", "a b"), "/api/images?scope=a&q=a%20b");
});

test("an uploaded image is chosen at the address the server stored it under", async () => {
    const rt = load();
    const uploads = [];
    let finish;
    rt.wx.Transport.use({
        request: (url, init) => rt.wxapp.ServiceRegistry.request(url, init),
        upload: (url, body) => { uploads.push({ url, body }); return new Promise(r => { finish = r; }); }
    });
    const modal = dialog({ imageUploadUri: "/api/upload" });
    const { page, pane } = open(rt, "editor-image", modal);

    page._upload(modal, { name: "notes.txt", type: "text/plain" });
    assert.equal(uploads.length, 0, "a file that is no image is not sent");

    const done = page._upload(modal, { name: "photo.png", type: "image/png" });
    assert.equal(uploads[0].url, "/api/upload");
    assert.equal(uploads[0].body.entries[0][0], "file");
    assert.equal(page.validate(modal).valid, false, "a running upload blocks the submit");
    finish({ ok: true, data: { name: "photo.png", uri: "/files/2026/photo.png" } });
    await done;
    assert.equal(entries(pane).length, 1);
    assert.equal(page.validate(modal), true);
    page.onSubmit(modal);
    assert.deepEqual(plain(modal.applied), [{ src: "/files/2026/photo.png", alt: "photo" }]);

    const again = page._upload(modal, { name: "x.png", type: "image/png" });
    finish({ ok: true, data: { name: "x.png" } });
    await again;
    assert.equal(entries(pane).length, 1, "an answer without an address adds nothing");
    assert.notEqual(modal._webappImage.status.textContent, "");
});

test("an edited image is chosen again once the library lists it", async () => {
    const rt = load({ "/api/images": [{ name: "a.png", uri: "/a.png" }, { name: "b.png", uri: "/b.png" }] });
    const modal = dialog({ imageLibraryUri: "/api/images" }, { mode: "edit", prefill: { url: "/b.png", alt: "kept" } });
    const { page } = open(rt, "editor-image", modal);
    await settle();
    assert.equal(modal._webappImage.library.selected.uri, "/b.png");
    page.onSubmit(modal);
    assert.deepEqual(plain(modal.applied), [{ src: "/b.png", alt: "kept" }]);
});

test("a link target from the service links the selection or inserts its title", async () => {
    const rt = load({ "/api/links": [{ uri: "/wiki/Start", title: "Start page", description: "Where it begins" }] });
    for (const [text, expected] of [["", "Start page"], ["see here", "see here"]]) {
        const modal = dialog({ linkLibraryUri: "/api/links" }, { prefill: { text } });
        const { page, pane } = open(rt, "editor-link", modal);
        await settle();
        assert.match(entries(pane)[0].textContent, /Start page.*Where it begins/);
        entries(pane)[0].dispatchEvent({ type: "dblclick" });
        assert.equal(modal.submitted, 1, "a double click submits the dialog");
        page.onSubmit(modal);
        assert.deepEqual(plain(modal.applied), [{ href: "/wiki/Start", text: expected }]);
    }
});
