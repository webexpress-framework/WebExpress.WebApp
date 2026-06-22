/**
 * Headless contract test for the ScrumBacklogCtrl control (wx-webapp-scrum-backlog).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 */
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.scrum.backlog.js",
    selector: "wx-webapp-scrum-backlog",
    ctrl: "ScrumBacklogCtrl",
    deps: ["webexpress.webapp.scrum.backlog.model.js"]
});
