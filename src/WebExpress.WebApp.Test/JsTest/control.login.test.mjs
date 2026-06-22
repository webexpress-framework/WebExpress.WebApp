/**
 * Headless contract test for the LoginCtrl control (wx-webapp-login).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 */
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.login.js",
    selector: "wx-webapp-login",
    ctrl: "LoginCtrl"
});
