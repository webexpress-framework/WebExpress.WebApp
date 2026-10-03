/**
 * Headless contract test for the CommentComposerCtrl control (wx-webapp-comment-composer).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 */
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.comment.composer.js",
    selector: "wx-webapp-comment-composer",
    ctrl: "CommentComposerCtrl",
    deps: ["webexpress.webapp.comment.composer.model.js"]
});
