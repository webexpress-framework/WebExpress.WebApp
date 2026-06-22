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
