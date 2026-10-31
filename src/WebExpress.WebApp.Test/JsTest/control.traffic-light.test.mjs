/**
 * Headless contract test for the TrafficLightCtrl control (wx-webapp-traffic-light).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 */
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.traffic.light.js",
    selector: "wx-webapp-traffic-light",
    ctrl: "TrafficLightCtrl"
});
