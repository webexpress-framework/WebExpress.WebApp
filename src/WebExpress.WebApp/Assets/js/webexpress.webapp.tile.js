/**
 * A REST tile control extending the standard tile controller with REST API integration.
 * Fetches tile data from a REST endpoint.
 * Supports server-side sorting, filtering, and paging synchronization.
 * The following events are triggered:
 * - webexpress.webui.Event.DATA_ARRIVED_EVENT
 */
webexpress.webapp.TileCtrl = class extends webexpress.webui.TileCtrl {

    // configuration
    _restUri = "";
    _viewState = null;
    _sliceTotal = 0;

    // received data
    _items = {};

    // pager & info
    _pagerWrapper = null;
    _pagerElement = null;
    _pagerCtrl = null;
    _infoDiv = null;

    /**
     * Constructor for the TileCtrl class.
     * @param {HTMLElement} element The DOM element associated with the control.
     */
    constructor(element) {
        // consume the islands before the base constructor reshapes the
        // children; later reads are served from the element cache
        webexpress.webapp.Data.readState(element);
        webexpress.webapp.ServiceRegistry.fromElement(element);

        super(element);

        // the resource a ViewState renders. when present, the tiles are a pure view
        // of a central resource the enclosing ViewState owns; when absent the control
        // owns its state and loads itself (standalone).
        this._resource = (element.dataset && element.dataset.wxResource) || null;

        // canonical state for the tiles: a single source of truth that the
        // accessors below read from and write to. seeded from the optional
        // wx-state island. in ViewState mode this is replaced by the ViewState
        // once it resolves.
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

        // data service: the configured island authored in C# through .Service().
        // the load queries through it, the state save flows through its update.
        const islandServices = webexpress.webapp.ServiceRegistry.fromElement(element);
        this._service = islandServices.data;
        this._restUri = this._service ? this._service.baseUri : "";

        if (element.dataset.pageSize) {
            const pageSize = parseInt(element.dataset.pageSize, 10);
            this._pageSize = isNaN(pageSize) || pageSize <= 0 ? 50 : pageSize;
        }

        element.removeAttribute("data-page-size");

        this._initProgressBar(element);
        this._initPager(element);

        if (this._resource) {
            // ViewState mode: the enclosing ViewState loads the resource centrally; this
            // control only subscribes to its slice and renders it
            this._attachToViewState(element);
        } else if (this._restUri) {
            this._element.classList.add("placeholder-glow");
            this._receiveData();

            // an external change of the service's domains re-queries and
            // flashes, so changes made by other users re-render standalone too
            const dataChanges = webexpress.webapp.DataChangeSubscription.attachReload(
                [this._service], () => this._receiveData(), element);
            if (dataChanges) {
                (element._wxCleanup = element._wxCleanup || []).push(() => dataChanges.detach());
            }
        }
    }

    /**
     * Attaches the tiles to the enclosing ViewState and renders its
     * resource slice. The ViewState owns the state, the service and the central
     * load, so the control becomes a pure view that re-renders whenever the
     * ViewState re-queries the resource. The shared ViewState state also becomes the
     * control's store, so the search, paging and sort binds drive the same keys
     * every control in the ViewState reads.
     * @param {HTMLElement} element The host element.
     */
    _attachToViewState(element) {
        const viewStateId = (element.dataset && element.dataset.wxViewstate) || null;

        webexpress.webapp.ViewStateRegistry.whenReady(element, viewStateId, (viewState) => {
            this._viewState = viewState;
            this._store = viewState;

            const service = viewState.serviceForResource(this._resource);
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
     * Renders a resource slice the ViewState loaded centrally. The slice carries the
     * raw response, which the control maps into tiles exactly as the standalone
     * load does.
     * @param {object} slice The resource slice { items, total, data, loading, error }.
     */
    _applySlice(slice) {
        slice = slice || {};
        this._sliceTotal = Number(slice.total) || 0;

        if (slice.data) {
            const response = slice.data;
            const newItems = webexpress.webapp.tileModel.sliceItems(response.items, this._pageSize);
            this.updateData(Object.assign({}, response, { items: newItems }));
            this._items = newItems;
        }

        this._element.classList.remove("placeholder-glow");
        this._toggleProgress(false);
    }

    // state accessors backed by the store, so the single source of truth is
    // the store while the inherited pager and rendering logic keeps reading
    // fields

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

    // in ViewState mode the total comes from the resource slice, not from a top
    // level state key, so several resources in one ViewState keep separate totals
    get _totalRecords() { return this._viewState ? this._sliceTotal : this._store.getState().total; }
    set _totalRecords(value) { this._store.setState({ total: value }); }

    get _isLoading() { return this._store.getState().loading; }
    set _isLoading(value) { this._store.setState({ loading: value }); }

    /**
     * Initializes or binds a pagination control and an information area.
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
     * Updates pager state and info text.
     * Falls back to native rendering if external control is not available.
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
        if (Array.isArray(this._items)) {
            itemsOnPage = this._items.length;
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
           this._element.classList.add("placeholder-glow");
        } else {
            this._element.classList.remove("placeholder-glow");
        }
    }

    /**
     * Retrieves data from the REST endpoint through the data service. The
     * logical query parameters are mapped to their wire names by the service
     * descriptor, and a superseded query is cancelled by the service, so a
     * stale response arrives as an abort result and is ignored here.
     * @returns {Promise<void>} Resolves when the load completes.
     */
    async _receiveData() {
        if (!this._restUri) {
            return;
        }

        this._store.setState({ loading: true, error: null });
        this._toggleProgress(true);
        this._element.classList.add("placeholder-glow");

        const params = webexpress.webapp.tileModel.queryParams(this._store.getState());
        const result = await this._service.query(params);

        if (!result.ok) {
            // ignore aborts (a newer query replaced this one); report the rest
            if (result.error.kind !== "abort") {
                console.error("TileCtrl Request failed:", webexpress.webapp.ServiceResult.describe(result));
                this._store.setState({ loading: false, error: result.error });
                this._element.classList.remove("placeholder-glow");
                this._toggleProgress(false);
            }
            return;
        }

        const response = result.data;
        const newItems = webexpress.webapp.tileModel.sliceItems(response.items, this._pageSize);

        this._totalRecords = webexpress.webapp.tileModel.reduceTotal(response, newItems.length, this._page, this._pageSize);

        const responseForUpdate = Object.assign({}, response, { items: newItems });

        this.updateData(responseForUpdate);

        this._items = newItems;

        // notify listeners that data arrived
        this._dispatch(webexpress.webui.Event.DATA_ARRIVED_EVENT, {
            response: responseForUpdate,
            page: this._page
        });

        setTimeout(() => {
            this._syncPagerAndInfo();
        }, 0);

        this._element.classList.remove("placeholder-glow");
        this._store.setState({ loading: false, error: null });
        this._toggleProgress(false);
    }

    /**
     * Public API to update the tile view with new data.
     * Maps API response items to tile objects.
     * @param {Object} response The API response object containing 'items'.
     */
    updateData(response) {
        if (!response) {
            return;
        }

        this._tiles = webexpress.webapp.tileModel.mapTiles(response);

        if (response.meta) {
            if (response.meta.sort) {
                this._orderBy = response.meta.sort;
                this._orderDir = response.meta.dir;
            }
        }

        this._markSearchDirty();
        this.render();

        // ensure pager wrapper stays at the very bottom of the element
        if (this._pagerWrapper) {
            this._element.appendChild(this._pagerWrapper);
        }
    }

    /**
     * Overrides the base orderTiles method to perform server-side sorting.
     * @param {string} property Property name.
     * @param {"asc"|"desc"} direction Direction.
     */
    orderTiles(property = "label", direction = "asc") {
        this._orderBy = property;
        this._orderDir = direction;
        this._page = 0;

        if (this._viewState) {
            this._viewState.reload(this._resource);
        } else {
            this._receiveData();
        }
        this._dispatchSortEvent(property, direction);
    }

    /**
     * Overrides searchTiles to optionally perform server-side filtering.
     * @param {string} term Search term.
     * @returns {Array<Object>} Matches.
     */
    searchTiles(term) {
        this._search = term;
        return super.searchTiles(term);
    }

    /**
     * Sends state update to server.
     * @param {Object} stateObj Data to send.
     */
    _sendStateToServer(stateObj) {
        if (!this._restUri) {
            return;
        }

        this._service.update(stateObj).then((r) => {
            if (!r.ok) {
                console.error("TileCtrl update state failed", r.error);
            }
        });
    }

    /**
     * Updates the control.
     * Derived classes can override this method to implement specific behavior.
     */
    update() {
        if (this._viewState) {
            this._viewState.reload(this._resource);
            return;
        }
        if (this._restUri) {
            if (this._isVisible()) {
                this._receiveData();
            }
        }
    }

    /**
     * Dispatches an intent against the tile's store and service, mirroring
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
     * Loads the tiles when the control is backed by a service and visible.
     * Intent effects call this after their reducer updated the store.
     * @returns {Promise<void>|undefined} Resolves when the load completes.
     */
    load() {
        if (this._viewState) {
            return this._viewState.reload(this._resource);
        }
        if (this._restUri && this._isVisible()) {
            return this._receiveData();
        }
        return undefined;
    }

    /**
     * Sets the search filter and reloads the first page.
     * @param {string} pattern - Search pattern.
     * @param {string} [searchType="basic"] - Filter type.
     */
    search(pattern = "", searchType = "basic") {
        this.dispatch("tile/search", { pattern: pattern, searchType: searchType });
    }

    /**
     * Sets the filter and reloads the first page.
     * @param {string} pattern - Filter pattern.
     */
    filter(pattern = "") {
        this.dispatch("tile/filter", { pattern: pattern });
    }

    /**
     * Sets and loads the page.
     * @param {string} page - The current page pattern.
     */
    paging(page = 0) {
        this.dispatch("tile/page", { page: page });
    }
};

// register the class in the controller
webexpress.webui.Controller.registerClass("wx-webapp-tile", webexpress.webapp.TileCtrl);