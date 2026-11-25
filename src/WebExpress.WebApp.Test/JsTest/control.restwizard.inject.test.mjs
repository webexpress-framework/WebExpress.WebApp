/**
 * Verifies that the wizard injects the markup of a step without running scripts in it: the
 * controls of a step come alive through the controller, and a script in a step's content must
 * never run past the content security policy of the page.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadControl } from "./controls.harness.mjs";

const DEPS = [
    "i18n/en.js",
    "webexpress.webapp.restform.model.js",
    "webexpress.webapp.restform.js",
    "webexpress.webapp.restwizard.model.js"
];

test("a step is injected without its scripts", () => {
    const holder = {};
    const rt = loadControl({
        deps: DEPS,
        file: "webexpress.webapp.restwizard.js",
        extraGlobals: { DOMParser: class { parseFromString() { return holder.doc; } } }
    });

    // the document the parser would return for the step markup
    const body = rt.document.createElement("body");
    const field = rt.document.createElement("div");
    field.className = "step-field";
    const script = rt.document.createElement("script");
    script.setAttribute("nonce", "abc");
    script.textContent = "alert(1)";
    body.append(field, script);
    holder.doc = { body: body };

    const container = rt.document.createElement("div");
    rt.wxapp.RestWizardCtrl.prototype._injectHtml.call({}, container, "<div></div><script></script>");

    assert.equal(container.querySelectorAll("script").length, 0, "no script reaches the page");
    assert.equal(container.querySelector(".step-field"), field, "the markup of the step is kept");
});
