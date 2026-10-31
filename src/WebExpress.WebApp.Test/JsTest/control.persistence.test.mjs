import { test } from "node:test";
import assert from "node:assert/strict";
import { loadControl } from "./controls.harness.mjs";

function load(name) {
    const rt = loadControl({ file: `webexpress.webapp.${name}.js`, deps: [`webexpress.webapp.${name}.model.js`] });
    const element = rt.createElement("div");
    element.id = `data-${name}`;
    rt.document.body.appendChild(element);
    return { rt, element };
}

test("REST lists apply remembered order after their items arrive", () => {
    const { rt, element } = load("list");
    rt.wx.LocalStorage.setJson("data-list", { v: 1, order: ["b", "a"] });
    const ctrl = new rt.wxapp.ListCtrl(element);
    ctrl.setItems([{ id: "a", content: "A" }, { id: "b", content: "B" }, { id: "c", content: "C" }]);
    assert.deepEqual(Array.from(ctrl._items, item => item.id), ["b", "a", "c"]);
    assert.equal(rt.document.cookie, "");
});

test("REST tiles apply remembered visibility and order after their items arrive", () => {
    const { rt, element } = load("tile");
    rt.wx.LocalStorage.setJson("data-tile", { v: 1, order: ["b", "a"], visible: ["b"] });
    const ctrl = new rt.wxapp.TileCtrl(element);
    ctrl.updateData({ items: [{ id: "a", label: "A" }, { id: "b", label: "B" }] });
    assert.deepEqual(Array.from(ctrl._tiles, tile => tile.id), ["b", "a"]);
    assert.deepEqual(Array.from(ctrl.getVisibleTiles(), tile => tile.id), ["b"]);
    assert.equal(rt.document.cookie, "");
});

test("REST tables restore layout when data arrives and keep cells aligned after refresh", () => {
    const { rt, element } = load("table");
    rt.wx.LocalStorage.setJson("data-table", {
        v: 1, order: ["b", "a"], cols: [{ id: "b", width: 240 }, { id: "a", visible: false }]
    });
    const ctrl = new rt.wxapp.TableCtrl(element);
    const response = {
        columns: [{ id: "a", label: "A" }, { id: "b", label: "B" }],
        rows: [{ id: "row", cells: [{ content: "value-a" }, { content: "value-b" }] }]
    };
    for (let visit = 0; visit < 2; visit++) {
        ctrl.updateData(visit === 0 ? response : { rows: response.rows });
        assert.deepEqual(Array.from(ctrl._columns, column => column.id), ["b", "a"]);
        assert.deepEqual(Array.from(ctrl._rows[0].cells, cell => cell.content), ["value-b", "value-a"]);
        assert.equal(ctrl._columns[0].width, 240);
        assert.equal(ctrl._columns[1].visible, false);
    }
    assert.equal(rt.document.cookie, "");
});
