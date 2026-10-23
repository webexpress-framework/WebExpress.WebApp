/**
 * Headless tests for the watcher control after it was lifted onto the Component
 * base (View, State and Service). They instantiate the real control file in the
 * harness (alongside its model) and assert that it extends Component, seeds its
 * watchers from the wx-state island and skips the network load in that
 * case, and otherwise loads from the service.
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
                webappAsset("webexpress.webapp.watcher.model.js"),
                webappAsset("webexpress.webapp.watcher.js")
            ]
        },
        options
    ));
}

/**
 * Awaits the asynchronous load and the batched store notification.
 * @returns {Promise<void>} Resolves after the macrotask and microtask queues drain.
 */
function settle() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

test("watcher extends the component base", () => {
    const { wxapp, createElement, setFetch, document } = load();
    setFetch(async () => ({ ok: true, status: 200, json: async () => [] }));

    const element = createElement("div");
    appendServiceIsland(document, element, { name: "data", kind: "rest", baseUri: "/api/watchers", method: "GET", updateMethod: "PUT" });

    const ctrl = new wxapp.WatcherCtrl(element);

    assert.ok(ctrl instanceof wxapp.Data);
    assert.equal(typeof ctrl.store, "object");
});

test("watcher seeds its watchers from the wx-state island and skips the load", async () => {
    const { wxapp, createElement, setFetch, document } = load();
    let fetchCount = 0;
    setFetch(async () => { fetchCount++; return { ok: true, status: 200, json: async () => [] }; });

    const element = createElement("div");
    appendServiceIsland(document, element, { name: "data", kind: "rest", baseUri: "/api/watchers", method: "GET", updateMethod: "PUT" });
    appendStateIsland(document, element, { watchers: [{ id: "u1", name: "Ann", initials: "AN" }] });

    const ctrl = new wxapp.WatcherCtrl(element);

    // the store is seeded synchronously, so the value is available at once
    assert.equal(ctrl.value.length, 1);
    assert.equal(ctrl.value[0].id, "u1");

    // the avatar row is rendered from the seeded state on mount
    assert.equal(element.childNodes[0].childNodes.length, 1);

    // the seed avoids the round trip
    await settle();
    assert.equal(fetchCount, 0);
});

test("watcher renders an image avatar when the user carries one", () => {
    const { wxapp, createElement, setFetch, document } = load();
    setFetch(async () => ({ ok: true, status: 200, json: async () => [] }));

    const element = createElement("div");
    appendServiceIsland(document, element, { name: "data", kind: "rest", baseUri: "/api/watchers", method: "GET", updateMethod: "PUT" });
    appendStateIsland(document, element, {
        watchers: [
            { id: "u1", name: "Ann", initials: "AN" },
            { id: "u2", name: "Bob", image: "/img/bob.png" }
        ]
    });

    const ctrl = new wxapp.WatcherCtrl(element);

    // the plain user keeps the initials badge, the pictured user gets an img child
    const [plain, pictured] = element.childNodes[0].childNodes;
    assert.equal(plain.textContent, "AN");
    assert.equal(plain.childNodes.some((n) => n.tagName === "IMG"), false);

    const img = pictured.childNodes.find((n) => n.tagName === "IMG");
    assert.ok(img, "the avatar image exists");
    assert.equal(img.getAttribute("src"), "/img/bob.png");
    assert.equal(img.className, "wx-avatar-group-img");
});

test("watcher loads from the service when no state island is present", async () => {
    const { wxapp, createElement, setFetch, document } = load();
    let fetchCount = 0;
    setFetch(async () => { fetchCount++; return { ok: true, status: 200, json: async () => [{ id: "u9", name: "Bob" }] }; });

    const element = createElement("div");
    appendServiceIsland(document, element, { name: "data", kind: "rest", baseUri: "/api/watchers", method: "GET", updateMethod: "PUT" });

    const ctrl = new wxapp.WatcherCtrl(element);
    assert.equal(ctrl.value.length, 0);

    await settle();

    assert.equal(fetchCount, 1);
    assert.equal(ctrl.value.length, 1);
    assert.equal(ctrl.value[0].id, "u9");
});

