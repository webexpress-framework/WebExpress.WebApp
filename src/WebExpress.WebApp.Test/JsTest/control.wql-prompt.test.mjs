/**
 * Headless contract test for the WqlPromptCtrl control (wx-webapp-wql-prompt).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 */
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.wql.prompt.js",
    selector: "wx-webapp-wql-prompt",
    ctrl: "WqlPromptCtrl"
});
