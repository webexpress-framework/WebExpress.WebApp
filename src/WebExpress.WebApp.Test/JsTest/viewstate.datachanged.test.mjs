/**
 * Headless unit tests for the live data update wiring of the ViewState.
 *
 * Run with Node 18 or newer from the jstest folder:
 *   node --test
 *
 * When a wx-service island declares the domains its endpoint serves, the
 * ViewState registers on the message queue, subscribes those domains and
 * re-queries the resources of the changed domain when the server announces a
 * webexpress.webapp.data.changed message - including changes made by other
 * users. The queue is faked here; the wire contract it carries is pinned by
 * the C# tests in UnitTestDataChanged.
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, appendServiceIsland, appendStateIsland, appendResourceIsland } from "./harness.mjs";

const CHANGED_TYPE = "webexpress.webapp.data.changed";
const ORDER_DOMAIN = "my.app.order";

/**
 * Installs a fake message queue on the engine namespace that records
 * registrations and subscriptions and lets a test push a payload to every
 * registered listener, mirroring the surface the ViewState uses.
 */
function installQueue(engine) {
    const queue = {
        listeners: [],
        subscribed: [],
        register(listener) { this.listeners.push(listener); },
        unregister(listener) {
            const index = this.listeners.indexOf(listener);
            if (index >= 0) {
                this.listeners.splice(index, 1);
            }
        },
        subscribeDomains(domains) { this.subscribed.push(...domains); },
        push(payload) {
            for (const listener of this.listeners.slice()) {
                listener(payload);
            }
        }
    };

    engine.wxapp.MessageQueue = queue;
    return queue;
}

/**
 * Builds a ViewState host whose service declares the order domain and whose
 * resource binds that service, mirroring the markup the C# ControlViewState
 * emits for an endpoint with a derivable domain.
 */
function buildViewState(engine, { domains = [ORDER_DOMAIN], auto = false } = {}) {
    const host = engine.document.createElement("div");
    host.dataset.wxViewstate = "orders";

    appendStateIsland(engine.document, host, { page: 0 });
    appendServiceIsland(engine.document, host, {
        name: "data", baseUri: "/api/orders", method: "GET",
        domains: domains
    });
    appendResourceIsland(engine.document, host, {
        name: "orders", service: "data", target: "orders", auto: auto,
        params: [{ name: "page", state: "page" }]
    });

    return host;
}

/**
 * Awaits the coalescing window of the data change handling plus a few
 * microtask turns, so the scheduled re-query and its reduction settle.
 */
async function settleChanges(engine, ms = 80) {
    await new Promise((resolve) => setTimeout(resolve, ms));
    for (let i = 0; i < 6; i++) {
        await Promise.resolve();
    }
}

test("a ViewState with domain-declaring services registers and subscribes on the queue", () => {
    const engine = loadEngine();
    const queue = installQueue(engine);

    new engine.wxapp.ViewState(buildViewState(engine));

    assert.equal(queue.listeners.length, 1, "the ViewState registers one queue listener");
    assert.deepEqual(queue.subscribed, [ORDER_DOMAIN], "the ViewState subscribes the service's domains");
});

test("a ViewState without domains stays detached from the queue", () => {
    const engine = loadEngine();
    const queue = installQueue(engine);

    new engine.wxapp.ViewState(buildViewState(engine, { domains: [] }));

    assert.equal(queue.listeners.length, 0);
    assert.equal(queue.subscribed.length, 0);
});

test("a data change of the subscribed domain re-queries the bound resource", async () => {
    const engine = loadEngine();
    const queue = installQueue(engine);

    let fetchCalls = 0;
    engine.setFetch(async () => {
        fetchCalls += 1;
        return { ok: true, status: 200, json: async () => ({ items: [fetchCalls], total: 1 }) };
    });

    const vs = new engine.wxapp.ViewState(buildViewState(engine));

    queue.push({ type: CHANGED_TYPE, domain: ORDER_DOMAIN, operation: "updated", itemId: "42" });
    await settleChanges(engine);
    vs.flush();

    assert.equal(fetchCalls, 1, "the change triggers exactly one re-query");
    assert.deepEqual(vs.getState().orders.items, [1], "the slice carries the re-queried data");
});

