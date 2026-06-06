/**
 * Headless unit tests for the View, State and Service engine (phase zero).
 *
 * Run with Node 18 or newer from the jstest folder:
 *   node --test
 *
 * The tests load the real engine modules from Assets/js through a vm context
 * with a minimal DOM stub, so they exercise the shipped code rather than a copy.
 */

import { test } from "node:test";
// loose assert: objects produced inside the engine's vm context have a
// different Object.prototype than this test realm, so deepStrictEqual would
// reject structurally equal objects. Loose deepEqual compares by structure.
import assert from "node:assert";
import { loadEngine } from "./harness.mjs";

// Store

test("store applies a shallow patch and notifies once after flush", () => {
    const { wxapp } = loadEngine();
    const store = new wxapp.Store({ a: 1, b: 2 });

    let calls = 0;
    let last = null;
    store.subscribe((state) => { calls += 1; last = state; });

    store.setState({ a: 10 });
    store.setState({ b: 20 });
    store.flush();

    assert.equal(calls, 1);
    assert.deepEqual(last, { a: 10, b: 20 });
    assert.equal(store.getState().a, 10);
});

test("store does not notify when nothing changes", () => {
    const { wxapp } = loadEngine();
    const store = new wxapp.Store({ a: 1 });

    let calls = 0;
    store.subscribe(() => { calls += 1; });

    store.setState({ a: 1 });
    store.flush();

    assert.equal(calls, 0);
});

test("store watch fires only when the selected slice changes", () => {
    const { wxapp } = loadEngine();
    const store = new wxapp.Store({ a: 1, b: 1 });

    let aCalls = 0;
    store.watch((state) => state.a, () => { aCalls += 1; });

    store.setState({ b: 2 });
    store.flush();
    assert.equal(aCalls, 0);

    store.setState({ a: 5 });
    store.flush();
    assert.equal(aCalls, 1);
});

test("store registry reference counts shared stores", () => {
    const { wxapp } = loadEngine();

    const first = wxapp.StoreRegistry.acquire("x", { n: 0 });
    const second = wxapp.StoreRegistry.acquire("x");
    assert.equal(first, second);

    wxapp.StoreRegistry.release("x");
    assert.equal(wxapp.StoreRegistry.get("x"), first);

    wxapp.StoreRegistry.release("x");
    assert.equal(wxapp.StoreRegistry.get("x"), null);
});

// Service

test("rest service maps parameters and normalises a success", async () => {
    const { wxapp, setFetch } = loadEngine();
    let capturedUrl = null;
    setFetch(async (url) => {
        capturedUrl = url;
        return { ok: true, status: 200, json: async () => ({ items: [1, 2, 3], total: 3 }) };
    });

    const service = new wxapp.RestService({
        name: "data",
        baseUri: "/api/orders",
        method: "GET",
        query: { search: "q", page: "p" },
        response: { items: "items", total: "total" }
    });

    const result = await service.query({ search: "abc", page: 2 });

    assert.equal(result.ok, true);
    assert.deepEqual(result.data, { items: [1, 2, 3], total: 3 });
    assert.match(capturedUrl, /\/api\/orders\?/);
    assert.match(capturedUrl, /q=abc/);
    assert.match(capturedUrl, /p=2/);
    assert.deepEqual(service.project(result.data), { items: [1, 2, 3], total: 3 });
});

test("rest service normalises an http error", async () => {
    const { wxapp, setFetch } = loadEngine();
    setFetch(async () => ({ ok: false, status: 404 }));

    const service = new wxapp.RestService({ baseUri: "/api/orders" });
    const result = await service.query({});

    assert.equal(result.ok, false);
    assert.equal(result.error.kind, "http");
    assert.equal(result.error.status, 404);
});

test("rest service returns an empty body for a 204 delete", async () => {
    const { wxapp, setFetch } = loadEngine();
    setFetch(async () => ({ ok: true, status: 204 }));

    const service = new wxapp.RestService({ baseUri: "/api/orders" });
    const result = await service.remove({ path: "/42" });

    assert.equal(result.ok, true);
    assert.equal(result.data, null);
    assert.equal(result.status, 204);
});

test("rest service normalises a network error", async () => {
    const { wxapp, setFetch } = loadEngine();
    setFetch(async () => { throw new TypeError("boom"); });

    const service = new wxapp.RestService({ baseUri: "/api/orders" });
    const result = await service.query({});

    assert.equal(result.ok, false);
    assert.equal(result.error.kind, "network");
});

test("service registry builds services from a data-wx-service island", () => {
    const { wxapp, createElement } = loadEngine();
    const element = createElement("div");
    element.setAttribute("data-wx-service", JSON.stringify({ name: "data", kind: "rest", baseUri: "/api/x" }));

    const services = wxapp.ServiceRegistry.fromElement(element);

    assert.ok(services.data);
    assert.equal(typeof services.data.query, "function");
});

