/**
 * The collaboration interface of the WQL prompt: edits become character steps, remote steps
 * move the caret along without entering the prompt's undo, concurrent typing converges and undo
 * takes back only the own edits.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { loadEngine, webappAsset } from "./harness.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const webui = path.resolve(here, "..", "..", "..", "..", "WebExpress.WebUI", "src", "WebExpress.WebUI", "Assets", "js");
const STEPS = "webexpress.webui.collaboration.steps";

/**
 * Loads a standalone prompt in collaborative mode that records the steps it announces.
 * @param {string} [value] - The initial text.
 * @returns {object} The prompt and its recorded steps.
 */
function shared(value = "") {
    const engine = loadEngine({ extraFiles: [webappAsset("webexpress.webapp.wql.prompt.model.js"), webappAsset("webexpress.webapp.wql.prompt.view.js"), webappAsset("webexpress.webapp.wql.prompt.js")] });
    vm.runInContext(fs.readFileSync(path.join(webui, "webexpress.webui.ot.js"), "utf8"), engine.sandbox);
    engine.sandbox.setTimeout = () => 0;
    engine.sandbox.clearTimeout = () => {};
    engine.sandbox.Node = { ELEMENT_NODE: 1, TEXT_NODE: 3 };
    engine.sandbox.window = { getSelection: () => ({ rangeCount: 0, removeAllRanges() {}, addRange() {}, setBaseAndExtent() {} }), location: { origin: "http://localhost" } };
    engine.wx.Event.COLLABORATION_STEPS_EVENT = STEPS;
    engine.wx.Ctrl.prototype._i18n = key => key;
    const host = engine.document.createElement("div");
    const ctrl = new engine.wxapp.WqlPromptCtrl(host);
    if (value) ctrl._setText(value);
    const announced = [];
    host.addEventListener(STEPS, e => announced.push(JSON.parse(JSON.stringify(e.detail.steps))));
    ctrl.beginCollaboration();
    const type = (at, text) => { ctrl._model.select(at); ctrl._edit("type", () => ctrl._model.insertText(text)); };
    return { ctrl, announced, type, Ot: engine.wx.Ot, text: () => ctrl._model.text };
}

test("edits are announced as character steps", () => {
    const a = shared("status = open");
    a.type(13, "!");
    assert.equal(a.announced.length, 1);
    assert.equal(a.announced[0][0].type, "replace");
    assert.equal(a.announced[0][0].from, 13);
});

test("remote steps change the text, move the caret and stay out of the undo", () => {
    const a = shared("status = open");
    a.ctrl._model.select(9);
    assert.equal(a.ctrl.applyRemoteSteps([{ type: "replace", from: 0, to: 0, slice: [{ t: "s", v: "x ", m: {} }] }]), true);
    assert.equal(a.text(), "x status = open");
    assert.equal(a.ctrl.getModelSelection().focus, 11);
    assert.equal(a.ctrl._collab.history.canUndo(), false);
    assert.equal(a.announced.length, 0);
});

test("two prompts typing concurrently converge", () => {
    const a = shared("a = 1"), b = shared("a = 1");
    a.type(5, " and b = 2");
    b.type(0, "(");
    const [forA, forB] = a.Ot.transform(b.announced.flat(), a.announced.flat(), false);
    a.ctrl.applyRemoteSteps(forA);
    b.ctrl.applyRemoteSteps(forB);
    assert.equal(a.text(), "(a = 1 and b = 2");
    assert.equal(b.text(), a.text());
});

test("undo takes back only the own edit", () => {
    const a = shared("a = 1");
    a.type(5, "0");
    a.ctrl.applyRemoteSteps([{ type: "replace", from: 0, to: 0, slice: [{ t: "s", v: "(", m: {} }] }]);
    a.ctrl._step(false);
    assert.equal(a.text(), "(a = 1");
    assert.equal(a.announced.length, 2, "the undo travels like any edit");
});

test("formatted or structured tokens are no valid prompt text", () => {
    const a = shared("x");
    assert.equal(a.ctrl.checkCollaborationTokens([{ t: "s", v: "x", m: { bold: true } }]), false);
    assert.equal(a.ctrl.checkCollaborationTokens([{ t: "s", v: "x", m: {} }]), true);
    assert.equal(a.ctrl.applyRemoteSteps([{ type: "replace", from: 0, to: 0, slice: [{ t: "l", n: "image", id: "i", a: {} }] }]), false);
    assert.deepEqual(JSON.parse(JSON.stringify(a.ctrl.repairCollaborationTokens([{ t: "s", v: "a\rb", m: { bold: true } }]))), [{ t: "s", v: "ab", m: {} }]);
});
