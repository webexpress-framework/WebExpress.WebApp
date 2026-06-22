/**
 * Headless contract test for the ListCtrl control (wx-webapp-list).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 */
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.list.js",
    selector: "wx-webapp-list",
    ctrl: "ListCtrl",
    deps: ["webexpress.webapp.list.model.js"]
});
