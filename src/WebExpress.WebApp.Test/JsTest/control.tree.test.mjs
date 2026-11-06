/**
 * Headless tests for the REST-backed tree (wx-webapp-tree): one level per expansion, the
 * expansion kept across reloads, a node revealed from a single answer, the ARIA tree keys and
 * a move through the drag-and-drop protocol.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { contract } from "./controls.contract.mjs";
import { loadControl } from "./controls.harness.mjs";
import { appendServiceIsland } from "./harness.mjs";

contract({
    file: "webexpress.webapp.tree.js",
    selector: "wx-webapp-tree",
    ctrl: "TreeCtrl"
});

const NODES = {
    "": [{ id: "a", label: "A", hasChildren: true }, { id: "b", label: "B" }],
    a: [{ id: "a1", label: "A1", hasChildren: true }, { id: "a2", label: "A2", droppable: false }],
    a1: [{ id: "a11", label: "A11" }]
};

/**
 * Builds a tree whose endpoint answers from NODES and records every request.
 * @param {object} [options={}] - movable, selected, expanded, nodes the endpoint answers from, and
 * storage, the local storage of an earlier page load.
 * @returns {object} The runtime, the host, the control, the requests and the nodes.
 */
function tree(options = {}) {
    const rt = loadControl({ file: "webexpress.webapp.tree.js", extraGlobals: options.storage ? { localStorage: options.storage } : {} });
    const requests = [];
    const nodes = options.nodes || JSON.parse(JSON.stringify(NODES));

    rt.setFetch(async (url, init) => {
        const parsed = new URL(url, "http://localhost/");
        const method = (init && init.method) || "GET";
        requests.push({ method, url: parsed.pathname + parsed.search, body: init && init.body ? JSON.parse(init.body) : null });

        let data;
        if (method === "PUT") {
            data = options.refuseMove ? { error: "refused" } : {};
        } else if (parsed.searchParams.has("reveal")) {
            data = { path: ["a", "a1", "a11"], levels: { "": NODES[""], a: NODES.a, a1: NODES.a1 } };
        } else {
            data = nodes[parsed.searchParams.get("node") || ""] || [];
        }
        const ok = !(method === "PUT" && options.refuseMove);
        // a fresh body per call, since a test may change what it got
        return { ok, status: ok ? 200 : 400, headers: { get: () => "application/json" }, json: async () => JSON.parse(JSON.stringify(data)) };
    });

    const element = rt.createElement("div");
    element.id = "pages";
    appendServiceIsland(rt.document, element, { name: "data", kind: "rest", baseUri: "/api/pages", method: "GET", updateMethod: "PUT" });
    if (options.movable) {
        element.setAttribute("data-movable", "true");
    }
    if (options.selected) {
        element.setAttribute("data-selected", options.selected);
    }
    if (options.expanded) {
        element.setAttribute("data-expanded", JSON.stringify(options.expanded));
    }
    rt.document.body.appendChild(element);

    const ctrl = new rt.wxapp.TreeCtrl(element);
    return { rt, element, ctrl, requests, nodes };
}

/**
 * Lets the requests and the renders run.
 * @returns {Promise<void>} Resolves after a macrotask.
 */
const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

const items = (element) => Array.from(element.querySelectorAll("[role=\"treeitem\"]"));
const item = (element, id) => items(element).find((x) => x.getAttribute("data-wx-node") === id);

test("the tree loads its first level and renders it as an ARIA tree", async () => {
    const { element, requests } = tree();
    await settle();

    assert.deepEqual(requests.map((x) => x.url), ["/api/pages"]);
    assert.deepEqual(items(element).map((x) => x.getAttribute("data-wx-node")), ["a", "b"]);
    const a = item(element, "a");
    assert.equal(a.getAttribute("aria-level"), "1");
    assert.equal(a.getAttribute("aria-setsize"), "2");
    assert.equal(a.getAttribute("aria-expanded"), "false");
    assert.equal(a.getAttribute("tabindex"), "0", "the first node is the tab stop");
    assert.equal(item(element, "b").hasAttribute("aria-expanded"), false, "a leaf is no expandable item");
});

