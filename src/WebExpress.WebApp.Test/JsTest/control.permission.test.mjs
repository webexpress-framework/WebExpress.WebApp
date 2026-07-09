/**
 * Headless contract test for the PermissionCtrl control (wx-webapp-permission).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 */
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.permission.js",
    selector: "wx-webapp-permission",
    ctrl: "PermissionCtrl",
    deps: ["webexpress.webapp.permission.model.js"]
});
