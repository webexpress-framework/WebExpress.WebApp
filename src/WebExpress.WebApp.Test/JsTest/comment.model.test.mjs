/**
 * Headless unit tests for the REST comment model helpers (phase two).
 *
 * These cover the pure logic extracted from webexpress.webapp.comment.js,
 * namely the endpoint url and path building and the category normalisation,
 * plus an end to end path that drives the list, edit, like and delete
 * operations through a service to confirm the urls survive the migration.
 *
 * Run with Node 18 or newer from the jstest folder:
 *   node --test
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, webappAsset } from "./harness.mjs";

function load(options) {
    return loadEngine(Object.assign(
        { extraFiles: [webappAsset("webexpress.webapp.comment.model.js")] },
        options
    ));
}

test("legacy descriptor lists with get and edits with put", () => {
    const { wxapp } = load();
    const descriptor = wxapp.commentModel.legacyDescriptor("/api/comments/INC-1");

    assert.equal(descriptor.kind, "rest");
    assert.equal(descriptor.baseUri, "/api/comments/INC-1");
    assert.equal(descriptor.method, "GET");
    assert.equal(descriptor.updateMethod, "PUT");
});

test("normalize categories accepts arrays and objects", () => {
    const { wxapp } = load();

    assert.deepEqual(
        wxapp.commentModel.normalizeCategories([{ id: "a", color: "#1" }, { id: "b" }]),
        { a: { id: "a", color: "#1" }, b: { id: "b" } }
    );
    assert.deepEqual(wxapp.commentModel.normalizeCategories({ a: { id: "a" } }), { a: { id: "a" } });
    assert.deepEqual(wxapp.commentModel.normalizeCategories(null), {});
});

test("categories url joins with a single slash", () => {
    const { wxapp } = load();

    assert.equal(wxapp.commentModel.categoriesUrl("/api/c"), "/api/c/categories");
    assert.equal(wxapp.commentModel.categoriesUrl("/api/c/"), "/api/c/categories");
});

test("build users url appends encoded comma separated ids", () => {
    const { wxapp } = load();

    assert.equal(wxapp.commentModel.buildUsersUrl("/api/users", ["a", "b"]), "/api/users?ids=a,b");
    assert.equal(wxapp.commentModel.buildUsersUrl("/api/users?x=1", ["a"]), "/api/users?x=1&ids=a");
    assert.equal(wxapp.commentModel.buildUsersUrl("/api/users", ["a b"]), "/api/users?ids=a%20b");
});

test("comment path and sub path encode the id", () => {
    const { wxapp } = load();

    assert.equal(wxapp.commentModel.commentPath("42"), "/42");
    assert.equal(wxapp.commentModel.commentPath("x/y"), "/x%2Fy");
    assert.equal(wxapp.commentModel.commentSubPath("42", "likes"), "/42/likes");
});

test("model drives the comment operations through a service end to end", async () => {
    const { wxapp, setFetch } = load();
    const calls = [];
    setFetch(async (url, init) => {
        const method = (init && init.method) || "GET";
        calls.push({ url: url, method: method, body: init && init.body });
        if (method === "GET") {
            return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ([{ id: "1" }]) };
        }
        if (method === "PUT") {
            return { ok: true, status: 200, json: async () => ({ id: "1", body: "edited" }) };
        }
        if (method === "POST") {
            return { ok: true, status: 200, json: async () => ({ likes: ["u1"] }) };
        }
        return { ok: true, status: 204 };
    });

    const service = wxapp.ServiceRegistry.create(wxapp.commentModel.legacyDescriptor("/api/c"));

    const list = await service.request("/api/c", { method: "GET", headers: { "Accept": "application/json" } });
    assert.equal(calls[0].method, "GET");
    assert.deepEqual(list.data, [{ id: "1" }]);

    const edit = await service.update({ body: "edited" }, { path: wxapp.commentModel.commentPath("1") });
    assert.equal(calls[1].method, "PUT");
    assert.match(calls[1].url, /\/api\/c\/1$/);
    assert.deepEqual(JSON.parse(calls[1].body), { body: "edited" });
    assert.equal(edit.data.body, "edited");

    const like = await service.create({ userId: "u1" }, { path: wxapp.commentModel.commentSubPath("1", "likes") });
    assert.equal(calls[2].method, "POST");
    assert.match(calls[2].url, /\/api\/c\/1\/likes$/);
    assert.deepEqual(like.data.likes, ["u1"]);

    const removed = await service.remove({ path: wxapp.commentModel.commentPath("1") });
    assert.equal(calls[3].method, "DELETE");
    assert.match(calls[3].url, /\/api\/c\/1$/);
    assert.equal(removed.ok, true);
});
