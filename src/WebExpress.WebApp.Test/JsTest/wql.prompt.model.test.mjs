/**
 * Headless unit tests for the WQL prompt text model (webexpress.webapp.wql.prompt.model.js).
 *
 * The model is loaded into a bare vm context without document, window or engine, which pins
 * its DOM independence: every operation below runs on plain strings and offsets.
 *
 * Run with Node 18 or newer from the JsTest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import vm from "node:vm";
import { webappAsset } from "./harness.mjs";

/**
 * Loads the shipped model file into an empty context.
 * @returns {object} The webapp namespace holding WqlPromptModel and WqlPromptUndo.
 */
function loadModel() {
    const sandbox = {};
    vm.createContext(sandbox);
    const file = webappAsset("webexpress.webapp.wql.prompt.model.js");
    vm.runInContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
    return sandbox.webexpress.webapp;
}

const { WqlPromptModel: Model, WqlPromptUndo: Undo } = loadModel();

/**
 * Copies a vm-realm value into this realm, so strict deep equality compares content only.
 * @param {*} value - The value to copy.
 * @returns {*} The plain copy.
 */
const plain = (value) => JSON.parse(JSON.stringify(value));

const EMOJI = "\u{1F600}";
const FAMILY = "\u{1F468}‍\u{1F469}‍\u{1F467}";

// ---------------------------------------------------------------------------
// state shape and snapshots
// ---------------------------------------------------------------------------

test("a new model holds the text with a caret at its end and revision zero", () => {
    const model = new Model("Text = 1");
    assert.deepEqual(plain(model.state), {
        version: Model.VERSION, text: "Text = 1", selection: { anchor: 8, focus: 8 }, revision: 0
    });
    assert.equal(model.cursor, 8);
});

test("snapshots are frozen and keep their content after later edits", () => {
    const model = new Model("a");
    const snapshot = model.state;
    assert.ok(Object.isFrozen(snapshot));
    assert.ok(Object.isFrozen(snapshot.selection));
    assert.throws(() => { "use strict"; snapshot.selection.anchor = 5; }, TypeError);
    model.insertText("b");
    assert.equal(snapshot.text, "a", "a stored state does not follow the model");
    assert.equal(snapshot.revision, 0);
    assert.equal(model.state.text, "ab");
});

test("a snapshot is reused until the state changes", () => {
    const model = new Model("abc");
    assert.equal(model.state, model.state);
    const before = model.state;
    model.select(1);
    assert.notEqual(model.state, before);
    assert.equal(model.selection, model.state.selection);
});

test("editing never serializes the state", () => {
    const model = new Model("a");
    model.toJSON = () => { throw new Error("serialized during editing"); };
    model.insertText("b");
    model.select(0, 2);
    model.delete(-1);
    model.setText("c");
    void model.state;
    assert.equal(model.text, "c");
});

// ---------------------------------------------------------------------------
// replace, the base of every content change
// ---------------------------------------------------------------------------

test("replacing a range updates text, selection and revision together", () => {
    const model = new Model("Text = 1");
    const change = model.replace(7, 8, "42");
    assert.equal(model.text, "Text = 42");
    assert.deepEqual(plain(model.selection), { anchor: 9, focus: 9 });
    assert.equal(model.revision, 1);
    assert.deepEqual(plain({ from: change.from, to: change.to, text: change.text, removed: change.removed }),
        { from: 7, to: 8, text: "42", removed: "1" });
    assert.equal(change.before.text, "Text = 1");
    assert.equal(change.after, model.state);
    assert.ok(Object.isFrozen(change));
});

test("a replacement takes an explicit resulting selection", () => {
    const model = new Model("ab");
    model.replace(1, 1, "XYZ", { anchor: 4, focus: 1 });
    assert.equal(model.text, "aXYZb");
    assert.deepEqual(plain(model.selection), { anchor: 4, focus: 1 }, "a backward selection survives");
});

