/**
 * Headless unit tests for the REST form model helpers (phase two).
 *
 * These cover the pure logic extracted from webexpress.webapp.restform.js,
 * namely the request shaping, the response classification and the server error
 * normalisation, plus an end to end path through a service request.
 *
 * Run with Node 18 or newer from the jstest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, webappAsset } from "./harness.mjs";

function load(options) {
    return loadEngine(Object.assign(
        { extraFiles: [webappAsset("webexpress.webapp.restform.model.js")] },
        options
    ));
}

test("build load url carries the id and the mode", () => {
    const { wxapp } = load();
    const url = wxapp.restFormModel.buildLoadUrl("/api/form", 42, "edit", "http://localhost");

    assert.match(url, /\/api\/form\?/);
    assert.match(url, /id=42/);
    assert.match(url, /mode=edit/);
});

test("build request shapes a json body and appends the id for post", () => {
    const { wxapp } = load();
    const built = wxapp.restFormModel.buildRequest(
        "/api/form",
        { method: "POST", json: true, headers: { "Content-Type": "application/json; charset=utf-8" }, id: 5 },
        { name: "a" },
        "http://localhost"
    );

    assert.equal(built.init.method, "POST");
    assert.equal(JSON.parse(built.init.body).name, "a");
    assert.equal(built.init.headers["Content-Type"], "application/json; charset=utf-8");
    assert.match(built.url, /id=5/);
});

test("build request adds the json content type when missing", () => {
    const { wxapp } = load();
    const built = wxapp.restFormModel.buildRequest(
        "/api/form", { method: "POST", json: true, headers: {} }, { x: 1 }, "http://localhost");

    assert.equal(built.init.headers["Content-Type"], "application/json; charset=utf-8");
});

test("build request shapes a form encoded body when json is off", () => {
    const { wxapp } = load();
    const built = wxapp.restFormModel.buildRequest(
        "/api/form", { method: "POST", json: false, headers: {} }, { a: "1", b: "2" }, "http://localhost");

    assert.equal(built.init.headers["Content-Type"], "application/x-www-form-urlencoded; charset=utf-8");
    assert.match(built.init.body, /a=1/);
    assert.match(built.init.body, /b=2/);
});

test("build request for delete carries only the id and drops the content type", () => {
    const { wxapp } = load();
    const built = wxapp.restFormModel.buildRequest(
        "/api/form", { method: "DELETE", id: 9, headers: { "Content-Type": "application/json" } }, {}, "http://localhost");

    assert.equal(built.init.method, "DELETE");
    assert.equal(built.init.body, undefined);
    assert.match(built.url, /id=9/);
    assert.equal("Content-Type" in built.init.headers, false);
});

test("build request for get appends the payload as query parameters", () => {
    const { wxapp } = load();
    const built = wxapp.restFormModel.buildRequest(
        "/api/form", { method: "GET", headers: {} }, { q: "abc", f: "x" }, "http://localhost");

    assert.match(built.url, /q=abc/);
    assert.match(built.url, /f=x/);
    assert.equal(built.init.body, undefined);
});

test("classify response handles success, close, confirm, validation and error", () => {
    const { wxapp } = load();

    let c = wxapp.restFormModel.classifyResponse(true, 200, { ok: true });
    assert.equal(c.kind, "success");
    assert.equal(c.closeModal, true);

    c = wxapp.restFormModel.classifyResponse(true, 200, { message: "saved" });
    assert.equal(c.kind, "success");
    assert.equal(c.closeModal, false);
    assert.equal(c.message, "saved");

    c = wxapp.restFormModel.classifyResponse(true, 200, { message: "m", data: { confirmHtml: "<b>ok</b>" } });
    assert.equal(c.confirmHtml, "<b>ok</b>");

    c = wxapp.restFormModel.classifyResponse(false, 400, [{ field: "name", message: "required" }]);
    assert.equal(c.kind, "validation");
    assert.equal(c.errors[0].field, "name");
    assert.equal(c.errors[0].message, "required");

    c = wxapp.restFormModel.classifyResponse(false, 400, { errors: { email: "invalid" } });
    assert.equal(c.kind, "validation");
    assert.equal(c.errors[0].field, "email");
    assert.equal(c.errors[0].message, "invalid");

    c = wxapp.restFormModel.classifyResponse(false, 400, { message: "bad" });
    assert.equal(c.kind, "validation");
    assert.deepEqual(c.errors, []);
    assert.equal(c.message, "bad");

    c = wxapp.restFormModel.classifyResponse(false, 500, {});
    assert.equal(c.kind, "error");
    assert.equal(c.status, 500);
});

test("normalize errors reads the several casings the server may use", () => {
    const { wxapp } = load();

    assert.deepEqual(
        wxapp.restFormModel.normalizeFieldErrors({ a: "x", b: "y" }),
        [{ field: "a", message: "x" }, { field: "b", message: "y" }]
    );
    assert.deepEqual(wxapp.restFormModel.normalizeFieldErrors(null), []);

    assert.deepEqual(
        wxapp.restFormModel.normalizeArrayErrors([{ field: "f", message: "m" }, { Message: "M2" }]),
        [{ field: "f", message: "m" }, { field: null, message: "M2" }]
    );
});

test("model feeds a service request and classifies the result end to end", async () => {
    const { wxapp, setFetch } = load();
    let captured = null;
    setFetch(async (url, init) => {
        captured = { url: url, init: init };
        return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({ message: "saved" }) };
    });

    const service = wxapp.ServiceRegistry.create({ name: "data", kind: "rest", baseUri: "/api/form" });
    const built = wxapp.restFormModel.buildRequest(
        "/api/form", { method: "POST", json: true, headers: {}, id: 7 }, { name: "a" }, "http://localhost");

    const result = await service.request(built.url, built.init);

    assert.equal(result.ok, true);
    assert.equal(result.data.message, "saved");
    assert.match(captured.url, /id=7/);
    assert.equal(JSON.parse(captured.init.body).name, "a");

    const classification = wxapp.restFormModel.classifyResponse(result.ok, result.status, result.data);
    assert.equal(classification.kind, "success");
    assert.equal(classification.message, "saved");
});
