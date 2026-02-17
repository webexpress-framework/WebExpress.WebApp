/**
 * A REST-backed list control extending the base flat ListCtrl.
 * - simple list view without toolbar or pagination controls
 * - shows bootstrap placeholders while loading
 * - queries a REST endpoint
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
        if (classList.length) {
            el.classList.add(...classList);
        }
        return el;
    }

    /**
     * Helper: creates a compact progress bar.
     * @returns {HTMLDivElement} progress container.
     */
    _createProgressDiv() {
        const div = this._createElement("div", ["progress", "mb-2"]);
        div.setAttribute("role", "status");
        div.style.height = "0.25rem"; // thin line
        
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
    _progressDiv = this._createProgressDiv();
    
    // placeholder items for loading state
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

        // insert progress at top
        element.prepend(this._progressDiv);

        // show placeholders while loading
        // list element is inherited from base class (this._list or via public api)
        // access base list element directly via dom lookup if private, 
        // but since we extend ListCtrl, usually the container IS the element or contains the list.
        // based on base class, the ul is appended to element.
        const listUl = element.querySelector("ul.wx-list");
        if (listUl) {
            listUl.classList.add("placeholder-glow");
        }

        // set preview items using base class method
        this.setItems(this._previewItems.map(pi => {
            return {
                id: null,
                class: null,
                style: null,
                color: null,
                editable: false,
                content: { content: "", html: (pi.content?.html instanceof Element) ? pi.content.html.cloneNode(true) : null },
                options: null
            };
        }));

        // initial data load
        this._receiveData();
    }

    /**
     * Retrieves data from the REST endpoint and updates the list.
     */
    _receiveData() {
        this._progressDiv.style.visibility = "visible";

        // basic fetch without pagination/filter params
        fetch(this._restUri)
            .then(res => {
                if (!res.ok) {
                    throw new Error("Request failed");
                }
                return res.json();
            })
            .then(response => {
                // emit data arrived event
                const evt = new CustomEvent(webexpress.webui.Event.DATA_ARRIVED_EVENT, {
                    detail: {
                        id: this._element.id,
                        response: response
                    }
                });
                this._element.dispatchEvent(evt);

                // remove placeholder state
                const listUl = this._element.querySelector("ul.wx-list");
                if (listUl) {
                    listUl.classList.remove("placeholder-glow");
                }

                // map response into list items
                const mappedItems = this._mapResponseToItems(response);

                // bind edit/delete option actions if present
                mappedItems.forEach(item => {
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

                // update list via base class
                this.setItems(mappedItems);
                
                // hide progress
                this._progressDiv.style.visibility = "hidden";
            })
            .catch(error => {
                console.error("The request could not be completed successfully:", error);
                this._progressDiv.style.visibility = "hidden";
            });
    }

    /**
     * Maps a server response to internal list item structures.
     * @param {any} response server payload.
     * @returns {Array<Object>} normalized items for ListCtrl.
     */
    _mapResponseToItems(response) {
        const result = [];

        // handle response.items array
        if (Array.isArray(response?.items)) {
            for (const it of response.items) {
                if (typeof it === "string") {
                    result.push({
                        id: null,
                        content: { content: it }
                    });
                } else if (it && typeof it === "object") {
                    // detect optional html template
                    let htmlEl = null;
                    if (it.html instanceof Element) {
                        htmlEl = it.html.cloneNode(true);
                    } else if (typeof it.html === "string") {
                        const tmp = document.createElement("span");
                        tmp.innerHTML = it.html;
                        htmlEl = tmp.firstElementChild ? tmp : null;
                    }

                    result.push({
                        id: it.id || null,
                        class: it.class || null,
                        style: it.style || null,
                        color: it.color || null,
                        editable: !!it.editable,
                        rendererType: it.rendererType || it.type || null, // pass through type for templates
                        rendererOptions: it.rendererOptions || {},
                        content: {
                            content: (it.content ?? it.label ?? it.name ?? ""),
                            html: htmlEl,
                            image: it.image || null,
                            icon: it.icon || null,
                            uri: it.uri || null,
                            target: it.target || null,
                            modal: it.modal || null,
                            objectId: it.objectId || null,
                            item: it.item || null // item data for forms
                        },
                        // action attributes
                        primaryAction: it.primaryAction || null,
                        secondaryAction: it.secondaryAction || null,
                        bind: it.bind || null,

                        options: Array.isArray(it.options) ? it.options : null
                    });
                }
            }
            return result;
        }

        // fallback: transform table-like rows
        if (Array.isArray(response?.rows)) {
            for (const item of response.rows) {
                const firstText = Array.isArray(item?.cells) && item.cells.length ? (item.cells[0]?.content ?? "") : "";
                result.push({
                    id: item?.id ?? null,
                    class: item?.class ?? null,
                    style: item?.style ?? null,
                    color: item?.color ?? null,
                    editable: false,
                    content: { content: firstText },
                    
                    // action attributes
                    primaryAction: item.primaryAction || null,
                    secondaryAction: item.secondaryAction || null,
                    bind: item.bind || null,

                    options: Array.isArray(item?.options) ? item.options : null
                });
            }
            return result;
        }

        return result;
    }

    /**
     * Opens an edit modal and submits changes via PUT.
     * @param {Object} item list item descriptor.
     * @param {string} uri form uri to load inside the modal.
     */
    _editItem(item, uri) {
        if (!webexpress.webapp.ModalFormCtrl) {
            console.warn("ModalFormCtrl not available");
            return;
        }

        const editModal = new webexpress.webapp.ModalFormCtrl();
        editModal._uri = uri;
        editModal._selector = uri?.includes("#") ? ("#" + uri.split("#")[1]) : "form";
        
        // title handling depends on i18n availability
        const titleText = webexpress.webui.I18N ? webexpress.webui.I18N.translate("webexpress.webapp:form.edit_item") : "Edit Item";
        if (editModal._titleH1) {
            editModal._titleH1.textContent = titleText;
        }
        
        if (editModal._dialogDiv) {
            editModal._dialogDiv.className = "modal-dialog modal-dialog-scrollable modal-lg";
        }

        // bind submit handling
        if (editModal._form) {
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
        }

        // prefill logic
        editModal._element.addEventListener(webexpress.webui.Event.UPDATED_EVENT, (event) => {
            const form = event.detail.form;
            if (form === editModal._form && item.content?.item) {
                Object.entries(item.content.item).forEach(([content_field, value]) => {
                    let field = editModal._form.elements.namedItem(content_field);
                    if (field) {
                        field.value = value;
                    } else {
                        const editorContainer = form.querySelector(`[name="${content_field}"]`);
                        if (editorContainer) {
                            editorContainer.innerHTML = String(value ?? "");
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
        if (!webexpress.webui.ModalConfirmDelete) {
            // fallback if modal not available
            if (confirm("Delete this item?")) {
                this._performDelete(itemId);
            }
            return;
        }

        const confirmModal = new webexpress.webui.ModalConfirmDelete();
        confirmModal.confirmation(() => {
            this._performDelete(itemId);
        });
        confirmModal.show();
    }

    /**
     * Executes the delete network request.
     * @param {string|number|null} itemId id.
     */
    _performDelete(itemId) {
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
    }
};

// register the class in the controller
webexpress.webui.Controller.registerClass("wx-webapp-list", webexpress.webapp.ListCtrl);