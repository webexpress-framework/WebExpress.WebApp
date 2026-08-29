/**
 * Headless contract test for the FileViewCtrl control (wx-webapp-file-view).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 */
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.file.view.js",
    selector: "wx-webapp-file-view",
    ctrl: "FileViewCtrl",
    deps: ["webexpress.webapp.file.view.model.js"]
});
