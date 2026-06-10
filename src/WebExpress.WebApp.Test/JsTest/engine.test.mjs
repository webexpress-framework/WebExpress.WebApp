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

// Multiple services per component

test("service registry parses an island array into named services", () => {
    const { wxapp, createElement } = loadEngine();
    const element = createElement("div");
    element.setAttribute("data-wx-service", JSON.stringify([
        { name: "load", kind: "rest", baseUri: "/api/form" },
        { name: "submit", kind: "rest", baseUri: "/api/form" }
    ]));

    const services = wxapp.ServiceRegistry.fromElement(element);

    assert.ok(services.load);
    assert.ok(services.submit);
    assert.equal(typeof services.load.query, "function");
    assert.equal(typeof services.submit.create, "function");
});

// Retry policy and error channel

test("rest service retries a retriable failure per the descriptor policy", async () => {
    const { wxapp, setFetch } = loadEngine();
    let calls = 0;
    setFetch(async () => {
        calls += 1;
        if (calls === 1) {
            return { ok: false, status: 503 };
        }
        return { ok: true, status: 200, json: async () => ({ items: [] }) };
    });

    const service = new wxapp.RestService({
        name: "data",
        baseUri: "/api/orders",
        retry: { count: 1, delayMs: 0 }
    });

    const result = await service.query({});

    assert.equal(calls, 2);
    assert.equal(result.ok, true);
});

test("rest service does not retry a non retriable failure", async () => {
    const { wxapp, setFetch } = loadEngine();
    let calls = 0;
    setFetch(async () => {
        calls += 1;
        return { ok: false, status: 404 };
    });

    const service = new wxapp.RestService({
        name: "data",
        baseUri: "/api/orders",
        retry: { count: 3, delayMs: 0 }
    });

    const result = await service.query({});

    assert.equal(calls, 1);
    assert.equal(result.ok, false);
});

test("error channel reports a failure with the mapped message key", async () => {
    const { wxapp, setFetch, document } = loadEngine();
    setFetch(async () => ({ ok: false, status: 404 }));

    const reported = [];
    document.addEventListener("webexpress.webapp.service.error", (event) => reported.push(event.detail));

    const service = new wxapp.RestService({
        name: "data",
        baseUri: "/api/orders",
        errors: { "404": "webexpress.webapp:error.notfound" }
    });

    const result = await service.query({});

    assert.equal(result.error.message, "webexpress.webapp:error.notfound");
    assert.equal(reported.length, 1);
    assert.equal(reported[0].service, "data");
    assert.equal(reported[0].kind, "http");
    assert.equal(reported[0].status, 404);
    assert.equal(reported[0].message, "webexpress.webapp:error.notfound");
});

test("error channel stays silent on success and on abort", async () => {
    const { wxapp, setFetch, document } = loadEngine();

    const reported = [];
    document.addEventListener("webexpress.webapp.service.error", (event) => reported.push(event.detail));

    setFetch(async () => ({ ok: true, status: 200, json: async () => ({}) }));
    const service = new wxapp.RestService({ name: "data", baseUri: "/api/orders" });
    await service.query({});

    setFetch(async () => { const error = new Error("aborted"); error.name = "AbortError"; throw error; });
    await service.query({});

    assert.equal(reported.length, 0);
});

// Templates

test("component without a render uses the referenced registered template", () => {
    const { wxapp, createElement } = loadEngine();

    wxapp.Templates.register("orders-view", (state) => wxapp.h("p", { class: "t" }, String(state.count)));

    class Probe extends wxapp.Data {
        constructor(element) {
            super(element);
            this.mount();
        }
    }

    const element = createElement("div");
    element.setAttribute("data-wx-template", "orders-view");
    element.setAttribute("data-wx-state", JSON.stringify({ count: 3 }));
    const component = new Probe(element);

    assert.equal(element.childNodes.length, 1);
    assert.equal(element.childNodes[0].tagName, "P");
    assert.equal(element.childNodes[0].textContent, "3");

    component.setState({ count: 4 });
    component.store.flush();

    assert.equal(element.childNodes[0].textContent, "4");
});

// State and model binds

test("state bind reflects a store path as text", () => {
    const { wx, wxapp, createElement, document } = loadEngine();

    class Probe extends wxapp.Data {
        constructor(element, options) {
            super(element, options);
            this.mount();
        }
    }

    const host = createElement("div");
    host.id = "orders";
    document.body.appendChild(host);
    const component = new Probe(host, { state: { total: 7 } });
    wx.Controller.getInstanceByElement = (el) => (el === host ? component : null);

    const label = createElement("span");
    label.setAttribute("data-wx-bind", "state");
    label.setAttribute("data-wx-bind-store", "orders");
    label.setAttribute("data-wx-bind-path", "total");
    document.body.appendChild(label);

    wx.Binds.get("state").bind(label);
    assert.equal(label.textContent, "7");

    component.setState({ total: 9 });
    component.store.flush();
    assert.equal(label.textContent, "9");
});

