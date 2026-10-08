/**
 * End-to-end tests for the WebApp table template renderers added alongside
 * rest_selection: the value-based "status" dot and the service-backed
 * "rest_combo" (single-select) and "rest_tag" (tags with autocomplete). They go
 * through the registered renderers in templates/default.js with a mocked fetch.
 */
import { test } from "node:test";
import assert from "node:assert";
import { loadControl } from "./controls.harness.mjs";

const ITEMS = [
    { id: "A1", text: "Mêlée Island" },
    { id: "B2", text: "Monkey Island" }
];

/**
 * Loads the runtime with the selection + tag controls and the template renderers.
 * The SmartEdit read view walks an instanceof chain over sibling input controls
 * that are not under test here; they are stubbed so the chain does not touch an
 * undefined class (on a real page every control is loaded).
 * @returns {object} The loaded runtime.
 */
function loadRuntime() {
    const rt = loadControl({
        deps: [
            "webexpress.webapp.selection.model.js",
            "webexpress.webapp.selection.js",
            "webexpress.webapp.input.selection.model.js",
            "webexpress.webapp.input.selection.js",
            "webexpress.webapp.tag.js"
        ],
        file: "templates/default.js"
    });
    rt.setFetch(async () => ({
        ok: true,
        status: 200,
        headers: { get: (h) => (h.toLowerCase() === "content-type" ? "application/json" : "") },
        json: async () => ({ items: ITEMS, total: ITEMS.length }),
        text: async () => "{}"
    }));
    for (const name of ["InputMoveCtrl", "InputCalendarCtrl", "InputDateCtrl", "InputRatingCtrl", "InputColorCtrl", "EditorCtrl"]) {
        if (!rt.wx[name]) { rt.wx[name] = class { }; }
    }
    return rt;
}

async function settle() {
    for (let i = 0; i < 30; i++) { await Promise.resolve(); }
    await new Promise((r) => setTimeout(r, 0));
    for (let i = 0; i < 30; i++) { await Promise.resolve(); }
}

function render(rt, type, val, opts) {
    const tmpl = rt.wx.TableTemplates.get(type);
    assert.ok(tmpl, `the ${type} renderer is registered`);
    return tmpl.fn(val, {}, { id: "row1" }, {}, "col1", opts || {});
}

test("status renderer maps the cell value to a colored dot", () => {
    const rt = loadRuntime();
    const cases = { error: "wx-status-dot-error", done: "wx-status-dot-done", warning: "wx-status-dot-warning", running: "wx-status-dot-running", pending: "wx-status-dot-pending" };
    for (const [val, cls] of Object.entries(cases)) {
        const c = render(rt, "status", val, {});
        assert.ok(c.querySelector(".wx-status-dot").classList.contains(cls), `${val} -> ${cls}`);
    }
    assert.equal(render(rt, "status", "", {}), "", "an empty value renders nothing");
    assert.equal(render(rt, "status", "bogus", {}), "", "an unknown value renders nothing");
});

test("status renderer shows a caption when showLabel is set", () => {
    const rt = loadRuntime();
    const c = render(rt, "status", "error", { showLabel: "true" });
    assert.ok(c.querySelector(".wx-status-task-label"), "a caption is rendered");
    assert.equal(c.className, "wx-status-task", "the container carries the layout class");
});

test("rest_combo read-only resolves the value to its label after the async load", async () => {
    const rt = loadRuntime();
    const c = render(rt, "rest_combo", "A1", { uri: "/api/loc" });
    await settle();
    assert.equal(c.querySelectorAll("li").length, 1, "the single chosen value is shown");
    assert.equal(c.textContent, "Mêlée Island", "the value resolves to its label");
});

test("rest_combo editable shows the selection once the options arrive", async () => {
    const rt = loadRuntime();
    const c = render(rt, "rest_combo", "A1", { uri: "/api/loc", editable: "true" });
    await settle();
    assert.equal(c.textContent, "Mêlée Island", "the SmartEdit read view shows the chosen label");
});

test("rest_tag read-only shows the tags of the value without a service", () => {
    const rt = loadRuntime();
    const c = render(rt, "rest_tag", "pirate;grog", {});
    const text = c.textContent;
    assert.ok(text.includes("pirate") && text.includes("grog"), "both tags are shown");
    assert.equal(render(rt, "rest_tag", "", {}), "", "an empty value renders nothing");
});

test("rest_tag editable renders the tags in the SmartEdit read view", async () => {
    const rt = loadRuntime();
    const c = render(rt, "rest_tag", "pirate;grog", { uri: "/api/tags", editable: "true" });
    await settle();
    // the SmartEdit read view is a synchronous TagCtrl snapshot of the value;
    // constructing the editable cell must not throw and must show the tags
    const text = c.textContent;
    assert.ok(text.includes("pirate") && text.includes("grog"), "the read view shows the tags");
});
