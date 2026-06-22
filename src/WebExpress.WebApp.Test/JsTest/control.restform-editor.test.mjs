/**
 * Headless contract test for the RestFormEditorCtrl control (wx-webapp-restform-editor).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 */
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.restform.editor.js",
    selector: "wx-webapp-restform-editor",
    ctrl: "RestFormEditorCtrl",
    registrationOnly: "the form editor bootstraps a SmartEdit based deep render that requires a real browser DOM"
});
