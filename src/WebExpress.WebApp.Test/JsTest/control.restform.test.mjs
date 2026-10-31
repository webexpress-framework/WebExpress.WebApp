/**
 * Headless contract test for the RestFormCtrl control (wx-webapp-restform).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 */
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.restform.js",
    selector: "wx-webapp-restform",
    ctrl: "RestFormCtrl",
    deps: ["webexpress.webapp.restform.model.js"]
});
