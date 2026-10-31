/**
 * Headless unit tests for the theme dropdown model, which also serves the icon set picker.
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, webappAsset } from "./harness.mjs";

function load() {
    return loadEngine({ extraFiles: [webappAsset("webexpress.webapp.dropdown.theme.model.js")] });
}

test("the entry in use is the one checked radio item, so the menu shows the current value", () => {
    const { wxapp } = load();
    const items = wxapp.dropdownThemeModel.normalizeThemes({
        items: [{ id: "default", name: "Standard" }, { id: "ocean", name: "Ocean" }],
        selected: "ocean"
    }).items;

    const marked = JSON.parse(JSON.stringify(wxapp.dropdownThemeModel.markActive(items, "ocean")));

    assert.deepStrictEqual(marked.map((x) => x.role), ["menuitemradio", "menuitemradio"]);
    assert.deepStrictEqual(marked.map((x) => x.aria), [[["aria-checked", "false"]], [["aria-checked", "true"]]]);
    assert.deepStrictEqual(marked.map((x) => x.color), [null, "active"], "the base menu highlights the entry in use");
});

test("marking leaves the mapped items untouched, so a later re-mark starts from the same data", () => {
    const { wxapp } = load();
    const items = wxapp.dropdownThemeModel.normalizeThemes({ items: [{ id: "a" }, { id: "b" }] }).items;

    wxapp.dropdownThemeModel.markActive(items, "a");

    assert.equal(items[0].role, undefined);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(items[0].aria)), []);
});