test("a replacement that leaves the text unchanged creates no revision but still moves the selection", () => {
    const model = new Model("Text");
    model.select(0);
    assert.equal(model.replace(0, 4, "Text"), null);
    assert.equal(model.revision, 0);
    assert.equal(model.cursor, 4);
});

test("reversed and out of range bounds are ordered and clamped", () => {
    const model = new Model("abc");
    model.replace(10, 1, "-");
    assert.equal(model.text, "a-");
    model.replace(-5, 1, "");
    assert.equal(model.text, "-");
});

test("setting the whole text puts the caret at its end unless a selection is given", () => {
    const model = new Model("old");
    model.select(1);
    model.setText("new text");
    assert.deepEqual(plain(model.selection), { anchor: 8, focus: 8 });
    model.setText("other", { anchor: 0, focus: 2 });
    assert.deepEqual(plain(model.selection), { anchor: 0, focus: 2 });
    assert.equal(model.revision, 2);
    assert.equal(model.setText("other"), null, "the same text is no change");
    assert.equal(model.revision, 2);
});

// ---------------------------------------------------------------------------
// selection
// ---------------------------------------------------------------------------

test("selection changes never create a revision", () => {
    const model = new Model("abcdef");
    assert.equal(model.select(1, 4), true);
    assert.equal(model.select(1, 4), false, "an unchanged selection reports no change");
    assert.equal(model.revision, 0);
});

test("a backward selection keeps its direction and orders its bounds", () => {
    const model = new Model("abcdef");
    model.select(5, 2);
    assert.deepEqual(plain(model.selection), { anchor: 5, focus: 2 });
    assert.deepEqual(plain(model.bounds()), [2, 5]);
    assert.equal(model.cursor, 2, "the focus is the cursor sent to the server");
});

test("selection positions are clamped to the text", () => {
    const model = new Model("abc");
    model.select(-3, 99);
    assert.deepEqual(plain(model.selection), { anchor: 0, focus: 3 });
    model.select(Number.NaN, 1.7);
    assert.deepEqual(plain(model.selection), { anchor: 0, focus: 1 });
});

test("a position inside a surrogate pair moves to the start of the pair", () => {
    const model = new Model(`a${EMOJI}b`);
    model.select(2, 2);
    assert.equal(model.cursor, 1);
    assert.equal(Model.boundary(model.text, 2, 1), 3, "a forward bias moves to its end");
});

test("text typed into a selection replaces it", () => {
    const model = new Model("Text = 'x'");
    model.select(10, 7);
    model.insertText("'y'");
    assert.equal(model.text, "Text = 'y'");
    assert.equal(model.cursor, 10);
});

// ---------------------------------------------------------------------------
// line breaks
// ---------------------------------------------------------------------------

test("line breaks are normalized when the text is set", () => {
    const model = new Model("a\r\nb\rc");
    assert.equal(model.text, "a\nb\nc");
    model.setText("x\r\ny");
    assert.equal(model.text, "x\ny");
});

test("line breaks are normalized when text is inserted", () => {
    const model = new Model("ab");
    model.select(1);
    const change = model.insertText("\r\n\r");
    assert.equal(model.text, "a\n\nb");
    assert.equal(change.text, "\n\n");
    assert.equal(model.cursor, 3, "the caret counts the normalized text");
});

test("a line break replaces a multiline selection with exactly one newline", () => {
    const model = new Model("first\nsecond");
    model.select(2, 8);
    model.insertLineBreak();
    assert.equal(model.text, "fi\ncond");
    assert.equal(model.cursor, 3);
});

test("offsets on later lines count one unit per line break", () => {
    const model = new Model("one\n\ntwo\n");
    model.select(5);
    model.insertText("x");
    assert.equal(model.text, "one\n\nxtwo\n");
});

// ---------------------------------------------------------------------------
// incomplete WQL is ordinary text
// ---------------------------------------------------------------------------

