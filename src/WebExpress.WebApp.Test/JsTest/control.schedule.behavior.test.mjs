/**
 * End-to-end tests for the REST schedule (wx-webapp-schedule).
 *
 * These run the whole path against the shipped code: the real WebUI schedule
 * base, the WebApp engine and the control itself. They cover what the data
 * control adds on top of the base - the range query, the reload on navigation,
 * the range and holiday caches, the separate holidays endpoint, the persisted
 * mutations, the error handling with its fallback and the ViewState binding.
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadControl } from "./controls.harness.mjs";
import { appendServiceIsland, appendResourceIsland, appendStateIsland } from "./harness.mjs";

const DEPS = ["webexpress.webapp.schedule.model.js"];
const FILE = "webexpress.webapp.schedule.js";

const AUGUST = { date: "2026-08-15", culture: "de-DE" };

/**
 * Lets the microtask queue drain so a load started in the constructor or by a
 * navigation completes.
 * @param {number} [turns=12] - The number of turns to yield.
 */
async function settle(turns = 12) {
    for (let i = 0; i < turns; i++) {
        await Promise.resolve();
    }
}

/**
 * Builds a host with the requested islands and constructs the control on it.
 * @param {object} rt - The loaded runtime.
 * @param {object} options - { config, service, holidays, state, items }.
 * @returns {{ctrl: object, host: object}} The control and its host.
 */
function build(rt, options = {}) {
    const host = rt.createElement("div");
    host.classList.add("wx-webapp-schedule");
    Object.assign(host.dataset, Object.assign({}, AUGUST, options.config || {}));

    if (options.state) {
        appendStateIsland(rt.document, host, options.state);
    }
    if (options.service !== false) {
        appendServiceIsland(rt.document, host, Object.assign(
            { name: "data", baseUri: "/api/schedule", method: "GET", updateMethod: "PUT", query: { from: "from", to: "to" } },
            options.service || {}));
    }
    if (options.holidays) {
        appendServiceIsland(rt.document, host, Object.assign(
            { name: "holidays", baseUri: "/api/holidays", method: "GET", query: { year: "year", region: "region" } },
            options.holidays === true ? {} : options.holidays));
    }

    for (const item of options.items || []) {
        const el = rt.createElement("div");
        el.className = "wx-schedule-item";
        el.id = item.id || "";
        Object.assign(el.dataset, item);
        host.appendChild(el);
    }

    rt.document.body.appendChild(host);

    return { ctrl: new rt.wxapp.ScheduleCtrl(host), host };
}

/**
 * Builds a runtime whose fetch records the calls and answers with a period.
 * @param {Function} [respond] - Optional custom responder.
 * @returns {{rt: object, calls: Array<object>}} The runtime and the call log.
 */
function runtime(respond) {
    const calls = [];
    const rt = loadControl({
        deps: DEPS,
        file: FILE,
        fetch: async (url, init) => {
            const method = (init && init.method) || "GET";
            calls.push({ url: String(url), method: method, body: init && init.body });

            if (respond) {
                const custom = respond(String(url), method, init);
                if (custom) {
                    return custom;
                }
            }

            return {
                ok: true, status: 200, json: async () => ({
                    items: [{ id: "m", title: "Meeting", start: "2026-08-12T10:00:00", end: "2026-08-12T11:00:00" }],
                    holidays: []
                })
            };
        }
    });

    return { rt, calls };
}

test("a standalone schedule loads the shown period as a range query", async () => {
    const { rt, calls } = runtime();
    const { ctrl, host } = build(rt);

    const arrived = [];
    host.addEventListener(rt.wx.Event.DATA_ARRIVED_EVENT, (e) => arrived.push(e.detail));

    await settle();

    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.includes("from=2026-08-01"), "the month is queried as a half-open range");
    assert.ok(calls[0].url.includes("to=2026-09-01"));
    assert.deepEqual(ctrl.value.map((i) => i.id), ["m"]);
    assert.deepEqual(arrived, [{ sender: host, id: host.id, from: "2026-08-01", to: "2026-09-01", count: 1 }]);
});

