/**
 * Headless tests for the assignment control: it renders the seeded state without a request,
 * stores assign, unassign and assign to someone else through its data service, redraws
 * the row from the answer, locks the action while a request runs and leaves the row as
 * it was when the server refuses the change.
 *
 * Run with Node 18 or newer from the jstest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { appendServiceIsland, appendStateIsland, appendResourceIsland } from "./harness.mjs";
import { loadControl } from "./controls.harness.mjs";

const PEOPLE = {
    guybrush: { id: "guybrush", name: "Guybrush Threepwood", initials: "GT" },
    elaine: { id: "elaine", name: "Elaine Marley", image: "/img/elaine.png" },
    stan: { id: "stan", name: "Stan S. Stanman" }
};

/**
 * Answers a request with a json body, fresh per call.
 */
function json(status, body) {
    return {
        ok: status >= 200 && status < 300,
        status: status,
        headers: { get: () => "application/json" },
        json: async () => JSON.parse(JSON.stringify(body))
    };
}

/**
 * An in-memory assignment endpoint with a users search; writes can be refused or held.
 */
function endpoint(initial, options = {}) {
    let state = Object.assign({ assignee: null, self: PEOPLE.guybrush, mayChange: true }, initial);
    const calls = [];
    const held = [];

    const fetch = async (url, init = {}) => {
        const method = init.method || "GET";
        const body = init.body ? JSON.parse(init.body) : null;
        calls.push({ url: String(url), method: method, body: body });

        if (String(url).includes("/api/users")) {
            return json(200, Object.values(PEOPLE));
        }
        if (method === "GET") {
            return json(200, state);
        }
        if (options.hold) {
            await new Promise((resolve) => held.push(resolve));
        }
        if (options.refuse) {
            return json(400, { message: options.refuse });
        }
        if (options.status) {
            return json(options.status, {});
        }

        if (method === "PUT") {
            state = Object.assign({}, state, { assignee: PEOPLE[(body && body.userId) || state.self.id] });
        } else if (method === "DELETE") {
            state = Object.assign({}, state, { assignee: null });
        }
        return json(200, state);
    };

    return { fetch, calls, held, writes: () => calls.filter((c) => c.method !== "GET" && !c.url.includes("/api/users")) };
}

/**
 * Mounts an assignment row against the endpoint, optionally seeded and with a users service.
 */
function mount(net, options = {}) {
    const rt = loadControl({
        file: "webexpress.webapp.assignment.js",
        deps: ["webexpress.webapp.assignment.model.js"],
        fetch: net.fetch
    });
    const popups = [];
    rt.wxapp.MessageQueue = { dispatchLocal(payload) { popups.push(payload); } };

    const host = rt.createElement("div");
    host.className = "wx-webapp-assignment";
    for (const [name, value] of Object.entries(options.attributes || {})) {
        host.setAttribute(name, value);
    }
    appendServiceIsland(rt.document, host, { name: "data", baseUri: "/api/assignment/quest", method: "GET", updateMethod: "PUT" });
    if (options.users) {
        appendServiceIsland(rt.document, host, { name: "users", baseUri: "/api/users", method: "GET" });
    }
    if (options.seed) {
        appendStateIsland(rt.document, host, options.seed);
    }
    rt.document.body.appendChild(host);

    const events = { changed: [], errors: [] };
    host.addEventListener(rt.wxapp.Event.ASSIGNMENT_CHANGED_EVENT, (e) => events.changed.push(e.detail));
    host.addEventListener(rt.wx.Event.DATA_ERROR_EVENT, (e) => events.errors.push(e.detail));

    const ctrl = new rt.wxapp.AssignmentCtrl(host);
    return { rt, host, ctrl, popups, events };
}

