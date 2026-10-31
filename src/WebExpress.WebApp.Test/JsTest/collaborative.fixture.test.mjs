/**
 * Keeps the checked-in cross-language fixture in step with the client. The C# test
 * UnitTestCollaborativeFixture replays the same file against the server, so client and server
 * cannot drift apart unnoticed. Set WEBEXPRESS_UPDATE_FIXTURE=1 to rewrite the file after an
 * intended change of the format or the schema.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildFixture } from "./collaborative.fixture.mjs";

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "collaborative.fixture.json");

test("the cross-language fixture matches what the client computes", () => {
    const fixture = buildFixture();
    if (process.env.WEBEXPRESS_UPDATE_FIXTURE === "1") fs.writeFileSync(file, JSON.stringify(fixture, null, 1).replace(/\n/g, "\r\n") + "\r\n");
    const stored = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.deepEqual(stored, fixture);
});

test("the fixture covers valid and invalid documents and failing steps", () => {
    const stored = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.ok(stored.histories.every(h => h.operations.flat().length > 20), "every history sequenced real work");
    assert.ok(stored.verdicts.filter(v => v.valid).length > 20 && stored.verdicts.filter(v => !v.valid).length > 50);
    assert.ok(stored.applies.some(a => a.result === null) && stored.applies.some(a => a.result !== null));
});
