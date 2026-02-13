/**
 * A REST-enabled table control that extends the reorderable table class and
 * integrates with a REST API. Supports standard pagination or configurable
 * infinite scrolling via the `data-infinite` attribute.
 *
 * Emits events:
 * - webexpress.webui.Event.DATA_ARRIVED_EVENT
 * - webexpress.webui.Event.UPDATE_PAGINATION_EVENT (custom event to synchronize external pager)
 */
webexpress.webapp.TableCtrl = class extends webexpress.webui.TableCtrlReorderable {
    // configuration
    _restUri = "";
    _isInfinite = false;

    // state
    _orderBy = null;
    _orderDir = null;
    _filter = "";
    _page = 0;
    _pageSize = 50;
    _totalRecords = 0;
    _isLoading = false;
    _allDataLoaded = false;

    // ui helpers
    _progressDiv = null;
    _abortController = null;
    _sentinel = null;
    _observer = null;
    _scrollTimer = null;

    // placeholder data shown while initial load is in progress
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
     * Construct a new TableCtrl instance.
     * Reads configuration from the element's data attributes:
     * - data-uri: REST endpoint
     * - data-infinite: "true" to enable infinite scrolling
     * - data-page-size: number of rows per page
     * @param {HTMLElement} element - The host DOM element for this controller.
     */
    constructor(element) {
        super(element);

        this._restUri = element.dataset.uri || "";
        this._isInfinite = element.dataset.infinite === "true";

        element.removeAttribute("data-uri");
        element.removeAttribute("data-infinite");

        if (element.dataset.pageSize) {
            this._pageSize = parseInt(element.dataset.pageSize, 10);
        }

        this._setupProgressBar(element);

        if (this._isInfinite) {
            this._createSentinel();
        }

        if (typeof this._initPersistenceListeners === 'function') {
            this._initPersistenceListeners(element);
        }

        this._columns = this._previewColumns;
        this._rows = this._previewBody;
        this._table.classList.add("placeholder-glow");

        this.render();

        this._initEvents();

        if (this._restUri) {
            this._receiveData(false);
        } else {
            this._toggleProgress(false);
        }
    }

    /**
     * Initialize DOM and document-level event listeners required by the control.
     * Listens for:
     * - TABLE_SORT_EVENT to apply server-side sorting (or emit local request)
     * - CHANGE_PAGE_EVENT to respond to external pagination controls
     * - scroll and intersection observer for infinite scroll mode
     * All emitted custom events are dispatched from the component element.
     */
    _initEvents() {
        document.addEventListener(webexpress.webui.Event.TABLE_SORT_EVENT, (e) => {
            const detail = e.detail || {};
            if (detail.columnId && (!detail.id || detail.id === this._element.id || e.target.closest(`#${this._element.id}`))) {
                this._orderBy = detail.columnId;
                this._orderDir = detail.sortDirection;
                this._page = 0;
                this._allDataLoaded = false;

                if (this._restUri) {
                    this._receiveData(false);
                } else {
                    this._element.dispatchEvent(new CustomEvent("wx-req-sort", {
                        bubbles: true,
                        detail: { orderBy: this._orderBy, orderDir: this._orderDir }
                    }));
                }
            }
        });

        document.addEventListener(webexpress.webui.Event.CHANGE_PAGE_EVENT, (e) => {
            if (e.detail && typeof e.detail.page === "number") {
                this._handleExternalPageChange(e.detail.page);
            }
        });

        if (this._isInfinite) {
            this._body.addEventListener("scroll", () => this._onScroll(), { passive: true });

            const options = {
                root: this._body,
                rootMargin: "50px",
                threshold: 0.1
            };

            this._observer = new IntersectionObserver((entries) => {
                const entry = entries[0];
                if (entry.isIntersecting && !this._isLoading && !this._allDataLoaded && this._initialized) {
                    // safety check: only load if we actually have content to scroll
                    if (this._body.scrollHeight > this._body.clientHeight) {
                        this._page++;
                        this._receiveData(true);
                    }
                }
            }, options);
        }
    }

    /**
     * Create the intersection-observer sentinel element used for infinite scroll.
     * The sentinel is visually hidden but occupies layout space to trigger the observer.
     */
    _createSentinel() {
        this._sentinel = document.createElement("div");
        this._sentinel.className = "wx-table-sentinel";
        this._sentinel.style.height = "1px";
        this._sentinel.style.width = "100%";
        this._sentinel.style.flexShrink = "0"; // prevent collapsing
        this._sentinel.style.visibility = "hidden";
    }

    /**
     * Scroll handler that throttles calculation of the currently visible page.
     * A short timeout is used to avoid excessive recalculation on fast scroll events.
     */
    _onScroll() {
        if (this._scrollTimer) return;
        this._scrollTimer = setTimeout(() => {
            this._scrollTimer = null;
            this._calculateCurrentPage();
        }, 150);
    }

    /**
     * Estimate the currently visible page based on scroll position and average row height.
     * Dispatches a "wx-update-pagination" event with the calculated page and total pages.
     */
    _calculateCurrentPage() {
        if (!this._rows.length || this._pageSize <= 0) return;

        // simple estimation based on scroll position and average row height
        const scrollTop = this._body.scrollTop;
        const totalHeight = this._body.scrollHeight;
        const clientHeight = this._body.clientHeight;

        if (totalHeight === 0) return;

        // calculate visible percentage or index
        const avgRowHeight = totalHeight / this._rows.length;
        const visibleRowIndex = Math.floor(scrollTop / avgRowHeight);

        const calculatedPage = Math.floor(visibleRowIndex / this._pageSize);

        this._element.dispatchEvent(new CustomEvent("wx-update-pagination", {
            bubbles: true,
            detail: {
                page: calculatedPage,
                total: Math.ceil(this._totalRecords / this._pageSize)
            }
        }));
    }

    /**
     * Handle page requests coming from external pagination controls.
     * When infinite scrolling is disabled, performs a normal page load.
     * When infinite scrolling is enabled, attempts to scroll to the row for the
     * requested page or resets and requests that page if rows are not yet present.
     * @param {number} targetPage - zero-based page index requested externally.
     */
    _handleExternalPageChange(targetPage) {
        if (!this._isInfinite) {
            this._page = targetPage;
            this._receiveData(false);
            return;
        }

        const targetRowIndex = targetPage * this._pageSize;
        if (targetRowIndex < this._rows.length) {
            const targetDomRow = this._body.children[targetRowIndex];
            if (targetDomRow) {
                targetDomRow.scrollIntoView({ behavior: "smooth", block: "start" });
                this._element.dispatchEvent(new CustomEvent("wx-update-pagination", {
                    bubbles: true,
                    detail: {
                        page: targetPage,
                        total: Math.ceil(this._totalRecords / this._pageSize)
                    }
                }));
            }
        } else {
            // jump ahead -> reset and fetch the requested page
            this._page = targetPage;
            this._rows = [];
            this._receiveData(false);
        }
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
        if (this._table && this._table.parentNode === element) {
            element.insertBefore(this._progressDiv, this._table);
        } else {
            element.prepend(this._progressDiv);
        }
    }

    /**
     * Toggle the visibility of the progress indicator and update loading state.
     * When showing the progress indicator and no rows are present, the table
     * is rendered with a placeholder glow.
     * @param {boolean} show - true to show the progress indicator, false to hide.
     */
    _toggleProgress(show) {
        if (this._progressDiv) this._progressDiv.style.visibility = show ? "visible" : "hidden";
        this._isLoading = show;
        if (show && this._rows.length === 0) {
            this._table.classList.add("placeholder-glow");
        } else {
            this._table.classList.remove("placeholder-glow");
        }
    }

    /**
     * Request data from the configured REST endpoint.
     * The function supports append mode for infinite scrolling and aborts any
     * running request before issuing a new one. On success, the response is
     * passed to updateData and appropriate events are emitted.
     * @param {boolean} [append=false] - if true, new rows are appended to existing rows.
     */
    _receiveData(append = false) {
        if (!this._restUri) return;
        if (this._isLoading && append) return;

        if (this._abortController) this._abortController.abort();
        this._abortController = new AbortController();

        this._toggleProgress(true);

        if (this._isInfinite && this._sentinel && this._observer) {
            this._observer.unobserve(this._sentinel);
            this._sentinel.remove();
        }

        const base = window.location.origin;
        let urlObj;
        try {
            urlObj = new URL(this._restUri, base);
        } catch (e) {
            urlObj = new URL(this._restUri, document.baseURI);
        }

        urlObj.searchParams.set("q", this._filter || "");
        urlObj.searchParams.set("p", this._page);
        urlObj.searchParams.set("limit", this._pageSize);

        if (this._orderBy) {
            urlObj.searchParams.set("o", this._orderBy);
            if (this._orderDir) urlObj.searchParams.set("d", this._orderDir);
        }

        const fetchUrl = this._restUri.startsWith("http") ? urlObj.href : (urlObj.pathname + urlObj.search);

        fetch(fetchUrl, { signal: this._abortController.signal })
            .then((res) => {
                if (!res.ok) throw new Error(`Request failed: ${res.status}`);
                return res.json();
            })
            .then((response) => {
                this._totalRecords = response.total || response.count || 0;
                const newRows = response.rows || [];
                if (newRows.length < this._pageSize || newRows.length === 0) {
                    this._allDataLoaded = true;
                }

                this.updateData(response, append);

                this._dispatch(webexpress.webui.Event.DATA_ARRIVED_EVENT, {
                    detail: { id: this._element.id, response: response, page: this._page, isAppend: append }
                });
                
                this._dispatch(webexpress.webui.Event.UPDATE_PAGINATION_EVENT, {
                    detail: { page: this._page, total: Math.ceil(this._totalRecords / this._pageSize) }
                });

                this._toggleProgress(false);
                this._abortController = null;
            })
            .catch((error) => {
                if (error.name === 'AbortError') return; 
                console.error("TableCtrl Request failed:", error);
                this._toggleProgress(false);
                this._abortController = null;
                this._isLoading = false;

                if (this._isInfinite && !this._allDataLoaded && this._sentinel && this._observer) {
                    // reattach sentinel so intersection observer can trigger further loads
                    this._body.appendChild(this._sentinel);
                    this._observer.observe(this._sentinel);
                }
            });
    }

    /**
     * Normalize and integrate server response into internal table data structures.
     * The server response is expected to contain optional `columns`, mandatory
     * `rows`, and optionally `total` or `count` for the total record count.
     * Each row is normalized to a consistent format and may contain nested children.
     * @param {Object} response - parsed JSON response from the REST endpoint.
     * @param {boolean} [append=false] - whether to append rows instead of replacing.
     */
    updateData(response, append = false) {
        if (!response) return;

        if (!append || !this._columns || this._columns === this._previewColumns) {
            this._columns = (response.columns || []).map((c, idx) => {
                let rType = c.rendererType || null;
                let rOpts = c.rendererOptions || {};
                if (c.template && typeof c.template === "object") {
                    rType = c.template.type;
                    rOpts = c.template.options || {};
                    if (c.template.editable) rOpts.editable = c.template.editable;
                }
                return {
                    id: c.id || `col_${idx}`,
                    label: c.label || c.id,
                    name: c.name || null,
                    visible: typeof c.visible === "boolean" ? c.visible : true,
                    sort: null,
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
            if (this._orderBy) {
                const targetCol = this._columns.find(c => c.id === this._orderBy);
                if (targetCol) targetCol.sort = this._orderDir || "asc";
            }
        }

        /**
         * Convert a raw server row object into the internal row representation.
         * @param {Object} r - raw row object from the response
         * @param {Object|null} parent - parent row, or null for root rows
         * @returns {Object} normalized row
         */
        const normalizeRow = (r, parent = null) => {
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
                primaryTarget: r.primaryTarget || null,
                primaryUri: r.primaryUri || null,
                secondaryAction: r.secondaryAction || null,
                secondaryTarget: r.secondaryTarget || null,
                secondaryUri: r.secondaryUri || null,
                cells: r.cells || [],
                options: r.options || null,
                children: [],
                parent: parent,
                expanded: typeof r.expanded === "boolean" ? r.expanded : true
            };
            if (r.children && Array.isArray(r.children)) {
                row.children = r.children.map(child => normalizeRow(child, row));
            }
            return row;
        };

        const newRows = (response.rows || []).map(r => normalizeRow(r, null));

        if (append) {
            this._rows = this._rows.concat(newRows);
        } else {
            this._rows = newRows;
        }

        this._hasOptions = (this._options && this._options.length > 0)
            || this._rows.some((r) => r.options && r.options.length > 0);

        if (append) {
            this._appendRows(newRows);
        } else {
            this.render();
            // attach sentinel only after render is complete and layout is stable
            if (this._isInfinite && this._sentinel && this._observer && !this._allDataLoaded) {
                setTimeout(() => {
                    this._body.appendChild(this._sentinel);
                    this._observer.observe(this._sentinel);
                }, 200);
            }
        }
    }

    /**
     * Append rendered rows to the table body for infinite scroll.
     * This method creates DOM nodes for each new row and appends them via a fragment.
     * It also manages the sentinel's observation lifecycle to avoid duplicate triggers.
     * @param {Array<Object>} newRows - normalized rows to append to the table.
     */
    _appendRows(newRows) {
        if (this._sentinel && this._sentinel.parentNode) {
            this._observer.unobserve(this._sentinel);
            this._sentinel.remove();
        }

        const fragment = document.createDocumentFragment();
        const changedIds = new Set();
        const newIds = new Set();

        const renderList = (rows, depth) => {
            for (const r of rows) {
                this._addRow(r, depth, fragment, changedIds, newIds);
                if (this._treeEnabled && r.children?.length && r.expanded) {
                    renderList(r.children, depth + 1);
                }
            }
        };

        renderList(newRows, 0);
        this._body.appendChild(fragment);

        this._initialized = true;

        if (this._isInfinite && !this._allDataLoaded && this._sentinel && this._observer) {
            this._body.appendChild(this._sentinel);
            setTimeout(() => {
                if (this._observer && this._sentinel) {
                    this._observer.observe(this._sentinel);
                }
            }, 200);
        }
    }

    /**
     * Initialize listeners that persist column/row order changes.
     * When a relevant event occurs, a "wx-req-update-state" event is dispatched
     * and the current state is optionally sent to the REST endpoint via PUT.
     * @param {HTMLElement} element - the host element to attach listeners to.
     */
    _initPersistenceListeners(element) {
        const notifyStateChange = (type) => {
            const colOrder = this._columns.filter((c) => c.visible).map((c) => c.id).join(",");
            const rowOrder = this._rows.map((r) => r.id).join(",");
            this._element.dispatchEvent(new CustomEvent("wx-req-update-state", {
                bubbles: true,
                detail: { type: type, columnOrder: colOrder, rowOrder: rowOrder }
            }));
            if (this._restUri) this._sendStateToServer(type === "row-reorder" ? { r: rowOrder } : { c: colOrder });
        };
        element.addEventListener(webexpress.webui.Event.COLUMN_REORDER_EVENT, () => notifyStateChange("column-reorder"));
        element.addEventListener(webexpress.webui.Event.COLUMN_VISIBILITY_EVENT, () => notifyStateChange("column-visibility"));
        element.addEventListener(webexpress.webui.Event.ROW_REORDER_EVENT, () => notifyStateChange("row-reorder"));
    }

    /**
     * Send a small state payload to the configured REST endpoint using PUT.
     * The payload typically contains either `c` (column order) or `r` (row order).
     * @param {Object} stateObj - JSON-serializable object representing the state.
     */
    _sendStateToServer(stateObj) {
        if (!this._restUri) return;
        fetch(this._restUri, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(stateObj)
        }).catch(err => console.error("Update state failed", err));
    }
    
    /**
     * Sets the search filter and reloads the first page (without modifying order or paging settings).
     * @param {string} pattern - Search pattern (optional, defaults to empty string)
     */
    search(pattern = "") {
        this._filter = pattern;
        this._page = 0;
        if (this._restUri) {
            this._receiveData(false);
        }
    }
};

webexpress.webui.Controller.registerClass("wx-webapp-table", webexpress.webapp.TableCtrl);