/**
 * Headless contract test for the SystemMetricCtrl control
 * (wx-webapp-system-metric). The shared contract (controls.contract.mjs)
 * verifies that the control registers correctly and survives a construct /
 * teardown lifecycle. The focused tests below verify the live behavior: the
 * channel subscription on the MessageQueue, the rendering of incoming
 * readings, the metric filter, the threshold colors and the byte formatting.
 */
import { test } from "node:test";
import assert from "node:assert";
import { contract } from "./controls.contract.mjs";
import { loadControl } from "./controls.harness.mjs";

contract({
    file: "webexpress.webapp.system.metric.js",
    selector: "wx-webapp-system-metric",
    ctrl: "SystemMetricCtrl"
});

/**
 * Builds a connected host carrying the control marker class and data attributes.
 * @param {object} rt - The loaded runtime.
 * @param {object} attrs - The data-* attributes to set (camelCase keys).
 * @returns {object} The host element.
 */
function host(rt, attrs = {}) {
    const element = rt.createElement("div");
    element.classList.add("wx-webapp-system-metric");
    for (const [key, value] of Object.entries(attrs)) {
        element.dataset[key] = value;
    }
    rt.document.body.appendChild(element);
    return element;
}

/**
 * Pushes a synthetic metric update through the real MessageQueue.
 * @param {object} rt - The loaded runtime.
 * @param {object} update - The update fields (metric, value, usedBytes, totalBytes).
 */
function pushUpdate(rt, update) {
    rt.wxapp.MessageQueue.dispatchLocal(Object.assign({
        type: "webexpress.webapp.systemmetric.update"
    }, update));
}

test("the control subscribes its metric's channel on the message queue", () => {
    const rt = loadControl({ file: "webexpress.webapp.system.metric.js" });
    const element = host(rt, { metric: "ram" });

    rt.wx.Controller.createInstances(element);

    assert.ok(
        rt.wxapp.MessageQueue._subscribedDomains.has("webexpress.webapp.systemmetric.ram"),
        "the ram channel is subscribed for the server side addressing"
    );
});

test("a reading renders the percentage and the bar width", () => {
    const rt = loadControl({ file: "webexpress.webapp.system.metric.js" });
    const element = host(rt, { metric: "cpu" });

    rt.wx.Controller.createInstances(element);
    const ctrl = rt.wx.Controller.instanceMap.get(element);

    pushUpdate(rt, { metric: "cpu", value: 12.3 });

    assert.equal(ctrl.value, 12.3, "the reading is exposed through the value getter");
    assert.equal(ctrl.layout, "bar", "the default layout is the bar");
    assert.equal(element.querySelector(".wx-system-metric-value").textContent, "12.3 %");
    assert.equal(element.querySelector(".wx-system-metric-bar-fill").style.width, "12.3%");
});

test("readings of a different metric are ignored", () => {
    const rt = loadControl({ file: "webexpress.webapp.system.metric.js" });
    const element = host(rt, { metric: "cpu" });

    rt.wx.Controller.createInstances(element);
    const ctrl = rt.wx.Controller.instanceMap.get(element);

    pushUpdate(rt, { metric: "cpu", value: 10 });
    pushUpdate(rt, { metric: "ram", value: 90 });

    assert.equal(ctrl.value, 10, "a foreign metric does not repaint the gauge");
});

test("the thresholds toggle the warn and critical colors", () => {
    const rt = loadControl({ file: "webexpress.webapp.system.metric.js" });
    const element = host(rt, { metric: "cpu" });

    rt.wx.Controller.createInstances(element);

    pushUpdate(rt, { metric: "cpu", value: 10 });
    assert.ok(!element.classList.contains("wx-system-metric-warn"), "a low value stays green");
    assert.ok(!element.classList.contains("wx-system-metric-critical"));

    pushUpdate(rt, { metric: "cpu", value: 60 });
    assert.ok(element.classList.contains("wx-system-metric-warn"), "the warn threshold turns yellow");
    assert.ok(!element.classList.contains("wx-system-metric-critical"));

    pushUpdate(rt, { metric: "cpu", value: 85 });
    assert.ok(!element.classList.contains("wx-system-metric-warn"), "the critical threshold replaces warn");
    assert.ok(element.classList.contains("wx-system-metric-critical"), "the critical threshold turns red");

    pushUpdate(rt, { metric: "cpu", value: 5 });
    assert.ok(!element.classList.contains("wx-system-metric-critical"), "a recovering value clears the colors");
});

test("a ram reading carries the absolute usage as the tooltip", () => {
    const rt = loadControl({ file: "webexpress.webapp.system.metric.js" });
    const element = host(rt, { metric: "ram" });

    rt.wx.Controller.createInstances(element);

    pushUpdate(rt, { metric: "ram", value: 50, usedBytes: 8 * 1024 * 1024 * 1024, totalBytes: 16 * 1024 * 1024 * 1024 });

    assert.equal(element.title, "8.0 GB / 16.0 GB");
});

