import { test } from "node:test";
import assert from "node:assert/strict";
import { loadControl } from "./controls.harness.mjs";

/** @returns {object} A runtime containing the shipped table extensions. */
function runtime() {
    return loadControl({ deps: ["webexpress.webapp.restform.model.js", "webexpress.webapp.table.model.js", "webexpress.webapp.table.inlineedit.js"], file: "webexpress.webapp.table.js" });
}
/**
 * Builds the result the service layer reports for a refused RestApiCrud write: the body is
 * the bare array RestApiValidationResult.ToJson writes, the message the generic http text.
 * @param {Array<object>} errors The validation errors.
 * @returns {object} The normalised failure result.
 */
function refused(errors) {
    return { ok: false, status: 400, data: errors, error: { kind: "http", status: 400, message: "request failed with status 400", retriable: false } };
}
/**
 * Opens the inline editor of a fresh body cell.
 * @param {object} rt The runtime.
 * @param {object} table The owning table stub.
 * @param {object} cell The cell model.
 * @returns {{host: HTMLElement, input: HTMLElement, save: HTMLButtonElement}} The open editor.
 */
function openEditor(rt, table, cell) {
    const host = rt.wx.TableTemplates.get("inline-edit").fn(cell.content, table, { id: "a&b", restApi: "/api/item" }, cell, "body", { editor: "textarea" });
    rt.document.body.appendChild(host);
    host.querySelector("button").dispatchEvent(click());
    return { host, input: host.querySelector("textarea"), save: host.querySelectorAll("button")[1] };
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
        return success ? { ok: true } : refused([{ code: null, message: "Rejected value", field: "body" }]);
    };
    const cell = { content: "old" };
    const { host, input, save } = openEditor(rt, { update() { refresh++; } }, cell);
    const value = 'a;b & c + \"quoted\"\n<text> 😀';
    input.value = value;
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

test("inline editing shows the field and general messages of a RestApiCrud 400 and keeps the entry", async () => {
    const rt = runtime();
    rt.document.baseURI = "https://example.test/";
    let refresh = 0;
    rt.wxapp.ServiceRegistry.request = async () => refused([
        { code: "length", message: "Body is too long", field: "Body" },
        { code: null, message: "The item is locked.", field: null },
        { code: "range", message: "Due date is in the past", field: "due" }
    ]);
    const cell = { content: "old" };
    const { host, input, save } = openEditor(rt, { update() { refresh++; } }, cell);
    input.value = "x".repeat(300);
    save.dispatchEvent(click());
    await settle();
    const alert = host.querySelector('[role="alert"]');
    assert.equal(alert.textContent, "Body is too long The item is locked.", "the field's own and the general messages, not another field's");
    assert.doesNotMatch(alert.textContent, /status 400/);
    assert.equal(input.getAttribute("aria-invalid"), "true");
    assert.equal(input.value, "x".repeat(300), "the refused entry stays editable");
    assert.equal(cell.content, "old");
    assert.equal(refresh, 0);
});

test("inline editing shows a general-only refusal without marking the field invalid", async () => {
    const rt = runtime();
    rt.document.baseURI = "https://example.test/";
    rt.wxapp.ServiceRegistry.request = async () => refused([{ code: null, message: "The item is locked.", field: null }]);
    const { host, input, save } = openEditor(rt, { update() {} }, { content: "old" });
    input.value = "new";
    save.dispatchEvent(click());
    await settle();
    assert.equal(host.querySelector('[role="alert"]').textContent, "The item is locked.");
    assert.equal(input.getAttribute("aria-invalid"), "false");
    assert.equal(input.value, "new");
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
