/**
 * A REST-enabled table control that extends the reorderable table class and
 * integrates with a REST API. Supports standard pagination.
 *
 * Emits events:
 * - webexpress.webui.Event.DATA_ARRIVED_EVENT
 *
 * The control renders on the view of the reorderable table and keeps the contract of
 * the Data base by hand, because it cannot derive from it:
 * - its own state is a standalone webexpress.webapp.ViewState that holds the view state
 *   of the table (columns, rows, selection) together with the query, paging and result
 *   state; inside a ViewState region (data-wx-resource) the query belongs to the region's
 *   ViewState instead, which `store`, the binds and the intents then address, while the
 *   view state stays the table's own
 * - the host is rendered from that state: the progress bar, the table and the paging
 *   info line, with room for a toolbar a subclass puts ahead of them
 * - the data load and the layout state update go through a
 *   webexpress.webapp.RestService, configured from the data-wx-service island or,
 *   inside a ViewState, from the service of the bound resource; a host without
 *   either loads nothing
 * - the mount is announced, so a bind that targets the table resolves its store even
 *   when it was bound before the table existed
 * - the pure column and row normalisation lives in webexpress.webapp.tableModel
 *   and is unit tested in isolation
 */
webexpress.webapp.TableCtrl = class extends webexpress.webui.TableReorderableCtrl {
    // configuration
    _restUri = "";
    _viewState = null;

    // a query that was asked for while the table was hidden and still has to run
    _pendingLoad = false;

    // the layout of the columns and the arrangement of the rows the server confirmed
    // last, which a refused change goes back to
    _confirmedLayout = null;
    _importedLayout = null;
    _confirmedRows = null;

    // the pagination control the table reports its page count to, and what it reported
    _pagerElement = null;
    _pagerCtrl = null;
    _pagerShown = null;

    // placeholder data shown while initial load is in progress
    _previewColumns = [
        { id: "__preview0", label: "", width: null, visible: true },
        { id: "__preview1", label: "", width: null, visible: true },
        { id: "__preview2", label: "", width: null, visible: true }
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

        // the actions for a multi-selection are server markup; they are taken out before the
        // base reads the host and placed above the table again by the view
        const selectionBar = Array.from(element.children).find((x) => x.classList && x.classList.contains("wx-table-selection")) || null;
        if (selectionBar) {
            element.removeChild(selectionBar);
        }

        super(element);

        this._multiSelect = element.getAttribute("data-multiselect") === "true";
        // a row of a movable table is moved by its grip; the drag-and-drop protocol would
        // take the same drag, so the two exclude each other
        this._dragKind = this._movableRow ? null : (element.getAttribute("data-drag-kind") || null);
        this._dropKind = element.getAttribute("data-drop-kind") || null;
        this._selectionBar = selectionBar;
        this._selectionAnchor = null;
        element.removeAttribute("data-multiselect");
        element.removeAttribute("data-drag-kind");
        element.removeAttribute("data-drop-kind");
        if (this._dragKind) {
            element.setAttribute("data-wx-drag-scope", "");
        }

        // a data table has no switch for it and has always let its columns be hidden
        this._allowColumnRemove = true;

        // the resource a ViewState renders. when present, the table is a pure view
        // of a central resource the enclosing ViewState owns; when absent it owns
        // its state and loads itself (standalone).
        this._resource = (element.dataset && element.dataset.wxResource) || null;

        // the host is the render root: the table element is placed among the progress
        // bar and the info line, with the classes the base gave it
        this._tableClass = this._table.className;
        this._emptyText = element.getAttribute("data-empty-text");
        this._renderRoot = element;

        // the table's own state, seeded from the optional wx-state island
        this._useStore(new webexpress.webapp.ViewState(element, {
            standalone: true,
            state: Object.assign({}, this.state, {
                checked: [],
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
            }, webexpress.webapp.Data.readState(element), {
                columns: this._previewColumns,
                rows: this._previewBody
            })
        }));

        // data service from the wx-service island
        const islandServices = webexpress.webapp.ServiceRegistry.fromElement(element);
        this._service = islandServices.data;
        this._restUri = this._service ? this._service.baseUri : "";

        if (element.dataset.pageSize) {
            const parsed = parseInt(element.dataset.pageSize, 10);
            this._pageSize = (isNaN(parsed) || parsed <= 0) ? 50 : parsed;
        }

        if (typeof this._initPersistenceListeners === "function") {
            this._initPersistenceListeners(element);
        }

        this._initEvents();
        this._initVisibilityReload(element);

        if (new.target === webexpress.webapp.TableCtrl) {
            this._open();
        }

        if (this._resource) {
            // ViewState mode: the enclosing ViewState loads the resource centrally; this
            // table only subscribes to its slice and renders it
            this._attachToViewState(element);
        } else if (this._restUri) {
            this._load();

            // an external change of the service's domains re-queries and
            // flashes, so changes made by other users re-render standalone too
            const dataChanges = webexpress.webapp.DataChangeSubscription.attachReload(
                [this._service], () => this._load(), element);
            if (dataChanges) {
                (element._wxCleanup = element._wxCleanup || []).push(() => dataChanges.detach());
            }
        }

        this._announceMount();
    }

    /**
     * Announces the mount the way the Data base does, so binds that target this table
     * resolve its store even when they were bound before the table existed. The
     * announcement waits for the end of the turn, because a bind resolves the table
     * through the controller, which knows the instance only once its constructor -
     * the one of a subclass included - has returned.
     */
    _announceMount() {
        setTimeout(() => {
            if (this._element && typeof this._element.dispatchEvent === "function") {
                this._element.dispatchEvent(new CustomEvent("webexpress.webapp.data.mount", {
                    bubbles: true,
                    detail: { component: this }
                }));
            }
        }, 0);
    }

    /**
     * Attaches the table to the enclosing ViewState and renders its
     * resource slice. The ViewState owns the query, the service and the central
     * load, so the table becomes a view of it: it subscribes to the slice and
     * re-renders whenever the ViewState re-queries the resource. The search, paging
     * and sort binds drive the query keys of the ViewState every control in it reads.
     * @param {HTMLElement} element The host element.
     */
    _attachToViewState(element) {
        const viewStateId = (element.dataset && element.dataset.wxViewstate) || null;

        webexpress.webapp.ViewStateRegistry.whenReady(element, viewStateId, (viewState) => {
            this._viewState = viewState;

            const service = viewState.serviceForResource(this._resource);
            if (service) {
                this._service = service;
                this._restUri = service.baseUri;
            }

            const unsubscribe = viewState.watch((state) => viewState.slice(this._resource, state), (slice) => this._applySlice(slice));
            (element._wxCleanup = element._wxCleanup || []).push(unsubscribe);

            this._applySlice(viewState.slice(this._resource));
        });
    }

    /**
     * Renders a resource slice the ViewState loaded centrally. The slice carries the
     * raw response, which the table normalises into its columns and rows exactly
     * as the standalone load does. Its total and the page of the query are copied
     * into the table's own state, so the info line renders from that state alone.
     * @param {object} slice The resource slice { items, total, data, loading, error }.
     */
    _applySlice(slice) {
        slice = slice || {};
        this.setState({ total: Number(slice.total) || 0, page: this._page || 0, error: slice.error || null });

        if (slice.data) {
            this.updateData(slice.data);
        }

        // the slice is the record of the central load: the progress shows while it says
        // a query is in flight, not only until the next notification arrives
        this._toggleProgress(!!slice.loading);
        this.setState({ error: slice.error || null });

        if (slice.error) {
            console.error("TableCtrl Request failed:", webexpress.webapp.ServiceResult.describe({ error: slice.error }, { resource: this._resource }));
        }
    }

    /**
     * Returns the container of the query state: the region's ViewState when the table
     * renders a resource, the table's own state otherwise.
     * @returns {object} The ViewState.
     */
    get _queryStore() {
        return this._viewState || this._store;
    }

    /**
     * Returns the container of the query state, which the search, paging and sort binds
     * address.
     * @returns {object} The ViewState.
     */
    get store() {
        return this._queryStore;
    }

    // query accessors backed by the query store, so the inherited pager, sorting and
    // persistence logic keeps reading fields

    get _search() { return this._queryStore.getState().search; }
    set _search(value) { this._queryStore.setState({ search: value }); }

    get _wql() { return this._queryStore.getState().wql; }
    set _wql(value) { this._queryStore.setState({ wql: value }); }

    get _filter() { return this._queryStore.getState().filter; }
    set _filter(value) { this._queryStore.setState({ filter: value }); }

    get _page() { return this._queryStore.getState().page; }
    set _page(value) { this._queryStore.setState({ page: value }); }

    get _pageSize() { return this._queryStore.getState().pageSize; }
    set _pageSize(value) { this._queryStore.setState({ pageSize: value }); }

    get _orderBy() { return this._queryStore.getState().orderBy; }
    set _orderBy(value) { this._queryStore.setState({ orderBy: value }); }

    get _orderDir() { return this._queryStore.getState().orderDir; }
    set _orderDir(value) { this._queryStore.setState({ orderDir: value }); }

    // the total and the loading flag are the table's own: inside a ViewState the total
    // comes from the resource slice, so several resources in one ViewState keep their own
    get _totalRecords() { return this.state.total; }
    set _totalRecords(value) { this.setState({ total: value }); }

    get _isLoading() { return this.state.loading; }
    set _isLoading(value) { this.setState({ loading: !!value }); }

    /**
     * Describes the host: a subclass toolbar, the progress bar, the table and the info
     * line. The table element is placed with the children the base describes for it.
     * @param {object} state - The state.
     * @returns {Array<object>} The virtual nodes of the host.
     */
    _viewTree(state) {
        const h = webexpress.webui.h;
        const preview = state.rows === this._previewBody;
        // the placeholders shimmer while they stand in for rows, and so does an empty
        // table while its rows are on the way
        const glow = preview || (state.loading && state.rows.length === 0);

        return [
            this._renderToolbar(state),
            this._renderSelectionBar(state),
            h("div", {
                key: "progress",
                class: "progress mb-2",
                role: "status",
                style: "height: 0.25rem; visibility: " + (state.loading ? "visible" : "hidden")
            }, h("div", { class: "progress-bar progress-bar-striped progress-bar-animated", style: "width: 100%" })),
            webexpress.webui.Renderer.adopt(this._table, {
                class: glow ? this._tableClass + " placeholder-glow" : this._tableClass
            }, super._viewTree(state)),
            !state.loading && state.error ? h("div", { key: "error", role: "alert" },
                this._i18n("webexpress.webui:table.load.error", "The table could not be loaded.")) :
                !preview && !state.loading && state.rows.length === 0 ? h("div", { key: "empty", role: "status" },
                    this._emptyText ?? this._i18n("webexpress.webui:table.empty", "No entries.")) : null,
            h("div", {
                key: "info",
                class: "text-muted small",
                style: "margin-top: 0.25rem",
                ref: (el) => { this._infoDiv = el; }
            }, this._infoText(state, preview))
        ];
    }

    /**
     * Places the actions of a multi-selection above the table. The bar shows only while rows
     * are chosen and names how many.
     * @param {object} state - The state.
     * @returns {object|null} The bar virtual node, or null.
     */
    _renderSelectionBar(state) {
        if (!this._multiSelect || !this._selectionBar) {
            return null;
        }
        const h = webexpress.webui.h;
        const count = (state.checked || []).length;

        return webexpress.webui.Renderer.adopt(this._selectionBar, {
            key: "selection",
            role: "toolbar",
            "aria-label": this._i18n("webexpress.webapp:table.selection.toolbar", "Actions for the selected rows"),
            hidden: count === 0 ? true : null
        }, [h("span", { key: "count", class: "wx-table-selection-count", role: "status" },
            this._i18n("webexpress.webapp:table.selection.count", "{0} selected").replace("{0}", String(count))),
        ...this._selectionBarContent()]);
    }

    /**
     * Returns the server rendered actions of the selection bar, without the count the view adds.
     * @returns {Array<object>} The adopted nodes.
     */
    _selectionBarContent() {
        if (!this._selectionActions) {
            this._selectionActions = Array.from(this._selectionBar.children);
        }
        return this._selectionActions.map((el, index) => webexpress.webui.Renderer.adopt(el, { key: "action-" + index }));
    }

    /**
     * Gets the ids of the chosen rows.
     * @returns {Array<string>} The ids.
     */
    get selection() {
        return [...(this.state.checked || [])];
    }

    /**
     * Chooses the rows of the given ids.
     * @param {Array<string>} ids - The ids.
     */
    set selection(ids) {
        this._setChecked(Array.isArray(ids) ? ids.map(String) : []);
    }

    /**
     * Clears the multi-selection.
     */
    clearSelection() {
        this._setChecked([]);
    }

    /**
     * Stores the chosen rows and announces a change.
     * @param {Array<string>} ids - The ids.
     */
    _setChecked(ids) {
        const unique = [...new Set(ids)];
        const previous = this.state.checked || [];
        if (unique.length === previous.length && unique.every((x, i) => x === previous[i])) {
            return;
        }
        this.setState({ checked: unique });
        this._dispatch(webexpress.webui.Event.SELECTION_CHANGED_EVENT, { ids: [...unique] });
    }

    /**
     * Returns the ids of the rows on screen, in display order, that can be chosen.
     * @returns {Array<string>} The ids.
     */
    _visibleRowIds() {
        const ids = [];
        const walk = (rows) => {
            for (const row of rows || []) {
                if (row.id !== undefined && row.id !== null && row.id !== "" && !this._previewBody.includes(row)) {
                    ids.push(String(row.id));
                }
                if (this._treeEnabled !== false && row.children?.length && row.expanded) {
                    walk(row.children);
                }
            }
        };
        walk(this.state.rows);
        return ids;
    }

    /**
     * Chooses or releases a row: alone, added with Ctrl (Cmd), or as the range from the last
     * chosen row with Shift.
     * @param {Object} row - The row.
     * @param {object} modifiers - shiftKey, ctrlKey and metaKey of the gesture.
     */
    _check(row, modifiers = {}) {
        const id = String(row.id);
        const checked = this.state.checked || [];

        if (modifiers.shiftKey && this._selectionAnchor) {
            const ids = this._visibleRowIds();
            const from = ids.indexOf(this._selectionAnchor);
            const to = ids.indexOf(id);
            if (from >= 0 && to >= 0) {
                const range = ids.slice(Math.min(from, to), Math.max(from, to) + 1);
                this._setChecked([...checked, ...range]);
                return;
            }
        }

        this._selectionAnchor = id;
        this._setChecked(checked.includes(id) ? checked.filter((x) => x !== id) : [...checked, id]);
    }

    /**
     * Chooses every row on screen, or releases them when all are chosen.
     */
    _checkAll() {
        const ids = this._visibleRowIds();
        const checked = this.state.checked || [];
        const all = ids.length > 0 && ids.every((x) => checked.includes(x));
        this._setChecked(all ? checked.filter((x) => !ids.includes(x)) : [...checked, ...ids]);
    }

    /**
     * Adds a row to the multi-selection on a click with Ctrl (Cmd) or Shift; a plain click
     * selects the row as before.
     * @param {Object} row - The clicked row.
     * @param {Event} e - The click.
     * @param {boolean} [renderNow=true] - Whether a plain selection renders at once.
     */
    _selectRowInternal(row, e, renderNow = true) {
        if (this._multiSelect && e && (e.ctrlKey || e.metaKey || e.shiftKey) && row && row.id != null) {
            this._check(row, e);
            return;
        }
        super._selectRowInternal(row, e, renderNow);
    }

    /**
     * Names the track of the checkbox column ahead of the grip.
     * @returns {Array<string>} The track sizes.
     */
    _gridPrefixTracks() {
        return [...(this._multiSelect ? ["2rem"] : []), ...super._gridPrefixTracks()];
    }

    /**
     * Describes the header of the checkbox column: the checkbox that chooses every row.
     * @param {object} state - The state.
     * @returns {*} The header cells.
     */
    _renderHeadPrefix(state) {
        if (!this._multiSelect) {
            return super._renderHeadPrefix(state);
        }
        const h = webexpress.webui.h;
        const ids = this._visibleRowIds();
        const checked = state.checked || [];
        const count = ids.filter((x) => checked.includes(x)).length;

        return [h("div", { key: "__check", class: "wx-table-check-column", role: "columnheader" },
            h("input", {
                type: "checkbox",
                class: "form-check-input",
                checked: ids.length > 0 && count === ids.length,
                "aria-label": this._i18n("webexpress.webapp:table.select.all", "Select all rows"),
                ref: (el) => { el.indeterminate = count > 0 && count < ids.length; },
                on: { click: () => this._checkAll() }
            })), super._renderHeadPrefix(state)];
    }

    /**
     * Describes the checkbox of a row ahead of its grip.
     * @param {object} state - The state.
     * @param {Object} row - The row.
     * @returns {*} The leading cells.
     */
    _renderRowPrefix(state, row) {
        if (!this._multiSelect) {
            return super._renderRowPrefix(state, row);
        }
        const h = webexpress.webui.h;
        const selectable = row.id !== undefined && row.id !== null && row.id !== "" && !this._previewBody.includes(row);

        return [h("div", { key: "__check", class: "wx-grid-cell wx-table-check-column", role: this._cellRole },
            selectable ? h("input", {
                type: "checkbox",
                class: "form-check-input",
                checked: (state.checked || []).includes(String(row.id)),
                "aria-label": this._i18n("webexpress.webapp:table.select.row", "Select row"),
                on: { click: (e) => this._check(row, e) }
            }) : null), super._renderRowPrefix(state, row)];
    }

    /**
     * Describes the placeholder under the checkboxes in the footer.
     * @param {object} state - The state.
     * @returns {*} The footer cells.
     */
    _renderFootPrefix(state) {
        if (!this._multiSelect) {
            return super._renderFootPrefix(state);
        }
        return [webexpress.webui.h("div", { key: "__check", class: "wx-grid-cell wx-table-check-column", role: this._cellRole }),
            super._renderFootPrefix(state)];
    }

    /**
     * Marks a chosen row and makes a row a source or a target of the drag-and-drop protocol.
     * A drag that starts on a chosen row carries every chosen row.
     * @param {object} state - The state.
     * @param {Object} row - The row.
     * @returns {object|null} The attributes.
     */
    _rowAttributes(state, row) {
        if (row.id === undefined || row.id === null || row.id === "" || this._previewBody.includes(row)) {
            return null;
        }
        const attributes = webexpress.webui.DragDrop
            ? webexpress.webui.DragDrop.attributes(row.id, { dragKind: this._dragKind, dropKind: this._dropKind })
            : {};
        if (this._multiSelect && (state.checked || []).includes(String(row.id))) {
            attributes["aria-selected"] = "true";
        }
        return attributes;
    }

    /**
     * Hook for subclasses to describe a toolbar ahead of the table.
     * @param {object} state - The state.
     * @returns {object|null} The toolbar virtual node, or null.
     */
    _renderToolbar(state) {
        return null;
    }

    /**
     * Gets the paging info line. While a page loads, the line names the page on its way
     * rather than reporting the window of the previous one; before the first load there
     * is nothing to report.
     * @param {object} state - The state.
     * @param {boolean} preview - Whether the placeholders are shown.
     * @returns {string} The info text.
     */
    _infoText(state, preview) {
        const total = Number(state.total) || 0;
        const pages = this._pageCount(total);
        const page = state.page || 0;

        if (state.loading) {
            return webexpress.webapp.pagingInfoLoading(this, page, pages);
        }
        if (preview) {
            return "";
        }
        return webexpress.webapp.pagingInfo(this, page, pages, state.rows.length, total);
    }

    /**
     * Gets the number of pages a total fills.
     * @param {number} total - The number of records.
     * @returns {number} The page count, at least one.
     */
    _pageCount(total) {
        return this._pageSize > 0 ? Math.max(1, Math.ceil(total / this._pageSize)) : 1;
    }

    /**
     * Follows a render with the pagination control, which is a sibling control the
     * table reports its page and page count to.
     * @param {object} state - The rendered state.
     */
    onUpdate(state) {
        super.onUpdate(state);
        this._syncPager(state);
    }

    /**
     * Selects the first row once real rows arrived. The table opens on its placeholders
     * before the first load is under way, and a placeholder taken as the first row would
     * use up the one automatic selection.
     */
    _autoSelectFirstRow() {
        if (this._rows === this._previewBody) {
            return;
        }
        super._autoSelectFirstRow();
    }

    /**
     * Stops what outlives a render: the pending layout updates and the queries in flight.
     */
    onUnmount() {
        super.onUnmount();
        clearTimeout(this._columnSyncTimer);
        clearTimeout(this._rowSyncTimer);
        if (this._service && typeof this._service.abort === "function") {
            this._service.abort();
        }
    }

    /**
     * Initialize DOM and document-level event listeners required by the control.
     * Listens for:
     * - TABLE_SORT_EVENT to apply server-side sorting (or emit local request)
     */
    _initEvents() {
        // bind to document to catch events that might not bubble to this._element
        const handler = (e) => {
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
                    // a lifted sort leaves the order to the server rather than asking
                    // for the column without a direction
                    this._orderDir = detail.sortDirection || null;
                    this._orderBy = this._orderDir ? detail.columnId : null;
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
        };

        document.addEventListener(webexpress.webui.Event.TABLE_SORT_EVENT, handler);
        (this._element._wxCleanup = this._element._wxCleanup || []).push(
            () => document.removeEventListener(webexpress.webui.Event.TABLE_SORT_EVENT, handler));
    }

    /**
     * Resolves the pagination control the table reports its page count to, and
     * remembers it once it exists.
     * @remarks
     * The pager is a sibling control rather than a child, and the controller
     * builds a pane's controls in document order - the pager sits below the
     * table, so its instance does not exist yet while the table is being
     * constructed. Resolving once therefore left the reference empty for good:
     * the table wrote its page count into the pager's dataset, nothing read it,
     * and the pager kept offering the single page it had rendered at startup.
     * The lookup is repeated until it succeeds instead, which costs one query
     * per render and nothing after that.
     * @returns {object|null} The pagination control, or null while there is none.
     */
    _resolvePager() {
        const selector = (this._element && this._element.dataset)
            ? (this._element.dataset.wxSourcePaging || null)
            : null;

        if (!selector) {
            return null;
        }

        if (!this._pagerElement) {
            this._pagerElement = document.querySelector(selector);
        }

        if (this._pagerElement && !this._pagerCtrl) {
            this._pagerCtrl = webexpress.webui.Controller.getInstanceByElement(this._pagerElement);
        }

        return this._pagerCtrl;
    }

    /**
     * Reports the page and the page count to the pagination control, silently (without
     * firing CHANGE_PAGE_EVENT), and only when either changed since the last report.
     * @param {object} state - The rendered state.
     */
    _syncPager(state) {
        const pager = this._resolvePager();
        const totalPages = this._pageCount(Number(state.total) || 0);
        const currentPage = this._page || 0;
        const shown = `${currentPage}/${totalPages}/${!!pager}`;

        if (!this._pagerElement || shown === this._pagerShown) {
            return;
        }
        this._pagerShown = shown;

        this._pagerElement.dataset.page = String(currentPage);
        this._pagerElement.dataset.total = String(totalPages);

        if (pager) {
            if (typeof pager.updateState === "function") {
                // updatestate will not dispatch change_page_event
                pager.updateState(currentPage, totalPages);
            } else {
                // fall back: set properties directly
                try {
                    pager.total = totalPages;
                    pager.page = currentPage;
                } catch (e) {
                    // ignore errors when setting fallback properties
                }
            }
        }
    }

    /**
     * Keeps the page inside the range the total allows. The upper bound only applies
     * when the total is known, so a page seeded through the data-wx-state island
     * survives until the first response reports the real total.
     */
    _clampPage() {
        const total = Number(this._totalRecords) || 0;
        const totalPages = this._pageCount(total);

        if (this._page < 0) {
            this._page = 0;
        }
        if (total > 0 && this._page >= totalPages) {
            this._page = totalPages - 1;
        }
    }

    /**
     * Shows or hides the progress of a load.
     * @param {boolean} show - true while a load is in flight.
     */
    _toggleProgress(show) {
        this._isLoading = show;
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

        const params = webexpress.webapp.tableModel.queryParams(this._queryStore.getState());
        const result = await this._service.query(params);

        if (!result.ok) {
            // handle aborts silently (a newer query replaced this one)
            if (result.error.kind === "abort") {
                return;
            }

            console.error("TableCtrl Request failed:", webexpress.webapp.ServiceResult.describe(result, {
                uri: this._restUri,
                params: params
            }));
            this._queryStore.setState({ error: result.error });
            this._toggleProgress(false);
            return;
        }

        const response = result.data;

        // reduce the total and the clamped page into the store
        this._queryStore.setState(webexpress.webapp.tableModel.reduceResponse(this._queryStore.getState(), response));

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

        this._toggleProgress(false);
    }

    /**
     * Normalize and integrate server response into internal table data structures.
     *
     * The columns are merged anew with every response: the server owns what a column is
     * and which columns exist, the local layout only how the reader arranged them. The
     * cells of the response follow the order of the server and are brought into the
     * order on screen. The rows are new objects, so the selection is carried over by the
     * row id - or given up and announced when its row is gone.
     * @param {Object} response - parsed JSON response from the REST endpoint.
     */
    updateData(response) {
        if (!response) {
            return;
        }

        const model = webexpress.webapp.tableModel;
        const sourceColumns = Array.isArray(response.columns)
            ? model.normalizeColumns(response, this._orderBy, this._orderDir) : null;
        if (sourceColumns) {
            this._sourceColumnIds = sourceColumns.map(column => column.id);
            this._columns = model.mergeColumns(sourceColumns, this._currentLayout());
        } else if (this._hasPlaceholderColumns()) {
            this._columns = [];
        }

        const previous = this._selectedRow;
        this._rows = model.normalizeRows(response, this._pageSize);

        if (this._sourceColumnIds) {
            const sourceIndex = new Map(this._sourceColumnIds.map((id, index) => [id, index]));
            const rows = [...this._rows];
            while (rows.length) {
                const row = rows.pop();
                row.cells = this._columns.map(column => row.cells[sourceIndex.get(column.id)] || { content: "" });
                if (row.children) rows.push(...row.children);
            }
        }

        this._restoreCollapsed(this._readStoredState());

        // the query owns REST sorting; a local layout preference cannot change its result
        this._columns.forEach(column => {
            column.sort = column.id === this._orderBy ? this._orderDir : null;
        });

        // what the server sent is the state both sides agree on
        if (!this._confirmedLayout && this._columns.length) {
            this._confirmedLayout = this._layoutOf(this._columns);
        }
        this._confirmedRows = this._snapshotRowTree();

        const selected = previous && previous.id != null ? this._findRowById(previous.id) : null;
        const lost = !!previous && !selected && !this._previewBody.includes(previous);
        this._selectedRow = selected;

        this._recalculateHasOptions();
        this._clampPage();
        this.render();

        // a chosen row the new data no longer shows is released, so the bar never acts on rows
        // that are gone - the usual end of a bulk action
        if (this._multiSelect) {
            const shown = new Set(this._visibleRowIds());
            this._setChecked((this.state.checked || []).filter((x) => shown.has(x)));
        }

        if (lost) {
            this._dispatch(webexpress.webui.Event.SELECT_ROW_EVENT, {
                sender: this._element,
                row: null,
                rowId: null
            });
        }
    }

    /**
     * Indicates whether the table still shows the placeholders of its first load, or no
     * columns at all.
     * @returns {boolean} True when there is no layout of real columns.
     */
    _hasPlaceholderColumns() {
        return !this._columns.length || this._columns === this._previewColumns;
    }

    /**
     * Gets the local layout a response is merged with: the layout on screen once there
     * is one - a change on its way to the server stays on screen across a reload until
     * the server answered it - and the layout stored locally before the first response.
     * @returns {Array<{id: string, visible: boolean, width: *}>|null} The layout.
     */
    _currentLayout() {
        return this._hasPlaceholderColumns()
            ? this._importedLayout || webexpress.webapp.tableModel.storedLayout(this._readStoredState())
            : this._layoutOf(this._columns);
    }

    /**
     * Gets the layout of columns: order, visibility and width.
     * @param {Array<object>} columns - The columns in display order.
     * @returns {Array<{id: string, visible: boolean, width: *}>} The layout.
     */
    _layoutOf(columns) {
        return columns.map((column) => ({ id: column.id, visible: column.visible !== false, width: column.width ?? null }));
    }

    /**
     * Serializes order, visibility and width without writing application storage.
     * @returns {string} The versioned layout JSON.
     */
    serializeLayout() {
        return JSON.stringify({ version: 1, columns: this._hasPlaceholderColumns() ? this._importedLayout || [] : this._layoutOf(this._columns) });
    }

    /**
     * Applies a stored layout while retaining new columns and dropping removed ones.
     * @param {string|object} value The versioned layout JSON or parsed layout.
     */
    applyLayout(value) {
        const layout = typeof value === "string" ? JSON.parse(value) : value;
        if (!layout || layout.version !== 1 || !Array.isArray(layout.columns) || layout.columns.some(entry =>
            !entry || typeof entry.id !== "string" || entry.id.length === 0 ||
            (entry.visible != null && typeof entry.visible !== "boolean") ||
            (entry.width != null && (!Number.isFinite(entry.width) || entry.width <= 0)))) {
            throw new TypeError("Invalid table layout.");
        }
        this._importedLayout = layout.columns.map(entry => ({ ...entry }));
        if (this._hasPlaceholderColumns()) return;
        const columns = webexpress.webapp.tableModel.mergeColumns(this._columns.map(column => ({ ...column })), this._importedLayout);
        this._restoreLayout(this._layoutOf(columns));
        this._confirmedLayout = this._layoutOf(columns);
        this.render();
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
     * A change is provisional until the server stored it: only then does it become
     * the confirmed state and is it stored locally as well, so a refusal has a state
     * to go back to and the local store never holds a layout the server refused.
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
        this._schedulePersist = () => {
            if (!this._restUri || !this._service) {
                // nothing will answer, so the change is confirmed as it is made
                this._confirmLayout(this._layoutOf(this._columns));
                return;
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
            const layout = this._layoutOf(this._columns);
            this._sendStateToServer({ c: this._snapshotColumns() }, () => this._confirmLayout(layout));
        }, 300);
    }

    /**
     * Makes a column layout the confirmed one and stores it locally.
     * @param {Array<{id: string, visible: boolean, width: *}>} layout - The layout.
     */
    _confirmLayout(layout) {
        this._confirmedLayout = layout;
        if (this._persistKey) {
            this._persistState(layout);
        }
    }

    /**
     * Captures the arrangement of the rows: the top level and the children of every
     * row, by reference, so a refused move can be undone whatever level it changed.
     * @returns {{rows: Array<object>, children: Map<object, Array<object>>}} The snapshot.
     */
    _snapshotRowTree() {
        const children = new Map();
        const stack = [...this._rows];
        while (stack.length) {
            const row = stack.pop();
            const list = Array.isArray(row.children) ? row.children : [];
            children.set(row, list.slice());
            stack.push(...list);
        }
        return { rows: this._rows.slice(), children: children };
    }

    /**
     * Puts the rows back into a captured arrangement.
     * @param {{rows: Array<object>, children: Map<object, Array<object>>}} snapshot - The snapshot.
     */
    _restoreRowTree(snapshot) {
        for (const [row, list] of snapshot.children) {
            row.children = list.slice();
            list.forEach((child) => { child.parent = row; });
        }
        snapshot.rows.forEach((row) => { row.parent = null; });
        this._rows = snapshot.rows.slice();
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
            const snapshot = this._snapshotRowTree();
            this._sendStateToServer({ r: this._rows.map((r) => r.id).filter((id) => id != null) }, () => {
                this._confirmedRows = snapshot;
            });
        }, 300);
    }

    /**
     * Send a state payload to the configured REST endpoint through the data
     * service using its update operation (PUT). The payload uses the same shape
     * consumed by <c>RestApiTable.Configure</c>:
     * <c>{ "c": [{ "id", "visible", "width" }, ...], "r": ["rowId", ...] }</c>.
     * @param {Object} stateObj - JSON-serializable object representing the state.
     * @param {Function} [onConfirm] - Called once the server stored the state.
     */
    _sendStateToServer(stateObj, onConfirm) {
        if (!this._restUri || !this._service) {
            return;
        }
        const action = stateObj.c ? "columns" : "rows";
        this._saveAction(action, stateObj, (sent) => this._service.update(sent), () => this._takeBack()).then((result) => {
            if (result.ok) {
                if (typeof onConfirm === "function") {
                    onConfirm();
                }
            } else if (result.error.kind !== "abort") {
                this._reject(action, result);
            }
        });
    }

    /**
     * Takes back a layout change the server refused.
     *
     * Columns and rows are rearranged on screen first and stored afterwards, so a refusal
     * leaves the table in a layout that is not stored. The table goes back to the state
     * the server confirmed last - the order, visibility and width of the columns and the
     * arrangement of the rows - stores that one locally and renders it; only without a
     * confirmed state is the table loaded anew. The refusal is put in front of the user -
     * a column that jumps back with no word about why reads as a bug of the table rather
     * than as a decision of the server.
     * @param {string} action - The change that was refused: columns or rows.
     * @param {object} result - The failed service result.
     */
    _reject(action, result) {
        console.error(`table ${action} update failed:`, webexpress.webapp.ServiceResult.describe(result, { action: action }));

        webexpress.webapp.ErrorChannel.present(result, {
            service: this._service.name,
            heading: this._i18n("webexpress.webapp:table.heading", "Table"),
            message: this._i18n("webexpress.webapp:table.update.rejected", "The layout change was not saved and has been taken back.")
        });

        this._dispatch(webexpress.webui.Event.DATA_ERROR_EVENT, { action: action, error: result.error });
        this._takeBack();
    }

    /**
     * Goes back to the layout the server confirmed last - the order, visibility and width of
     * the columns and the arrangement of the rows - after a change was refused or vetoed; only
     * without a confirmed state is the table loaded anew.
     */
    _takeBack() {
        if (!this._confirmedLayout && !this._confirmedRows) {
            this.update();
            return;
        }

        // a change still waiting for its debounce would only send the state taken back
        clearTimeout(this._columnSyncTimer);
        clearTimeout(this._rowSyncTimer);
        this._columnSyncTimer = null;
        this._rowSyncTimer = null;

        if (this._confirmedLayout) {
            this._restoreLayout(this._confirmedLayout);
            this._confirmLayout(this._confirmedLayout);
        }
        if (this._confirmedRows) {
            this._restoreRowTree(this._confirmedRows);
        }
        this.render();
    }

    /**
     * Puts the columns back into a layout: the order with the cells, the visibility and
     * the width.
     * @param {Array<{id: string, visible: boolean, width: *}>} layout - The layout.
     */
    _restoreLayout(layout) {
        this._applyColumnOrder(layout.map((entry) => entry.id));
        const byId = new Map(layout.map((entry) => [entry.id, entry]));
        for (const column of this._columns) {
            const entry = byId.get(column.id);
            if (entry) {
                column.visible = entry.visible !== false;
                column.width = entry.width;
            }
        }
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
            store: this._queryStore,
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
     * @remarks
     * A hidden table is not queried, but the query it would have run is
     * remembered and issued the moment it is shown (see
     * <c>_initVisibilityReload</c>). The presentations of one view - table, list,
     * tile - share a search box and a quickfilter bar, so a term entered while
     * this one was hidden belongs to it as well; without the deferral, switching
     * the presentation answers with whatever was on screen before the filter was
     * typed.
     * @returns {Promise<void>|undefined} Resolves when the load completes.
     */
    load() {
        if (this._viewState) {
            return this._viewState.reload(this._resource);
        }

        if (!this._restUri) {
            return undefined;
        }

        if (!this._isVisible()) {
            this._pendingLoad = true;
            return undefined;
        }

        this._pendingLoad = false;

        return this._load();
    }

    /**
     * Subscribes to the visibility changes of the enclosing view, so a query that
     * was deferred while the table was hidden runs when it is shown.
     * @param {HTMLElement} element - The host element.
     */
    _initVisibilityReload(element) {
        const handler = () => {
            if (!this._pendingLoad || !this._isVisible()) {
                return;
            }

            this._pendingLoad = false;
            this._load();
        };

        document.addEventListener(webexpress.webui.Event.CHANGE_VISIBILITY_EVENT, handler);
        (element._wxCleanup = element._wxCleanup || []).push(
            () => document.removeEventListener(webexpress.webui.Event.CHANGE_VISIBILITY_EVENT, handler));
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
     * Creates WebExpress placeholder markup for preview cells.
     * @param {string} widthClass WebExpress width class for the placeholder.
     * @returns {string} WebExpress placeholder markup.
     */
    _createPlaceholderCellContent(widthClass = "col-12") {
        return `<span class="placeholder ${widthClass}"></span>`;
    }

    /**
     * Creates a preview row with WebExpress placeholders.
     * @param {Array<string>} widths WebExpress width classes for each cell.
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
