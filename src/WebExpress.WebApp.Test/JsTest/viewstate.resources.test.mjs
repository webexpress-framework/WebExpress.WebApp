/**
 * Headless tests for the parts of the View, State and Service architecture that
 * hold more than one resource, more than one ViewState or a request that outlives
 * its control: parallel loads of one service, the per-ViewState scope of resource
 * names, the teardown of the resource index, the target a resource loads into,
 * an abort during a retry, the result contract of a broken response, and a
 * reducer that fails before its effect.
 *
 * Run with Node 18 or newer from the jstest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, webappAsset, appendServiceIsland, appendStateIsland, appendResourceIsland } from "./harness.mjs";

/**
 * Builds a ViewState host with the given islands, mirroring the markup the C#
 * ControlViewState emits.
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
 * Builds a fetch that answers when told to and honours the abort signal the way
 * the browser does: a request whose signal is aborted rejects with an AbortError
 * and never answers.
 * @returns {{fetch: Function, answer: Function, pending: Function}} The mock and its controls.
 */
function deferredFetch() {
    const requests = [];

    return {
        fetch(url, init) {
            return new Promise((resolve, reject) => {
                const entry = { url, resolve, reject, aborted: false, answered: false };
                requests.push(entry);

                if (init && init.signal) {
                    init.signal.addEventListener("abort", () => {
                        entry.aborted = true;
                        const error = new Error("aborted");
                        error.name = "AbortError";
                        reject(error);
                    });
                }
            });
        },
        answer(match, body) {
            const entry = requests.find((r) => r.url.includes(match) && !r.aborted && !r.answered);
            entry.answered = true;
            entry.resolve({ ok: true, status: 200, json: async () => body });
        },
        pending() {
            return requests.filter((r) => !r.aborted).map((r) => r.url);
        }
    };
}

async function settle(viewState, turns = 8) {
    for (let i = 0; i < turns; i++) {
        await Promise.resolve();
    }
    viewState.flush();
}

// parallel resources

test("two resources of one service load side by side, and each ends its own loading state", async () => {
    const engine = loadEngine();
    const net = deferredFetch();
    engine.setFetch(net.fetch);

    const host = buildViewState(engine, {
        state: {},
        service: { name: "data", baseUri: "/api/orders", method: "GET" },
        resources: [
            { name: "orders", service: "data", target: "orders", auto: false, params: [] },
            { name: "summary", service: "data", target: "summary", auto: false, params: [] }
        ]
    });
    const vs = new engine.wxapp.ViewState(host);

    const loads = Promise.all([vs.load("orders"), vs.load("summary")]);
    await settle(vs);

    assert.equal(net.pending().length, 2, "the second query did not cancel the first");

    net.answer("/api/orders", { items: [1], total: 1 });
    net.answer("/api/orders", { items: [2, 3], total: 2 });
    await loads;
    await settle(vs);

    assert.equal(vs.getState().orders.loading, false, "the first resource is not left loading");
    assert.equal(vs.getState().summary.loading, false);
    assert.deepEqual(vs.getState().orders.items, [1]);
    assert.deepEqual(vs.getState().summary.items, [2, 3]);
});

test("a newer load of the same resource supersedes the older one, and the slice follows the newer", async () => {
    const engine = loadEngine();
    const net = deferredFetch();
    engine.setFetch(net.fetch);

    const host = buildViewState(engine, {
        state: {},
        service: { name: "data", baseUri: "/api/orders", method: "GET" },
        resources: [{ name: "orders", service: "data", target: "orders", auto: false, params: [] }]
    });
    const vs = new engine.wxapp.ViewState(host);

    const first = vs.load("orders");
    await settle(vs);
    const second = vs.load("orders");
    await settle(vs);

    assert.equal(net.pending().length, 1, "the older query of the same resource is cancelled");
    assert.equal(vs.getState().orders.loading, true, "the newer load is still in flight");

    net.answer("/api/orders", { items: [9], total: 1 });
    await Promise.all([first, second]);
    await settle(vs);

    assert.equal(vs.getState().orders.loading, false);
    assert.deepEqual(vs.getState().orders.items, [9]);
});

test("an abort without a newer load ends the loading state instead of leaving it for good", async () => {
    const engine = loadEngine();
    const net = deferredFetch();
    engine.setFetch(net.fetch);

    const host = buildViewState(engine, {
        state: {},
        service: { name: "data", baseUri: "/api/orders", method: "GET" },
        resources: [{ name: "orders", service: "data", target: "orders", auto: false, params: [] }]
    });
    const vs = new engine.wxapp.ViewState(host);

    const load = vs.load("orders");
    await settle(vs);
    vs.useService("data").abort();
    await load;
    await settle(vs);

    assert.equal(vs.getState().orders.loading, false, "nothing is loading any more");
    assert.equal(vs.getState().orders.error, null, "an abort is not an error");
});

