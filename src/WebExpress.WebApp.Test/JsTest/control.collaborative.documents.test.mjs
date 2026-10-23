/**
 * Drives the shared-document path of CollaborativeCtrl end to end: two pages, each a runtime of
 * its own, edit one document through the real container control, the real session and a
 * sequencer that follows the server contract. The shared control is a minimal implementation of
 * the collaboration methods, so what is under test is the coupling - discovery, routing,
 * carets, conflicts and the reconnection - not an editor.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { loadControl } from "./controls.harness.mjs";
import { Server } from "./collaborative.sim.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const webui = path.resolve(here, "..", "..", "..", "..", "WebExpress.WebUI", "src", "WebExpress.WebUI", "Assets", "js");

/**
 * Loads a page with a shared container holding one shared text control.
 * @param {Server} server - The sequencer both pages talk to.
 * @param {object} [options] - The options.
 * @param {string} [options.token="t"] - The access token on the container.
 * @returns {object} The page.
 */
function page(server, options = {}) {
    const rt = loadControl({ file: "webexpress.webapp.collaborative.js", deps: ["webexpress.webapp.collaborative.document.js"] });
    vm.runInContext(fs.readFileSync(path.join(webui, "webexpress.webui.ot.js"), "utf8"), rt.sandbox);
    const Ot = rt.wx.Ot;
    const listeners = [];
    const sent = [];
    const queue = {
        status: "online",
        register(listener) { listeners.push(listener); },
        unregister(listener) { listeners.splice(listeners.indexOf(listener), 1); },
        send(message) { sent.push(JSON.parse(JSON.stringify(message))); }
    };
    rt.sandbox.webexpress.webapp.MessageQueue = queue;

    /** A shared plain text control implementing the collaboration methods. */
    class SharedText extends rt.wx.Ctrl {
        constructor(element) { super(element); this.text = "hello"; this.collab = null; this.caret = 0; this.loaded = 0; }
        get collaborationKind() { return "text"; }
        beginCollaboration(options) { this.collab = options; }
        endCollaboration() { this.collab = null; }
        tokens() { return Ot.expand(this.text ? [{ t: "s", v: this.text, m: {} }] : []); }
        getCollaborationTokens() { return Ot.compact(this.tokens()); }
        loadCollaborationTokens(tokens) { this.text = Ot.expand(tokens).map(t => t.v).join(""); this.loaded++; return true; }
        checkCollaborationTokens(tokens) { return Ot.expand(tokens).every(t => t.t === "c"); }
        repairCollaborationTokens(tokens) { return Ot.compact(Ot.expand(tokens).filter(t => t.t === "c")); }
        applyRemoteSteps(steps) {
            const result = Ot.apply(this.tokens(), steps);
            this.text = result.tokens.map(t => t.v).join("");
            this.caret = Ot.map(this.caret, result.steps, 1);
            return true;
        }
        getModelSelection() { return { anchor: this.caret, focus: this.caret }; }
        getModelPositionRect(pos) { return { left: 10 + pos * 5, top: 20, height: 12 }; }
        getModelRangeRects() { return []; }
        type(at, value) {
            const result = Ot.apply(this.tokens(), [{ type: "replace", from: at, to: at, slice: [{ t: "s", v: value, m: {} }] }]);
            this.text = result.tokens.map(t => t.v).join("");
            this.caret = at + value.length;
            this._dispatch(rt.wx.Event.COLLABORATION_STEPS_EVENT, { steps: result.steps });
        }
    }
    rt.wx.Controller.registerClass("wx-test-shared", SharedText);

    const container = rt.createElement("div");
    container.id = "box";
    container.classList.add("wx-webapp-collaborative");
    container.dataset.collaborativeDocument = "scope";
    container.dataset.collaborativeToken = options.token ?? "t";
    const field = rt.createElement("div");
    field.id = "field";
    field.classList.add("wx-test-shared");
    container.appendChild(field);
    rt.document.body.appendChild(container);
    container.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 200 });
    rt.wx.Controller.createInstances(container);

    const ctrl = rt.wx.Controller.instanceMap.get(container);
    const shared = rt.wx.Controller.instanceMap.get(field);
    return { rt, queue, sent, listeners, container, field, ctrl, shared, client: rt.wxapp.CollaborativeCtrl.identity().client };
}

/**
 * Exchanges messages until nothing is in transit: the pages' operation messages go to the
 * sequencer, everything else is fanned out between the pages as the broadcast handler would.
 * @param {Server} server - The sequencer.
 * @param {Array<object>} pages - The pages.
 */
function pump(server, pages) {
    for (let round = 0; round < 50; round++) {
        let moved = false;
        for (const p of pages) {
            // a closed connection delivers nothing in either direction
            if (p.offline) { p.sent.length = 0; continue; }
            for (const message of p.sent.splice(0)) {
                moved = true;
                if (message.type.includes(".ot.")) server.receive(message);
                else for (const other of pages) if (other !== p) other.listeners.forEach(l => l(message));
            }
        }
        for (const { client, message } of server.outbox.splice(0)) {
            moved = true;
            pages.filter(p => client.startsWith(p.client + "-") && !p.offline).forEach(p => p.listeners.forEach(l => l(message)));
        }
        if (!moved) return;
    }
}