test("navigating loads the new range and the cache keeps it from loading twice", async () => {
    const { rt, calls } = runtime();
    const { ctrl } = build(rt);
    await settle();
    assert.equal(calls.length, 1);

    ctrl.next();
    await settle();
    assert.equal(calls.length, 2);
    assert.ok(calls[1].url.includes("from=2026-09-01"));

    // stepping back reaches a range that has already been loaded
    ctrl.previous();
    await settle();
    assert.equal(calls.length, 2, "the range cache answers the second visit");

    // an explicit refresh bypasses the cache
    await ctrl.refresh();
    await settle();
    assert.equal(calls.length, 3);
});

test("switching the view loads the range the new view shows", async () => {
    const { rt, calls } = runtime();
    const { ctrl } = build(rt);
    await settle();

    ctrl.view = "week";
    await settle();

    assert.equal(calls.length, 2);
    assert.ok(calls[1].url.includes("from=2026-08-10"), "the week of the anchor is queried");
    assert.ok(calls[1].url.includes("to=2026-08-17"));
});

test("the reload on navigation can be switched off", async () => {
    const { rt, calls } = runtime();
    const { ctrl } = build(rt, { config: { reloadOnNavigate: "false" } });
    await settle();
    assert.equal(calls.length, 1);

    ctrl.next();
    await settle();

    assert.equal(calls.length, 1, "navigating no longer triggers a load");
});

test("the initial load can be switched off, leaving the static items on screen", async () => {
    const { rt, calls } = runtime();
    const { ctrl } = build(rt, {
        config: { autoLoad: "false" },
        items: [{ id: "static", title: "Statisch", start: "2026-08-12T09:00:00", end: "2026-08-12T10:00:00" }]
    });
    await settle();

    assert.equal(calls.length, 0);
    assert.deepEqual(ctrl.value.map((i) => i.id), ["static"]);
});

test("the holidays are fetched per year and region from their own endpoint", async () => {
    const { rt, calls } = runtime((url) => {
        if (url.includes("/api/holidays")) {
            return { ok: true, status: 200, json: async () => [{ date: "2026-08-15", name: "Assumption", region: "BY", type: "public" }] };
        }
        return null;
    });
    const { ctrl } = build(rt, { holidays: true, config: { holidayRegion: "BY" } });
    await settle();

    const holidayCalls = calls.filter((c) => c.url.includes("/api/holidays"));
    assert.equal(holidayCalls.length, 1);
    assert.ok(holidayCalls[0].url.includes("year=2026"));
    assert.ok(holidayCalls[0].url.includes("region=BY"));
    assert.deepEqual(ctrl.model.holidays.map((h) => h.name), ["Assumption"]);

    // the year has been loaded, so stepping inside it costs no second request
    ctrl.next();
    await settle();
    assert.equal(calls.filter((c) => c.url.includes("/api/holidays")).length, 1);
});

test("a range crossing new year fetches both years of holidays", async () => {
    const { rt, calls } = runtime((url) => {
        if (url.includes("/api/holidays")) {
            return { ok: true, status: 200, json: async () => [] };
        }
        return null;
    });
    const { ctrl } = build(rt, { holidays: true, config: { date: "2026-12-15", view: "week" } });
    await settle();

    // the week of 28 December 2026 reaches into 2027
    ctrl.date = "2026-12-30";
    await settle();

    const years = calls
        .filter((c) => c.url.includes("/api/holidays"))
        .map((c) => /year=(\d+)/.exec(c.url)[1]);
    assert.deepEqual([...new Set(years)].sort(), ["2026", "2027"]);
});

test("moving an item persists it and reports the change", async () => {
    const { rt, calls } = runtime();
    const { ctrl, host } = build(rt);
    await settle();

    const changes = [];
    host.addEventListener(rt.wx.Event.CHANGE_VALUE_EVENT, (e) => changes.push(e.detail));

    ctrl.moveItem("m", new Date(2026, 7, 14, 10, 0), new Date(2026, 7, 14, 11, 0));
    await settle();

    const writes = calls.filter((c) => c.method === "PUT");
    assert.equal(writes.length, 1);
    const body = JSON.parse(writes[0].body);
    assert.equal(body.id, "m");
    assert.equal(body.start, "2026-08-14T10:00:00");
    assert.equal(body.end, "2026-08-14T11:00:00");

    assert.equal(changes.length, 1);
    assert.equal(changes[0].action, "update");
});

