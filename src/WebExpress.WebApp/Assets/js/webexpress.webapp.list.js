/**
 * A REST-backed list control extending the base flat ListCtrl.
 * - simple list view without toolbar or pagination controls
 * - shows bootstrap placeholders while loading
 * - queries a REST endpoint
 * - dispatches a data-arrived event on successful retrieval
 * - supports per-item edit and delete actions bound from server-provided options
 * Emits events:
 * - webexpress.webui.Event.DATA_ARRIVED_EVENT
 */
webexpress.webapp.ListCtrl = class extends webexpress.webui.ListCtrl {
    _restUri = "";
    _progressDiv = this._createProgressDiv();

    /**
     * Constructor for the REST ListCtrl.
     * @param {HTMLElement} element The host element.
     */
    constructor(element) {
        // consume the islands before the base constructor reshapes the
        // children; later reads are served from the element cache
        webexpress.webapp.Data.readState(element);
        webexpress.webapp.ServiceRegistry.fromElement(element);

        super(element);

        // canonical state for the list: a single source of truth that the
        // accessors below read from and write to. seeded from the optional
        // wx-state island.
        this._store = new webexpress.webapp.Store(Object.assign({
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
        }, webexpress.webapp.Data.readState(element)));

        // data service: the configured island authored in C# through .Service().
        const islandServices = webexpress.webapp.ServiceRegistry.fromElement(element);
        this._service = islandServices.data;
        this._restUri = this._service ? this._service.baseUri : "";

        element.className = "wx-list";

        // insert progress at top
        element.prepend(this._progressDiv);

        // show placeholders while loading
        const listUl = element.querySelector("ul.wx-list");
        if (listUl) {
            listUl.classList.add("placeholder-glow");
        }

        // set preview items using base class method
        this.setItems({
            id: null,
            class: null,
            style: null,
            color: null,
            editable: false,
            content: "...",
            options: null
        });

        this._initPager(element);

        // initial data load
        this._load();
    }

    // state accessors backed by the store, so the single source of truth is the
    // store while the inherited pager and selection logic keeps reading fields

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

    get _totalRecords() { return this._store.getState().total; }
    set _totalRecords(value) { this._store.setState({ total: value }); }

    /**
     * Retrieves data from the REST endpoint through the data service and updates
     * the list. A superseded query is cancelled by the service, so a stale
     * response arrives as an abort result and is ignored here.
     * @returns {Promise<void>} Resolves when the load completes.
     */
    async _load() {
        this._progressDiv.style.display = "none";

        if (!this._service) {
            return;
        }

        this._store.setState({ loading: true, error: null });

        const params = webexpress.webapp.listModel.queryParams(this._store.getState());
        const result = await this._service.query(params);

        if (!result.ok) {
            // ignore aborts (a newer query replaced this one); report the rest
            if (result.error.kind !== "abort") {
                console.error("the request could not be completed successfully:", result.error.message);
                this._store.setState({ loading: false, error: result.error });
            }
            this._progressDiv.style.visibility = "hidden";
            return;
        }

        const response = result.data;

        // reduce paging information into the store (single source of truth)
        this._store.setState(webexpress.webapp.listModel.reduceResponse(this._store.getState(), response));

        // emit data arrived event (kept identical for existing listeners)
        const evt = new CustomEvent(webexpress.webui.Event.DATA_ARRIVED_EVENT, {
            detail: { response: response }
        });
        this._element.dispatchEvent(evt);

        // remove placeholder state
        const listUl = this._element.querySelector("ul.wx-list");
        if (listUl) {
            listUl.classList.remove("placeholder-glow");
        }

        // map response into list items and update the view
        const newItems = webexpress.webapp.listModel.mapItems(response);
        this.setItems(newItems);

        if (this._selectable) {
            let selected = this._items.find((i) => i.id === this._selectedItem?.id) || null;
            if (!selected && this._items.length > 0) {
                selected = this._items[0];
                this._handleSelectionChange(selected, null, true);
                this._triggerPrimaryAction(selected);
            }
        }

        // update paging display
        this._syncPagerAndInfo();

        // notify listeners that data arrived
        this._dispatch(webexpress.webui.Event.DATA_ARRIVED_EVENT, {
            response: response,
            page: this._page
        });

        // hide progress
        this._progressDiv.style.visibility = "hidden";
    }

    /**
     * Maps a server response to internal list item structures.
     * @param {Object} response The server payload.
     * @returns {Array<Object>} Normalized items for ListCtrl.
     */
    _mapResponseToItems(response) {
        return webexpress.webapp.listModel.mapItems(response);
    }

    /**
     * Updates the control.
     * By default, this method calls the render() method.
     * Derived classes can override this method to implement specific behavior.
     */
    update() {
        if (this._restUri && this._isVisible()) {
            this._load();
        }
    }

    /**
     * Dispatches an intent against the list's store and service, mirroring the
     * dispatch surface of the Data base, so that the search, paging and filter
     * binds and the dispatch action all feed the same unidirectional loop.
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
            element: this._element
        });
    }

    /**
     * Loads the list when it is backed by a service and visible. Intent
     * effects call this after their reducer updated the store.
     * @returns {Promise<void>|undefined} Resolves when the load completes.
     */
    load() {
        if (this._restUri && this._isVisible()) {
            return this._load();
        }
        return undefined;
    }

    /**
     * Sets the search filter and reloads the first page (without modifying order or paging settings).
     * @param {string} pattern The search pattern (optional, defaults to empty string).
     * @param {string} searchType The filter type ("basic" or "wql").
     */
    search(pattern = "", searchType = "basic") {
        this.dispatch("list/search", { pattern: pattern, searchType: searchType });
    }

    /**
     * Sets the filter and reloads the first page.
     * @param {string} pattern The filter pattern.
     */
    filter(pattern = "") {
        this.dispatch("list/filter", { pattern: pattern });
    }

    /**
     * Sets and loads the page.
     * @param {number} page The current page index.
     */
    paging(page = 0) {
        this.dispatch("list/page", { page: page });
    }

    /**
     * Creates an element and assigns bootstrap classes.
     * @param {string} tag The html tag name.
     * @param {Array<string>} classList The classes to add.
     * @returns {HTMLElement} The created element.
     */
    _createElement(tag, classList = []) {
        const el = document.createElement(tag);
        if (classList.length > 0) {
            el.classList.add(...classList);
        }
        return el;
    }

    /**
     * Creates a compact progress bar.
     * @returns {HTMLDivElement} The progress container.
     */
    _createProgressDiv() {
        const div = this._createElement("div", ["progress", "mb-2"]);
        div.setAttribute("role", "status");
        div.style.height = "0.25rem";

        const bar = this._createElement("div", [
            "progress-bar",
            "progress-bar-striped",
            "progress-bar-animated"
        ]);
        bar.style.width = "100%";

        div.appendChild(bar);
        return div;
    }

    /**
     * Initializes or binds a pagination control and an information area.
     * @param {HTMLElement} host The host element to search or attach the pager to.
     */
    _initPager(host) {
        // find existing pager element based on dataset
        const paginationId = host.dataset.wxSourcePaging || null;

        const init = () => {
            if (paginationId) {
                this._pagerElement = document.querySelector(paginationId);
                if (this._pagerElement) {
                    this._pagerCtrl = webexpress.webui.Controller.getInstanceByElement(this._pagerElement);
                }
            }
            this._syncPagerAndInfo();
        };

        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", () => {
                init();
            });
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

        // update textual info using template literals
        if (this._infoDiv) {
            this._infoDiv.textContent = `Page ${currentPage + 1} of ${totalPages} / ${itemsOnPage} of ${total} items`;
        }
    }

    /**
     * Handles page changes coming from external or internal pagination controls.
     * @param {number} targetPage Zero-based page index.
     */
    _handleExternalPageChange(targetPage) {
        const totalPages = Math.max(1, Math.ceil(this._totalRecords / this._pageSize));
        let page = Number(targetPage) || 0;

        if (page < 0) {
            page = 0;
        }

        if (page >= totalPages) {
            page = totalPages - 1;
        }

        this._page = page;

        if (this._infoDiv) {
            this._infoDiv.textContent = `Page ${this._page + 1} of ${totalPages} - loading…`;
        }

        this._load();
    }
};

// register the class in the controller
webexpress.webui.Controller.registerClass("wx-webapp-list", webexpress.webapp.ListCtrl);
