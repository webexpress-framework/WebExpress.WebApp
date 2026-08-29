/**
 * Guards where the toolbar of the relation surface puts the presentation switch.
 *
 * The switch and the add affordance sit on the right, the header on the left.
 * Which of the two carries the auto margin that makes that happen is not a detail:
 * the header is optional, so a switch that relied on the header being there to
 * push it would fall back to the left as soon as a page turned every part of the
 * header off - and two auto margins would split the free space between them
 * instead of collecting it on one side.
 *
 * None of that is observable from a DOM test, because the stub reports every
 * dimension as zero, so the stylesheet is asserted directly.
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
const sheet = path.resolve(here, "..", "..", "WebExpress.WebApp", "Assets", "css", "webexpress.webapp.relation.css");
const switcher = path.resolve(here, "..", "..", "..", "..", "WebExpress.WebUI", "src", "WebExpress.WebUI", "Assets", "css", "webexpress.webui.view.switcher.css");

/**
 * Reads the declarations of every rule written for a selector. A selector may
 * carry more than one rule - the flat layout takes parts of the card back - so
 * what it declares in the end is all of them together.
 * @param {string} selector - Selector to look up, matched verbatim.
 * @returns {string|null} The declarations, or null when the selector carries no rule.
 */
function rule(selector, file = sheet) {
    const css = fs.readFileSync(file, "utf8");
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matches = [...css.matchAll(new RegExp("(?:^|[};/])\\s*" + escaped + "\\s*\\{([^}]*)\\}", "g"))];

    return matches.length > 0 ? matches.map((x) => x[1]).join(";") : null;
}

test("the presentation switch keeps itself to the right", () => {
    // the switch is the shared one, so the rule that places it lives with it
    const views = rule(".wx-view-switcher", switcher);

    assert.ok(views, "the switch carries a rule at all");
    assert.match(views, /margin-left:\s*auto/,
        "the switch collects the free space of the toolbar itself, so it stays right without a header");
});

test("the surface re-skins the shared switch rather than restating its layout", () => {
    const skin = rule(".wx-relation-view .wx-view-switcher");

    assert.ok(skin, "the surface hands the switch its own palette");

    // only custom properties: a layout declaration here would be the second
    // place the switch is described, which is what sharing it was meant to end
    for (const declaration of skin.split(";").map((x) => x.trim()).filter(Boolean)) {
        assert.match(declaration, /^--wx-view-switcher-/, `unexpected declaration: ${declaration}`);
    }
});

test("the header does not push the switch, so it may be left out", () => {
    const heading = rule(".wx-relation-view-heading");

    assert.ok(heading, "the header carries a rule at all");
    assert.ok(!/margin-right:\s*auto/.test(heading),
        "a second auto margin would split the free space instead of collecting it on the right");
});

test("the flat layout leaves that alone", () => {
    const flat = rule(".wx-relation-view-flat .wx-relation-view-heading");

    assert.ok(flat, "the flat layout states the header of its own");
    assert.match(flat, /flex:\s*1 1 auto/,
        "the flat header grows across the remaining width, which is what draws its hairline");
    assert.ok(!/margin-right/.test(flat),
        "and has no margin of the card layout left to take back");
});
