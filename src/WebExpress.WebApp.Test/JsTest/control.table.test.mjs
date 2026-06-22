/**
 * Headless contract test for the TableCtrl control (wx-webapp-table).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 */
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.table.js",
    selector: "wx-webapp-table",
    ctrl: "TableCtrl",
    deps: ["webexpress.webapp.table.model.js"]
});
