/**
 * Headless contract test for the InputSelectionCtrl control (wx-webapp-input-selection).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 */
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.input.selection.js",
    selector: "wx-webapp-input-selection",
    ctrl: "InputSelectionCtrl",
    deps: ["webexpress.webapp.input.selection.model.js"]
});
