/**
 * Headless tests for the REST form control after it was lifted onto the Data
 * base (View, State and Service). The form already owned a store, store-backed
 * ui-state accessors and an island-or-legacy service map; the lift delegates the
 * store and the service map to the base (super(element, { state, services })) and
 * gains the base teardown that aborts the service. The form keeps its imperative
 * render and submit flow.
 *
 * The load test omits the form mode triggers so the constructor performs no
 * load, which keeps the lift assertions free of async I/O.
 *
 * Run with Node 18 or newer from the jstest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, webappAsset, appendServiceIsland, appendStateIsland } from "./harness.mjs";

function load(options) {
    return loadEngine(Object.assign(
        {
            extraFiles: [
                webappAsset("webexpress.webapp.restform.model.js"),
                webappAsset("webexpress.webapp.restform.js")
            ]
        },
        options
    ));
}

test("restform extends the data base and resolves its service", () => {
    const { wxapp, createElement, setFetch, document } = load();
    setFetch(async () => ({ ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({}) }));

    const element = createElement("form");
    appendServiceIsland(document, element, { name: "data", kind: "rest", baseUri: "/api/form" });

    // the configured endpoint triggers the initial load, which needs the full
    // browser form runtime; the lift assertions only cover the wiring
    wxapp.RestFormCtrl.prototype.load = async function () { };

    const ctrl = new wxapp.RestFormCtrl(element);

    assert.ok(ctrl instanceof wxapp.Data);
    assert.equal(typeof ctrl.store, "object");
    assert.ok(ctrl.useService("data"));
    assert.equal(ctrl.options.api, "/api/form");
    assert.equal(ctrl.mode, "new");
});

test("restform seeds its ui state from the wx-state island", () => {
    const { wxapp, createElement, setFetch, document } = load();
    setFetch(async () => ({ ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({}) }));

    const element = createElement("form");
    appendStateIsland(document, element, { submitting: true });

    const ctrl = new wxapp.RestFormCtrl(element);

    assert.equal(ctrl.state.submitting, true);
});

test("restform falls back to post when the form declares no method", () => {
    const { wxapp, createElement, setFetch } = load();
    setFetch(async () => ({ ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({}) }));

    const element = createElement("form");
    // a browser reports the html default of "get" through the idl property even
    // when the markup carries no method attribute
    element.method = "get";

    const ctrl = new wxapp.RestFormCtrl(element);

    assert.equal(ctrl.options.method, "POST");
});

test("restform honours a declared method attribute", () => {
    const { wxapp, createElement, setFetch } = load();
    setFetch(async () => ({ ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({}) }));

    const element = createElement("form");
    element.setAttribute("method", "put");

    const ctrl = new wxapp.RestFormCtrl(element);

    assert.equal(ctrl.options.method, "PUT");
});

test("restform destroy tears down without throwing", () => {
    const { wxapp, createElement, setFetch } = load();
    setFetch(async () => ({ ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({}) }));

    const element = createElement("form");

    const ctrl = new wxapp.RestFormCtrl(element);

    assert.doesNotThrow(() => ctrl.destroy());
});
