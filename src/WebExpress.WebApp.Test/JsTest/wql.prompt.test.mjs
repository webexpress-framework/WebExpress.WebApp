/**
 * Headless unit tests for the WQL prompt control
 * (webexpress.webapp.wql.prompt.js), focused on the behaviour that broke in
 * the wild: the newline handling of the highlighted contenteditable (a
 * trailing newline used to accumulate on every input cycle), the smart
 * formatting per analyze expression type (the type names must match the
 * lower-cased WqlExpressionType enum names of the analyze endpoint), the
 * invalid-state wiring from the analyze response, history navigation and
 * submission.
 *
 * Run with Node 18 or newer from the JsTest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDocument } from "./dom-stub.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const promptJs = path.resolve(here, "..", "..", "WebExpress.WebApp", "Assets", "js", "webexpress.webapp.wql.prompt.js");

// a minimal Ctrl base defined inside the context, mirroring the parts of
// webexpress.webui.Ctrl the prompt relies on
const BOOTSTRAP = `
    var webexpress = { webui: {}, webapp: {} };
    webexpress.webui.Ctrl = class {
        constructor(element) {
            this._element = element;
            this._dispatched = [];
        }
        _i18n(key) { return key; }
        _dispatch(type, detail) { this._dispatched.push({ type: type, detail: detail }); }
    };
    webexpress.webui.Controller = { registerClass: function () { } };
    webexpress.webui.Event = { CHANGE_FILTER_EVENT: "wx-change-filter" };
    // no highlighter registered: the prompt falls back to plain text
    webexpress.webui.Syntax = { get: function () { return null; } };
`;

/**
 * Loads the prompt control into a fresh vm context backed by the DOM stub.
 * Timers are capture-only so the tests drive every code path directly.
 * @param {object} [options] - Optional overrides: response(url) for the api.
 * @returns {object} The control instance, document, recorded requests.
 */
function loadPrompt(options = {}) {
    const document = createDocument();
    document.createRange = () => ({
        setStart() { },
        setEnd() { },
        collapse() { },
        selectNodeContents() { },
        cloneRange() { return this; },
        toString() { return ""; }
    });

    const selection = { rangeCount: 0, removeAllRanges() { }, addRange() { } };
    const requests = [];

    const sandbox = {
        console,
        URL,
        AbortController,
        // capture-only timers: history load and debounce never fire on their own
        setTimeout: () => 0,
        clearTimeout: () => { },
        document,
        window: { getSelection: () => selection, location: { origin: "http://localhost" } },
        Node: { ELEMENT_NODE: 1, TEXT_NODE: 3 }
    };
    vm.createContext(sandbox);
    vm.runInContext(BOOTSTRAP, sandbox, { filename: "bootstrap" });

    sandbox.webexpress.webapp.ServiceRegistry = {
        request: async (url, init) => {
            requests.push(url);
            return options.response ? options.response(url) : { ok: false };
        }
    };

    vm.runInContext(fs.readFileSync(promptJs, "utf8"), sandbox, { filename: promptJs });

    const host = document.createElement("div");
    host.dataset.uri = "/api/items";
    const ctrl = new sandbox.webexpress.webapp.WqlPromptCtrl(host);

    return { ctrl, document, requests };
}

/**
 * Creates a highlighted line span the way the wql highlighter renders lines.
 * @param {object} document - The document stub.
 * @param {string} text - The line text.
 * @returns {object} The line element.
 */
function lineSpan(document, text) {
    const span = document.createElement("span");
    span.className = "wx-code-line";
    span.textContent = text;
    return span;
}

// ---------------------------------------------------------------------------
// text extraction from the highlighted contenteditable
// ---------------------------------------------------------------------------

test("a single highlighted line yields its text without a trailing newline", () => {
    const { ctrl, document } = loadPrompt();
    ctrl._input.appendChild(lineSpan(document, "Text = 1"));

    assert.equal(ctrl._getInputText(), "Text = 1");
});

test("multiple highlighted lines are separated by exactly one newline", () => {
    const { ctrl, document } = loadPrompt();
    ctrl._input.appendChild(lineSpan(document, "Text = 1"));
    ctrl._input.appendChild(lineSpan(document, "order by Text"));

    assert.equal(ctrl._getInputText(), "Text = 1\norder by Text");
});

test("the text stays stable across repeated highlight cycles", () => {
    const { ctrl, document } = loadPrompt();
    ctrl._input.appendChild(lineSpan(document, "Text = 1"));

    // the old implementation grew a trailing newline on every cycle
    for (let i = 0; i < 3; i++) {
        ctrl._highlightSyntax();
        assert.equal(ctrl._getInputText(), "Text = 1", `cycle ${i + 1}`);
    }
});

