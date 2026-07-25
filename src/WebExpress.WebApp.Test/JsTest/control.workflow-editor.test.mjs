/**
 * Headless contract test for the WorkflowEditorCtrl control (wx-webapp-workflow-editor).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 */
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.workflow.editor.js",
    selector: "wx-webapp-workflow-editor",
    ctrl: "WorkflowEditorCtrl",
    deps: ["webexpress.webapp.workflow.editor.model.js"]
});
