/**
 * Headless unit tests for the REST schedule model helpers.
 *
 * These cover the pure logic extracted from webexpress.webapp.schedule.js: the
 * period read with its aliases, the item and holiday normalisation, the cache
 * keys, the years a range touches, the range merge that keeps the months
 * already loaded, and the payload of a write - plus an end to end path that
 * loads a period and persists a move through a service.
 *
 * Run with Node 18 or newer from the jstest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, webappAsset } from "./harness.mjs";

function load(options) {
    return loadEngine(Object.assign(
        { extraFiles: [webappAsset("webexpress.webapp.schedule.model.js")] },
        options
    ));
}

test("normalize period maps the items and holidays with defaults", () => {
    const { wxapp } = load();
    const period = wxapp.scheduleModel.normalizePeriod({
        items: [
            { id: 7, title: "Standup", start: "2026-08-12T09:00:00", end: "2026-08-12T09:15:00" },
            { id: "v", title: "Voyage", start: "2026-08-14T00:00:00", allDay: "true", meta: { ship: "Sea Monkey" } }
        ],
        holidays: [{ date: "2026-08-15T00:00:00", name: "Assumption", region: "BY", type: "PUBLIC" }]
    });

    assert.equal(period.items[0].id, "7", "a numeric id is coerced to text");
    assert.equal(period.items[0].allDay, false);
    assert.equal(period.items[1].allDay, true, "the stringified flag is accepted");
    assert.deepEqual(period.items[1].meta, { ship: "Sea Monkey" });
    assert.equal(period.items[1].end, "");

    // a holiday is keyed by its day, so a full timestamp is trimmed
    assert.equal(period.holidays[0].date, "2026-08-15");
    assert.equal(period.holidays[0].type, "public");
});

test("normalize period reads the events alias and tolerates a malformed payload", () => {
    const { wxapp } = load();
    const model = wxapp.scheduleModel;

    const aliased = model.normalizePeriod({ events: [{ id: "a", start: "2026-08-12T09:00:00" }] });
    assert.deepEqual(aliased.items.map((i) => i.id), ["a"]);

    assert.deepEqual(model.normalizePeriod(null), { items: [], holidays: [] });
    assert.deepEqual(model.normalizePeriod({ items: "nope", holidays: 7 }), { items: [], holidays: [] });
    assert.deepEqual(model.normalizePeriod({ items: [null, "x"] }).items, []);
});

test("normalize holidays accepts the bare array and the wrapped form", () => {
    const { wxapp } = load();
    const model = wxapp.scheduleModel;

    assert.equal(model.normalizeHolidays([{ date: "2026-01-01", name: "New Year" }]).length, 1);
    assert.equal(model.normalizeHolidays({ holidays: [{ date: "2026-01-01" }] }).length, 1);

    // an entry without a usable date could never be matched to a day
    assert.deepEqual(model.normalizeHolidays([{ name: "nowhere" }, { date: "nope" }]), []);
    assert.deepEqual(model.normalizeHolidays(null), []);
});

test("the cache keys separate ranges, years and regions", () => {
    const { wxapp } = load();
    const model = wxapp.scheduleModel;

    assert.equal(model.rangeKey("2026-08-01", "2026-09-01"), "2026-08-01..2026-09-01");
    assert.notEqual(model.rangeKey("2026-08-01", "2026-09-01"), model.rangeKey("2026-08-01", "2026-08-08"));
    assert.equal(model.holidayKey(2026, "BY"), "2026@BY");
    assert.notEqual(model.holidayKey(2026, "BY"), model.holidayKey(2026, "NW"));
    assert.equal(model.holidayKey(2026, ""), "2026@");
});

test("a range reports the years its holidays have to be fetched for", () => {
    const { wxapp } = load();
    const model = wxapp.scheduleModel;

    assert.deepEqual(model.yearsInRange("2026-08-01", "2026-09-01"), [2026]);
    // a December view reaching into January needs both years
    assert.deepEqual(model.yearsInRange("2026-12-28", "2027-01-04"), [2026, 2027]);
    // a range ending exactly on new year does not reach into that year
    assert.deepEqual(model.yearsInRange("2026-12-01", "2027-01-01"), [2026]);
    assert.deepEqual(model.yearsInRange("", ""), []);
});

test("merging a range replaces what it covers and keeps the rest", () => {
    const { wxapp } = load();
    const model = wxapp.scheduleModel;

    const existing = [
        { id: "july", start: "2026-07-20T09:00:00" },
        { id: "stale", start: "2026-08-05T09:00:00" },
        { id: "september", start: "2026-09-04T09:00:00" }
    ];
    const loaded = [
        { id: "fresh", start: "2026-08-06T09:00:00" },
        { id: "stale", start: "2026-08-05T10:00:00" }
    ];

    const merged = model.mergeRange(existing, loaded, "2026-08-01", "2026-09-01");

    assert.deepEqual(merged.map((i) => i.id).sort(), ["fresh", "july", "september", "stale"]);
    // the reloaded copy of the item wins
    assert.equal(merged.find((i) => i.id === "stale").start, "2026-08-05T10:00:00");
});

test("merging removes an item that moved out of the reloaded range", () => {
    const { wxapp } = load();
    const model = wxapp.scheduleModel;

    // the item used to be in August and now comes back in September
    const merged = model.mergeRange(
        [{ id: "trip", start: "2026-08-20T09:00:00" }],
        [{ id: "trip", start: "2026-09-20T09:00:00" }],
        "2026-09-01", "2026-10-01");

    assert.equal(merged.length, 1, "the item is not duplicated across the ranges");
    assert.equal(merged[0].start, "2026-09-20T09:00:00");
});

test("range membership is decided by the start, so a multi-day item belongs to one range", () => {
    const { wxapp } = load();
    const model = wxapp.scheduleModel;

    const item = { id: "trip", start: "2026-07-30T00:00:00", end: "2026-08-04T00:00:00" };

    assert.equal(model.startsWithin(item, "2026-07-01", "2026-08-01"), true);
    assert.equal(model.startsWithin(item, "2026-08-01", "2026-09-01"), false);
    assert.equal(model.startsWithin({ id: "x" }, "2026-08-01", "2026-09-01"), false);
});

test("the write payload carries the full item shape", () => {
    const { wxapp } = load();
    const payload = wxapp.scheduleModel.toPayload({
        id: 12, title: "Standup", start: "2026-08-12T09:00:00", end: "2026-08-12T09:15:00",
        allDay: false, category: "crew", icon: "fas fa-users", meta: { room: "Scumm Bar" }
    });

    assert.deepEqual(payload, {
        id: "12", title: "Standup", start: "2026-08-12T09:00:00", end: "2026-08-12T09:15:00",
        allDay: false, category: "crew", colorCss: "", colorStyle: "", icon: "fas fa-users",
        uri: "", meta: { room: "Scumm Bar" }
    });
});

test("model loads a period and persists a move through a service", async () => {
    const { wxapp, setFetch } = load();
    const calls = [];
    setFetch(async (url, init) => {
        const method = (init && init.method) || "GET";
        calls.push({ url: url, method: method, body: init && init.body });
        if (method === "GET") {
            return {
                ok: true, status: 200, json: async () => ({
                    items: [{ id: "m", title: "Meeting", start: "2026-08-12T10:00:00", end: "2026-08-12T11:00:00" }],
                    holidays: [{ date: "2026-08-15", name: "Assumption", type: "public" }]
                })
            };
        }
        return { ok: true, status: 200, json: async () => ({ success: true }) };
    });

    const service = wxapp.ServiceRegistry.create({
        name: "data", kind: "rest", baseUri: "/api/schedule",
        method: "GET", updateMethod: "PUT", query: { from: "from", to: "to" }
    });

    const loaded = await service.query({ from: "2026-08-01", to: "2026-09-01" });
    assert.equal(calls[0].method, "GET");
    assert.ok(calls[0].url.includes("from=2026-08-01"), "the range travels as query parameters");
    assert.ok(calls[0].url.includes("to=2026-09-01"));

    const period = wxapp.scheduleModel.normalizePeriod(loaded.data);
    assert.equal(period.items[0].id, "m");
    assert.equal(period.holidays[0].date, "2026-08-15");

    const moved = await service.update(wxapp.scheduleModel.toPayload({
        id: "m", title: "Meeting", start: "2026-08-14T10:00:00", end: "2026-08-14T11:00:00"
    }));
    assert.equal(calls[1].method, "PUT");
    assert.equal(JSON.parse(calls[1].body).start, "2026-08-14T10:00:00");
    assert.equal(moved.ok, true);
});
