/**
 * Headless contract test for the MessageQueueStatusCtrl control (wx-webapp-message-queue-status).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 */
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.message.queue.status.js",
    selector: "wx-webapp-message-queue-status",
    ctrl: "MessageQueueStatusCtrl"
});
