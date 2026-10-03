/**
 * Tests the diagnostic view of a failed service result. Controls log it in
 * place of the bare message, which is empty for some failures and says nothing
 * about what the server answered.
 */
import { test } from "node:test";
import assert from "node:assert";
import { loadEngine } from "./harness.mjs";

test("ServiceResult.describe carries the kind and the status of a failure", () => {
    const rt = loadEngine();
    const result = rt.wxapp.ServiceResult.fail("http", 500, "request failed with status 500", true);

    const described = rt.wxapp.ServiceResult.describe(result);

    assert.equal(described.kind, "http", "the kind tells a server failure from a network one");
    assert.equal(described.status, 500, "the status names what the server answered");
    assert.equal(described.message, "request failed with status 500", "the message travels along");
});

test("ServiceResult.describe adds what the caller knows about the request", () => {
    const rt = loadEngine();
    const result = rt.wxapp.ServiceResult.fail("http", 400, "bad request", false);

    const described = rt.wxapp.ServiceResult.describe(result, { uri: "/api/orders", params: { page: 2 } });

    assert.equal(described.uri, "/api/orders", "the uri names the endpoint that failed");
    assert.deepEqual(described.params, { page: 2 }, "the query that caused it travels along");
});

test("ServiceResult.describe stays readable for a result without an error", () => {
    const rt = loadEngine();

    const described = rt.wxapp.ServiceResult.describe(null);

    assert.equal(described.kind, "unknown", "an unusable result is reported as unknown, not as a crash");
    assert.equal(described.status, 0);
    assert.equal(described.message, "");
});
