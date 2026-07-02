// Selection renderer
webexpress.webui.TableTemplates.register("rest_selection", (val, table, row, cell, name, opts) => {
    opts = opts || {};

    if ((val === null || val === undefined || val === "") && !opts.editable) {
        return "";
    }

    const container = document.createElement("div");
    const editable = opts.editable === true || opts.editable === "true";
    const multiselection = opts.multiselection || null;

    // the endpoint travels as a client built wx-service island, matching the
    // single configuration channel the server emits
    if (editable) {
        const editor = document.createElement("div");
        editor.id = "wx_" + Math.random().toString(36).slice(2, 7);
        if (opts.uri) {
            editor.appendChild(webexpress.webapp.ServiceRegistry.islandElement({
                name: "data", kind: "rest", baseUri: opts.uri, method: "GET"
            }));
        }
        const inputCtrl = new webexpress.webapp.InputSelectionCtrl(editor);
        inputCtrl.multiSelect = multiselection;
        inputCtrl.value = val;
        editor._wx_controller = inputCtrl;
        container.appendChild(editor);
        if (row.id) {
            container.dataset.objectId = row.id;
        }
        new webexpress.webui.SmartEditCtrl(container);
    } else {
        // read-only
        if (opts.uri) {
            container.appendChild(webexpress.webapp.ServiceRegistry.islandElement({
                name: "data", kind: "rest", baseUri: opts.uri, method: "GET"
            }));
        }
        const ctrl = new webexpress.webapp.SelectionCtrl(container);
        ctrl.value = val;
    }

    return container;
});

// Status renderer - condenses the cell value into a colored status dot, the
// table analog of the ControlStatusTask dot (red error, green done, yellow
// warning, blue running, gray pending).
webexpress.webui.TableTemplates.register("status", (val, table, row, cell, name, opts) => {
    opts = opts || {};

    const statuses = ["none", "pending", "running", "warning", "error", "done"];
    const token = (val === null || val === undefined) ? "" : String(val).trim().toLowerCase();
    const status = statuses.indexOf(token) !== -1 ? token : "none";
    const showLabel = opts.showLabel === true || opts.showLabel === "true";

    // an unknown/empty value with no caption has nothing to show
    if (status === "none" && !showLabel) {
        return "";
    }

    // the translated status name; falls back to the raw token when the i18n
    // bundle is absent (I18N.translate echoes the key for a missing entry)
    const key = "webexpress.webapp:statustask." + status;
    let label = status;
    if (webexpress.webui.I18N && typeof webexpress.webui.I18N.translate === "function") {
        const translated = webexpress.webui.I18N.translate(key);
        if (translated && translated !== key) {
            label = translated;
        }
    }

    const container = document.createElement("div");
    container.className = "wx-status-task";

    const dot = document.createElement("span");
    dot.className = "wx-status-dot wx-status-dot-" + status;
    dot.setAttribute("role", "img");
    dot.setAttribute("aria-label", label);
    container.setAttribute("title", label);
    container.appendChild(dot);

    if (showLabel) {
        const caption = document.createElement("span");
        caption.className = "wx-status-task-label";
        caption.textContent = label;
        container.appendChild(caption);
    }

    return container;
});

// RestCombo renderer - a single-select picker whose options are loaded from a
// REST endpoint; the single-choice sibling of rest_selection.
webexpress.webui.TableTemplates.register("rest_combo", (val, table, row, cell, name, opts) => {
    opts = opts || {};

    if ((val === null || val === undefined || val === "") && !opts.editable) {
        return "";
    }

    const container = document.createElement("div");
    const editable = opts.editable === true || opts.editable === "true";

    if (editable) {
        const editor = document.createElement("div");
        editor.id = "wx_" + Math.random().toString(36).slice(2, 7);
        if (opts.uri) {
            editor.appendChild(webexpress.webapp.ServiceRegistry.islandElement({
                name: "data", kind: "rest", baseUri: opts.uri, method: "GET"
            }));
        }
        const inputCtrl = new webexpress.webapp.InputSelectionCtrl(editor);
        // a combo is a single choice
        inputCtrl.multiSelect = false;
        inputCtrl.value = val;
        editor._wx_controller = inputCtrl;
        container.appendChild(editor);
        if (row.id) {
            container.dataset.objectId = row.id;
        }
        new webexpress.webui.SmartEditCtrl(container);
    } else {
        // read-only
        if (opts.uri) {
            container.appendChild(webexpress.webapp.ServiceRegistry.islandElement({
                name: "data", kind: "rest", baseUri: opts.uri, method: "GET"
            }));
        }
        const ctrl = new webexpress.webapp.SelectionCtrl(container);
        ctrl.value = val;
    }

    return container;
});

// RestTag renderer - free-text tags with autocomplete suggestions served by a
// REST endpoint. The read-only display needs no service: a tag is its own label.
webexpress.webui.TableTemplates.register("rest_tag", (val, table, row, cell, name, opts) => {
    opts = opts || {};

    if (!val && !opts.editable) {
        return "";
    }

    const container = document.createElement("div");
    const editable = opts.editable === true || opts.editable === "true";
    const placeholder = opts.placeholder || null;

    if (editable) {
        const editor = document.createElement("div");
        editor.setAttribute("name", name);
        const inputCtrl = new webexpress.webui.InputTagCtrl(editor);
        inputCtrl._placeholderText = placeholder;
        inputCtrl.value = val;
        editor._wx_controller = inputCtrl;

        // native-datalist autocomplete backed by the rest endpoint keeps the tag
        // input free-text while suggesting existing values, without the per-change
        // persistence of the modal tag surface (SmartEdit owns the save)
        if (opts.uri && inputCtrl._input) {
            const listId = "wxdl_" + Math.random().toString(36).slice(2, 7);
            const datalist = document.createElement("datalist");
            datalist.id = listId;
            inputCtrl._input.setAttribute("list", listId);
            editor.appendChild(datalist);

            let timer = null;
            inputCtrl._input.addEventListener("input", () => {
                const term = inputCtrl._input.value;
                if (timer) {
                    clearTimeout(timer);
                }
                timer = setTimeout(() => {
                    const url = opts.uri + (opts.uri.indexOf("?") !== -1 ? "&" : "?") + "q=" + encodeURIComponent(term || "");
                    webexpress.webapp.ServiceRegistry.request(url, { method: "GET", headers: { "Accept": "application/json" } })
                        .then((res) => {
                            if (!res || !res.ok) {
                                return;
                            }
                            const raw = Array.isArray(res.data) ? res.data : ((res.data && res.data.items) || []);
                            const values = webexpress.webapp._toTagValues(raw);
                            datalist.innerHTML = "";
                            for (const value of values) {
                                const option = document.createElement("option");
                                option.value = value;
                                datalist.appendChild(option);
                            }
                        });
                }, 200);
            });
        }

        if (row.id) {
            container.dataset.objectId = row.id;
        }
        container.appendChild(editor);
        new webexpress.webui.SmartEditCtrl(container);
    } else {
        // read-only - a tag is its own label, no service needed
        const ctrl = new webexpress.webui.TagCtrl(container);
        ctrl.value = val;
    }

    return container;
});
