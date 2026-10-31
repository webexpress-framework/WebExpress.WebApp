/**
 * Headless unit tests for the REST input selection model helpers (View, State
 * and Service).
 *
 * These cover the pure logic extracted from webexpress.webapp.input.selection.js:
 * the request url and init shaping and the response item mapping with its data
 * and aria attribute tuples, plus an end to end path that searches through the
 * shared request and maps the result.
 *
 * Run with Node 18 or newer from the jstest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, webappAsset } from "./harness.mjs";

function load(options) {
    return loadEngine(Object.assign(
        { extraFiles: [webappAsset("webexpress.webapp.input.selection.model.js")] },
        options
    ));
}

test("build url appends the query and page for get and is unchanged otherwise", () => {
    const { wxapp } = load();
    const cfg = { apiEndpoint: "/api/s", httpMethod: "GET", queryParam: "q", pageParam: "p", page: 0 };
    assert.equal(wxapp.inputSelectionModel.buildUrl(cfg, "ab"), "/api/s?q=ab&p=0");
    assert.equal(wxapp.inputSelectionModel.buildUrl({ apiEndpoint: "/api/s", httpMethod: "POST" }, "x"), "/api/s");
});

test("build request init carries a json body for post and a signal for get", () => {
    const { wxapp } = load();
    const post = wxapp.inputSelectionModel.buildRequestInit({ httpMethod: "POST", queryParam: "q", pageParam: "p", page: 1 }, "term", "SIG");
    assert.equal(post.method, "POST");
    assert.deepEqual(JSON.parse(post.body), { q: "term", p: 1 });
    assert.equal(post.signal, "SIG");

    const get = wxapp.inputSelectionModel.buildRequestInit({ httpMethod: "GET" }, "term", "SIG");
    assert.equal(get.method, "GET");
    assert.equal("body" in get, false);
});

test("map api item projects aliases and builds data and aria tuples", () => {
    const { wxapp } = load();
    const item = wxapp.inputSelectionModel.mapApiItem({
        id: "1",
        name: "N",
        data: { foo: "bar", "data-baz": "1" },
        aria: { label: "L" }
    });

    assert.equal(item.id, "1");
    assert.equal(item.value, "1");
    assert.equal(item.label, "N");
    assert.equal(item.content, "N");
    assert.equal(item.uri, "javascript:void(0);");
    assert.deepEqual(item.data, [["data-foo", "bar"], ["data-baz", "1"]]);
    assert.deepEqual(item.aria, [["aria-label", "L"]]);

    const withUri = wxapp.inputSelectionModel.mapApiItem({ id: "2", url: "/u" });
    assert.equal(withUri.uri, "/u");
});

test("model searches and maps the result through the shared request end to end", async () => {
    const { wxapp, setFetch } = load();
    const calls = [];
    setFetch(async (url, init) => {
        calls.push({ url: url, method: (init && init.method) || "GET" });
        return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({ items: [{ id: "1", content: "One" }] }) };
    });

    const cfg = { apiEndpoint: "/api/s", httpMethod: "GET", queryParam: "q", pageParam: "p", page: 0 };
    const url = wxapp.inputSelectionModel.buildUrl(cfg, "on");
    const init = wxapp.inputSelectionModel.buildRequestInit(cfg, "on", null);
    const res = await wxapp.ServiceRegistry.request(url, init);

    assert.equal(calls[0].url, "/api/s?q=on&p=0");
    const mapped = (res.data.items || []).map((x) => wxapp.inputSelectionModel.mapApiItem(x));
    assert.equal(mapped[0].label, "One");
    assert.equal(mapped[0].value, "1");
});
