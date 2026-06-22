/**
 * Headless contract test for the QuickFilterCtrl control (wx-webapp-quickfilter).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 */
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.quickfilter.js",
    selector: "wx-webapp-quickfilter",
    ctrl: "QuickFilterCtrl"
});