// the registry

test("a control inside a ViewState is bound to it even when another ViewState declares the same resource name", () => {
    const engine = loadEngine();
    engine.setFetch(async () => ({ ok: true, status: 200, json: async () => ({ items: [], total: 0 }) }));

    const first = buildViewState(engine, {
        viewStateId: "first",
        resources: [{ name: "items", service: "data", target: "items", auto: false, params: [] }]
    });
    const second = buildViewState(engine, {
        viewStateId: "second",
        resources: [{ name: "items", service: "data", target: "items", auto: false, params: [] }]
    });
    engine.document.body.appendChild(first);
    engine.document.body.appendChild(second);

    const firstVs = new engine.wxapp.ViewState(first);
    const secondVs = new engine.wxapp.ViewState(second);

    const control = engine.document.createElement("div");
    control.dataset.wxResource = "items";
    first.appendChild(control);

    assert.equal(engine.wxapp.ViewStateRegistry.resolve(control), firstVs, "the enclosing ViewState declaring the resource wins");

    const detached = engine.document.createElement("div");
    detached.dataset.wxResource = "items";
    engine.document.body.appendChild(detached);

    assert.equal(engine.wxapp.ViewStateRegistry.resolve(detached), secondVs, "outside of both, the last registered declares it");
});

test("a destroyed ViewState is no longer reachable through its resources", () => {
    const engine = loadEngine();
    engine.setFetch(async () => ({ ok: true, status: 200, json: async () => ({ items: [], total: 0 }) }));

    const host = buildViewState(engine, {
        viewStateId: "orders",
        resources: [{ name: "orders", service: "data", target: "orders", auto: false, params: [] }]
    });
    const vs = new engine.wxapp.ViewState(host);
    assert.equal(engine.wxapp.ViewStateRegistry.resolveByResource("orders"), vs);

    // a re-rendered host registers a fresh ViewState under the same id before the old
    // one tears down; the old one must still leave the resource index
    const replacement = new engine.wxapp.ViewState(buildViewState(engine, {
        viewStateId: "orders",
        resources: [{ name: "orders", service: "data", target: "orders", auto: false, params: [] }]
    }));
    vs.destroy();

    assert.equal(engine.wxapp.ViewStateRegistry.resolveByResource("orders"), replacement, "the replacement answers, not the destroyed one");

    replacement.destroy();
    assert.equal(engine.wxapp.ViewStateRegistry.resolveByResource("orders"), null, "nothing answers once the last owner is gone");
});

// the target of a resource

test("a resource is followed where it loads: its target, not its name", async () => {
    const engine = loadEngine();
    engine.setFetch(async () => ({ ok: true, status: 200, json: async () => ({ items: [1, 2], total: 2 }) }));

    const host = buildViewState(engine, {
        state: {},
        service: { name: "data", baseUri: "/api/orders", method: "GET" },
        resources: [{ name: "orders", service: "data", target: "board", auto: false, params: [] }]
    });
    const vs = new engine.wxapp.ViewState(host);

    assert.equal(vs.sliceKey("orders"), "board");
    assert.equal(vs.sliceKey("unknown"), "unknown", "a resource without a declaration is followed by its name");

    let seen = null;
    vs.watch((state) => vs.slice("orders", state), (slice) => { seen = slice; });

    await vs.load("orders");
    await settle(vs);

    assert.equal(vs.getState().orders, undefined, "nothing is written under the resource name");
    assert.deepEqual(vs.slice("orders").items, [1, 2]);
    assert.deepEqual(seen.items, [1, 2], "a watcher of the slice sees the load");
});

test("the table shows the progress while its slice is loading and hides it when the load is over", async () => {
    const engine = loadEngine({
        bootstrap: `
            webexpress.webui.TableReorderableCtrl = class extends webexpress.webui.Ctrl {
                constructor(element) {
                    super(element);
                    this._table = document.createElement("table");
                    this._columns = [];
                    this._rows = [];
                    this._options = [];
                    this._hasOptions = false;
                }
                render() { }
            };
        `,
        extraFiles: [webappAsset("webexpress.webapp.table.model.js"), webappAsset("webexpress.webapp.table.js")]
    });
    const net = deferredFetch();
    engine.setFetch(net.fetch);

    const host = buildViewState(engine, {
        viewStateId: "catalog",
        state: { page: 0, search: "" },
        service: { name: "data", baseUri: "/api/catalog", method: "GET", response: { rows: "rows", total: "total" } },
        resources: [{ name: "rows", service: "data", target: "catalog-rows", auto: false, params: [] }]
    });
    const vs = new engine.wxapp.ViewState(host);

    const tableHost = engine.createElement("div");
    tableHost.dataset.wxResource = "rows";
    host.appendChild(tableHost);
    const table = new engine.wxapp.TableCtrl(tableHost);

    const load = vs.load("rows");
    await settle(vs);
    assert.equal(table._isLoading, true, "the slice says loading, so does the table");

    net.answer("/api/catalog", { columns: [{ id: "c1", label: "C1" }], rows: [{ id: "r1", cells: [{ content: "A" }] }], total: 1 });
    await load;
    await settle(vs);

    assert.equal(table._isLoading, false);
    assert.equal(table._rows.length, 1, "the rows arrive under the target the resource declares");
});

