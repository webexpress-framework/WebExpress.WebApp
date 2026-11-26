/**
 * Behavioural test for the click semantics the REST tile picker (wx-webapp-input-tile)
 * inherits from the WebUI tile picker. The subclass draws its cards through its own
 * _createTileCard override, so the selection logic of the base class must not depend on
 * anything the override does not pass along.
 */
import { test } from "node:test";
import assert from "node:assert";
import { loadControl } from "./controls.harness.mjs";

/**
 * Builds a multiple REST tile picker and gives it the tiles a response would deliver.
 * @param {object} rt - The loaded runtime.
 * @returns {object} The picker control.
 */
function build(rt) {
    const host = rt.createElement("div");
    host.classList.add("wx-webapp-input-tile");
    host.setAttribute("name", "Games");
    host.dataset.multiselect = "true";
    rt.document.body.appendChild(host);

    const picker = new rt.wxapp.InputTileCtrl(host);
    picker.tiles = ["a", "b", "c"].map(id => ({ id, label: id.toUpperCase(), content: [] }));

    return picker;
}

/**
 * Clicks the rendered card of a tile.
 * @param {object} picker - The picker control.
 * @param {string} id - The tile id.
 * @param {object} keys - The modifier keys of the click.
 */
function click(picker, id, keys = {}) {
    const nodes = Array.from(picker._tileList.firstChild.children);
    const card = nodes.find((n) => n.dataset && n.dataset.tileId === id);

    assert.ok(card, `the card of tile ${id} is rendered`);
    card.dispatchEvent({ type: "click", ctrlKey: false, metaKey: false, shiftKey: false, ...keys });
}

test("shift+click selects a range in the REST tile picker", () => {
    const rt = loadControl({ file: "webexpress.webapp.input.tile.js" });
    const picker = build(rt);

    click(picker, "a");
    click(picker, "c", { shiftKey: true });

    assert.equal(picker.value.split(";").sort().join(";"), "a;b;c");
});
