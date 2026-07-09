/**
 * Headless unit tests for the scrum team workload model helpers (View, State
 * and Service).
 *
 * These cover the pure logic extracted from webexpress.webapp.scrum.team.js,
 * namely the list and member normalisation, the initials derivation, the point
 * total and the descending sort, plus an end to end path that loads the members
 * with a query through a service.
 *
 * Run with Node 18 or newer from the jstest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, webappAsset } from "./harness.mjs";

function load(options) {
    return loadEngine(Object.assign(
        { extraFiles: [webappAsset("webexpress.webapp.scrum.team.model.js")] },
        options
    ));
}

test("normalize list completes each member and defaults to empty", () => {
    const { wxapp } = load();

    const normalized = wxapp.scrumTeamModel.normalizeList([{ id: 1, name: "Guybrush Threepwood", points: 8, completed: 3 }]);
    assert.deepEqual(normalized, [{
        id: "1",
        name: "Guybrush Threepwood",
        team: "",
        initials: "GT",
        color: "#888",
        image: null,
        points: 8,
        completed: 3
    }]);

    assert.deepEqual(wxapp.scrumTeamModel.normalizeList(null), []);
    assert.deepEqual(wxapp.scrumTeamModel.normalizeList({ id: "a" }), []);
});

test("normalize member keeps explicit fields and clamps invalid points", () => {
    const { wxapp } = load();

    const explicit = wxapp.scrumTeamModel.normalizeMember({ id: "elaine", name: "Elaine Marley", team: "Gov", initials: "EM", color: "#7c3aed", image: "/img/elaine.png", points: 13, completed: 8 });
    assert.equal(explicit.initials, "EM");
    assert.equal(explicit.color, "#7c3aed");
    assert.equal(explicit.image, "/img/elaine.png");
    assert.equal(explicit.points, 13);
    assert.equal(explicit.completed, 8);

    assert.equal(wxapp.scrumTeamModel.normalizeMember({ name: "X", points: -4 }).points, 0);
    assert.equal(wxapp.scrumTeamModel.normalizeMember({ name: "X", points: "nope" }).points, 0);
    assert.equal(wxapp.scrumTeamModel.normalizeMember({ name: "X", points: 5.9 }).points, 5);
    assert.equal(wxapp.scrumTeamModel.normalizeMember(null).initials, "?");
});

test("normalize member clamps completed to the planned load", () => {
    const { wxapp } = load();

    // completed can never exceed the planned points
    assert.equal(wxapp.scrumTeamModel.normalizeMember({ name: "X", points: 5, completed: 9 }).completed, 5);
    // a missing or malformed completed value defaults to zero
    assert.equal(wxapp.scrumTeamModel.normalizeMember({ name: "X", points: 5 }).completed, 0);
    assert.equal(wxapp.scrumTeamModel.normalizeMember({ name: "X", points: 5, completed: -2 }).completed, 0);
    // the alternate completedPoints field name is accepted
    assert.equal(wxapp.scrumTeamModel.normalizeMember({ name: "X", points: 5, completedPoints: 3 }).completed, 3);
});

test("derive initials uses the first and last word", () => {
    const { wxapp } = load();
    assert.equal(wxapp.scrumTeamModel.deriveInitials("Guybrush Threepwood"), "GT");
    assert.equal(wxapp.scrumTeamModel.deriveInitials("Murray, the Demonic Skull"), "MS");
    assert.equal(wxapp.scrumTeamModel.deriveInitials("Stan"), "ST");
    assert.equal(wxapp.scrumTeamModel.deriveInitials("   "), "?");
});

test("total points sums and tolerates malformed values", () => {
    const { wxapp } = load();
    assert.equal(wxapp.scrumTeamModel.totalPoints([{ points: 8 }, { points: 13 }, { points: 5 }]), 26);
    assert.equal(wxapp.scrumTeamModel.totalPoints([{ points: 8 }, { points: "x" }, {}]), 8);
    assert.equal(wxapp.scrumTeamModel.totalPoints(null), 0);
});

test("completed points sums the completed field independently", () => {
    const { wxapp } = load();
    assert.equal(wxapp.scrumTeamModel.completedPoints([{ points: 8, completed: 5 }, { points: 13, completed: 13 }, { points: 5, completed: 0 }]), 18);
    assert.equal(wxapp.scrumTeamModel.completedPoints([{ completed: 3 }, { completed: "x" }, {}]), 3);
    assert.equal(wxapp.scrumTeamModel.completedPoints(null), 0);
});

test("sort by points orders descending, breaking ties on name", () => {
    const { wxapp } = load();
    const members = [
        { name: "Elaine", points: 8 },
        { name: "Guybrush", points: 13 },
        { name: "Adam", points: 8 }
    ];

    const sorted = wxapp.scrumTeamModel.sortByPoints(members);
    assert.deepEqual(sorted.map(m => m.name), ["Guybrush", "Adam", "Elaine"]);

    // the input list is not mutated
    assert.deepEqual(members.map(m => m.name), ["Elaine", "Guybrush", "Adam"]);
});

test("model loads the members through a service end to end", async () => {
    const { wxapp, setFetch } = load();
    const calls = [];
    setFetch(async (url, init) => {
        const method = (init && init.method) || "GET";
        calls.push({ url: url, method: method });
        return {
            ok: true,
            status: 200,
            json: async () => [
                { id: "guybrush", name: "Guybrush Threepwood", points: 13, completed: 5 },
                { id: "elaine", name: "Elaine Marley", points: 8, completed: 8 }
            ]
        };
    });

    const service = wxapp.ServiceRegistry.create({ name: "data", kind: "rest", baseUri: "/api/scrum/team", method: "GET" });

    const loaded = await service.query({});
    assert.equal(calls[0].method, "GET");

    const members = wxapp.scrumTeamModel.normalizeList(loaded.data);
    assert.deepEqual(members.map(m => m.id), ["guybrush", "elaine"]);
    assert.equal(wxapp.scrumTeamModel.totalPoints(members), 21);
    assert.equal(wxapp.scrumTeamModel.completedPoints(members), 13);
});
