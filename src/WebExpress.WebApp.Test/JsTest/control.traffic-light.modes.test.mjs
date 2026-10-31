/**
 * Focused tests for the WebApp TrafficLightCtrl composition. They verify that
 * the control renders the dedicated read-only representation
 * (webexpress.webui.TrafficLightCtrl) when data-readonly is set, and the
 * interactive input representation (webexpress.webui.InputTrafficLightCtrl)
 * otherwise - the same read-only / editable split the table template uses.
 */
import { test } from "node:test";
import assert from "node:assert";
import { loadControl } from "./controls.harness.mjs";

/**
 * Builds a connected host carrying the control marker class and the given
 * data attributes.
 * @param {object} rt - The loaded runtime.
 * @param {object} attrs - The data-* attributes to set (camelCase keys).
 * @returns {object} The host element.
 */
function host(rt, attrs = {}) {
    const element = rt.createElement("div");
    element.classList.add("wx-webapp-traffic-light");
    for (const [key, value] of Object.entries(attrs)) {
        element.dataset[key] = value;
    }
    rt.document.body.appendChild(element);
    return element;
}

test("a read-only host composes the read-only representation", () => {
    const rt = loadControl({ file: "webexpress.webapp.traffic.light.js" });
    const element = host(rt, { readonly: "true", value: "green" });

    rt.wx.Controller.createInstances(element);
    const ctrl = rt.wx.Controller.instanceMap.get(element);

    assert.ok(ctrl, "the controller tracks the instance");
    assert.ok(ctrl._ctrl instanceof rt.wx.TrafficLightCtrl, "the inner control is the read-only TrafficLightCtrl");
    assert.ok(!(ctrl._ctrl instanceof rt.wx.InputTrafficLightCtrl), "the inner control is not the interactive input");
    assert.equal(ctrl.value, "green", "the seeded value is reflected");
});

test("an editable host composes the interactive input representation", () => {
    const rt = loadControl({ file: "webexpress.webapp.traffic.light.js" });
    const element = host(rt, { value: "red" });

    rt.wx.Controller.createInstances(element);
    const ctrl = rt.wx.Controller.instanceMap.get(element);

    assert.ok(ctrl._ctrl instanceof rt.wx.InputTrafficLightCtrl, "the inner control is the interactive input");
    assert.equal(ctrl.value, "red", "the seeded value is reflected");
});

test("re-scanning the host does not append a second inner light", () => {
    const rt = loadControl({ file: "webexpress.webapp.traffic.light.js" });
    const element = host(rt, { value: "green" });

    // the controller strips the marker on construction; the control must not
    // re-add it, otherwise every later DOM scan mounts another inner light
    rt.wx.Controller.createInstances(element);
    rt.wx.Controller.createInstances(element);
    rt.wx.Controller.createInstances(element);

    assert.equal(element.querySelectorAll(".wx-traffic-light").length, 1, "exactly one inner light exists after repeated scans");
    assert.ok(!element.classList.contains("wx-webapp-traffic-light"), "the registered marker class is not left on the host");
});
