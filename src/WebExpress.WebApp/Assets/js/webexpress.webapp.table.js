/**
 * A REST table control extending the reorderable table class with REST-API integration.
 * Fetches data and columns from a REST endpoint.
 * Supports rich cell rendering via registered TableTemplates.
 * The following events are triggered:
 * - webexpress.webui.Event.DATA_ARRIVED_EVENT
 */
webexpress.webapp.TableCtrl = class extends webexpress.webui.TableCtrlReorderable {
    
    // Config
    _restUri = "";
    
    // State
    _orderBy = null;
    _orderDir = null;
    _filter = "";
    _page = 0;
    _pageSize = 50;
    
    // UI
    _progressDiv = null;
    _abortController = null;

    // Placeholder data
    _previewColumns = [
        { label: "Loading...", width: null, visible: true },
        { label: "Loading...", width: null, visible: true },
        { label: "Loading...", width: null, visible: true }
    ];
    _previewBody = [
        { cells: [{ content: "..." }, { content: "..." }, { content: "..." }] },
        { cells: [{ content: "..." }, { content: "..." }, { content: "..." }] },
        { cells: [{ content: "..." }, { content: "..." }, { content: "..." }] }
    ];

    /**
     * Constructor for the TableCtrl class.
     * @param {HTMLElement} element - The DOM element associated with the control.
     */
    constructor(element) {
        super(element);

        this._restUri = element.dataset.uri || "";
        element.removeAttribute("data-uri");

        this._setupProgressBar(element);
        
        // Ensure persistence listeners are active (from base class if needed, or re-init)
        // Usually base constructor handles this, but if specific logic is needed:
        if (typeof this._initPersistenceListeners === 'function') {
            this._initPersistenceListeners(element);
        }

        // Set initial placeholder state
        this._columns = this._previewColumns;
        this._rows = this._previewBody;
        this._table.classList.add("placeholder-glow");

        // Initial render of placeholders
        this.render();

        // Setup sort event listener
        // Note: Base classes might already listen to click events, 
        // but this specific listener handles the REST reload logic.
        document.addEventListener(webexpress.webui.Event.TABLE_SORT_EVENT, (e) => {
            const detail = e.detail || {};
            
            // Filter: respond only if this specific table triggered the sort
            if (detail.columnId && (!detail.id || detail.id === this._element.id)) {
                this._orderBy = detail.columnId;
                this._orderDir = detail.sortDirection;
                
                // If standalone (REST URI present), reload internally
                if (this._restUri) {
                    this._receiveData();
                } else {
                    // Dispatch specific request event for external controllers (ViewCtrl)
                    this._element.dispatchEvent(new CustomEvent("wx-req-sort", {
                        bubbles: true,
                        detail: { 
                            orderBy: this._orderBy, 
                            orderDir: this._orderDir 
                        }
                    }));
                }
            }
        });

        // Trigger initial fetch if configured as standalone
        if (this._restUri) {
            this._receiveData();
        } else {
            this._toggleProgress(false);
        }
    }

    /**
     * Setup the progress bar DOM elements.
     * @param {HTMLElement} element Host element.
     */
    _setupProgressBar(element) {
        this._progressDiv = document.createElement("div");
        this._progressDiv.className = "progress mb-2";
        this._progressDiv.setAttribute("role", "status");
        this._progressDiv.style.height = "0.25rem"; // thin line
        
        const bar = document.createElement("div");
        bar.className = "progress-bar progress-bar-striped progress-bar-animated";
        bar.style.width = "100%";
        
        this._progressDiv.appendChild(bar);

        // Insert progress bar before the table container
        if (this._table && this._table.parentNode === element) {
            element.insertBefore(this._progressDiv, this._table);
        } else {
            element.prepend(this._progressDiv);
        }
    }

    /**
     * Toggles progress bar visibility and table placeholder state.
     * @param {boolean} show True to show loading state.
     */
    _toggleProgress(show) {
        if (this._progressDiv) {
            this._progressDiv.style.visibility = show ? "visible" : "hidden";
        }
        if (show) {
            this._table.classList.add("placeholder-glow");
        } else {
            this._table.classList.remove("placeholder-glow");
        }
    }

    /**
     * Fetches data from the configured REST endpoint (Standalone Mode).
     */
    _receiveData() {
        if (!this._restUri) return;

        // Cancel previous request if pending
        if (this._abortController) {
            this._abortController.abort();
        }
        this._abortController = new AbortController();

        this._toggleProgress(true);

        // Construct URL using URL API for safety
        // Handle relative or absolute URLs correctly
        const base = window.location.origin; // dummy base for relative URLs
        let urlObj;
        try {
            urlObj = new URL(this._restUri, base);
        } catch (e) {
            urlObj = new URL(this._restUri, document.baseURI);
        }
        
        // Append query params
        // Note: existing params in _restUri are preserved by URL constructor
        urlObj.searchParams.set("q", this._filter || "");
        urlObj.searchParams.set("p", this._page);
        urlObj.searchParams.set("limit", this._pageSize);

        if (this._orderBy) {
            urlObj.searchParams.set("o", this._orderBy);
            if (this._orderDir) {
                urlObj.searchParams.set("d", this._orderDir);
            }
        }

        // Calculate final URL (remove origin if it was relative input)
        const fetchUrl = this._restUri.startsWith("http") ? urlObj.href : (urlObj.pathname + urlObj.search);

        fetch(fetchUrl, { signal: this._abortController.signal })
            .then((res) => {
                if (!res.ok) throw new Error(`Request failed: ${res.status}`);
                return res.json();
            })
            .then((response) => {
                this.updateData(response);
                
                this._element.dispatchEvent(new CustomEvent(webexpress.webui.Event.DATA_ARRIVED_EVENT, {
                    detail: { id: this._element.id, response: response }
                }));
                
                this._toggleProgress(false);
                this._abortController = null;
            })
            .catch((error) => {
                if (error.name === 'AbortError') return; // Ignore aborts
                
                console.error("TableCtrl Request failed:", error);
                this._toggleProgress(false);
                this._abortController = null;
            });
    }

    /**
     * Public API to update the table with new data.
     * Used by _receiveData (internal) or ViewCtrl (external).
     * @param {Object} response - The API response object containing 'rows' and 'columns'.
     */
    updateData(response) {
        if (!response) return;

        // Process Columns
        this._columns = (response.columns || []).map((c, idx) => {
            let rType = c.rendererType || null;
            let rOpts = c.rendererOptions || {};

            // Handle legacy template object structure
            if (c.template && typeof c.template === "object") {
                rType = c.template.type;
                rOpts = c.template.options || {};
                if (c.template.editable) {
                    rOpts.editable = c.template.editable;
                }
            }

            return {
                id: c.id || `col_${idx}`,
                label: c.label || c.id,
                name: c.name || null,
                visible: typeof c.visible === "boolean" ? c.visible : true,
                sort: null, // reset sort state, applied below
                width: c.width || null,
                minWidth: c.minWidth || null,
                resizable: typeof c.resizable === "boolean" ? c.resizable : true,
                icon: c.icon || null,
                image: c.image || null,
                color: c.color || null,
                rendererType: rType,
                rendererOptions: rOpts
            };
        });

        // Re-apply current sort state to columns so arrows render correctly
        if (this._orderBy) {
            const targetCol = this._columns.find(c => c.id === this._orderBy);
            if (targetCol) {
                targetCol.sort = this._orderDir || "asc";
            }
        }

        // Process Rows
        this._rows = (response.rows || []).map((row) => {
            if (!row.cells) {
                row.cells = [];
            }
            return row;
        });

        // Determine if options column is needed
        this._hasOptions = (this._options && this._options.length > 0)
            || this._rows.some((r) => r.options && r.options.length > 0);

        this.render();
    }

    /**
     * Initializes listeners for layout changes (column reorder/visibility).
     * @param {HTMLElement} element - Host element.
     */
    _initPersistenceListeners(element) {
        const notifyStateChange = (type) => {
            const colOrder = this._columns
                .filter((c) => c.visible)
                .map((c) => c.id)
                .join(",");
            
            const rowOrder = this._rows.map((r) => r.id).join(",");

            this._element.dispatchEvent(new CustomEvent("wx-req-update-state", {
                bubbles: true,
                detail: {
                    type: type,
                    columnOrder: colOrder,
                    rowOrder: rowOrder
                }
            }));
            
            if (this._restUri) {
                this._sendStateToServer(type === "row-reorder" ? { r: rowOrder } : { c: colOrder });
            }
        };

        element.addEventListener(webexpress.webui.Event.COLUMN_REORDER_EVENT, () => notifyStateChange("column-reorder"));
        element.addEventListener(webexpress.webui.Event.COLUMN_VISIBILITY_EVENT, () => notifyStateChange("column-visibility"));
        element.addEventListener(webexpress.webui.Event.ROW_REORDER_EVENT, () => notifyStateChange("row-reorder"));
    }

    /**
     * Sends state update to server (Standalone mode).
     * @param {Object} stateObj - State object containing 'r' (rows) or 'c' (columns).
     */
    _sendStateToServer(stateObj) {
        if (!this._restUri) return;
        
        fetch(this._restUri, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(stateObj)
        }).catch(err => console.error("Update state failed", err));
    }
};

// register the class in the controller
webexpress.webui.Controller.registerClass("wx-webapp-table", webexpress.webapp.TableCtrl);