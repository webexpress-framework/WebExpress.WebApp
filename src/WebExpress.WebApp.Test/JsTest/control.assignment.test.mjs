/**
 * Headless contract test for the AssignmentCtrl control (wx-webapp-assignment).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 */
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.assignment.js",
    selector: "wx-webapp-assignment",
    ctrl: "AssignmentCtrl",
    deps: ["webexpress.webapp.assignment.model.js"]
});
