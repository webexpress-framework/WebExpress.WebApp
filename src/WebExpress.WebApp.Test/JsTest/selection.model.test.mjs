/**
 * Headless unit tests for the REST selection model helpers (View, State and
 * Service).
 *
 * These cover the pure logic extracted from webexpress.webapp.selection.js: the
 * request url and init shaping and the response item mapping, plus an end to end
 * path that searches through the shared request and maps the result.
 *
 * Run with Node 18 or newer from the jstest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, webappAsset } from "./harness.mjs";

function load(options) {
    return loadEngine(Object.assign(
        { extraFiles: [webappAsset("webexpress.webapp.selection.model.js")] },
        options
    ));
}

test("build url appends the query and page for get and is unchanged otherwise", () => {
    const { wxapp } = load();
    const cfg = { apiEndpoint: "/api/s", httpMethod: "GET", queryParam: "q", pageParam: "p", page: 0 };
    assert.equal(wxapp.selectionModel.buildUrl(cfg, "ab"), "/api/s?q=ab&p=0");

    const cfgQ = { apiEndpoint: "/api/s?x=1", httpMethod: "GET", queryParam: "q", pageParam: "p", page: 2 };
    assert.equal(wxapp.selectionModel.buildUrl(cfgQ, "a b"), "/api/s?x=1&q=a%20b&p=2");

    assert.equal(wxapp.selectionModel.buildUrl({ apiEndpoint: "/api/s", httpMethod: "POST" }, "x"), "/api/s");
});

test("build request init carries a json body for post and a signal for get", () => {
    const { wxapp } = load();
    const post = wxapp.selectionModel.buildRequestInit({ httpMethod: "POST", queryParam: "q", pageParam: "p", page: 1 }, "term", "SIG");
    assert.equal(post.method, "POST");
    assert.equal(post.headers["Content-Type"], "application/json");
    assert.deepEqual(JSON.parse(post.body), { q: "term", p: 1 });
    assert.equal(post.signal, "SIG");

    const get = wxapp.selectionModel.buildRequestInit({ httpMethod: "GET" }, "term", "SIG");
    assert.equal(get.method, "GET");
    assert.equal(get.signal, "SIG");
    assert.equal("body" in get, false);
});

test("map api item chooses field aliases defensively", () => {
    const { wxapp } = load();
    const item = wxapp.selectionModel.mapApiItem({ id: "1", content: "C", url: "/u", disabled: true });
    assert.equal(item.id, "1");
    assert.equal(item.label, "C");
    assert.equal(item.primaryUri, "/u");
    assert.equal(item.disabled, true);

    const empty = wxapp.selectionModel.mapApiItem({});
    assert.equal(empty.id, null);
    assert.equal(empty.label, "");
    assert.equal(empty.disabled, false);
});

test("map api item maps the RestApiSelectionItem text field to the label", () => {
    const { wxapp } = load();
    // the server sends { id, text, color, uri } (WebApp.WebRestApi.RestApiSelectionItem);
    // without the text alias the read-only tags render with an empty label
    const item = wxapp.selectionModel.mapApiItem({ id: "1", text: "Monkey Island" });
    assert.equal(item.label, "Monkey Island");
});

test("model searches and maps the result through the shared request end to end", async () => {
    const { wxapp, setFetch } = load();
    const calls = [];
    setFetch(async (url, init) => {
        calls.push({ url: url, method: (init && init.method) || "GET" });
        return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({ items: [{ id: "1", label: "One" }] }) };
    });

    const cfg = { apiEndpoint: "/api/s", httpMethod: "GET", queryParam: "q", pageParam: "p", page: 0 };
    const url = wxapp.selectionModel.buildUrl(cfg, "on");
    const init = wxapp.selectionModel.buildRequestInit(cfg, "on", null);
    const res = await wxapp.ServiceRegistry.request(url, init);

    assert.equal(calls[0].url, "/api/s?q=on&p=0");
    const mapped = (res.data.items || []).map((x) => wxapp.selectionModel.mapApiItem(x));
    assert.equal(mapped[0].label, "One");
});
