/**
 * Headless contract test for the InputUniqueCtrl control (wx-webapp-input-unique).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 *
 * The required tests cover the gap between the two halves of the control: the
 * form renderer paints the asterisk from the Required resolver onto the host
 * div, but the field the form validator inspects is the input this controller
 * builds afterwards. Unless the requirement travels across that hand-over, a
 * field is marked required, asked for, and never checked.
 */
import { test } from "node:test";
import assert from "node:assert";
import { contract } from "./controls.contract.mjs";
import { loadControl } from "./controls.harness.mjs";

contract({
    file: "webexpress.webapp.input.unique.js",
    selector: "wx-webapp-input-unique",
    ctrl: "InputUniqueCtrl",
    deps: ["webexpress.webapp.input.unique.model.js"]
});

/**
 * Builds the host div the C# control renders and constructs the controller on it.
 * @param {object} rt - The loaded runtime.
 * @param {object} attributes - The data attributes the C# render emitted onto the host.
 * @returns {object} The host element and the input the controller built.
 */
function build(rt, attributes = {}) {
    const host = rt.createElement("div");
    host.classList.add("wx-webapp-input-unique");
    host.setAttribute("name", "workspace");
    for (const [name, value] of Object.entries(attributes)) {
        host.setAttribute(name, value);
    }
    rt.document.body.appendChild(host);

    new rt.wxapp.InputUniqueCtrl(host);

    return { host, input: host.querySelector("input") };
}

/**
 * Loads the control, optionally alongside the REST form whose validator inspects it.
 * @param {boolean} withForm - Whether the REST form is loaded as well.
 * @returns {object} The loaded runtime.
 */
function load(withForm = false) {
    const deps = ["webexpress.webapp.input.unique.model.js"];
    if (withForm) {
        deps.push("webexpress.webapp.restform.model.js", "webexpress.webapp.restform.js");
    }
    return loadControl({ deps, file: "webexpress.webapp.input.unique.js" });
}

test("a required unique field declares the requirement on the input it builds", () => {
    const rt = load();

    const { host, input } = build(rt, { "data-required": "true" });

    assert.equal(input.dataset.wxRequired, "true", "the built input carries the requirement");
    assert.equal(host.getAttribute("data-required"), null, "the consumed config is stripped from the host");
});

test("an optional unique field declares nothing", () => {
    const rt = load();

    const { input } = build(rt);

    assert.equal(input.dataset.wxRequired, undefined);
});

test("the declared length and pattern constraints reach the input as well", () => {
    const rt = load();

    const { host, input } = build(rt, {
        "data-minlength": "3",
        "data-maxlength": "10",
        "data-pattern": "[a-z]+"
    });

    assert.equal(input.getAttribute("minlength"), "3");
    assert.equal(input.getAttribute("maxlength"), "10");
    assert.equal(input.getAttribute("pattern"), "[a-z]+");
    assert.equal(host.getAttribute("data-maxlength"), null, "the consumed config is stripped from the host");
    assert.equal(host.getAttribute("data-pattern"), null, "the consumed config is stripped from the host");
});

test("a field without a declared minimum length does not inherit the check threshold", () => {
    const rt = load();

    // the threshold below which the endpoint is not asked falls back to one; carrying
    // that onto the input would reject every empty optional field as too short
    const { input } = build(rt);

    assert.equal(input.getAttribute("minlength"), null);
});

/**
 * Runs the real REST form validator against one input, with only the translation
 * lookup stubbed so an assertion reads the message key rather than a catalogue entry.
 * @param {object} rt - The loaded runtime.
 * @param {object} input - The input to validate.
 * @returns {string|null} The message key, or null when the input passes.
 */
function validateField(rt, input) {
    const prototype = rt.wxapp.RestFormCtrl.prototype;
    const form = { _i18n: (key) => key, _applyParams: prototype._applyParams };

    return prototype._validateField.call(form, input);
}

test("the form validator rejects a required unique field while it is empty", () => {
    const rt = load(true);

    const { input } = build(rt, { "data-required": "true" });

    assert.equal(
        validateField(rt, input),
        "webexpress.webapp:validation.required",
        "an empty required field is reported"
    );

    input.value = "acme";
    // the stub has no constraint validation, so the native verdict stands in for it
    input.validity = { valid: true };

    assert.equal(validateField(rt, input), null, "a filled field passes");
});

test("the form validator enforces the declared length and pattern constraints", () => {
    const rt = load(true);

    const short = build(rt, { "data-minlength": "3" }).input;
    short.value = "ab";
    short.validity = { valid: true };

    assert.equal(validateField(rt, short), "webexpress.webapp:validation.minlength");

    const malformed = build(rt, { "data-pattern": "[a-z]+" }).input;
    malformed.value = "AB1";
    malformed.validity = { valid: true };

    assert.equal(validateField(rt, malformed), "webexpress.webapp:validation.format.invalid");

    malformed.value = "acme";

    assert.equal(validateField(rt, malformed), null, "a matching value passes");
});
