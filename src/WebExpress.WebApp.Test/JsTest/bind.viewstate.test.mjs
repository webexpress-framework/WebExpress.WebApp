/**
 * Headless unit tests for the state and model binds writing into a ViewState.
 *
 * The binds resolve the enclosing ViewState as their store when the bound
 * element carries a resource binding, so a writing surface (a quickfilter, a
 * search box, a form field) writes into the shared state and, with
 * data-wx-model-query, triggers a central re-query - the write counterpart to a
 * control that renders the resource. These tests exercise the shipped
 * bind/default.js through the same headless engine the ViewState tests use.
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, appendServiceIsland, appendStateIsland, appendResourceIsland } from "./harness.mjs";

/**
 * Builds a ViewState host with the given islands, mirroring the C# emission.
 */
function buildViewState(engine, { viewStateId = "orders", state, service, resources } = {}) {
    const host = engine.document.createElement("div");
    host.dataset.wxViewstate = viewStateId;

    if (state) {
        appendStateIsland(engine.document, host, state);
    }
    if (service) {
        appendServiceIsland(engine.document, host, service);
    }
    for (const resource of resources || []) {
        appendResourceIsland(engine.document, host, resource);
    }

    return host;
}

/**
 * Builds a writing-surface element bound to a ViewState resource. The stub keeps
 * attributes and the dataset apart, so a test sets both the data-wx-resource
 * attribute the bind reads and the dataset the registry resolves by, which a
 * real browser keeps in sync on its own.
 */
function boundInput(engine, { model, query, resource, viewStateId }) {
    const input = engine.document.createElement("input");
    if (model) {
        input.setAttribute("data-wx-model", model);
    }
    if (query) {
        input.setAttribute("data-wx-model-query", query);
    }
    if (resource) {
        input.setAttribute("data-wx-resource", resource);
        input.dataset.wxResource = resource;
    }
    if (viewStateId) {
        input.setAttribute("data-wx-viewstate", viewStateId);
    }
    return input;
}

async function settle(viewState, turns = 6) {
    for (let i = 0; i < turns; i++) {
        await Promise.resolve();
    }
    viewState.flush();
}

test("a model bind resolves the bound ViewState, writes the path and re-queries the resource", async () => {
    const engine = loadEngine();
    const urls = [];
    engine.setFetch(async (url) => {
        urls.push(url);
        return { ok: true, status: 200, json: async () => ({ items: [], total: 0 }) };
    });

    const host = buildViewState(engine, {
        viewStateId: "orders",
        state: { filter: "", page: 3 },
        service: { name: "data", baseUri: "/api/orders", method: "GET", query: { filter: "f", page: "p" } },
        resources: [{
            name: "orders", service: "data", target: "orders", auto: false,
            params: [{ name: "filter", state: "filter", dir: "out" }, { name: "page", state: "page", dir: "inout" }]
        }]
    });
    const vs = new engine.wxapp.ViewState(host);

    const input = boundInput(engine, { model: "filter", query: "orders", resource: "orders" });
    host.appendChild(input);
    engine.wx.Binds.get("model").bind(input);

    input.value = "abc";
    input.dispatchEvent({ type: "input" });

    assert.equal(vs.getState().filter, "abc", "the write patches the shared ViewState state");

    await settle(vs);
    assert.ok(urls.some((u) => u.includes("f=abc")), "the resource re-queries with the new value");
});

test("a model bind without data-wx-model-query only patches the state, no re-query", async () => {
    const engine = loadEngine();
    let fetchCalls = 0;
    engine.setFetch(async () => {
        fetchCalls += 1;
        return { ok: true, status: 200, json: async () => ({ items: [], total: 0 }) };
    });

    const host = buildViewState(engine, {
        viewStateId: "orders",
        state: { draft: "" },
        service: { name: "data", baseUri: "/api/orders", method: "GET" },
        resources: [{ name: "orders", service: "data", target: "orders", auto: false, params: [] }]
    });
    const vs = new engine.wxapp.ViewState(host);

    const input = boundInput(engine, { model: "draft", resource: "orders" });
    host.appendChild(input);
    engine.wx.Binds.get("model").bind(input);

    input.value = "hello";
    input.dispatchEvent({ type: "input" });

    assert.equal(vs.getState().draft, "hello", "the write patches the shared state");

    await settle(vs);
    assert.equal(fetchCalls, 0, "a plain model write triggers no re-query");
});

test("a state bind reflects a slice of the bound ViewState", async () => {
    const engine = loadEngine();
    engine.setFetch(async () => ({ ok: true, status: 200, json: async () => ({ items: [], total: 0 }) }));

    const host = buildViewState(engine, {
        viewStateId: "orders",
        state: { filter: "open" },
        resources: [{ name: "orders", service: "data", target: "orders", auto: false, params: [] }]
    });
    const vs = new engine.wxapp.ViewState(host);

    const label = engine.document.createElement("span");
    label.setAttribute("data-wx-bind-path", "filter");
    label.setAttribute("data-wx-resource", "orders");
    label.dataset.wxResource = "orders";
    host.appendChild(label);
    engine.wx.Binds.get("state").bind(label);

    assert.equal(label.textContent, "open", "the initial slice is reflected");

    vs.setState({ filter: "closed" });
    vs.flush();

    assert.equal(label.textContent, "closed", "a state change updates the reflection");
});