test("the domain matching is case-insensitive, mirroring the server derivation", async () => {
    const engine = loadEngine();
    const queue = installQueue(engine);

    let fetchCalls = 0;
    engine.setFetch(async () => {
        fetchCalls += 1;
        return { ok: true, status: 200, json: async () => ({ items: [], total: 0 }) };
    });

    new engine.wxapp.ViewState(buildViewState(engine));

    queue.push({ type: CHANGED_TYPE, domain: "My.App.Order", operation: "created" });
    await settleChanges(engine);

    assert.equal(fetchCalls, 1);
});

test("a change of a foreign domain and non-change messages are ignored", async () => {
    const engine = loadEngine();
    const queue = installQueue(engine);

    let fetchCalls = 0;
    engine.setFetch(async () => {
        fetchCalls += 1;
        return { ok: true, status: 200, json: async () => ({ items: [], total: 0 }) };
    });

    new engine.wxapp.ViewState(buildViewState(engine));

    queue.push({ type: CHANGED_TYPE, domain: "my.app.customer", operation: "updated" });
    queue.push({ type: "webexpress.webapp.collaborative.cursor", domain: ORDER_DOMAIN });
    queue.push("not an object");
    queue.push(null);
    await settleChanges(engine);

    assert.equal(fetchCalls, 0);
});

test("a burst of changes coalesces into one re-query per resource", async () => {
    const engine = loadEngine();
    const queue = installQueue(engine);

    let fetchCalls = 0;
    engine.setFetch(async () => {
        fetchCalls += 1;
        return { ok: true, status: 200, json: async () => ({ items: [], total: 0 }) };
    });

    new engine.wxapp.ViewState(buildViewState(engine));

    for (let i = 0; i < 5; i++) {
        queue.push({ type: CHANGED_TYPE, domain: ORDER_DOMAIN, operation: "updated", itemId: String(i) });
    }
    await settleChanges(engine);

    assert.equal(fetchCalls, 1, "five change messages trigger one re-query");
});

test("destroy unregisters the queue listener and cancels a pending re-query", async () => {
    const engine = loadEngine();
    const queue = installQueue(engine);

    let fetchCalls = 0;
    engine.setFetch(async () => {
        fetchCalls += 1;
        return { ok: true, status: 200, json: async () => ({ items: [], total: 0 }) };
    });

    const vs = new engine.wxapp.ViewState(buildViewState(engine));

    queue.push({ type: CHANGED_TYPE, domain: ORDER_DOMAIN, operation: "updated" });
    vs.destroy();
    await settleChanges(engine);

    assert.equal(queue.listeners.length, 0, "the listener is unregistered");
    assert.equal(fetchCalls, 0, "the pending re-query is cancelled");
});

test("controls bound to a re-queried resource play the change flash", async () => {
    const engine = loadEngine();
    const queue = installQueue(engine);

    engine.setFetch(async () => ({ ok: true, status: 200, json: async () => ({ items: [], total: 0 }) }));

    const host = buildViewState(engine);
    engine.document.body.appendChild(host);

    // a ViewState-bound control carries the data-wx-resource binding on its host
    const control = engine.document.createElement("div");
    control.setAttribute("data-wx-resource", "orders");
    engine.document.body.appendChild(control);

    const other = engine.document.createElement("div");
    other.setAttribute("data-wx-resource", "customers");
    engine.document.body.appendChild(other);

    new engine.wxapp.ViewState(host);

    queue.push({ type: CHANGED_TYPE, domain: ORDER_DOMAIN, operation: "updated" });
    await settleChanges(engine);

    assert.ok(control.classList.contains("wx-data-changed"), "the bound control flashes");
    assert.ok(!other.classList.contains("wx-data-changed"), "an unrelated control does not flash");
});

test("the change flash is removed after its duration and can restart", async () => {
    const engine = loadEngine();
    const queue = installQueue(engine);

    engine.setFetch(async () => ({ ok: true, status: 200, json: async () => ({ items: [], total: 0 }) }));

    // shorten the flash so the removal is observable without a long wait
    engine.wxapp.DataChangeSubscription.FLASH_MS = 40;

    const host = buildViewState(engine);
    engine.document.body.appendChild(host);
    const control = engine.document.createElement("div");
    control.setAttribute("data-wx-resource", "orders");
    engine.document.body.appendChild(control);

    new engine.wxapp.ViewState(host);

    queue.push({ type: CHANGED_TYPE, domain: ORDER_DOMAIN, operation: "updated" });
    await settleChanges(engine, 70);
    assert.ok(control.classList.contains("wx-data-changed"), "the flash is playing");

    await new Promise((resolve) => setTimeout(resolve, 80));
    assert.ok(!control.classList.contains("wx-data-changed"), "the flash class is removed");

    queue.push({ type: CHANGED_TYPE, domain: ORDER_DOMAIN, operation: "deleted" });
    await settleChanges(engine, 70);
    assert.ok(control.classList.contains("wx-data-changed"), "a later change flashes again");
});

