/**
 * Supplies a generic REST cell editor while the application owns fields and authorization.
 * @param {*} value The current field value.
 * @param {object} table The owning REST table.
 * @param {object} row The row and its REST address.
 * @param {object} cell The cell model.
 * @param {string} name The column field name.
 * @param {object} options The display, editor and endpoint options.
 * @returns {HTMLElement} The display and editing host.
 */
webexpress.webui.TableTemplates.register("inline-edit", (value, table, row, cell, name, options) => {
    const ui = webexpress.webui;
    const host = document.createElement("span");
    const field = options.field || name;
    const endpoint = options.endpoint || row?.restApi;
    const stock = ui.TableTemplates.get(options.kind === "inline-edit" ? "text" : options.kind || "text");
    const display = document.createElement("span");
    const content = stock?.fn(value, table, row, cell, name, { ...stock.options, ...options, editable: false });
    if (content instanceof Node) display.appendChild(content);
    else display.textContent = content == null ? String(value ?? "") : String(content);
    host.appendChild(display);
    if (!endpoint || !field || options.editable === false) return host;

    /**
     * Builds a localized button without interpreting its label as markup.
     * @param {string} key The translation key suffix.
     * @returns {HTMLButtonElement} The button.
     */
    const button = key => {
        const element = document.createElement("button");
        element.type = "button";
        element.className = "btn btn-sm btn-outline-secondary";
        element.textContent = ui.I18N.translate("webexpress.webui:table.edit." + key);
        return element;
    };
    const edit = button("open");
    host.appendChild(edit);
    edit.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        if (host.querySelector("input,textarea,select")) return;
        const kind = options.editor || "text";
        const input = document.createElement(kind === "select" ? "select" : kind === "textarea" ? "textarea" : "input");
        input.className = "form-control";
        input.name = field;
        input.setAttribute("aria-label", field);
        if (input.tagName === "INPUT") input.type = ["text", "number", "date", "email", "url"].includes(kind) ? kind : "text";
        if (kind === "select") {
            for (const item of Array.isArray(options.items) ? options.items : []) {
                const option = document.createElement("option");
                option.value = String(item.value);
                option.textContent = item.text;
                input.appendChild(option);
            }
        }
        input.value = String(value ?? "");
        for (const key of ["placeholder", "min", "max", "step", "maxLength"]) {
            if (options[key] != null) input[key] = options[key];
        }
        const save = button("save");
        const cancel = button("cancel");
        const error = document.createElement("span");
        error.setAttribute("role", "alert");
        display.hidden = true;
        edit.hidden = true;
        host.append(input, save, cancel, error);
        input.addEventListener("click", event => event.stopPropagation());
        input.addEventListener("dblclick", event => event.stopPropagation());
        input.focus({ preventScroll: true });
        /** Restores the existing display after cancellation or successful persistence. */
        const close = () => {
            input.remove(); save.remove(); cancel.remove(); error.remove();
            display.hidden = false; edit.hidden = false;
        };
        cancel.addEventListener("click", event => { event.stopPropagation(); close(); });
        save.addEventListener("click", async event => {
            event.preventDefault();
            event.stopPropagation();
            if (save.disabled) return;
            save.disabled = true;
            cancel.disabled = true;
            input.disabled = true;
            const submitted = input.value;
            error.textContent = "";
            input.removeAttribute("aria-invalid");
            try {
                const url = new URL(endpoint, document.baseURI);
                if (row?.id != null) url.searchParams.set(options.idParameter || "id", String(row.id));
                const result = await webexpress.webapp.ServiceRegistry.request(url.toString(), {
                    method: options.method || "PATCH",
                    headers: { "Content-Type": "application/json", "Accept": "application/json" },
                    body: JSON.stringify({ [field]: submitted })
                });
                if (!result.ok) {
                    // a request the teardown cancelled is no failure to show
                    if (result.error?.kind === "abort") return;
                    // RestApiCrud answers a refused value as a bare error array; the rest form
                    // classification reads that and the map shape alike
                    const classified = webexpress.webapp.restFormModel.classifyResponse(false, result.status, result.data);
                    const errors = classified.errors || [];
                    const own = errors.filter(item => item.field && String(item.field).toLowerCase() === field.toLowerCase());
                    const general = errors.filter(item => !item.field);
                    // an error on another field still explains the refusal better than a generic text
                    const shown = own.length + general.length > 0 ? own.concat(general) : errors;
                    input.setAttribute("aria-invalid", String(own.length > 0));
                    error.textContent = shown.map(item => String(item.message)).join(" ")
                        || (classified.message == null ? "" : String(classified.message))
                        || result.error?.message || ui.I18N.translate("webexpress.webui:table.edit.error");
                    return;
                }
                value = submitted;
                if (cell) cell.content = submitted;
                display.textContent = submitted;
                close();
                table.update();
            } catch (failure) {
                error.textContent = failure.message || ui.I18N.translate("webexpress.webui:table.edit.error");
            } finally {
                save.disabled = false; cancel.disabled = false; input.disabled = false;
            }
        });
    });
    return host;
});
