/**
 * Drives two collaborative surfaces on one channel and checks that what one of them does shows
 * up on the other.
 *
 * The transport is stubbed with a queue that fans a sent message out to every registered
 * listener, which is what the server does for the collaborative family. What is under test is
 * the whole client path either side of it: the local event, the message it produces, the filter
 * that decides whether a peer's message is ours, and the overlay node that ends up on screen.
 * A pointer that never arrives and a pointer that arrives into a collapsed layer look the same
 * from the outside, and only a test that asserts the node and its placement tells them apart.
 *
 * Run with Node 18 or newer from the JsTest folder:
 *   node --test
 */
import { test } from "node:test";
import assert from "node:assert";
import { loadControl } from "./controls.harness.mjs";

const FILE = "webexpress.webapp.collaborative.js";
const SELECTOR = "wx-webapp-collaborative";
const CHANNEL = "shared-document";

/**
 * Installs a queue that delivers everything sent to every listener, and mounts two surfaces on
 * the same channel.
 * @param {object} rt - The loaded runtime.
 * @returns {object} Both surfaces and their controllers.
 */
function pair(rt) {
    const listeners = [];

    rt.sandbox.webexpress.webapp.MessageQueue = {
        status: "online",
        register(listener) { listeners.push(listener); },
        unregister(listener) {
            const at = listeners.indexOf(listener);
            if (at >= 0) { listeners.splice(at, 1); }
        },
        send(message) {
            // the server hands the message to the peers; the client decides what is its own
            for (const listener of [...listeners]) { listener(message); }
        }
    };

    const build = () => {
        const element = rt.createElement("div");

        element.id = CHANNEL;
        element.classList.add(SELECTOR);
        rt.document.body.appendChild(element);
        rt.wx.Controller.createInstances(element);

        // the stub resolves no layout, so the surface is given an extent by hand - without one
        // the sender cannot turn a pointer position into a fraction of the shared area
        element.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100 });

        return { element, ctrl: rt.wx.Controller.instanceMap.get(element) };
    };

    return { a: build(), b: build() };
}

/**
 * Lets the coalescing timers and the animation frame run.
 * @param {number} [ms] - How long to wait.
 * @returns {Promise<void>} Resolves after the wait.
 */
function settle(ms = 400) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

test("a peer's pointer arrives and is placed over the shared area", async () => {
    const rt = loadControl({ file: FILE });
    const { a, b } = pair(rt);

    a.element.dispatchEvent({ type: "mousemove", target: a.element, clientX: 100, clientY: 25 });
    await settle();

    const cursor = b.element.querySelector(".wx-collaborative-cursor");

    assert.ok(cursor, "the peer draws a pointer for the other author");
    assert.equal(cursor.style.left, "50%", "at the fraction of the width it was sent as");
    assert.equal(cursor.style.top, "25%");
    assert.equal(a.element.querySelector(".wx-collaborative-cursor"), null, "and nobody draws their own");
});

test("a pointer leaving the surface takes the peer's pointer with it", async () => {
    const rt = loadControl({ file: FILE });
    const { a, b } = pair(rt);

    a.element.dispatchEvent({ type: "mousemove", target: a.element, clientX: 100, clientY: 25 });
    await settle();
    assert.ok(b.element.querySelector(".wx-collaborative-cursor"), "shown while the pointer is here");

    a.element.dispatchEvent({ type: "mouseleave", target: a.element });
    await settle();

    assert.equal(b.element.querySelector(".wx-collaborative-cursor"), null, "and gone when it is not");
});

test("a peer's caret arrives at the field it belongs to", async () => {
    const rt = loadControl({ file: FILE });
    const { a, b } = pair(rt);

    for (const surface of [a, b]) {
        const field = rt.createElement("input");
        field.id = "title";
        field.value = "Monkey Island";
        surface.element.appendChild(field);
    }

    const field = a.element.querySelector("input");

    field.selectionStart = 6;
    field.selectionEnd = 6;
    a.element.dispatchEvent({ type: "focusin", target: field });
    await settle();

    assert.ok(b.ctrl._remoteCarets.size > 0, "the peer knows where the other author is writing");
});

test("what a peer types arrives in the local field", async () => {
    const rt = loadControl({ file: FILE });
    const { a, b } = pair(rt);

    for (const surface of [a, b]) {
        const field = rt.createElement("input");
        field.id = "title";
        field.value = "";
        surface.element.appendChild(field);
    }

    const source = a.element.querySelector("input");

    source.value = "The Secret of Monkey Island";
    a.element.dispatchEvent({ type: "input", target: source });
    await settle();

    assert.equal(b.element.querySelector("input").value, "The Secret of Monkey Island");
});

test("nothing crosses between two surfaces on different channels", async () => {
    const rt = loadControl({ file: FILE });
    const { a, b } = pair(rt);

    b.element.id = "another-document";
    b.ctrl._containerId = "another-document";

    a.element.dispatchEvent({ type: "mousemove", target: a.element, clientX: 100, clientY: 25 });
    await settle();

    assert.equal(b.element.querySelector(".wx-collaborative-cursor"), null, "the id is the channel");
});
