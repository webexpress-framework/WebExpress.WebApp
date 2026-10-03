/**
 * Unit tests for the link model helpers: the result and system normalisation,
 * the perspective that decides which end of a link is the opposite one, the
 * request bodies, the sidebar sections, the graph projection and the reading of
 * a rejection.
 *
 * Run with Node 18 or newer from the JsTest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, webappAsset } from "./harness.mjs";

/**
 * Loads the model into a fresh engine.
 * @returns {object} The model.
 */
function model() {
    const { wxapp } = loadEngine({ extraFiles: [webappAsset("webexpress.webapp.relation.view.model.js")] });
    return wxapp.relationViewModel;
}

test("a malformed payload still yields the full result shape", () => {
    const m = model();

    assert.deepEqual(m.normalizeResult(null), { groups: [], total: 0, objectCount: 0, externalCount: 0 });
    assert.deepEqual(m.normalizeResult({ groups: "nonsense" }).groups, []);
});

test("the group count falls back to the number of items it carries", () => {
    const m = model();
    const result = m.normalizeResult({ groups: [{ type: "blocks", items: [{ id: "1" }, { id: "2" }] }] });

    assert.equal(result.groups[0].count, 2);
    assert.equal(result.total, 2, "the total is derived when the server did not state it");
});

test("a symmetric relation renders no counterpart badge", () => {
    const m = model();
    const symmetric = m.normalizeGroup({ type: "similar", label: "similar to", counterpart: "similar to", symmetric: true });
    const asymmetric = m.normalizeGroup({ type: "blocks", label: "blocks", counterpart: "is blocked by" });

    assert.equal(symmetric.counterpart, "", "both sides read alike, so there is nothing to add");
    assert.equal(asymmetric.counterpart, "is blocked by");
});

test("the opposite end follows the perspective the endpoint marked", () => {
    const m = model();
    const forward = m.normalizeItem({ inverse: false, source: { key: "INC-1" }, target: { key: "CHG-2" } });
    const backward = m.normalizeItem({ inverse: true, source: { key: "CHG-2" }, target: { key: "INC-1" } });

    assert.equal(m.opposite(forward).key, "CHG-2");
    assert.equal(m.opposite(backward).key, "CHG-2", "read from the target, the source is the other end");
});

test("the query carries only the criteria that are set", () => {
    const m = model();

    assert.deepEqual(m.query({ type: "", system: "acme.github", search: "vpn" }), { system: "acme.github", search: "vpn" });
    assert.deepEqual(m.query(null), {});
});

test("an object link and a web link produce the two bodies the endpoint expects", () => {
    const m = model();

    const object = m.createBody({
        system: "webexpress.webapp.relation.object",
        type: "blocks",
        target: { key: "CHG-00045", class: "Change", title: "Firmware" },
        comment: "same gateway"
    });
    assert.deepEqual(object, {
        system: "webexpress.webapp.relation.object",
        type: "blocks",
        targetKey: "CHG-00045",
        targetClass: "Change",
        title: "Firmware",
        comment: "same gateway"
    });

    const web = m.createBody({
        system: "webexpress.webapp.relation.web",
        type: "weblink",
        address: "https://example.com",
        title: "Vendor advisory"
    });
    assert.deepEqual(web, {
        system: "webexpress.webapp.relation.web",
        type: "weblink",
        address: "https://example.com",
        title: "Vendor advisory"
    });
    assert.ok(!("targetKey" in web), "a web link addresses no object");
});

test("the sidebar separates the systems the application brings from the contributed ones", () => {
    const m = model();
    const systems = m.normalizeSystems([
        { id: "a", label: "Object" },
        { id: "b", label: "GitHub", plugin: "acme.github", version: "1.4.0" }
    ]);

    const sections = m.sections(systems);

    assert.equal(sections.length, 2);
    assert.equal(sections[0].plugin, false);
    assert.deepEqual(sections[0].items.map((x) => x.id), ["a"]);
    assert.deepEqual(sections[1].items.map((x) => x.id), ["b"]);
    assert.deepEqual(m.sections([]), [], "an empty catalog renders no headings");
});

test("a system falls back to its id as the panel it is rendered by", () => {
    const m = model();
    const [system] = m.normalizeSystems([{ id: "acme.jira", label: "Jira", kind: "object" }]);

    assert.equal(system.panel, "acme.jira");
    assert.equal(system.enabled, true, "a system is usable unless it says otherwise");
    assert.equal(system.badge, "JI", "a system without a badge falls back to its initials");
});

