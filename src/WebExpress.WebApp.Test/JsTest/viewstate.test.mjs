/**
 * Headless unit tests for the scope ViewState, the central artifact of the
 * View, State and Service architecture at scope scope.
 *
 * Run with Node 18 or newer from the jstest folder:
 *   node --test
 *
 * The tests load the real engine modules from Assets/js through a vm context
 * with a minimal DOM stub, so they exercise the shipped code rather than a copy.
 * The ViewState is the observable state container, so these tests cover both its
 * state core (the former Store responsibilities) and its scope wiring: seeding
 * from islands, central resource loading, bidirectional parameter binding,
 * scope resolution and teardown.
 */

import { test } from "node:test";
// loose assert: objects produced inside the engine's vm context have a
// different Object.prototype than this test realm, so deepStrictEqual would
// reject structurally equal objects. Loose deepEqual compares by structure.
import assert from "node:assert";
import { loadEngine, appendServiceIsland, appendStateIsland, appendResourceIsland } from "./harness.mjs";

/**
 * Builds a scope host element with the given state, service and resource
 * islands, mirroring the markup the C# ControlViewState emits.
 */
function buildScope(engine, { scope = "orders", state, service, resources } = {}) {
    const host = engine.document.createElement("div");
    host.dataset.wxScope = scope;

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
 * Awaits enough microtask turns for the fetch mock, the json parse and the
 * follow-up patches to settle, then flushes the batched notification.
 */
async function settle(viewState, turns = 6) {
    for (let i = 0; i < turns; i++) {
        await Promise.resolve();
    }
    viewState.flush();
}

// state core (the responsibilities the ViewState absorbs from the former Store)

test("view state applies a shallow patch and notifies once after flush", () => {
    const engine = loadEngine();
    const vs = new engine.wxapp.ViewState(buildScope(engine, { state: { a: 1, b: 2 } }));

    let calls = 0;
    let last = null;
    vs.subscribe((state) => { calls += 1; last = state; });

    vs.setState({ a: 10 });
    vs.setState({ b: 20 });
    vs.flush();

    assert.equal(calls, 1);
    assert.equal(last.a, 10);
    assert.equal(last.b, 20);
});

test("view state does not notify when nothing changes, so an echoed value cannot loop", () => {
    const engine = loadEngine();
    const vs = new engine.wxapp.ViewState(buildScope(engine, { state: { page: 2 } }));

    let calls = 0;
    vs.subscribe(() => { calls += 1; });

    vs.setState({ page: 2 });
    vs.flush();

    assert.equal(calls, 0);
});

test("view state watch fires only when the selected slice changes", () => {
    const engine = loadEngine();
    const vs = new engine.wxapp.ViewState(buildScope(engine, { state: { a: 1, b: 1 } }));

    let aCalls = 0;
    vs.watch((state) => state.a, () => { aCalls += 1; });

    vs.setState({ b: 2 });
    vs.flush();
    assert.equal(aCalls, 0);

    vs.setState({ a: 5 });
    vs.flush();
    assert.equal(aCalls, 1);
});

// seeding from the islands

test("view state seeds its state, services and resources from the islands", () => {
    const engine = loadEngine();
    const host = buildScope(engine, {
        state: { page: 0, search: "" },
        service: { name: "data", baseUri: "/api/orders", method: "GET" },
        resources: [{ name: "orders", service: "data", target: "orders", params: [{ name: "page", state: "page" }] }]
    });

    const vs = new engine.wxapp.ViewState(host);

    assert.equal(vs.getState().page, 0);
    assert.ok(vs.useService("data"));
    assert.equal(vs.resource("orders").target, "orders");
    assert.equal(vs.resource("orders").params[0].name, "page");
    // the islands are consumed on read, so they do not linger in the host
    assert.equal(host.childNodes.filter((n) => n.tagName === "WX-RESOURCE").length, 0);
});

// central resource loading

test("view state loads a resource centrally and reduces it into the target slice", async () => {
    const engine = loadEngine();
    let captured = null;
    engine.setFetch(async (url) => {
        captured = url;
        return { ok: true, status: 200, json: async () => ({ items: [1, 2, 3], total: 3, page: 0 }) };
    });

    const host = buildScope(engine, {
        state: { page: 0, search: "x" },
        service: { name: "data", baseUri: "/api/orders", method: "GET", query: { page: "p", search: "q" }, response: { items: "items", total: "total" } },
        resources: [{
            name: "orders", service: "data", target: "orders", auto: false,
            params: [{ name: "page", state: "page", dir: "inout" }, { name: "search", state: "search", dir: "out" }]
        }]
    });

    const vs = new engine.wxapp.ViewState(host);
    await vs.load("orders");
    vs.flush();

    assert.ok(captured.includes("p=0"), "outbound param page maps to the wire name");
    assert.ok(captured.includes("q=x"), "outbound param search maps to the wire name");
    assert.equal(vs.getState().orders.items.length, 3);
    assert.equal(vs.getState().orders.total, 3);
    assert.equal(vs.getState().orders.loading, false);
    assert.equal(vs.getState().orders.error, null);
});

test("an automatic resource triggers a central load on mount", () => {
    const engine = loadEngine();
    let fetchCalls = 0;
    engine.setFetch(async () => {
        fetchCalls += 1;
        return { ok: true, status: 200, json: async () => ({ items: [], total: 0 }) };
    });

    const host = buildScope(engine, {
        state: { page: 0 },
        service: { name: "data", baseUri: "/api/orders", method: "GET" },
        resources: [{ name: "orders", service: "data", target: "orders", params: [{ name: "page", state: "page" }] }]
    });

    new engine.wxapp.ViewState(host);

    // the load reaches the synchronous fetch call inside the constructor
    assert.equal(fetchCalls, 1);
});

test("an inbound parameter writes the echoed value back to state, bidirectionally", async () => {
    const engine = loadEngine();
    let fetchCalls = 0;
    engine.setFetch(async () => {
        fetchCalls += 1;
        // the server clamps the page and echoes the effective value
        return { ok: true, status: 200, json: async () => ({ items: [], total: 0, page: 2 }) };
    });

    const host = buildScope(engine, {
        state: { page: 9 },
        service: { name: "data", baseUri: "/api/orders", method: "GET", query: { page: "p" } },
        resources: [{ name: "orders", service: "data", target: "orders", auto: false, params: [{ name: "page", state: "page", dir: "inout" }] }]
    });

    const vs = new engine.wxapp.ViewState(host);
    await vs.load("orders");
    vs.flush();

    assert.equal(vs.getState().page, 2, "the echoed page flows back into state");
    assert.equal(fetchCalls, 1, "the writeback does not trigger another load");
});

test("reload re-queries a resource with the current state", async () => {
    const engine = loadEngine();
    const urls = [];
    engine.setFetch(async (url) => {
        urls.push(url);
        return { ok: true, status: 200, json: async () => ({ items: [], total: 0 }) };
    });

    const host = buildScope(engine, {
        state: { search: "a" },
        service: { name: "data", baseUri: "/api/orders", method: "GET", query: { search: "q" } },
        resources: [{ name: "orders", service: "data", target: "orders", auto: false, params: [{ name: "search", state: "search", dir: "out" }] }]
    });

    const vs = new engine.wxapp.ViewState(host);
    await vs.load("orders");
    vs.setState({ search: "b" });
    await vs.reload("orders");

    assert.ok(urls[0].includes("q=a"));
    assert.ok(urls[1].includes("q=b"));
});

// the scope query intent

test("the view/query intent merges a patch and re-queries the resource", async () => {
    const engine = loadEngine();
    let fetchCalls = 0;
    engine.setFetch(async () => {
        fetchCalls += 1;
        return { ok: true, status: 200, json: async () => ({ items: [], total: 0 }) };
    });

    const host = buildScope(engine, {
        state: { search: "", page: 5 },
        service: { name: "data", baseUri: "/api/orders", method: "GET", query: { search: "q", page: "p" } },
        resources: [{ name: "orders", service: "data", target: "orders", auto: false, params: [{ name: "search", state: "search", dir: "out" }] }]
    });

    const vs = new engine.wxapp.ViewState(host);
    vs.dispatch("view/query", { patch: { search: "abc", page: 0 }, resource: "orders" });

    assert.equal(vs.getState().search, "abc", "the reducer patch is applied synchronously");
    assert.equal(vs.getState().page, 0);

    await settle(vs);
    assert.equal(fetchCalls, 1, "the effect re-queries the resource");
});

// scope resolution

test("the registry resolves a scope by explicit id and by ancestry", () => {
    const engine = loadEngine();
    const host = buildScope(engine, { scope: "outer", state: { a: 1 } });
    const vs = new engine.wxapp.ViewState(host);

    const child = engine.document.createElement("div");
    host.appendChild(child);

    assert.equal(engine.wxapp.ViewStateRegistry.get("outer"), vs);
    assert.equal(engine.wxapp.ViewStateRegistry.resolve(child), vs, "the nearest enclosing scope is resolved");
    assert.equal(engine.wxapp.ViewStateRegistry.resolve(child, "outer"), vs, "an explicit id resolves the scope");
});

test("the registry resolves a scope by the resource a control binds, and serves its service", () => {
    const engine = loadEngine();
    engine.setFetch(async () => ({ ok: true, status: 200, json: async () => ({ items: [], total: 0 }) }));

    const host = buildScope(engine, {
        scope: "orders-scope",
        service: { name: "data", baseUri: "/api/orders", method: "GET" },
        resources: [{ name: "orders", service: "data", target: "orders", auto: false, params: [] }]
    });
    const vs = new engine.wxapp.ViewState(host);

    // a control finds its scope by the resource it binds, not by ancestry
    assert.equal(engine.wxapp.ViewStateRegistry.resolveByResource("orders"), vs);
    // and uses the service the resource declares
    const service = vs.serviceForResource("orders");
    assert.ok(service, "serviceForResource returns the resource's service");
    assert.equal(service.baseUri, "/api/orders");
});

test("a nested scope shadows the outer one for its own controls", () => {
    const engine = loadEngine();
    const outer = buildScope(engine, { scope: "outer", state: { level: "outer" } });
    const outerVs = new engine.wxapp.ViewState(outer);

    const inner = buildScope(engine, { scope: "inner", state: { level: "inner" } });
    outer.appendChild(inner);
    const innerVs = new engine.wxapp.ViewState(inner);

    const innerChild = engine.document.createElement("div");
    inner.appendChild(innerChild);

    assert.equal(engine.wxapp.ViewStateRegistry.resolve(innerChild), innerVs);
    assert.notEqual(engine.wxapp.ViewStateRegistry.resolve(innerChild), outerVs);
});

test("whenReady resolves a control that asked before its scope existed", () => {
    const engine = loadEngine();
    const host = buildScope(engine, { scope: "late", state: { a: 1 } });
    const child = engine.document.createElement("div");
    host.appendChild(child);

    let resolved = null;
    // the control asks before the scope host is instantiated (children first)
    engine.wxapp.ViewStateRegistry.whenReady(child, null, (vs) => { resolved = vs; });
    assert.equal(resolved, null);

    const vs = new engine.wxapp.ViewState(host);
    assert.equal(resolved, vs, "registering the scope resolves the pending request");
});

// teardown

test("destroy aborts services, unregisters and releases the back-reference", () => {
    const engine = loadEngine();
    const host = buildScope(engine, {
        scope: "orders",
        state: { a: 1 },
        service: { name: "data", baseUri: "/api/orders", method: "GET" }
    });
    const vs = new engine.wxapp.ViewState(host);

    let calls = 0;
    vs.subscribe(() => { calls += 1; });

    vs.destroy();

    assert.equal(engine.wxapp.ViewStateRegistry.get("orders"), null);
    assert.equal(host._wxViewState, undefined);

    vs.setState({ a: 2 });
    vs.flush();
    assert.equal(calls, 0, "a destroyed view state notifies no one");
});
