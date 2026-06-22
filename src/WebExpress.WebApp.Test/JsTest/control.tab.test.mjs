/**
 * Headless contract test for the TabCtrl control (wx-webapp-tab).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 */
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.tab.js",
    selector: "wx-webapp-tab",
    ctrl: "TabCtrl",
    deps: ["webexpress.webapp.tab.model.js"]
});
