/**
 * Headless contract test for the ProgressTaskCtrl control (wx-webapp-progress-task).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 */
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.progress.task.js",
    selector: "wx-webapp-progress-task",
    ctrl: "ProgressTaskCtrl"
});
