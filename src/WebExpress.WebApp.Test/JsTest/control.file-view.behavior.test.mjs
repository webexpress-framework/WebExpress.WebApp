/**
 * Behaviour tests for the FileViewCtrl control (wx-webapp-file-view).
 *
 * They cover what makes the control more than a file list: the switcher over
 * several presentations of one shared set, the inline edit of a description and
 * its persistence, and the upload that shows up without a page reload.
 */
import { test } from "node:test";
import assert from "node:assert";
import { loadControl } from "./controls.harness.mjs";

const FILES = [
    { id: "1", name: "Proposal.pdf", uri: "/d/1", size: "2,1 kB", date: "29.08.2026", description: "draft" },
    { id: "2", name: "Photo.jpg", uri: "/d/2", image: "/d/2/preview" }
];

/**
 * Lets the microtask queue and one macrotask drain so a load resolves.
 */
async function settle() {
    for (let i = 0; i < 30; i++) { await Promise.resolve(); }
    await new Promise((resolve) => setTimeout(resolve, 0));
    for (let i = 0; i < 30; i++) { await Promise.resolve(); }
}

/**
 * Loads a runtime with the file view control and records what it sent.
 * @param {object} [response] - The payload the endpoint answers a load with.
 * @returns {object} The runtime, extended with the recorded requests.
 */
function loadRuntime(response) {
    const requests = [];
    const rt = loadControl({
        // the english dictionary is loaded so the switcher labels are the real
        // ones; without it every label would read back as its own key
        deps: ["i18n/en.js", "webexpress.webapp.file.view.model.js"],
        file: "webexpress.webapp.file.view.js"
    });

    rt.setFetch(async (url, init) => {
        requests.push({ url: url, method: (init && init.method) || "GET", body: init && init.body });

        return {
            ok: true,
            status: 200,
            headers: { get: (header) => (header.toLowerCase() === "content-type" ? "application/json" : "") },
            json: async () => response || { items: [], total: 0 },
            text: async () => JSON.stringify(response || { items: [] })
        };
    });

    rt.requests = requests;

    return rt;
}

/**
 * Builds a file view host the way the server renders it.
 * @param {object} rt - The runtime.
 * @param {object} [options] - views, editable, service, files and extra views.
 * @returns {object} The host element.
 */
function host(rt, options = {}) {
    const element = rt.createElement("div");
    element.id = options.id || "files";
    element.dataset.views = options.views || "list,tile";

    if (options.editable) {
        element.dataset.editableDescription = "true";
    }

    if (options.layout) {
        element.dataset.layout = options.layout;
    }

    if (options.service) {
        element.appendChild(rt.wxapp.ServiceRegistry.islandElement({
            name: "data",
            baseUri: "/api/v1/files",
            method: "GET",
            updateMethod: "PUT"
        }));
    }

    const list = rt.createElement("div");
    list.classList.add("wx-webui-file-list");

    for (const file of options.files || []) {
        const entry = rt.createElement("div");
        entry.classList.add("wx-webui-file");
        entry.textContent = file.name;
        entry.dataset.fileId = file.id;
        if (file.description) {
            entry.dataset.description = file.description;
        }
        list.appendChild(entry);
    }

    element.appendChild(list);

    for (const view of options.extraViews || []) {
        const node = rt.createElement("div");
        node.classList.add("wx-view");
        node.dataset.label = view;
        element.appendChild(node);
    }

    rt.document.body.appendChild(element);

    return element;
}

/**
 * Constructs the control for a host, the way the controller would.
 * @param {object} rt - The runtime.
 * @param {object} element - The host element.
 * @returns {object} The control.
 */
function construct(rt, element) {
    // the controller initializes children first, so the file list already has its
    // instance by the time the file view is constructed
    const list = element.querySelector(".wx-webui-file-list");
    if (list) {
        list.classList.remove("wx-webui-file-list");
        rt.wx.Controller.instanceMap.set(list, new rt.wx.FileListCtrl(list));
    }

    return new rt.wxapp.FileViewCtrl(element);
}

