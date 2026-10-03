/**
 * Headless unit tests for the REST sidebar model helpers.
 *
 * These cover the pure projection extracted from webexpress.webapp.sidebar.js:
 * the mapping of a server node tree into the hierarchical item descriptors the
 * shared WebUI sidebar consumes, including badges, typed nodes and nesting.
 *
 * Run with Node 18 or newer from the jstest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, webappAsset } from "./harness.mjs";

function load(options) {
    return loadEngine(Object.assign(
        { extraFiles: [webappAsset("webexpress.webapp.sidebar.model.js")] },
        options
    ));
}

test("map items tolerates a missing array and a bare array", () => {
    const { wxapp } = load();

    assert.deepEqual(wxapp.sidebarModel.mapItems(null), []);
    assert.deepEqual(wxapp.sidebarModel.mapItems({}), []);

    const fromArray = wxapp.sidebarModel.mapItems([{ label: "a" }]);
    assert.equal(fromArray.length, 1);
    assert.equal(fromArray[0].label, "a");
});

test("map items projects a navigable item field by field", () => {
    const { wxapp } = load();

    const items = wxapp.sidebarModel.mapItems({
        items: [{
            id: 7,
            text: "Inbox",
            icon: "fas fa-inbox",
            uri: "/inbox",
            target: "_blank",
            active: true,
            badge: 12,
            badgeColor: "text-bg-primary"
        }]
    });

    assert.equal(items.length, 1);
    const item = items[0];
    assert.equal(item.type, "item");
    assert.equal(item.id, 7);
    assert.equal(item.label, "Inbox");
    assert.equal(item.iconClass, "fas fa-inbox");
    assert.equal(item.link, "/inbox");
    assert.equal(item.target, "_blank");
    assert.equal(item.active, true);
    assert.equal(item.badge, 12);
    assert.equal(item.badgeColor, "text-bg-primary");
    assert.deepEqual(item.children, []);
});

test("map items resolves the label from the several supported names", () => {
    const { wxapp } = load();

    const items = wxapp.sidebarModel.mapItems({ items: [{ name: "byName" }, { text: "byText" }, "bare"] });

    assert.equal(items[0].label, "byName");
    assert.equal(items[1].label, "byText");
    assert.equal(items[2].label, "bare");
    assert.equal(items[2].type, "item");
});

test("map items recognises header and divider nodes", () => {
    const { wxapp } = load();

    const items = wxapp.sidebarModel.mapItems({
        items: [
            { type: "header", label: "Section" },
            { separator: true },
            { type: "divider" }
        ]
    });

    assert.equal(items[0].type, "header");
    assert.equal(items[0].label, "Section");
    assert.equal(items[1].type, "divider");
    assert.equal(items[2].type, "divider");
});

test("map items nests children recursively and carries the expanded flag", () => {
    const { wxapp } = load();

    const items = wxapp.sidebarModel.mapItems({
        items: [{
            label: "Parent",
            expanded: true,
            items: [
                { label: "Child", items: [{ label: "Grandchild" }] }
            ]
        }]
    });

    const parent = items[0];
    assert.equal(parent.label, "Parent");
    assert.equal(parent.expanded, true);
    assert.equal(parent.children.length, 1);
    assert.equal(parent.children[0].label, "Child");
    assert.equal(parent.children[0].children.length, 1);
    assert.equal(parent.children[0].children[0].label, "Grandchild");
});

test("map items preserves a zero badge but defaults an absent one to null", () => {
    const { wxapp } = load();

    const items = wxapp.sidebarModel.mapItems({
        items: [
            { label: "zero", badge: 0 },
            { label: "count", count: 3 },
            { label: "none" }
        ]
    });

    assert.equal(items[0].badge, 0);
    assert.equal(items[1].badge, 3);
    assert.equal(items[2].badge, null);
});

test("model feeds a rest service and projects the response end to end", async () => {
    const { wxapp, setFetch } = load();
    let capturedUrl = null;
    setFetch(async (url) => {
        capturedUrl = url;
        return {
            ok: true,
            status: 200,
            json: async () => ({ items: [{ label: "Reports", items: [{ label: "Daily", badge: 2 }] }] })
        };
    });

    const service = wxapp.ServiceRegistry.create({
        name: "data",
        kind: "rest",
        baseUri: "/api/navigation",
        method: "GET"
    });

    const result = await service.query({});

    assert.equal(result.ok, true);
    assert.match(capturedUrl, /\/api\/navigation/);

    const items = wxapp.sidebarModel.mapItems(result.data);
    assert.equal(items.length, 1);
    assert.equal(items[0].label, "Reports");
    assert.equal(items[0].children[0].label, "Daily");
    assert.equal(items[0].children[0].badge, 2);
});