test("rest service request parses json by content type and passes init through", async () => {
    const { wxapp, setFetch } = loadEngine();
    let capturedInit = null;
    setFetch(async (url, init) => {
        capturedInit = init;
        return {
            ok: true,
            status: 200,
            headers: { get: (h) => (h === "content-type" ? "application/json" : null) },
            json: async () => ({ a: 1 })
        };
    });

    const service = new wxapp.RestService({ baseUri: "/x" });
    const result = await service.request("/api/form?id=1", { method: "GET", credentials: "same-origin" });

    assert.equal(result.ok, true);
    assert.equal(result.status, 200);
    assert.equal(result.data.a, 1);
    assert.equal(capturedInit.method, "GET");
    assert.equal(capturedInit.credentials, "same-origin");
});

test("rest service request returns the body on a 400 for inspection", async () => {
    const { wxapp, setFetch } = loadEngine();
    setFetch(async () => ({
        ok: false,
        status: 400,
        headers: { get: () => "application/json" },
        json: async () => ({ errors: { name: "required" } })
    }));

    const service = new wxapp.RestService({ baseUri: "/x" });
    const result = await service.request("/api/form", { method: "POST" });

    assert.equal(result.ok, false);
    assert.equal(result.status, 400);
    assert.equal(result.data.errors.name, "required");
});

test("service registry request routes one off calls through a shared service", async () => {
    const { wxapp, setFetch } = loadEngine();
    const calls = [];
    setFetch(async (url, init) => {
        calls.push({ url: url, method: (init && init.method) || "GET" });
        return {
            ok: true,
            status: 200,
            headers: { get: (h) => (h === "content-type" ? "application/json" : null) },
            json: async () => ({ ok: true })
        };
    });

    const first = await wxapp.ServiceRegistry.request("/api/themes", { method: "GET" });
    const second = await wxapp.ServiceRegistry.request("/api/themes", { method: "PUT", body: "{}" });

    assert.equal(first.ok, true);
    assert.equal(first.data.ok, true);
    assert.equal(calls[0].url, "/api/themes");
    assert.equal(calls[1].method, "PUT");
    assert.equal(wxapp.ServiceRegistry._shared, wxapp.ServiceRegistry._shared);
    assert.ok(wxapp.ServiceRegistry._shared, "the shared service is created lazily and reused");
});

// Renderer

test("renderer creates elements and text", () => {
    const { wxapp, createElement } = loadEngine();
    const h = wxapp.h;
    const root = createElement("div");

    wxapp.Renderer.patch(root, [h("span", { class: "a" }, "hello"), h("b", null, "x")]);

    assert.equal(root.childNodes.length, 2);
    assert.equal(root.childNodes[0].tagName, "SPAN");
    assert.equal(root.childNodes[0].className, "a");
    assert.equal(root.childNodes[0].textContent, "hello");
    assert.equal(root.childNodes[1].tagName, "B");
});

test("renderer updates props and text in place", () => {
    const { wxapp, createElement } = loadEngine();
    const h = wxapp.h;
    const root = createElement("div");

    wxapp.Renderer.patch(root, [h("span", { class: "a" }, "hi")]);
    const span = root.childNodes[0];

    wxapp.Renderer.patch(root, [h("span", { class: "b", "data-x": "1" }, "ho")]);

    assert.equal(root.childNodes[0], span);
    assert.equal(span.className, "b");
    assert.equal(span.getAttribute("data-x"), "1");
    assert.equal(span.textContent, "ho");
});

test("renderer reorders keyed nodes and preserves identity", () => {
    const { wxapp, createElement } = loadEngine();
    const h = wxapp.h;
    const root = createElement("div");

    wxapp.Renderer.patch(root, [h("li", { key: "a" }, "A"), h("li", { key: "b" }, "B"), h("li", { key: "c" }, "C")]);
    const a = root.childNodes[0];
    const b = root.childNodes[1];
    const c = root.childNodes[2];

    wxapp.Renderer.patch(root, [h("li", { key: "c" }, "C"), h("li", { key: "a" }, "A"), h("li", { key: "b" }, "B")]);

    assert.equal(root.childNodes.length, 3);
    assert.equal(root.childNodes[0], c);
    assert.equal(root.childNodes[1], a);
    assert.equal(root.childNodes[2], b);
});

