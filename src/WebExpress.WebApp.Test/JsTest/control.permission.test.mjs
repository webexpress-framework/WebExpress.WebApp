/**
 * Headless contract test for the PermissionCtrl control (wx-webapp-permission).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle. The
 * surface is the REST table, so the table control and its model load first.
 */
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.permission.js",
    selector: "wx-webapp-permission",
    ctrl: "PermissionCtrl",
    deps: [
        "webexpress.webapp.table.model.js",
        "webexpress.webapp.table.js",
        "webexpress.webapp.permission.model.js"
    ]
});
