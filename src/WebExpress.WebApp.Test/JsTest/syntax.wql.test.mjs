/**
 * Headless unit tests for the WQL syntax highlighter (syntax/wql.js).
 *
 * Highlighting is derived from the prompt's text and must never change it: the markup it
 * builds has to read back as exactly the source, whatever characters the query contains.
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
 * Loads the shipped highlighter against a registry with the WebUI escape contract.
 * @returns {Function} The registered wql highlighter.
 */
function loadHighlighter() {
    const registry = {};
    const sandbox = {
        webexpress: { webui: { Syntax: {
            register(language, alias, syntax) { registry[language] = syntax; },
            escape(text) { return String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
        } } }
    };
    vm.createContext(sandbox);
    const file = webappAsset("syntax/wql.js");
    vm.runInContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
    return registry.wql;
}

const highlight = loadHighlighter();

/**
 * Reads the text a browser would show for the highlighter's markup, one line per line span.
 * @param {string} html - The highlighted markup.
 * @returns {string} The displayed text.
 */
function displayed(html) {
    return html.split('<span class="wx-code-line">').slice(1)
        .map((line) => line.replace(/<\/?span[^>]*>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"))
        .join("\n");
}

for (const source of [
    "a < 5 and b > 2",
    "Text = \"<img src=x onerror=alert(1)>\"",
    "Text = 'x & y' and c <b",
    "Name = 'O''Brien'",
    "Name = \"open",
    "a = 1\n\norder by a"
]) {
    test(`highlighting reads back as the source: ${JSON.stringify(source)}`, () => {
        const html = highlight(source);
        assert.equal(displayed(html), source);
        assert.ok(!/<(?!\/?span[\s>])/.test(html), "no markup of the source survives as markup");
    });
}

test("a doubled quote stays inside its string literal", () => {
    const html = highlight("Name = 'O''Brien' and x = 1");
    assert.ok(html.includes("<span class=\"string\">'O''Brien'</span>"));
    assert.ok(html.includes("<span class=\"logical\">and</span>"));
});
