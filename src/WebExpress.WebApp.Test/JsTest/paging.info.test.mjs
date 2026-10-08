/**
 * Tests the caption of the paging info line the paged data controls (table,
 * list, tile) share. The wording used to be hardcoded English; it now comes
 * from the shipped bundles, so the tests load the real en and de translations
 * and assert that both fill the placeholders in their own order.
 */
import { test } from "node:test";
import assert from "node:assert";
import { loadControl } from "./controls.harness.mjs";

/**
 * Loads the runtime with the shipped translations, so the assertions cover the
 * strings that actually ship rather than a fixture.
 * @param {object} [options] - Extra loadControl options such as deps and file.
 * @returns {object} The loaded runtime.
 */
function load(options = {}) {
    return loadControl(Object.assign({}, options, {
        deps: ["i18n/en.js", "i18n/de.js", ...(options.deps || [])]
    }));
}

/**
 * Builds the minimal control surface the helper needs: the inherited _i18n.
 * @param {object} rt - The loaded runtime.
 * @returns {object} A control stand-in.
 */
function ctrl(rt) {
    return { _i18n: (key, fallback) => rt.wx.I18N.translate(key) ?? fallback };
}

test("the paging info reads the english wording from the bundle", () => {
    const rt = load();
    rt.wx.I18N.setLanguage("en");

    assert.equal(
        rt.wxapp.pagingInfo(ctrl(rt), 0, 3, 10, 25),
        "Page 1 of 3 / 10 of 25 items");
    assert.equal(
        rt.wxapp.pagingInfoLoading(ctrl(rt), 1, 3),
        "Page 2 of 3 - loading…");
});

test("the paging info reads the german wording from the bundle", () => {
    const rt = load();
    rt.wx.I18N.setLanguage("de");

    assert.equal(
        rt.wxapp.pagingInfo(ctrl(rt), 0, 3, 10, 25),
        "Seite 1 von 3 / 10 von 25 Einträgen");
    assert.equal(
        rt.wxapp.pagingInfoLoading(ctrl(rt), 2, 3),
        "Seite 3 von 3 – wird geladen…");
});

test("the paged data controls render the shared caption", async () => {
    const rt = load({
        deps: ["webexpress.webapp.table.model.js"],
        file: "webexpress.webapp.table.js"
    });
    rt.wx.I18N.setLanguage("de");
    rt.setFetch(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
            columns: [{ id: "name", label: "Name", visible: true }],
            rows: [{ id: "r1", cells: [{ content: "Guybrush" }] }],
            total: 25
        })
    }));

    const element = rt.createElement("div");
    element.classList.add("wx-webapp-table");
    element.setAttribute("data-page-size", "10");
    element.dataset.pageSize = "10";

    const island = rt.document.createElement("wx-service");
    island.setAttribute("name", "data");
    island.setAttribute("kind", "rest");
    island.setAttribute("base-uri", "/api/characters");
    island.setAttribute("method", "GET");
    element.appendChild(island);
    rt.document.body.appendChild(element);

    const table = new rt.wxapp.TableCtrl(element);
    for (let round = 0; round < 5; round++) {
        for (let i = 0; i < 40; i++) {
            await Promise.resolve();
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
    }

    assert.equal(table._infoDiv.textContent, "Seite 1 von 3 / 1 von 25 Einträgen");
});