for (const text of ['Text = "open', "Text = ", "(a = 1 and", "Text in (\"a\", ", "order by", "a ~ 'b'~", "))((", "!!"]) {
    test(`incomplete WQL survives editing and export unchanged: ${text}`, () => {
        const model = new Model(text);
        model.insertText("");
        model.select(0);
        assert.equal(model.text, text);
        const restored = new Model(Model.parse(model.export()));
        assert.equal(restored.text, text);
    });
}

// ---------------------------------------------------------------------------
// deletion
// ---------------------------------------------------------------------------

test("deleting a selection removes exactly the selection", () => {
    const model = new Model("Text = 1");
    model.select(7, 4);
    model.delete(1);
    assert.equal(model.text, "Text1");
    assert.equal(model.cursor, 4);
});

test("deletion at the edges of the text changes nothing", () => {
    const model = new Model("ab");
    model.select(0);
    assert.equal(model.delete(-1), null);
    model.select(2);
    assert.equal(model.delete(1), null);
    assert.equal(model.revision, 0);
});

for (const unit of ["character", "grapheme"]) {
    test(`a ${unit} deletion never splits a surrogate pair`, () => {
        const model = new Model(`a${EMOJI}${EMOJI}b`);
        model.select(3);
        model.delete(-1, unit);
        assert.equal(model.text, `a${EMOJI}b`);
        assert.equal(model.cursor, 1);
        model.delete(1, unit);
        assert.equal(model.text, "ab");
    });
}

test("a grapheme deletion removes a combining mark together with its base", () => {
    const model = new Model("München");
    model.select(3);
    model.delete(-1);
    assert.equal(model.text, "Mnchen");
});

test("a grapheme deletion removes a joined emoji sequence at once", () => {
    const model = new Model(`x${FAMILY}`);
    model.delete(-1);
    assert.equal(model.text, "x");
});

test("a character deletion removes one code point", () => {
    const model = new Model(`x${FAMILY}`);
    model.delete(-1, "character");
    assert.equal(model.text, `x${FAMILY.slice(0, -2)}`);
});

test("a deletion at a line edge removes the line break", () => {
    const model = new Model("a\nb");
    model.select(2);
    model.delete(-1);
    assert.equal(model.text, "ab");
    model.setText("a\nb", { anchor: 1, focus: 1 });
    model.delete(1, "word");
    assert.equal(model.text, "ab");
});

test("word and line deletions stay on the caret line", () => {
    const model = new Model("a = 1\nText = Hello");
    model.delete(-1, "word");
    assert.equal(model.text, "a = 1\nText = ");
    model.delete(-1, "word");
    assert.equal(model.text, "a = 1\nText ", "the blank before the caret goes with the word before it");
    model.delete(-1, "line");
    assert.equal(model.text, "a = 1\n");
    model.select(0);
    model.delete(1, "line");
    assert.equal(model.text, "\n");
});

// ---------------------------------------------------------------------------
// import and export
// ---------------------------------------------------------------------------

test("export and import round trip text, selection and revision", () => {
    const model = new Model("Text = \"Mü");
    model.insertText("nchen\"");
    model.select(2, 0);
    const json = model.export();
    assert.equal(typeof json, "string");
    assert.deepEqual(JSON.parse(json), { version: 1, text: "Text = \"München\"", selection: { anchor: 2, focus: 0 }, revision: 1 });
    const restored = new Model(Model.parse(json));
    assert.deepEqual(plain(restored.state), plain(model.state));
});

test("an import normalizes line breaks and maps the offsets onto the normalized text", () => {
    const state = Model.parse({ version: 1, text: "a\r\nb\r\nc", selection: { anchor: 3, focus: 6 }, revision: 4 });
    assert.equal(state.text, "a\nb\nc");
    assert.deepEqual(plain(state.selection), { anchor: 2, focus: 4 });
});

