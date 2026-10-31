/**
 * Headless contract test for the KanbanCtrl control (wx-webapp-kanban).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 */
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.kanban.js",
    selector: "wx-webapp-kanban",
    ctrl: "KanbanCtrl",
    deps: ["webexpress.webapp.kanban.model.js"]
});
