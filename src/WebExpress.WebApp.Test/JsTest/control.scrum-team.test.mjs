/**
 * Headless tests for the ScrumTeamCtrl control (wx-webapp-scrum-team).
 *
 * The shared contract verifies registration and the construct / teardown lifecycle; the tests
 * below cover the view: the avatar row and the modal table are pure functions of the state,
 * turned into DOM by the keyed reconciler.
 */

import { test } from "node:test";
import assert from "node:assert";
import { contract } from "./controls.contract.mjs";
import { loadControl } from "./controls.harness.mjs";
import { appendStateIsland } from "./harness.mjs";

const DEPS = ["webexpress.webapp.scrum.team.model.js"];
const FILE = "webexpress.webapp.scrum.team.js";

const TEAM = [
    { id: "u1", name: "Grace", initials: "GT", color: "#36c", points: 8, completed: 5 },
    { id: "u2", name: "Emma", team: "Manager", image: "/img/emma.png", points: 13, completed: 13 },
    { id: "u3", name: "Steve", initials: "ST", points: 3, completed: 0 }
];

contract({
    file: FILE,
    selector: "wx-webapp-scrum-team",
    ctrl: "ScrumTeamCtrl",
    deps: DEPS
});

/**
 * Builds a host seeded with the team and constructs the control on it.
 * @param {object} rt - The loaded runtime.
 * @param {Array<object>} members - The seeded members.
 * @param {object} [attributes={}] - Host attributes, set as attributes.
 * @param {object} [dataset={}] - Host data values the control reads through dataset, which the
 *   stub does not mirror from attributes.
 * @returns {{ctrl: object, host: object}} The control and its host.
 */
function build(rt, members, attributes = {}, dataset = {}) {
    const host = rt.createElement("div");
    Object.assign(host.dataset, dataset);
    for (const [name, value] of Object.entries(attributes)) {
        host.setAttribute(name, value);
    }
    appendStateIsland(rt.document, host, { members });
    rt.document.body.appendChild(host);
    return { ctrl: new rt.wxapp.ScrumTeamCtrl(host), host };
}

/**
 * Replaces the modal with a stub that keeps the dialog it was given.
 * @param {object} rt - The loaded runtime.
 * @returns {Array<object>} The dialogs shown.
 */
function captureModals(rt) {
    const shown = [];
    rt.wx.ModalCtrl = class {
        constructor(host) { this.host = host; }
        show() { shown.push(this.host); }
    };
    return shown;
}

test("render describes the row without touching the DOM", () => {
    const rt = loadControl({ deps: DEPS, file: FILE });
    const { ctrl, host } = build(rt, TEAM);
    const before = host.childNodes.slice();
    const tree = ctrl.render({ members: [] });
    assert.deepEqual(host.childNodes, before);
    assert.equal(tree[0].key, "row");
});

test("each member is an avatar badged with their points, followed by the total chip", () => {
    const rt = loadControl({ deps: DEPS, file: FILE });
    const { host } = build(rt, TEAM);
    const row = host.childNodes[0];
    const avatars = row.querySelectorAll(".wx-scrum-team-avatar");
    assert.equal(avatars.length, 3);
    assert.equal(avatars[0].childNodes[0].textContent, "GT");
    assert.equal(avatars[0].querySelector(".wx-scrum-team-badge").textContent, "8");
    assert.equal(avatars[1].querySelector("img").getAttribute("src"), "/img/emma.png");
    assert.match(avatars[1].getAttribute("title"), /Emma · Manager · 13\/13/);
    assert.match(row.querySelector(".wx-scrum-team-total-pill").textContent, /^Σ 24 /);
});

test("members beyond the visible count collapse into an overflow chip", () => {
    const rt = loadControl({ deps: DEPS, file: FILE });
    const { host } = build(rt, TEAM, {}, { maxVisible: "1" });
    const more = host.querySelector(".wx-scrum-team-more");
    assert.equal(host.querySelectorAll(".wx-scrum-team-avatar").length, 1);
    assert.equal(more.textContent, "+2");
    assert.equal(more.getAttribute("title"), "Emma, Steve");
});

test("an empty sprint says so instead of drawing chips", () => {
    const rt = loadControl({ deps: DEPS, file: FILE });
    const { host } = build(rt, []);
    assert.equal(host.querySelector(".wx-scrum-team-total"), null);
    assert.ok(host.querySelector(".wx-scrum-team-empty-row"));
});

test("a class color becomes a class, an inline color joins the element's own style", () => {
    const rt = loadControl({ deps: DEPS, file: FILE });
    const { host } = build(rt, TEAM, { "data-color-points-css": "wx-bg-info", "data-color-completed-style": "background:#0a0" });
    assert.equal(host.querySelector(".wx-scrum-team-badge").className, "wx-scrum-team-badge wx-bg-info");
});

test("a re-render keeps the avatar nodes of members that stay", () => {
    const rt = loadControl({ deps: DEPS, file: FILE });
    const { ctrl, host } = build(rt, TEAM);
    const steve = host.querySelectorAll(".wx-scrum-team-avatar")[2];
    ctrl.setState({ members: [TEAM[2]] });
    ctrl.store.flush();
    assert.equal(host.querySelectorAll(".wx-scrum-team-avatar")[0], steve);
});

test("an avatar opens the table sorted by load and closed by the totals", () => {
    const rt = loadControl({ deps: DEPS, file: FILE });
    const shown = captureModals(rt);
    const { host } = build(rt, TEAM, { "data-color-completed-style": "background:#0a0" });

    host.querySelector(".wx-scrum-team-avatar").dispatchEvent({ type: "click" });

    assert.equal(shown.length, 1);
    const table = shown[0].querySelector(".wx-scrum-team-table");
    const rows = table.querySelector("tbody").childNodes;
    assert.deepEqual(rows.map((row) => row.querySelector(".wx-scrum-team-person-name").textContent), ["Emma", "Grace", "Steve"]);
    const fill = rows[1].querySelector(".wx-scrum-team-progress").childNodes[0];
    assert.equal(fill.style.cssText, "width:63%;background:#0a0", "the completed share, colored by the user color");
    const totals = table.querySelector("tfoot").querySelectorAll(".wx-scrum-team-points-badge").map((badge) => badge.textContent);
    assert.deepEqual(totals, ["18", "24"]);
});

test("the table of an empty sprint spans its columns with a hint", () => {
    const rt = loadControl({ deps: DEPS, file: FILE });
    const { ctrl } = build(rt, []);
    const tree = ctrl._renderTable([]);
    const cell = tree.children[1].children[0].children[0];
    assert.equal(cell.props.colspan, 3);
    assert.equal(cell.props.class, "wx-scrum-team-empty");
});
