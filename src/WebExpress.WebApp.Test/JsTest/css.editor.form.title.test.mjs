/**
 * Guards the resting appearance of the document title against the shipped stylesheet.
 *
 * The title is an input standing in for the dialog's own heading: at rest it has to be
 * indistinguishable from it, and only the pointer (hover) or the caret (focus) may reveal that
 * it is a field. The framework's form-control brings a border, a fill, a ring and a font of its
 * own, so each of those has to be taken back explicitly - and none of that is observable from a
 * DOM test, because the stub computes no styles. The stylesheet is therefore asserted directly.
 *
 * Run with Node 18 or newer from the JsTest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const stylesheet = path.resolve(here, "..", "..", "WebExpress.WebApp", "Assets", "css", "webexpress.webapp.editor.form.css");

/**
 * Reads the declarations of every rule written for the given selector.
 * @param {string} selector - Selector to look up, matched verbatim.
 * @returns {string|null} The declarations, or null when the selector carries no rule.
 */
function rule(selector) {
    const css = fs.readFileSync(stylesheet, "utf8");
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matches = [...css.matchAll(new RegExp("(?:^|[};/])\\s*" + escaped + "\\s*\\{([^}]*)\\}", "g"))];

    return matches.length > 0 ? matches.map(x => x[1]).join(";") : null;
}

const TITLE = ".wx-editor-form-header .wx-editor-form-title-input.form-control";

/**
 * The weight of a selector, as the (ids, classes, elements) triple the cascade compares.
 * @param {string} selector - The selector to weigh.
 * @returns {number[]} The triple.
 */
function specificity(selector) {
    return [
        (selector.match(/#/g) || []).length,
        (selector.match(/\.|\[|:(?!:)/g) || []).length,
        (selector.match(/(?:^|[\s>+~])[a-z]/g) || []).length
    ];
}

test("at rest the title carries none of the marks of a form field", () => {
    const body = rule(TITLE);

    assert.ok(body, "the title input carries a rule");
    assert.match(body, /border:\s*1px solid transparent/, "no visible border");
    assert.match(body, /background:\s*transparent/, "no fill of its own");
    assert.match(body, /box-shadow:\s*none/, "and no ring, which the framework's form-control would draw on focus");
    assert.match(body, /outline:\s*none/, "nor the browser's own");
});

test("at rest the title has the type and the position of the heading it replaces", () => {
    const body = rule(TITLE);

    assert.match(body, /font:\s*inherit/, "the type is the heading's, not the form's");
    assert.match(body, /color:\s*inherit/, "and so is the colour");

    // the box needs padding for the moment it does show, and the negative margin cancels it, so
    // the text does not shift sideways between the two states
    assert.match(body, /padding:\s*[\d.]+rem\s+0\.5rem/, "the box is padded for its visible state");
    assert.match(body, /margin-left:\s*-0\.5rem/, "and pulled back by exactly that padding");
    assert.match(body, /width:\s*calc\(100% \+ 0\.5rem\)/, "so it still reaches the right edge");
});

test("taking the field look back out-ranks the theme that paints it on", () => {
    // the dark theme fills every form-control with black from [data-bs-theme="dark"] .form-control,
    // which weighs the same as a two-class selector and lives in a stylesheet that loads later.
    // A resting rule of equal weight loses that tie, and the title is a black box again.
    const theme = [0, 2, 0];
    const mine = specificity(TITLE);

    assert.ok(
        mine[0] > theme[0] || (mine[0] === theme[0] && mine[1] > theme[1]),
        `the resting rule (${mine}) outweighs the theme's (${theme})`
    );
});

test("the title bar is only as tall as what it carries", () => {
    const body = rule(".wx-editor-form .modal-header");

    assert.ok(body, "the dialog header carries a rule");
    assert.match(body, /padding-top:\s*0/, "no height beyond the name and the buttons");
    assert.match(body, /padding-bottom:\s*0/);
    assert.doesNotMatch(body, /padding-left|padding-right|padding:\s/, "the name still lines up with the text below it");
});

test("the writing surface goes edge to edge", () => {
    const body = rule(".wx-editor-form .modal-body");

    assert.ok(body, "the dialog body carries a rule");
    assert.match(body, /padding:\s*0/, "nothing between the frame and the text");

    // the footer derives its own padding by subtracting half a gap from the dialog's padding
    // variable, so zeroing that variable instead would give the footer a negative padding
    assert.doesNotMatch(rule(".wx-editor-form") || "", /--bs-modal-padding/);
});

test("the field announces itself to the pointer and to the caret, and only then", () => {
    const hover = rule(TITLE + ":hover");
    const focus = rule(TITLE + ":focus");

    assert.ok(hover, "hover carries a rule");
    assert.match(hover, /border-color:/, "the pointer is offered a border");

    assert.ok(focus, "focus carries a rule");
    assert.match(focus, /border-color:/, "the caret gets one too");
    assert.match(focus, /background:/, "with a fill behind the text being edited");

    // a keyboard user never hovers, so the focus state has to be visible on its own
    assert.match(focus, /box-shadow:\s*0 0 0/, "and a ring, because the rest rule turned the framework's off");
});