test("opening a node loads its level once, and a reload keeps the expansion", async () => {
    const { element, ctrl, requests } = tree();
    await settle();

    await ctrl.toggle("a");
    await settle();
    assert.equal(requests[1].url, "/api/pages?node=a");
    assert.equal(item(element, "a").getAttribute("aria-expanded"), "true");
    assert.equal(item(element, "a1").getAttribute("aria-level"), "2");

    await ctrl.toggle("a");
    await ctrl.toggle("a");
    assert.equal(requests.length, 2, "a level that was loaded is not asked for again");

    await ctrl.load();
    await settle();
    assert.deepEqual(requests.slice(2).map((x) => x.url), ["/api/pages", "/api/pages?node=a"]);
    assert.ok(item(element, "a1"), "the reload opened the level again");
});

test("a branch closed during a reload is asked for again when it opens", async () => {
    const { element, ctrl, requests, nodes } = tree();
    await settle();
    await ctrl.toggle("a");
    await ctrl.toggle("a");

    // the server changes the children of the closed branch, and a data change reloads the tree
    nodes.a = [{ id: "a3", label: "A3" }];
    await ctrl.load();
    await ctrl.toggle("a");
    await settle();

    assert.equal(requests.filter((x) => x.url === "/api/pages?node=a").length, 2);
    assert.ok(item(element, "a3"), "the branch shows what the server holds now");
    assert.equal(item(element, "a1"), undefined);
});

test("reopening a branch also loads the open branches below it", async () => {
    const { element, ctrl } = tree({ expanded: ["a", "a1"] });
    await settle();
    await ctrl.toggle("a", false);
    await ctrl.load();
    await ctrl.toggle("a", true);
    await settle();

    assert.ok(item(element, "a11"), "the open branch below is loaded with it");
});

test("the expansion the user left is opened again on the next page load", async () => {
    const first = tree();
    await settle();
    await first.ctrl.toggle("a");
    await first.ctrl.toggle("a1");

    const second = tree({ storage: first.rt.sandbox.localStorage });
    await settle();

    assert.equal(item(second.element, "a").getAttribute("aria-expanded"), "true");
    assert.ok(item(second.element, "a11"));
    assert.deepEqual(second.requests.map((x) => x.url), ["/api/pages", "/api/pages?node=a", "/api/pages?node=a1"]);
});

test("an expansion handed in by the server opens from the top down", async () => {
    const { element, requests } = tree({ expanded: ["a1", "a"] });
    await settle();

    assert.deepEqual(requests.map((x) => x.url), ["/api/pages", "/api/pages?node=a", "/api/pages?node=a1"]);
    assert.ok(item(element, "a11"));
});

test("a selected node below the first level is revealed with one request", async () => {
    const { element, ctrl, requests } = tree({ selected: "a11" });
    await settle();

    assert.deepEqual(requests.map((x) => x.url), ["/api/pages", "/api/pages?reveal=a11"]);
    assert.equal(ctrl.value, "a11");
    assert.equal(item(element, "a11").getAttribute("aria-selected"), "true");
    assert.equal(item(element, "a11").getAttribute("tabindex"), "0", "the selected node is the tab stop");
    assert.equal(item(element, "a").getAttribute("aria-expanded"), "true");
    assert.equal(item(element, "a1").getAttribute("aria-expanded"), "true");
});

test("the arrow keys walk, open and close the nodes", async () => {
    const { element } = tree();
    await settle();
    const key = (target, k) => element.dispatchEvent({ type: "keydown", key: k, target, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } });

    key(item(element, "a"), "ArrowRight");
    await settle();
    assert.equal(item(element, "a").getAttribute("aria-expanded"), "true");

    key(item(element, "a"), "ArrowDown");
    assert.equal(item(element, "a1").getAttribute("tabindex"), "0");

    key(item(element, "a1"), "ArrowLeft");
    assert.equal(item(element, "a").getAttribute("tabindex"), "0", "left on a closed node goes to its parent");

    key(item(element, "a"), "ArrowLeft");
    await settle();
    assert.equal(item(element, "a").getAttribute("aria-expanded"), "false");
});

