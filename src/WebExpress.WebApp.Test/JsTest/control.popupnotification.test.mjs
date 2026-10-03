/**
 * Headless contract test for the PopupNotificationCtrl control (wx-webapp-popupnotification).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 */
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.popupnotification.js",
    selector: "wx-webapp-popupnotification",
    ctrl: "PopupNotificationCtrl"
});
