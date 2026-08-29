/**
 * Guards the room the inline editable description gets, against the shipped
 * stylesheets.
 *
 * The smart edit control pins its pencil to the right edge of its own box
 * (`position: absolute; right: 1em`). In the file list the description sits in a
 * cell that shrinks to the text it holds, so unless the file view widens that
 * cell the box is only as wide as the sentence - and the pencil lands inside the
 * text rather than at the end of the column. An empty description then has no
 * box at all, which is why an unset description could not be reached.
 *
 * None of that is observable from a DOM test - the stub reports every dimension
 * as zero - so the stylesheets are asserted directly.
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
const webapp = path.resolve(here, "..", "..", "WebExpress.WebApp", "Assets", "css");
const webui = path.resolve(here, "..", "..", "..", "..", "WebExpress.WebUI", "src", "WebExpress.WebUI", "Assets", "css");

/**
 * Reads a stylesheet and returns the declarations of every rule written for the
 * given selector.
 * @param {string} file - Absolute path of the stylesheet.
 * @param {string} selector - Selector to look up, matched verbatim.
 * @returns {string|null} The declarations, or null when the selector carries no rule.
 */
function rule(file, selector) {
    const css = fs.readFileSync(file, "utf8");
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matches = [...css.matchAll(new RegExp("(?:^|[};/])\\s*" + escaped + "\\s*\\{([^}]*)\\}", "g"))];

    return matches.length > 0 ? matches.map(x => x[1]).join(";") : null;
}

const fileView = path.join(webapp, "webexpress.webapp.file.view.css");
const smartEdit = path.join(webui, "webexpress.webui.smartedit.css");

test("the pencil is pinned to the right edge of the box it edits", () => {
    const pencil = rule(smartEdit, ".wx-smart-edit .pencil");

    assert.ok(pencil, "the smart edit control positions its pencil");
    assert.match(pencil, /position:\s*absolute/);
    assert.match(pencil, /right:/, "which is what makes the width of the box decide where it lands");
});

test("the description column of the list takes the room the name and the size leave", () => {
    const cell = rule(fileView, ".wx-file-view .wx-file-list > .wx-upload-preview > table > tbody > tr > td:nth-child(2)");
    const box = rule(fileView, ".wx-file-view .wx-file-list > .wx-upload-preview > table > tbody > tr > td:nth-child(2) > div");

    assert.ok(cell, "the file view widens the description cell");
    assert.match(cell, /width:\s*100%/);

    assert.ok(box, "and the box inside it follows");
    assert.match(box, /width:\s*100%/);
    // the file list declares the cell box as an inline-flex that shrinks to its
    // content; a plain flex is what lets it fill the widened cell
    assert.match(box, /display:\s*flex/);
});

test("the editable description fills its column instead of its text", () => {
    const description = rule(fileView, ".wx-file-view-description");

    assert.ok(description, "the description carries a rule of its own");
    assert.match(description, /flex:\s*1 1 auto/, "it grows into the column");
    assert.match(description, /min-width:\s*0/, "and may shrink below a long description");
});

test("on a card the description takes the width of the card", () => {
    const card = rule(fileView, ".wx-file-view-card-description > .wx-file-view-description");

    assert.ok(card, "the stacked layout of a card needs its own width");
    assert.match(card, /width:\s*100%/);
});

test("the stand-in for an unset value is visibly a stand-in", () => {
    const placeholder = rule(smartEdit, ".wx-smart-edit-placeholder");

    assert.ok(placeholder, "the empty read view has a rule of its own");
    assert.match(placeholder, /color:/, "it is muted, so it does not read as a value");
});