test("creating and deleting are refused unless they are enabled", async () => {
    const { rt, calls } = runtime((url, method) => {
        if (method === "POST") {
            return { ok: true, status: 200, json: async () => ({ success: true, item: { id: "new", title: "Neu", start: "2026-08-20T09:00:00" } }) };
        }
        if (method === "DELETE") {
            return { ok: true, status: 200, json: async () => ({ success: true }) };
        }
        return null;
    });

    const closed = build(rt, {});
    await settle();
    assert.equal(await closed.ctrl.createItem({ title: "x", start: "2026-08-20T09:00:00" }), null);
    assert.equal(await closed.ctrl.deleteItem("m"), false);
    assert.equal(calls.filter((c) => c.method !== "GET").length, 0);

    const open = build(rt, { config: { creatable: "true", deletable: "true" } });
    await settle();

    const created = await open.ctrl.createItem({ title: "Neu", start: "2026-08-20T09:00:00" });
    assert.equal(created.id, "new", "the server's version of the item wins");
    assert.ok(open.ctrl.value.some((i) => i.id === "new"));

    assert.equal(await open.ctrl.deleteItem("m"), true);
    assert.equal(open.ctrl.value.some((i) => i.id === "m"), false);
});

test("a failed load keeps the last good model and reports the failure", async () => {
    let fail = false;
    const { rt } = runtime(() => (fail ? { ok: false, status: 500, json: async () => ({}), text: async () => "boom" } : null));
    const { ctrl, host } = build(rt);
    await settle();
    assert.deepEqual(ctrl.value.map((i) => i.id), ["m"]);

    const errors = [];
    host.addEventListener(rt.wx.Event.DATA_ERROR_EVENT, (e) => errors.push(e.detail));

    const messages = [];
    const realError = console.error;
    console.error = (...args) => messages.push(args.map(String).join(" "));

    try {
        fail = true;
        await ctrl.refresh();
        await settle();

        assert.deepEqual(ctrl.value.map((i) => i.id), ["m"], "the calendar is not emptied by a failed load");
        assert.equal(errors.length, 1);
        assert.equal(errors[0].action, "load");
        assert.equal(host.classList.contains("placeholder-glow"), false);
        assert.ok(messages.some((m) => m.includes("schedule load failed")));
    } finally {
        console.error = realError;
    }
});

test("the statically authored items stay available as a fallback", async () => {
    const { rt } = runtime();
    const { ctrl } = build(rt, {
        items: [{ id: "static", title: "Statisch", start: "2026-08-12T09:00:00", end: "2026-08-12T10:00:00" }]
    });
    await settle();

    // the load replaced the model
    assert.deepEqual(ctrl.value.map((i) => i.id), ["m"]);

    ctrl.restoreFallback();
    assert.deepEqual(ctrl.value.map((i) => i.id), ["static"]);
});

test("a seeded schedule paints from the state island", async () => {
    const { rt } = runtime();
    const { ctrl } = build(rt, {
        config: { autoLoad: "false" },
        state: { loading: false }
    });
    await settle();

    // the seed only carries the ui state; the items come from the descriptors
    assert.equal(ctrl._loading, false);
    assert.deepEqual(ctrl.value, []);
});

test("a ViewState-bound schedule renders the resource slice", async () => {
    const { rt, calls } = runtime();

    const vsHost = rt.createElement("div");
    vsHost.id = "calendar-viewstate";
    vsHost.dataset.wxViewstate = "calendar-viewstate";
    appendServiceIsland(rt.document, vsHost, { name: "data", baseUri: "/api/schedule", method: "GET" });
    appendResourceIsland(rt.document, vsHost, { name: "period", service: "data", target: "period" });
    rt.document.body.appendChild(vsHost);

    const vs = new rt.wxapp.ViewState(vsHost);

    const host = rt.createElement("div");
    host.classList.add("wx-webapp-schedule");
    Object.assign(host.dataset, AUGUST);
    host.setAttribute("data-wx-resource", "period");
    host.dataset.wxResource = "period";
    vsHost.appendChild(host);

    const ctrl = new rt.wxapp.ScheduleCtrl(host);
    await settle(16);
    vs.flush();

    assert.equal(calls.length, 1, "the ViewState owns the single central load");
    assert.deepEqual(ctrl.value.map((i) => i.id), ["m"]);
});

test("the teardown releases the refresh timer", async () => {
    const { rt } = runtime();
    const { ctrl } = build(rt, { config: { refreshInterval: "30" } });
    await settle();

    assert.notEqual(ctrl._timer, null, "the interval is running");

    ctrl.destroy();
    assert.equal(ctrl._timer, null, "the teardown clears it");
});