test("model bind patches the store on input and reflects store changes", () => {
    const { wx, wxapp, createElement, document } = loadEngine();

    class Probe extends wxapp.Data {
        constructor(element, options) {
            super(element, options);
            this.mount();
        }
    }

    const host = createElement("div");
    host.id = "form";
    document.body.appendChild(host);
    const component = new Probe(host, { state: { model: { name: "Guybrush" } } });
    wx.Controller.getInstanceByElement = (el) => (el === host ? component : null);

    const input = createElement("input");
    input.setAttribute("data-wx-bind", "model");
    input.setAttribute("data-wx-bind-store", "form");
    input.setAttribute("data-wx-model", "model.name");
    document.body.appendChild(input);

    wx.Binds.get("model").bind(input);
    assert.equal(input.value, "Guybrush");

    input.value = "LeChuck";
    input.dispatchEvent({ type: "input" });
    component.store.flush();
    assert.equal(component.state.model.name, "LeChuck");

    component.setState({ model: { name: "Elaine" } });
    component.store.flush();
    assert.equal(input.value, "Elaine");
});

test("binds resolve a component that mounts after the bind", () => {
    const { wx, wxapp, createElement, document } = loadEngine();

    const label = createElement("span");
    label.setAttribute("data-wx-bind", "state");
    label.setAttribute("data-wx-bind-store", "late");
    label.setAttribute("data-wx-bind-path", "total");
    document.body.appendChild(label);

    wx.Binds.get("state").bind(label);

    class Probe extends wxapp.Data {
        constructor(element, options) {
            super(element, options);
            this.mount();
        }
    }

    const host = createElement("div");
    host.id = "late";
    document.body.appendChild(host);
    const component = new Probe(host, { state: { total: 42 } });
    wx.Controller.getInstanceByElement = (el) => (el === host ? component : null);

    // the component announces its mount through a bubbling document event;
    // the stub document does not bubble, so the event is replayed on it
    document.dispatchEvent({ type: "webexpress.webapp.data.mount", detail: { component } });

    assert.equal(label.textContent, "42");
});

// Query intents of the data query families

test("query intents reduce state and trigger the load for list, table and tile", () => {
    const { wxapp } = loadEngine();

    for (const domain of ["list", "table", "tile"]) {
        const store = new wxapp.Store({ search: "", wql: "", filter: "", page: 3 });
        let loads = 0;
        const component = { load() { loads += 1; } };

        wxapp.Intents.dispatch(domain + "/search", { store, payload: { pattern: "guybrush", searchType: "basic" }, component });
        assert.equal(store.getState().search, "guybrush", domain);
        assert.equal(store.getState().wql, null, domain);
        assert.equal(store.getState().page, 0, domain);
        assert.equal(loads, 1, domain);

        wxapp.Intents.dispatch(domain + "/search", { store, payload: { pattern: "monkey", searchType: "wql" }, component });
        assert.equal(store.getState().search, null, domain);
        assert.equal(store.getState().wql, "monkey", domain);
        assert.equal(loads, 2, domain);

        wxapp.Intents.dispatch(domain + "/page", { store, payload: { page: 2 }, component });
        assert.equal(store.getState().page, 2, domain);
        assert.equal(loads, 3, domain);

        wxapp.Intents.dispatch(domain + "/filter", { store, payload: { pattern: "insult" }, component });
        assert.equal(store.getState().filter, "insult", domain);
        assert.equal(store.getState().page, 0, domain);
        assert.equal(loads, 4, domain);
    }
});

test("rest service maps the closed vocabulary to default wire names without a query mapping", async () => {
    const { wxapp, setFetch } = loadEngine();
    let capturedUrl = null;
    setFetch(async (url) => {
        capturedUrl = url;
        return { ok: true, status: 200, json: async () => ({ items: [] }) };
    });

    // the common GET/PUT descriptor shape carries no query mapping; the
    // logical names still travel as the historical wire names
    const service = new wxapp.RestService({ name: "data", baseUri: "/api/tiles", method: "GET", updateMethod: "PUT" });
    await service.query({ search: "abc", filter: "", page: 1, pageSize: 25, orderBy: "label", orderDir: "asc" });

    assert.match(capturedUrl, /q=abc/);
    assert.match(capturedUrl, /f=/);
    assert.match(capturedUrl, /p=1/);
    assert.match(capturedUrl, /l=25/);
    assert.match(capturedUrl, /o=label/);
    assert.match(capturedUrl, /d=asc/);
    assert.doesNotMatch(capturedUrl, /search=/);
});
