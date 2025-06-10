/**
 * A rest table control extending the base Control class with column reordering functionality and visual indicators.
 * The following events are triggered:
 * - webexpress.webui.Event.TABLE_SORT_EVENT
 * - webexpress.webui.Event.COLUMN_REORDER_EVENT
 */
webexpress.webapp.TableCtrl = class extends webexpress.webui.TableCtrl {
    // Helper to create DOM elements with class list
    _createElement(tag, classList = []) {
        const el = document.createElement(tag);
        classList.forEach(cls => el.classList.add(cls));
        return el;
    }

    // Helper to create the progress bar
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
        { label: "<span class='placeholder col-6 placeholder-lg'></span>" },
        { label: "<span class='placeholder col-6 placeholder-lg'></span>" },
        { label: "<span class='placeholder col-6 placeholder-lg'></span>" }
    ];
    _previewBody = [
        { cells: [{ text: "<span class='placeholder col-7'></span>" }, { text: "<span class='placeholder col-5'></span>" }, { text: "<span class='placeholder col-6'></span>" }] },
        { cells: [{ text: "<span class='placeholder col-6'></span>" }, { text: "<span class='placeholder col-7'></span>" }, { text: "<span class='placeholder col-5'></span>" }] },
        { cells: [{ text: "<span class='placeholder col-6'></span>" }, { text: "<span class='placeholder col-6'></span>" }, { text: "<span class='placeholder col-7'></span>" }] }
    ];

    /**
     * Constructor for the TableCtrl class.
     * @param {HTMLElement} element - The DOM element associated with the control.
     */
    constructor(element) {
        super(element);

        // Get REST URI from data attribute or fallback to empty string
        this._restUri = element.dataset.uri || "";

        // Remove REST URI attribute from DOM for security/cleanliness
        element.removeAttribute("data-uri");

        // Build the toolbar (title and filter)
        const toolbar = this._createElement("div", ["wx-table-toolbar"]);
        toolbar.appendChild(this._titleDiv);
        toolbar.appendChild(this._filterDiv);

        // Insert toolbar and progress bar at the top of the element
        element.prepend(toolbar, this._progressDiv);

        // Build the status bar (status and pagination)
        const statusbar = this._createElement("div", ["wx-table-statusbar"]);
        statusbar.appendChild(this._statusDiv);
        statusbar.appendChild(this._paginationDiv);

        // Append status bar at the bottom of the element
        element.appendChild(statusbar);

        // Show placeholder columns and rows while loading
        this._columns = this._previewColumns;
        this._rows = this._previewBody;
        this._table.classList.add("placeholder-glow");
        this.render();

        // Initialize filter control
        this._filterCtrl = new webexpress.webui.SearchCtrl(this._filterDiv);

        // Listen for filter changes
        document.addEventListener(webexpress.webui.Event.CHANGE_FILTER_EVENT, (event) => {
            const data = event.detail || {};
            if (data.sender && data.sender === this._filterDiv) {
                this._filter = data.value;
                this._receiveData();
            }
        });

        // Initialize pagination control
        this._paginationCtrl = new webexpress.webui.PaginationCtrl(this._paginationDiv);

        // Listen for pagination changes
        document.addEventListener(webexpress.webui.Event.CHANGE_PAGE_EVENT, (event) => {
            const data = event.detail || {};
            if (data.sender && data.sender === this._paginationDiv) {
                this._page = data.page;
                this._receiveData();
                // Scroll to top of the table
                window.scrollTo(0, element.offsetTop);
            }
        });

        // Initial data load
        this._receiveData();
    }

    /**
     * Retrieve data from REST API and update the table.
     */
    _receiveData() {
        this._progressDiv.style.visibility = "visible";

        const filter = encodeURIComponent(this._filter ?? "");
        const url = `${this._restUri}?filter=${filter}&page=${this._page}`;

        fetch(url)
            .then(res => {
                if (!res.ok) throw new Error("Request failed");
                return res.json();
            })
            .then(response => {
                // Extract paging and data info with fallback defaults
                const page = response.page ?? 0;
                const pageSize = response.pageSize ?? 50;
                const total = response.total ?? 0;
                const totalPages = Math.ceil(total / pageSize);
                const startIndex = page * pageSize + 1;
                const endIndex = Math.min(startIndex + pageSize - 1, total);

                this._columns = response.columns;
                this._titleDiv.textContent = response.title;
                this._statusDiv.textContent = `${startIndex} - ${endIndex} / ${total}`;

                // Fire event for data arrival
                const evt = new CustomEvent(webexpress.webui.Event.DATA_ARRIVED_EVENT, {
                    detail: {
                        id: this._element.id,
                        response: response
                    }
                });
                this._element.dispatchEvent(evt);

                // Update pagination control
                this._paginationCtrl.total = totalPages;
                this._paginationCtrl.page = page;

                this._table.classList.remove("placeholder-glow");

                // Bind edit/delete actions to each row, if applicable
                this._rows = response.rows.map(row => {
                    if (Array.isArray(row.options)) {
                        this._hasOptions = true;
                        row.options.forEach(option => {
                            if (option.command === "edit") {
                                option.action = () => this._editRow(row.id, option.uri);
                            }
                            if (option.command === "delete") {
                                option.action = () => this._deleteRow(row.id);
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
                // Log any errors in retrieving data
                console.error("The request could not be completed successfully:", error);
            });
    }

    /**
     * Edit a row and send a PUT request to the REST API.
     * @param {number} rowId - The ID of the row to be edited.
     * @param {string} uri - The uri for the form to be used for editing.
     */
    _editRow(rowId, uri) {
        const editModal = new webexpress.webapp.ModalFormCtrl();
        editModal._uri = uri;
        editModal._selector = uri?.includes("#") ? "#" + uri.split("#")[1] : "form";

        // Bind form submission logic
        editModal._form.addEventListener("submit", (event) => {
            fetch(`${this._restUri}?id=${rowId}`, { method: "PUT" })
                .then(response => {
                    if (!response.ok) throw new Error("Failed to edit row");
                    this._receiveData();
                })
                .catch(error => console.error(`Failed to edit row with ID ${rowId}.`, error));
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
                    if (!response.ok) throw new Error("Failed to delete row");
                    this._receiveData();
                })
                .catch(error => console.error(`Failed to delete row with ID ${rowId}.`, error));
        });

        confirmModal.show();
    }
}

// Register the class in the controller
webexpress.webui.Controller.registerClass("wx-webapp-table", webexpress.webapp.TableCtrl);