/**
 * Headless tests for the TabCtrl pane-binding pass (wx-webapp-tab).
 *
 * The tab template item-binding vocabulary and the WebUI bind system share the
 * data-wx-bind attribute. A data control placed inside a tab template (for
 * example a DataTable, Tile or List wired to a shared search/filter/paging)
 * carries data-wx-bind="search,filter,paging" from the WebUI bind system, plus
 * its wx-service/wx-state islands as direct children. These tests pin that the
 * pane build only writes real item bindings and leaves a WebUI bind host - and
 * its islands - untouched, so the control still resolves its service and calls
 * the REST endpoint.
 */
import { test } from "node:test";
import assert from "node:assert";
import { loadControl } from "./controls.harness.mjs";

/**
 * Constructs an inert TabCtrl on a bare host, which is enough to exercise the
 * pure pane-binding helpers without a REST load.
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

test("a WebUI data-wx-bind host keeps its islands and wiring through the pane build", () => {
    const { rt, ctrl } = makeTab();

    // a DataTable wired to the shared search/filter/paging via the WebUI bind
    // system, carrying its wx-service island as a direct child
    const pane = rt.createElement("div");
    const table = rt.createElement("div");
    table.setAttribute("data-wx-bind", "search,filter,paging");
    table.setAttribute("data-wx-source-search", "#search-host");
    const island = rt.createElement("wx-service");
    island.setAttribute("base-uri", "/api/table");
    table.appendChild(island);
    pane.appendChild(table);

    // a REST tab item never carries search/filter/paging fields
    const item = { id: "t1", label: "Table" };
    const bindingMap = {};

    ctrl._applyBindings(table, pane, item, bindingMap);
    ctrl._cleanupBindingAttributes(table, item, bindingMap);

    assert.ok(
        table.childNodes.some((n) => n.tagName === "WX-SERVICE"),
        "the wx-service island survives the pane build"
    );
    assert.equal(
        table.getAttribute("data-wx-bind"),
        "search, filter, paging",
        "the WebUI bind keys are preserved so the controller still wires them"
    );
    assert.equal(
        table.getAttribute("data-wx-source-search"),
        "#search-host",
        "the WebUI bind source is preserved"
    );
});

test("a real item text binding is applied and its attribute is cleaned up", () => {
    const { rt, ctrl } = makeTab();

    const pane = rt.createElement("div");
    const title = rt.createElement("div");
    title.setAttribute("data-wx-bind", "title");
    pane.appendChild(title);

    const item = { id: "t1", title: "Sea Monkey" };
    const bindingMap = {};

    ctrl._applyBindings(title, pane, item, bindingMap);
    ctrl._cleanupBindingAttributes(title, item, bindingMap);

    assert.equal(title.textContent, "Sea Monkey", "the item value is written into the placeholder");
    assert.equal(title.getAttribute("data-wx-bind"), null, "the consumed item binding is removed");
});

test("an item binding declared only through per-key metadata is applied", () => {
    const { rt, ctrl } = makeTab();

    const pane = rt.createElement("div");
    const link = rt.createElement("a");
    link.setAttribute("data-wx-bind", "uri");
    link.setAttribute("data-wx-bind-uri-mode", "attr");
    link.setAttribute("data-wx-bind-uri-name", "href");
    pane.appendChild(link);

    const item = { id: "t1", uri: "/kleenestar/objects/DEV" };
    const bindingMap = {};

    ctrl._applyBindings(link, pane, item, bindingMap);
    ctrl._cleanupBindingAttributes(link, item, bindingMap);

    assert.equal(link.getAttribute("href"), "/kleenestar/objects/DEV", "the attr binding lands on the element");
    assert.equal(link.getAttribute("data-wx-bind"), null, "the consumed item binding is removed");
    assert.equal(link.getAttribute("data-wx-bind-uri-mode"), null, "the per-key metadata is cleaned up");
    assert.equal(link.getAttribute("data-wx-bind-uri-name"), null, "the per-key metadata is cleaned up");
});

test("an element carrying both an item key and a WebUI key keeps only the WebUI key bound", () => {
    const { rt, ctrl } = makeTab();

    const pane = rt.createElement("div");
    const el = rt.createElement("div");
    el.setAttribute("data-wx-bind", "title,show");
    el.setAttribute("data-wx-source-show", "#list");
    pane.appendChild(el);

    const item = { id: "t1", title: "Guybrush" };
    const bindingMap = {};

    ctrl._applyBindings(el, pane, item, bindingMap);
    ctrl._cleanupBindingAttributes(el, item, bindingMap);

    assert.equal(el.getAttribute("data-wx-bind"), "show", "the item key is consumed and only the WebUI key remains bound");
    assert.equal(el.getAttribute("data-wx-source-show"), "#list", "the WebUI bind source is preserved");
});
