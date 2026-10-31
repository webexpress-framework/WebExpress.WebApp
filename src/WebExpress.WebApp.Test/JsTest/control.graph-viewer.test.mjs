/**
 * Headless contract test for the GraphViewerCtrl control (wx-webapp-graph-viewer).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 */
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.graph.viewer.js",
    selector: "wx-webapp-graph-viewer",
    ctrl: "GraphViewerCtrl",
    deps: ["webexpress.webapp.graph.viewer.model.js"]
});
