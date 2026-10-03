/**
 * Headless contract test for the TileCtrl control (wx-webapp-tile).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 */
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.tile.js",
    selector: "wx-webapp-tile",
    ctrl: "TileCtrl",
    deps: ["webexpress.webapp.tile.model.js"]
});