test("the switcher offers one button per presentation and shows the first", () => {
    const rt = loadRuntime();
    const element = host(rt, { files: [{ id: "1", name: "Proposal.pdf" }] });

    construct(rt, element);

    const buttons = element.querySelectorAll(".wx-view-switcher-item");
    assert.equal(buttons.length, 2, "the list and the tile presentation are both offered");

    const panes = element.querySelectorAll(".wx-file-view-pane");
    assert.equal(panes[0].style.display, "", "the first declared presentation is the one shown");
    assert.equal(panes[1].style.display, "none");
});

test("a view that offers the tile board alone still shows the files the server rendered", () => {
    const rt = loadRuntime();
    const element = host(rt, {
        views: "tile",
        files: [{ id: "1", name: "TreasureMap.pdf" }, { id: "2", name: "GrogRecipe.txt" }]
    });

    const ctrl = construct(rt, element);

    // the server renders the files as a file list; that list is the seed of the
    // whole control, not only of the list presentation
    assert.deepEqual(ctrl.files.map((file) => file.name), ["TreasureMap.pdf", "GrogRecipe.txt"]);
    assert.equal(element.querySelectorAll(".wx-file-view-card").length, 2, "the tile board shows them");
    assert.ok(element.querySelector(".wx-file-view-statusbar").textContent.includes("2"),
        "and the count line counts them");
});

test("the list the seed came from does not stay behind when it is not a presentation", () => {
    const rt = loadRuntime();
    const element = host(rt, { views: "tile", files: [{ id: "1", name: "TreasureMap.pdf" }] });

    construct(rt, element);

    // left where the server put it, it would sit above the toolbar as a second,
    // unswitchable copy of the files
    assert.equal(element.querySelectorAll(".wx-file-list").length, 0);
});

test("a single presentation offers no switch, because there is nothing to choose", () => {
    const rt = loadRuntime();
    const element = host(rt, { views: "tile", files: [] });

    construct(rt, element);

    const switcher = element.querySelector(".wx-view-switcher");
    assert.ok(switcher, "the switch is built either way");
    assert.equal(switcher.hasAttribute("hidden"), true, "but it steps aside rather than sitting there pressed");
});

test("the declared order decides which presentation opens", () => {
    const rt = loadRuntime();
    const element = host(rt, { views: "tile,list", files: [{ id: "1", name: "Proposal.pdf" }] });

    construct(rt, element);

    const panes = element.querySelectorAll(".wx-file-view-pane");
    assert.equal(panes[0].dataset.view, "tile");
    assert.equal(panes[0].style.display, "", "the tile board opens when it is declared first");
});

test("both presentations render the same set, so switching never re-queries", () => {
    const rt = loadRuntime();
    const element = host(rt, { files: [{ id: "1", name: "Proposal.pdf" }, { id: "2", name: "Photo.jpg" }] });

    const ctrl = construct(rt, element);

    assert.equal(element.querySelectorAll(".wx-file-view-card").length, 2,
        "the tile board is drawn up front, not on first sight");
    assert.equal(element.querySelectorAll("tr").length, 2, "the list shows the same files");
    assert.equal(rt.requests.length, 0, "a view without a service asks nobody");

    ctrl._activate("tile");

    assert.equal(rt.requests.length, 0, "switching a presentation is not a load");
});

test("the default layout names the active presentation beside the switch", () => {
    const rt = loadRuntime();
    const element = host(rt, { layout: "default", files: [] });

    const ctrl = construct(rt, element);

    // the layout decides what stands beside the switch, not what the switch is
    assert.deepEqual(
        element.querySelectorAll(".wx-view-switcher-item").map((item) => item.getAttribute("data-view-tab")),
        ["list", "tile"],
        "the same switch as in the compact layout");
    assert.equal(element.querySelector(".wx-file-view-title h5").textContent, "List",
        "the title names the presentation that is open");

    ctrl._activate("tile");

    assert.equal(element.querySelector(".wx-file-view-title h5").textContent, "Tiles");
});

