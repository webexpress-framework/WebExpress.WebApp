/**
 * Headless contract test for the StatusTaskCtrl control (wx-webapp-status-task).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 */
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.status.task.js",
    selector: "wx-webapp-status-task",
    ctrl: "StatusTaskCtrl"
});