test("line breaks and zero-width spaces in raw content are handled", () => {
    const { ctrl, document } = loadPrompt();
    ctrl._input.appendChild(document.createTextNode("a​"));
    ctrl._input.appendChild(document.createElement("br"));
    ctrl._input.appendChild(document.createTextNode("b"));

    assert.equal(ctrl._getInputText(), "a\nb");
});

// ---------------------------------------------------------------------------
// suggestion application (smart formatting per analyze expression type)
// ---------------------------------------------------------------------------

/**
 * Prepares the control for an _applySuggestion call with a fixed context.
 * @param {object} ctrl - The prompt control.
 * @param {string} type - The lower-cased expression type.
 * @param {boolean} quoted - Whether the cursor is inside a string literal.
 * @returns {Array} The captured replacement calls [start, end, text].
 */
function armApply(ctrl, type, quoted) {
    const calls = [];
    ctrl._getInputText = () => "Text = ";
    ctrl._getCursorOffset = () => 7;
    ctrl._insertReplacementAt = (start, end, text) => calls.push([start, end, text]);
    ctrl._currentContext = { type, prefix: "", tokenStart: 7, tokenEnd: 7, quoted: !!quoted };
    return calls;
}

test("a parameter suggestion is quoted automatically", () => {
    const { ctrl } = loadPrompt();
    const calls = armApply(ctrl, "parameter", false);

    ctrl._applySuggestion("Helena");

    assert.deepEqual(calls, [[7, 7, '"Helena" ']]);
});

test("a parameter suggestion inside an open literal is not quoted again", () => {
    const { ctrl } = loadPrompt();
    const calls = armApply(ctrl, "parameter", true);

    ctrl._applySuggestion("Helena");

    assert.deepEqual(calls, [[7, 7, "Helena "]]);
});

test("an open parenthesis suggestion starts a quoted set", () => {
    const { ctrl } = loadPrompt();
    const calls = armApply(ctrl, "openparenthesis", false);

    ctrl._applySuggestion("Helena");

    assert.deepEqual(calls, [[7, 7, '("Helena" ']]);
});

test("a separator suggestion inserts a comma with a space", () => {
    const { ctrl } = loadPrompt();
    const calls = armApply(ctrl, "separator", false);

    ctrl._applySuggestion(",");

    assert.deepEqual(calls, [[7, 7, ", "]]);
});

test("an operator suggestion is inserted as-is with a trailing space", () => {
    const { ctrl } = loadPrompt();
    const calls = armApply(ctrl, "operator", false);

    ctrl._applySuggestion("!=");

    assert.deepEqual(calls, [[7, 7, "!= "]]);
});

// ---------------------------------------------------------------------------
// analyze round trip (context, suggestions, error wiring)
// ---------------------------------------------------------------------------

test("the live analysis never raises the error state while typing", async () => {
    // the syntax check runs on submit only; during typing the prompt offers
    // the next tokens even when the statement is not (yet) valid
    const { ctrl } = loadPrompt({
        response: () => ({
            ok: true,
            data: { isValidSoFar: false, errorMessage: "broken query", suggestions: ["~", "="] }
        })
    });
    ctrl._input.textContent = "id ";

    await ctrl._refreshContextAndSuggestions();

    assert.equal(ctrl._lastError, null, "no error while typing");
    assert.equal(ctrl._input.classList.contains("is-invalid"), false);
    assert.deepEqual(ctrl._suggestions, ["~", "="], "suggestions are still offered");
});

test("an incomplete statement does not raise the error state", async () => {
    // the server omits the error message for input that only ends mid-statement
    // (e.g. an attribute without an operator yet, fresh from a tab suggestion)
    const { ctrl } = loadPrompt({
        response: () => ({
            ok: true,
            data: {
                isValidSoFar: false,
                errorMessage: null,
                currentExpressionType: "Operator",
                suggestions: ["~", "=", "!="]
            }
        })
    });
    ctrl._input.textContent = "id ";

    await ctrl._refreshContextAndSuggestions();

    assert.equal(ctrl._lastError, null, "no error is shown while typing");
    assert.equal(ctrl._input.classList.contains("is-invalid"), false);
    assert.equal(ctrl._currentContext.type, "operator", "the next expected token is offered");
    assert.deepEqual(ctrl._suggestions, ["~", "=", "!="]);
});

