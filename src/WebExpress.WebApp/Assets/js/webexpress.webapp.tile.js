/**
 * A REST tile control extending the standard tile controller with REST API integration.
 * Fetches tile data from a REST endpoint.
 * Supports server-side sorting, filtering, infinite scrolling, and paging synchronization.
 * The following events are triggered:
 * - webexpress.webui.Event.DATA_ARRIVED_EVENT
 * - webexpress.webui.Event.UPDATE_PAGINATION_EVENT
 */
webexpress.webapp.TileCtrl = class extends webexpress.webui.TileCtrl {

    // configuration
    _restUri = "";
    _isInfinite = false;

    // request state
    _orderBy = null;
    _orderDir = null;
    _filter = "";
    _wql = "";
    _page = 0;
    _pageSize = 50;
    _totalRecords = 0;
    _isLoading = false;
    _allDataLoaded = false;

    // scrolling
    _scrollElement = null;

    // async helpers
    _abortController = null;
    _sentinel = null;
    _observer = null;
    _scrollTimer = null;

    // pager & info
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
        this._isInfinite = element.dataset.infinite === "true";

        if (element.dataset.pageSize) {
            const parsedPageSize = parseInt(element.dataset.pageSize, 10);
            if (!isNaN(parsedPageSize) && parsedPageSize > 0) {
                this._pageSize = parsedPageSize;
            } else {
                this._pageSize = 50;
            }
        }

        this._scrollElement = this._resolveScrollElement();

        element.removeAttribute("data-uri");
        element.removeAttribute("data-infinite");
        element.removeAttribute("data-page-size");

        this._initRestPersistence(element);
        this._initPager(element);
        this._initPagingEvents();

        if (this._isInfinite) {
            this._createSentinel();
            this._initInfiniteObserver();
            this._bindScrollTracking();
        }

        if (this._restUri) {
            this._element.classList.add("placeholder-glow");
            this._receiveData(false);
        }
    }

    /**
     * Resolves the actual scroll container for the tile control.
     * @returns {HTMLElement} Scroll container element.
     */
    _resolveScrollElement() {
        const candidates = [
            this._element.querySelector(":scope > .wx-tile-body"),
            this._element.querySelector(":scope > .wx-tile-container"),
            this._element.querySelector(":scope > .wx-tile-content"),
            this._element
        ];

        for (const candidate of candidates) {
            if (candidate instanceof HTMLElement) {
                return candidate;
            }
        }

        return this._element;
    }

    /**
     * Initializes paging-related events for external paging controls.
     */
    _initPagingEvents() {
        document.addEventListener(webexpress.webui.Event.CHANGE_PAGE_EVENT, (e) => {
            if (e.detail && typeof e.detail.page === "number") {
                this._handleExternalPageChange(e.detail.page);
            }
        });
    }

    /**
     * Initializes the intersection observer for infinite loading.
     */
    _initInfiniteObserver() {
        const options = {
            root: this._scrollElement,
            rootMargin: "50px",
            threshold: 0.1
        };

        this._observer = new IntersectionObserver((entries) => {
            const entry = entries[0];
            if (entry.isIntersecting && !this._isLoading && !this._allDataLoaded) {
                if (this._hasScrollableContent()) {
                    this._page++;
                    this._receiveData(true);
                }
            }
        }, options);
    }

    /**
     * Binds throttled scroll tracking to update the current visible page.
     */
    _bindScrollTracking() {
        this._scrollElement.addEventListener("scroll", () => {
            this._onScroll();
        }, { passive: true });
    }

    /**
     * Creates the sentinel element used by the intersection observer.
     */
    _createSentinel() {
        this._sentinel = document.createElement("div");
        this._sentinel.className = "wx-tile-sentinel";
        this._sentinel.style.height = "1px";
        this._sentinel.style.width = "100%";
        this._sentinel.style.visibility = "hidden";
        this._sentinel.style.flexShrink = "0";
    }

    /**
     * Initializes or binds a pagination control and an information area.
     * @param {HTMLElement} host The host element to search or attach the pager to.
     */
    _initPager(host) {
        let pager = host.querySelector(".wx-webui-pagination");
        if (!pager) {
            pager = document.createElement("ul");
            pager.className = "wx-webui-pagination";
            pager.style.marginTop = "0.5rem";
            host.appendChild(pager);
        }

        this._pagerElement = pager;

        const initialTotalPages = Math.max(1, Math.ceil((this._totalRecords || 0) / this._pageSize));
        this._pagerElement.dataset.page = String(this._page);
        this._pagerElement.dataset.total = String(initialTotalPages);

        try {
            this._pagerCtrl = new webexpress.webui.PaginationCtrl(this._pagerElement);
        } catch (err) {
            console.error("Failed to initialize PaginationCtrl:", err);
            this._pagerCtrl = null;
        }

        this._infoDiv = document.createElement("div");
        this._infoDiv.className = "wx-tile-info text-muted small";
        this._infoDiv.style.marginTop = "0.25rem";
        this._infoDiv.textContent = "";

        if (this._pagerElement.parentNode) {
            this._pagerElement.parentNode.insertBefore(this._infoDiv, this._pagerElement.nextSibling);
        } else {
            host.appendChild(this._infoDiv);
        }

        this._syncPagerAndInfo(false, 0);
    }

    /**
     * Updates pager state and info text.
     * @param {boolean} append Whether data was appended.
     * @param {number} fetchedCount Number of fetched items.
     */
    _syncPagerAndInfo(append, fetchedCount) {
        const total = Number(this._totalRecords) || 0;
        let totalPages = 1;

        if (this._pageSize > 0) {
            totalPages = Math.max(1, Math.ceil(total / this._pageSize));
        }

        if (!this._isInfinite) {
            if (this._page < 0) {
                this._page = 0;
            }
            if (this._page >= totalPages) {
                this._page = totalPages - 1;
            }
        }

        const currentPage = this._isInfinite
            ? Math.min(totalPages - 1, Math.max(0, this._page))
            : this._page;

        let itemsOnPage = 0;
        if (this._isInfinite) {
            if (append) {
                itemsOnPage = typeof fetchedCount === "number" ? fetchedCount : 0;
            } else {
                itemsOnPage = Math.max(0, Math.min(this._tiles.length - (currentPage * this._pageSize), this._pageSize));
            }
        } else {
            itemsOnPage = Array.isArray(this._tiles) ? this._tiles.length : 0;
        }

        if (this._pagerElement) {
            this._pagerElement.dataset.page = String(currentPage);
            this._pagerElement.dataset.total = String(totalPages);
        }

        if (this._pagerCtrl && typeof this._pagerCtrl.updateState === "function") {
            this._pagerCtrl.updateState(currentPage, totalPages);
        } else if (this._pagerCtrl) {
            try {
                this._pagerCtrl.total = totalPages;
                this._pagerCtrl.page = currentPage;
            } catch (e) {
            }
        }

        if (this._infoDiv) {
            this._infoDiv.textContent = "Page " + (currentPage + 1) + " of " + totalPages + " / " + itemsOnPage + " of " + total + " items";
        }
    }

    /**
     * Handles throttled scroll updates.
     */
    _onScroll() {
        if (this._scrollTimer) {
            return;
        }

        this._scrollTimer = setTimeout(() => {
            this._scrollTimer = null;
            this._calculateCurrentPage();
        }, 150);
    }

    /**
     * Calculates the current page based on visible tile positions.
     */
    _calculateCurrentPage() {
        if (!this._tiles.length || this._pageSize <= 0) {
            return;
        }

        const tileNodes = this._getRenderedTileNodes();
        if (!tileNodes.length) {
            return;
        }

        const viewportTop = this._scrollElement.scrollTop;
        const viewportBottom = viewportTop + this._scrollElement.clientHeight;

        let bestIndex = 0;
        let bestVisibleHeight = -1;

        for (let i = 0; i < tileNodes.length; i++) {
            const tileEl = tileNodes[i];
            const tileTop = tileEl.offsetTop;
            const tileBottom = tileTop + tileEl.offsetHeight;
            const visibleTop = Math.max(viewportTop, tileTop);
            const visibleBottom = Math.min(viewportBottom, tileBottom);
            const visibleHeight = Math.max(0, visibleBottom - visibleTop);

            if (visibleHeight > bestVisibleHeight) {
                bestVisibleHeight = visibleHeight;
                bestIndex = i;
            }
        }

        const totalPages = Math.max(1, Math.ceil(this._totalRecords / this._pageSize));
        let calculatedPage = Math.floor(bestIndex / this._pageSize);

        if (viewportBottom >= this._scrollElement.scrollHeight - 2) {
            calculatedPage = totalPages - 1;
        }

        if (calculatedPage < 0) {
            calculatedPage = 0;
        }
        if (calculatedPage >= totalPages) {
            calculatedPage = totalPages - 1;
        }

        this._page = calculatedPage;

        this._element.dispatchEvent(new CustomEvent("wx-update-pagination", {
            bubbles: true,
            detail: {
                page: calculatedPage,
                total: totalPages
            }
        }));

        this._dispatch(webexpress.webui.Event.UPDATE_PAGINATION_EVENT, {
            detail: {
                page: calculatedPage,
                total: totalPages
            }
        });

        this._syncPagerAndInfo(true, 0);
    }

    /**
     * Handles page changes coming from external pagination controls.
     * @param {number} targetPage Zero-based page index.
     */
    _handleExternalPageChange(targetPage) {
        if (!this._isInfinite) {
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

            this._receiveData(false);
            return;
        }

        const targetTileIndex = targetPage * this._pageSize;
        if (targetTileIndex < this._tiles.length) {
            const tileNodes = this._getRenderedTileNodes();
            const targetTile = tileNodes[targetTileIndex];
            if (targetTile) {
                targetTile.scrollIntoView({ behavior: "smooth", block: "start" });
                this._element.dispatchEvent(new CustomEvent("wx-update-pagination", {
                    bubbles: true,
                    detail: {
                        page: targetPage,
                        total: Math.ceil(this._totalRecords / this._pageSize)
                    }
                }));
            }
        } else {
            this._page = targetPage;
            this._tiles = [];
            this.render();
            this._receiveData(false);
        }
    }

    /**
     * Returns whether the tile container currently has enough content to scroll.
     * @returns {boolean} True if the content exceeds the viewport height.
     */
    _hasScrollableContent() {
        return this._scrollElement.scrollHeight > this._scrollElement.clientHeight;
    }

    /**
     * Returns the currently rendered tile nodes.
     * @returns {Array<HTMLElement>} Rendered tile elements.
     */
    _getRenderedTileNodes() {
        return Array.from(this._scrollElement.children).filter((node) => {
            return node !== this._pagerElement && node !== this._infoDiv && node !== this._sentinel;
        });
    }

    /**
     * Fetches data from the configured REST endpoint.
     * @param {boolean} [append=false] If true, appends new data in infinite mode.
     */
    _receiveData(append = false) {
        if (!this._restUri) {
            return;
        }
        if (this._isLoading && append) {
            return;
        }

        if (this._abortController) {
            this._abortController.abort("search replaced");
        }
        this._abortController = new AbortController();
        this._isLoading = true;

        this._element.classList.add("placeholder-glow");

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
        urlObj.searchParams.set("wql", this._wql || "");
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

                let newItems = Array.isArray(response.items) ? response.items : [];
                if (!this._isInfinite && newItems.length > this._pageSize) {
                    newItems = newItems.slice(0, this._pageSize);
                }

                const receivedItems = newItems.length;

                if (totalFromResponse !== null) {
                    this._totalRecords = Number(totalFromResponse) || 0;
                } else if (append) {
                    this._totalRecords = Math.max(Number(this._totalRecords) || 0, this._tiles.length + receivedItems);
                } else {
                    this._totalRecords = (this._page * this._pageSize) + receivedItems;
                }

                if (receivedItems < this._pageSize || receivedItems === 0) {
                    this._allDataLoaded = true;
                } else {
                    this._allDataLoaded = false;
                }

                const responseForUpdate = Object.assign({}, response, { items: newItems });

                this.updateData(responseForUpdate, append);

                this._element.dispatchEvent(new CustomEvent(webexpress.webui.Event.DATA_ARRIVED_EVENT, {
                    detail: {
                        id: this._element.id,
                        response: responseForUpdate,
                        page: this._page,
                        isAppend: append
                    }
                }));

                this._dispatch(webexpress.webui.Event.UPDATE_PAGINATION_EVENT, {
                    detail: {
                        page: this._page,
                        total: Math.max(1, Math.ceil(this._totalRecords / this._pageSize))
                    }
                });

                setTimeout(() => {
                    this._syncPagerAndInfo(append, receivedItems);
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

                if (this._isInfinite && !this._allDataLoaded && this._sentinel && this._observer) {
                    this._scrollElement.appendChild(this._sentinel);
                    this._observer.observe(this._sentinel);
                }
            });
    }

    /**
     * Public API to update the tile view with new data.
     * Maps API response items to tile objects.
     * @param {Object} response The API response object containing 'items'.
     * @param {boolean} [append=false] Whether data should be appended.
     */
    updateData(response, append = false) {
        if (!response) {
            return;
        }

        const mappedTiles = (response.items || []).map((item) => {
            return {
                id: item.id || null,
                label: item.label || item.title || item.name || "",
                html: item.text || item.description || item.content || null,
                class: item.class || null,
                icon: item.icon || null,
                image: item.image || null,
                colorCss: item.colorCss || item.color || null,
                colorStyle: item.colorStyle || item.style || null,
                visible: typeof item.visible === "boolean" ? item.visible : true,
                primaryAction: item.primaryAction || null,
                secondaryAction: item.secondaryAction || null,
                bind: item.bind || null,
                options: Array.isArray(item.options) ? item.options : null,
                _lc_id: null,
                _lc_label: null
            };
        });

        if (append) {
            this._tiles = (this._tiles || []).concat(mappedTiles);
        } else {
            this._tiles = mappedTiles;
        }

        if (response.meta && response.meta.sort) {
            this._orderBy = response.meta.sort;
            this._orderDir = response.meta.dir;
        }

        this._markSearchDirty();
        this.render();

        if (this._isInfinite && this._sentinel && this._observer && !this._allDataLoaded) {
            setTimeout(() => {
                this._scrollElement.appendChild(this._sentinel);
                this._observer.observe(this._sentinel);
            }, 200);
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
        this._allDataLoaded = false;

        this._receiveData(false);
        this._dispatchSortEvent(property, direction);
    }

    /**
     * Overrides searchTiles to optionally perform server-side filtering.
     * @param {string} term Search term.
     * @returns {Array<Object>} Matches.
     */
    searchTiles(term) {
        this._filter = term;
        return super.searchTiles(term);
    }

    /**
     * Initializes listeners for state changes (reorder and visibility) to sync with server.
     * @param {HTMLElement} element Host element.
     */
    _initRestPersistence(element) {
        element.addEventListener(webexpress.webui.Event.MOVE_EVENT, (e) => {
            if (e.detail.id === this._element.id) {
                this._notifyStateChange("reorder");
            }
        });

        element.addEventListener(webexpress.webui.Event.CHANGE_VISIBILITY_EVENT, (e) => {
            if (e.detail.id === this._element.id) {
                this._notifyStateChange("visibility");
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
        } else if (type === "visibility") {
            payload.visible = visibleTiles;
            payload.order = tileOrder;
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
        if (this._restUri && this._isVisible()) {
            this._receiveData(false);
        }
    }

    /**
     * Sets the search filter and reloads the first page.
     * @param {string} pattern Search pattern.
     * @param {string} [searchType="basic"] Filter type.
     */
    search(pattern = "", searchType = "basic") {
        this._filter = searchType === "basic" ? pattern : null;
        this._wql = searchType === "wql" ? pattern : null;
        this._page = 0;
        this._allDataLoaded = false;

        if (this._restUri && this._isVisible()) {
            this._receiveData(false);
        }
    }
};

// register the class in the controller
webexpress.webui.Controller.registerClass("wx-webapp-tile", webexpress.webapp.TileCtrl);