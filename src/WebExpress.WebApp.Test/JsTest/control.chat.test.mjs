/**
 * Headless contract test for the ChatCtrl control (wx-webapp-chat).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 */
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.chat.js",
    selector: "wx-webapp-chat",
    ctrl: "ChatCtrl"
});
