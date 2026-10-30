import { test } from "node:test";
import assert from "node:assert/strict";
import { loadControl } from "./controls.harness.mjs";

/** @returns {object} A runtime containing the shipped table extensions. */
function runtime() {
    return loadControl({ deps: ["webexpress.webapp.table.model.js", "webexpress.webapp.table.inlineedit.js"], file: "webexpress.webapp.table.js" });
}
/** @returns {Promise<void>} Resolves after queued renders complete. */
async function settle() {
    for (let i = 0; i < 15; i++) await Promise.resolve();
}
/** @returns {object} A cancelable click event. */
function click() { return { type: "click", preventDefault() {}, stopPropagation() {} }; }

test("empty, loading and failed REST states remain distinct and retain column management", async () => {
    const rt = runtime();
    const element = rt.createElement("div");
    element.setAttribute("data-empty-text", "Nothing here");
    rt.document.body.appendChild(element);
    const table = new rt.wxapp.TableCtrl(element);
    table.updateData({ columns: [{ id: "a", visible: true }], rows: [], total: 0 });
    table.setState({ loading: false, error: null });
    await settle();
    assert.match(element.textContent, /Nothing here/);
    assert.ok(Array.from(element.querySelectorAll("button")).some(button => button.getAttribute("aria-label") === "Manage columns"));
    table.setState({ loading: true });
    await settle();
    assert.doesNotMatch(element.textContent, /Nothing here/);
    table.setState({ loading: false, error: { message: "failed" } });
    await settle();
    assert.doesNotMatch(element.textContent, /Nothing here/);
    assert.ok(element.querySelector('[role="alert"]'));
    table.destroy();
});

test("public layout round trips with new and removed columns and aligned nested cells", async () => {
    const rt = runtime();
    const element = rt.createElement("div");
    const table = new rt.wxapp.TableCtrl(element);
    table.updateData({ columns: [{ id: "a" }, { id: "b" }, { id: "new" }], rows: [
        { id: "parent", cells: [{ content: "A" }, { content: "B" }, { content: "N" }], children: [
            { id: "child", expanded: false, cells: [{ content: "a" }, { content: "b" }, { content: "n" }] }
        ] }
    ] });
    table.applyLayout({ version: 1, columns: [{ id: "b", visible: false, width: 120 }, { id: "removed" }, { id: "a", visible: true, width: null }] });
    await settle();
    const layout = JSON.parse(table.serializeLayout());
    assert.deepEqual(layout.columns.map(c => c.id), ["b", "a", "new"]);
    assert.equal(layout.columns[0].width, 120);
    assert.equal(layout.columns[0].visible, false);
    assert.deepEqual(Array.from(table._rows[0].children[0].cells, c => c.content), ["b", "a", "n"]);
    assert.equal(table._rows[0].children[0].expanded, false);
    assert.throws(() => table.applyLayout({ version: 1, columns: [{ id: "a", width: "bad" }] }));
    table.destroy();
});

test("inline editing sends exact JSON values, retains failures and refreshes after success", async () => {
    const rt = runtime();
    rt.document.baseURI = "https://example.test/";
    let request;
    let success = false;
    let refresh = 0;
    rt.wxapp.ServiceRegistry.request = async (url, init) => {
        request = { url, init };
        return success ? { ok: true } : { ok: false, data: { errors: [{ field: "body", message: "Rejected value" }] } };
    };
    const cell = { content: "old" };
    const renderer = rt.wx.TableTemplates.get("inline-edit");
    const host = renderer.fn("old", { update() { refresh++; } }, { id: "a&b", restApi: "/api/item" }, cell, "body", { editor: "textarea" });
    rt.document.body.appendChild(host);
    host.querySelector("button").dispatchEvent(click());
    const input = host.querySelector("textarea");
    const value = 'a;b & c + \"quoted\"\n<text> 😀';
    input.value = value;
    let save = host.querySelectorAll("button")[1];
    save.dispatchEvent(click());
    await settle();
    assert.equal(JSON.parse(request.init.body).body, value);
    assert.equal(new URL(request.url).searchParams.get("id"), "a&b");
    assert.match(host.textContent, /Rejected value/);
    assert.equal(input.value, value);
    assert.equal(refresh, 0);
    success = true;
    save.dispatchEvent(click());
    await settle();
    assert.equal(refresh, 1);
    assert.equal(cell.content, value);
    assert.equal(host.querySelector("textarea"), null);
});

test("layout can be restored before the first response and null width restores automatic sizing", () => {
    const rt = runtime();
    const table = new rt.wxapp.TableCtrl(rt.createElement("div"));
    table.applyLayout({ version: 1, columns: [{ id: "b", visible: false, width: null }, { id: "a", visible: true, width: 180 }] });
    table.updateData({ columns: [{ id: "a", width: 50 }, { id: "b", width: 90 }], rows: [] });
    const layout = JSON.parse(table.serializeLayout());
    assert.deepEqual(layout.columns.map(column => column.id), ["b", "a"]);
    assert.equal(layout.columns[0].width, null);
    assert.equal(layout.columns[1].width, 180);
    table.destroy();
});

/** Keeps nullable server visibility consistent with an omitted layout setting. */
test("server layout JSON preserves current visibility when visible is null", () => {
    const rt = runtime();
    const table = new rt.wxapp.TableCtrl(rt.createElement("div"));
    table.updateData({ columns: [{ id: "a", visible: false }, { id: "b", visible: true }], rows: [] });
    table.applyLayout('{"version":1,"columns":[{"id":"b","visible":null,"width":120},{"id":"a","visible":null,"width":null}]}');
    const layout = JSON.parse(table.serializeLayout());
    assert.deepEqual(layout.columns.map(column => column.id), ["b", "a"]);
    assert.deepEqual(layout.columns.map(column => column.visible), [true, false]);
    assert.equal(layout.columns[0].width, 120);
    table.destroy();
});
