/**
 * A REST tile control extending the standard tile controller with REST API integration.
 * Fetches tile data from a REST endpoint.
 * Supports server-side sorting, filtering, and paging synchronization.
 * The following events are triggered:
 * - webexpress.webui.Event.DATA_ARRIVED_EVENT
 * - webexpress.webui.Event.UPDATE_PAGINATION_EVENT
 */
webexpress.webapp.TileCtrl = class extends webexpress.webui.TileCtrl {

    // configuration
    _restUri = "";

    // request state
    _orderBy = null;
    _orderDir = null;
    _filter = "";
    _search = "";
    _wql = "";
    _page = 0;
    _pageSize = 50;
    _totalRecords = 0;
    _isLoading = false;

    // async helpers
    _abortController = null;

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
        super(element);

        this._restUri = element.dataset.uri || "";

        if (element.dataset.pageSize) {
            const parsedPageSize = parseInt(element.dataset.pageSize, 10);
            if (!isNaN(parsedPageSize)) {
                if (parsedPageSize > 0) {
                    this._pageSize = parsedPageSize;
                } else {
                    this._pageSize = 50;
                }
            } else {
                this._pageSize = 50;
            }
        }

        element.removeAttribute("data-uri");
        element.removeAttribute("data-infinite");
        element.removeAttribute("data-page-size");

        this._initRestPersistence(element);
        this._initPager(element);
        this._initPagingEvents();

        if (this._restUri) {
            this._element.classList.add("placeholder-glow");
            this._receiveData();
        }
    }

    /**
     * Initializes paging-related events for external paging controls.
     */
    _initPagingEvents() {
        const pageEventName = (webexpress.webui.Event && webexpress.webui.Event.CHANGE_PAGE_EVENT) ? webexpress.webui.Event.CHANGE_PAGE_EVENT : "webexpress.webui.table.page.changed";

        document.addEventListener(pageEventName, (e) => {
            let isTarget = false;
            
            // check if event originates from our element
            if (this._element.contains(e.target)) {
                isTarget = true;
            }
            
            // check if event details match our element id
            if (e.detail) {
                if (e.detail.id === this._element.id) {
                    isTarget = true;
                }
            }

            if (isTarget) {
                if (e.detail) {
                    if (typeof e.detail.page === "number") {
                        this._handleExternalPageChange(e.detail.page);
                    }
                }
            }
        });
    }

    /**
     * Initializes or binds a pagination control and an information area.
     * @param {HTMLElement} host The host element to search or attach the pager to.
     */
    _initPager(host) {
        let container = host.querySelector(".wx-tile-pagination-wrapper");
        if (!container) {
            // create layout wrapper for pager and info
            container = document.createElement("div");
            container.className = "wx-tile-pagination-wrapper d-flex flex-column align-items-center mt-4 mb-2";
            
            this._pagerElement = document.createElement("ul");
            this._pagerElement.className = "wx-webui-pagination pagination mb-1";
            
            this._infoDiv = document.createElement("div");
            this._infoDiv.className = "text-muted small";
            
            container.appendChild(this._pagerElement);
            container.appendChild(this._infoDiv);
            host.appendChild(container);
        } 

        this._pagerWrapper = container;

        const initialTotalPages = Math.max(1, Math.ceil((this._totalRecords || 0) / this._pageSize));
        
        if (this._pagerElement) {
            this._pagerElement.dataset.page = String(this._page);
            this._pagerElement.dataset.total = String(initialTotalPages);
        }

        try {
            if (webexpress.webui.PaginationCtrl) {
                this._pagerCtrl = new webexpress.webui.PaginationCtrl(this._pagerElement);
            } else {
                this._pagerCtrl = null;
            }
        } catch (err) {
            console.error("Failed to initialize PaginationCtrl:", err);
            this._pagerCtrl = null;
        }

        this._syncPagerAndInfo();
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

        if (this._page < 0) {
            this._page = 0;
        }
        
        if (this._page >= totalPages) {
            this._page = totalPages - 1;
        }

        const currentPage = this._page;

        let itemsOnPage = 0;
        if (Array.isArray(this._tiles)) {
            itemsOnPage = this._tiles.length;
        }

        if (this._pagerElement) {
            this._pagerElement.dataset.page = String(currentPage);
            this._pagerElement.dataset.total = String(totalPages);
        }

        if (this._pagerCtrl) {
            if (typeof this._pagerCtrl.updateState === "function") {
                this._pagerCtrl.updateState(currentPage, totalPages);
            } else {
                try {
                    this._pagerCtrl.total = totalPages;
                    this._pagerCtrl.page = currentPage;
                } catch (e) {
                    // ignore errors when setting fallback properties
                }
            }
        }

        if (this._infoDiv) {
            this._infoDiv.textContent = "Page " + (currentPage + 1) + " of " + totalPages + " / " + itemsOnPage + " of " + total + " items";
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
            this._infoDiv.textContent = "Page " + (this._page + 1) + " of " + totalPages + " — loading…";
        }

        this._receiveData();
    }

    /**
     * Fetches data from the configured REST endpoint.
     */
    _receiveData() {
        if (!this._restUri) {
            return;
        }

        if (this._abortController) {
            this._abortController.abort("search replaced");
        }
        
        this._abortController = new AbortController();
        this._isLoading = true;

        this._element.classList.add("placeholder-glow");

        const base = window.location.origin;
        let urlObj;
        try {
            urlObj = new URL(this._restUri, base);
        } catch (e) {
            urlObj = new URL(this._restUri, document.baseURI);
        }

        if (this._filter) {
            urlObj.searchParams.set("f", this._filter);
        } else {
            urlObj.searchParams.set("f", "");
        }

        if (this._search) {
            urlObj.searchParams.set("q", this._search);
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
                    throw new Error("Request failed");
                }
                return res.json();
            })
            .then((response) => {
                const totalFromResponse = response.total
                    ?? response.count
                    ?? response.totalCount
                    ?? response.total_records
                    ?? response.pagination?.totalCount
                    ?? response.pagination?.TotalCount
                    ?? null;

                let newItems = [];
                if (Array.isArray(response.items)) {
                    newItems = response.items;
                }
                
                if (newItems.length > this._pageSize) {
                    newItems = newItems.slice(0, this._pageSize);
                }

                const receivedItems = newItems.length;

                if (totalFromResponse !== null) {
                    this._totalRecords = Number(totalFromResponse) || 0;
                } else {
                    this._totalRecords = (this._page * this._pageSize) + receivedItems;
                }

                const responseForUpdate = Object.assign({}, response, { items: newItems });

                this.updateData(responseForUpdate);

                this._element.dispatchEvent(new CustomEvent(webexpress.webui.Event.DATA_ARRIVED_EVENT || "webexpress.webui.tile.data.arrived", {
                    detail: {
                        id: this._element.id,
                        response: responseForUpdate,
                        page: this._page
                    }
                }));

                this._dispatch(webexpress.webui.Event.UPDATE_PAGINATION_EVENT || "webexpress.webui.tile.pagination.updated", {
                    detail: {
                        page: this._page,
                        total: Math.max(1, Math.ceil(this._totalRecords / this._pageSize))
                    }
                });

                setTimeout(() => {
                    this._syncPagerAndInfo();
                }, 0);

                this._element.classList.remove("placeholder-glow");
                this._isLoading = false;
                this._abortController = null;
            })
            .catch((error) => {
                if (error.name === "AbortError") {
                    return;
                }

                console.error("TileCtrl Request failed:", error);
                this._element.classList.remove("placeholder-glow");
                this._isLoading = false;
                this._abortController = null;
            });
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

        let items = [];
        if (response.items) {
            items = response.items;
        }

        const mappedTiles = items.map((item) => {
            let isVisible = true;
            if (typeof item.visible === "boolean") {
                isVisible = item.visible;
            }
            
            let opts = null;
            if (Array.isArray(item.options)) {
                opts = item.options;
            }

            return {
                id: item.id || null,
                label: item.label || item.title || item.name || "",
                html: item.text || item.description || item.content || null,
                class: item.class || null,
                icon: item.icon || null,
                image: item.image || null,
                colorCss: item.colorCss || item.color || null,
                colorStyle: item.colorStyle || item.style || null,
                visible: isVisible,
                primaryAction: item.primaryAction || null,
                secondaryAction: item.secondaryAction || null,
                bind: item.bind || null,
                options: opts,
                _lc_id: null,
                _lc_label: null
            };
        });

        this._tiles = mappedTiles;

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

        this._receiveData();
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
     * Initializes listeners for state changes (reorder and visibility) to sync with server.
     * @param {HTMLElement} element Host element.
     */
    _initRestPersistence(element) {
        element.addEventListener(webexpress.webui.Event.MOVE_EVENT || "webexpress.webui.tile.moved", (e) => {
            if (e.detail) {
                if (e.detail.id === this._element.id) {
                    this._notifyStateChange("reorder");
                }
            }
        });

        element.addEventListener(webexpress.webui.Event.CHANGE_VISIBILITY_EVENT || "webexpress.webui.tile.visibility.changed", (e) => {
            if (e.detail) {
                if (e.detail.id === this._element.id) {
                    this._notifyStateChange("visibility");
                }
            }
        });
    }

    /**
     * Collects current state and sends it to the server.
     * @param {string} type The type of change.
     */
    _notifyStateChange(type) {
        if (!this._restUri) {
            return;
        }

        const tileOrder = this._tiles.map((t) => t.id).join(",");
        const visibleTiles = this._tiles
            .filter((t) => t.visible)
            .map((t) => t.id)
            .join(",");

        const payload = {};
        if (type === "reorder") {
            payload.order = tileOrder;
        } else {
            if (type === "visibility") {
                payload.visible = visibleTiles;
                payload.order = tileOrder;
            }
        }

        this._element.dispatchEvent(new CustomEvent("wx-req-update-state", {
            bubbles: true,
            detail: {
                type: `tile-${type}`,
                order: tileOrder,
                visible: visibleTiles
            }
        }));

        this._sendStateToServer(payload);
    }

    /**
     * Sends state update to server.
     * @param {Object} stateObj Data to send.
     */
    _sendStateToServer(stateObj) {
        if (!this._restUri) {
            return;
        }

        fetch(this._restUri, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(stateObj)
        }).catch((err) => {
            console.error("TileCtrl update state failed", err);
        });
    }

    /**
     * Updates the control.
     * Derived classes can override this method to implement specific behavior.
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
     * @param {string} pattern Search pattern.
     * @param {string} [searchType="basic"] Filter type.
     */
    search(pattern = "", searchType = "basic") {
        if (searchType === "basic") {
            this._search = pattern;
            this._wql = null;
        } else {
            if (searchType === "wql") {
                this._search = null;
                this._wql = pattern;
            } else {
                this._search = null;
                this._wql = null;
            }
        }
        
        this._page = 0;

        if (this._restUri) {
            if (this._isVisible()) {
                this._receiveData();
            }
        }
    }

    /**
     * Sets the filter and reloads the first page.
     * @param {string} pattern Filter pattern.
     */
    filter(pattern = "") {
        this._filter = pattern;
        this._page = 0;

        if (this._restUri) {
            if (this._isVisible()) {
                this._receiveData();
            }
        }
    }
};

// register the class in the controller
webexpress.webui.Controller.registerClass("wx-webapp-tile", webexpress.webapp.TileCtrl);