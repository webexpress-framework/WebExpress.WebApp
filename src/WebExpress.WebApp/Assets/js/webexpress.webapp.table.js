/**
 * A rest table control extending the base Control class with column reordering functionality and visual indicators.
 * The following events are triggered:
 * - webexpress.webui.Event.TABLE_SORT_EVENT
 * - webexpress.webui.Event.COLUMN_REORDER_EVENT
 */
webexpress.webapp.TableCtrl = class extends webexpress.webui.TableCtrlReorderable {
    /**
     * Helper to create DOM elements with a class list.
     * @param {string} tag - The HTML tag for the element.
     * @param {string[]} [classList=[]] - A list of CSS classes to add to the element.
     * @returns {HTMLElement} The created DOM element.
     */
    _createElement(tag, classList = []) {
        const el = document.createElement(tag);
        if (classList) {
            classList.forEach(cls => el.classList.add(cls));
        }
        return el;
    }

    /**
     * Helper to create the progress bar element.
     * @returns {HTMLDivElement} The created progress bar container.
     */
    _createProgressDiv() {
        const div = this._createElement("div", ["progress"]);
        div.setAttribute("role", "status");
        div.style.height = "0.5em";
        const bar = this._createElement("div", [
            "progress-bar",
            "progress-bar-striped",
            "progress-bar-animated",
        ]);
        bar.style.width = "100%";
        div.appendChild(bar);
        return div;
    }

    /**
     * Creates an editor element based on its type.
     * @param {string} type - The editor type (e.g., 'text', 'editor', 'number').
     * @returns {HTMLElement} The created editor element.
     */
    _createEditorElement(type) {
        let editor;
        switch (type) {
            case 'editor':
                editor = document.createElement('div');
                editor.classList.add('wx-webui-editor');
                break;
            case 'number':
                editor = document.createElement('input');
                editor.type = 'number';
                break;
            case 'password':
                editor = document.createElement('input');
                editor.type = 'password';
                break;
            case 'text':
            default:
                editor = document.createElement('input');
                editor.type = 'text';
                break;
        }
        return editor;
    }

    // Fields
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
    _hasOptions = false;
    _columns = [];
    _rows = [];
    _options = [];

    // Placeholder columns and rows for loading state
    _previewColumns = [
        { content: "<span class='placeholder col-6 placeholder-lg'></span>" },
        { content: "<span class='placeholder col-6 placeholder-lg'></span>" },
        { content: "<span class='placeholder col-6 placeholder-lg'></span>" }
    ];
    _previewBody = [
        { cells: [{ content: "<span class='placeholder col-7'></span>" }, { content: "<span class='placeholder col-5'></span>" }, { content: "<span class='placeholder col-6'></span>" }] },
        { cells: [{ content: "<span class='placeholder col-6'></span>" }, { content: "<span class='placeholder col-7'></span>" }, { content: "<span class='placeholder col-5'></span>" }] },
        { cells: [{ content: "<span class='placeholder col-6'></span>" }, { content: "<span class='placeholder col-6'></span>" }, { content: "<span class='placeholder col-7'></span>" }] }
    ];

    /**
     * Constructor for the TableCtrl class.
     * @param {HTMLElement} element - The DOM element associated with the control.
     */
    constructor(element) {
        super(element);

        // get REST URI from data attribute or fallback to empty string
        this._restUri = element.dataset.uri || "";

        // remove REST URI attribute from DOM for security/cleanliness
        element.removeAttribute("data-uri");

        // build the toolbar (title and filter)
        const toolbar = this._createElement("div", ["wx-table-toolbar"]);
        toolbar.appendChild(this._titleDiv);
        toolbar.appendChild(this._filterDiv);

        // insert toolbar and progress bar at the top of the element
        element.prepend(toolbar, this._progressDiv);

        // build the status bar (status and pagination)
        const statusbar = this._createElement("div", ["wx-table-statusbar"]);
        statusbar.appendChild(this._statusDiv);
        statusbar.appendChild(this._paginationDiv);

        // append status bar at the bottom of the element
        element.appendChild(statusbar);

        // show placeholder columns and rows while loading
        this._columns = this._previewColumns;
        this._rows = this._previewBody;
        this._table.classList.add("placeholder-glow");
        this.render();

        // initialize filter control
        this._filterCtrl = new webexpress.webui.SearchCtrl(this._filterDiv);

        // listen for filter changes
        document.addEventListener(webexpress.webui.Event.CHANGE_FILTER_EVENT, (event) => {
            const data = event.detail || {};
            if (data.sender && data.sender === this._filterDiv) {
                this._filter = data.value;
                this._receiveData();
            }
        });

        // initialize pagination control
        this._paginationCtrl = new webexpress.webui.PaginationCtrl(this._paginationDiv);

        // listen for pagination changes
        document.addEventListener(webexpress.webui.Event.CHANGE_PAGE_EVENT, (event) => {
            const data = event.detail || {};
            if (data.sender && data.sender === this._paginationDiv) {
                this._page = data.page;
                this._receiveData();
                // scroll to top of the table
                window.scrollTo(0, element.offsetTop);
            }
        });

        // initial data load
        this._receiveData();
    }

    /**
     * Retrieve data from the REST API and update the table.
     */
    _receiveData() {
        this._progressDiv.style.visibility = "visible";

        const filter = encodeURIComponent(this._filter ?? "");
        const separator = this._restUri.includes('?') ? '&' : '?';
        const url = `${this._restUri}${separator}filter=${filter}&page=${this._page}`;

        fetch(url)
            .then(res => {
                if (!res.ok) {
                    throw new Error("Request failed");
                }
                return res.json();
            })
            .then(response => {
                // extract paging and data info with fallback defaults
                const page = response.pagination.page ?? 0;
                const pageSize = response.pagination.pageSize ?? 50;
                const total = response.pagination.total ?? 0;
                const totalPages = Math.ceil(total / pageSize);
                const startIndex = page * pageSize + 1;
                const endIndex = Math.min(startIndex + pageSize - 1, total);

                this._columns = response.columns;
                this._titleDiv.textContent = response.title;
                this._statusDiv.textContent = `${startIndex} - ${endIndex} / ${total}`;

                // fire event for data arrival
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

                this._table.classList.remove("placeholder-glow");

                // bind edit/delete actions to each row, if applicable
                this._rows = response.rows.map(row => {
                    if (Array.isArray(row.options)) {
                        this._hasOptions = true;
                        row.options.forEach(option => {
                            const uri = option.uri || "";
                            option.uri = "javascript:void(0)";
                            if (option.command === "edit") {
                                option.action = () => {
                                    this._editRow(row.id, this._columns, row.cells, uri);
                                };
                            } else if (option.command === "delete") {
                                option.action = () => {
                                    this._deleteRow(row.id);
                                };
                            }
                        });
                    }
                    return row;
                });

                if (this._options?.length > 0) {
                    this._hasOptions = true;
                }

                this.render();
                this._progressDiv.style.visibility = "hidden";
            })
            .catch(error => {
                // log any errors in retrieving data
                console.error("The request could not be completed successfully:", error);
            });
    }

    /**
     * Renders a single row.
     * @param {Object} row Row object.
     * @param {number} depth Depth.
     * @param {DocumentFragment} fragment Target fragment.
     */
    _addRow(row, depth = 0, fragment) {
        const tr = document.createElement("tr");
        this._util.addClasses(tr, row.color);
        this._util.addClasses(tr, row.class);
        if (row.style) {
            tr.setAttribute("style", row.style);
        }
        tr._dataRowRef = row;
        row._anchorTr = tr;
        row._depth = depth;

        if (this._movableRow) {
            const handle = document.createElement("td");
            handle.className = "wx-table-drag-handle";
            handle.textContent = "☰";
            handle.title = this._i18n("webexpress.webui:table.handle.title", "Move");
            handle.setAttribute("aria-label", "Move row");
            tr.appendChild(handle);
            this._enableDragAndDropRow(handle, row);
        }

        let visibleColCounter = 0;

        for (let idx = 0; idx < this._columns.length; idx++) {
            const colDef = this._columns[idx];
            if (!colDef.visible) {
                continue;
            }
            const td = document.createElement("td");
            const cell = row.cells[idx];
            const isFirstVisible = (visibleColCounter === 0);
            visibleColCounter += 1;

            if (cell) {
                this._util.addClasses(td, cell.color);
                this._util.addClasses(td, cell.class);
                if (cell.style) {
                    td.setAttribute("style", cell.style);
                }

                const wrap = document.createElement("div");

                // cell media
                if (cell.image) {
                    const img = document.createElement("img");
                    img.className = "wx-icon";
                    img.src = cell.image;
                    img.alt = "";
                    wrap.appendChild(img);
                }
                if (cell.icon) {
                    const i = document.createElement("i");
                    i.className = cell.icon;
                    wrap.appendChild(i);
                }

                // content/template/edit
                const isEditable = colDef.editor != null;

                if (colDef.template) {
                    const templateNode = this._createEditorElement('template');
                    templateNode.innerHTML = colDef.template;
                    wrap.appendChild(templateNode);
                    const smartView = new webexpress.webui.SmartViewCtrl(wrap);
                    smartView.value = cell.text || "";
                } else if (isEditable) {
                    wrap.setAttribute('data-form-action', `${this._restUri}?id=${row.id}`);
                    wrap.setAttribute('data-object-name', colDef.name);

                    const editorNode = this._createEditorElement(colDef.editor);
                    wrap.appendChild(editorNode);
                    const smartEdit = new webexpress.webui.SmartEditCtrl(wrap);
                    smartEdit.value = cell.text || "";
                } else {
                    wrap.appendChild(document.createTextNode(cell.text || ""));
                }

                // link precedence: cell.uri > row.uri for first visible column
                if (!isEditable) {
                    const cellHref = cell?.uri || null;
                    const cellTarget = cell?.target || null;
                    const rowHref = row?.uri || null;
                    const rowTarget = row?.target || null;

                    let hrefToUse = null;
                    let targetToUse = null;

                    if (cellHref) {
                        hrefToUse = cellHref;
                        targetToUse = cellTarget || null;
                    } else if (isFirstVisible && rowHref) {
                        hrefToUse = rowHref;
                        targetToUse = rowTarget || null;
                    }

                    if (hrefToUse) {
                        const a = document.createElement("a");
                        a.href = hrefToUse;
                        a.className = "wx-link"; // add link class
                        if (targetToUse) {
                            a.target = targetToUse;
                        }
                        while (wrap.firstChild) {
                            a.appendChild(wrap.firstChild);
                        }
                        wrap.appendChild(a);
                    }
                }

                td.appendChild(wrap);
            }
            tr.appendChild(td);
        }

        if (row.options && row.options.length) {
            const td = document.createElement("td");
            const div = document.createElement("div");
            div.dataset.icon = "fas fa-cog";
            div.dataset.size = "btn-sm";
            div.dataset.border = "false";
            new webexpress.webui.DropdownCtrl(div).items = row.options;
            td.appendChild(div);
            tr.appendChild(td);
        } else if (this._hasOptions || this._options.length > 0 || this._allowColumnRemove) {
            tr.appendChild(document.createElement("td"));
        }

        if (this._isTree) {
            this._injectTreeToggle(tr, row, depth);
        } else {
            this._injectRowDecorationsFlat(tr, row);
        }

        fragment.appendChild(tr);
    }

    /**
     * Edit a row and send a PUT request to the REST API.
     * @param {number} rowId - The ID of the row to be edited.
     * @param {Array} columns - The columns of the table.
     * @param {Array} cells - The cells of the row to be edited.
     * @param {string} uri - The URI for the form to be used for editing.
     */
    _editRow(rowId, columns, cells, uri) {
        const editModal = new webexpress.webapp.ModalFormCtrl();
        editModal._uri = uri;
        editModal._selector = uri?.includes("#") ? "#" + uri.split("#")[1] : "form";
        editModal._titleH1.textContent = webexpress.webui.I18N.translate("webexpress.webapp:form.edit_row");
        editModal._dialogDiv.className = "modal-dialog modal-dialog-scrollable modal-xl";

        // Bind form submission logic
        editModal._form.addEventListener("submit", async (event) => {
            event.preventDefault();

            const formData = new FormData(editModal._form);

            try {
                const response = await fetch(`${this._restUri}?id=${rowId}`, {
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
                console.error(`Failed to edit row with ID ${rowId}.`, error);
            }
        });

        // Fill the form fields with the row's values after the form is rendered
        editModal._element.addEventListener(webexpress.webui.Event.UPDATED_EVENT, (event) => {
            const form = event.detail.form;
            if (form === editModal._form) {
                columns.forEach((column, index) => {
                    const value = cells[index]?.text || "";
                    const field = form.elements.namedItem(column.name);
                    if (field) {
                        // handle standard form fields
                        field.value = value;
                    } else {
                        // handle custom editor controls
                        const editorContainer = form.querySelector(`[name="${column.name}"]`);
                        if (editorContainer) {
                            const editorType = column.editor || 'text';

                            // handle various editors
                            switch (editorType) {
                                case "password":
                                case "number":
                                case "date":
                                case "time":
                                case "datetime":
                                case "color":
                                case "email":
                                case "url":
                                case "tel":
                                case "editor":
                                case "tag":
                                case "selection":
                                case "move":
                                    {
                                        const instance = webexpress.webui.Controller.getInstanceByElement(editorContainer);
                                        if (instance && typeof instance.value !== 'undefined') {
                                            instance.value = value;
                                        } else {
                                            // fallback for non-component based editors
                                            editorContainer.innerHTML = value;
                                        }
                                    }
                                    break;
                                case "unique":
                                    editorContainer.setAttribute("data-value", value);
                                    break;
                                case "text":
                                default:
                                    editorContainer.innerHTML = value;
                                    break;
                            }
                        }
                    }
                });
            }
        });

        editModal.show();
    }

    /**
     * Delete a row and send a DELETE request to the REST API.
     * @param {number} rowId - The ID of the row to be deleted.
     */
    _deleteRow(rowId) {
        const confirmModal = new webexpress.webui.ModalConfirmDelete();

        confirmModal.confirmation(() => {
            fetch(`${this._restUri}?id=${rowId}`, { method: "DELETE" })
                .then(response => {
                    if (!response.ok) {
                        throw new Error("Failed to delete row");
                    }
                    this._receiveData();
                })
                .catch(error => console.error(`Failed to delete row with ID ${rowId}.`, error));
        });

        confirmModal.show();
    }
}

// Register the class in the controller
webexpress.webui.Controller.registerClass("wx-webapp-table", webexpress.webapp.TableCtrl);