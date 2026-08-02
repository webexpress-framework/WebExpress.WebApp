/**
 * Headless contract test for the SlaCtrl control (wx-webapp-sla).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 */
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.sla.js",
    selector: "wx-webapp-sla",
    ctrl: "SlaCtrl"
});
