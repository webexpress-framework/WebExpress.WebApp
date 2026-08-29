/**
 * Unit tests for the relation type model helpers: the normalisation of a
 * definition, what a symmetric relation implies for its counterpart, the
 * request body, the completeness rules, the two readings of the preview and the
 * reordering.
 *
 * Run with Node 18 or newer from the JsTest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, webappAsset } from "./harness.mjs";

/**
 * Loads the model into a fresh engine, together with the link model it reads a
 * rejection through.
 * @returns {object} The model.
 */
function model() {
    const { wxapp } = loadEngine({
        extraFiles: [
            webappAsset("webexpress.webapp.relation.view.model.js"),
            webappAsset("webexpress.webapp.relation.editor.model.js")
        ]
    });

    return wxapp.relationEditorModel;
}

/**
 * The translation function the helpers take, answering the fallback.
 * @param {string} key - The i18n key.
 * @param {string} fallback - The fallback text.
 * @returns {string} The fallback.
 */
function i18n(key, fallback) {
    return fallback;
}

test("a type without target classes reads as accepting every class", () => {
    const m = model();
    const item = m.normalizeItem({ id: "references", label: "references", inverse: "is referenced by" });

    assert.equal(item.allClasses, true);
    assert.deepEqual(item.targetClasses, []);
});

test("a symmetric type takes its label for both ends", () => {
    const m = model();
    const item = m.normalizeItem({ id: "similar", label: "similar to", inverse: "something else", symmetric: true });

    assert.equal(item.inverse, "similar to", "the stored counterpart cannot drift away from the label");
});

test("an unknown cardinality or effect falls back to the unrestricted default", () => {
    const m = model();
    const item = m.normalizeItem({ id: "x", label: "x", cardinality: "7:3", effect: "explodes" });

    assert.equal(item.cardinality, "n:n");
    assert.equal(item.effect, "none");
});

test("the payload drops the target classes when every class is accepted", () => {
    const m = model();
    const body = m.payload({ id: "blocks", label: "blocks", inverse: "is blocked by", allClasses: true, targetClasses: ["Bug"] });

    assert.deepEqual(body.targetClasses, [], "the two statements cannot both hold");
});

test("the payload mirrors the label into the counterpart of a symmetric type", () => {
    const m = model();
    const body = m.payload({ label: " similar to ", inverse: "ignored", symmetric: true, allClasses: true });

    assert.equal(body.label, "similar to", "the label is trimmed");
    assert.equal(body.inverse, "similar to");
});

test("a definition is incomplete without a name, a counterpart or a class", () => {
    const m = model();

    assert.match(m.validate({ label: "", allClasses: true }, i18n), /name the relation/);
    assert.match(m.validate({ label: "blocks", inverse: "", allClasses: true }, i18n), /counterpart/);
    assert.match(m.validate({ label: "blocks", inverse: "is blocked by", allClasses: false, targetClasses: [] }, i18n), /target class/);
    assert.equal(m.validate({ label: "blocks", inverse: "is blocked by", allClasses: true }, i18n), null);
    assert.equal(m.validate({ label: "similar to", symmetric: true, allClasses: true }, i18n), null,
        "a symmetric relation needs no separate counterpart");
});

test("the preview reads the relation back from either end", () => {
    const m = model();
    const [forward, backward] = m.preview({ label: "blocks", inverse: "is blocked by" }, "BUG-00123", "any item");

    assert.deepEqual(forward, { left: "BUG-00123", relation: "blocks", right: "any item", subject: "left" });
    assert.deepEqual(backward, { left: "any item", relation: "is blocked by", right: "BUG-00123", subject: "right" });
});

test("the preview of a symmetric relation reads alike in both directions", () => {
    const m = model();
    const [forward, backward] = m.preview({ label: "similar to", symmetric: true }, "BUG-1", "any item");

    assert.equal(forward.relation, "similar to");
    assert.equal(backward.relation, "similar to");
});

test("a type is moved in front of the one it was dropped on", () => {
    const m = model();
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }];

    assert.deepEqual(m.orderIds(m.reorder(items, "c", "a")), ["c", "a", "b"]);
    assert.deepEqual(m.orderIds(m.reorder(items, "a", null)), ["b", "c", "a"], "a drop past the end appends");
    assert.deepEqual(m.orderIds(m.reorder(items, "a", "a")), ["a", "b", "c"], "a drop on itself changes nothing");
    assert.deepEqual(m.orderIds(m.reorder(items, "unknown", "a")), ["a", "b", "c"]);
    assert.deepEqual(m.orderIds(items), ["a", "b", "c"], "the input order is left untouched");
});

test("the effect column names what the relation does to the workflow", () => {
    const m = model();

    assert.equal(m.effectLabel("blocksCompletion", i18n), "Blocks completion");
    assert.equal(m.effectLabel("closesItem", i18n), "Closes item");
    assert.equal(m.effectLabel("aggregatesProgress", i18n), "Aggregates progress");
    assert.equal(m.effectLabel("none", i18n), "-");
});

test("an empty definition opens the editor on a one to one relation", () => {
    const m = model();
    const empty = m.emptyItem();

    assert.equal(empty.id, "");
    assert.equal(empty.cardinality, "1:1");
    assert.equal(empty.active, true);
});
