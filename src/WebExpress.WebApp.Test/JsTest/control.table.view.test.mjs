/**
 * Headless tests for the view of the REST table (wx-webapp-table) and the permission
 * surface built on it (wx-webapp-permission): the host - progress, table, info line and
 * toolbar - renders from the table's own ViewState, a reload patches the rows, inside a
 * ViewState region the query belongs to the region while the view state stays the
 * table's, and the mount is announced the way the Data base does.
 */
import { test } from "node:test";
import assert from "node:assert";
import { loadControl } from "./controls.harness.mjs";
import { appendServiceIsland, appendStateIsland, appendResourceIsland } from "./harness.mjs";

const RESPONSE = {
    columns: [{ id: "name", label: "Name", visible: true }, { id: "role", label: "Role", visible: true }],
    rows: [
        { id: "r1", cells: [{ content: "Grace" }, { content: "Developer" }] },
        { id: "r2", cells: [{ content: "Emma" }, { content: "Manager" }] }
    ],
    total: 2
};

/**
 * Loads the runtime with the REST table.
 * @returns {object} The runtime.
 */
function load() {
    return loadControl({ deps: ["webexpress.webapp.table.model.js"], file: "webexpress.webapp.table.js" });
}

/**
 * Drains the queues, so the load and the batched render have completed.
 * @returns {Promise<void>} Resolves once the queues are drained.
 */
