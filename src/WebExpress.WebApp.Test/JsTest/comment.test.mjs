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
import { loadEngine, webappAsset, appendServiceIsland, appendStateIsland, appendResourceIsland } from "./harness.mjs";

function load(options) {
    return loadEngine(Object.assign(
        {
            extraFiles: [
                webappAsset("webexpress.webapp.comment.model.js"),
                webappAsset("webexpress.webapp.comment.js")
            ]
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
