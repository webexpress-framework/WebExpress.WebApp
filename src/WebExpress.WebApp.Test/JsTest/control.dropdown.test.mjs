/**
 * Headless contract test for the DropdownCtrl control (wx-webapp-dropdown).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 */
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.dropdown.js",
    selector: "wx-webapp-dropdown",
    ctrl: "DropdownCtrl"
});