test("an import clamps foreign positions and keeps them out of surrogate pairs", () => {
    const state = Model.parse({ version: 1, text: `${EMOJI}x`, selection: { anchor: 1, focus: 50 }, revision: -1 });
    assert.deepEqual(plain(state.selection), { anchor: 0, focus: 3 });
    assert.equal(state.revision, 0);
});

test("an invalid import throws and leaves the model untouched", () => {
    const model = new Model("keep");
    for (const input of [null, {}, { version: 2, text: "x" }, { version: 1, text: 5 }, "{\"version\":1}"]) {
        assert.throws(() => model.import(input), { name: "TypeError" }, "errors come from the model realm");
    }
    assert.throws(() => model.import("not json"), { name: "SyntaxError" });
    assert.equal(model.text, "keep");
    assert.equal(model.revision, 0);
});

test("an import into a live model advances its own revision instead of adopting the stored one", () => {
    const model = new Model("current");
    model.insertText("!");
    model.import({ version: 1, text: "stored", selection: { anchor: 1, focus: 1 }, revision: 0 });
    assert.equal(model.text, "stored");
    assert.equal(model.revision, 2, "a pending request for revision 0 cannot match again");
    assert.equal(model.cursor, 1);
});

// ---------------------------------------------------------------------------
// reconciling text the browser changed on its own
// ---------------------------------------------------------------------------

test("the difference of two texts is one range replacement", () => {
    assert.equal(Model.diff("same", "same"), null);
    assert.deepEqual(plain(Model.diff("Text = 1", "Text = 42")), { from: 7, to: 8, text: "42" });
    assert.deepEqual(plain(Model.diff("abc", "ac")), { from: 1, to: 2, text: "" });
    assert.deepEqual(plain(Model.diff("", "x")), { from: 0, to: 0, text: "x" });
});

test("the caret places an insertion among repeated characters", () => {
    assert.deepEqual(plain(Model.diff("aa", "aaa", 1)), { from: 0, to: 0, text: "a" });
    assert.deepEqual(plain(Model.diff("aa", "aaa", 3)), { from: 2, to: 2, text: "a" });
    assert.deepEqual(plain(Model.diff("aaa", "aa", 0)), { from: 0, to: 1, text: "" });
});

test("a difference never splits a surrogate pair", () => {
    // both emoji share their high surrogate
    const change = Model.diff("\u{1F600}", "\u{1F603}");
    assert.deepEqual(plain(change), { from: 0, to: 2, text: "\u{1F603}" });
});

test("applying a difference through replace reproduces the browser text", () => {
    const model = new Model("Text = 'a'\nand b = 1");
    const after = "Text = 'ab'\nand b = 1";
    const change = Model.diff(model.text, after, 10);
    model.replace(change.from, change.to, change.text);
    assert.equal(model.text, after);
    assert.equal(model.cursor, 10);
    assert.equal(model.revision, 1);
});

// ---------------------------------------------------------------------------
// undo and redo of editing transactions
// ---------------------------------------------------------------------------

/**
 * Pairs a model with undo stacks driven by a hand-moved clock.
 * @param {string} [text=""] - The initial text.
 * @returns {object} The model, the stacks, an edit helper and the clock.
 */
function editor(text = "") {
    const clock = { now: 0 };
    const model = new Model(text);
    const undo = new Undo(() => clock.now);
    const edit = (kind, operation, extra) => {
        const before = model.state;
        operation(model);
        if (model.state.revision !== before.revision) {
            undo.record(before, model.state, kind, extra);
        }
    };
    const typing = (value) => Array.from(value).forEach((ch) => edit("type", (m) => m.insertText(ch)));
    const restore = (step) => step && model.setText(step.state.text, step.state.selection);
    return { model, undo, edit, typing, restore, clock };
}

