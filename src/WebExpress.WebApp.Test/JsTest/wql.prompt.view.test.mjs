/**
 * Headless unit tests for the WQL prompt view (webexpress.webapp.wql.prompt.view.js).
 *
 * The view is exercised on its own, without a controller: it projects a model state onto a
 * surface and maps DOM boundaries back to model positions, but it never holds or changes text.
 *
 * Run with Node 18 or newer from the JsTest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, webappAsset } from "./harness.mjs";

/**
 * Loads the shipped view with a document selection stub.
 * @returns {object} The view, its surface and listbox, the selection and the document.
 */
function loadView() {
    const engine = loadEngine({ extraFiles: [webappAsset("webexpress.webapp.wql.prompt.view.js")] });
    const { document, sandbox } = engine;
    sandbox.Node = { ELEMENT_NODE: 1, TEXT_NODE: 3 };
    const selection = {
        rangeCount: 0,
        setBaseAndExtent(anchorNode, anchorOffset, focusNode, focusOffset) {
            Object.assign(this, { anchorNode, anchorOffset, focusNode, focusOffset, rangeCount: 1 });
        }
    };
    sandbox.window = { getSelection: () => selection };
    const surface = document.createElement("div");
    const listbox = document.createElement("ul");
    listbox.id = "list";
    const view = new engine.wxapp.WqlPromptView(surface, listbox);
    return { view, surface, listbox, selection, document };
}

/**
 * Builds a frozen state the way the model hands it out.
 * @param {string} text - The text.
 * @param {number} anchor - The anchor.
 * @param {number} [focus=anchor] - The focus.
 * @returns {object} The state.
 */
const state = (text, anchor, focus = anchor) =>
    Object.freeze({ version: 1, text, selection: Object.freeze({ anchor, focus }), revision: 0 });

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

test("rendering shows the state text and leaves a foreign selection alone", () => {
    const { view, selection } = loadView();
    view.render(state("Text = 1\nand b = 2", 3));
    assert.equal(view.map().text, "Text = 1\nand b = 2");
    assert.equal(selection.rangeCount, 0, "a surface without focus or selection does not take the selection");
});

for (const backward of [false, true]) {
    test(`rendering puts back a ${backward ? "backward" : "forward"} selection the surface owns`, () => {
        const { view, surface, selection } = loadView();
        view.render(state("first\nsecond", 0));
        selection.setBaseAndExtent(surface.firstChild, 0, surface.firstChild, 0);
        const anchor = backward ? 9 : 2;
        const focus = backward ? 2 : 9;
        view.render(state("first\nsecond", anchor, focus));
        assert.equal(selection.anchorNode, surface.firstChild, "the selection points into the new nodes");
        assert.deepEqual(JSON.parse(JSON.stringify(view.readSelection())), { anchor, focus });
    });
}

test("a selection is only written when the surface owns it or the caller insists", () => {
    const { view, selection } = loadView();
    view.render(state("abc", 0));
    view.showSelection({ anchor: 1, focus: 2 });
    assert.equal(selection.rangeCount, 0);
    view.showSelection({ anchor: 1, focus: 2 }, true);
    assert.deepEqual(JSON.parse(JSON.stringify(view.readSelection())), { anchor: 1, focus: 2 });
    view.showSelection({ anchor: 99, focus: 99 }, true);
    assert.equal(view.readSelection().focus, 3, "positions past the text land at its end");
});

test("a selection outside the surface reads as none", () => {
    const { view, selection, document } = loadView();
    view.render(state("abc", 0));
    selection.setBaseAndExtent(document.createTextNode("elsewhere"), 0, document.createTextNode("x"), 0);
    assert.equal(view.readSelection(), null);
});

test("line wrappers, breaks and caret placeholders map to model positions", () => {
    const { view, surface, document } = loadView();
    const empty = lineSpan(document, "​");
    surface.append(lineSpan(document, "one"), empty, lineSpan(document, "two"));
    const map = view.map();
    assert.equal(map.text, "one\n\ntwo");
    assert.equal(view.offsetOf(map, empty.firstChild, 0), 4);
    assert.equal(view.offsetOf(map, empty.firstChild, 1), 4, "the placeholder occupies no position");
    assert.equal(view.offsetOf(map, document.createTextNode("x"), 0), null);
});

test("a target range converts to model positions or to nothing", () => {
    const { view, surface, document } = loadView();
    view.render(state("Text = 1", 0));
    const node = surface.firstChild;
    assert.deepEqual(Array.from(view.targetRange({ getTargetRanges: () => [{ startContainer: node, startOffset: 7, endContainer: node, endOffset: 8 }] })), [7, 8]);
    assert.equal(view.targetRange({ getTargetRanges: () => [] }), null);
    assert.equal(view.targetRange({}), null, "a browser without target ranges falls back");
    const outside = document.createTextNode("x");
    assert.equal(view.targetRange({ getTargetRanges: () => [{ startContainer: outside, startOffset: 0, endContainer: node, endOffset: 1 }] }), null);
});

for (const api of ["caretPositionFromPoint", "caretRangeFromPoint"]) {
    test(`a drop point is found through ${api}`, () => {
        const { view, surface, document } = loadView();
        view.render(state("a = 1", 0));
        document[api] = (x) => api === "caretPositionFromPoint"
            ? { offsetNode: surface.firstChild, offset: x }
            : { startContainer: surface.firstChild, startOffset: x };
        assert.equal(view.offsetFromPoint(3, 0), 3);
        document[api] = () => null;
        assert.equal(view.offsetFromPoint(3, 0), null);
    });
}

test("the suggestion list mirrors the suggestions and their active one", () => {
    const { view, surface, listbox } = loadView();
    view.renderSuggestions(["=", "!=", "~"], 1);
    assert.equal(listbox.childNodes.length, 3);
    assert.deepEqual(listbox.childNodes.map((option) => option.getAttribute("aria-selected")), ["false", "true", "false"]);
    assert.equal(listbox.childNodes[2].textContent, "~");
    assert.equal(surface.getAttribute("aria-expanded"), "true");
    assert.equal(surface.getAttribute("aria-activedescendant"), "list-1");

    view.renderSuggestions(["a"], 5);
    assert.equal(surface.getAttribute("aria-activedescendant"), "list-0", "an index past the list falls back to the first option");

    view.renderSuggestions([], 0);
    assert.equal(listbox.childNodes.length, 0);
    assert.equal(surface.getAttribute("aria-expanded"), "false");
    assert.equal(surface.getAttribute("aria-activedescendant"), null);
});

test("a grown surface scrolls its last line into view", () => {
    const { view, surface } = loadView();
    // the DOM stub has no layout, so the dimensions are shadowed per element
    Object.assign(surface, { scrollHeight: 40, clientHeight: 40, scrollTop: 0 });
    view.scrollToEnd();
    assert.equal(surface.scrollTop, 0, "a surface that fits does not scroll");
    surface.scrollHeight = 120;
    view.scrollToEnd();
    assert.equal(surface.scrollTop, 120);
});

test("rendering a frozen state leaves it untouched", () => {
    const { view, surface } = loadView();
    const shown = state("a = 1", 2);
    view.render(shown);
    surface.firstChild.data = "changed by the browser";
    assert.equal(shown.text, "a = 1", "the surface is a projection, not the state");
});
