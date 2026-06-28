/**
 * A REST-enabled table control that extends the reorderable table class and
 * integrates with a REST API. Supports standard pagination.
 *
 * Emits events:
 * - webexpress.webui.Event.DATA_ARRIVED_EVENT
 *
 * Phase two of the View, State and Service migration:
 * - the query, paging and result state is owned by a standalone
 *   webexpress.webapp.ViewState, exposed through accessors so the inherited
 *   pager, sorting and persistence logic keeps working against a single source
 *   of truth
 * - the data load and the layout state update go through a
 *   webexpress.webapp.RestService, configured from a data-wx-service island when
 *   present and otherwise from a legacy descriptor that reproduces the
 *   historical query parameter names and the PUT update
 * - the pure column and row normalisation lives in webexpress.webapp.tableModel
 *   and is unit tested in isolation
 * The emitted events and the rendered DOM are unchanged.
 */
webexpress.webapp.TableCtrl = class extends webexpress.webui.TableCtrlReorderable {
    // configuration
    _restUri = "";
    _viewState = null;
    _sliceTotal = 0;

    // view data
    _rows = {};

    // ui helpers
    _progressDiv = null;

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
     * The endpoint comes from the wx-service island; data-page-size configures
     * the number of rows per page.
     * @param {HTMLElement} element - The host DOM element for this controller.
     */
    constructor(element) {
        // consume the islands before the base constructor reshapes the
        // children; later reads are served from the element cache
        webexpress.webapp.Data.readState(element);
        webexpress.webapp.ServiceRegistry.fromElement(element);

        super(element);

        // the resource a scope renders. when present, the table is a pure view
        // of a central resource the enclosing scope owns; when absent it owns
        // its state and loads itself (standalone).
        this._resource = (element.dataset && element.dataset.wxResource) || null;

        // canonical state: a single source of truth that the accessors below
        // read from and write to. seeded from the optional wx-state island. in
        // scope mode this is replaced by the scope ViewState once it resolves.
        this._store = new webexpress.webapp.ViewState(element, { standalone: true, state: Object.assign({
            search: "",
            wql: "",
            filter: "",
            page: 0,
            pageSize: 50,
            orderBy: null,
            orderDir: null,
            total: 0,
            loading: false,
            error: null
        }, webexpress.webapp.Data.readState(element)) });

        // data service from the wx-service island
        const islandServices = webexpress.webapp.ServiceRegistry.fromElement(element);
        this._service = islandServices.data;
        this._restUri = this._service ? this._service.baseUri : "";

        if (element.dataset.pageSize) {
            const parsed = parseInt(element.dataset.pageSize, 10);
            this._pageSize = (isNaN(parsed) || parsed <= 0) ? 50 : parsed;
        }

        this._initProgressBar(element);

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

        if (this._resource) {
            // scope mode: the enclosing scope loads the resource centrally; this
            // table only subscribes to its slice and renders it
            this._attachToScope(element);
        } else if (this._restUri) {
            this._load();
        } else {
            this._toggleProgress(false);
        }
    }

    /**
     * Attaches the table to the enclosing scope ViewState and renders its
     * resource slice. The scope owns the state, the service and the central
     * load, so the table becomes a pure view: it subscribes to the slice and
     * re-renders whenever the scope re-queries the resource. The shared scope
     * state also becomes the table's store, so the search, paging and sort binds
     * drive the same keys every control in the scope reads.
     * @param {HTMLElement} element The host element.
     */
    _attachToScope(element) {
        const viewId = (element.dataset && element.dataset.wxView) || null;

        webexpress.webapp.ViewStateRegistry.whenReady(element, viewId, (viewState) => {
            this._viewState = viewState;
            this._store = viewState;

            const serviceName = (element.dataset && element.dataset.wxService) || "data";
            const service = viewState.useService(serviceName);
            if (service) {
                this._service = service;
                this._restUri = service.baseUri;
            }

            const unsubscribe = viewState.watch((state) => state[this._resource], (slice) => this._applySlice(slice));
            (element._wxCleanup = element._wxCleanup || []).push(unsubscribe);

            this._applySlice(viewState.getState()[this._resource]);
        });
    }

    /**
     * Renders a resource slice the scope loaded centrally. The slice carries the
     * raw response, which the table normalises into its columns and rows exactly
     * as the standalone load does.
     * @param {object} slice The resource slice { items, total, data, loading, error }.
     */
    _applySlice(slice) {
        slice = slice || {};
        this._sliceTotal = Number(slice.total) || 0;

        if (slice.data) {
            this.updateData(slice.data);
        }

        this._toggleProgress(false);
    }

    // state accessors backed by the store, so the single source of truth is the
    // store while the inherited pager, sorting and persistence logic keeps
    // reading fields

    get _search() { return this._store.getState().search; }
    set _search(value) { this._store.setState({ search: value }); }

    get _wql() { return this._store.getState().wql; }
    set _wql(value) { this._store.setState({ wql: value }); }

    get _filter() { return this._store.getState().filter; }
    set _filter(value) { this._store.setState({ filter: value }); }

    get _page() { return this._store.getState().page; }
    set _page(value) { this._store.setState({ page: value }); }

    get _pageSize() { return this._store.getState().pageSize; }
    set _pageSize(value) { this._store.setState({ pageSize: value }); }

    get _orderBy() { return this._store.getState().orderBy; }
    set _orderBy(value) { this._store.setState({ orderBy: value }); }

    get _orderDir() { return this._store.getState().orderDir; }
    set _orderDir(value) { this._store.setState({ orderDir: value }); }

    // in scope mode the total comes from the resource slice, not from a top
    // level state key, so several resources in one scope keep separate totals
    get _totalRecords() { return this._viewState ? this._sliceTotal : this._store.getState().total; }
    set _totalRecords(value) { this._store.setState({ total: value }); }

    get _isLoading() { return this._store.getState().loading; }
    set _isLoading(value) { this._store.setState({ loading: value }); }

    /**
     * Initialize DOM and document-level event listeners required by the control.
     * Listens for:
     * - TABLE_SORT_EVENT to apply server-side sorting (or emit local request)
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

                    if (this._viewState) {
                        this._viewState.reload(this._resource);
                    } else if (this._restUri) {
                        this._load();
                    } else {
                        this._dispatch(webexpress.webui.Event.TABLE_SORT_EVENT, {
                            orderBy: this._orderBy, orderDir: this._orderDir
                        });
                    }
                }
            }
        });
    }

    /**
     * Initialize or bind a pagination control and an information area.
     * If an element with class "wx-webui-pagination" exists inside the host,
     * it is used. Otherwise a pager element is created and an instance of
     * PaginationCtrl is constructed. An info line showing totals is appended.
     * @param {HTMLElement} host - The host element to search or attach the pager to.
     */
    _initPager(host) {
        // find existing pager element
        const paginationId = host.dataset.wxSourcePaging || null;
        const init = () => {
            this._pagerElement = document.querySelector(paginationId);

            if (this._pagerElement) {
                this._pagerCtrl = webexpress.webui.Controller.getInstanceByElement(this._pagerElement);
            }

            this._syncPagerAndInfo();
        }

        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", () => init());
        } else {
            init();
        }

        // create info div to show totals and current page details
        this._infoDiv = document.createElement("div");
        this._infoDiv.className = "text-muted small";
        this._infoDiv.style.marginTop = "0.25rem";
        this._infoDiv.textContent = "";

        host.appendChild(this._infoDiv);
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

        // clamp current page to available range. the upper bound only applies
        // when the total is known, so a page seeded through the data-wx-state
        // island survives until the first response reports the real total
        if (this._page < 0) {
            this._page = 0;
        }
        if (total > 0 && this._page >= totalPages) {
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
     * Create and insert the progress bar element used to indicate loading state.
     * @param {HTMLElement} element - host element to which the progress bar will be added.
     */
    _initProgressBar(element) {
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
     * Request data from the configured REST endpoint through the data service.
     * A superseded query is cancelled by the service, so a stale response
     * arrives as an abort result and is ignored here.
     * @returns {Promise<void>} Resolves when the load completes.
     */
    async _load() {
        // abort if no uri or service
        if (!this._restUri || !this._service) {
            return;
        }

        this._toggleProgress(true);

        const params = webexpress.webapp.tableModel.queryParams(this._store.getState());
        const result = await this._service.query(params);

        if (!result.ok) {
            // handle aborts silently (a newer query replaced this one)
            if (result.error.kind === "abort") {
                return;
            }

            console.error("TableCtrl Request failed:", result.error.message);
            this._store.setState({ error: result.error });
            this._toggleProgress(false);
            this._isLoading = false;
            return;
        }

        const response = result.data;

        // reduce the total and the clamped page into the store
        this._store.setState(webexpress.webapp.tableModel.reduceResponse(this._store.getState(), response));

        // slice raw rows to the page size before integrating
        const newRows = webexpress.webapp.tableModel.sliceRows(response.rows || [], this._pageSize);
        const responseForUpdate = Object.assign({}, response, { rows: newRows });

        // integrate received data into table structures
        this.updateData(responseForUpdate);

        // notify listeners that data arrived
        this._dispatch(webexpress.webui.Event.DATA_ARRIVED_EVENT, {
            id: this._element.id,
            response: responseForUpdate,
            page: this._page
        });

        // sync pager and info in a microtask
        setTimeout(() => {
            this._syncPagerAndInfo();
        }, 0);

        this._toggleProgress(false);
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
            this._columns = webexpress.webapp.tableModel.normalizeColumns(response, this._orderBy, this._orderDir);
        }

        // normalize incoming rows (recursing into children and slicing)
        this._rows = webexpress.webapp.tableModel.normalizeRows(response, this._pageSize);

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
     * Initialize listeners that persist column / row layout changes (order,
     * width, visibility) to the configured REST endpoint.
     *
     * Column changes are funneled through {@link _schedulePersist} (which is
     * invoked by reorder, visibility and resize interactions in the base
     * control), so a single override produces a debounced snapshot covering
     * all three dimensions. Row reordering is handled separately because the
     * base control does not include row order in its persisted state.
     *
     * @param {HTMLElement} element - the host element to attach listeners to.
     */
    _initPersistenceListeners(element) {
        const dispatchUpdate = (type) => {
            this._dispatch(webexpress.webui.Event.UPDATED_EVENT, {
                type: type,
                columns: this._snapshotColumns(),
                rowOrder: this._rows.map((r) => r.id).join(",")
            });
        };

        // Intercept the base control's persistence hook so every column-side
        // change (reorder, visibility, width) is mirrored to the server.
        const basePersist = this._schedulePersist ? this._schedulePersist.bind(this) : null;
        this._schedulePersist = () => {
            if (basePersist) {
                basePersist();
            }
            this._scheduleColumnSync();
        };

        element.addEventListener(webexpress.webui.Event.COLUMN_REORDER_EVENT, () => dispatchUpdate("column-reorder"));
        element.addEventListener(webexpress.webui.Event.COLUMN_VISIBILITY_EVENT, () => dispatchUpdate("column-visibility"));
        element.addEventListener(webexpress.webui.Event.ROW_REORDER_EVENT, () => {
            dispatchUpdate("row-reorder");
            this._scheduleRowSync();
        });
    }

    /**
     * Build a serializable description of the current column layout.
     * The position in the returned array reflects the display order.
     * @returns {Array<{id: string, visible: boolean, width: (number|null)}>}
     */
    _snapshotColumns() {
        return (this._columns || []).map((c) => {
            let width = null;
            if (typeof c.width === "number" && isFinite(c.width)) {
                width = Math.round(c.width);
            } else if (typeof c.width === "string" && c.width !== "" && c.width !== "auto") {
                const parsed = parseInt(c.width, 10);
                if (!isNaN(parsed)) {
                    width = parsed;
                }
            }

            return {
                id: c.id,
                visible: c.visible !== false,
                width: width
            };
        });
    }

    /**
     * Debounce column-state updates to avoid flooding the server while the
     * user is actively dragging a column resize handle.
     */
    _scheduleColumnSync() {
        if (!this._restUri) {
            return;
        }
        if (this._columnSyncTimer) {
            clearTimeout(this._columnSyncTimer);
        }
        this._columnSyncTimer = setTimeout(() => {
            this._columnSyncTimer = null;
            this._sendStateToServer({ c: this._snapshotColumns() });
        }, 300);
    }

    /**
     * Debounce row-order updates so a burst of reorders sends only one
     * request.
     */
    _scheduleRowSync() {
        if (!this._restUri) {
            return;
        }
        if (this._rowSyncTimer) {
            clearTimeout(this._rowSyncTimer);
        }
        this._rowSyncTimer = setTimeout(() => {
            this._rowSyncTimer = null;
            this._sendStateToServer({ r: this._rows.map((r) => r.id).filter((id) => id != null) });
        }, 300);
    }

    /**
     * Send a state payload to the configured REST endpoint through the data
     * service using its update operation (PUT). The payload uses the same shape
     * consumed by <c>RestApiTable.Configure</c>:
     * <c>{ "c": [{ "id", "visible", "width" }, ...], "r": ["rowId", ...] }</c>.
     * @param {Object} stateObj - JSON-serializable object representing the state.
     */
    _sendStateToServer(stateObj) {
        if (!this._restUri || !this._service) {
            return;
        }
        this._service.update(stateObj).then((result) => {
            if (!result.ok && result.error.kind !== "abort") {
                console.error("Update state failed", result.error.message);
            }
        });
    }

    /**
     * Updates the control.
     */
    update() {
        if (this._viewState) {
            this._viewState.reload(this._resource);
            return;
        }
        if (this._restUri) {
            if (this._isVisible()) {
                this._load();
            }
        }
    }

    /**
     * Dispatches an intent against the table's store and service, mirroring
     * the dispatch surface of the Data base, so that the search, paging and
     * filter binds and the dispatch action all feed the same unidirectional
     * loop.
     * @param {string} name The intent name.
     * @param {*} payload The intent payload.
     * @returns {*} The return value of the intent effect, when present.
     */
    dispatch(name, payload) {
        return webexpress.webapp.Intents.dispatch(name, {
            store: this._store,
            payload: payload,
            services: { data: this._service },
            component: this,
            viewState: this._viewState,
            element: this._element
        });
    }

    /**
     * Loads the table when it is backed by a service and visible. Intent
     * effects call this after their reducer updated the store.
     * @returns {Promise<void>|undefined} Resolves when the load completes.
     */
    load() {
        if (this._viewState) {
            return this._viewState.reload(this._resource);
        }
        if (this._restUri && this._isVisible()) {
            return this._load();
        }
        return undefined;
    }

    /**
     * Sets the search filter and reloads the first page.
     * @param {string} pattern - Search pattern
     * @param {string} [searchType="basic"] -  Filter type ("basic" or "wql").
     */
    search(pattern = "", searchType = "basic") {
        this.dispatch("table/search", { pattern: pattern, searchType: searchType });
    }

    /**
     * Sets the filter and reloads the first page.
     * @param {string} pattern - Filter pattern.
     */
    filter(pattern = "") {
        this.dispatch("table/filter", { pattern: pattern });
    }

    /**
     * Sets and loads the page.
     * @param {string} page - The current page pattern.
     */
    paging(page = 0) {
        this.dispatch("table/page", { page: page });
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
