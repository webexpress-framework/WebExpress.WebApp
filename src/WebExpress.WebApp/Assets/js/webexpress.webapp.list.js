/**
 * A REST-backed list control extending the base flat ListCtrl.
 * - builds a toolbar (title + filter), a progress bar, and a status bar (status text + pagination)
 * - shows bootstrap placeholders while loading
 * - queries a REST endpoint with filter and page parameters
 * - dispatches a data-arrived event on successful retrieval
 * - supports per-item edit and delete actions bound from server-provided options
 */
webexpress.webapp.ListCtrl = class extends webexpress.webui.ListCtrl {

    /**
     * Helper: creates an element and assigns bootstrap classes.
     * @param {string} tag html tag name.
     * @param {Array<string>} classList classes to add.
     * @returns {HTMLElement} created element.
     */
    _createElement(tag, classList = []) {
        const el = document.createElement(tag);
        classList.forEach(cls => {
            el.classList.add(cls);
        });
        return el;
    }

    /**
     * Helper: creates a compact progress bar.
     * @returns {HTMLDivElement} progress container.
     */
    _createProgressDiv() {
        const div = this._createElement("div", ["progress"]);
        div.setAttribute("role", "status");
        div.style.height = "0.5em";
        const bar = this._createElement("div", [
            "progress-bar",
            "progress-bar-striped",
            "progress-bar-animated"
        ]);
        bar.style.width = "100%";
        div.appendChild(bar);
        return div;
    }

    // fields
    _restUri = "";
    _titleDiv = this._createElement("h3", ["me-auto"]);
    _progressDiv = this._createProgressDiv();
    _filterDiv = this._createElement("div", ["col-3"]);
    _filterCtrl = null;
    _statusDiv = this._createElement("span");
    _paginationDiv = this._createElement("div", ["justify-content-end"]);
    _paginationCtrl = null;
    _filter = null;
    _page = 0;

    // placeholder items for loading state (wrapper with child ensures firstElementChild exists)
    _previewItems = [
        { id: null, editable: false, content: { html: (() => { const w = document.createElement("span"); const s = document.createElement("span"); s.className = "placeholder col-8 placeholder-lg"; w.appendChild(s); return w; })() } },
        { id: null, editable: false, content: { html: (() => { const w = document.createElement("span"); const s = document.createElement("span"); s.className = "placeholder col-6 placeholder-lg"; w.appendChild(s); return w; })() } },
        { id: null, editable: false, content: { html: (() => { const w = document.createElement("span"); const s = document.createElement("span"); s.className = "placeholder col-7 placeholder-lg"; w.appendChild(s); return w; })() } }
    ];

    /**
     * Constructor for the REST ListCtrl.
     * @param {HTMLElement} element host element.
     */
    constructor(element) {
        super(element);

        // read rest uri and clean attribute
        this._restUri = element.dataset.uri || "";
        element.removeAttribute("data-uri");

        // build toolbar
        const toolbar = this._createElement("div", ["wx-list-toolbar", "d-flex", "align-items-center", "gap-2", "mb-2"]);
        toolbar.appendChild(this._titleDiv);
        toolbar.appendChild(this._filterDiv);

        // insert toolbar and progress at top
        element.prepend(toolbar, this._progressDiv);

        // build status bar
        const statusbar = this._createElement("div", ["wx-list-statusbar", "d-flex", "align-items-center", "justify-content-between", "mt-2"]);
        statusbar.appendChild(this._statusDiv);
        statusbar.appendChild(this._paginationDiv);

        // append statusbar at bottom
        element.appendChild(statusbar);

        // show placeholders while loading
        this._list.classList.add("placeholder-glow");
        this._items = this._previewItems.map(pi => {
            return {
                id: null,
                class: null,
                style: null,
                color: null,
                editable: false,
                // clone the preview node to avoid reusing the same element
                content: { text: "", html: (pi.content?.html instanceof Element) ? pi.content.html.cloneNode(true) : null },
                options: null
            };
        });
        this.render();

        // init filter control
        this._filterCtrl = new webexpress.webui.SearchCtrl(this._filterDiv);

        // listen for filter changes
        document.addEventListener(webexpress.webui.Event.CHANGE_FILTER_EVENT, (event) => {
            const data = event.detail || {};
            if (data.sender && data.sender === this._filterDiv) {
                this._filter = data.value;
                this._receiveData();
            }
        });

        // init pagination control
        this._paginationCtrl = new webexpress.webui.PaginationCtrl(this._paginationDiv);

        // listen for pagination changes
        document.addEventListener(webexpress.webui.Event.CHANGE_PAGE_EVENT, (event) => {
            const data = event.detail || {};
            if (data.sender && data.sender === this._paginationDiv) {
                this._page = data.page;
                this._receiveData();
                // scroll to top of the list
                window.scrollTo(0, element.offsetTop);
            }
        });

        // initial data load
        this._receiveData();
    }

    /**
     * Retrieves data from the REST endpoint and updates the list.
     */
    _receiveData() {
        this._progressDiv.style.visibility = "visible";

        const filter = encodeURIComponent(this._filter ?? "");
        const url = `${this._restUri}?search=${filter}&page=${this._page}`;

        fetch(url)
            .then(res => {
                if (!res.ok) {
                    throw new Error("Request failed");
                }
                return res.json();
            })
            .then(response => {
                // extract pagination meta with fallbacks
                const page = response?.pagination?.page ?? 0;
                const pageSize = response?.pagination?.pageSize ?? 50;
                const total = response?.pagination?.total ?? 0;
                const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
                const startIndex = total > 0 ? (page * pageSize + 1) : 0;
                const endIndex = total > 0 ? Math.min(startIndex + pageSize - 1, total) : 0;

                // update header + status
                this._titleDiv.textContent = response?.title || "";
                this._statusDiv.textContent = `${startIndex} - ${endIndex} / ${total}`;

                // emit data arrived event
                const evt = new CustomEvent(webexpress.webui.Event.DATA_ARRIVED_EVENT, {
                    detail: {
                        id: this._element.id,
                        response: response
                    }
                });
                this._element.dispatchEvent(evt);

                // update pagination control
                this._paginationCtrl.total = totalPages;
                this._paginationCtrl.page = page;

                // remove placeholder state
                this._list.classList.remove("placeholder-glow");

                // map response into list items
                this._items = this._mapResponseToItems(response);

                // bind edit/delete option actions if present
                this._items.forEach(item => {
                    if (Array.isArray(item.options)) {
                        item.options.forEach(opt => {
                            if (opt?.command === "edit") {
                                const uri = opt.uri;
                                opt.action = () => {
                                    this._editItem(item, uri);
                                };
                            } else if (opt?.command === "delete") {
                                opt.uri = "javascript:void(0);";
                                opt.action = () => {
                                    this._deleteItem(item.id);
                                };
                            }
                        });
                    }
                });

                // render and hide progress
                this.render();
                this._progressDiv.style.visibility = "hidden";
            })
            .catch(error => {
                // log any retrieval errors
                console.error("The request could not be completed successfully:", error);
            });
    }

    /**
     * Maps a server response to internal list item structures.
     * @param {any} response server payload.
     * @returns {Array<Object>} normalized items for ListCtrl.
     */
    _mapResponseToItems(response) {
        const result = [];

        if (Array.isArray(response?.items)) {
            for (const it of response.items) {
                if (typeof it === "string") {
                    result.push({
                        id: null,
                        class: null,
                        style: null,
                        color: null,
                        editable: false,
                        content: { text: it, html: null, image: null, icon: null, uri: null, target: null, modal: null, objectId: null },
                        options: null
                    });
                } else if (it && typeof it === "object") {
                    // detect optional html template (element or string), only use if a first child exists
                    let htmlEl = null;
                    if (it.html instanceof Element) {
                        htmlEl = it.html.cloneNode(true);
                    } else if (typeof it.html === "string") {
                        const tmp = document.createElement("span");
                        tmp.innerHTML = it.html;
                        htmlEl = tmp.firstElementChild ? tmp : null; // only accept if element child exists
                    }

                    result.push({
                        id: it.id || null,
                        class: it.class || null,
                        style: it.style || null,
                        color: it.color || null,
                        editable: !!it.editable,
                        content: {
                            text: (it.text ?? it.label ?? it.name ?? ""),
                            html: htmlEl,
                            image: it.image || null,
                            icon: it.icon || null,
                            uri: it.uri || null,
                            target: it.target || null,
                            modal: it.modal || null,
                            objectId: it.objectId || null,
                            item: it.item || null
                        },
                        options: Array.isArray(it.options) ? it.options : null
                    });
                }
            }
            return result;
        }

        // fallback: transform table-like rows to list items using first cell's text
        if (Array.isArray(response?.rows)) {
            for (const row of response.rows) {
                const firstText = Array.isArray(row?.cells) && row.cells.length ? (row.cells[0]?.text ?? "") : "";
                result.push({
                    id: row?.id ?? null,
                    class: row?.class ?? null,
                    style: row?.style ?? null,
                    color: row?.color ?? null,
                    editable: false,
                    content: { text: firstText, html: null, image: null, icon: null, uri: null, target: null, modal: null, objectId: null },
                    options: Array.isArray(row?.options) ? row.options : null
                });
            }
            return result;
        }

        // default: empty
        return result;
    }

    /**
     * Opens an edit modal and submits changes via PUT.
     * @param {Object} item list item descriptor.
     * @param {string} uri form uri to load inside the modal.
     */
    _editItem(item, uri) {
        const editModal = new webexpress.webapp.ModalFormCtrl();
        editModal._uri = uri;
        editModal._selector = uri?.includes("#") ? ("#" + uri.split("#")[1]) : "form";
        editModal._titleH1.textContent = webexpress.webui.I18N.translate("webexpress.webapp:form.edit_item");
        editModal._dialogDiv.className = "modal-dialog modal-dialog-scrollable modal-lg";

        // bind submit handling
        editModal._form.addEventListener("submit", async (event) => {
            event.preventDefault();
            const formData = new FormData(editModal._form);

            try {
                const response = await fetch(`${this._restUri}?id=${encodeURIComponent(item?.id ?? "")}`, {
                    method: "PUT",
                    body: formData
                });

                if (response.ok) {
                    this._receiveData();
                    editModal.hide();
                    return;
                }

                if (response.status === 400) {
                    const errors = await response.json();
                    editModal.showValidationErrors(errors);
                    return;
                }

                throw new Error(`HTTP ${response.status}`);
            } catch (error) {
                console.error(`Failed to edit item with ID ${item?.id}.`, error);
            }
        });

        // after modal content has rendered, try to prefill typical fields
        editModal._element.addEventListener(webexpress.webui.Event.UPDATED_EVENT, (event) => {
            const form = event.detail.form;
            if (form === editModal._form) {
                Object.entries(item.content?.item).forEach(([content_field, value], index) => {
                    // try standard form field
                    let field = editModal._form.elements.namedItem(content_field);
                    if (field) {
                        field.value = value;
                    } else {
                        const editorContainer = form.querySelector(`[name="${content_field}"]`);
                        if (editorContainer) {
                            // check which editor type is present
                            let editorType = "default";
                            if (editorContainer.classList.contains("wx-webui-editor")) {
                                editorType = "wx-webui-editor";
                            }

                            // handle various editors
                            switch (editorType) {
                                case "wx-webui-editor":
                                    editorContainer.innerHTML = value;
                                    break;
                                default:
                                    // fallback: set innerHTML directly
                                    editorContainer.innerHTML = value;
                            }
                        }
                    }
                });
            }
        });

        editModal.show();
    }

    /**
     * Deletes an item via DELETE request with confirmation modal.
     * @param {string|number|null} itemId id of the item to delete.
     */
    _deleteItem(itemId) {
        const confirmModal = new webexpress.webui.ModalConfirmDelete();

        confirmModal.confirmation(() => {
            fetch(`${this._restUri}?id=${encodeURIComponent(itemId ?? "")}`, { method: "DELETE" })
                .then(response => {
                    if (!response.ok) {
                        throw new Error("Failed to delete item");
                    }
                    this._receiveData();
                })
                .catch(error => {
                    console.error(`Failed to delete item with ID ${itemId}.`, error);
                });
        });

        confirmModal.show();
    }
};

// register class
webexpress.webui.Controller.registerClass("wx-webapp-list", webexpress.webapp.ListCtrl);