test("attachReload wires a standalone control's service to a reload and a flash", async () => {
    const engine = loadEngine();
    const queue = installQueue(engine);

    const element = engine.document.createElement("div");
    let reloads = 0;
    const service = { domains: [ORDER_DOMAIN] };

    const subscription = engine.wxapp.DataChangeSubscription.attachReload(
        [service], () => { reloads += 1; }, element);

    assert.ok(subscription, "a service with domains attaches");
    assert.deepEqual(queue.subscribed, [ORDER_DOMAIN]);

    queue.push({ type: CHANGED_TYPE, domain: ORDER_DOMAIN, operation: "updated" });
    await settleChanges(engine);

    assert.equal(reloads, 1, "the change runs the reload");
    assert.ok(element.classList.contains("wx-data-changed"), "the element plays the change flash");

    subscription.detach();
    assert.equal(queue.listeners.length, 0, "detach unregisters the listener");
});

test("attachReload stays detached without domains", () => {
    const engine = loadEngine();
    const queue = installQueue(engine);

    const element = engine.document.createElement("div");
    const subscription = engine.wxapp.DataChangeSubscription.attachReload(
        [{ domains: [] }, null], () => { }, element);

    assert.equal(subscription, null);
    assert.equal(queue.listeners.length, 0);
    assert.equal(queue.subscribed.length, 0);
});

test("a standalone Data component reloads when a subscribed domain changes", async () => {
    const engine = loadEngine();
    const queue = installQueue(engine);

    const host = engine.document.createElement("div");
    appendServiceIsland(engine.document, host, {
        name: "data", baseUri: "/api/orders", method: "GET", domains: [ORDER_DOMAIN]
    });

    let loads = 0;
    const component = new (class extends engine.wxapp.Data {
        constructor(element) {
            super(element);
            this.mount();
        }
        load() {
            loads += 1;
        }
    })(host);

    assert.equal(queue.listeners.length, 1, "the component registers on the queue");
    assert.deepEqual(queue.subscribed, [ORDER_DOMAIN]);

    queue.push({ type: CHANGED_TYPE, domain: ORDER_DOMAIN, operation: "updated" });
    await settleChanges(engine);
    assert.equal(loads, 1, "the change reloads the component");
    assert.ok(host.classList.contains("wx-data-changed"), "the host plays the change flash");

    component.destroy();
    assert.equal(queue.listeners.length, 0, "destroy unregisters the listener");
});

test("all resources of the changed domain re-query, others stay untouched", async () => {
    const engine = loadEngine();
    const queue = installQueue(engine);

    const urls = [];
    engine.setFetch(async (url) => {
        urls.push(url);
        return { ok: true, status: 200, json: async () => ({ items: [], total: 0 }) };
    });

    const host = engine.document.createElement("div");
    host.dataset.wxViewstate = "mixed";
    appendServiceIsland(engine.document, host, {
        name: "orders-data", baseUri: "/api/orders", method: "GET", domains: [ORDER_DOMAIN]
    });
    appendServiceIsland(engine.document, host, {
        name: "customers-data", baseUri: "/api/customers", method: "GET", domains: ["my.app.customer"]
    });
    appendResourceIsland(engine.document, host, {
        name: "orders", service: "orders-data", target: "orders", auto: false, params: []
    });
    appendResourceIsland(engine.document, host, {
        name: "customers", service: "customers-data", target: "customers", auto: false, params: []
    });

    new engine.wxapp.ViewState(host);

    queue.push({ type: CHANGED_TYPE, domain: ORDER_DOMAIN, operation: "deleted" });
    await settleChanges(engine);

    assert.equal(urls.length, 1, "only the order resource re-queries");
    assert.ok(urls[0].includes("/api/orders"));
});
