/**
 * Behaviour test for the figures under a feed entry.
 *
 * The feed no longer implements the join itself: it shapes the figure as a LikeCtrl host and
 * attaches that control, so a reader meets one behaviour rather than two that resemble each
 * other. These tests pin that delegation - the figure carries the control's classes, the click
 * goes through the control, and the feed still reports the change in the shape its own listeners
 * were promised.
 */
import { test } from "node:test";
import assert from "node:assert";
import { loadControl } from "./controls.harness.mjs";
import { appendServiceIsland } from "./harness.mjs";

/**
 * Builds a feed whose single entry carries a joinable figure and a plain one.
 * @param {object} options - { active, answer } for the initial state and the endpoint's reply.
 * @returns {Promise<object>} The runtime and the mounted host.
 */
async function feed(options = {}) {
    const calls = [];
    const rt = loadControl({
        deps: ["webexpress.webapp.like.js"],
        file: "webexpress.webapp.feed.js",
        fetch: async (uri, init) => {
            if (init && init.method === "POST") {
                calls.push({ uri, init });
                return {
                    ok: true,
                    status: 200,
                    headers: { get: () => "application/json" },
                    json: async () => options.answer ?? { value: "7", active: true }
                };
            }

            return {
                ok: true,
                status: 200,
                headers: { get: () => "application/json" },
                json: async () => ({
                    items: [{
                        id: "1",
                        title: "Maintenance Window",
                        text: "The ticket system will be unavailable.",
                        metrics: [
                            {
                                icon: "wx-icon-light wx-icon-light-thumbs-up",
                                value: "6",
                                label: "Likes",
                                uri: "/api/1/objects/like",
                                payload: JSON.stringify({ object: "SD-1" }),
                                active: !!options.active
                            },
                            { icon: "wx-icon-light wx-icon-light-comment", value: "3", label: "Comments" }
                        ]
                    }],
                    pagination: { page: 0, pageSize: 5, total: 1, totalPages: 1 }
                })
            };
        }
    });

    const host = rt.createElement("div");
    appendServiceIsland(rt.document, host, { name: "data", baseUri: "/api/feed", method: "GET" });
    rt.document.body.appendChild(host);

    new rt.wxapp.FeedCtrl(host);

    // let the fetch promise chain settle before inspecting the rendered entry
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    return { rt, host, calls };
}

test("wx-webapp-feed shapes a joinable figure as a like control host", async () => {
    const { host } = await feed();

    const figures = host.querySelectorAll(".wx-feed-entry-metric");
    assert.equal(figures.length, 2, "both figures are rendered");

    const like = host.querySelector(".wx-webapp-like-action");
    assert.ok(like, "the figure with an address carries the control's actionable class");
    assert.equal(like.dataset.uri, "/api/1/objects/like", "the address reaches the control as data");
    assert.equal(like.dataset.payload, JSON.stringify({ object: "SD-1" }), "so does the body");
    assert.ok(like.querySelector(".wx-webapp-like-value"), "the number is where the control repaints it");

    const plain = figures.find((f) => !f.classList.contains("wx-webapp-like-action"));
    assert.ok(plain, "the figure without an address stays a number");
    assert.ok(plain.classList.contains("wx-webapp-like"), "it still takes the shared look");
});

test("wx-webapp-feed joins a figure through the like control", async () => {
    const { host, calls } = await feed();

    const like = host.querySelector(".wx-webapp-like-action");
    like.click();

    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(calls.length, 1, "the toggle is posted once");
    assert.equal(calls[0].init.body, JSON.stringify({ object: "SD-1" }));
    assert.equal(like.querySelector(".wx-webapp-like-value").textContent, "7", "the count comes from the answer");
    assert.ok(like.classList.contains("wx-webapp-like-active"));
    assert.equal(like.getAttribute("aria-pressed"), "true");
});

test("wx-webapp-feed still reports the change with the entry's figure", async () => {
    const { rt, host } = await feed();

    const seen = [];
    host.addEventListener(rt.wx.Event.CHANGE_VALUE_EVENT, (event) => {
        if (event.detail && event.detail.metric) {
            seen.push(event.detail);
        }
    });

    host.querySelector(".wx-webapp-like-action").click();

    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(seen.length, 1, "the feed reports the change in its own shape");
    assert.equal(seen[0].active, true);
    assert.equal(seen[0].metric.value, "7", "the entry keeps what it was told");
    assert.equal(seen[0].metric.active, true);
});
