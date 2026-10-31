/**
 * Headless tests for the appearance scripts: the icon set picker swaps its stylesheet in place,
 * and the client's dark mode switch stores a toggle on the server once the page names it.
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadControl } from "./controls.harness.mjs";

/**
 * Loads the icon set picker on top of the theme dropdown it extends.
 * @returns {object} The loaded runtime.
 */
function loadPicker() {
    return loadControl({
        deps: ["webexpress.webapp.dropdown.theme.model.js", "webexpress.webapp.dropdown.theme.js"],
        file: "webexpress.webapp.dropdown.iconset.js"
    });
}

/**
 * Adds a stylesheet link the way the server renders it.
 * @param {object} rt - The loaded engine.
 * @param {string} href - The stylesheet address.
 */
function link(rt, href) {
    const element = rt.document.createElement("link");
    element.setAttribute("rel", "stylesheet");
    element.setAttribute("href", href);
    rt.document.head.appendChild(element);
}

/**
 * Lists the linked stylesheets.
 * @param {object} rt - The loaded engine.
 * @returns {string[]} The addresses.
 */
function sheets(rt) {
    return Array.from(rt.document.head.childNodes)
        .filter((x) => x.getAttribute && x.getAttribute("rel") === "stylesheet")
        .map((x) => x.getAttribute("href"));
}

test("a stored icon set replaces the sheet of the previous one instead of reloading the page", () => {
    const rt = loadPicker();
    link(rt, "/app/theme.css");
    link(rt, "/app/outline.css");
    const events = [];
    rt.document.addEventListener("webexpress.webapp.iconset.change", (e) => events.push(e.detail.id));
    const picker = { _items: [{ id: "default", stylesheet: null }, { id: "outline", stylesheet: "/app/outline.css" }, { id: "ninjas", stylesheet: "/app/ninjas.css" }] };

    rt.wxapp.DropdownIconSetCtrl.prototype._afterPersist.call(picker, "ninjas");
    assert.deepStrictEqual(sheets(rt), ["/app/theme.css", "/app/ninjas.css"], "the theme sheet stays, the sets are swapped");

    rt.wxapp.DropdownIconSetCtrl.prototype._afterPersist.call(picker, "default");
    assert.deepStrictEqual(sheets(rt), ["/app/theme.css"], "the framework drawings need no sheet");
    assert.deepStrictEqual(events, ["ninjas", "default"], "other switches of the preference are told");
});

test("without a stored choice the picker shows the value the page is rendered with", async () => {
    const rt = loadPicker();
    const answer = { items: [{ id: "light", name: "Light" }, { id: "dark", name: "Dark" }], selected: null };
    rt.wxapp.ServiceRegistry.request = async () => ({ ok: true, data: answer });
    const picker = { _apiEndpoint: "/app/api/mode", _label: "", _showActive() { } };

    for (const [preset, shown] of [["dark", "dark"], [null, "light"], ["purple", "light"]]) {
        picker._defaultId = preset;
        await rt.wxapp.DropdownThemeCtrl.prototype._fetchThemes.call(picker);
        assert.equal(picker._activeId, shown, `preset ${preset}`);
    }

    answer.selected = "light";
    picker._defaultId = "dark";
    await rt.wxapp.DropdownThemeCtrl.prototype._fetchThemes.call(picker);
    assert.equal(picker._activeId, "light", "a stored choice wins over the preset");
});

test("a dark mode toggle is stored on the service the page names, and only there", async () => {
    const calls = [];
    const fetch = async (url, init) => {
        calls.push({ url: String(url), method: init && init.method, body: init && String(init.body) });
        return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({}), text: async () => "{}" };
    };
    const rt = loadControl({ fetch, file: "webexpress.webapp.colorscheme.js" });
    const type = rt.wx.Event.CHANGE_DARKMODE_EVENT;

    rt.document.dispatchEvent({ type, detail: { mode: "dark" } });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(calls.length, 0, "without a named service the switch stays a browser preference");

    rt.document.documentElement.setAttribute("data-wx-theme-service", "/app/api/colorscheme");
    rt.document.dispatchEvent({ type, detail: { mode: "dark" } });
    rt.document.dispatchEvent({ type, detail: { mode: "purple" } });
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(calls.length, 1, "an unknown mode is not sent");
    assert.equal(calls[0].method, "PUT");
    assert.match(calls[0].url, /\/app\/api\/colorscheme$/);
    assert.equal(calls[0].body, "v=dark");
});
