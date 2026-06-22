/**
 * Headless contract test for the ScrumSprintCtrl control (wx-webapp-scrum-sprint).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 */
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.scrum.sprint.js",
    selector: "wx-webapp-scrum-sprint",
    ctrl: "ScrumSprintCtrl"
});
