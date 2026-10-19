/**
 * Randomized convergence of shared rich text editing: several simulated clients make
 * concurrent structural, formatting, list, table and comment edits at the same and at
 * different positions while the network delays, reorders, duplicates and drops messages and
 * connections break. After every run all clients must hold the server's document, and that
 * document must satisfy the schema.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { scenario } from "./collaborative.sim.mjs";

/**
 * Asserts that every client converged on the server's valid document.
 * @param {object} run - The scenario result.
 * @param {number} seed - The seed, for the message.
 */
function converged(run, seed) {
    const { rt, server, clients } = run;
    const doc = server.docs.get("scope/field");
    assert.ok(doc, "the document was created");
    assert.equal(server.valid(doc.tokens), true, `seed ${seed}: the server document is schema-valid`);
    const expected = rt.Ot.stable(rt.Ot.compact(doc.tokens));
    for (const client of clients) {
        assert.equal(client.session.pending, false, `seed ${seed}: ${client.name} has nothing pending`);
        assert.equal(client.session.version, doc.version, `seed ${seed}: ${client.name} reached the server version`);
        assert.equal(rt.Ot.stable(client.editor.getCollaborationTokens()), expected, `seed ${seed}: ${client.name} shows the server document`);
        assert.equal(client.editor.checkCollaborationTokens(client.editor.getCollaborationTokens()), true);
    }
}

test("three clients converge on a reliable network", () => {
    for (let seed = 1; seed <= 60; seed++) converged(scenario({ seed, clients: 3, rounds: 80, faults: { reorder: 0, duplicate: 0 } }), seed);
});

test("clients converge despite reordered and duplicated messages and broken connections", () => {
    for (let seed = 100; seed <= 220; seed++) converged(scenario({ seed, clients: 3, rounds: 100 }), seed);
});

test("clients converge when the server's history no longer covers a reconnection", () => {
    for (let seed = 500; seed <= 560; seed++) converged(scenario({ seed, clients: 3, rounds: 100, retain: 3 }), seed);
});

test("many clients converge under heavy contention", () => {
    for (let seed = 900; seed <= 915; seed++) converged(scenario({ seed, clients: 6, rounds: 250, faults: { reorder: 0.3, duplicate: 0.1 } }), seed);
});
