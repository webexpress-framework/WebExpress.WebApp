/**
 * Headless unit tests for the scrum velocity model helpers (View, State and
 * Service).
 *
 * These cover the pure logic extracted from webexpress.webapp.scrum.velocity.js,
 * namely the list and sprint normalisation, the trailing slice of the last n
 * sprints, the average velocity and the chart scale, plus an end to end path
 * that loads the sprints with a query through a service.
 *
 * Run with Node 18 or newer from the jstest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, webappAsset } from "./harness.mjs";

function load(options) {
    return loadEngine(Object.assign(
        { extraFiles: [webappAsset("webexpress.webapp.scrum.velocity.model.js")] },
        options
    ));
}

test("normalize list completes each sprint and defaults to empty", () => {
    const { wxapp } = load();

    const normalized = wxapp.scrumVelocityModel.normalizeList([{ id: 1, name: "Sprint 1", committed: 30, completed: 24 }]);
    assert.deepEqual(normalized, [{
        id: "1",
        name: "Sprint 1",
        committed: 30,
        completed: 24
    }]);

    assert.deepEqual(wxapp.scrumVelocityModel.normalizeList(null), []);
    assert.deepEqual(wxapp.scrumVelocityModel.normalizeList({ id: "a" }), []);
});

test("normalize sprint coerces malformed points to zero and accepts aliases", () => {
    const { wxapp } = load();

    assert.equal(wxapp.scrumVelocityModel.normalizeSprint({ name: "X", completed: -4 }).completed, 0);
    assert.equal(wxapp.scrumVelocityModel.normalizeSprint({ name: "X", completed: "nope" }).completed, 0);
    assert.equal(wxapp.scrumVelocityModel.normalizeSprint({ name: "X", completed: 21.8 }).completed, 21);
    assert.equal(wxapp.scrumVelocityModel.normalizeSprint({ committedPoints: 40, completedPoints: 33 }).committed, 40);
    assert.equal(wxapp.scrumVelocityModel.normalizeSprint({ committedPoints: 40, completedPoints: 33 }).completed, 33);
    assert.equal(wxapp.scrumVelocityModel.normalizeSprint(null).name, "");
});

test("last n keeps the trailing slice in order", () => {
    const { wxapp } = load();
    const sprints = [{ name: "1" }, { name: "2" }, { name: "3" }, { name: "4" }, { name: "5" }];

    assert.deepEqual(wxapp.scrumVelocityModel.lastN(sprints, 3).map(s => s.name), ["3", "4", "5"]);
    // a non-positive or oversized count returns the whole list
    assert.deepEqual(wxapp.scrumVelocityModel.lastN(sprints, 0).map(s => s.name), ["1", "2", "3", "4", "5"]);
    assert.deepEqual(wxapp.scrumVelocityModel.lastN(sprints, 99).map(s => s.name), ["1", "2", "3", "4", "5"]);
    assert.deepEqual(wxapp.scrumVelocityModel.lastN(null, 3), []);
});

test("average is the mean completed and tolerates empties", () => {
    const { wxapp } = load();
    assert.equal(wxapp.scrumVelocityModel.average([{ completed: 20 }, { completed: 30 }, { completed: 25 }]), 25);
    assert.equal(wxapp.scrumVelocityModel.average([{ completed: 10 }, { completed: 5 }]), 7.5);
    assert.equal(wxapp.scrumVelocityModel.average([]), 0);
    assert.equal(wxapp.scrumVelocityModel.average(null), 0);
});

test("max value scales over committed and completed, never below one", () => {
    const { wxapp } = load();
    assert.equal(wxapp.scrumVelocityModel.maxValue([{ committed: 30, completed: 24 }, { committed: 28, completed: 31 }]), 31);
    assert.equal(wxapp.scrumVelocityModel.maxValue([{ committed: 0, completed: 0 }]), 1);
    assert.equal(wxapp.scrumVelocityModel.maxValue([]), 1);
});

test("model loads the sprints through a service end to end", async () => {
    const { wxapp, setFetch } = load();
    const calls = [];
    setFetch(async (url, init) => {
        const method = (init && init.method) || "GET";
        calls.push({ url: url, method: method });
        return {
            ok: true,
            status: 200,
            json: async () => [
                { id: "s1", name: "Sprint Mêlée 1", committed: 30, completed: 24 },
                { id: "s2", name: "Sprint Monkey 2", committed: 28, completed: 27 }
            ]
        };
    });

    const service = wxapp.ServiceRegistry.create({ name: "data", kind: "rest", baseUri: "/api/scrum/velocity", method: "GET" });

    const loaded = await service.query({});
    assert.equal(calls[0].method, "GET");

    const sprints = wxapp.scrumVelocityModel.normalizeList(loaded.data);
    assert.deepEqual(sprints.map(s => s.id), ["s1", "s2"]);
    assert.equal(wxapp.scrumVelocityModel.average(sprints), 25.5);
    assert.equal(wxapp.scrumVelocityModel.maxValue(sprints), 30);
});