test("watcher in a ViewState renders the central resource slice and resolves the users service from the ViewState", async () => {
    const { wxapp, createElement, setFetch, document } = load();
    const urls = [];
    setFetch(async (url) => {
        urls.push(url);
        return { ok: true, status: 200, json: async () => [{ id: "u1", name: "Ann", initials: "AN" }] };
    });

    const viewStateHost = createElement("div");
    viewStateHost.dataset.wxViewstate = "ticket";
    appendServiceIsland(document, viewStateHost, { name: "data", kind: "rest", baseUri: "/api/watchers", method: "GET", updateMethod: "PUT" });
    appendServiceIsland(document, viewStateHost, { name: "users", kind: "rest", baseUri: "/api/users", method: "GET" });
    appendResourceIsland(document, viewStateHost, { name: "watchers", service: "data", target: "watchers" });

    const viewState = new wxapp.ViewState(viewStateHost);

    const element = createElement("div");
    element.dataset.wxResource = "watchers";
    element.dataset.wxUsers = "users";
    viewStateHost.appendChild(element);

    const ctrl = new wxapp.WatcherCtrl(element);
    await settle();

    assert.equal(urls.length, 1, "the ViewState loaded the resource centrally");
    assert.equal(ctrl.value.length, 1, "the avatar row renders the slice");
    assert.equal(ctrl.value[0].id, "u1");
    assert.equal(ctrl._users, viewState.useService("users"), "the candidate search uses the ViewState users service");
});

// ---------------------------------------------------------------------------
// the view is a pure function of the state
// ---------------------------------------------------------------------------

/**
 * Builds a seeded watcher with a users service answering the given candidates.
 * @param {object} [options={}] - watchers, users, readonly and maxVisible.
 * @returns {object} The control, its host, the document and the recorded requests.
 */
function seeded(options = {}) {
    const runtime = load();
    const { wxapp, createElement, setFetch, document } = runtime;
    const requests = [];
    setFetch(async (url) => {
        requests.push(url);
        return { ok: true, status: 200, json: async () => options.users || [] };
    });
    const element = createElement("div");
    if (options.readonly) {
        element.dataset.readonly = "true";
    }
    if (options.maxVisible) {
        element.dataset.maxVisible = String(options.maxVisible);
    }
    appendServiceIsland(document, element, { name: "data", kind: "rest", baseUri: "/api/watchers", method: "GET", updateMethod: "PUT" });
    appendServiceIsland(document, element, { name: "users", kind: "rest", baseUri: "/api/users", method: "GET" });
    appendStateIsland(document, element, { watchers: options.watchers || [{ id: "u1", name: "Ann", initials: "AN" }] });
    const ctrl = new wxapp.WatcherCtrl(element);
    return { ctrl, element, document, requests, wxapp };
}

test("render describes the markup without touching the DOM", () => {
    const { ctrl, element } = seeded();
    const before = element.childNodes.slice();
    const tree = ctrl.render({ watchers: [{ id: "a", name: "A" }, { id: "b", name: "B" }], dropdownOpen: true, query: "x", candidates: [] });
    assert.deepEqual(element.childNodes, before, "rendering a state changes nothing by itself");
    assert.equal(tree.length, 3);
    assert.equal(tree[0].children.flat().filter(Boolean).length, 2, "one avatar per watcher");
    assert.equal(tree[2].props.style.display, "block");
});

test("avatars beyond the visible count collapse into a counter", () => {
    const watchers = ["a", "b", "c", "d"].map((id) => ({ id, name: id.toUpperCase() }));
    const { element } = seeded({ watchers, maxVisible: 2 });
    const row = element.childNodes[0];
    assert.equal(row.childNodes.length, 3);
    assert.equal(row.childNodes[2].textContent, "+2");
    assert.equal(row.childNodes[2].getAttribute("title"), "C, D");
});

