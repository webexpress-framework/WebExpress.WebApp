/**
 * Headless tests for the threaded comment control after it was lifted onto the
 * Component base (View, State and Service). The control keeps its own imperative
 * render flow; the lift gives it the component store (UI state plus the seedable
 * comments), the service map and lifecycle. The tests assert that it extends
 * Component, seeds its comments from the wx-state island and skips the
 * comment load in that case, and otherwise loads from the service.
 *
 * Run with Node 18 or newer from the jstest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { appendServiceIsland, appendStateIsland, appendResourceIsland } from "./harness.mjs";
import { loadControl } from "./controls.harness.mjs";

function load(options) {
    return loadControl(Object.assign(
        {
            deps: ["webexpress.webapp.comment.model.js"],
            file: "webexpress.webapp.comment.js"
        },
        options
    ));
}

function settle() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

const PRESET_CATEGORIES = JSON.stringify([{ id: "general", i18n: "", color: "#000", bg: "#fff" }]);

const SEED_COMMENT = {
    id: "c1",
    author: { id: "u1", name: "Ann", initials: "AN", color: "#abc" },
    category: "general",
    labels: [],
    body: "<p>hi</p>",
    created: "2026-01-01T00:00:00Z",
    likes: [],
    reactions: {},
    replies: [],
    pinned: false
};

test("comment extends the component base", () => {
    const { wxapp, createElement, setFetch } = load();
    setFetch(async () => ({ ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => [] }));

    const element = createElement("div");
    const ctrl = new wxapp.CommentCtrl(element);

    assert.ok(ctrl instanceof wxapp.Data);
    assert.equal(typeof ctrl.store, "object");
});

test("comment sorting reads and writes localStorage without cookies", () => {
    const rt = load();
    rt.sandbox.localStorage.setItem("wx_comment_sort_dir", "asc");
    const ctrl = new rt.wxapp.CommentCtrl(rt.createElement("div"));
    assert.equal(ctrl._sortDir, "asc");
    ctrl._sortDirBtn.dispatchEvent({ type: "click" });
    assert.equal(rt.sandbox.localStorage.getItem("wx_comment_sort_dir"), "desc");
    assert.equal(rt.document.cookie, "");
});

test("comment in a ViewState renders the central comments resource the ViewState loads", async () => {
    const { wxapp, createElement, setFetch, document } = load();
    let fetchCount = 0;
    setFetch(async () => {
        fetchCount++;
        return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => [SEED_COMMENT] };
    });

    const viewStateHost = createElement("div");
    viewStateHost.dataset.wxViewstate = "discussion";
    appendServiceIsland(document, viewStateHost, { name: "data", kind: "rest", baseUri: "/api/comments", method: "GET", updateMethod: "PUT" });
    appendResourceIsland(document, viewStateHost, { name: "comments", service: "data", target: "comments", params: [] });

    const viewState = new wxapp.ViewState(viewStateHost);

    const commentHost = createElement("div");
    commentHost.dataset.wxResource = "comments";
    commentHost.dataset.categories = PRESET_CATEGORIES;
    viewStateHost.appendChild(commentHost);

    const ctrl = new wxapp.CommentCtrl(commentHost);
    await settle();
    await settle();

    assert.equal(fetchCount, 1, "the ViewState loaded the comments resource centrally");
    assert.equal(ctrl.value.length, 1, "the control renders the comments from the slice");
    assert.equal(ctrl.value[0].id, "c1");
});

test("comment seeds its comments from the wx-state island and skips the load", async () => {
    const { wxapp, createElement, setFetch, document } = load();
    let fetchCount = 0;
    setFetch(async () => { fetchCount++; return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => [] }; });

    const element = createElement("div");
    appendServiceIsland(document, element, { name: "data", kind: "rest", baseUri: "/api/comments", method: "GET", updateMethod: "PUT" });
    element.dataset.categories = PRESET_CATEGORIES;
    appendStateIsland(document, element, { comments: [SEED_COMMENT] });

    const ctrl = new wxapp.CommentCtrl(element);

    assert.equal(ctrl.value.length, 1);
    assert.equal(ctrl.value[0].id, "c1");

    await settle();
    assert.equal(fetchCount, 0);
});

test("comment loads from the service when no state island is present", async () => {
    const { wxapp, createElement, setFetch, document } = load();
    let fetchCount = 0;
    setFetch(async () => { fetchCount++; return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => [] }; });

    const element = createElement("div");
    appendServiceIsland(document, element, { name: "data", kind: "rest", baseUri: "/api/comments", method: "GET", updateMethod: "PUT" });
    element.dataset.categories = PRESET_CATEGORIES;

    const ctrl = new wxapp.CommentCtrl(element);

    await settle();
    assert.equal(fetchCount, 1);
    assert.equal(ctrl.value.length, 0);
});

// ---------------------------------------------------------------------------
// the surface is a pure function of the state
// ---------------------------------------------------------------------------

const ANN = "u1";
const BOB = "u2";

/**
 * Builds a comment for the view tests.
 * @param {string} id - The comment id.
 * @param {object} [fields={}] - Overrides.
 * @returns {object} The comment.
 */
