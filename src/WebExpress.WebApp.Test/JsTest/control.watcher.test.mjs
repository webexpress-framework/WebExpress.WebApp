/**
 * Headless contract test for the WatcherCtrl control (wx-webapp-watcher).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 */
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.watcher.js",
    selector: "wx-webapp-watcher",
    ctrl: "WatcherCtrl",
    deps: ["webexpress.webapp.watcher.model.js"]
});
