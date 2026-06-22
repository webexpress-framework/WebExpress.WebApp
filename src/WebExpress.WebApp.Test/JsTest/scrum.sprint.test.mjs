/**
 * Headless tests for the scrum sprint control after it was lifted onto the
 * Component base (View, State and Service). The control keeps its own imperative
 * render method, which Component._apply calls on every state change. The tests
 * assert that it extends Component, seeds its sprint from the wx-state
 * island and skips the network load in that case, and otherwise loads from the
 * shared request.
 *
 * Run with Node 18 or newer from the jstest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, webappAsset, appendServiceIsland, appendStateIsland } from "./harness.mjs";

function load(options) {
    return loadEngine(Object.assign(
        { extraFiles: [webappAsset("webexpress.webapp.scrum.sprint.js")] },
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

test("scrum sprint extends the component base", () => {
    const { wxapp, createElement, setFetch, document } = load();
    setFetch(async () => ({ ok: true, status: 200, json: async () => ({}) }));

    const element = createElement("div");
    appendServiceIsland(document, element, { name: "data", kind: "rest", baseUri: "/api/sprint", method: "GET" });

    const ctrl = new wxapp.ScrumSprintCtrl(element);

    assert.ok(ctrl instanceof wxapp.Data);
    assert.equal(typeof ctrl.store, "object");
});

test("scrum sprint seeds from the wx-state island and skips the load", async () => {
    const { wxapp, createElement, setFetch, document } = load();
    let fetchCount = 0;
    setFetch(async () => { fetchCount++; return { ok: true, status: 200, json: async () => ({}) }; });

    const element = createElement("div");
    appendServiceIsland(document, element, { name: "data", kind: "rest", baseUri: "/api/sprint", method: "GET" });
    appendStateIsland(document, element, {
        sprint: { name: "Sprint 24", goal: "MVP", committedPoints: 47, completedPoints: 18, capacity: 60, daysTotal: 14, daysElapsed: 7 }
    });

    const ctrl = new wxapp.ScrumSprintCtrl(element);

    assert.ok(ctrl.sprint);
    assert.equal(ctrl.sprint.name, "Sprint 24");
    // the sprint card is rendered from the seeded state on mount, not the empty placeholder
    assert.ok(element.childNodes.length > 0);

    await settle();
    assert.equal(fetchCount, 0);
});

test("scrum sprint loads from the service when no state island is present", async () => {
    const { wxapp, createElement, setFetch, document } = load();
    let fetchCount = 0;
    setFetch(async () => {
        fetchCount++;
        return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({ name: "Sprint 9" }) };
    });

    const element = createElement("div");
    appendServiceIsland(document, element, { name: "data", kind: "rest", baseUri: "/api/sprint", method: "GET" });

    const ctrl = new wxapp.ScrumSprintCtrl(element);
    assert.equal(ctrl.sprint, null);

    await settle();

    assert.equal(fetchCount, 1);
    assert.ok(ctrl.sprint);
    assert.equal(ctrl.sprint.name, "Sprint 9");
});
