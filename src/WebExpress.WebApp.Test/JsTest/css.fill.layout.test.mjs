/**
 * Guards the fill contract of the application shell against the shipped stylesheets.
 *
 * A control marked `wx-fill` asks the shell for the height of its pane and scrolls
 * inside it instead of growing the page. What each control makes of that height is
 * stated in its own stylesheet, but the contract only holds while all of them agree:
 * the shell has to hand the height down along the ancestry of the marker, and every
 * filling control has to land on a definite height even where nothing is handed
 * down. None of that is observable from a DOM test - the stub reports every
 * dimension as zero - so the stylesheets are asserted directly.
 *
 * The kanban and the calendar ship with WebUI and the shell that drives them with
 * WebApp, so the contract is checked here, where both ends are in reach.
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
 * given selector. A selector may carry more than one rule - the form editor holds
 * its type palette apart from its layout - so what the selector declares in the
 * end is all of them together.
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

/**
 * Asserts that a fill rule bounds its control: it grows and shrinks with the host,
 * falls back to a height of its own where the host hands nothing down, and never
 * reaches past a host that does have an extent.
 * @param {string} body - The declarations of the fill rule.
 * @param {string} variable - The custom property carrying the fallback height.
 */
function assertBounded(body, variable) {
    assert.match(body, /flex:\s*1 1 var\(/, "the control grows and shrinks with its host");
    assert.ok(body.includes(variable), `the fallback height is authored through ${variable}`);
    assert.match(body, /max-height:\s*100%/, "and never reaches past a host that has an extent");
}

test("the shell hands its height down along the ancestry of a filling control", () => {
    const shell = fs.readFileSync(path.join(webapp, "webexpress.webapp.css"), "utf8");
    const match = shell.match(/#wx-content-main :has\(([^)]*)\)[^{]*\{([^}]*)\}/);

    assert.ok(match, "the content panel carries the rule that opens the chain");
    assert.ok(match[1].includes(".wx-fill"), "the marker every filling control carries is named");
    assert.match(match[2], /flex-direction:\s*column/, "each panel on the way becomes a column");
    assert.match(match[2], /flex:\s*1 1 auto/, "and grows, so it has a height to hand down");
    assert.match(match[2], /min-height:\s*0/, "and may shrink below its content");
});

test("the gantt chart fills its pane and keeps the scrolling inside", () => {
    const file = path.join(webapp, "webexpress.webapp.gantt.css");

    assertBounded(rule(file, ".wx-gantt.wx-fill"), "--wx-gantt-height");

    // the body is what shrinks; without that the two panes push past the host
    assert.match(rule(file, ".wx-gantt-body"), /min-height:\s*0/, "the body may shrink below its rows");
    assert.match(rule(file, ".wx-gantt"), /overflow:\s*hidden/, "and the host clips rather than growing");
});

test("the board fills its pane and scrolls under headers that stay", () => {
    const file = path.join(webui, "webexpress.webui.kanban.css");
    const fill = rule(file, ".wx-kanban.wx-fill");

    assertBounded(fill, "--wx-kanban-height");
    assert.match(fill, /overflow:\s*auto/, "the board is the scrollport once it is bounded");

    const headers = rule(file, ".wx-kanban.wx-fill > .wx-kanban-headers");
    assert.match(headers, /position:\s*sticky/, "the column headers stay while the cards scroll");
    assert.match(headers, /top:\s*0/, "at the top edge of the board");
    assert.match(headers, /background:/, "and cover the cards passing beneath them");

    // a board without swimlanes has no header band and carries its headers in the columns
    const inColumn = rule(file, ".wx-kanban.wx-fill > .wx-kanban-swimlane .wx-kanban-column-header");
    assert.match(inColumn, /position:\s*sticky/, "a board without swimlanes keeps its headers too");

    // and its columns run to the bottom of the pane rather than ending under the last card
    const lane = rule(file, ".wx-kanban.wx-fill:not(:has(> .wx-kanban-headers)) > .wx-kanban-swimlane");
    assert.match(lane, /flex:\s*1 1 auto/, "the single lane takes the height of the board");
    assert.ok(!/min-height:\s*0/.test(lane), "but never shrinks below its cards, which is what makes it scroll");
});

test("the calendar fills its pane and hands the overflow to its grid", () => {
    const file = path.join(webui, "webexpress.webui.schedule.css");

    assertBounded(rule(file, ".wx-schedule.wx-fill"), "--wx-schedule-height");

    assert.match(rule(file, ".wx-schedule"), /overflow:\s*hidden/, "the host clips rather than growing");
    assert.match(rule(file, ".wx-schedule-body"), /overflow:\s*auto/, "and the grid below the toolbar scrolls");
    assert.match(
        rule(file, ".wx-schedule.wx-fill > .wx-schedule-toolbar"),
        /flex:\s*0 0 auto/,
        "while the toolbar keeps its height in a short pane"
    );

    // a month is as tall as its cells, so the weeks share what the pane has left
    assert.match(
        rule(file, ".wx-schedule.wx-fill .wx-schedule-month"),
        /min-height:\s*100%/,
        "the month reaches to the bottom of the pane"
    );

    const week = rule(file, ".wx-schedule.wx-fill .wx-schedule-month > .wx-schedule-week");
    assert.match(week, /flex:\s*1 1 auto/, "and its weeks share the space");
    assert.ok(!/min-height:\s*0/.test(week), "without shrinking below the day cells, which is what makes it scroll");
});

test("the form editor fills its pane and scrolls between chrome that stays", () => {
    const file = path.join(webapp, "webexpress.webapp.form.css");
    const fill = rule(file, ".wx-form-editor.wx-fill");

    assertBounded(fill, "--wx-form-editor-height");
    assert.match(fill, /overflow:\s*hidden/, "the editor clips, so the panes carry the overflow");

    assert.match(
        rule(file, ".wx-form-editor.wx-fill > .wx-form-editor-body"),
        /min-height:\s*0/,
        "the body may shrink below the form it holds"
    );
    assert.match(
        rule(file, ".wx-form-editor.wx-fill .wx-form-editor-pane-body"),
        /overflow:\s*auto/,
        "and the panes scroll on their own"
    );
});

test("the table fills its pane and scrolls under a header that stays", () => {
    const file = path.join(webui, "webexpress.webui.table.css");

    // the rule reaches the host, which is what the control marks; the table is what
    // the controller builds inside it, hence :has rather than a class of its own
    assertBounded(rule(file, ".wx-fill:has(> .wx-table)"), "--wx-table-height");

    const table = rule(file, ".wx-fill > .wx-table");
    assert.match(table, /overflow:\s*auto/, "the table is the scrollport on both axes");
    assert.match(table, /min-height:\s*0/, "it may shrink below its rows");
    assert.match(table, /min-width:\s*0/, "and below its widest one, which is what lets it scroll sideways");

    const header = rule(file, ".wx-fill > .wx-table > .wx-table-header-group");
    assert.match(header, /position:\s*sticky/, "the column header stays while the rows pass under it");
    assert.match(header, /top:\s*0/, "at the top edge of the table");
});

test("the tiles fill their pane and scroll above the pager", () => {
    const file = path.join(webui, "webexpress.webui.tile.css");
    const fill = rule(file, ".wx-tile.wx-fill");

    assertBounded(fill, "--wx-tile-height");
    assert.match(fill, /flex-wrap:\s*nowrap/, "a wrapping column would spread the tiles sideways instead of overflowing");
    assert.match(fill, /overflow:\s*hidden/, "the host clips, so the container carries the overflow");

    const container = rule(file, ".wx-tile.wx-fill > .wx-tile-container");
    assert.match(container, /overflow-y:\s*auto/, "the tiles scroll");
    assert.match(container, /min-height:\s*0/, "and may shrink below their number");

    assert.match(
        rule(file, ".wx-tile.wx-fill > *:not(.wx-tile-container)"),
        /flex:\s*0 0 auto/,
        "while the pager and the info line keep their height"
    );
});

test("the dashboard fills its pane and scrolls below its menu bar", () => {
    const file = path.join(webui, "webexpress.webui.dashboard.css");
    const fill = rule(file, ".wx-dashboard.wx-fill");

    assertBounded(fill, "--wx-dashboard-height");
    assert.match(fill, /overflow:\s*hidden/, "the host clips, so the columns carry the overflow");

    assert.match(
        rule(file, ".wx-dashboard.wx-fill > .wx-dashboard-toolbar"),
        /flex:\s*0 0 auto/,
        "the board menu keeps its height and stays reachable"
    );

    const row = rule(file, ".wx-dashboard.wx-fill > .wx-dashboard-row");
    assert.match(row, /overflow-y:\s*auto/, "the columns scroll as one board");
    assert.match(row, /min-height:\s*0/, "and may shrink below the widgets they hold");
});

test("the form editor root is styled through the class the controller sets", () => {
    const file = path.join(webapp, "webexpress.webapp.form.css");
    const root = rule(file, ".wx-form-editor");

    // it used to name a second class that no control emits any more, which left the
    // editor without its column - and a column is what fill mode needs
    assert.ok(root, "the root rule is reachable from the host the controller marks");
    assert.match(root, /flex-direction:\s*column/, "head, body and foot stack as a column");
});
