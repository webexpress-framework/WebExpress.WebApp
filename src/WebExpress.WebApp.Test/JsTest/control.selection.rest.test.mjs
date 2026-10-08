/**
 * End-to-end tests for the "rest_selection" table template renderer
 * (templates/default.js), the surface behind the DataSelection table template.
 *
 * They reproduce the tutorial scenario: the cell value is assigned before the
 * options are fetched, and the REST endpoint returns items shaped like the
 * server's RestApiSelectionItem ({ id, text, ... }). The read-only tags and the
 * editable SmartEdit view must both show the selected item's text once the async
 * load completes - not an empty list (the value was dropped before options
 * loaded) and not an empty label (the "text" field was not mapped).
 */
import { test } from "node:test";
import assert from "node:assert";
import { loadControl } from "./controls.harness.mjs";

const ITEMS = [
    { id: "28DF7324-0DDE-40B3-B6E4-0CDD107D324A", text: "Mêlée Island" },
    { id: "64D99FDF-9828-40EB-92CA-D55DDA6BD9F4", text: "Monkey Island" }
];

/**
 * Loads the runtime with the selection controls and the template renderer, and a
 * fetch that returns the RestApiSelectionItem-shaped items.
 * @returns {object} The loaded runtime.
 */
function loadRuntime() {
    const rt = loadControl({
        deps: [
            "webexpress.webapp.selection.model.js",
            "webexpress.webapp.selection.js",
            "webexpress.webapp.input.selection.model.js",
            "webexpress.webapp.input.selection.js"
        ],
        file: "templates/default.js"
    });
    rt.setFetch(async () => ({
        ok: true,
        status: 200,
        headers: { get: (h) => (h.toLowerCase() === "content-type" ? "application/json" : "") },
        json: async () => ({ items: ITEMS, total: ITEMS.length }),
        text: async () => JSON.stringify({ items: ITEMS })
    }));
    return rt;
}

/**
 * Lets the microtask queue and one macrotask drain so the fetch resolves.
 */
async function settle() {
    for (let i = 0; i < 30; i++) { await Promise.resolve(); }
    await new Promise((r) => setTimeout(r, 0));
    for (let i = 0; i < 30; i++) { await Promise.resolve(); }
}

/**
 * Renders a rest_selection cell through the registered template renderer.
 * @param {object} rt - The runtime.
 * @param {string} value - The cell value (ids joined by ";").
 * @param {object} opts - The renderer options (uri, editable, multiselection).
 * @returns {object} The rendered container element.
 */
function renderCell(rt, value, opts) {
    const tmpl = rt.wx.TableTemplates.get("rest_selection");
    assert.ok(tmpl, "the rest_selection renderer is registered");
    return tmpl.fn(value, {}, { id: "row1" }, {}, "col1", opts);
}

test("read-only rest_selection renders the selected items after the async load", async () => {
    const rt = loadRuntime();
    const container = renderCell(rt, "28DF7324-0DDE-40B3-B6E4-0CDD107D324A;64D99FDF-9828-40EB-92CA-D55DDA6BD9F4", { uri: "/api/loc" });

    await settle();

    assert.equal(container.querySelectorAll("li").length, 2, "both selected values are shown as tags");
    assert.equal(container.textContent, "Mêlée IslandMonkey Island", "the tags carry the item text, not an empty label");
});

test("editable rest_selection shows the selection once the options arrive", async () => {
    const rt = loadRuntime();
    // single-select by default, so one of the ids is kept and shown
    const container = renderCell(rt, "28DF7324-0DDE-40B3-B6E4-0CDD107D324A", { uri: "/api/loc", editable: "true" });

    await settle();

    assert.equal(container.querySelectorAll("li").length, 1, "the selected value is shown in the SmartEdit read view");
    assert.equal(container.textContent, "Mêlée Island", "the tag carries the item text");
});
