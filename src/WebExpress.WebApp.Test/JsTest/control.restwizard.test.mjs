/**
 * Headless contract test for the RestWizardCtrl control (wx-webapp-restwizard).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 */
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.restwizard.js",
    selector: "wx-webapp-restwizard",
    ctrl: "RestWizardCtrl",
    deps: ["webexpress.webapp.restform.model.js", "webexpress.webapp.restform.js", "webexpress.webapp.restwizard.model.js"]
});
