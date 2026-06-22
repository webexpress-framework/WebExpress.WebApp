/**
 * Headless contract test for the InputUniqueCtrl control (wx-webapp-input-unique).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 */
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.input.unique.js",
    selector: "wx-webapp-input-unique",
    ctrl: "InputUniqueCtrl",
    deps: ["webexpress.webapp.input.unique.model.js"]
});
