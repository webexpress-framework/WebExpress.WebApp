/**
 * Headless contract and behaviour test for the LikeCtrl control (wx-webapp-like-mount).
 * The shared contract (controls.contract.mjs) verifies that the control registers correctly and
 * survives a construct / teardown lifecycle. The focused tests below cover what the controller
 * adds to the server-rendered figure: posting the toggle and repainting from the answer.
 */
import { test } from "node:test";
import assert from "node:assert";
import { loadControl } from "./controls.harness.mjs";
import { contract } from "./controls.contract.mjs";

contract({
    file: "webexpress.webapp.like.js",
    selector: "wx-webapp-like-mount",
    ctrl: "LikeCtrl"
});

/**
 * Builds the figure the server renders for a joinable like.
 * @param {object} rt - The loaded runtime.
 * @param {string} value - The count already on the page.
 * @returns {object} The host element.
 */
function figure(rt, value) {
    const host = rt.createElement("button");
    host.classList.add("wx-webapp-like");
    host.classList.add("wx-webapp-like-action");
    host.classList.add("wx-webapp-like-mount");
    host.dataset.uri = "/api/1/objects/like";
    host.dataset.payload = JSON.stringify({ object: "SD-1" });
    host.setAttribute("aria-pressed", "false");

    const number = rt.createElement("span");
    number.classList.add("wx-webapp-like-value");
    number.textContent = value;
    host.appendChild(number);

    rt.document.body.appendChild(host);

    return host;
}

test("wx-webapp-like posts the toggle and repaints from the answer", async () => {
    const calls = [];
    const rt = loadControl({
        file: "webexpress.webapp.like.js",
        fetch: async (uri, init) => {
            calls.push({ uri, init });
            return {
                ok: true,
                status: 200,
                headers: { get: () => "application/json" },
                json: async () => ({ value: "8", active: true })
            };
        }
    });

    const host = figure(rt, "7");
    const ctrl = new rt.wxapp.LikeCtrl(host);

    await ctrl.toggle();

    assert.equal(calls.length, 1, "the toggle is posted once");
    assert.equal(calls[0].uri, "/api/1/objects/like", "it goes to the address the server named");
    assert.equal(calls[0].init.method, "POST");
    assert.equal(calls[0].init.body, JSON.stringify({ object: "SD-1" }), "the body names the subject");

    assert.equal(host.querySelector(".wx-webapp-like-value").textContent, "8", "the count comes from the answer");
    assert.ok(host.classList.contains("wx-webapp-like-active"), "the figure shows the reader is among it");
    assert.equal(host.getAttribute("aria-pressed"), "true");
});

test("wx-webapp-like leaves the figure alone when the request fails", async () => {
    const rt = loadControl({
        file: "webexpress.webapp.like.js",
        fetch: async () => ({ ok: false, status: 500, headers: { get: () => null }, json: async () => ({}) })
    });

    const host = figure(rt, "7");
    const ctrl = new rt.wxapp.LikeCtrl(host);

    await ctrl.toggle();

    assert.equal(host.querySelector(".wx-webapp-like-value").textContent, "7", "a count that moved without the server agreeing would be a lie");
    assert.ok(!host.classList.contains("wx-webapp-like-active"));
    assert.equal(host.disabled, false, "the figure is clickable again");
});

test("wx-webapp-like does not post without an address", async () => {
    let called = false;
    const rt = loadControl({
        file: "webexpress.webapp.like.js",
        fetch: async () => {
            called = true;
            return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({}) };
        }
    });

    const host = figure(rt, "7");
    delete host.dataset.uri;

    const ctrl = new rt.wxapp.LikeCtrl(host);

    await ctrl.toggle();

    assert.equal(called, false, "there is nothing to join, so nothing is sent");
});

test("wx-webapp-like reports the new state as a change event", async () => {
    const rt = loadControl({
        file: "webexpress.webapp.like.js",
        fetch: async () => ({
            ok: true,
            status: 200,
            headers: { get: () => "application/json" },
            json: async () => ({ value: "3", active: false })
        })
    });

    const host = figure(rt, "4");
    const ctrl = new rt.wxapp.LikeCtrl(host);

    const seen = [];
    host.addEventListener(rt.wx.Event.CHANGE_VALUE_EVENT, (event) => seen.push(event.detail));

    await ctrl.toggle();

    assert.equal(seen.length, 1, "the figure reports what it now shows");
    assert.deepEqual(seen[0], { value: "3", active: false });
});
