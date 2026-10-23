/**
 * Headless unit tests for the unique input model helpers (View, State and
 * Service).
 *
 * These cover the pure logic extracted from webexpress.webapp.input.unique.js:
 * the header parsing, the request body shaping and the availability extraction
 * with its configured field and the status and code heuristics, plus an end to
 * end path that checks uniqueness through the shared request and interprets the
 * result through the model.
 *
 * Run with Node 18 or newer from the jstest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, webappAsset } from "./harness.mjs";

function load(options) {
    return loadEngine(Object.assign(
        { extraFiles: [webappAsset("webexpress.webapp.input.unique.model.js")] },
        options
    ));
}

test("parse headers reads string pairs and tolerates invalid input", () => {
    const { wxapp } = load();
    assert.deepEqual(wxapp.inputUniqueModel.parseHeaders('{"X-A":"1","X-B":"2"}'), { "X-A": "1", "X-B": "2" });
    assert.deepEqual(wxapp.inputUniqueModel.parseHeaders(""), {});
    assert.deepEqual(wxapp.inputUniqueModel.parseHeaders("not json"), {});
    assert.deepEqual(wxapp.inputUniqueModel.parseHeaders('["a"]'), {});
    assert.deepEqual(wxapp.inputUniqueModel.parseHeaders('{"X-A":1,"X-B":"ok"}'), { "X-B": "ok" });
});

test("request body carries the configured parameter", () => {
    const { wxapp } = load();
    assert.deepEqual(wxapp.inputUniqueModel.requestBody("v", "name"), { v: "name" });
    assert.deepEqual(wxapp.inputUniqueModel.requestBody("login", "ann"), { login: "ann" });
});

test("extract availability reads the configured field as boolean, string or number", () => {
    const { wxapp } = load();
    const m = wxapp.inputUniqueModel;
    assert.equal(m.extractAvailability({ available: true }, "available"), true);
    assert.equal(m.extractAvailability({ available: false }, "available"), false);
    assert.equal(m.extractAvailability({ free: "true" }, "free"), true);
    assert.equal(m.extractAvailability({ free: "FALSE" }, "free"), false);
    assert.equal(m.extractAvailability({ ok: 1 }, "ok"), true);
    assert.equal(m.extractAvailability({ ok: 0 }, "ok"), false);
});

test("extract availability falls back to the status and code heuristics", () => {
    const { wxapp } = load();
    const m = wxapp.inputUniqueModel;
    assert.equal(m.extractAvailability({ status: "free" }, "available"), true);
    assert.equal(m.extractAvailability({ status: "available" }, "available"), true);
    assert.equal(m.extractAvailability({ status: "taken" }, "available"), false);
    assert.equal(m.extractAvailability({ status: "in_use" }, "available"), false);
    assert.equal(m.extractAvailability({ code: "available" }, "available"), true);
    assert.equal(m.extractAvailability({ code: "unavailable" }, "available"), false);
});

test("extract availability returns null when undecidable", () => {
    const { wxapp } = load();
    const m = wxapp.inputUniqueModel;
    assert.equal(m.extractAvailability({ foo: "bar" }, "available"), null);
    assert.equal(m.extractAvailability({ available: "maybe" }, "available"), null);
    assert.equal(m.extractAvailability(null, "available"), null);
});

test("model checks uniqueness through the shared request end to end", async () => {
    const { wxapp, setFetch } = load();
    const calls = [];
    setFetch(async (url, init) => {
        const method = (init && init.method) || "GET";
        calls.push({ url: url, method: method, body: init && init.body });
        return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({ available: false }) };
    });

    const res = await wxapp.ServiceRegistry.request("/api/unique?v=taken", { method: "GET" });
    assert.equal(calls[0].method, "GET");
    assert.equal(wxapp.inputUniqueModel.extractAvailability(res.data, "available"), false);
});
