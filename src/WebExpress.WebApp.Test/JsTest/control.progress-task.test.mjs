/**
 * Headless contract test for the ProgressTaskCtrl control (wx-webapp-progress-task).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 */
import { test } from "node:test";
import assert from "node:assert";
import { contract } from "./controls.contract.mjs";
import { loadEngine, webappAsset } from "./harness.mjs";

contract({
    file: "webexpress.webapp.progress.task.js",
    selector: "wx-webapp-progress-task",
    ctrl: "ProgressTaskCtrl"
});

test("the bar is named by its message and by a generic name before one arrives", () => {
    const rt = loadEngine({ extraFiles: [webappAsset("webexpress.webapp.progress.task.js")] });
    const host = rt.createElement("div");
    host.id = "task1";
    host.dataset.task = "abc";
    rt.document.body.appendChild(host);
    const ctrl = new rt.wxapp.ProgressTaskCtrl(host);

    const bar = ctrl._progressInner;
    assert.ok(bar.getAttribute("aria-label"), "a bar without a message still has a name");
    assert.equal(bar.getAttribute("aria-labelledby"), null, "and points at no empty message");

    ctrl._applyUpdate({ taskId: "abc", state: 1, progress: 40, message: "Copying files" });
    assert.equal(bar.getAttribute("aria-valuenow"), "40");
    assert.equal(bar.getAttribute("aria-labelledby"), ctrl._message.id, "the message names the bar once there is one");

    ctrl._applyUpdate({ taskId: "abc", state: 1, progress: 50, message: "" });
    assert.equal(bar.getAttribute("aria-labelledby"), null, "an empty message hands the name back to the fallback");
});
