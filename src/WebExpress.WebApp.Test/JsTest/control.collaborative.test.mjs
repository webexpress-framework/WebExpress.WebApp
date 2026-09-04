/**
 * Headless tests for the CollaborativeCtrl control (wx-webapp-collaborative).
 * The shared contract (controls.contract.mjs) verifies that the control
 * registers correctly and survives a construct / teardown lifecycle.
 */
import { test } from "node:test";
import assert from "node:assert";
import { contract } from "./controls.contract.mjs";
import { loadControl } from "./controls.harness.mjs";

const FILE = "webexpress.webapp.collaborative.js";
const SELECTOR = "wx-webapp-collaborative";

contract({
    file: FILE,
    selector: SELECTOR,
    ctrl: "CollaborativeCtrl"
});

/**
 * Builds a shared container, optionally naming a host for the presence bar.
 * @param {object} rt - The loaded runtime.
 * @param {string} [hostId] - The id of the element the presence bar is docked into.
 * @returns {object} The container and the docking host.
 */
function build(rt, hostId) {
    const host = rt.createElement("div");
    host.id = "bar";
    rt.document.body.appendChild(host);

    const container = rt.createElement("div");
    container.id = "channel";
    container.classList.add(SELECTOR);

    if (hostId) {
        container.dataset.collaborativePresenceHost = hostId;
    }

    rt.document.body.appendChild(container);
    rt.wx.Controller.createInstances(container);

    return { container, host, ctrl: rt.wx.Controller.instanceMap.get(container) };
}

test("the presence bar overlays the shared area when no host is named", () => {
    const rt = loadControl({ file: FILE });
    const { container, host } = build(rt);

    assert.ok(container.querySelector(".wx-collaborative-presence"), "the bar is an overlay of the container");
    assert.equal(host.querySelector(".wx-collaborative-presence"), null);
});

test("a named host takes the presence bar, and it drops its overlay placement", () => {
    const rt = loadControl({ file: FILE });
    const { container, host } = build(rt, "bar");

    const bar = host.querySelector(".wx-collaborative-presence");

    assert.ok(bar, "who is here is rendered where the host asked for it");
    assert.ok(bar.classList.contains("wx-collaborative-presence-docked"), "so it is laid out by that host");
    assert.equal(container.querySelector(".wx-collaborative-presence"), null, "and only once");

    // the cursors and the carets are positions inside the shared area and mean nothing outside it
    assert.ok(container.querySelector(".wx-collaborative-cursors"));
    assert.ok(container.querySelector(".wx-collaborative-carets"));
});

test("the teardown takes the docked bar off its foreign host", () => {
    const rt = loadControl({ file: FILE });
    const { host, ctrl } = build(rt, "bar");

    ctrl.destroy();

    assert.equal(host.querySelector(".wx-collaborative-presence"), null, "nothing is left behind on a host the control does not own");
});

test("a container in a dialog waits for it to open before announcing anyone", () => {
    const rt = loadControl({ file: FILE });
    const dialog = rt.createElement("div");

    dialog.classList.add("wx-webui-modal");
    rt.document.body.appendChild(dialog);

    const container = rt.createElement("div");
    container.id = "channel";
    container.classList.add(SELECTOR);
    dialog.appendChild(container);

    rt.wx.Controller.createInstances(container);

    const ctrl = rt.wx.Controller.instanceMap.get(container);

    // presence means "is looking at this", and a closed dialog is not looking
    assert.equal(ctrl._active, undefined, "nobody is announced while the dialog is shut");

    dialog.dispatchEvent({ type: rt.wx.Event.MODAL_SHOW_EVENT, target: dialog });
    assert.equal(ctrl._active, true, "opening it joins the channel");

    ctrl._remoteUsers.set("peer", { id: "peer", name: "Peer", color: "#f00", lastSeen: Date.now() });

    dialog.dispatchEvent({ type: rt.wx.Event.MODAL_HIDE_EVENT, target: dialog });

    assert.equal(ctrl._active, false, "closing it leaves again");
    assert.equal(ctrl._remoteUsers.size, 0, "and forgets peers whose leaving it would no longer hear");
});

test("a container that is the surface itself joins at once", () => {
    const rt = loadControl({ file: FILE });
    const { ctrl } = build(rt);

    assert.equal(ctrl._active, true, "there is no dialog to wait for");
});
