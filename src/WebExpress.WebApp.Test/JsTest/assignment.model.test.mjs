/**
 * Tests the pure model of the assignment control: the normalised state, the action that
 * applies to the caller, the initials and the candidates of the search.
 *
 * Run with Node 18 or newer from the jstest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, webappAsset } from "./harness.mjs";

function model() {
    return loadEngine({ extraFiles: [webappAsset("webexpress.webapp.assignment.model.js")] }).wxapp.assignmentModel;
}

const grace = { id: "u1", name: "Grace Hopper" };
const ada = { id: "u2", name: "Ada Lovelace", image: "/img/ada.png" };

test("normalize tolerates a missing or malformed answer", () => {
    const m = model();

    assert.deepEqual(JSON.parse(JSON.stringify(m.normalize(null))), { assignee: null, self: null, mayChange: false });
    assert.deepEqual(JSON.parse(JSON.stringify(m.normalize({ assignee: "u1", self: {}, mayChange: "yes" }))),
        { assignee: null, self: null, mayChange: false }, "only records with an id and a real boolean count");
    assert.equal(m.normalize({ assignee: grace, self: ada, mayChange: true }).assignee.id, "u1");
});

test("the primary action is unassign for the assignee and assign to me for anyone else", () => {
    const m = model();

    assert.equal(m.primaryAction({ assignee: grace, self: grace, mayChange: true }), "unassign");
    assert.equal(m.primaryAction({ assignee: grace, self: ada, mayChange: true }), "assign");
    assert.equal(m.primaryAction({ assignee: null, self: ada, mayChange: true }), "assign");
});

test("no primary action without the right or without a known caller", () => {
    const m = model();

    assert.equal(m.primaryAction({ assignee: grace, self: grace, mayChange: false }), null);
    assert.equal(m.primaryAction({ assignee: grace, self: null, mayChange: true }), null);
});

test("initials prefer the given badge and fall back to the first two words", () => {
    const m = model();

    assert.equal(m.initials({ name: "Grace Hopper", initials: "GH!" }), "GH!");
    assert.equal(m.initials({ name: "murray the demonic skull" }), "MT");
    assert.equal(m.initials({ name: "  Ada  " }), "A");
    assert.equal(m.initials(null), "");
});

test("the current assignee is not offered again", () => {
    const m = model();

    const result = m.candidates([grace, ada, null, { name: "no id" }], grace);
    assert.deepEqual(result.map((u) => u.id), ["u2"]);
    assert.deepEqual(m.candidates("not a list", grace), []);
});

test("changed compares by id", () => {
    const m = model();

    assert.equal(m.changed(null, grace), true);
    assert.equal(m.changed(grace, null), true);
    assert.equal(m.changed(grace, { id: "u1", name: "renamed" }), false);
    assert.equal(m.changed(null, null), false);
});
