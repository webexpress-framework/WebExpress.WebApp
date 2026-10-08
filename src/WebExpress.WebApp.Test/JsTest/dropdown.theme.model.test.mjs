/**
 * Headless unit tests for the theme dropdown model helpers (View, State and
 * Service).
 *
 * These cover the pure logic extracted from webexpress.webapp.dropdown.theme.js:
 * the theme item mapping and the theme list normalisation, plus an end to end
 * path that loads the themes through the shared request and normalises them.
 *
 * Run with Node 18 or newer from the jstest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, webappAsset } from "./harness.mjs";

function load(options) {
    return loadEngine(Object.assign(
        { extraFiles: [webappAsset("webexpress.webapp.dropdown.theme.model.js")] },
        options
    ));
}

test("map item projects the menu item with a void uri and text aliases", () => {
    const { wxapp } = load();
    const item = wxapp.dropdownThemeModel.mapItem({ id: 7, name: "Dark", icon: "fa" });
    assert.equal(item.id, "7");
    assert.equal(item.text, "Dark");
    assert.equal(item.uri, "javascript:void(0);");
    assert.equal(item.icon, "fa");
    assert.deepEqual(item.data, []);

    const fallback = wxapp.dropdownThemeModel.mapItem({ id: "x" });
    assert.equal(fallback.text, "x");

    const empty = wxapp.dropdownThemeModel.mapItem(null);
    assert.equal(empty.id, null);
    assert.equal(empty.text, "");
});

test("normalize themes maps the items and reads the selected id", () => {
    const { wxapp } = load();
    const themes = wxapp.dropdownThemeModel.normalizeThemes({
        items: [{ id: "a", name: "A" }, { id: "b", name: "B" }],
        selected: "b"
    });
    assert.deepEqual(themes.items.map(i => i.id), ["a", "b"]);
    assert.equal(themes.items[0].text, "A");
    assert.equal(themes.selected, "b");

    const none = wxapp.dropdownThemeModel.normalizeThemes({});
    assert.deepEqual(none.items, []);
    assert.equal(none.selected, null);

    const blank = wxapp.dropdownThemeModel.normalizeThemes({ items: [{ id: "a" }], selected: "" });
    assert.equal(blank.selected, null);
});

test("model loads and normalises the themes through the shared request end to end", async () => {
    const { wxapp, setFetch } = load();
    const calls = [];
    setFetch(async (url, init) => {
        calls.push({ url: url, method: (init && init.method) || "GET" });
        return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({ items: [{ id: "light", name: "Light" }], selected: "light" }) };
    });

    const res = await wxapp.ServiceRegistry.request("/api/themes", { method: "GET" });
    assert.equal(calls[0].method, "GET");

    const themes = wxapp.dropdownThemeModel.normalizeThemes(res.data);
    assert.equal(themes.items[0].id, "light");
    assert.equal(themes.items[0].text, "Light");
    assert.equal(themes.selected, "light");
});
