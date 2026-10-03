/**
 * Headless contract test for the DropdownThemeCtrl control (wx-webapp-dropdown-theme).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 */
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.dropdown.theme.js",
    selector: "wx-webapp-dropdown-theme",
    ctrl: "DropdownThemeCtrl",
    deps: ["webexpress.webapp.dropdown.theme.model.js"]
});
