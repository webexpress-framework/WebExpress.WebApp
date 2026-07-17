/**
 * Headless tests for the TabCtrl id uniquifier (wx-webapp-tab).
 *
 * A tab template is rendered once on the server, so instantiating it into more
 * than one pane (several tabs, or a template whose multiplicity is above one)
 * would repeat every baked-in id. A duplicate id makes a document-global lookup
 * - for example a bind source resolved through document.querySelector - resolve
 * to the wrong pane. These tests pin that _uniquifyIds renames the pane-local
 * ids, rewrites the intra-pane references to follow, and leaves references that
 * point outside the pane untouched.
 */
import { test } from "node:test";
import assert from "node:assert";
import { loadControl } from "./controls.harness.mjs";

/**
 * Constructs an inert TabCtrl on a bare host, enough to exercise the pure id
 * helpers without a REST load.
 * @returns {object} The runtime and the controller.
 */
function makeTab() {
    const rt = loadControl({
        file: "webexpress.webapp.tab.js",
        deps: ["webexpress.webapp.tab.model.js"]
    });

    const host = rt.createElement("div");
    rt.document.body.appendChild(host);

    return { rt, ctrl: new rt.wxapp.TabCtrl(host) };
}

/**
 * Builds a pane whose subtree mirrors a template instance: a data control wired
 * to pane-local search/paging hosts, a label/input pair, and an anchor that
 * points at an element outside the pane. Every instance carries the same ids,
 * exactly as a cloned template does.
 * @param {object} rt - The runtime.
 * @param {string} paneId - The pane id.
 * @returns {HTMLElement} The pane.
 */
function buildPane(rt, paneId) {
    const pane = rt.createElement("div");
    pane.id = paneId;

    const table = rt.createElement("div");
    table.id = "tbl";
    table.setAttribute("data-wx-source-search", "#srch");
    table.setAttribute("data-wx-source-paging", "#pgr");
    table.appendChild(rt.createElement("wx-service"));

    const search = rt.createElement("div");
    search.id = "srch";

    const pager = rt.createElement("div");
    pager.id = "pgr";

    const label = rt.createElement("label");
    label.setAttribute("for", "fld");

    const input = rt.createElement("input");
    input.id = "fld";

    const external = rt.createElement("a");
    external.setAttribute("href", "#page-toolbar");

    [table, search, pager, label, input, external].forEach((n) => pane.appendChild(n));
    return pane;
}

test("two panes built from one template get disjoint ids", () => {
    const { rt, ctrl } = makeTab();

    const p1 = buildPane(rt, "tab-1");
    const p2 = buildPane(rt, "tab-2");
    ctrl._uniquifyIds(p1, "tab-1");
    ctrl._uniquifyIds(p2, "tab-2");

    const ids1 = p1.querySelectorAll("[id]").map((e) => e.id);
    const ids2 = p2.querySelectorAll("[id]").map((e) => e.id);
    const overlap = ids1.filter((id) => ids2.includes(id));

    assert.equal(overlap.length, 0, "no inner id collides between the two instances");
    assert.ok(ids1.includes("tbl__tab-1"), "the first instance carries the suffixed id");
    assert.ok(ids2.includes("tbl__tab-2"), "the second instance carries its own suffixed id");
});

test("intra-pane #id references follow the renamed ids", () => {
    const { rt, ctrl } = makeTab();

    const pane = buildPane(rt, "tab-1");
    ctrl._uniquifyIds(pane, "tab-1");

    const table = pane.querySelector("[data-wx-source-search]");
    assert.equal(table.getAttribute("data-wx-source-search"), "#srch__tab-1", "the bind source follows its host");
    assert.equal(table.getAttribute("data-wx-source-paging"), "#pgr__tab-1", "the paging source follows its host");
    assert.ok(table.childNodes.some((n) => n.tagName === "WX-SERVICE"), "the island is untouched by the rename");
});

test("bare-id references (for/aria-controls) are rewritten", () => {
    const { rt, ctrl } = makeTab();

    const pane = buildPane(rt, "tab-1");
    const label = pane.querySelector("label");
    label.setAttribute("aria-controls", "fld");

    ctrl._uniquifyIds(pane, "tab-1");

    assert.equal(label.getAttribute("for"), "fld__tab-1", "the label association follows the input");
    assert.equal(label.getAttribute("aria-controls"), "fld__tab-1", "the aria reference follows the input");
});

test("svg url(#id) references are rewritten in any attribute, including style", () => {
    const { rt, ctrl } = makeTab();

    const pane = rt.createElement("div");
    pane.id = "tab-1";
    const gradient = rt.createElement("lineargradient");
    gradient.id = "grad";
    const shape = rt.createElement("path");
    shape.setAttribute("fill", "url(#grad)");
    shape.setAttribute("style", "stroke: url('#grad')");
    pane.appendChild(gradient);
    pane.appendChild(shape);

    ctrl._uniquifyIds(pane, "tab-1");

    assert.equal(shape.getAttribute("fill"), "url(#grad__tab-1)", "the fill marker follows its def");
    assert.equal(shape.getAttribute("style"), "stroke: url('#grad__tab-1')", "the style url follows its def");
});

test("bare-id references aria-activedescendant and list are rewritten", () => {
    const { rt, ctrl } = makeTab();

    const pane = rt.createElement("div");
    pane.id = "tab-1";

    const listbox = rt.createElement("div");
    listbox.setAttribute("aria-activedescendant", "opt");
    const option = rt.createElement("div");
    option.id = "opt";
    const input = rt.createElement("input");
    input.setAttribute("list", "dl");
    const datalist = rt.createElement("datalist");
    datalist.id = "dl";
    [listbox, option, input, datalist].forEach((n) => pane.appendChild(n));

    ctrl._uniquifyIds(pane, "tab-1");

    assert.equal(listbox.getAttribute("aria-activedescendant"), "opt__tab-1", "the active descendant follows the option");
    assert.equal(input.getAttribute("list"), "dl__tab-1", "the datalist reference follows the datalist");
});

test("a reference that points outside the pane is left untouched", () => {
    const { rt, ctrl } = makeTab();

    const pane = buildPane(rt, "tab-1");
    ctrl._uniquifyIds(pane, "tab-1");

    const external = pane.querySelector("a");
    assert.equal(external.getAttribute("href"), "#page-toolbar", "an unknown target keeps its original selector");
});

test("uniquify falls back to a generated suffix when the pane id is missing", () => {
    const { rt, ctrl } = makeTab();

    const pane = buildPane(rt, "tab-1");
    // clear the pane id to force the fallback suffix
    pane.removeAttribute("id");
    ctrl._uniquifyIds(pane, null);

    const table = pane.querySelector("[data-wx-source-search]");
    assert.notEqual(table.id, "tbl", "the inner id is still renamed without a pane id");
    assert.ok(
        table.getAttribute("data-wx-source-search").startsWith("#srch__"),
        "the reference still follows the renamed host"
    );
});
