/**
 * Guards the scroll layout of the REST wizard against the shipped stylesheets.
 *
 * The wizard keeps its progress indicator and the dialog footer in place and lets
 * only its pages scroll. That holds only while the dialog body itself does not
 * scroll — bootstrap's `.modal-dialog-scrollable .modal-body` would otherwise carry
 * the overflow and take the wizard header out of view with it. The rule that turns
 * it off wins on specificity, which no DOM test can observe, so it is asserted here.
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
const formCss = path.resolve(here, "..", "..", "WebExpress.WebApp", "Assets", "css", "webexpress.webapp.form.css");
const bootstrapCss = path.resolve(here, "..", "..", "..", "..", "WebExpress.WebUI", "src", "WebExpress.WebUI", "Assets", "css", "bootstrap.min.css");

/**
 * Computes the specificity of a selector as (ids, classes, elements). Attributes
 * and pseudo-classes count as classes.
 * @param {string} selector - The selector.
 * @returns {number[]} The specificity triple.
 */
function specificity(selector) {
    return [
        (selector.match(/#[\w-]+/g) || []).length,
        (selector.match(/\.[\w-]+/g) || []).length
            + (selector.match(/\[[^\]]+\]/g) || []).length
            + (selector.match(/(?<!:):(?!:)[\w-]+/g) || []).length,
        (selector.match(/(?:^|[\s>+~])([a-z][\w-]*)/g) || []).length
    ];
}

test("the wizard turns the scrolling of the dialog body off", () => {
    const own = fs.readFileSync(formCss, "utf8");
    const bootstrap = fs.readFileSync(bootstrapCss, "utf8");

    assert.match(
        own,
        /form\.wx-webapp-restwizard \.modal-body \{[^}]*overflow:\s*hidden/,
        "the wizard declares the dialog body as non-scrolling"
    );

    const ours = specificity("form.wx-webapp-restwizard .modal-body");

    for (const match of bootstrap.matchAll(/([^{}@]+)\{([^{}]*overflow[^{}]*)\}/g)) {
        for (const selector of match[1].split(",")) {
            if (!selector.includes(".modal-body")) {
                continue;
            }

            const theirs = specificity(selector.trim());

            assert.ok(
                theirs.join(".") < ours.join("."),
                `"${selector.trim()}" (${theirs}) must not outrank the wizard rule (${ours})`
            );
        }
    }
});

test("the pages carry the scrolling and may shrink to do so", () => {
    const own = fs.readFileSync(formCss, "utf8");
    const pages = own.match(/\.wx-restwizard-pages-container \{([^}]*)\}/);

    assert.ok(pages, "the pages container is styled");
    assert.match(pages[1], /overflow-y:\s*auto/, "the pages scroll");
    assert.match(pages[1], /min-height:\s*0/, "and may shrink below their content");
});

test("the chain from the dialog body down to the pages is a shrinkable column", () => {
    const own = fs.readFileSync(formCss, "utf8");

    const body = own.match(/form\.wx-webapp-restwizard \.modal-body \{([^}]*)\}/);
    assert.match(body[1], /display:\s*flex/, "the body lays its children out in a column");
    assert.match(body[1], /flex-direction:\s*column/, "the body lays its children out in a column");
    assert.match(body[1], /min-height:\s*0/, "and may shrink");

    const root = own.match(/form\.wx-webapp-restwizard \.modal-body > \.wx-restwizard-root \{([^}]*)\}/);
    assert.ok(root, "the wizard root is sized inside the body");
    assert.match(root[1], /min-height:\s*0/, "the root may shrink, otherwise the pages cannot");
});

test("the progress indicator keeps its height instead of scrolling with the pages", () => {
    const own = fs.readFileSync(formCss, "utf8");
    const fixed = own.match(/([^{}]*\.wx-restwizard-progress[^{}]*)\{([^}]*flex:\s*0 0 auto[^}]*)\}/);

    assert.ok(fixed, "the progress indicator is declared as a fixed-size flex item");
});
