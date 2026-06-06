/**
 * Headless tests for the REST form control after it was lifted onto the Data
 * base (View, State and Service). The form already owned a store, store-backed
 * ui-state accessors and an island-or-legacy service map; the lift delegates the
 * store and the service map to the base (super(element, { state, services })) and
 * gains the base teardown that aborts the service. The form keeps its imperative
 * render and submit flow.
 *
 * The tests omit the data-uri so the constructor performs no load (load() returns
 * early without an api), which keeps the lift assertions free of async I/O.
 *
 * Run with Node 18 or newer from the jstest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, webappAsset } from "./harness.mjs";

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
    const { wxapp, createElement, setFetch } = load();
    setFetch(async () => ({ ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({}) }));

    const element = createElement("form");

    const ctrl = new wxapp.RestFormCtrl(element);

    assert.ok(ctrl instanceof wxapp.Data);
    assert.equal(typeof ctrl.store, "object");
    assert.ok(ctrl.useService("data"));
    assert.equal(ctrl.mode, "new");
});

test("restform seeds its ui state from the data-wx-state island", () => {
    const { wxapp, createElement, setFetch } = load();
    setFetch(async () => ({ ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({}) }));

    const element = createElement("form");
    element.setAttribute("data-wx-state", JSON.stringify({ submitting: true }));

    const ctrl = new wxapp.RestFormCtrl(element);

    assert.equal(ctrl.state.submitting, true);
});

test("restform destroy tears down without throwing", () => {
    const { wxapp, createElement, setFetch } = load();
    setFetch(async () => ({ ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({}) }));

    const element = createElement("form");

    const ctrl = new wxapp.RestFormCtrl(element);

    assert.doesNotThrow(() => ctrl.destroy());
});
