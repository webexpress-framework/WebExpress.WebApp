/**
 * Headless contract test for the DashboardCtrl control (wx-webapp-dashboard).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 */
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.dashboard.js",
    selector: "wx-webapp-dashboard",
    ctrl: "DashboardCtrl",
    deps: ["webexpress.webapp.dashboard.model.js"]
});