test("a view the server contributed joins the switcher next to the built-in ones", () => {
    const rt = loadRuntime();
    const element = host(rt, { extraViews: ["Gallery"] });

    construct(rt, element);

    const labels = element.querySelectorAll(".wx-view-switcher-item span").map((span) => span.textContent);
    assert.deepEqual(labels, ["List", "Tiles", "Gallery"]);
});

test("the files a service returns replace the ones the server rendered", async () => {
    const rt = loadRuntime({ items: FILES, total: 2 });
    const element = host(rt, { service: true, files: [{ id: "0", name: "Placeholder.txt" }] });

    const ctrl = construct(rt, element);
    await settle();

    assert.deepEqual(ctrl.files.map((file) => file.name), ["Proposal.pdf", "Photo.jpg"]);
    assert.ok(rt.requests[0].url.startsWith("/api/v1/files"), "the load goes through the declared service");
});

test("an edited description reaches the other presentation and the endpoint", async () => {
    const rt = loadRuntime({ items: FILES, total: 2 });
    const element = host(rt, { service: true, editable: true });

    const ctrl = construct(rt, element);
    await settle();

    ctrl._saveDescription(ctrl.files[0], "final");
    await settle();

    const update = rt.requests.find((request) => request.method === "PUT");
    assert.ok(update, "the change is persisted through the update operation of the service");
    assert.deepEqual(JSON.parse(update.body), { id: "1", description: "final" },
        "the payload names the file, so the endpoint stays a single address");

    const card = element.querySelectorAll(".wx-file-view-card")[0];
    assert.ok(card.textContent.includes("final"), "the hidden presentation followed the edit");
});

test("an unchanged description is not sent, so leaving an editor is not a write", async () => {
    const rt = loadRuntime({ items: FILES, total: 2 });
    const element = host(rt, { service: true, editable: true });

    const ctrl = construct(rt, element);
    await settle();

    const before = rt.requests.length;
    ctrl._saveDescription(ctrl.files[0], "draft");
    await settle();

    assert.equal(rt.requests.length, before);
});

test("a description edited without a service stays on the client instead of failing", () => {
    const rt = loadRuntime();
    const element = host(rt, { editable: true, files: [{ id: "1", name: "Proposal.pdf" }] });

    const ctrl = construct(rt, element);
    ctrl._saveDescription(ctrl.files[0], "final");

    assert.equal(ctrl.files[0].description, "final");
    assert.equal(rt.requests.length, 0);
});

test("an editable description is an inline editor rather than plain text", () => {
    const rt = loadRuntime();
    const element = host(rt, { editable: true, files: [{ id: "1", name: "Proposal.pdf" }] });

    construct(rt, element);

    assert.ok(element.querySelectorAll(".wx-file-view-description").length >= 1,
        "the smart edit host is placed in both presentations");
});

test("an uploaded file is visible before the reload answers", async () => {
    const rt = loadRuntime({ items: [], total: 0 });
    const element = host(rt, { service: true });

    const ctrl = construct(rt, element);
    await settle();

    ctrl.uploaded({ name: "Photo.jpg", size: 2048 });

    // asserted before settling on purpose: showing the file only after the
    // server answered is exactly the delay the optimistic entry removes
    assert.deepEqual(ctrl.files.map((file) => file.name), ["Photo.jpg"]);
    assert.equal(element.querySelectorAll(".wx-file-view-card").length, 1);

    await settle();

    assert.ok(rt.requests.length >= 2, "the server is asked for the record behind the upload");
});

