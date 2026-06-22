/**
 * Headless contract test for the InputTileCtrl control (wx-webapp-input-tile).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 */
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.input.tile.js",
    selector: "wx-webapp-input-tile",
    ctrl: "InputTileCtrl"
});
