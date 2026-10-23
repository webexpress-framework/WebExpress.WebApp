/**
 * Headless unit tests for the REST wizard model helpers (phase two).
 *
 * These cover the pure logic extracted from webexpress.webapp.restwizard.js,
 * namely the step request shaping, the cache decision and the last step
 * detection, plus an end to end path through a service request that returns an
 * html step and one that returns a 204 skip.
 *
 * Run with Node 18 or newer from the jstest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, webappAsset } from "./harness.mjs";

function load(options) {
    return loadEngine(Object.assign(
        { extraFiles: [webappAsset("webexpress.webapp.restwizard.model.js")] },
        options
    ));
}

test("build step request init posts the payload and accepts html", () => {
    const { wxapp } = load();
    const init = wxapp.restWizardModel.buildStepRequestInit('{"a":1}');

    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json; charset=utf-8");
    assert.equal(init.headers["Accept"], "text/html");
    assert.equal(init.body, '{"a":1}');
});

test("should use cache only when loaded, unchanged and without error", () => {
    const { wxapp } = load();
    const page = { isLoaded: true, payloadHash: "abc", hasError: false };

    assert.equal(wxapp.restWizardModel.shouldUseCache(page, "abc"), true);
    assert.equal(wxapp.restWizardModel.shouldUseCache(page, "xyz"), false);
    assert.equal(wxapp.restWizardModel.shouldUseCache({ isLoaded: false, payloadHash: "abc" }, "abc"), false);
    assert.equal(wxapp.restWizardModel.shouldUseCache({ isLoaded: true, payloadHash: "abc", hasError: true }, "abc"), false);
    assert.equal(wxapp.restWizardModel.shouldUseCache(null, "abc"), false);
});

test("is last page ignores skipped pages and an empty list", () => {
    const { wxapp } = load();
    const pages = [{ skipped: false }, { skipped: false }, { skipped: false }];

    assert.equal(wxapp.restWizardModel.isLastPage(pages, 2), true);
    assert.equal(wxapp.restWizardModel.isLastPage(pages, 1), false);

    const trailing = [{ skipped: false }, { skipped: false }, { skipped: true }];
    assert.equal(wxapp.restWizardModel.isLastPage(trailing, 1), true);

    assert.equal(wxapp.restWizardModel.isLastPage([], 0), true);
});

test("model feeds a service request that returns an html step", async () => {
    const { wxapp, setFetch } = load();
    let captured = null;
    setFetch(async (url, init) => {
        captured = { url: url, init: init };
        return { ok: true, status: 200, headers: { get: () => "text/html" }, text: async () => "<p>step</p>" };
    });

    const service = wxapp.ServiceRegistry.create({ kind: "rest", baseUri: "" });
    const result = await service.request("/step/2", wxapp.restWizardModel.buildStepRequestInit('{"x":1}'));

    assert.equal(result.ok, true);
    assert.equal(result.status, 200);
    assert.equal(result.data.text, "<p>step</p>");
    assert.equal(captured.init.method, "POST");
    assert.equal(captured.init.body, '{"x":1}');
});

test("model feeds a service request that returns a 204 skip", async () => {
    const { wxapp, setFetch } = load();
    setFetch(async () => ({ ok: true, status: 204, headers: { get: () => null } }));

    const service = wxapp.ServiceRegistry.create({ kind: "rest", baseUri: "" });
    const result = await service.request("/step/3", wxapp.restWizardModel.buildStepRequestInit("{}"));

    assert.equal(result.status, 204);
    assert.equal(result.data, null);
});
