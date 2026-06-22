/**
 * Headless contract test for the CollaborativeCtrl control (wx-webapp-collaborative).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 */
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.collaborative.js",
    selector: "wx-webapp-collaborative",
    ctrl: "CollaborativeCtrl"
});
