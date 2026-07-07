/**
 * Headless contract test for the SidebarCtrl control (wx-webapp-sidebar).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 */
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.sidebar.js",
    selector: "wx-webapp-sidebar",
    ctrl: "SidebarCtrl",
    deps: ["webexpress.webapp.sidebar.model.js"]
});
