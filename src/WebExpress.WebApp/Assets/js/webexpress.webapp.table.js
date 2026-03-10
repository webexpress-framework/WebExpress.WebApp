/**
 * A REST-enabled table control that extends the reorderable table class and
 * integrates with a REST API. Supports standard pagination.
 *
 * Emits events:
 * - webexpress.webui.Event.DATA_ARRIVED_EVENT
 * - webexpress.webui.Event.UPDATE_PAGINATION_EVENT (custom event to synchronize external pager)
 */
webexpress.webapp.TableCtrl = class extends webexpress.webui.TableCtrlReorderable {
    // configuration
    _restUri = "";

    // state
    _orderBy = null;
    _orderDir = null;
    _filter = "";
    _wql = "";
    _page = 0;
    _pageSize = 50;
    _totalRecords = 0;
    _isLoading = false;

    // ui helpers
    _progressDiv = null;
    _abortController = null;

    // pager & info
    _pagerElement = null;
    _pagerCtrl = null;
    _infoDiv = null;

    // placeholder data shown while initial load is in progress
    _previewColumns = [
        { label: "", width: null, visible: true },
        { label: "", width: null, visible: true },
        { label: "", width: null, visible: true }
    ];
    _previewBody = [
        this._createPreviewRow(["col-4", "col-8", "col-6"]),
        this._createPreviewRow(["col-7", "col-5", "col-9"]),
        this._createPreviewRow(["col-3", "col-10", "col-4"])
    ];

    /**
     * Construct a new TableCtrl instance.
     * Reads configuration from the element's data attributes:
     * - data-uri: REST endpoint
     * - data-page-size: number of rows per page
     * @param {HTMLElement} element - The host DOM element for this controller.
     */
    constructor(element) {
        super(element);

        this._restUri = element.dataset.uri || "";
        element.removeAttribute("data-uri");

        if (element.dataset.pageSize) {
            this._pageSize = parseInt(element.dataset.pageSize, 10);
            if (isNaN(this._pageSize) || this._pageSize <= 0) {
                this._pageSize = 50;
            }
        }

        this._setupProgressBar(element);

        if (typeof this._initPersistenceListeners === "function") {
            this._initPersistenceListeners(element);
        }

        this._columns = this._previewColumns;
        this._rows = this._previewBody;
        this._table.classList.add("placeholder-glow");

        this.render();

        this._initEvents();

        // initialize pager and info area
        this._initPager(element);

        if (this._restUri) {
            this._receiveData();
        } else {
            this._toggleProgress(false);
        }
    }

    /**
     * Initialize DOM and document-level event listeners required by the control.
     * Listens for:
     * - TABLE_SORT_EVENT to apply server-side sorting (or emit local request)
     * - CHANGE_PAGE_EVENT to respond to external pagination controls
     */
    _initEvents() {
        // use fallback string in case the constant is undefined
        const sortEventName = webexpress.webui.Event.TABLE_SORT_EVENT;

        // bind to document to catch events that might not bubble to this._element
        document.addEventListener(sortEventName, (e) => {
            // check if the event target is inside this table or matches the id
            let targetMatches = false;
            if (this._element.contains(e.target)) {
                targetMatches = true;
            }
            
            const detail = e.detail || {};
            if (detail.id) {
                if (detail.id === this._element.id) {
                    targetMatches = true;
                }
            }

            if (targetMatches) {
                if (detail.columnId) {
                    this._orderBy = detail.columnId;
                    this._orderDir = detail.sortDirection;
                    this._page = 0;

                    if (this._restUri) {
                        this._receiveData();
                    } else {
                        this._dispatch(webexpress.webui.Event.TABLE_SORT_EVENT, {
                            orderBy: this._orderBy, orderDir: this._orderDir
                        });
                    }
                }
            }
        });

        const pageEventName = webexpress.webui.Event.CHANGE_PAGE_EVENT;

        document.addEventListener(pageEventName, (e) => {
            if (e.detail) {
                if (typeof e.detail.page === "number") {
                    this._handleExternalPageChange(e.detail.page);
                }
            }
        });
    }

    /**
     * Initialize or bind a pagination control and an information area.
     * If an element with class "wx-webui-pagination" exists inside the host,
     * it is used. Otherwise a pager element is created and an instance of
     * PaginationCtrl is constructed. An info line showing totals is appended.
     * @param {HTMLElement} host - the host element to search/attach pager to
     */
    _initPager(host) {
        // find existing pager element inside host
        let pager = host.querySelector(".wx-webui-pagination");
        if (!pager) {
            // create a pager host element and append it after the table
            pager = document.createElement("ul");
            pager.className = "wx-webui-pagination";
            pager.style.marginTop = "0.5rem";
            if (this._table) {
                if (this._table.parentNode === host) {
                    host.insertBefore(pager, this._table.nextSibling);
                } else {
                    host.appendChild(pager);
                }
            } else {
                host.appendChild(pager);
            }
        }

        this._pagerElement = pager;

        // set initial page and total
        const initialTotalPages = Math.max(1, Math.ceil((this._totalRecords || 0) / this._pageSize));
        this._pagerElement.dataset.page = String(this._page);
        this._pagerElement.dataset.total = String(initialTotalPages);

        try {
            // create an instance of the pagination control
            this._pagerCtrl = new webexpress.webui.PaginationCtrl(this._pagerElement);
        } catch (err) {
            // in case the pager class is not available yet, log and continue
            console.error("Failed to initialize PaginationCtrl:", err);
            this._pagerCtrl = null;
        }

        // create info div to show totals and current page details
        this._infoDiv = document.createElement("div");
        this._infoDiv.className = "wx-table-info text-muted small";
        this._infoDiv.style.marginTop = "0.25rem";
        this._infoDiv.textContent = "";
        
        if (this._pagerElement) {
            if (this._pagerElement.parentNode) {
                this._pagerElement.parentNode.insertBefore(this._infoDiv, this._pagerElement.nextSibling);
            } else {
                host.appendChild(this._infoDiv);
            }
        } else {
            host.appendChild(this._infoDiv);
        }

        // initialize info/pager display
        this._syncPagerAndInfo();
    }

    /**
     * Update pager control and info area after data changed.
     * This updates pager state silently (without firing CHANGE_PAGE_EVENT)
     * and refreshes the textual information about totals and current page.
     */
    _syncPagerAndInfo() {
        const total = Number(this._totalRecords) || 0;
        let totalPages = 1;
        if (this._pageSize > 0) {
            totalPages = Math.max(1, Math.ceil(total / this._pageSize));
        }

        // clamp current page to available range
        if (this._page < 0) {
            this._page = 0;
        }
        if (this._page >= totalPages) {
            this._page = totalPages - 1;
        }

        const currentPage = this._page;

        // non-infinite: rows correspond to the current page
        let itemsOnPage = 0;
        if (Array.isArray(this._rows)) {
            itemsOnPage = this._rows.length;
        }

        // update pager host dataset
        if (this._pagerElement) {
            this._pagerElement.dataset.page = String(currentPage);
            this._pagerElement.dataset.total = String(totalPages);
        }

        // update pager control silently if available
        if (this._pagerCtrl) {
            if (typeof this._pagerCtrl.updateState === "function") {
                // updatestate will not dispatch change_page_event
                this._pagerCtrl.updateState(currentPage, totalPages);
            } else {
                // fall back: set properties directly
                try {
                    this._pagerCtrl.total = totalPages;
                    this._pagerCtrl.page = currentPage;
                } catch (e) {
                    // ignore errors when setting fallback properties
                }
            }
        }

        // update textual info
        if (this._infoDiv) {
            this._infoDiv.textContent = "Page " + (currentPage + 1) + " of " + totalPages + " / " + itemsOnPage + " of " + total + " items";
        }
    }

    /**
     * Handle page requests coming from external pagination controls.
     * @param {number} targetPage - zero-based page index requested externally.
     */
    _handleExternalPageChange(targetPage) {
        // clamp requested page into range
        const totalPages = Math.max(1, Math.ceil(this._totalRecords / this._pageSize));
        let page = Number(targetPage) || 0;
        if (page < 0) {
            page = 0;
        }
        if (page >= totalPages) {
            page = totalPages - 1;
        }
        this._page = page;

        // immediate visual feedback while new page loads
        if (this._infoDiv) {
            this._infoDiv.textContent = "Page " + (this._page + 1) + " of " + totalPages + " — loading…";
        }

        this._receiveData();
    }

    /**
     * Create and insert the progress bar element used to indicate loading state.
     * @param {HTMLElement} element - host element to which the progress bar will be added.
     */
    _setupProgressBar(element) {
        this._progressDiv = document.createElement("div");
        this._progressDiv.className = "progress mb-2";
        this._progressDiv.setAttribute("role", "status");
        this._progressDiv.style.height = "0.25rem";
        const bar = document.createElement("div");
        bar.className = "progress-bar progress-bar-striped progress-bar-animated";
        bar.style.width = "100%";
        this._progressDiv.appendChild(bar);
        if (this._table) {
            if (this._table.parentNode === element) {
                element.insertBefore(this._progressDiv, this._table);
            } else {
                element.prepend(this._progressDiv);
            }
        } else {
            element.prepend(this._progressDiv);
        }
    }

    /**
     * Toggle the visibility of the progress indicator and update loading state.
     * @param {boolean} show - true to show the progress indicator, false to hide.
     */
    _toggleProgress(show) {
        if (this._progressDiv) {
            this._progressDiv.style.visibility = show ? "visible" : "hidden";
        }
        this._isLoading = show;
        if (show) {
            if (this._rows.length === 0) {
                this._table.classList.add("placeholder-glow");
            } else {
                this._table.classList.remove("placeholder-glow");
            }
        } else {
            this._table.classList.remove("placeholder-glow");
        }
    }

    /**
     * Request data from the configured REST endpoint.
     */
    _receiveData() {
        // abort if no uri
        if (!this._restUri) {
            return;
        }

        // abort previous request if present
        if (this._abortController) {
            this._abortController.abort("search replaced");
        }
        this._abortController = new AbortController();

        this._toggleProgress(true);

        // build request url with fallback for relative uris
        const base = window.location.origin;
        let urlObj;
        try {
            urlObj = new URL(this._restUri, base);
        } catch (e) {
            urlObj = new URL(this._restUri, document.baseURI);
        }

        // set query parameters
        if (this._filter) {
            urlObj.searchParams.set("q", this._filter);
        } else {
            urlObj.searchParams.set("q", "");
        }
        
        if (this._wql) {
            urlObj.searchParams.set("wql", this._wql);
        } else {
            urlObj.searchParams.set("wql", "");
        }
        
        urlObj.searchParams.set("p", this._page);
        urlObj.searchParams.set("l", this._pageSize);

        if (this._orderBy) {
            urlObj.searchParams.set("o", this._orderBy);
            if (this._orderDir) {
                urlObj.searchParams.set("d", this._orderDir);
            }
        }

        const fetchUrl = this._restUri.startsWith("http") ? urlObj.href : (urlObj.pathname + urlObj.search);

        fetch(fetchUrl, { signal: this._abortController.signal })
            .then((res) => {
                if (!res.ok) {
                    throw new Error("Request failed: " + res.status);
                }
                return res.json();
            })
            .then((response) => {
                // try multiple possible fields for total
                const totalFromResponse = response.total
                    ?? response.count
                    ?? response.totalCount
                    ?? response.total_records
                    ?? response.pagination?.totalCount
                    ?? response.pagination?.TotalCount
                    ?? null;

                // determine number of rows actually returned
                let receivedRows = 0;
                if (Array.isArray(response.rows)) {
                    receivedRows = response.rows.length;
                }

                // set or infer totalrecords
                if (totalFromResponse !== null) {
                    this._totalRecords = Number(totalFromResponse) || 0;
                } else {
                    this._totalRecords = (this._page * this._pageSize) + receivedRows;
                }

                // compute total pages and clamp current page
                const totalPages = Math.max(1, Math.ceil(this._totalRecords / this._pageSize));
                if (this._page >= totalPages) {
                    this._page = totalPages - 1;
                }

                // normalize rows and apply client-side cap
                let newRows = response.rows || [];
                if (Array.isArray(newRows)) {
                    if (newRows.length > this._pageSize) {
                        // slice to configured page size
                        newRows = newRows.slice(0, this._pageSize);
                    }
                }

                // ensure the response passed to updatedata reflects any slicing
                const responseForUpdate = Object.assign({}, response, { rows: newRows });

                // integrate received data into table structures
                this.updateData(responseForUpdate);

                // notify listeners that data arrived
                this._dispatch(webexpress.webui.Event.DATA_ARRIVED_EVENT, {
                    id: this._element.id, 
                    response: responseForUpdate, 
                    page: this._page
                });

                // emit pagination update
                this._dispatch(webexpress.webui.Event.UPDATE_PAGINATION_EVENT, {
                    page: this._page, 
                    total: totalPages
                });

                // sync pager and info in a microtask
                setTimeout(() => {
                    this._syncPagerAndInfo();
                }, 0);

                this._toggleProgress(false);
                this._abortController = null;
            })
            .catch((error) => {
                // ignore aborts as they are expected
                if (error.name === "AbortError") {
                    return;
                }
                console.error("TableCtrl Request failed:", error);

                this._toggleProgress(false);
                this._abortController = null;
                this._isLoading = false;
            });
    }

    /**
     * Normalize and integrate server response into internal table data structures.
     * @param {Object} response - parsed JSON response from the REST endpoint.
     */
    updateData(response) {
        if (!response) {
            return;
        }

        if (!this._columns || this._columns === this._previewColumns) {
            this._columns = (response.columns || []).map((c, idx) => {
                let rType = c.rendererType || null;
                let rOpts = c.rendererOptions || {};
                if (c.template) {
                    if (typeof c.template === "object") {
                        rType = c.template.type;
                        rOpts = c.template.options || {};
                        if (c.template.editable) {
                            rOpts.editable = c.template.editable;
                        }
                    }
                }
                
                let isVisible = true;
                if (typeof c.visible === "boolean") {
                    isVisible = c.visible;
                }
                
                let isResizable = true;
                if (typeof c.resizable === "boolean") {
                    isResizable = c.resizable;
                }

                return {
                    id: c.id || `col_${idx}`,
                    label: c.label || c.id,
                    name: c.name || null,
                    visible: isVisible,
                    sort: null,
                    width: c.width || null,
                    minWidth: c.minWidth || null,
                    resizable: isResizable,
                    icon: c.icon || null,
                    image: c.image || null,
                    color: c.color || null,
                    rendererType: rType,
                    rendererOptions: rOpts
                };
            });
            if (this._orderBy) {
                const targetCol = this._columns.find((c) => c.id === this._orderBy);
                if (targetCol) {
                    targetCol.sort = this._orderDir || "asc";
                }
            }
        }

        /**
         * Convert a raw server row object into the internal row representation.
         * @param {Object} r - raw row object from the response
         * @param {Object|null} parent - parent row, or null for root rows
         * @returns {Object} normalized row
         */
        const normalizeRow = (r, parent = null) => {
            let isExpanded = true;
            if (typeof r.expanded === "boolean") {
                isExpanded = r.expanded;
            }
            
            const row = {
                id: r.id || null,
                class: r.class || null,
                style: r.style || null,
                color: r.color || null,
                image: r.image || null,
                icon: r.icon || null,
                uri: r.uri || r.url || null,
                target: r.target || null,
                primaryAction: r.primaryAction || null,
                secondaryAction: r.secondaryAction || null,
                bind: r.bind || null,
                cells: r.cells || [],
                options: r.options || null,
                children: [],
                parent: parent,
                expanded: isExpanded
            };
            if (r.children) {
                if (Array.isArray(r.children)) {
                    row.children = r.children.map((child) => normalizeRow(child, row));
                }
            }
            return row;
        };

        // normalize incoming rows
        let newRows = (response.rows || []).map((r) => normalizeRow(r, null));

        if (newRows.length > this._pageSize) {
            // slice to first pagesize entries
            newRows = newRows.slice(0, this._pageSize);
        }

        this._rows = newRows;

        let optionsExist = false;
        if (this._options) {
            if (this._options.length > 0) {
                optionsExist = true;
            }
        }
        
        if (!optionsExist) {
            if (this._rows.some((r) => r.options && r.options.length > 0)) {
                optionsExist = true;
            }
        }
        
        this._hasOptions = optionsExist;

        this.render();
        
        // sync pager and info after full render
        this._syncPagerAndInfo();
    }

    /**
     * Initialize listeners that persist column/row order changes.
     * @param {HTMLElement} element - the host element to attach listeners to.
     */
    _initPersistenceListeners(element) {
        const notifyStateChange = (type) => {
            const colOrder = this._columns.filter((c) => c.visible).map((c) => c.id).join(",");
            const rowOrder = this._rows.map((r) => r.id).join(",");
            this._dispatch(webexpress.webui.Event.UPDATED_EVENT, {
                type: type,
                columnOrder: colOrder,
                rowOrder: rowOrder
            });
            if (this._restUri) {
                if (type === "row-reorder") {
                    this._sendStateToServer({ r: rowOrder });
                } else {
                    this._sendStateToServer({ c: colOrder });
                }
            }
        };
        element.addEventListener(webexpress.webui.Event.COLUMN_REORDER_EVENT, () => notifyStateChange("column-reorder"));
        element.addEventListener(webexpress.webui.Event.COLUMN_VISIBILITY_EVENT, () => notifyStateChange("column-visibility"));
        element.addEventListener(webexpress.webui.Event.ROW_REORDER_EVENT, () => notifyStateChange("row-reorder"));
    }

    /**
     * Send a small state payload to the configured REST endpoint using PUT.
     * @param {Object} stateObj - JSON-serializable object representing the state.
     */
    _sendStateToServer(stateObj) {
        if (!this._restUri) {
            return;
        }
        fetch(this._restUri, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(stateObj)
        }).catch((err) => console.error("Update state failed", err));
    }

    /**
     * Updates the control.
     */
    update() {
        if (this._restUri) {
            if (this._isVisible()) {
                this._receiveData();
            }
        }
    }

    /**
     * Sets the search filter and reloads the first page.
     * @param {string} pattern - Search pattern
     * @param {string} [searchType="basic"] -  Filter type ("basic" or "wql").
     */
    search(pattern = "", searchType = "basic") {
        if (searchType === "basic") {
            this._filter = pattern;
            this._wql = null;
        } else if (searchType === "wql") {
            this._filter = null;
            this._wql = pattern;
        } else {
            this._filter = null;
            this._wql = null;
        }

        this._page = 0;
        
        if (this._restUri) {
            if (this._isVisible()) {
                this._receiveData();
            }
        }
    }
    
    /**
     * Creates bootstrap placeholder markup for preview cells.
     * @param {string} widthClass Bootstrap width class for the placeholder.
     * @returns {string} Bootstrap placeholder markup.
     */
    _createPlaceholderCellContent(widthClass = "col-12") {
        return `<span class="placeholder ${widthClass}"></span>`;
    }
    
    /**
     * Creates a preview row with bootstrap placeholders.
     * @param {Array<string>} widths Bootstrap width classes for each cell.
     * @returns {Object} Preview row definition.
     */
    _createPreviewRow(widths) {
        return {
            cells: widths.map((widthClass) => {
                return {
                    content: this._createPlaceholderCellContent(widthClass),
                    html: true
                };
            })
        };
    }
};

// register the class in the controller
webexpress.webui.Controller.registerClass("wx-webapp-table", webexpress.webapp.TableCtrl);