// the service

test("an abort during the retry delay stops the retry from being sent", async () => {
    const engine = loadEngine();
    let calls = 0;
    engine.setFetch(async () => {
        calls += 1;
        return { ok: false, status: 503, headers: { get: () => "" } };
    });

    const service = engine.wxapp.ServiceRegistry.create({ name: "data", baseUri: "/api/orders", method: "GET", retry: { count: 3, delayMs: 5 } });
    const query = service.query({});
    await Promise.resolve();
    assert.equal(calls, 1, "the first attempt went out");

    // the control is torn down while the retry waits out its delay
    service.abort();
    const result = await query;

    assert.equal(calls, 1, "no retry was sent after the abort");
    assert.equal(result.ok, false);
    assert.equal(result.error.kind, "abort");
});

test("a broken response is a parse failure through request just as through query", async () => {
    const engine = loadEngine();
    engine.setFetch(async () => ({
        ok: true, status: 200,
        headers: { get: () => "application/json" },
        json: async () => { throw new SyntaxError("unexpected token"); },
        text: async () => "{"
    }));

    const service = engine.wxapp.ServiceRegistry.create({ name: "data", baseUri: "/api/orders", method: "GET" });
    const viaRequest = await service.request("/api/orders", { method: "GET" });
    const viaQuery = await service.query({});

    assert.equal(viaRequest.ok, false, "request does not report a broken body as a success");
    assert.equal(viaRequest.error.kind, "parse");
    assert.equal(viaRequest.data, null);
    assert.equal(viaQuery.ok, false);
    assert.equal(viaQuery.error.kind, "parse");
});

// intents

test("a reducer that fails stops the dispatch before the effect", () => {
    const engine = loadEngine();
    let effects = 0;
    const errors = [];
    const original = console.error;
    console.error = (...args) => { errors.push(args[0]); };

    try {
        engine.wxapp.Intents.register("order/save", {
            reduce() { throw new Error("state transition failed"); },
            effect() { effects += 1; }
        });

        const store = new engine.wxapp.ViewState(engine.document.createElement("div"), { standalone: true, state: {} });
        const returned = engine.wxapp.Intents.dispatch("order/save", { store: store, payload: {} });

        assert.equal(effects, 0, "no write is sent for a transition that never happened");
        assert.equal(returned, undefined);
        assert.ok(errors.some((e) => String(e).includes("reducer failed")), "the failure is logged");
    } finally {
        console.error = original;
        engine.wxapp.Intents.unregister("order/save");
    }
});

test("the kanban board keeps its loading state in step with the slice", async () => {
    const { loadControl } = await import("./controls.harness.mjs");
    const rt = loadControl({
        file: "webexpress.webapp.kanban.js",
        deps: ["webexpress.webapp.kanban.model.js"],
        fetch: async () => ({ ok: true, status: 200, json: async () => ({ columns: [], cards: [] }) })
    });

    const host = rt.createElement("div");
    host.dataset.wxViewstate = "board";
    appendServiceIsland(rt.document, host, { name: "data", baseUri: "/api/board", method: "GET" });
    appendResourceIsland(rt.document, host, { name: "board", service: "data", target: "board", auto: false, params: [] });
    rt.document.body.appendChild(host);
    const vs = new rt.wxapp.ViewState(host);

    const boardHost = rt.createElement("div");
    boardHost.setAttribute("data-wx-resource", "board");
    boardHost.dataset.wxResource = "board";
    host.appendChild(boardHost);
    const board = new rt.wxapp.KanbanCtrl(boardHost);

    vs.setState({ board: { loading: true, error: null } });
    vs.flush();
    assert.equal(board._loading, true, "a slice that is loading keeps the board loading");

    vs.setState({ board: { loading: false, error: null } });
    vs.flush();
    assert.equal(board._loading, false);
});
