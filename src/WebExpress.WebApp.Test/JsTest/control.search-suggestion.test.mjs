/**
 * Headless contract and behavior tests for the SearchSuggestionCtrl control
 * (wx-webapp-search-suggestion). The shared contract (controls.contract.mjs)
 * covers registration and the construct / teardown lifecycle.
 *
 * The behavior tests below cover what the control adds on top of the framework
 * search box it extends: the request it builds for a term, the item stream it
 * renders (items, headers, dividers and the empty state), the guards around a
 * slow or failing endpoint, and the keyboard that turns a suggestion into a
 * navigation.
 *
 * The endpoint is driven through the real service layer, so the fetch stub has
 * to answer like a json response - the layer reads the content type before it
 * parses, and a plain object would arrive as data: null.
 */
import { test } from "node:test";
import assert from "node:assert";
import { loadControl } from "./controls.harness.mjs";
import { appendServiceIsland } from "./harness.mjs";
import { contract } from "./controls.contract.mjs";

const FILE = "webexpress.webapp.search.suggestion.js";
const SELECTOR = "wx-webapp-search-suggestion";
const ENDPOINT = "/api/v1/search";

contract({
    file: FILE,
    selector: SELECTOR,
    ctrl: "SearchSuggestionCtrl"
});

/**
 * Wraps a payload in the response shape the service layer expects.
 * @param {object} payload - The json body.
 * @param {number} [status=200] - The http status.
 * @returns {object} The response stub.
 */
function jsonResponse(payload, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status: status,
        headers: { get: () => "application/json" },
        json: async () => payload,
        text: async () => JSON.stringify(payload)
    };
}

/**
 * Lets the microtask queue drain so a fetch started by the control completes.
 * @param {number} [turns=8] - The number of turns to yield.
 * @returns {Promise<void>} Resolves once the queue is drained.
 */
async function settle(turns = 8) {
    for (let i = 0; i < turns; i++) {
        await Promise.resolve();
    }
}

/**
 * Builds the markup ControlDataSearch renders - a host carrying the marker class
 * and the wx-service island that names the endpoint - and constructs the control
 * on it.
 * @param {object} options - { answer, service, maxItems, queryParam, submitUri, emptyText, popper }.
 * @returns {object} The runtime, the host, the controller and the recorded urls.
 */
function makeSearch(options = {}) {
    const urls = [];
    const answer = options.answer || (() => ({ items: [] }));

    const rt = loadControl({
        file: FILE,
        fetch: async (url) => {
            urls.push(url);
            return answer(url, urls.length);
        },
        extraGlobals: options.popper ? { Popper: { createPopper: options.popper } } : {}
    });

    const host = rt.createElement("div");
    host.classList.add(SELECTOR);

    if (options.service !== false) {
        appendServiceIsland(rt.document, host, { name: "data", baseUri: ENDPOINT, method: "GET" });
    }

    // the control reads its configuration through the dataset api; the stub keeps
    // attributes and dataset apart, so the test writes the side that is read
    if (options.maxItems != null) { host.dataset.maxitems = String(options.maxItems); }
    if (options.queryParam) { host.dataset.queryparam = options.queryParam; }
    if (options.submitUri) { host.dataset.submituri = options.submitUri; }
    if (options.emptyText) { host.dataset.emptytext = options.emptyText; }

    rt.document.body.appendChild(host);

    const ctrl = new rt.wxapp.SearchSuggestionCtrl(host);

    return {
        rt,
        host,
        ctrl,
        urls,
        input: ctrl._searchInput,
        menu: ctrl._suggestionMenu,
        box: ctrl._suggestionBox,
        entries: () => ctrl._suggestionBox.children,
        key: (key) => ctrl._searchInput.dispatchEvent({
            type: "keydown",
            key: key,
            defaultPrevented: false,
            preventDefault() { this.defaultPrevented = true; }
        })
    };
}

test("the term and the entry cap travel in the query string", async () => {
    const search = makeSearch({
        maxItems: 5,
        answer: () => jsonResponse({ items: [{ id: "1", text: "Guybrush", uri: "/crew/1" }] })
    });

    await search.ctrl._fetch("guy");

    assert.equal(search.urls.length, 1, "the term is asked for once");
    assert.ok(search.urls[0].startsWith(ENDPOINT), "the request hits the service endpoint");
    assert.match(search.urls[0], /[?&]q=guy(&|$)/, "the term rides in the canonical q parameter");
    assert.match(search.urls[0], /[?&]l=5(&|$)/, "and the entry cap in l");

    const entries = search.entries();
    assert.equal(entries.length, 1, "the answer is rendered");
    assert.equal(entries[0].querySelector("a").getAttribute("href"), "/crew/1", "a suggestion is a link to its target");
    assert.equal(search.menu.style.display, "flex", "and the menu is open");
});

