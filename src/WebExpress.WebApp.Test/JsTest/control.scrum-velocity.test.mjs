/**
 * Headless tests for the ScrumVelocityCtrl control (wx-webapp-scrum-velocity).
 *
 * The shared contract verifies registration and the construct / teardown
 * lifecycle; the tests below cover what the chart adds on top of plotting the
 * trailing slice - the opt-in sprint filter, which is the framework's dual
 * handle slider narrowing the plot to a window of the loaded history.
 */

import { test } from "node:test";
import assert from "node:assert";
import { contract } from "./controls.contract.mjs";
import { loadControl, childListMutation } from "./controls.harness.mjs";
import { appendStateIsland } from "./harness.mjs";

const DEPS = ["webexpress.webapp.scrum.velocity.model.js"];
const FILE = "webexpress.webapp.scrum.velocity.js";

const HISTORY = [
    { id: "s1", name: "Sprint 1", committed: 30, completed: 24 },
    { id: "s2", name: "Sprint 2", committed: 28, completed: 27 },
    { id: "s3", name: "Sprint 3", committed: 26, completed: 18 },
    { id: "s4", name: "Sprint 4", committed: 32, completed: 31 },
    { id: "s5", name: "Sprint 5", committed: 30, completed: 28 },
    { id: "s6", name: "Sprint 6", committed: 34, completed: 22 },
    { id: "s7", name: "Sprint 7", committed: 28, completed: 29 }
];

contract({
    file: FILE,
    selector: "wx-webapp-scrum-velocity",
    ctrl: "ScrumVelocityCtrl",
    deps: DEPS
});

/**
 * Builds a host seeded with the sprint history and constructs the control on it.
 * @param {object} rt - The loaded runtime.
 * @param {object} [config] - The data attributes of the host.
 * @returns {{ctrl: object, host: object}} The control and its host.
 */
function build(rt, config = {}) {
    const host = rt.createElement("div");
    Object.assign(host.dataset, config);
    appendStateIsland(rt.document, host, { sprints: HISTORY });
    rt.document.body.appendChild(host);

    return { ctrl: new rt.wxapp.ScrumVelocityCtrl(host), host };
}

/**
 * Reads the sprint names the chart currently plots.
 * @param {object} host - The host element.
 * @returns {Array<string>} The names, oldest first.
 */
function plotted(host) {
    return host.querySelectorAll(".wx-scrum-velocity-label").map((label) => label.textContent);
}

/**
 * Returns the slider instance the filter row hosts.
 * @param {object} rt - The loaded runtime.
 * @param {object} host - The host element.
 * @returns {object|null} The slider control.
 */
function slider(rt, host) {
    const element = host.querySelector(".wx-scrum-velocity-slider");
    return element ? rt.wx.Controller.getInstanceByElement(element) : null;
}

test("without the filter the chart plots the trailing MaxSprints slice", () => {
    const rt = loadControl({ deps: DEPS, file: FILE });
    const { ctrl, host } = build(rt, { maxSprints: "3" });

    assert.equal(host.querySelector(".wx-scrum-velocity-filter"), null, "no filter row is rendered");
    assert.equal(ctrl.sprintWindow, null, "no window is selected");
    assert.deepEqual(plotted(host), ["Sprint 5", "Sprint 6", "Sprint 7"]);
});

test("the filter starts on the window MaxSprints describes", () => {
    const rt = loadControl({ deps: DEPS, file: FILE });
    const { ctrl, host } = build(rt, { maxSprints: "3", showSprintFilter: "true" });

    assert.ok(host.querySelector(".wx-scrum-velocity-filter"), "the filter row is rendered");
    assert.deepEqual(ctrl.sprintWindow, { min: 5, max: 7 });
    assert.deepEqual(plotted(host), ["Sprint 5", "Sprint 6", "Sprint 7"]);

    const control = slider(rt, host);
    assert.ok(control, "the slider is instantiated");
    assert.deepEqual(control.value, { min: 5, max: 7 }, "the handles agree with the plot");
});

test("moving a handle narrows the plotted sprints", () => {
    const rt = loadControl({ deps: DEPS, file: FILE });
    const { ctrl, host } = build(rt, { maxSprints: "3", showSprintFilter: "true" });

    const control = slider(rt, host);
    control.value = { min: 2, max: 4 };

    assert.deepEqual(ctrl.sprintWindow, { min: 2, max: 4 });
    assert.deepEqual(plotted(host), ["Sprint 2", "Sprint 3", "Sprint 4"]);
    // the rolling average follows the window: an average over sprints that are
    // not on screen would answer a question nobody asked
    assert.match(host.querySelector(".wx-scrum-velocity-avg").textContent, /25\.3/);
});

test("the re-render the slider triggers does not tear it down", () => {
    const rt = loadControl({ deps: DEPS, file: FILE });
    const { host } = build(rt, { maxSprints: "3", showSprintFilter: "true" });

    const row = host.querySelector(".wx-scrum-velocity-filter");
    const control = slider(rt, host);

    control.value = { min: 3, max: 5 };

    // the controller sees the row leave and re-enter the host in one operation;
    // a row that is connected again by the time the batch is processed was moved
    // rather than removed, so its slider has to keep its instance
    rt.wx.Controller.handleMutations([childListMutation({ removed: [row] })]);

    assert.equal(slider(rt, host), control, "the slider keeps its instance across the re-render");
    assert.deepEqual(plotted(host), ["Sprint 3", "Sprint 4", "Sprint 5"]);
});

test("the whole history is selectable, not just MaxSprints of it", () => {
    const rt = loadControl({ deps: DEPS, file: FILE });
    const { host } = build(rt, { maxSprints: "3", showSprintFilter: "true" });

    const control = slider(rt, host);
    control.value = { min: 1, max: 7 };

    assert.equal(plotted(host).length, HISTORY.length);
});
