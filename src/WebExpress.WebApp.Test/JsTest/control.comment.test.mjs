/**
 * Headless contract test for the CommentCtrl control (wx-webapp-comment).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 */
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.comment.js",
    selector: "wx-webapp-comment",
    ctrl: "CommentCtrl",
    deps: ["webexpress.webapp.comment.model.js"]
});