test("a custom query parameter is sent alongside the canonical one", async () => {
    const search = makeSearch({
        queryParam: "term",
        answer: () => jsonResponse({ items: [] })
    });

    await search.ctrl._fetch("grog");

    // an endpoint that reads only the convention still has to receive the term,
    // so the canonical q travels next to the configured name rather than instead
    assert.match(search.urls[0], /[?&]term=grog(&|$)/, "the configured parameter carries the term");
    assert.match(search.urls[0], /[?&]q=grog(&|$)/, "and so does the canonical one");
});

test("headers and dividers ride in the item stream and do not count against the cap", async () => {
    const search = makeSearch({
        maxItems: 2,
        answer: () => jsonResponse({
            items: [
                { type: "header", text: "Recently opened" },
                { id: "1", text: "Guybrush", uri: "/crew/1" },
                { type: "divider" },
                { id: "2", text: "LeChuck", uri: "/crew/2" },
                { id: "3", text: "Elaine", uri: "/crew/3" }
            ]
        })
    });

    await search.ctrl._fetch("");

    const classes = Array.from(search.entries()).map((x) => x.className);

    assert.deepEqual(classes, [
        "dropdown-header",
        "dropdown-item",
        "dropdown-divider",
        "dropdown-item"
    ], "the structural entries are kept and only the selectable ones are capped");
});

test("an answer without a single suggestion renders the empty state", async () => {
    const search = makeSearch({
        emptyText: "No matches found.",
        answer: () => jsonResponse({ items: [] })
    });

    await search.ctrl._fetch("kraken");

    const entries = search.entries();
    assert.equal(entries.length, 1);
    assert.ok(entries[0].classList.contains("wx-search-empty"), "the empty state stands in for the suggestions");
    assert.equal(entries[0].getAttribute("aria-disabled"), "true", "and is not offered to the keyboard");

    // the menu still opens: the empty state is exactly what the user has to see
    assert.equal(search.menu.style.display, "flex");
});

test("a stale answer never overwrites the suggestions of a newer term", async () => {
    const gates = [];
    const search = makeSearch({
        // every answer labels itself with the term it belongs to, so the rendered
        // menu says which of the two requests won
        answer: (url) => new Promise((resolve) => gates.push(() => resolve(jsonResponse({
            items: [{ id: url, text: new URLSearchParams(url.split("?")[1]).get("q"), uri: "/x" }]
        }))))
    });

    const slow = search.ctrl._fetch("gu");
    const fast = search.ctrl._fetch("guybrush");

    // the first request answers last, which is the race the request id guards
    gates[1]();
    await fast;
    gates[0]();
    await slow;

    const labels = Array.from(search.entries()).map((x) => x.textContent);
    assert.deepEqual(labels, ["guybrush"], "the newest term owns the menu");
    assert.equal(search.ctrl._loadedTerm, "guybrush", "and the loaded term is not rolled back");
});

test("a failed request falls back to the empty state and reports the error", async () => {
    const search = makeSearch({
        emptyText: "No matches found.",
        answer: () => jsonResponse({ error: "boom" }, 500)
    });

    const arrived = [];
    search.host.addEventListener(search.rt.wx.Event.DATA_ARRIVED_EVENT, (e) => arrived.push(e.detail));

    const errors = [];
    const realError = console.error;
    console.error = (...args) => errors.push(args.join(" "));

    try {
        await search.ctrl._fetch("guy");
    } finally {
        console.error = realError;
    }

    const entries = search.entries();
    assert.equal(entries.length, 1);
    assert.ok(entries[0].classList.contains("wx-search-empty"), "stale hits are dropped rather than left standing");

    assert.equal(arrived.length, 1, "the failure is still announced");
    assert.equal(arrived[0].count, 0);
    assert.ok(arrived[0].error, "and carries the reason");
    assert.ok(errors.length > 0, "the failure is logged");
});

test("the data lifecycle events carry the endpoint and the term", async () => {
    const search = makeSearch({
        answer: () => jsonResponse({ items: [{ id: "1", text: "Guybrush", uri: "/crew/1" }] })
    });

    const events = [];
    search.host.addEventListener(search.rt.wx.Event.DATA_REQUESTED_EVENT, (e) => events.push(["requested", e.detail]));
    search.host.addEventListener(search.rt.wx.Event.DATA_ARRIVED_EVENT, (e) => events.push(["arrived", e.detail]));

    await search.ctrl._fetch("guy");

    assert.deepEqual(events.map((x) => x[0]), ["requested", "arrived"]);
    assert.equal(events[0][1].endpoint, ENDPOINT);
    assert.equal(events[0][1].term, "guy");
    assert.equal(events[1][1].count, 1, "the arrival reports how many suggestions came back");
    assert.equal(events[1][1].error, null);
});

