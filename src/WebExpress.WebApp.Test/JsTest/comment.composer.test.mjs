/**
 * Headless tests for the comment composer control after it was lifted onto the
 * Data base (View, State and Service). The composer keeps its imperative form
 * flow; the lift gives it the service map - a configured island service is
 * preferred over the legacy descriptor - and the Data lifecycle teardown that
 * aborts the service. The categories are preset so the constructor performs no
 * load.
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
                webappAsset("webexpress.webapp.comment.composer.model.js"),
                webappAsset("webexpress.webapp.comment.composer.js")
            ]
        },
        options
    ));
}

const PRESET_CATEGORIES = JSON.stringify([{ id: "general", i18n: "", color: "#000", bg: "#fff" }]);

test("comment composer extends the data base and resolves its service", () => {
    const { wxapp, createElement, setFetch } = load();
    setFetch(async () => ({ ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({}) }));

    const element = createElement("div");
    element.dataset.uri = "/api/comments/INC-1";
    element.dataset.categories = PRESET_CATEGORIES;

    const ctrl = new wxapp.CommentComposerCtrl(element);

    assert.ok(ctrl instanceof wxapp.Data);
    assert.equal(typeof ctrl.store, "object");
    assert.ok(ctrl.useService("data"));
});

test("comment composer destroy tears down without throwing", () => {
    const { wxapp, createElement, setFetch } = load();
    setFetch(async () => ({ ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({}) }));

    const element = createElement("div");
    element.dataset.uri = "/api/comments/INC-1";
    element.dataset.categories = PRESET_CATEGORIES;

    const ctrl = new wxapp.CommentComposerCtrl(element);

    assert.doesNotThrow(() => ctrl.destroy());
});
