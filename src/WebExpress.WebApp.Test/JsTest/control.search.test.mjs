/**
 * Headless contract test for the SearchCtrl control (wx-webapp-search).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 */
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.search.js",
    selector: "wx-webapp-search",
    ctrl: "SearchCtrl"
});