test("Enter and Space open and close a node with children, and select it", async () => {
    const { element, ctrl } = tree();
    await settle();
    const key = (target, k) => {
        const event = { type: "keydown", key: k, target, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
        element.dispatchEvent(event);
        return event.defaultPrevented;
    };

    assert.equal(key(item(element, "a"), "Enter"), true, "the key is taken, so the button does not click as well");
    await settle();
    assert.equal(item(element, "a").getAttribute("aria-expanded"), "true");
    assert.equal(ctrl.value, "a");

    key(item(element, "a"), " ");
    await settle();
    assert.equal(item(element, "a").getAttribute("aria-expanded"), "false");

    assert.equal(key(item(element, "b"), "Enter"), false, "a leaf leaves the key to its button");
});

test("the asterisk opens every sibling of the focused node", async () => {
    const { element, requests } = tree({ expanded: ["a"] });
    await settle();
    element.dispatchEvent({ type: "keydown", key: "*", target: item(element, "a1"), defaultPrevented: false, preventDefault() { } });
    await settle();

    assert.equal(item(element, "a1").getAttribute("aria-expanded"), "true");
    assert.ok(requests.some((x) => x.url === "/api/pages?node=a1"));
});

test("a node is not moved into its own subtree, nor into a node that takes no children", async () => {
    const { element, ctrl } = tree({ movable: true, expanded: ["a"] });
    await settle();
    const check = (target) => {
        const event = {
            type: "webexpress.webui.drop.check",
            detail: { sources: [{ id: "a", kind: "tree-node" }], origin: item(element, "a"), target: { id: target, kind: "tree-node", position: "into" }, effect: "move" },
            defaultPrevented: false,
            preventDefault() { this.defaultPrevented = true; }
        };
        element.dispatchEvent(event);
        return !event.defaultPrevented;
    };

    assert.equal(check("a1"), false);
    assert.equal(check("b"), true);
    assert.equal(item(element, "a2").getAttribute("data-wx-drop-into"), "false");
    assert.equal(item(element, "a").getAttribute("data-wx-drag"), "a");
    assert.ok(ctrl);
});

/**
 * Drops a node of a tree, as the drag-and-drop protocol announces it.
 * @param {object} element - The host the drop event is dispatched on.
 * @param {object} origin - The element the drag started on.
 * @param {object} detail - sources, target and effect.
 */
function drop(element, origin, detail) {
    element.dispatchEvent({
        type: "webexpress.webui.drop",
        detail: Object.assign({ effect: "move", origin: origin }, detail),
        stopPropagation() { }
    });
}

test("a dropped node moves, announces the move and the touched levels are read back", async () => {
    const { rt, element, ctrl, requests } = tree({ movable: true, expanded: ["a"] });
    await settle();
    const moves = [];
    const saves = [];
    element.addEventListener(rt.wx.Event.MOVE_EVENT, (e) => moves.push(e.detail));
    for (const name of ["BEFORE_SAVE_EVENT", "TASK_START_EVENT", "TASK_FINISH_EVENT", "SAVED_EVENT"]) {
        element.addEventListener(rt.wx.Event[name], () => saves.push(name));
    }

    drop(element, item(element, "b"), { sources: [{ id: "b", kind: "tree-node" }], target: { id: "a2", kind: "tree-node", position: "above" } });
    ctrl.store.flush();
    assert.deepEqual(items(element).map((x) => x.getAttribute("data-wx-node")), ["a", "a1", "b", "a2"], "the node moves at once");
    await settle();

    assert.deepEqual(moves.map((x) => [x.node, x.target, x.position]), [["b", "a2", "above"]]);
    assert.deepEqual(saves, ["TASK_START_EVENT", "BEFORE_SAVE_EVENT", "SAVED_EVENT", "TASK_FINISH_EVENT"]);
    const put = requests.find((x) => x.method === "PUT");
    assert.deepEqual(put.body, { node: "b", target: "a2", position: "above" });
    assert.deepEqual(requests.slice(-2).map((x) => x.url).sort(), ["/api/pages", "/api/pages?node=a"]);
});

test("a vetoed move sends nothing and the tree reads the stored state back", async () => {
    const { rt, element, requests } = tree({ movable: true });
    await settle();
    element.addEventListener(rt.wx.Event.BEFORE_SAVE_EVENT, (e) => e.preventDefault());
    const errors = [];
    element.addEventListener(rt.wx.Event.DATA_ERROR_EVENT, (e) => errors.push(e.detail.action));

    drop(element, item(element, "b"), { sources: [{ id: "b", kind: "tree-node" }], target: { id: "a", kind: "tree-node", position: "above" } });
    await settle();

    assert.equal(requests.filter((x) => x.method === "PUT").length, 0);
    assert.deepEqual(errors, [], "a veto is no failure");
    assert.equal(requests[requests.length - 1].url, "/api/pages");
    assert.deepEqual(items(element).map((x) => x.getAttribute("data-wx-node")), ["a", "b"]);
});

test("a move the endpoint refuses is reported and the tree reads the truth back", async () => {
    const { rt, element, requests } = tree({ movable: true, refuseMove: true });
    await settle();
    const errors = [];
    element.addEventListener(rt.wx.Event.DATA_ERROR_EVENT, (e) => errors.push(e.detail.action));

    drop(element, item(element, "b"), { sources: [{ id: "b", kind: "tree-node" }], target: { id: "a", kind: "tree-node", position: "above" } });
    await settle();

    assert.deepEqual(errors, ["move"]);
    assert.equal(requests[requests.length - 1].url, "/api/pages");
    assert.deepEqual(items(element).map((x) => x.getAttribute("data-wx-node")), ["a", "b"]);
});

test("a drop of other items, a copy or a drag from another tree is left to the page", async () => {
    const first = tree({ movable: true });
    const second = tree({ movable: true });
    await settle();
    const moves = [];
    first.element.addEventListener(first.rt.wx.Event.MOVE_EVENT, (e) => moves.push(e.detail));

    const target = { id: "a", kind: "tree-node", position: "into" };
    drop(first.element, item(first.element, "b"), { sources: [{ id: "row-1", kind: "row" }], target });
    drop(first.element, item(first.element, "b"), { sources: [{ id: "b", kind: "tree-node" }], target, effect: "copy" });
    // the other tree holds the same ids, which alone would read as a node of this tree
    drop(first.element, item(second.element, "b"), { sources: [{ id: "b", kind: "tree-node" }], target });
    drop(first.element, null, { sources: [{ id: "b", kind: "tree-node" }], target });
    await settle();

    assert.deepEqual(moves, []);
    assert.equal(first.requests.filter((x) => x.method === "PUT").length, 0);
});

test("choosing a node announces the new value, clearing it too, choosing it again nothing", async () => {
    const { rt, element, ctrl } = tree({ expanded: ["a"] });
    await settle();
    const values = [];
    element.addEventListener(rt.wx.Event.CHANGE_VALUE_EVENT, (e) => values.push(e.detail.value));

    await ctrl.select("a1");
    await ctrl.select("a1");
    ctrl.value = null;
    await settle();

    assert.deepEqual(values, ["a1", null]);
    assert.equal(ctrl.value, null);
});

test("a loaded node below a closed one is shown when it is selected", async () => {
    const { element, ctrl, requests } = tree({ expanded: ["a"] });
    await settle();
    await ctrl.toggle("a", false);
    const before = requests.length;

    await ctrl.select("a1");
    ctrl.store.flush();

    assert.equal(requests.length, before, "the ancestors are loaded, they are only opened");
    assert.equal(item(element, "a").getAttribute("aria-expanded"), "true");
    assert.equal(item(element, "a1").getAttribute("aria-selected"), "true");
});

test("closing the parent of the tab stop hands the tab stop to the parent", async () => {
    const { element, ctrl } = tree({ expanded: ["a"] });
    await settle();
    await ctrl.select("a1");
    ctrl.store.flush();
    assert.equal(item(element, "a1").getAttribute("tabindex"), "0");

    await ctrl.toggle("a", false);
    ctrl.store.flush();

    assert.equal(item(element, "a").getAttribute("tabindex"), "0", "a shown node keeps the tree reachable by tab");
    assert.equal(items(element).filter((x) => x.getAttribute("tabindex") === "0").length, 1);
});

/**
 * Records which tree items are scrolled into view.
 * @param {object} element - The host of the tree.
 * @returns {Array<string>} The ids of the scrolled items, filled as they scroll.
 */
function trackScroll(element) {
    const scrolled = [];
    const proto = Object.getPrototypeOf(element);
    proto.scrollIntoView = function (options) {
        scrolled.push([this.getAttribute("data-wx-node"), options && options.block]);
    };
    return scrolled;
}

test("a revealed node and a node the keys move to are scrolled into view, the nearest way", async () => {
    const { element, ctrl } = tree({ expanded: ["a"] });
    await settle();
    const scrolled = trackScroll(element);

    await ctrl.reveal("a11");
    assert.deepEqual(scrolled.map((x) => x[0]), ["a11"], "the node is found once its level is rendered");

    element.dispatchEvent({ type: "keydown", key: "ArrowDown", target: item(element, "a11"), defaultPrevented: false, preventDefault() { } });
    assert.deepEqual(scrolled[scrolled.length - 1], ["a2", "nearest"]);
});

test("selecting a loaded node below a closed one scrolls it into view", async () => {
    const { element, ctrl } = tree({ expanded: ["a"] });
    await settle();
    await ctrl.toggle("a", false);
    const scrolled = trackScroll(element);

    await ctrl.select("a2");

    assert.deepEqual(scrolled.map((x) => x[0]), ["a2"]);
});
