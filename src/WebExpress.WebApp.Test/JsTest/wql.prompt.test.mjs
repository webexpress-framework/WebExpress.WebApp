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
import { loadEngine, webappAsset, appendServiceIsland } from "./harness.mjs";

/**
 * Loads the shipped prompt and state/service engine with deterministic timers.
 * @param {object} [options={}] - Response, service and host attribute overrides.
 * @returns {object} The control, DOM, engine, selection, requests and timers.
 */
function loadPrompt(options = {}) {
    const requests = [];
    const requestInits = [];
    const engine = loadEngine({
        extraFiles: [webappAsset("webexpress.webapp.wql.prompt.js")],
        fetch: async (url, init) => {
            requests.push(url);
            requestInits.push(init);
            const response = options.response ? await options.response(url, init) : { ok: false };
            return {
                ok: response.ok,
                status: response.status || (response.ok ? 200 : 503),
                headers: { get: () => "application/json" },
                json: async () => response.data ?? null
            };
        }
    });
    const { document, sandbox } = engine;
    const timers = new Map();
    let timerId = 0;
    sandbox.setTimeout = (callback) => {
        timers.set(++timerId, callback);
        return timerId;
    };
    sandbox.clearTimeout = (id) => timers.delete(id);
    sandbox.Headers = Headers;
    sandbox.Node = { ELEMENT_NODE: 1, TEXT_NODE: 3 };
    const selection = {
        rangeCount: 0,
        setBaseAndExtent(anchorNode, anchorOffset, focusNode, focusOffset) {
            Object.assign(this, { anchorNode, anchorOffset, focusNode, focusOffset, rangeCount: 1 });
        },
        removeAllRanges() { this.rangeCount = 0; },
        addRange(range) {
            this.setBaseAndExtent(range.startContainer, range.startOffset, range.endContainer, range.endOffset);
        },
        getRangeAt() {
            const range = document.createRange();
            range.setStart(this.anchorNode, this.anchorOffset);
            range.setEnd(this.focusNode, this.focusOffset);
            return range;
        }
    };
    document.createRange = () => ({
        setStart(node, offset) { this.startContainer = node; this.startOffset = offset; },
        setEnd(node, offset) { this.endContainer = node; this.endOffset = offset; },
        collapse(toStart) {
            if (toStart) { this.setEnd(this.startContainer, this.startOffset); }
            else { this.setStart(this.endContainer, this.endOffset); }
        },
        selectNodeContents(node) {
            this.setStart(node, 0);
            this.setEnd(node, node.childNodes.length);
        },
        cloneRange() { return Object.assign(document.createRange(), this); },
        toString() {
            let root = this.startContainer;
            while (root.parentNode) { root = root.parentNode; }
            const offsetOf = (target, offset) => {
                let length = 0;
                let found = false;
                const visit = (node) => {
                    if (found) { return; }
                    if (node === target) {
                        length += node.nodeType === 3 ? offset
                            : node.childNodes.slice(0, offset).reduce((sum, child) => sum + child.textContent.length, 0);
                        found = true;
                    } else if (node.nodeType === 3) {
                        length += node.data.length;
                    } else {
                        node.childNodes.forEach(visit);
                    }
                };
                visit(root);
                return length;
            };
            return root.textContent.slice(offsetOf(this.startContainer, this.startOffset), offsetOf(this.endContainer, this.endOffset));
        }
    });
    sandbox.window = { getSelection: () => selection, location: { origin: "http://localhost" } };
    document.baseURI = "http://localhost/";
    engine.wx.Event.CHANGE_FILTER_EVENT = "wx-change-filter";
    engine.wx.Ctrl.prototype._i18n = (key) => key;
    const host = document.createElement("div");
    for (const [name, value] of Object.entries(options.attributes || {})) {
        host.setAttribute(name, value);
    }
    if (options.service !== false) {
        appendServiceIsland(document, host, { name: "data", kind: "rest", baseUri: "/api/items", ...options.service });
    }
    const ctrl = new engine.wxapp.WqlPromptCtrl(host);
    ctrl._dispatched = [];
    host.addEventListener("wx-change-filter", (event) => ctrl._dispatched.push(event));
    return { ctrl, document, requests, requestInits, selection, timers, engine };
}