test("uploading a file that is already there adds a version instead of a second entry", async () => {
    const rt = loadRuntime({ items: [{ id: "1", name: "TreasureMap.pdf", version: 1 }], total: 1 });
    const element = host(rt, { service: true });

    const ctrl = construct(rt, element);
    await settle();

    ctrl.uploaded({ name: "TreasureMap.pdf", size: 2048 });

    assert.equal(ctrl.files.length, 1, "the name stays one entry");
    assert.deepEqual(ctrl.files[0].versions.map((version) => version.version), [1],
        "what was shown became the earlier version");
    assert.equal(element.querySelectorAll(".wx-file-view-card").length, 1, "the tile board shows one card too");
    assert.equal(element.querySelectorAll(".wx-file-view-card-versions").length, 1,
        "the card offers to unfold the versions");
});

test("the versions a response carries are folded into one entry per file", async () => {
    const rt = loadRuntime({
        items: [
            { id: "a", name: "TreasureMap.pdf", version: 1 },
            { id: "b", name: "TreasureMap.pdf", version: 2 },
            { id: "c", name: "GrogRecipe.txt", version: 1 }
        ],
        total: 3
    });
    const element = host(rt, { service: true });

    const ctrl = construct(rt, element);
    await settle();

    assert.deepEqual(ctrl.files.map((file) => file.name), ["TreasureMap.pdf", "GrogRecipe.txt"]);
    assert.equal(ctrl.files[0].id, "b", "the newest version is the entry");
    assert.equal(element.querySelectorAll("tr").length, 3, "the list shows two files and one folded version");
    assert.equal(element.querySelectorAll("tr.wx-file-version").length, 1);
});

test("a card unfolds the earlier versions of its file", async () => {
    const rt = loadRuntime({
        items: [
            { id: "a", name: "TreasureMap.pdf", version: 1, date: "14.03.2026" },
            { id: "b", name: "TreasureMap.pdf", version: 2, date: "30.07.2026" }
        ],
        total: 2
    });
    const element = host(rt, { service: true });

    construct(rt, element);
    await settle();

    const toggle = element.querySelector(".wx-file-view-card-versions");
    const list = element.querySelector(".wx-file-view-card-version-list");

    assert.equal(list.style.display, "none", "the versions start folded");
    assert.ok(toggle.textContent.includes("2"), "the toggle counts the file itself among its versions");

    toggle.click();

    assert.equal(list.style.display, "", "and unfold when the toggle is pressed");
    assert.ok(list.textContent.includes("v1"), "the earlier version is named and dated");
    assert.ok(list.textContent.includes("14.03.2026"));
});

test("an upload into a view without a service still shows the file", () => {
    const rt = loadRuntime();
    const element = host(rt, {});

    const ctrl = construct(rt, element);
    ctrl.uploaded({ name: "Photo.jpg", size: 2048 });

    assert.deepEqual(ctrl.files.map((file) => file.name), ["Photo.jpg"]);
});

test("the control announces its mount, which is what a bind declared before it waits for", async () => {
    const rt = loadRuntime();
    const element = host(rt, {});

    const announced = [];
    element.addEventListener("webexpress.webapp.data.mount", (event) => announced.push(event));

    const ctrl = construct(rt, element);
    rt.wx.Controller.instanceMap.set(element, ctrl);

    // the binds of an element run before the controller constructs that
    // element's own instance, so a bind declared on this control resolves
    // nothing and waits for this announcement to look again
    await settle();

    assert.equal(announced.length, 1, "the mount is announced");
    assert.equal(announced[0].bubbles, true, "it bubbles, which is how it reaches the document the binds listen on");
    assert.equal(announced[0].detail.component, ctrl);
});

test("the presentation the user chose is the one the control comes back in", () => {
    const rt = loadRuntime();
    const first = host(rt, { files: [] });

    construct(rt, first)._activate("tile");

    const second = host(rt, { files: [], id: "files" });
    second.id = "files";
    const ctrl = construct(rt, second);

    assert.equal(ctrl._activePane, "tile");
});