test("typing at a continuous position is one transaction that restores text and selection", () => {
    const { model, undo, typing, restore } = editor("a = ");
    typing("Hel");
    assert.equal(model.text, "a = Hel");
    restore(undo.undo());
    assert.deepEqual(plain(model.state.selection), { anchor: 4, focus: 4 });
    assert.equal(model.text, "a = ");
    assert.equal(undo.canUndo, false);
    restore(undo.redo());
    assert.equal(model.text, "a = Hel");
    assert.equal(model.cursor, 7);
});

test("a blank or line break ends the word it completes", () => {
    const { model, undo, typing, edit, restore } = editor();
    typing("Text = 1");
    edit("type", (m) => m.insertLineBreak());
    typing("and");
    const steps = [];
    while (undo.canUndo) {
        restore(undo.undo());
        steps.push(model.text);
    }
    assert.deepEqual(steps, ["Text = 1\n", "Text = ", "Text ", ""]);
});

test("a change of the kind of edit ends the group", () => {
    const { model, undo, typing, edit, restore } = editor();
    typing("abc");
    edit("delete", (m) => m.delete(-1));
    edit("delete", (m) => m.delete(-1));
    assert.equal(model.text, "a");
    restore(undo.undo());
    assert.equal(model.text, "abc", "both backspaces went together");
    restore(undo.undo());
    assert.equal(model.text, "");
});

test("a moved selection or a sealed group starts a new transaction", () => {
    const { model, undo, typing, restore } = editor("xy");
    model.select(0);
    typing("a");
    model.select(3);
    typing("b");
    restore(undo.undo());
    assert.equal(model.text, "axy", "typing elsewhere is a step of its own");
    typing("b");
    undo.seal();
    typing("c");
    restore(undo.undo());
    assert.equal(model.text, "axyb");
});

test("a pause in typing ends the group", () => {
    const { model, undo, typing, restore, clock } = editor();
    typing("ab");
    clock.now += Undo.GROUP_DELAY + 1;
    typing("cd");
    restore(undo.undo());
    assert.equal(model.text, "ab");
});

test("completion and paste are transactions of their own", () => {
    const { model, undo, typing, edit, restore } = editor();
    typing("Na");
    edit("completion", (m) => m.replace(0, 2, "Name "));
    edit("paste", (m) => m.insertText("= 1"));
    edit("paste", (m) => m.insertText(" or"));
    const steps = [];
    while (undo.canUndo) {
        restore(undo.undo());
        steps.push(model.text);
    }
    assert.deepEqual(steps, ["Name = 1", "Name ", "Na", ""]);
});

test("a new edit discards what was undone", () => {
    const { model, undo, typing, restore } = editor();
    typing("ab ");
    typing("cd");
    restore(undo.undo());
    typing("x");
    assert.equal(undo.canRedo, false);
    assert.equal(model.text, "ab x");
});

test("caller state travels with its transaction in both directions", () => {
    const { undo, edit } = editor("draft");
    edit("history", (m) => m.setText("a = 1"), { before: 2, after: 1 });
    edit("history", (m) => m.setText("b = 2"), { before: 1, after: 0 });
    assert.equal(undo.undo().extra, 1);
    assert.equal(undo.undo().extra, 2);
    assert.equal(undo.redo().extra, 1);
    edit("type", (m) => m.insertText("!"));
    undo.redo();
    assert.equal(undo.undo().extra, undefined, "a transaction without caller state restores none");
});

test("the stacks keep a bounded number of transactions and can be cleared", () => {
    const { undo, edit } = editor();
    for (let i = 0; i < Undo.LIMIT + 5; i++) {
        edit("paste", (m) => m.insertText("x"));
    }
    let count = 0;
    while (undo.undo()) {
        count++;
    }
    assert.equal(count, Undo.LIMIT);
    assert.equal(undo.canRedo, true);
    undo.clear();
    assert.equal(undo.canUndo || undo.canRedo, false);
});
