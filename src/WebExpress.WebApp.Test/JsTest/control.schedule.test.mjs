/**
 * Headless contract test for the ScheduleCtrl control (wx-webapp-schedule).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 */
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.schedule.js",
    selector: "wx-webapp-schedule",
    ctrl: "ScheduleCtrl",
    deps: ["webexpress.webapp.schedule.model.js"]
});