test("renderer keep flag preserves a nested subtree", () => {
    const { wxapp, createElement } = loadEngine();
    const h = wxapp.h;
    const root = createElement("div");

    wxapp.Renderer.patch(root, [h("div", { class: "host", keep: true })]);
    const host = root.childNodes[0];

    const nested = createElement("span");
    host.appendChild(nested);
    assert.equal(host.childNodes.length, 1);

    wxapp.Renderer.patch(root, [h("div", { class: "host2", keep: true })]);

    assert.equal(root.childNodes[0], host);
    assert.equal(host.className, "host2");
    assert.equal(host.childNodes.length, 1);
    assert.equal(host.childNodes[0], nested);
});

test("renderer removes stale nodes", () => {
    const { wxapp, createElement } = loadEngine();
    const h = wxapp.h;
    const root = createElement("div");

    wxapp.Renderer.patch(root, [h("li", null, "1"), h("li", null, "2"), h("li", null, "3")]);
    assert.equal(root.childNodes.length, 3);

    wxapp.Renderer.patch(root, [h("li", null, "1")]);
    assert.equal(root.childNodes.length, 1);
    assert.equal(root.childNodes[0].textContent, "1");
});

// Intents

test("intent reducer applies a patch to the store", () => {
    const { wxapp } = loadEngine();
    const store = new wxapp.Store({ count: 0 });
    wxapp.Intents.register("inc", { reduce: (state, payload) => ({ count: state.count + (payload || 1) }) });

    wxapp.Intents.dispatch("inc", { store, payload: 5 });

    assert.equal(store.getState().count, 5);
});

test("intent effect runs and can dispatch a follow up", () => {
    const { wxapp } = loadEngine();
    let effectRan = false;

    wxapp.Intents.register("load", {
        reduce: () => ({ loading: true }),
        effect: (context) => { effectRan = true; context.dispatch("done", { ok: true }); }
    });
    wxapp.Intents.register("done", { reduce: (state, payload) => ({ loading: false, ok: payload.ok }) });

    const store = new wxapp.Store({ loading: false });
    wxapp.Intents.dispatch("load", { store });

    assert.equal(effectRan, true);
    assert.equal(store.getState().loading, false);
    assert.equal(store.getState().ok, true);
});

test("intent dispatch of an unknown intent does not throw", () => {
    const { wxapp } = loadEngine();
    assert.doesNotThrow(() => wxapp.Intents.dispatch("nope", { store: new wxapp.Store({}) }));
});

// Component

test("component seeds state, renders and re-renders", () => {
    const { wxapp, createElement } = loadEngine();

    class Counter extends wxapp.Data {
        constructor(element) {
            super(element);
            this.mount();
        }
        render(state) {
            return wxapp.h("p", { class: "v" }, String(state.count));
        }
    }

    const element = createElement("div");
    element.setAttribute("data-wx-state", JSON.stringify({ count: 7 }));
    const component = new Counter(element);

    assert.equal(element.childNodes.length, 1);
    assert.equal(element.childNodes[0].tagName, "P");
    assert.equal(element.childNodes[0].textContent, "7");

    component.setState({ count: 8 });
    component.store.flush();

    assert.equal(element.childNodes[0].textContent, "8");
});

test("component readState parses the state island and tolerates its absence", () => {
    const { wxapp, createElement } = loadEngine();

    const withState = createElement("div");
    withState.setAttribute("data-wx-state", JSON.stringify({ a: 1 }));
    assert.deepEqual(wxapp.Data.readState(withState), { a: 1 });

    const withoutState = createElement("div");
    assert.deepEqual(wxapp.Data.readState(withoutState), {});
});

test("component seeds its store from the literal c# data-wx-state island", () => {
    const { wxapp, createElement } = loadEngine();

    // the exact compact json that a c# ControlState (page 0, pageSize 50) emits
    const island = '{"page":0,"pageSize":50}';

    const probe = createElement("div");
    probe.setAttribute("data-wx-state", island);
    assert.deepEqual(wxapp.Data.readState(probe), { page: 0, pageSize: 50 });

    class ListComponent extends wxapp.Data {
        constructor(element) {
            super(element);
            this.mount();
        }
        render(state) {
            return wxapp.h("span", { class: "p" }, String(state.page) + "/" + String(state.pageSize));
        }
    }

    const element = createElement("div");
    element.setAttribute("data-wx-state", island);
    const component = new ListComponent(element);

    assert.equal(element.childNodes[0].textContent, "0/50");
});

test("component destroy stops further renders", () => {
    const { wxapp, createElement } = loadEngine();

    class Probe extends wxapp.Data {
        constructor(element) {
            super(element);
            this.renders = 0;
            this.mount();
        }
        render(state) {
            this.renders += 1;
            return wxapp.h("span", null, String(state.n || 0));
        }
    }

    const element = createElement("div");
    const component = new Probe(element);
    const rendersAfterMount = component.renders;

    component.destroy();
    component.setState({ n: 5 });
    component.store.flush();

    assert.equal(component.renders, rendersAfterMount);
});