function comment(id, fields = {}) {
    return Object.assign({ id, author: ANN, category: "general", labels: [], body: `<p>${id}</p>`, when: "2026-01-0" + id.slice(1),
        likes: [], reactions: {}, replies: [], pinned: false }, fields);
}

/**
 * Builds a seeded comment surface whose service answers every mutation.
 * @param {Array<object>} comments - The seeded comments.
 * @returns {object} The control, its host, the runtime, the recorded requests and the
 *   number of mousedown listeners registered on the document.
 */
function seeded(comments) {
    const rt = load();
    const requests = [];
    const listeners = { mousedown: 0 };
    const add = rt.document.addEventListener.bind(rt.document);
    const remove = rt.document.removeEventListener.bind(rt.document);
    rt.document.addEventListener = (type, handler) => { if (type in listeners) listeners[type]++; add(type, handler); };
    rt.document.removeEventListener = (type, handler) => { if (type in listeners) listeners[type]--; remove(type, handler); };
    rt.setFetch(async (url, init) => {
        requests.push({ url: String(url), init: init || {} });
        const path = String(url);
        const data = path.endsWith("/likes") ? { likes: [ANN] }
            : path.endsWith("/pin") ? { pinned: true }
            : path.endsWith("/replies") ? { id: "r9", author: ANN, body: JSON.parse(init.body).body, when: "now" }
            : [];
        return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => data };
    });
    const element = rt.createElement("div");
    element.dataset.currentUser = ANN;
    element.dataset.categories = JSON.stringify([{ id: "general", i18n: "", color: "#000", bg: "#fff" }, { id: "question", i18n: "", color: "#00f", bg: "#eef" }]);
    appendServiceIsland(rt.document, element, { name: "data", kind: "rest", baseUri: "/api/comments", method: "GET", updateMethod: "PUT", createMethod: "POST" });
    appendStateIsland(rt.document, element, { comments });
    rt.document.body.appendChild(element);
    const ctrl = new rt.wxapp.CommentCtrl(element);
    return { ctrl, element, rt, requests, listeners };
}

const articles = (element) => element.querySelectorAll("article");
const ids = (element) => articles(element).map((a) => a.dataset.commentId);

test("render describes the surface without touching the DOM", () => {
    const { ctrl, element } = seeded([comment("c1")]);
    const before = element.childNodes.slice();
    const tree = ctrl.render(Object.assign({}, ctrl.state, { comments: [] }));
    assert.deepEqual(element.childNodes, before);
    assert.equal(tree[1].children[0].key, "empty");
});

test("pinned comments lead, then the chosen order and category", () => {
    const { ctrl, element } = seeded([comment("c1"), comment("c2", { pinned: true }), comment("c3", { category: "question", likes: [BOB, ANN] })]);
    assert.deepEqual(ids(element), ["c2", "c3", "c1"], "newest first after the pinned one");
    ctrl.setState({ sortBy: "likes", sortDir: "asc" });
    ctrl.store.flush();
    assert.deepEqual(ids(element), ["c2", "c1", "c3"]);
    ctrl.setState({ filterCat: "question" });
    ctrl.store.flush();
    assert.deepEqual(ids(element), ["c3"]);
    const filter = element.querySelector(".wx-comment-filter");
    assert.deepEqual(filter.childNodes.map((o) => o.textContent), ["All categories (3)", "general (2)", "question (1)"]);
    assert.equal(filter.value, "question");
});