test("the graph says exactly what the list says", () => {
    const m = model();
    const groups = m.normalizeResult({
        groups: [
            { type: "blocks", label: "blocks", counterpart: "is blocked by", items: [{ id: "l1", inverse: false, source: { key: "INC-1" }, target: { key: "CHG-2" } }] },
            { type: "causes", label: "is caused by", counterpart: "causes", inverse: true, items: [{ id: "l2", inverse: true, source: { key: "CHG-3" }, target: { key: "INC-1" } }] }
        ]
    }).groups;

    const graph = m.graph({ key: "INC-1" }, groups);

    assert.deepEqual(graph.nodes.map((n) => n.id), ["INC-1", "CHG-2", "CHG-3"]);
    assert.deepEqual(graph.edges.map((e) => [e.from, e.to, e.label]), [
        ["INC-1", "CHG-2", "blocks"],
        ["CHG-3", "INC-1", "causes"]
    ]);
});

test("the graph marks the object the surface belongs to", () => {
    const m = model();
    const groups = m.normalizeResult({
        groups: [{ type: "blocks", label: "blocks", items: [{ id: "l1", source: { key: "INC-1" }, target: { key: "CHG-2" } }] }]
    }).groups;

    const [centre, other] = m.graph({ key: "INC-1" }, groups).nodes;

    assert.equal(centre.backgroundCss, m.SUBJECT_NODE_CSS, "the reader sees whose relations these are");
    assert.equal(centre.foregroundCss, m.SUBJECT_LABEL_CSS);
    assert.equal(other.backgroundCss, undefined, "every other node keeps the default paint");
});

test("every node of the graph is a rectangle carrying what its row carries", () => {
    const m = model();
    const groups = m.normalizeResult({
        groups: [{
            type: "blocks",
            label: "blocks",
            icon: "flag",
            items: [{
                id: "l1",
                source: { key: "INC-1" },
                target: {
                    key: "CHG-2",
                    class: "Change",
                    title: "Firmware update",
                    status: "Approved",
                    statusColor: "success"
                }
            }]
        }]
    }).groups;

    const [centre, other] = m.graph({ key: "INC-1", class: "Incident", title: "VPN drops" }, groups).nodes;

    assert.equal(centre.shape, "rect");
    assert.equal(centre.label, "INC-1");
    assert.equal(centre.description, "Incident · VPN drops");

    assert.equal(other.shape, "rect", "an external end is a rectangle as well");
    assert.equal(other.label, "CHG-2");
    assert.equal(other.description, "Change · Firmware update", "the type leads the description");
    assert.equal(other.state, "Approved");
    assert.equal(other.stateCss, "wx-relation-view-node-success");
    assert.ok(other.icon.includes("flag"), "the node carries the icon of its relation");
});

test("a node of a web link is named by the host of its address", () => {
    const m = model();
    const groups = m.normalizeResult({
        groups: [{
            type: "weblink",
            label: "Web link",
            icon: "arrow-up-right-from-square",
            items: [{
                id: "l1",
                source: { key: "INC-1" },
                target: { uri: "https://example.com/a/deep/path", title: "Vendor advisory" }
            }]
        }]
    }).groups;

    const other = m.graph({ key: "INC-1" }, groups).nodes[1];

    assert.equal(other.shape, "rect");
    assert.equal(other.label, "example.com");
    assert.equal(other.description, "Vendor advisory");
    assert.equal(other.uri, "https://example.com/a/deep/path");
});

test("the graph keeps one node per linked object", () => {
    const m = model();
    const groups = m.normalizeResult({
        groups: [{
            type: "references",
            label: "references",
            items: [
                { id: "l1", source: { key: "INC-1" }, target: { key: "DOC-1" } },
                { id: "l2", source: { key: "INC-1" }, target: { key: "DOC-1" } }
            ]
        }]
    }).groups;

    const graph = m.graph({ key: "INC-1" }, groups);

    assert.equal(graph.nodes.length, 2, "the twice linked document is drawn once");
    assert.equal(graph.edges.length, 2, "both links are still drawn");
});

test("only an http address is accepted for a web link", () => {
    const m = model();

    assert.equal(m.isValidAddress("https://example.com/a"), true);
    assert.equal(m.isValidAddress("http://example.com"), true);
    assert.equal(m.isValidAddress("javascript:alert(1)"), false);
    assert.equal(m.isValidAddress("example.com"), false);
    assert.equal(m.isValidAddress(""), false);
});

test("a rejection is reported by what the server objected to", () => {
    const m = model();
    const ctrl = { _i18n: (key, fallback) => fallback };

    assert.equal(
        m.faultMessage({ ok: false, data: { code: "relation.duplicate", message: "This link already exists." } }, ctrl),
        "This link already exists.");

    assert.equal(
        m.faultMessage({ ok: false, data: null, error: { message: "request failed with status 500" } }, ctrl),
        "request failed with status 500",
        "a failure without a reason falls back to the transport message");
});
