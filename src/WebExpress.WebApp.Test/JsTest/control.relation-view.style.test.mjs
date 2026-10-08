/**
 * Stylesheet tests for the link surface.
 *
 * They read the shipped declarations directly, because how a row sits against
 * the head of its group is a claim about the cascade that no dom stub has an
 * answer for - the stub reports every dimension as zero.
 */

import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CSS_PATH = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..", "..", "WebExpress.WebApp", "Assets", "css", "webexpress.webapp.relation.css"
);

/**
 * Returns the declarations of the rule carrying exactly the given selector list.
 * @param {string} selector - The selector list as authored, whitespace-normalized.
 * @returns {string|null} The declaration block, or null when no rule matches.
 */
function cssRule(selector) {
    const css = fs.readFileSync(CSS_PATH, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

    for (const rule of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
        if (rule[1].trim().replace(/\s*\n\s*/g, " ") === selector) {
            return rule[2];
        }
    }

    return null;
}

test("a row steps in against the head of the group it belongs to", () => {
    assert.match(
        cssRule(".wx-relation-view-row"),
        /padding:\s*8px 14px 8px calc\(14px \+ var\(--wx-relation-row-indent\)\)/
    );
    assert.match(
        cssRule(".wx-relation-view-flat .wx-relation-view-row"),
        /padding-left:\s*var\(--wx-relation-row-indent\)/,
        "the flat layout drops the gutter but keeps the step"
    );
    assert.equal(
        cssRule(".wx-relation-view-flat .wx-relation-view-group-head").match(/padding-left:\s*0/) !== null,
        true,
        "the group head stays on the left edge, so the step is visible"
    );
});

test("the step is padding, so a hovered row still spans the list", () => {
    // a margin would narrow the row itself and start a second, indented column that
    // the hover and the hairline would both have to follow
    const row = cssRule(".wx-relation-view-row");

    assert.ok(!/margin-left/.test(row), "no margin narrows the row");
    assert.match(
        cssRule(".wx-relation-view, .wx-relation-editor"),
        /--wx-relation-row-indent:\s*1rem/,
        "the step is a token, so a dense surface can shrink it"
    );
});