async function settle() {
    for (let round = 0; round < 5; round++) {
        for (let i = 0; i < 40; i++) {
            await Promise.resolve();
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
}

/**
 * Answers every query with a copy of the response the test holds, once the test
 * releases it.
 * @param {object} rt - The runtime.
 * @returns {object} The holder: response, release() and the number of queries.
 */
function server(rt) {
    const holder = { response: RESPONSE, queries: 0, pending: [] };
    holder.release = () => holder.pending.splice(0).forEach((resolve) => resolve());
    rt.setFetch(async () => {
        holder.queries += 1;
        await new Promise((resolve) => holder.pending.push(resolve));
        const body = JSON.parse(JSON.stringify(holder.response));
        return { ok: true, status: 200, json: async () => body };
    });
    return holder;
}

/**
 * Builds a standalone REST table host with a data service island.
 * @param {object} rt - The runtime.
 * @returns {object} The host element.
 */
function host(rt) {
    const element = rt.createElement("div");
    element.id = "crew";
    element.classList.add("wx-webapp-table");
    appendServiceIsland(rt.document, element, { name: "data", kind: "rest", baseUri: "/api/crew", method: "GET" });
    rt.document.body.appendChild(element);
    return element;
}

const rowIds = (table) => table._body.children.filter((el) => el._dataRowRef).map((el) => el._dataRowRef.id);

test("the host renders from the table's state: progress, table and info line", async () => {
    const rt = load();
    const net = server(rt);
    const element = host(rt);
    const table = new rt.wxapp.TableCtrl(element);
    await settle();

    const [progress, tableEl, info] = element.children;
    assert.ok(table.store instanceof rt.wxapp.ViewState, "the table's state is a ViewState of its own");
    assert.equal(table._store, table.store, "standalone, the query lives beside the view state");
    assert.equal(tableEl, table._table);
    assert.match(progress.style.cssText, /visibility: visible/, "the first load is on its way");
    assert.ok(tableEl.classList.contains("placeholder-glow"), "the placeholders shimmer");
    assert.equal(info, table._infoDiv);
    assert.ok(info.textContent.length > 0, "the info line names the page on its way");

    net.release();
    await settle();

    assert.match(progress.style.cssText, /visibility: hidden/);
    assert.equal(tableEl.classList.contains("placeholder-glow"), false);
    assert.ok(tableEl.classList.contains("wx-table"), "the table keeps the classes the base gave it");
    assert.deepEqual(rowIds(table), ["r1", "r2"]);
    assert.ok(info.textContent.includes("2"), "the info line reports the loaded window");
    assert.equal(element.children.length, 3, "nothing else gathers in the host");
});

test("a reload patches the rows: they keep their nodes and a changed one flashes", async () => {
    const rt = load();
    const net = server(rt);
    const table = new rt.wxapp.TableCtrl(host(rt));
    net.release();
    await settle();
    const nodes = table._rows.map((row) => row._anchorTr);

    net.response = JSON.parse(JSON.stringify(RESPONSE));
    net.response.rows[1].cells[1].content = "Senior Manager";
    const reload = table._load();
    net.release();
    await reload;
    await settle();

    assert.equal(net.queries, 2);
    assert.ok(table._rows.every((row, i) => row._anchorTr === nodes[i]), "the row nodes stay");
    assert.ok(table._rows[1]._anchorTr.classList.contains("wx-change-flash"));
    assert.equal(table._rows[0]._anchorTr.classList.contains("wx-change-flash"), false);
});

test("inside a ViewState region the query belongs to the region and the view state stays the table's", async () => {
    const rt = load();
    rt.setFetch(async () => ({ ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(RESPONSE)) }));

    const region = rt.createElement("div");
    region.dataset.wxViewstate = "crew";
    appendStateIsland(rt.document, region, { page: 0, search: "" });
    appendServiceIsland(rt.document, region, {
        name: "data", kind: "rest", baseUri: "/api/crew", method: "GET",
        query: { search: "q" }, response: { rows: "rows", total: "total" }
    });
    appendResourceIsland(rt.document, region, {
        name: "crew", service: "data", target: "crew", params: [{ name: "search", state: "search", dir: "out" }]
    });
    rt.document.body.appendChild(region);
    const viewState = new rt.wxapp.ViewState(region);

    const element = rt.createElement("div");
    element.dataset.wxResource = "crew";
    region.appendChild(element);
    const table = new rt.wxapp.TableCtrl(element);
    await viewState.load("crew");
    await settle();

    table.search("ela");
    await settle();

    assert.equal(table.store, viewState, "binds and intents address the region");
    assert.equal(viewState.getState().search, "ela");
    assert.deepEqual(rowIds(table), ["r1", "r2"]);
    assert.equal(table.state.total, 2, "the total of the slice is the table's own");
    for (const key of ["rows", "columns", "selected", "loading"]) {
        assert.equal(key in viewState.getState(), false, `the region holds no ${key} of the table`);
    }
});

test("the mount is announced once the constructor has returned, so a bind finds the table", async () => {
    const rt = load();
    server(rt);
    const element = host(rt);
    const seen = [];
    // the stub does not bubble, so the announcement is heard on the host itself
    element.addEventListener("webexpress.webapp.data.mount", (event) => {
        seen.push(event.detail.component);
    });

    const table = new rt.wxapp.TableCtrl(element);
    assert.equal(seen.length, 0, "not while the constructor runs");

    await settle();
    assert.deepEqual(seen, [table]);
});

test("the permission toolbar renders from the directories and survives a reload", async () => {
    const rt = loadControl({
        deps: ["webexpress.webapp.table.model.js", "webexpress.webapp.table.js", "webexpress.webapp.permission.model.js"],
        file: "webexpress.webapp.permission.js"
    });
    const directories = [];
    rt.setFetch(async (url) => {
        if (url.includes("/api/groups")) {
            await new Promise((resolve) => directories.push(resolve));
            return { ok: true, status: 200, json: async () => [{ id: "g1", name: "Developers" }] };
        }
        if (url.includes("/api/policies")) {
            return { ok: true, status: 200, json: async () => [] };
        }
        return { ok: true, status: 200, json: async () => ({ items: [{ groupId: "g1", groupName: "Developers", policyIds: [] }], total: 1, assignedGroupIds: ["g1"] }) };
    });

    const element = rt.createElement("div");
    element.id = "permissions";
    element.dataset.title = "Access";
    for (const [name, baseUri] of [["data", "/api/permissions"], ["groups", "/api/groups"], ["policies", "/api/policies"]]) {
        appendServiceIsland(rt.document, element, { name, kind: "rest", baseUri, method: "GET" });
    }
    rt.document.body.appendChild(element);
    const ctrl = new rt.wxapp.PermissionCtrl(element);
    await settle();

    const toolbar = ctrl._toolbar;
    const button = ctrl._assignButton;
    assert.equal(element.firstElementChild, toolbar);
    assert.equal(button.disabled, false, "a directory on its way exhausts nothing");

    directories.splice(0).forEach((resolve) => resolve());
    await settle();
    assert.equal(button.disabled, true, "the only group owns a row");
    assert.ok(button.title.length > 0);

    await ctrl._load();
    await settle();
    assert.equal(ctrl._toolbar, toolbar, "a reload patches the bar");
    assert.equal(ctrl._assignButton, button);
    assert.equal(element.firstElementChild, toolbar);
});
