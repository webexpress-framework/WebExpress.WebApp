/**
 * Headless unit tests for the file view model helpers.
 *
 * The model is the part of the file view that carries no DOM and no network, so
 * the request shape, the response projection and the way an optimistic upload
 * entry survives until the server knows about it are all testable on their own.
 */

import { test } from "node:test";
import assert from "node:assert";
import { loadEngine, webappAsset } from "./harness.mjs";

/**
 * Loads the model into an engine runtime.
 * @returns {object} The model.
 */
function model() {
    return loadEngine({ extraFiles: [webappAsset("webexpress.webapp.file.view.model.js")] })
        .wxapp.fileViewModel;
}

test("the query carries the whole search contract, so one endpoint serves every data control", () => {
    const params = model().queryParams({ search: "vpn", filter: "open", page: 2, pageSize: 25 });

    assert.deepEqual(params, { search: "vpn", wql: "", filter: "open", page: 2, pageSize: 25 });
});

test("an order direction is only sent together with the field it applies to", () => {
    const fileView = model();

    assert.equal(fileView.queryParams({ orderDir: "desc" }).orderDir, undefined);
    assert.deepEqual(
        [fileView.queryParams({ orderBy: "name", orderDir: "desc" }).orderBy,
         fileView.queryParams({ orderBy: "name", orderDir: "desc" }).orderDir],
        ["name", "desc"]);
});

test("the response is projected onto the shape both presentations render", () => {
    const files = model().mapFiles({
        items: [{ id: "1", name: "Proposal.pdf", uri: "/d/1", size: "2,1 kB", date: "29.08.2026", description: "draft" }]
    });

    assert.deepEqual(files, [{
        id: "1",
        version: 0,
        name: "Proposal.pdf",
        uri: "/d/1",
        icon: null,
        image: null,
        size: "2,1 kB",
        date: "29.08.2026",
        description: "draft"
    }]);
});

test("a file without an address still renders, pointing nowhere rather than at the page", () => {
    const files = model().mapFiles({ items: [{ name: "Proposal.pdf" }] });

    assert.equal(files[0].uri, "#");
});

test("a malformed response yields no files instead of throwing", () => {
    const fileView = model();

    assert.deepEqual(fileView.mapFiles(null), []);
    assert.deepEqual(fileView.mapFiles({}), []);
    assert.deepEqual(fileView.mapFiles({ items: "nope" }), []);
});

test("an explicit total wins over the one inferred from the page", () => {
    assert.equal(model().reduceTotal({ total: 42 }, 3, 1, 10), 42);
});

test("without a total the count is inferred from the page the response answered", () => {
    assert.equal(model().reduceTotal({}, 3, 2, 10), 23);
});

test("an uploaded file becomes an entry that is visible before the server knows it", () => {
    const entry = model().fromUpload({ name: "Photo.jpg", size: 2048 });

    assert.equal(entry.name, "Photo.jpg");
    assert.equal(entry.size, "2.0 kB");
    assert.equal(entry.pending, true, "the entry is marked, so the reload can tell it from a real record");
});

test("nothing is invented for an upload event without a file", () => {
    const fileView = model();

    assert.equal(fileView.fromUpload(null), null);
    assert.equal(fileView.fromUpload({}), null);
});

test("a size is formatted in the unit the server would have chosen", () => {
    const fileView = model();

    assert.equal(fileView.formatSize(512), "512.0  B");
    assert.equal(fileView.formatSize(2048), "2.0 kB");
    assert.equal(fileView.formatSize(5 * 1024 * 1024), "5.0 MB");
    assert.equal(fileView.formatSize(3 * 1024 * 1024 * 1024), "3.0 GB");
    assert.equal(fileView.formatSize(-1), null);
    assert.equal(fileView.formatSize(undefined), null);
});