test("a valid analyze response builds the context and clears the error state", async () => {
    const { ctrl, requests } = loadPrompt({
        response: () => ({
            ok: true,
            data: {
                isValidSoFar: true,
                currentExpressionType: "Attribute",
                prefix: "Hel",
                attribute: "Text",
                quoted: false,
                suggestions: ["Hello", "Helena"]
            }
        })
    });
    ctrl._setInvalidState("stale error");
    ctrl._input.textContent = "Hel";

    await ctrl._refreshContextAndSuggestions();

    assert.equal(ctrl._lastError, null, "the error state is cleared");
    assert.equal(ctrl._input.classList.contains("is-invalid"), false);
    assert.equal(ctrl._currentContext.type, "attribute");
    assert.equal(ctrl._currentContext.tokenStart, 0, "the prefix anchors the token start");
    assert.equal(ctrl._currentContext.attribute, "Text");
    assert.deepEqual(ctrl._suggestions, ["Hello", "Helena"]);
    assert.ok(requests[0].indexOf("/api/items/analyze?wql=Hel") !== -1, "the analyze endpoint is called");
});

test("the history endpoint fills the history buffer", async () => {
    const { ctrl } = loadPrompt({
        response: () => ({ ok: true, data: { history: ["a = 1", "b = 2"] } })
    });

    await ctrl._loadHistoryFromApi();

    assert.deepEqual(ctrl._history, ["a = 1", "b = 2"]);
    assert.equal(ctrl._historyIndex, 2);
});

// ---------------------------------------------------------------------------
// submission and history navigation
// ---------------------------------------------------------------------------

test("submitting dispatches the filter event and deduplicates the history", async () => {
    const { ctrl } = loadPrompt({
        response: () => ({ ok: true, data: { isValidSoFar: true } })
    });
    ctrl._input.textContent = "  Text = 'x'  ";

    await ctrl._submitInput();
    await ctrl._submitInput();

    assert.deepEqual(ctrl._history, ["Text = 'x'"], "the same query is stored once");
    const events = ctrl._dispatched.filter((e) => e.type === "wx-change-filter");
    assert.equal(events.length, 2);
    assert.equal(events[0].detail.value, "Text = 'x'");
});

test("submitting an invalid statement shows the error and is not dispatched", async () => {
    const { ctrl } = loadPrompt({
        response: () => ({
            ok: true,
            data: { isValidSoFar: false, errorMessage: "broken query" }
        })
    });
    ctrl._input.textContent = "Text !! x";

    await ctrl._submitInput();

    assert.equal(ctrl._lastError, "broken query", "the submit reports the syntax error");
    assert.equal(ctrl._input.classList.contains("is-invalid"), true);
    assert.deepEqual(ctrl._history, [], "an invalid query does not enter the history");
    assert.equal(ctrl._dispatched.filter((e) => e.type === "wx-change-filter").length, 0,
        "no filter event is dispatched");
});

test("a validation outage does not block the submission", async () => {
    const { ctrl } = loadPrompt({
        response: () => { throw new Error("offline"); }
    });
    ctrl._input.textContent = "Text = 'x'";

    await ctrl._submitInput();

    assert.equal(ctrl._dispatched.filter((e) => e.type === "wx-change-filter").length, 1,
        "the query is submitted anyway");
});

test("history navigation restores entries and keeps the unsent draft", () => {
    const { ctrl } = loadPrompt();
    ctrl._history = ["a = 1", "b = 2"];
    ctrl._historyIndex = 2;
    ctrl._input.textContent = "draft";

    ctrl._navigateHistory(-1);
    assert.equal(ctrl._getInputText(), "b = 2");

    ctrl._navigateHistory(-1);
    assert.equal(ctrl._getInputText(), "a = 1");

    ctrl._navigateHistory(1);
    ctrl._navigateHistory(1);
    assert.equal(ctrl._getInputText(), "draft", "the unsent draft returns");
});

test("the clear button resets the prompt to a fresh input line", () => {
    const { ctrl } = loadPrompt();
    ctrl._history = ["a = 1"];
    ctrl._historyIndex = 0;
    ctrl._input.textContent = "a = 1";
    ctrl._setInvalidState("stale");

    assert.ok(ctrl._clearBtn, "the clear button exists");
    ctrl._clearBtn.dispatchEvent({ type: "click" });

    assert.equal(ctrl._getInputText(), "");
    assert.equal(ctrl._historyIndex, 1, "the index points behind the history");
    assert.equal(ctrl._lastError, null);
    assert.equal(ctrl._input.classList.contains("is-invalid"), false);
});
