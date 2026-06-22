/**
 * Headless contract test for the InputCascadingCtrl control (wx-webapp-input-cascading).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 */
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.input.cascading.js",
    selector: "wx-webapp-input-cascading",
    ctrl: "InputCascadingCtrl"
});
