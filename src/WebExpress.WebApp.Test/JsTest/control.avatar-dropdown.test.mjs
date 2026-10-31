/**
 * Headless contract test for the AvatarDropdownCtrl control (wx-webapp-avatar-dropdown).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 */
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.avatar.dropdown.js",
    selector: "wx-webapp-avatar-dropdown",
    ctrl: "AvatarDropdownCtrl"
});