test("a re-render keeps the avatar nodes of watchers that stay", () => {
    const { ctrl, element } = seeded({ watchers: [{ id: "u1", name: "Ann" }, { id: "u2", name: "Bob" }] });
    const bob = element.childNodes[0].childNodes[1];
    ctrl.setState({ watchers: [{ id: "u2", name: "Bob" }] });
    ctrl.store.flush();
    assert.equal(element.childNodes[0].childNodes.length, 1);
    assert.equal(element.childNodes[0].childNodes[0], bob, "the keyed reconciler moved the node instead of recreating it");
});

test("a readonly control renders only the avatar row with disabled avatars", () => {
    const { element } = seeded({ readonly: true });
    assert.equal(element.childNodes.length, 1);
    assert.equal(element.childNodes[0].childNodes[0].hasAttribute("disabled"), true);
});

test("opening the dropdown focuses the search and lists the candidates from the state", async () => {
    const { ctrl, element, requests } = seeded({ users: [{ id: "u1", name: "Ann" }, { id: "u7", name: "Eve", team: "Ops" }] });
    const [, add, dropdown] = element.childNodes;
    const search = dropdown.childNodes[0];
    let focused = false;
    search.focus = () => { focused = true; };

    add.dispatchEvent({ type: "click", stopPropagation() { } });
    ctrl.store.flush();
    assert.equal(dropdown.style.display, "block");
    assert.equal(focused, true);
    await settle();
    ctrl.store.flush();

    assert.ok(requests.some((url) => String(url).includes("/api/users")), "the users service was asked");
    const results = dropdown.childNodes[1].childNodes;
    assert.equal(results.length, 1, "a user who already watches is no candidate");
    assert.equal(results[0].textContent, "EVEveOps");
});

test("a search without matches says so", async () => {
    const { ctrl, element } = seeded({ users: [] });
    element.childNodes[1].dispatchEvent({ type: "click", stopPropagation() { } });
    await settle();
    ctrl.store.flush();
    const results = element.childNodes[2].childNodes[1].childNodes;
    assert.equal(results.length, 1);
    assert.equal(results[0].className, "wx-watcher-empty");
});

test("typing keeps the query in the state, Escape and an outside click close the dropdown", () => {
    const { ctrl, element, document } = seeded();
    element.childNodes[1].dispatchEvent({ type: "click", stopPropagation() { } });
    ctrl.store.flush();
    const search = element.childNodes[2].childNodes[0];
    search.value = "An";
    search.dispatchEvent({ type: "input", target: search });
    ctrl.store.flush();
    assert.equal(ctrl.state.query, "An");
    assert.equal(search.value, "An", "the render writes back what was typed");

    search.dispatchEvent({ type: "keydown", key: "Escape" });
    assert.equal(ctrl.state.dropdownOpen, false);

    element.childNodes[1].dispatchEvent({ type: "click", stopPropagation() { } });
    document.dispatchEvent({ type: "mousedown", target: element.childNodes[2] });
    assert.equal(ctrl.state.dropdownOpen, true, "a click inside the dropdown keeps it open");
    document.dispatchEvent({ type: "mousedown", target: element.childNodes[0] });
    assert.equal(ctrl.state.dropdownOpen, false, "a click outside it, even on an avatar, closes it");
});

test("destroy releases the outside-click listener on the document", () => {
    const { ctrl, element, document } = seeded();
    element.childNodes[1].dispatchEvent({ type: "click", stopPropagation() { } });
    ctrl.destroy();
    document.dispatchEvent({ type: "mousedown", target: document.body });
    assert.equal(ctrl.state.dropdownOpen, true, "nothing reacts after destroy");
});
