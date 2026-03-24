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
    _items = {};

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
            this._pageSize = parseInt(element.dataset.pageSize, 10);
            if (isNaN(this._pageSize) || this._pageSize <= 0) {
                this._pageSize = 50;
            }
        }

        element.removeAttribute("data-uri");
        element.removeAttribute("data-page-size");

        this._initProgressBar(element);
        this._initPager(element);

        if (this._restUri) {
            this._element.classList.add("placeholder-glow");
            this._receiveData();
        }
    }

    /**
     * Initializes or binds a pagination control and an information area.
     * @param {HTMLElement} host - The host element to search or attach the pager to.
     */
    _initPager(host) {
        // find existing pager element
        const paginationId = host.dataset.wxSourcePaging || null;
        
        document.addEventListener("DOMContentLoaded", () => {
            this._pagerElement = document.querySelector(paginationId);
            
            if (this._pagerElement) {
                this._pagerCtrl = webexpress.webui.Controller.getInstanceByElement(this._pagerElement);
            }
            
            // initialize info/pager display
            this._syncPagerAndInfo();
        });
        
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
        
        this._toggleProgress(true);

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
                const totalFromResponse = response.total ?? null;

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
                this._isLoading = false;
                this._abortController = null;
                this._toggleProgress(false);
            })
            .catch((error) => {
                if (error.name === "AbortError") {
                    return;
                }

                console.error("TileCtrl Request failed:", error);
                this._element.classList.remove("placeholder-glow");
                this._isLoading = false;
                this._abortController = null;
                this._toggleProgress(false);
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
     * @param {string} pattern - Search pattern.
     * @param {string} [searchType="basic"] - Filter type.
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
     * @param {string} pattern - Filter pattern.
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
    
    /**
     * Sets and loads the page.
     * @param {string} page - The current page pattern.
     */
    paging(page = 0) {
        this._page = page;

        if (this._restUri) {
            if (this._isVisible()) {
                this._receiveData();
            }
        }
    }
};

// register the class in the controller
webexpress.webui.Controller.registerClass("wx-webapp-tile", webexpress.webapp.TileCtrl);