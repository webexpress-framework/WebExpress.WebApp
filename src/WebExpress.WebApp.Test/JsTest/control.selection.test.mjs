/**
 * Headless contract test for the SelectionCtrl control (wx-webapp-selection).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 */
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.selection.js",
    selector: "wx-webapp-selection",
    ctrl: "SelectionCtrl",
    deps: ["webexpress.webapp.selection.model.js"]
});
