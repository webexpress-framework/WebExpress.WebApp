/**
 * Guards the backing of the backlog's item type badge.
 *
 * The badge carries the icon of a work item type, and a drawn icon is painted by masking
 * background-color - so the white the badge sets is the ink, and the chip underneath is the
 * only thing that makes it readable. The type names come from the application, not from this
 * sheet: a deployment that configures types of its own lands on a badge no colour rule names,
 * which leaves it transparent and paints white ink onto a white row. The icon is then present,
 * sized and masked, and still invisible - which is what a reader reports as a missing icon.
 *
 * A DOM test cannot see it: the stub resolves no stylesheet, so the pairing of ink and backing
 * is asserted against the shipped CSS directly.
 *
 * Run with Node 18 or newer from the JsTest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sheet = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..", "..", "WebExpress.WebApp", "Assets", "css", "webexpress.webapp.scrum.css"
);
const css = fs.readFileSync(sheet, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * Returns the declarations of every rule written for the given selector.
 * @param {string} selector - Selector to look up, matched verbatim.
 * @returns {string|null} The declarations, or null when the selector carries no rule.
 */
function rule(selector) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matches = [...css.matchAll(new RegExp("(?:^|[};])\\s*" + escaped + "\\s*\\{([^}]*)\\}", "g"))];

    return matches.length > 0 ? matches.map(x => x[1]).join(";") : null;
}

test("the type badge backs its ink, so a type the sheet does not name still shows its icon", () => {
    const base = rule(".wx-scrum-row .wx-scrum-type");

    assert.ok(base, "the badge still carries a rule of its own");
    assert.match(base, /(^|;)\s*color\s*:/, "the badge sets the ink the icon is masked in");
    assert.match(base, /(^|;)\s*background(-color)?\s*:/, "white ink without a chip under it is an invisible icon");
});

test("every type the sheet names paints its own chip", () => {
    const named = [...css.matchAll(/\.wx-scrum-type\.([a-z-]+)\s*\{([^}]*)\}/g)];

    assert.ok(named.length > 0, "the known types still colour their badges");

    for (const [, type, declarations] of named) {
        assert.match(declarations, /(^|;)\s*background(-color)?\s*:/, `.wx-scrum-type.${type} overrides the neutral chip with one of its own`);
    }
});
