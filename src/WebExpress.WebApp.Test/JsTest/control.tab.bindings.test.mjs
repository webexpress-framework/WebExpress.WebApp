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

    ctrl._applyBindings(table, item, bindingMap);
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

    const item = { id: "t1", title: "Northwind" };
    const bindingMap = {};

    ctrl._applyBindings(title, item, bindingMap);
    ctrl._cleanupBindingAttributes(title, item, bindingMap);

    assert.equal(title.textContent, "Northwind", "the item value is written into the placeholder");
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

    ctrl._applyBindings(link, item, bindingMap);
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

    const item = { id: "t1", title: "Grace" };
    const bindingMap = {};

    ctrl._applyBindings(el, item, bindingMap);
    ctrl._cleanupBindingAttributes(el, item, bindingMap);

    assert.equal(el.getAttribute("data-wx-bind"), "show", "the item key is consumed and only the WebUI key remains bound");
    assert.equal(el.getAttribute("data-wx-source-show"), "#list", "the WebUI bind source is preserved");
});

test("the binding a template declares on itself is applied to the content of each pane", () => {
    const rt = loadControl({
        file: "webexpress.webapp.tab.js",
        deps: ["webexpress.webapp.tab.model.js"]
    });
    const host = rt.createElement("div");
    const template = rt.createElement("template");
    template.id = "dash";
    template.setAttribute("data-wx-bind", "title, uri");
    template.setAttribute("data-wx-bind-title-target", ".wx-title");
    template.setAttribute("data-wx-bind-uri-mode", "attr");
    template.setAttribute("data-wx-bind-uri-name", "data-uri");
    template.setAttribute("data-wx-bind-uri-target", "#board");
    host.appendChild(template);
    rt.document.body.appendChild(host);
    const ctrl = new rt.wxapp.TabCtrl(host);

    // the stub parses no markup, so the pane is filled with the template content by hand
    const buildPane = () => {
        const pane = rt.createElement("div");
        const title = rt.createElement("span");
        title.classList.add("wx-title");
        title.textContent = "placeholder";
        const board = rt.createElement("div");
        board.id = "board";
        Object.defineProperty(pane, "innerHTML", {
            set() {
                pane.appendChild(title);
                pane.appendChild(board);
            }
        });
        return { pane, title, board };
    };

    const first = buildPane();
    const second = buildPane();
    ctrl._buildPaneContent(first.pane, { id: "t1", templateId: "dash", title: "Q3", uri: "/api/dash/1" });
    ctrl._buildPaneContent(second.pane, { id: "t2", templateId: "dash", title: "Q4", uri: "/api/dash/2" });

    assert.equal(first.title.textContent, "Q3", "the title is written into the pane content");
    assert.equal(first.board.id, "board__t1", "the ids of the pane are made unique");
    assert.equal(first.board.getAttribute("data-uri"), "/api/dash/1", "an #id target follows the renamed id");
    assert.equal(second.title.textContent, "Q4", "every pane binds its own item");
    assert.equal(second.board.getAttribute("data-uri"), "/api/dash/2", "the stored template serves the next pane unchanged");
    assert.equal(first.pane.getAttribute("data-uri"), null, "the pane itself is no target of a selector");
    assert.equal(first.pane.getAttribute("data-wx-bind"), null, "the live pane never carries the binding");
});

test("a binding target is resolved within the bound element, not across the pane", () => {
    const { rt, ctrl } = makeTab();

    // two controls side by side, each with a part the selector would match
    const pane = rt.createElement("div");
    const bound = rt.createElement("div");
    const own = rt.createElement("span");
    own.classList.add("wx-caption");
    bound.appendChild(own);
    bound.setAttribute("data-wx-bind", "uri");
    bound.setAttribute("data-wx-bind-uri-mode", "attr");
    bound.setAttribute("data-wx-bind-uri-name", "data-uri");
    bound.setAttribute("data-wx-bind-uri-target", ".wx-caption");
    const neighbour = rt.createElement("div");
    const foreign = rt.createElement("span");
    foreign.classList.add("wx-caption");
    neighbour.appendChild(foreign);
    pane.appendChild(bound);
    pane.appendChild(neighbour);

    ctrl._applyBindings(bound, { id: "t1", uri: "/api/tab/1" }, {});

    assert.equal(own.getAttribute("data-uri"), "/api/tab/1", "the part inside the bound element is written");
    assert.equal(bound.getAttribute("data-uri"), "/api/tab/1", "the bound element itself stays a target");
    assert.equal(foreign.getAttribute("data-uri"), null, "the control next to it is left alone");
});
