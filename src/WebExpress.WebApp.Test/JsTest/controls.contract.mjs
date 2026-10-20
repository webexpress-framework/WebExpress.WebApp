/**
 * Shared contract for the per-control headless tests. Every WebApp control that
 * registers itself with the controller (webexpress.webui.Controller.registerClass)
 * has its own control.<name>.test.mjs file that calls contract(...) with the
 * source file, selector and exported class. The contract verifies two things
 * against the real, shipped sources, loaded by controls.harness.mjs together
 * with the real WebUI runtime and the WebApp engine:
 *
 *   1. registration  - the selector maps to the expected, exported class and
 *                       that class derives from the Ctrl base.
 *   2. lifecycle      - the controller can construct an instance for a
 *                       representative host element (the marker class is
 *                       consumed and the instance is tracked) and can tear it
 *                       down again without the controller swallowing a
 *                       constructor, destroy or cleanup error.
 *   3. value          - a control that exposes a writable value keeps the field
 *                       side of the control contract (WebExpress.WebUI/docs/js/contract.md):
 *                       it is pristine when it appears, writing back the value it
 *                       reports changes and announces nothing, and the field
 *                       contract can validate it. A value without a setter is a
 *                       report and only has to be readable.
 *
 * The controller deliberately catches and logs construction and teardown
 * failures so that one broken control cannot abort a page; the lifecycle test
 * therefore treats those controller-emitted messages as assertion failures.
 *
 * A control whose construction performs a deep, browser-only render (the form
 * and graph editors) declares registrationOnly, which keeps the registration
 * test and replaces the lifecycle test with a documented skip.
 *
 * Run with Node 18 or newer from the JsTest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadControl, childListMutation } from "./controls.harness.mjs";

/**
 * The controller log fragments that signal a swallowed lifecycle failure.
 */
const FAILURE_MARKERS = [
    "Failed to create instance",
    "Failed to instantiate class",
    "Error destroying instance",
    "Error running element cleanup"
];

/**
 * Builds the default representative host: a connected div that carries the
 * control's marker class.
 * @param {object} rt - The loaded runtime.
 * @param {string} selector - The marker class of the control.
 * @returns {object} The host element.
 */
export function defaultHost(rt, selector) {
    const element = rt.createElement("div");
    element.classList.add(selector);
    rt.document.body.appendChild(element);
    return element;
}

/**
 * Registers the registration and lifecycle tests for a single control.
 * @param {object} control - The descriptor: { file, selector, ctrl, deps?, host?, registrationOnly? }.
 *   file             - the shipped source file that registers the control.
 *   selector         - the marker class the control registers under.
 *   ctrl             - the exported class name on webexpress.webapp (may be absent
 *                      for a control registered as a bare class).
 *   deps             - webapp asset files loaded before the control (models, base controls).
 *   host             - optional builder for a control that reads a specific structure.
 *   registrationOnly - reason string when the lifecycle cannot run headlessly.
 */
export function contract(control) {
    test(`${control.selector} registers ${control.ctrl} as a Ctrl subclass`, () => {
        const rt = loadControl({ deps: control.deps, file: control.file });

        const registered = rt.wx.Controller.classRegistry.get(control.selector);
        assert.ok(registered, `selector "${control.selector}" is registered`);
        assert.ok(registered.prototype instanceof rt.wx.Ctrl, `${control.ctrl} derives from Ctrl`);

        // controls exported on the namespace are also checked for identity; a few
        // are registered as a bare class and have no namespace export to compare
        const exported = rt.wxapp[control.ctrl];
        if (exported) {
            assert.equal(registered, exported, `selector maps to webexpress.webapp.${control.ctrl}`);
        }
    });

    if (control.registrationOnly) {
        test(`${control.selector} constructs and tears down without a swallowed error`,
            { skip: control.registrationOnly }, () => { });
        return;
    }

    test(`${control.selector} constructs and tears down without a swallowed error`, () => {
        const rt = loadControl({ deps: control.deps, file: control.file });

        const messages = [];
        const realError = console.error;
        console.error = (...args) => {
            messages.push(args.map((a) => (a && a.message) || String(a)).join(" "));
        };

        try {
            const host = control.host ? control.host(rt, control.selector) : defaultHost(rt, control.selector);

            rt.wx.Controller.createInstances(host);

            // the controller tracks the instance only after it matched the selector
            // and ran the constructor; some controls re-add their marker class as a
            // styling hook, so the tracked instance is the reliable success signal
            assert.ok(rt.wx.Controller.instanceMap.has(host), "the controller tracks the new instance");

            // a final removal drives the deterministic teardown; a control that
            // intentionally detaches its host keeps its instance, which is a
            // documented outcome rather than a leak
            rt.document.body.removeChild(host);
            rt.wx.Controller.handleMutations([childListMutation({ removed: [host] })]);
            assert.ok(
                !rt.wx.Controller.instanceMap.has(host) || host._wxDetached,
                "the instance is destroyed or intentionally retained while detached"
            );

            const swallowed = messages.filter((m) => FAILURE_MARKERS.some((marker) => m.includes(marker)));
            assert.deepEqual(swallowed, [], `the controller logged no lifecycle failure:\n${swallowed.join("\n")}`);
        } finally {
            console.error = realError;
        }
    });

    test(`${control.selector} keeps the value contract when it exposes a value`, (t) => {
        const rt = loadControl({ deps: control.deps, file: control.file });
        const host = control.host ? control.host(rt, control.selector) : defaultHost(rt, control.selector);

        rt.wx.Controller.createInstances(host);
        const instance = rt.wx.Controller.getInstanceByElement(host);

        if (!instance || !("value" in instance)) {
            t.skip("the control exposes no value");
            return;
        }

        const Field = rt.wx.Field;
        if (!Field.isField(instance)) {
            // a value without a setter reports what the control loads and stores itself
            assert.doesNotThrow(() => instance.value, "a reported value can be read");
            return;
        }

        assert.equal(Field.isDirty(instance), false, "a control is pristine when it appears");

        const announced = [];
        host.addEventListener(rt.wx.Event.CHANGE_VALUE_EVENT, (e) => announced.push(e.detail));
        instance.value = instance.value;

        assert.equal(announced.length, 0, "writing back the reported value announces no change");
        assert.equal(Field.isDirty(instance), false, "writing back the reported value leaves the control pristine");

        const results = Field.validate(instance);
        assert.ok(Array.isArray(results), "the field contract validates the control");
        for (const result of results) {
            assert.ok(["error", "warning"].includes(result.type), `a result is an error or a warning, not "${result.type}"`);
            assert.equal(typeof result.text, "string");
        }
    });

    test(`${control.selector} stays required when the server marks its host required`, (t) => {
        const rt = loadControl({ deps: control.deps, file: control.file });
        const host = control.host ? control.host(rt, control.selector) : defaultHost(rt, control.selector);
        // the mark ControlFormItemInput.Required renders on the host of a custom input
        host.setAttribute("data-required", "true");

        rt.wx.Controller.createInstances(host);
        const instance = rt.wx.Controller.getInstanceByElement(host);

        if (!instance || !rt.wx.Field.isField(instance)) {
            t.skip("the control is no field");
            return;
        }

        assert.equal(rt.wx.Field.isRequired(instance), true, "the required mark survives the construction");
    });
}