/**
 * Creates a response that tests can settle after a newer request has completed.
 * @returns {object} The pending promise and its resolver.
 */
function deferred() {
    let resolve;
    const promise = new Promise((complete) => { resolve = complete; });
    return { promise, resolve };
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

    assert.deepEqual(calls, [[7, 7, "Helena"]]);
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

    assert.deepEqual(Array.from(ctrl._history), ["a = 1", "b = 2"]);
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

    assert.deepEqual(Array.from(ctrl._history), ["Text = 'x'"], "the same query is stored once");
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
    assert.deepEqual(Array.from(ctrl._history), [], "an invalid query does not enter the history");
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

for (const [text, cursor, prefix, quoted, expected] of [
    ["Mü", 2, "Mü", false, '"München" '],
    ['City = "Mü"', 10, "Mü", true, 'City = "München"'],
    ["City = 'Münster' and Active = 1", 10, "Mü", true, "City = 'München' and Active = 1"],
    ['City = "Mü', 10, "Mü", true, 'City = "München'],
    ['City = "New Mü suffix"', 14, "New Mü", true, 'City = "München"']
]) {
    test(`completion replaces the context without changing quotes: ${text}`, async () => {
        const { ctrl } = loadPrompt({ response: () => ({
            ok: true, data: { prefix, quoted, currentExpressionType: "Parameter", suggestions: ["München"] }
        }) });
        ctrl.value = text;
        ctrl._restoreCursor(cursor);
        await ctrl._refreshContextAndSuggestions();

        ctrl._applySuggestion("München");

        assert.equal(ctrl.value, expected);
    });
}

/**
 * Resolves the prompt's declared binding through the actual ViewState registry.
 * @param {object} runtime - The prompt runtime.
 * @param {object} state - The initial shared state.
 * @returns {object} The registered ViewState.
 */
function attachState(runtime, state) {
    runtime.resourceQueries = [];
    return new runtime.engine.wxapp.ViewState(runtime.document.createElement("div"), {
        viewStateId: "queries", state,
        services: { data: { query: async (params) => {
            runtime.resourceQueries.push(params);
            return { ok: true, data: { items: [] } };
        } } },
        resources: { items: { name: "items", service: "data", target: "items", auto: false,
            params: [{ name: "wql", state: "query.wql", dir: "out" }] } }
    });
}

const binding = { "data-wx-resource": "items", "data-wx-viewstate": "queries", "data-wx-model": "query.wql" };

test("a nested model reads initial and external values and preserves sibling state on submit", async () => {
    const runtime = loadPrompt({ attributes: { ...binding, name: "expression" }, service: false });
    const { ctrl } = runtime;
    const initialQuery = { wql: "initial", scope: "mine" };
    const state = attachState(runtime, { query: initialQuery, page: 4, search: "basic" });
    assert.equal(ctrl.value, "initial");
    assert.equal(ctrl._field.value, "initial");

    ctrl.value = "draft";
    state.setState({ page: 5 });
    state.flush();
    assert.equal(ctrl.value, "draft", "an unrelated state change preserves the draft");
    state.setState({ query: { wql: "external", scope: "mine" } });
    state.flush();
    assert.equal(ctrl.value, "external");
    assert.equal(ctrl._field.value, "external");
    assert.equal(ctrl._dispatched.length, 0, "state reads do not dispatch filter changes");

    ctrl.value = "submitted";
    await ctrl._submitInput();
    state.flush();
    assert.equal(state.getState().query.wql, "submitted");
    assert.equal(state.getState().query.scope, "mine");
    assert.equal(initialQuery.wql, "initial", "nested writes are immutable");
    assert.equal(state.getState()["query.wql"], undefined);
    assert.equal(state.getState().page, 0);
    assert.equal(state.getState().search, null);
    assert.equal(runtime.resourceQueries.at(-1).wql, "submitted", "the resource reload reads the nested query");
    assert.equal(ctrl._validationStatus, "unchecked", "the write echo keeps the submit status");
});

for (const reset of ["clear", "empty submit"]) {
    test(`${reset} removes the applied filter and supersedes pending validation`, async () => {
        const old = deferred();
        const runtime = loadPrompt({ attributes: binding, response: () => old.promise });
        const { ctrl } = runtime;
        const state = attachState(runtime, { query: { wql: "active" } });
        ctrl.value = "pending";
        const submitted = ctrl._submitInput();
        if (reset === "clear") {
            ctrl._clearBtn.dispatchEvent({ type: "click" });
        } else {
            ctrl.value = " \n ";
            await ctrl._submitInput();
        }
        old.resolve({ ok: true, data: { isValidSoFar: true } });
        await submitted;
        assert.equal(state.getState().query.wql, "");
        assert.deepEqual(ctrl._dispatched.map((event) => event.detail.value), [""]);
        assert.deepEqual(Array.from(ctrl._history), []);
        assert.equal(runtime.requests.length, 1, "clearing does not call validation");
    });
}

for (const valid of [true, false]) {
    test(`an older ${valid ? "valid" : "invalid"} response cannot overtake a newer submission`, async () => {
        const old = deferred();
        const runtime = loadPrompt({
            attributes: binding,
            response: (url) => new URL(url).searchParams.get("wql") === "older"
                ? old.promise : { ok: true, data: { isValidSoFar: true } }
        });
        const { ctrl } = runtime;
        const state = attachState(runtime, { query: { wql: "active" } });
        ctrl.value = "older";
        const submitted = ctrl._submitInput();
        ctrl.value = "newer";
        await ctrl._submitInput();
        old.resolve({ ok: true, data: { isValidSoFar: valid, errorMessage: "obsolete" } });
        await submitted;
        assert.deepEqual(ctrl._dispatched.map((event) => event.detail.value), ["newer"]);
        assert.deepEqual(Array.from(ctrl._history), ["newer"]);
        assert.equal(ctrl._lastError, null);
        assert.equal(ctrl._validationStatus, "valid");
        assert.equal(state.getState().query.wql, "newer");
    });
}

test("editing a submitted draft invalidates its pending validation", async () => {
    const pending = deferred();
    const { ctrl, requestInits } = loadPrompt({ response: () => pending.promise });
    ctrl.value = "submitted";
    const submitted = ctrl._submitInput();
    ctrl._input.textContent = "new draft";
    ctrl._onInput();
    assert.equal(requestInits[0].signal.aborted, true);
    pending.resolve({ ok: true, data: { isValidSoFar: true } });
    await submitted;
    assert.equal(ctrl._dispatched.length, 0);
    assert.equal(ctrl.value, "new draft");
});

for (const change of ["input", "cursor", "unannounced text", "unannounced cursor"]) {
    test(`analysis discards stale results after ${change} before debounce runs`, async () => {
        const pending = deferred();
        const { ctrl, requestInits, selection } = loadPrompt({ response: () => pending.promise });
        ctrl.value = "old";
        ctrl._restoreCursor(3);
        const analysis = ctrl._refreshContextAndSuggestions();
        if (change.includes("cursor")) {
            selection.setBaseAndExtent(ctrl._input.firstChild, 0, ctrl._input.firstChild, 0);
            if (change === "cursor") { ctrl._onCursorMove(); }
        } else {
            ctrl._input.textContent = "new";
            if (change === "input") { ctrl._onInput(); }
        }
        if (!change.startsWith("unannounced")) {
            assert.equal(requestInits[0].signal.aborted, true);
        }
        pending.resolve({ ok: true, data: { prefix: "old", suggestions: ["obsolete"] } });
        await analysis;
        assert.deepEqual(Array.from(ctrl._suggestions), []);
        assert.equal(ctrl._currentContext, null);
    });
}

test("reversed analysis responses retain only the latest suggestions", async () => {
    const old = deferred();
    let count = 0;
    const { ctrl } = loadPrompt({ response: () => ++count === 1 ? old.promise
        : { ok: true, data: { suggestions: ["current"] } } });
    ctrl.value = "query";
    const first = ctrl._refreshContextAndSuggestions();
    await ctrl._refreshContextAndSuggestions();
    old.resolve({ ok: true, data: { suggestions: ["obsolete"] } });
    await first;
    assert.deepEqual(Array.from(ctrl._suggestions), ["current"]);
});

for (const shiftKey of [true, false]) {
    test(`Tab with shift=${shiftKey} leaves the field when no suggestions exist`, () => {
        const { ctrl } = loadPrompt();
        let prevented = false;
        ctrl._onKeyDown({ key: "Tab", shiftKey, preventDefault() { prevented = true; } });
        assert.equal(prevented, false);
    });
}

test("Shift+Tab can leave a field with suggestions while Tab accepts one", () => {
    const { ctrl } = loadPrompt({ service: false });
    ctrl.value = "Mü";
    ctrl._currentContext = { type: "parameter", tokenStart: 0, tokenEnd: 2 };
    ctrl._suggestions = ["München"];
    let prevented = false;
    ctrl._onKeyDown({ key: "Tab", shiftKey: true, preventDefault() { prevented = true; } });
    assert.equal(prevented, false);
    ctrl._onKeyDown({ key: "Tab", shiftKey: false, preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(ctrl.value, '"München" ');
});

test("line boundaries and empty lines use the same offsets for extraction and caret restoration", () => {
    const { ctrl, document, selection } = loadPrompt();
    const lines = ["one", "", "two", ""].map((text) => lineSpan(document, text));
    ctrl._input.append(...lines);
    assert.equal(ctrl.value, "one\n\ntwo\n");
    ctrl._restoreCursor(5);
    assert.equal(selection.focusNode, lines[2].firstChild);
    assert.equal(selection.focusOffset, 0, "the third line starts after two newlines");
    for (let offset = 0; offset <= ctrl.value.length; offset++) {
        ctrl._restoreCursor(offset);
        assert.equal(ctrl._getCursorOffset(), offset, `round trip at ${offset}`);
    }
});

test("nested syntax spans and BR placeholders preserve every visible offset", () => {
    const { ctrl, document } = loadPrompt();
    const line = lineSpan(document, "");
    const token = document.createElement("span");
    token.textContent = "a\u200B";
    line.append(token, document.createElement("br"), document.createTextNode("\u200Bb"));
    ctrl._input.appendChild(line);
    assert.equal(ctrl.value, "a\nb");
    for (let offset = 0; offset <= ctrl.value.length; offset++) {
        ctrl._restoreCursor(offset);
        assert.equal(ctrl._getCursorOffset(), offset);
    }
});

for (const backward of [false, true]) {
    test(`highlighting retains a ${backward ? "backward" : "forward"} multiline selection`, () => {
        const { ctrl, document, selection } = loadPrompt();
        const first = lineSpan(document, "first");
        const second = lineSpan(document, "second");
        ctrl._input.append(first, second);
        const anchor = backward ? second.firstChild : first.firstChild;
        const focus = backward ? first.firstChild : second.firstChild;
        selection.setBaseAndExtent(anchor, 1, focus, 1);
        ctrl._highlightSyntax();
        assert.equal(ctrl.value, "first\nsecond");
        assert.equal(selection.anchorOffset, backward ? 7 : 1);
        assert.equal(selection.focusOffset, backward ? 1 : 7);
    });
}

test("all WQL operations use declared service headers, errors and query parameters", async () => {
    const runtime = loadPrompt({
        service: { baseUri: "/api/items/?scope=one#ignored", headers: { "X-Scope": "private" }, errors: { "403": "mapped failure" } },
        response: () => ({ ok: false, status: 403, data: {} })
    });
    const { ctrl, requests, requestInits, engine } = runtime;
    const errors = [];
    engine.wxapp.ErrorChannel.report = (result) => errors.push(result.error.message);
    ctrl.value = "München";
    await ctrl._refreshContextAndSuggestions();
    await ctrl._submitInput();
    await ctrl._loadHistoryFromApi(10);
    assert.deepEqual(requests.map((url) => new URL(url).pathname), ["/api/items/analyze", "/api/items/analyze", "/api/items/history"]);
    for (let index = 0; index < requests.length; index++) {
        assert.equal(new URL(requests[index]).searchParams.get("scope"), "one");
        assert.equal(new URL(requests[index]).hash, "");
        assert.equal(new Headers(requestInits[index].headers).get("x-scope"), "private");
    }
    assert.deepEqual(errors, ["mapped failure", "mapped failure", "mapped failure"]);
    assert.equal(ctrl._validationStatus, "unchecked");
});

test("caller headers override descriptor headers without dropping other service headers", async () => {
    const { ctrl, requestInits } = loadPrompt({ service: { headers: { "X-Scope": "default", "X-Keep": "kept" } } });
    await ctrl._service.request("/probe", { headers: [["x-scope", "override"]] });
    assert.equal(new Headers(requestInits[0].headers).get("x-scope"), "override");
    assert.equal(new Headers(requestInits[0].headers).get("x-keep"), "kept");
});

test("a delayed history response retains local submissions and the browsed entry", async () => {
    const history = deferred();
    const { ctrl } = loadPrompt({ response: (url) => new URL(url).pathname.endsWith("/history")
        ? history.promise : { ok: true, data: { isValidSoFar: true } } });
    const loading = ctrl._loadHistoryFromApi();
    ctrl.value = "local";
    await ctrl._submitInput();
    ctrl.value = "draft";
    ctrl._navigateHistory(-1);
    history.resolve({ ok: true, data: { history: ["server", "server", "local", null] } });
    await loading;
    assert.deepEqual(Array.from(ctrl._history), ["server", "local"]);
    assert.equal(ctrl.value, "local");
    assert.equal(ctrl._historyIndex, 1);
    ctrl._navigateHistory(1);
    assert.equal(ctrl.value, "draft");
});

test("exhausted history retries preserve local history and the submission status", async () => {
    const { ctrl } = loadPrompt({ service: false });
    ctrl.value = "local";
    await ctrl._submitInput();
    const message = ctrl._hint.innerHTML;
    ctrl._service = { request: async () => ({ ok: false }) };
    ctrl._apiUri = "/api/items";
    await ctrl._loadHistoryFromApi(10);
    assert.deepEqual(Array.from(ctrl._history), ["local"]);
    assert.equal(ctrl._historyIndex, 1);
    assert.equal(ctrl._hint.innerHTML, message);
});

for (const [response, status, message] of [
    [{ ok: true, data: { isValidSoFar: true } }, "valid", "wql.status.sent"],
    [{ ok: true, data: { isValidSoFar: false, errorMessage: "broken" } }, "invalid", "broken"],
    [{ ok: false }, "unchecked", "wql.status.unchecked"],
    [{ ok: true, data: {} }, "unchecked", "wql.status.unchecked"]
]) {
    test(`validation displays ${status} for ${JSON.stringify(response)}`, async () => {
        const { ctrl } = loadPrompt({ response: () => response });
        ctrl.value = "query";
        await ctrl._submitInput();
        assert.equal(ctrl._input.dataset.validation, status);
        assert.ok(ctrl._hint.innerHTML.includes(message));
        assert.equal(ctrl._dispatched.length, status === "invalid" ? 0 : 1);
    });
}

test("destroy cancels requests, timers and listeners and ignores late responses", async () => {
    const pending = deferred();
    const runtime = loadPrompt({ attributes: binding, response: () => pending.promise });
    const { ctrl, requestInits, timers, document } = runtime;
    const state = attachState(runtime, { query: { wql: "active" } });
    ctrl._onInput();
    const submitted = ctrl._submitInput();
    const analysis = ctrl._refreshContextAndSuggestions();
    const history = ctrl._loadHistoryFromApi();
    ctrl._onCursorMove();
    const before = ctrl._hint.innerHTML;
    ctrl.destroy();
    ctrl.destroy();
    assert.equal(timers.size, 0);
    assert.ok(requestInits.every((init) => init.signal.aborted));
    assert.equal(state._listeners.size, 0);
    for (const target of [ctrl._input, ctrl._clearBtn, document]) {
        assert.ok(Object.values(target._listeners || {}).every((listeners) => listeners.size === 0));
    }
    pending.resolve({ ok: true, data: { isValidSoFar: true, history: ["late"], suggestions: ["late"] } });
    await Promise.all([submitted, analysis, history]);
    state.setState({ query: { wql: "external" } });
    state.flush();
    assert.equal(ctrl.value, "active");
    assert.equal(ctrl._hint.innerHTML, before);
    assert.equal(ctrl._dispatched.length, 0);
    assert.deepEqual(Array.from(ctrl._history), []);
});

test("destroy removes unresolved ViewState registrations and history retry timers", async () => {
    const runtime = loadPrompt({ attributes: binding });
    await runtime.ctrl._loadHistoryFromApi();
    assert.equal(runtime.engine.wxapp.ViewStateRegistry._pending.length, 1);
    assert.ok(runtime.timers.size > 0);
    runtime.ctrl.destroy();
    assert.equal(runtime.timers.size, 0);
    assert.equal(runtime.engine.wxapp.ViewStateRegistry._pending.length, 0);
    const state = attachState(runtime, { query: { wql: "late" } });
    assert.equal(state._listeners.size, 0);
    assert.equal(runtime.ctrl.value, "");
});

test("completion uses both supplied context boundaries without expanding them", () => {
    const { ctrl } = loadPrompt({ service: false });
    ctrl.value = "prefixMüsuffix";
    ctrl._restoreCursor(8);
    ctrl._currentContext = { type: "attribute", tokenStart: 6, tokenEnd: 8 };
    ctrl._applySuggestion("München");
    assert.equal(ctrl.value, "prefixMünchen suffix");
});

test("Ctrl+Enter replaces a multiline selection with exactly one newline", () => {
    const { ctrl, document, selection } = loadPrompt({ service: false });
    const first = lineSpan(document, "first");
    const second = lineSpan(document, "second");
    ctrl._input.append(first, second);
    selection.setBaseAndExtent(first.firstChild, 2, second.firstChild, 2);
    ctrl._insertLineBreakAtCursor();
    assert.equal(ctrl.value, "fi\ncond");
    assert.equal(ctrl._getCursorOffset(), 3);
});

test("repeated Enter for the same draft still applies only the latest validation", async () => {
    const old = deferred();
    let count = 0;
    const { ctrl } = loadPrompt({ response: () => ++count === 1 ? old.promise
        : { ok: true, data: { isValidSoFar: true } } });
    ctrl.value = "same";
    const first = ctrl._submitInput();
    await ctrl._submitInput();
    old.resolve({ ok: true, data: { isValidSoFar: false, errorMessage: "old" } });
    await first;
    assert.equal(ctrl._dispatched.length, 1);
    assert.equal(ctrl._validationStatus, "valid");
    assert.equal(ctrl._lastError, null);
});

test("removing the bound model externally clears the editor without submitting", () => {
    const runtime = loadPrompt({ attributes: binding });
    const state = attachState(runtime, { query: { wql: "active" } });
    state.setState({ query: {} });
    state.flush();
    assert.equal(runtime.ctrl.value, "");
    assert.equal(runtime.ctrl._dispatched.length, 0);
});

test("a superseded history load cannot replace the newest server entries", async () => {
    const old = deferred();
    let count = 0;
    const { ctrl } = loadPrompt({ response: () => ++count === 1 ? old.promise
        : { ok: true, data: { history: ["current"] } } });
    const first = ctrl._loadHistoryFromApi();
    await ctrl._loadHistoryFromApi();
    old.resolve({ ok: true, data: { history: ["obsolete"] } });
    await first;
    assert.deepEqual(Array.from(ctrl._history), ["current"]);
});