async function settle(turns = 8) {
    for (let i = 0; i < turns; i++) {
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
}

function click(el) {
    el.dispatchEvent({ type: "click", target: el });
}

function name(host) {
    return host.querySelector(".wx-assignment-name").textContent;
}

function action(host, kind) {
    return host.querySelector(`[data-wx-assignment-action="${kind}"]`);
}

test("a seeded row renders at once and needs no request", async () => {
    const net = endpoint({});
    const { host, ctrl } = mount(net, { seed: { assignee: PEOPLE.elaine, self: PEOPLE.guybrush, mayChange: true } });
    await settle();

    assert.equal(net.calls.length, 0, "the seed spares the first round trip");
    assert.equal(name(host), "Elaine Marley");
    assert.equal(ctrl.value.id, "elaine");
    assert.equal(host.querySelector(".wx-assignment-avatar img").getAttribute("src"), "/img/elaine.png");
    assert.equal(host.querySelector(".wx-assignment-avatar").getAttribute("aria-hidden"), "true", "the portrait is decorative");
    assert.equal(host.querySelector(".wx-assignment-text").getAttribute("aria-live"), "polite");
    assert.ok(action(host, "assign"), "someone else is assigned, so the caller may take it");
    assert.equal(host.classList.contains("wx-assignment-empty"), false);
});

test("an unseeded row loads its state from the data service", async () => {
    const net = endpoint({ assignee: PEOPLE.guybrush });
    const { host } = mount(net);
    await settle();

    assert.equal(net.calls.length, 1);
    assert.equal(net.calls[0].method, "GET");
    assert.equal(name(host), "Guybrush Threepwood");
    assert.equal(host.querySelector(".wx-assignment-avatar").textContent, "GT");
    assert.ok(action(host, "unassign"), "the caller is the assignee");
});

test("an unassigned row shows the placeholder and marks the host empty", async () => {
    const net = endpoint({});
    const { host } = mount(net, { seed: { assignee: null, self: PEOPLE.guybrush, mayChange: true } });
    await settle();

    assert.equal(name(host), "Unassigned");
    assert.equal(host.classList.contains("wx-assignment-empty"), true);
});

test("assign to me stores the change, redraws the row and announces it", async () => {
    const net = endpoint({});
    const { host, events } = mount(net, { seed: { assignee: null, self: PEOPLE.guybrush, mayChange: true } });
    await settle();

    click(action(host, "assign"));
    await settle();

    const writes = net.writes();
    assert.equal(writes.length, 1);
    assert.equal(writes[0].method, "PUT");
    assert.deepEqual(writes[0].body, {}, "the server assigns the caller when no id is sent");
    assert.equal(name(host), "Guybrush Threepwood");
    assert.equal(host.classList.contains("wx-assignment-empty"), false);
    assert.ok(action(host, "unassign"), "the action turns into unassign");
    assert.equal(events.changed.length, 1);
    assert.equal(events.changed[0].assignee.id, "guybrush");
    assert.equal(events.changed[0].previous, null);
});

test("unassign removes the assignment through DELETE", async () => {
    const net = endpoint({ assignee: PEOPLE.guybrush });
    const { host, events } = mount(net, { seed: { assignee: PEOPLE.guybrush, self: PEOPLE.guybrush, mayChange: true } });
    await settle();

    const button = action(host, "unassign");
    click(button);
    await settle();

    assert.equal(net.writes()[0].method, "DELETE");
    assert.equal(name(host), "Unassigned");
    assert.ok(action(host, "assign"));
    assert.equal(action(host, "assign"), button, "the button is kept, so the focus stays on it");
    assert.equal(events.changed[0].assignee, null);
    assert.equal(events.changed[0].previous.id, "guybrush");
});

test("the action is locked while the request runs", async () => {
    const net = endpoint({}, { hold: true });
    const { host } = mount(net, { seed: { assignee: null, self: PEOPLE.guybrush, mayChange: true } });
    await settle();

    click(action(host, "assign"));
    await settle();

    const button = action(host, "assign");
    assert.equal(button.getAttribute("aria-busy"), "true");
    assert.equal(button.getAttribute("aria-disabled"), "true");
    assert.equal(host.querySelector(".wx-assignment-actions").getAttribute("aria-busy"), "true");

    click(button);
    await settle();
    assert.equal(net.writes().length, 1, "a second click while busy sends nothing");

    net.held.forEach((resolve) => resolve());
    await settle();

    assert.equal(action(host, "unassign").hasAttribute("aria-busy"), false);
    assert.equal(name(host), "Guybrush Threepwood");
});

test("a refused change leaves the row as it was and shows the reason", async () => {
    const net = endpoint({}, { refuse: "<b>LeChuck</b> takes no orders" });
    const { host, popups, events } = mount(net, { seed: { assignee: PEOPLE.elaine, self: PEOPLE.guybrush, mayChange: true } });
    await settle();

    click(action(host, "assign"));
    await settle();

    assert.equal(name(host), "Elaine Marley", "the stored assignee stays");
    assert.ok(action(host, "assign"), "the action is offered again");
    assert.equal(action(host, "assign").hasAttribute("aria-busy"), false);
    assert.equal(popups.length, 1);
    assert.equal(popups[0].notification.type, "alert-danger");
    assert.equal(popups[0].notification.message, "&lt;b&gt;LeChuck&lt;/b&gt; takes no orders");
    assert.equal(events.changed.length, 0, "nothing changed, so nothing is announced");
    assert.equal(events.errors.length, 1);
    assert.equal(events.errors[0].action, "assign");
});

test("a forbidden change explains itself and loads the state again", async () => {
    const net = endpoint({ assignee: PEOPLE.elaine, mayChange: false }, { status: 403 });
    const { host, popups } = mount(net, { seed: { assignee: PEOPLE.elaine, self: PEOPLE.guybrush, mayChange: true } });
    await settle();

    click(action(host, "assign"));
    await settle();

    assert.equal(popups.length, 1);
    assert.equal(popups[0].notification.message, "You may not change the assignee.");
    assert.equal(net.calls.filter((c) => c.method === "GET").length, 1, "the state is loaded again");
    assert.equal(action(host, "assign"), null, "the right is gone, so the action is gone");
    assert.equal(name(host), "Elaine Marley");
});

test("assign to someone else searches the users service and assigns the choice", async () => {
    const net = endpoint({});
    const { host, events } = mount(net, { users: true, seed: { assignee: PEOPLE.guybrush, self: PEOPLE.guybrush, mayChange: true } });
    await settle();

    const pick = action(host, "pick");
    assert.equal(pick.getAttribute("aria-expanded"), "false");
    click(pick);
    await settle();

    const picker = host.querySelector(".wx-assignment-picker");
    assert.equal(picker.style.display, "flex");
    assert.equal(pick.getAttribute("aria-expanded"), "true");
    assert.ok(host.querySelector(".wx-assignment-search").getAttribute("aria-label"), "the search field is named");

    const offered = host.querySelectorAll("[data-wx-assignment-user]").map((el) => el.getAttribute("data-wx-assignment-user"));
    assert.deepEqual(offered, ["elaine", "stan"], "the current assignee is not offered");

    click(host.querySelector('[data-wx-assignment-user="stan"]'));
    await settle();

    const writes = net.writes();
    assert.equal(writes.length, 1);
    assert.equal(writes[0].method, "PUT");
    assert.deepEqual(writes[0].body, { userId: "stan" });
    assert.equal(name(host), "Stan S. Stanman");
    assert.equal(host.querySelector(".wx-assignment-picker").style.display, "none");
    assert.equal(events.changed[0].assignee.id, "stan");
    assert.equal(events.changed[0].previous.id, "guybrush");
});

test("escape closes the picker", async () => {
    const net = endpoint({});
    const { host } = mount(net, { users: true, seed: { assignee: null, self: PEOPLE.guybrush, mayChange: true } });
    await settle();

    click(action(host, "pick"));
    await settle();

    const picker = host.querySelector(".wx-assignment-picker");
    picker.dispatchEvent({ type: "keydown", key: "Escape", target: picker });
    await settle();

    assert.equal(picker.style.display, "none");
    assert.equal(net.writes().length, 0);
});

test("a read-only row offers no action even with the right", async () => {
    const net = endpoint({});
    const { host } = mount(net, {
        users: true,
        attributes: { "data-readonly": "true" },
        seed: { assignee: PEOPLE.elaine, self: PEOPLE.guybrush, mayChange: true }
    });
    await settle();

    assert.equal(host.querySelector(".wx-assignment-actions"), null);
    assert.equal(host.querySelector(".wx-assignment-picker"), null);
});

test("a row without the right offers no action", async () => {
    const net = endpoint({});
    const { host } = mount(net, { users: true, seed: { assignee: PEOPLE.elaine, self: PEOPLE.guybrush, mayChange: false } });
    await settle();

    assert.equal(host.querySelector(".wx-assignment-actions"), null);
});

test("texts the server overrode replace the defaults", async () => {
    const net = endpoint({});
    const { host } = mount(net, {
        attributes: { "data-caption": "Owner", "data-placeholder": "Nobody yet", "data-assign-to-me": "Take it" },
        seed: { assignee: null, self: PEOPLE.guybrush, mayChange: true }
    });
    await settle();

    assert.equal(host.querySelector(".wx-assignment-caption").textContent, "Owner");
    assert.equal(name(host), "Nobody yet");
    assert.equal(action(host, "assign").textContent, "Take it");
    assert.equal(host.hasAttribute("data-caption"), false, "the configuration is consumed");
});

/**
 * Mounts a ViewState that owns the assignment resource and the users service, and the given
 * number of rows bound to that resource.
 */
async function mountBound(net, rows = 1) {
    const rt = loadControl({
        file: "webexpress.webapp.assignment.js",
        deps: ["webexpress.webapp.assignment.model.js"],
        fetch: net.fetch
    });
    rt.wxapp.MessageQueue = { dispatchLocal() { } };

    const scope = rt.createElement("div");
    scope.setAttribute("data-wx-viewstate", "issue");
    scope.dataset.wxViewstate = "issue";
    appendServiceIsland(rt.document, scope, { name: "data", baseUri: "/api/assignment/quest", method: "GET", updateMethod: "PUT" });
    appendServiceIsland(rt.document, scope, { name: "users", baseUri: "/api/users", method: "GET" });
    appendResourceIsland(rt.document, scope, { name: "assignee", service: "data", target: "assignee" });
    rt.document.body.appendChild(scope);
    const viewState = new rt.wxapp.ViewState(scope);

    const hosts = [];
    const ctrls = [];
    for (let i = 0; i < rows; i++) {
        const host = rt.createElement("div");
        host.setAttribute("data-wx-resource", "assignee");
        host.setAttribute("data-wx-users", "users");
        host.dataset.wxResource = "assignee";
        scope.appendChild(host);
        hosts.push(host);
        ctrls.push(new rt.wxapp.AssignmentCtrl(host));
    }

    await settle();
    return { rt, viewState, hosts, ctrls };
}

test("a bound row renders the slice its ViewState loaded and searches through the ViewState users service", async () => {
    const net = endpoint({ assignee: PEOPLE.elaine });
    const { viewState, hosts, ctrls } = await mountBound(net);

    const reads = net.calls.filter((c) => c.method === "GET");
    assert.equal(reads.length, 1, "the ViewState loaded the resource centrally");
    assert.equal(name(hosts[0]), "Elaine Marley");
    assert.equal(ctrls[0]._users, viewState.useService("users"));
    assert.ok(action(hosts[0], "pick"), "the search is offered through the users binding");
    assert.ok(action(hosts[0], "assign"));
});

test("a change of a bound row goes through the ViewState service and re-queries the resource for every bound row", async () => {
    const net = endpoint({ assignee: PEOPLE.elaine });
    const { hosts } = await mountBound(net, 2);

    click(action(hosts[0], "assign"));
    await settle();

    const writes = net.writes();
    assert.equal(writes.length, 1);
    assert.equal(writes[0].method, "PUT");
    assert.ok(writes[0].url.includes("/api/assignment/quest"), "the write targets the ViewState's service");
    assert.equal(net.calls.filter((c) => c.method === "GET").length, 2, "the resource is re-queried after the write");
    assert.equal(name(hosts[0]), "Guybrush Threepwood");
    assert.equal(name(hosts[1]), "Guybrush Threepwood", "the sibling row follows");
    assert.ok(action(hosts[1], "unassign"));
});

test("an unassign of a bound row reaches the sibling through the re-query", async () => {
    const net = endpoint({ assignee: PEOPLE.guybrush });
    const { hosts } = await mountBound(net, 2);

    click(action(hosts[1], "unassign"));
    await settle();

    assert.equal(net.writes()[0].method, "DELETE");
    assert.equal(name(hosts[0]), "Unassigned");
    assert.equal(name(hosts[1]), "Unassigned");
    assert.equal(hosts[0].classList.contains("wx-assignment-empty"), true);
});