test("a reading dispatches the change value event", () => {
    const rt = loadControl({ file: "webexpress.webapp.system.metric.js" });
    const element = host(rt, { metric: "cpu" });

    let detail = null;
    element.addEventListener(rt.wx.Event.CHANGE_VALUE_EVENT, (e) => { detail = e.detail; });

    rt.wx.Controller.createInstances(element);
    pushUpdate(rt, { metric: "cpu", value: 42 });

    assert.ok(detail, "the event fires on a reading");
    assert.equal(detail.metric, "cpu");
    assert.equal(detail.value, 42);
});

test("the chart scrolls right-to-left with the newest reading at the right edge", () => {
    const rt = loadControl({ file: "webexpress.webapp.system.metric.js" });
    // fix the capacity so the fixed slot width is deterministic (step = 25)
    rt.wxapp.SystemMetricCtrl.HISTORY_LENGTH = 5;
    const element = host(rt, { metric: "cpu", layout: "chart" });

    rt.wx.Controller.createInstances(element);
    const ctrl = rt.wx.Controller.instanceMap.get(element);

    assert.equal(ctrl.layout, "chart", "the chart layout is selected");
    assert.ok(element.classList.contains("wx-system-metric-chart"), "the host carries the chart hook");
    assert.equal(element.querySelectorAll(".wx-system-metric-track").length, 0, "no bar track in the chart layout");

    const line = element.querySelector(".wx-system-metric-chart-line");
    assert.ok(line, "the sparkline line exists");

    pushUpdate(rt, { metric: "cpu", value: 20 });
    // a single reading sits at the right edge (x=100); y = 100 - value
    assert.equal(line.getAttribute("points"), "100.00,80.00");

    pushUpdate(rt, { metric: "cpu", value: 100 });
    // the previous reading scrolls one slot to the left; the newest stays at x=100
    assert.equal(line.getAttribute("points"), "75.00,80.00 100.00,0.00");

    // the area closes the trace to the baseline, from the right edge back to the oldest point
    assert.equal(
        element.querySelector(".wx-system-metric-chart-area").getAttribute("points"),
        "75.00,80.00 100.00,0.00 100.00,100.00 75.00,100.00"
    );
});

test("once the history is full the oldest reading drops off the left", () => {
    const rt = loadControl({ file: "webexpress.webapp.system.metric.js" });
    rt.wxapp.SystemMetricCtrl.HISTORY_LENGTH = 3; // step = 50, three slots
    const element = host(rt, { metric: "cpu", layout: "chart" });

    rt.wx.Controller.createInstances(element);
    const line = element.querySelector(".wx-system-metric-chart-line");

    pushUpdate(rt, { metric: "cpu", value: 10 });
    pushUpdate(rt, { metric: "cpu", value: 20 });
    pushUpdate(rt, { metric: "cpu", value: 30 });
    // full: oldest(10) left, newest(30) at the right edge
    assert.equal(line.getAttribute("points"), "0.00,90.00 50.00,80.00 100.00,70.00");

    pushUpdate(rt, { metric: "cpu", value: 40 });
    // the 10 dropped off; 20/30/40 scrolled left, 40 at the right edge
    assert.equal(line.getAttribute("points"), "0.00,80.00 50.00,70.00 100.00,60.00");
});

test("the chart history is capped at HISTORY_LENGTH", () => {
    const rt = loadControl({ file: "webexpress.webapp.system.metric.js" });
    const element = host(rt, { metric: "cpu", layout: "chart" });
    const max = rt.wxapp.SystemMetricCtrl.HISTORY_LENGTH;

    rt.wx.Controller.createInstances(element);
    const line = element.querySelector(".wx-system-metric-chart-line");

    for (let i = 0; i < max + 20; i++) {
        pushUpdate(rt, { metric: "cpu", value: i % 100 });
    }

    const count = line.getAttribute("points").trim().split(/\s+/).length;
    assert.equal(count, max, "the sparkline never plots more than HISTORY_LENGTH points");
});

test("the chart layout still colors the host by threshold", () => {
    const rt = loadControl({ file: "webexpress.webapp.system.metric.js" });
    const element = host(rt, { metric: "cpu", layout: "chart" });

    rt.wx.Controller.createInstances(element);

    pushUpdate(rt, { metric: "cpu", value: 90 });
    assert.ok(element.classList.contains("wx-system-metric-critical"), "a critical value colors the chart red");
});

test("chartPoints places the newest reading at the right edge, older to the left", () => {
    const rt = loadControl({ file: "webexpress.webapp.system.metric.js" });
    const points = rt.wxapp.SystemMetricCtrl.chartPoints;

    // the capacity fixes the slot width; with 5 slots step = 25
    assert.equal(points([], 5), "", "no readings produce no points");
    assert.equal(points([25], 5), "100.00,75.00", "a single reading sits at the right edge");
    assert.equal(points([0, 50, 100], 5), "50.00,100.00 75.00,50.00 100.00,0.00", "older readings step to the left of the newest");
});

test("formatBytes renders compact, human readable figures", () => {
    const rt = loadControl({ file: "webexpress.webapp.system.metric.js" });
    const format = rt.wxapp.SystemMetricCtrl.formatBytes;

    assert.equal(format(512), "512 B");
    assert.equal(format(2048), "2 KB");
    assert.equal(format(5 * 1024 * 1024), "5 MB");
    assert.equal(format(3.4 * 1024 * 1024 * 1024), "3.4 GB");
    assert.equal(format(-1), "0 B");
});
