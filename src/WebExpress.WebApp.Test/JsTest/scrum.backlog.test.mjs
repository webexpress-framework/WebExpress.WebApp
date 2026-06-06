/**
 * Headless tests for the scrum backlog control after it was lifted onto the
 * Component base (View, State and Service). The backlog is large and mutates its
 * items in place throughout, so it is a light lift: it extends Component for the
 * store, the service map, the seed and the lifecycle, but keeps its own manual
 * render flow. The tests assert that it extends Component, seeds its sprints and
 * items from the data-wx-state island and skips the load in that case, and
 * otherwise loads from the service.
 *
 * Run with Node 18 or newer from the jstest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, webappAsset } from "./harness.mjs";

function load(options) {
    return loadEngine(Object.assign(
        {
            extraFiles: [
                webappAsset("webexpress.webapp.scrum.backlog.model.js"),
                webappAsset("webexpress.webapp.scrum.backlog.js")
            ]
        },
        options
    ));
}

function settle() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

test("scrum backlog extends the component base", () => {
    const { wxapp, createElement, setFetch } = load();
    setFetch(async () => ({ ok: true, status: 200, json: async () => ({ sprints: [], items: [] }) }));

    const element = createElement("div");
    element.setAttribute("data-wx-service", JSON.stringify({ name: "data", kind: "rest", baseUri: "/api/backlog", method: "GET", updateMethod: "PUT" }));

    const ctrl = new wxapp.ScrumBacklogCtrl(element);

    assert.ok(ctrl instanceof wxapp.Data);
    assert.equal(typeof ctrl.store, "object");
});

test("scrum backlog seeds from the data-wx-state island and skips the load", async () => {
    const { wxapp, createElement, setFetch } = load();
    let fetchCount = 0;
    setFetch(async () => { fetchCount++; return { ok: true, status: 200, json: async () => ({ sprints: [], items: [] }) }; });

    const element = createElement("div");
    element.setAttribute("data-wx-service", JSON.stringify({ name: "data", kind: "rest", baseUri: "/api/backlog", method: "GET", updateMethod: "PUT" }));
    element.setAttribute("data-wx-state", JSON.stringify({
        sprints: [{ id: "s1", name: "Sprint 1", status: "active" }],
        items: [{ id: "i1", sprintId: "s1", title: "Task", key: "T-1", points: 3 }]
    }));

    const ctrl = new wxapp.ScrumBacklogCtrl(element);

    assert.equal(ctrl.sprints.length, 1);
    assert.equal(ctrl.sprints[0].id, "s1");
    assert.equal(ctrl.items.length, 1);
    assert.equal(ctrl.items[0].id, "i1");
    // the backlog is rendered from the seeded state, not deferred to a load
    assert.ok(element.childNodes.length > 0);

    await settle();
    assert.equal(fetchCount, 0);
});

test("scrum backlog loads from the service when no state island is present", async () => {
    const { wxapp, createElement, setFetch } = load();
    let fetchCount = 0;
    setFetch(async () => {
        fetchCount++;
        return { ok: true, status: 200, json: async () => ({ sprints: [{ id: "s9" }], items: [] }) };
    });

    const element = createElement("div");
    element.setAttribute("data-wx-service", JSON.stringify({ name: "data", kind: "rest", baseUri: "/api/backlog", method: "GET", updateMethod: "PUT" }));

    const ctrl = new wxapp.ScrumBacklogCtrl(element);
    assert.equal(ctrl.sprints.length, 0);

    await settle();

    assert.equal(fetchCount, 1);
    assert.equal(ctrl.sprints.length, 1);
    assert.equal(ctrl.sprints[0].id, "s9");
});
