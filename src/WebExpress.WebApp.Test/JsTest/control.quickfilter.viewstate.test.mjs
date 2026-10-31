/**
 * End-to-end test for the ViewState-bound quickfilter (the write pilot).
 *
 * A quickfilter authored with Resource<T>().Model("filter") writes the active
 * filter set into the shared ViewState state and re-queries the bound resource
 * instead of coordinating through the BindFilter control-to-control wire. This
 * test loads the real WebUI runtime (the FilterRegistry, the quickfilter base)
 * together with the WebApp engine, so the whole path from a filter activation to
 * the ViewState re-query runs against the shipped code.
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadControl } from "./controls.harness.mjs";
import { appendServiceIsland, appendResourceIsland, appendStateIsland } from "./harness.mjs";

async function settle(viewState, turns = 8) {
    for (let i = 0; i < turns; i++) {
        await Promise.resolve();
    }
    viewState.flush();
}

test("a ViewState-bound quickfilter writes the active filter and re-queries the resource", async () => {
    const urls = [];
    const rt = loadControl({
        file: "webexpress.webapp.quickfilter.js",
        fetch: async (url) => {
            urls.push(url);
            return { ok: true, status: 200, json: async () => ({ items: [], total: 0 }) };
        }
    });

    // the shared ViewState that owns the games resource; auto is off so the only
    // load in this test is the one the quickfilter triggers
    const vsHost = rt.createElement("div");
    vsHost.id = "games-viewstate";
    vsHost.dataset.wxViewstate = "games-viewstate";
    appendStateIsland(rt.document, vsHost, { filter: [], page: 0 });
    appendServiceIsland(rt.document, vsHost, { name: "data", baseUri: "/api/games", method: "GET", query: { filter: "filter", page: "p" } });
    appendResourceIsland(rt.document, vsHost, { name: "games", service: "data", target: "games", auto: false, params: [{ name: "filter", state: "filter", dir: "out" }, { name: "page", state: "page", dir: "inout" }] });
    rt.document.body.appendChild(vsHost);

    const vs = new rt.wxapp.ViewState(vsHost);

    // the quickfilter authored inside the ViewState: it drives the games resource
    const qf = rt.createElement("div");
    qf.classList.add("wx-webapp-quickfilter");
    qf.setAttribute("data-wx-resource", "games");
    qf.setAttribute("data-wx-model", "filter");
    qf.setAttribute("data-wx-model-query", "games");
    qf.dataset.wxResource = "games";
    rt.document.body.appendChild(qf);

    new rt.wxapp.QuickFilterCtrl(qf);

    // a user activates a filter; the registry broadcasts the change the
    // quickfilter listens for
    rt.wx.FilterRegistry.registerFilters([{ id: "open", name: "Open" }]);
    rt.wx.FilterRegistry.activate("open");

    await settle(vs);

    assert.deepEqual(vs.getState().filter, ["open"], "the active filter is written into the shared state");
    assert.equal(vs.getState().page, 0, "the page is reset for the new filter");
    assert.equal(urls.length, 1, "the resource re-queries exactly once");
    assert.ok(urls[0].includes("/api/games"), "the re-query hits the resource endpoint");
});

test("a standalone quickfilter drives no ViewState and stays on the event path", () => {
    const rt = loadControl({ file: "webexpress.webapp.quickfilter.js" });

    const qf = rt.createElement("div");
    qf.classList.add("wx-webapp-quickfilter");
    rt.document.body.appendChild(qf);

    const ctrl = new rt.wxapp.QuickFilterCtrl(qf);

    assert.equal(ctrl._viewStateResource, null, "no resource binding means no ViewState write");

    // activating a filter must not throw without a ViewState
    rt.wx.FilterRegistry.registerFilters([{ id: "closed", name: "Closed" }]);
    rt.wx.FilterRegistry.activate("closed");
});
