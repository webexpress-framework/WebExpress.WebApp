/**
 * Headless unit tests for the REST dashboard model helpers (View, State and
 * Service).
 *
 * These cover the pure logic extracted from webexpress.webapp.dashboard.js: the
 * legacy descriptor and the column and widget normalisation, plus an end to end
 * path that loads the dashboard with a query and persists the layout state with
 * an update through a service.
 *
 * Run with Node 18 or newer from the jstest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, webappAsset } from "./harness.mjs";

function load(options) {
    return loadEngine(Object.assign(
        { extraFiles: [webappAsset("webexpress.webapp.dashboard.model.js")] },
        options
    ));
}

test("normalize columns maps columns and widgets with defaults", () => {
    const { wxapp } = load();
    const cols = wxapp.dashboardModel.normalizeColumns({
        columns: [
            { id: "c1", widgets: [{ id: "w1" }, { id: "w2", removable: false, movable: false, html: "<b/>", params: { a: 1 } }] },
            { id: "c2", label: "L", size: "2fr" }
        ]
    });

    assert.equal(cols.length, 2);
    assert.equal(cols[0].size, "1fr");
    assert.equal(cols[1].size, "2fr");
    assert.equal(cols[1].label, "L");

    assert.equal(cols[0].widgets.length, 2);
    assert.equal(cols[0].widgets[0].removable, true);
    assert.equal(cols[0].widgets[0].movable, true);
    assert.equal(cols[0].widgets[1].removable, false);
    assert.equal(cols[0].widgets[1].movable, false);
    assert.equal(cols[0].widgets[1].html, "<b/>");
    assert.deepEqual(cols[0].widgets[1].params, { a: 1 });
    assert.equal(cols[0].widgets[0].instanceId.startsWith("wx_inst_c1_0_"), true);
});

test("normalize columns returns null when the response carries no columns", () => {
    const { wxapp } = load();
    assert.equal(wxapp.dashboardModel.normalizeColumns({}), null);
    assert.equal(wxapp.dashboardModel.normalizeColumns(null), null);
});

test("model loads the dashboard and persists the state through a service end to end", async () => {
    const { wxapp, setFetch } = load();
    const calls = [];
    setFetch(async (url, init) => {
        const method = (init && init.method) || "GET";
        calls.push({ url: url, method: method, body: init && init.body });
        if (method === "GET") {
            return { ok: true, status: 200, json: async () => ({ columns: [{ id: "c1", widgets: [{ id: "w1" }] }] }) };
        }
        return { ok: true, status: 200, json: async () => ({}) };
    });

    const service = wxapp.ServiceRegistry.create({ name: "data", kind: "rest", baseUri: "/api/dash", method: "GET", updateMethod: "PUT" });

    const loaded = await service.query({});
    assert.equal(calls[0].method, "GET");
    const cols = wxapp.dashboardModel.normalizeColumns(loaded.data);
    assert.equal(cols[0].id, "c1");
    assert.equal(cols[0].widgets[0].id, "w1");

    const saved = await service.update({ action: "move" });
    assert.equal(calls[1].method, "PUT");
    assert.deepEqual(JSON.parse(calls[1].body), { action: "move" });
    assert.equal(saved.ok, true);
});