test("a pending upload survives a reload that does not know the file yet", () => {
    const pending = { name: "Photo.jpg", pending: true };

    const files = model().mergePending([{ name: "Proposal.pdf" }], [pending]);

    // an endpoint that indexes asynchronously answers the reload before it knows
    // the new file; dropping the entry would make the upload disappear again
    assert.deepEqual(files.map((file) => file.name), ["Proposal.pdf", "Photo.jpg"]);
});

test("a pending upload gives way once the response carries the same file", () => {
    const pending = { name: "Photo.jpg", pending: true };

    const files = model().mergePending([{ name: "Photo.jpg", id: "7" }], [pending]);

    assert.deepEqual(files.map((file) => [file.name, file.id]), [["Photo.jpg", "7"]],
        "the server's record replaces the guess rather than joining it");
});

test("a file that was already loaded is not carried over a second time", () => {
    const files = model().mergePending([{ name: "Proposal.pdf" }], [{ name: "Proposal.pdf" }]);

    assert.equal(files.length, 1, "only a pending entry survives a reload");
});

test("files that share a name fold into one entry, the newest version at the head", () => {
    const files = model().groupVersions([
        { name: "Map.pdf", version: 1, id: "a" },
        { name: "Grog.txt", version: 1, id: "b" },
        { name: "Map.pdf", version: 3, id: "c" },
        { name: "Map.pdf", version: 2, id: "d" }
    ]);

    // uploading a file again is a new version of it, not a second file
    assert.deepEqual(files.map((file) => file.name), ["Map.pdf", "Grog.txt"], "each name appears once");
    assert.equal(files[0].id, "c", "the newest version is the entry");
    assert.deepEqual(files[0].versions.map((v) => v.version), [2, 1], "the earlier ones follow it, newest first");
    assert.deepEqual(files[1].versions, [], "a file with one version carries no history");
});

test("grouping keeps the order the response listed the names in", () => {
    const files = model().groupVersions([
        { name: "Grog.txt", version: 1 },
        { name: "Map.pdf", version: 1 },
        { name: "Grog.txt", version: 2 }
    ]);

    assert.deepEqual(files.map((file) => file.name), ["Grog.txt", "Map.pdf"],
        "an endpoint that sorts its files keeps that sorting");
});

test("grouping tolerates a missing list", () => {
    assert.deepEqual(model().groupVersions(null), []);
});

test("uploading a name that is already there becomes its newest version", () => {
    const fileView = model();
    const shown = [{ name: "Map.pdf", version: 2, id: "c", description: "the map", versions: [{ name: "Map.pdf", version: 1, id: "a" }] }];

    const files = fileView.addUpload(shown, fileView.fromUpload({ name: "Map.pdf", size: 2048 }));

    assert.equal(files.length, 1, "the upload does not open a second entry for the same file");
    assert.equal(files[0].version, 3, "it sorts above the versions already on screen");
    assert.equal(files[0].description, "the map", "the description of the file carries over to the new version");
    assert.deepEqual(files[0].versions.map((v) => v.version), [2, 1], "what was shown becomes the previous version");
});

test("uploading a name nobody has seen opens a new entry", () => {
    const fileView = model();

    const files = fileView.addUpload([{ name: "Map.pdf", version: 1 }], fileView.fromUpload({ name: "Grog.txt", size: 12 }));

    assert.deepEqual(files.map((file) => file.name), ["Map.pdf", "Grog.txt"]);
    assert.deepEqual(files[1].versions, [], "a first upload has no history");
});

test("an upload event without a file leaves the entries untouched", () => {
    const shown = [{ name: "Map.pdf", version: 1 }];

    assert.equal(model().addUpload(shown, null), shown);
});

test("a description change names the file it belongs to", () => {
    assert.deepEqual(model().describePayload({ id: "7" }, "final"), { id: "7", description: "final" });
});

test("a cleared description travels as an empty text rather than as nothing", () => {
    assert.deepEqual(model().describePayload({ id: "7" }, null), { id: "7", description: "" });
});