test("the arrow keys walk the suggestions and stop at both ends", async () => {
    const search = makeSearch({
        answer: () => jsonResponse({
            items: [
                { id: "1", text: "Guybrush", uri: "/crew/1" },
                { id: "2", text: "LeChuck", uri: "/crew/2" }
            ]
        })
    });

    await search.ctrl._fetch("");

    const active = () => Array.from(search.entries()).map((x) => x.classList.contains("active"));

    search.key("ArrowDown");
    assert.deepEqual(active(), [true, false], "the first suggestion takes the highlight");

    search.key("ArrowDown");
    assert.deepEqual(active(), [false, true], "the highlight moves on");

    search.key("ArrowDown");
    assert.deepEqual(active(), [false, true], "and stops at the last entry");

    search.key("ArrowUp");
    search.key("ArrowUp");
    assert.deepEqual(active(), [true, false], "moving back stops at the first");
});

test("enter opens the highlighted suggestion", async () => {
    const search = makeSearch({
        answer: () => jsonResponse({ items: [{ id: "1", text: "Guybrush", uri: "/crew/1" }] })
    });

    await search.ctrl._fetch("guy");

    search.key("ArrowDown");
    search.key("Enter");

    assert.equal(search.rt.sandbox.window.location.href, "/crew/1", "the highlighted target is opened");
});

test("enter without a highlight submits the term to the declared page", async () => {
    const search = makeSearch({
        submitUri: "/search",
        answer: () => jsonResponse({ items: [] })
    });

    search.ctrl.value = "grog";
    search.key("Enter");

    assert.equal(
        search.rt.sandbox.window.location.href,
        "/search?q=grog",
        "the term reaches the full results page in the configured parameter");
});

test("a term-less submit is ignored", () => {
    const search = makeSearch({ submitUri: "/search" });
    const before = search.rt.sandbox.window.location.href;

    search.key("Enter");

    // submitting nothing would open the results page with no query at all
    assert.equal(search.rt.sandbox.window.location.href, before, "the page is not opened");
});

test("a suggestion without a target adopts the term instead of navigating", async () => {
    const search = makeSearch({
        answer: () => jsonResponse({ items: [{ id: "1", text: "is:open" }] })
    });

    await search.ctrl._fetch("is");

    const before = search.rt.sandbox.window.location.href;
    search.entries()[0].dispatchEvent({ type: "click", preventDefault() { } });

    assert.equal(search.rt.sandbox.window.location.href, before, "nothing is opened");
    assert.equal(search.ctrl.value, "is:open", "the label becomes the search term");
    assert.equal(search.menu.style.display, "none", "and the menu closes");
});

test("the open menu is re-measured, so it lands on the control", async () => {
    const updates = [];
    const search = makeSearch({
        popper: () => ({
            update: () => updates.push(true),
            forceUpdate: () => { },
            setOptions: async () => { },
            destroy: () => { },
            state: { elements: {}, modifiersData: {}, rects: {} }
        }),
        answer: () => jsonResponse({ items: [{ id: "1", text: "Guybrush", uri: "/crew/1" }] })
    });

    // popper measures once, while the menu is still display:none and therefore
    // has neither a box nor an offset parent; without a second measurement the
    // menu keeps those coordinates and is drawn far from the search box
    const before = updates.length;
    await search.ctrl._fetch("guy");

    assert.ok(updates.length > before, "the position is asked for once the menu is visible and filled");
    assert.match(search.menu.style.width, /px$/, "and the menu is sized to the control it belongs to");
});

test("escape closes the menu", async () => {
    const search = makeSearch({
        answer: () => jsonResponse({ items: [{ id: "1", text: "Guybrush", uri: "/crew/1" }] })
    });

    await search.ctrl._fetch("guy");
    assert.equal(search.menu.style.display, "flex");

    search.key("Escape");

    assert.equal(search.menu.style.display, "none");
    assert.equal(search.ctrl._activeIndex, -1, "and the highlight is dropped");
});

test("a control without a service asks nobody and shows the empty state", async () => {
    const search = makeSearch({ service: false, emptyText: "No matches found." });

    await search.ctrl._fetch("guy");

    assert.equal(search.urls.length, 0, "no request is made");
    assert.equal(search.entries().length, 1);
    assert.ok(search.entries()[0].classList.contains("wx-search-empty"));
});

test("typing coalesces the keystrokes into a single request", async () => {
    const search = makeSearch({
        answer: () => jsonResponse({ items: [] })
    });

    // the base class calls _refreshSuggestions on focus and on every keystroke;
    // a request per keystroke is exactly what the debounce is there to prevent
    for (const term of ["g", "gu", "guy"]) {
        search.input.value = term;
        search.ctrl._refreshSuggestions();
    }

    assert.equal(search.urls.length, 0, "nothing is sent while the term is still changing");

    await new Promise((resolve) => setTimeout(resolve, 260));
    await settle();

    assert.equal(search.urls.length, 1, "only the term the typing settled on is asked for");
    assert.match(search.urls[0], /[?&]q=guy(&|$)/);
});
