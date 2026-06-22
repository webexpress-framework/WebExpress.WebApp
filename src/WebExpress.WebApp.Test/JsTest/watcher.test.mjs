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
import { loadEngine, webappAsset, appendServiceIsland, appendStateIsland } from "./harness.mjs";

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
    assert.equal(ctrl._row.childNodes.length, 1);

    // the seed avoids the round trip
    await settle();
    assert.equal(fetchCount, 0);
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