/**
 * Creates a sequencer for plain text documents.
 * @param {object} rt - A runtime providing the transformation core.
 * @returns {Server} The sequencer.
 */
function sequencer(rt) {
    const server = new Server({ Ot: rt.wx.Ot });
    server.valid = tokens => tokens.every(t => t.t === "c");
    return server;
}

test("controls with collaboration methods inside a scoped container share their document", () => {
    const first = page(null);
    const server = sequencer(first.rt);
    const second = page(server);
    pump(server, [first, second]);

    assert.ok(first.shared.collab?.tag, "the container started the collaborative mode with an id tag");
    assert.equal(server.docs.has("scope/field"), true, "the document is addressed by scope and element id");

    first.shared.type(5, " world");
    pump(server, [first, second]);

    assert.equal(second.shared.text, "hello world", "the change arrived as an operation");
    assert.equal(second.shared.loaded, 0, "and was applied, not reloaded");
    assert.equal(first.field.getAttribute("data-wx-collaboration"), "synced");
});

test("concurrent typing on two pages converges", () => {
    const first = page(null);
    const server = sequencer(first.rt);
    const second = page(server);
    pump(server, [first, second]);

    first.shared.type(0, "A");
    second.shared.type(5, "B");
    second.shared.type(0, "C");
    pump(server, [first, second]);

    assert.equal(first.shared.text, second.shared.text);
    assert.match(first.shared.text, /^[AC]{2}helloB$/);
});

test("a shared control never broadcasts its markup as a value", () => {
    const first = page(null);
    const server = sequencer(first.rt);
    pump(server, [first]);

    first.field.setAttribute("contenteditable", "true");
    first.field.dispatchEvent({ type: "input", target: first.field, bubbles: true });

    assert.equal(first.sent.some(m => m.type === "webexpress.webapp.collaborative.input"), false);
});

test("carets travel as model positions and follow later changes", () => {
    const first = page(null);
    const server = sequencer(first.rt);
    const second = page(server);
    pump(server, [first, second]);

    // the caret is sent only while the document has the focus
    first.rt.document.activeElement = first.field;
    first.shared.caret = 2;
    first.ctrl._sendModelCaret(first.ctrl._sessions.get("field"));
    pump(server, [first, second]);

    const caret = second.container.querySelector(".wx-collaborative-caret");
    assert.ok(caret, "the peer's caret is drawn");
    assert.equal(caret.style.left, "20px", "at the position of the model offset");

    second.shared.type(0, "XY");
    pump(server, [first, second]);
    assert.equal(second.container.querySelector(".wx-collaborative-caret").style.left, "30px", "and moves with text inserted before it");
});

test("a container without a token keeps the value synchronization", () => {
    const first = page(null, { token: "" });

    assert.equal(first.shared.collab, null);
    assert.equal(first.ctrl._sessions.size, 0);
});

test("a lost connection pauses and the reconnection catches up", () => {
    const first = page(null);
    const server = sequencer(first.rt);
    const second = page(server);
    pump(server, [first, second]);

    second.offline = true;
    second.rt.document.dispatchEvent({ type: second.rt.wxapp.Event.CHANGE_STATUS_EVENT, detail: { status: "offline" } });
    first.shared.type(5, "!");
    second.shared.type(0, ">");
    pump(server, [first, second]);
    assert.equal(second.field.getAttribute("data-wx-collaboration"), "offline");
    assert.equal(second.shared.text, ">hello", "nothing arrives while offline");

    second.offline = false;
    second.rt.document.dispatchEvent({ type: second.rt.wxapp.Event.CHANGE_STATUS_EVENT, detail: { status: "online" } });
    pump(server, [first, second]);
    assert.equal(first.shared.text, ">hello!");
    assert.equal(second.shared.text, ">hello!");
});

test("local changes the server refuses are offered back instead of dropped", () => {
    const first = page(null);
    const server = sequencer(first.rt);
    pump(server, [first]);

    // the server refuses an edit the client let through
    server.valid = tokens => !tokens.some(t => t.v === "#");
    let detail = null;
    first.container.addEventListener(first.rt.wxapp.Event.COLLABORATIVE_CONFLICT, e => { detail = e.detail; });
    first.shared.type(0, "#");
    pump(server, [first]);

    assert.equal(first.shared.text, "hello", "the shared version is shown");
    assert.ok(first.container.querySelector(".wx-collaborative-conflict"), "a notice offers the local version");
    assert.equal(detail?.fieldId, "field");
    assert.equal(first.rt.wx.Ot.expand(detail.local).map(t => t.v).join(""), "#hello");
});

test("the teardown returns the controls to unshared mode", () => {
    const first = page(null);
    first.ctrl.destroy();

    assert.equal(first.shared.collab, null);
    assert.equal(first.field.hasAttribute("data-wx-collaboration"), false);
});