test("a like replaces the comment instead of changing it and keeps the other nodes", async () => {
    const { ctrl, element } = seeded([comment("c1"), comment("c2")]);
    const original = ctrl.value.find((c) => c.id === "c1");
    const other = articles(element).find((a) => a.dataset.commentId === "c2");
    await ctrl._toggleLike(original);
    ctrl.store.flush();
    assert.deepEqual(Array.from(original.likes), [], "the comment that was rendered is not mutated");
    assert.deepEqual(Array.from(ctrl.value.find((c) => c.id === "c1").likes), [ANN]);
    assert.equal(articles(element).find((a) => a.dataset.commentId === "c2"), other, "the untouched comment keeps its node");
    const liked = articles(element).find((a) => a.dataset.commentId === "c1");
    assert.equal(liked.querySelector(".wx-comment-like-count").textContent, "1");
});

test("an open reply and a delete confirmation survive a re-render", async () => {
    const { ctrl, element } = seeded([comment("c1"), comment("c2")]);
    const first = () => articles(element).find((a) => a.dataset.commentId === "c1");
    first().querySelector(".wx-comment-reply-btn").dispatchEvent({ type: "click" });
    ctrl.store.flush();
    const textarea = first().querySelector(".wx-comment-reply-compose textarea");
    textarea.value = "a draft";
    textarea.dispatchEvent({ type: "input", target: textarea });
    ctrl._setFlag("confirmDelete", "c1", true);
    ctrl.store.flush();

    await ctrl._toggleLike(ctrl.value.find((c) => c.id === "c2"));
    ctrl.store.flush();

    assert.equal(first().querySelector(".wx-comment-reply-compose textarea").value, "a draft", "the like elsewhere kept the draft");
    assert.ok(first().querySelector(".wx-comment-delete-confirm"), "and the confirmation");
});

test("sending a reply appends it and closes the field", async () => {
    const { ctrl, element, requests } = seeded([comment("c1")]);
    ctrl._startReply("c1");
    ctrl._setFlag("replyDrafts", "c1", "  thanks  ");
    ctrl.store.flush();
    element.querySelector(".wx-comment-reply-compose .btn-primary").dispatchEvent({ type: "click" });
    await settle();
    ctrl.store.flush();
    assert.equal(JSON.parse(requests.at(-1).init.body).body, "thanks");
    assert.equal(element.querySelector(".wx-comment-reply-compose"), null);
    assert.equal(element.querySelectorAll(".wx-comment-reply").length, 1);
    assert.equal(element.querySelector(".wx-comment-reply-body").innerHTML, "thanks");
});

test("the reaction picker uses one document listener however often the list renders", () => {
    const { ctrl, element, listeners } = seeded([comment("c1"), comment("c2")]);
    for (let i = 0; i < 5; i++) {
        ctrl.setState({ sortDir: i % 2 ? "asc" : "desc" });
        ctrl.store.flush();
    }
    assert.equal(listeners.mousedown, 1, "a render adds no listener of its own");

    element.querySelector(".wx-comment-reaction-add").dispatchEvent({ type: "click", stopPropagation() { } });
    ctrl.store.flush();
    const popup = () => element.querySelector(".wx-comment-reaction-popup");
    assert.equal(popup().style.display, "flex");
    ctrl._closeReactionPicker({ target: element });
    ctrl.store.flush();
    assert.equal(popup().style.display, "none", "a press outside closes it");

    ctrl.destroy();
    assert.equal(listeners.mousedown, 0, "destroy releases it");
});

test("edit mode keeps the editor host and posts the drafted fields", async () => {
    const { ctrl, element, requests } = seeded([comment("c1", { labels: ["a"] })]);
    ctrl._toggleEdit(ctrl.value[0]);
    ctrl.store.flush();
    const host = element.querySelector(".wx-comment-edit-editor");
    assert.equal(host.innerHTML, "<p>c1</p>", "the editor starts with the body");
    const labels = element.querySelector(".wx-comment-edit-labels");
    labels.value = "a, b";
    labels.dispatchEvent({ type: "input", target: labels });
    ctrl.store.flush();
    assert.equal(element.querySelector(".wx-comment-edit-editor"), host, "typing elsewhere keeps the editor host");

    await ctrl._saveEdit(ctrl.value[0], ctrl._editPatch(ctrl.value[0]));
    const body = JSON.parse(requests.at(-1).init.body);
    assert.deepEqual(body.labels, ["a", "b"]);
    assert.equal(body.category, "general");
});
