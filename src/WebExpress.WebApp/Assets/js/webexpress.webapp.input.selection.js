/**
 * A selection control with a REST backend that extends the base input selection control.
 * the control fetches its options from a configurable api endpoint and dispatches telemetry events.
 * events triggered:
 * - webexpress.webui.Event.CHANGE_FILTER_EVENT
 * - webexpress.webui.Event.CHANGE_VALUE_EVENT
 * - webexpress.webui.Event.DROPDOWN_SHOW_EVENT
 * - webexpress.webui.Event.DROPDOWN_HIDDEN_EVENT
 * - webexpress.webui.Event.DATA_REQUESTED_EVENT
 * - webexpress.webui.Event.DATA_ARRIVED_EVENT
 */
webexpress.webapp.InputSelectionCtrl = class extends webexpress.webui.InputSelectionCtrl {
    _apiEndpoint = "";
    _httpMethod = "GET";
    _queryParam = "g";
    _pageParam = "p";
    _page = 0;
    _debounceMs = 250;
    _allItems = [];
    _spinner = null;
    _abortCtrl = null;
    _debounceTimer = null;
    _maxItems = 25;

    /**
     * Initializes a new instance of the REST-backed selection control.
     * @param {HTMLElement} element - the dom element for the selection control.
     */
    constructor(element) {
        super(element);

        // read configuration from dataset
        if (element && element.dataset) {
            if (typeof element.dataset.uri === "string") {
                this._apiEndpoint = element.dataset.uri;
            }
            if (typeof element.dataset.method === "string") {
                const m = element.dataset.method.trim().toUpperCase();
                this._httpMethod = (m === "POST" || m === "GET") ? m : "GET";
            }
            if (typeof element.dataset.queryParam === "string") {
                this._queryParam = element.dataset.queryParam;
            }
            if (typeof element.dataset.pageParam === "string") {
                this._pageParam = element.dataset.pageParam;
            }
            if (typeof element.dataset.page === "string") {
                const p = parseInt(element.dataset.page, 10);
                if (!Number.isNaN(p) && p > 0) {
                    this._page = p;
                }
            }
            if (typeof element.dataset.debounce === "string") {
                const d = parseInt(element.dataset.debounce, 10);
                if (!Number.isNaN(d) && d >= 0) {
                    this._debounceMs = d;
                }
            }
            if (typeof element.dataset.maxitems === "string") {
                const mi = parseInt(element.dataset.maxitems, 10);
                if (!Number.isNaN(mi) && mi > 0) {
                    this._maxItems = mi;
                }
            }

            // cleanup configuration attributes from the dom after reading
            this._cleanupDataAttributes(element);
        }

        // create spinner element once
        this._spinner = document.createElement("div");
        this._spinner.className = "spinner-border spinner-border-sm text-secondary ms-2";
        this._spinner.setAttribute("role", "status");

        // fetch when dropdown menu is shown (base control dispatches a 'show' dom event on the menu)
        this._dropdownmenu.addEventListener("show", () => {
            const term = (this._filter && "value" in this._filter) ? this._filter.value : "";
            this.receiveData(term);
        });

        // optionally fetch when filter changes (uses base control custom event), debounced
        this._element.addEventListener(webexpress.webui.Event.CHANGE_FILTER_EVENT, (e) => {
            const term = (e && e.detail && typeof e.detail.filter === "string") ? e.detail.filter : "";
            if (this._dropdownmenu && this._dropdownmenu.style && this._dropdownmenu.style.display === "flex") {
                this._debouncedReceive(term);
            }
        });

        const term = (this._filter && "value" in this._filter) ? this._filter.value : "";
        this.receiveData(term);
    }

    /**
     * Removes the used data-* attributes from the element after reading configuration.
     * @param {HTMLElement} element - the dom element containing the attributes.
     * @returns {void}
     */
    _cleanupDataAttributes(element) {
        // remove only known configuration attributes to avoid unintended side effects
        const attrs = [
            "data-uri",
            "data-method",
            "data-query-param",
            "data-page-param",
            "data-page",
            "data-debounce",
            "data-max-items"
        ];
        for (const name of attrs) {
            if (element.hasAttribute(name)) {
                element.removeAttribute(name);
            }
        }
    }

    /**
     * Debounces receiveData calls to reduce the number of HTTP requests.
     * @param {string} term - the search term to request.
     * @returns {void}
     */
    _debouncedReceive(term) {
        if (this._debounceTimer !== null) {
            window.clearTimeout(this._debounceTimer);
            this._debounceTimer = null;
        }
        this._debounceTimer = window.setTimeout(() => {
            this.receiveData(term);
        }, this._debounceMs);
    }

    /**
     * Retrieves data from the REST API.
     * dispatches DATA_REQUESTED_EVENT before the request and DATA_ARRIVED_EVENT after completion.
     * @param {string} filter - the filter term to request.
     * @returns {void}
     */
    receiveData(filter) {
        // normalize filter
        const term = (filter === undefined || filter === null) ? "" : String(filter);

        // append spinner to selection (if not already attached)
        if (this._selection) {
            const alreadyAttached = this._spinner && this._spinner.parentNode === this._selection;
            if (!alreadyAttached && this._spinner) {
                this._selection.appendChild(this._spinner);
            }
        }

        // abort previous in-flight request, if any
        if (this._abortCtrl && typeof this._abortCtrl.abort === "function") {
            this._abortCtrl.abort();
        }
        this._abortCtrl = new AbortController();

        // mark request start
        const startedAt = performance.now();

        // dispatch "data requested" event
        this._dispatch(webexpress.webui.Event.DATA_REQUESTED_EVENT, {
            endpoint: this._apiEndpoint,
            method: this._httpMethod,
            queryParam: this._queryParam,
            term: term || "",
            count: 0,
            durationMs: 0,
            error: null
        });

        // build url and init for fetch
        const url = this._buildUrl(term);
        const init = this._buildRequestInit(term, this._abortCtrl.signal);

        // perform request using fetch api
        webexpress.webapp.ServiceRegistry.request(url, init)
            .then((res) => {
                // ignore superseded requests that a newer keystroke aborted
                if (res.error && res.error.kind === "abort") {
                    const abort = new Error("aborted");
                    abort.name = "AbortError";
                    throw abort;
                }
                // check http status
                if (!res.ok) {
                    throw new Error(`http ${res.status}`);
                }
                return res.data;
            })
            .then((response) => {
                const rawData = response.items;
                this._allItems = rawData;
                const limitedItems = this._allItems.slice(0, this._maxItems);
                this.options = limitedItems.map((x) => {
                    return this._mapApiItem(x);
                });

                // dispatch "data arrived" event (success)
                const finishedAt = performance.now();
                this._dispatch(webexpress.webui.Event.DATA_ARRIVED_EVENT, {
                    endpoint: this._apiEndpoint,
                    method: this._httpMethod,
                    queryParam: this._queryParam,
                    term: term || "",
                    count: limitedItems.length,
                    durationMs: finishedAt - startedAt,
                    error: null
                });
            })
            .catch((err) => {
                // handle aborts silently for ux
                const isAbort = (err && typeof err === "object" && err.name === "AbortError");
                if (!isAbort) {
                    // normalize error message
                    const message = (err instanceof Error) ? err.message : String(err);

                    // clear items on failure
                    this._allItems = [];
                    this.options = this._allItems;

                    // dispatch "data arrived" event (failure)
                    const finishedAt = performance.now();
                    this._dispatch(webexpress.webui.Event.DATA_ARRIVED_EVENT, {
                        endpoint: this._apiEndpoint,
                        method: this._httpMethod,
                        queryParam: this._queryParam,
                        term: term || "",
                        count: 0,
                        durationMs: finishedAt - startedAt,
                        error: message
                    });

                    // log error for diagnostics
                    console.error("the request could not be completed successfully:", err);
                }
            })
            .finally(() => {
                // ensure spinner is removed
                if (this._spinner && this._spinner.parentNode) {
                    this._spinner.parentNode.removeChild(this._spinner);
                }
            });
    }

    /**
     * Maps a raw API item to the internal selection item format.
     * @param {any} apiItem - The raw item from the API.
     * @returns {Object} A normalized item compatible with InputSelectionCtrl.options.
     */
    _mapApiItem(apiItem) {
        return webexpress.webapp.inputSelectionModel.mapApiItem(apiItem);
    }

    /**
     * Builds the request URL for GET requests including query and page parameters.
     * @param {string} term - the search term.
     * @returns {string} the composed request url.
     */
    _buildUrl(term) {
        return webexpress.webapp.inputSelectionModel.buildUrl({
            apiEndpoint: this._apiEndpoint,
            httpMethod: this._httpMethod,
            queryParam: this._queryParam,
            pageParam: this._pageParam,
            page: this._page
        }, term);
    }

    /**
     * Builds the fetch init object depending on HTTP method.
     * @param {string} term - the search term.
     * @param {AbortSignal} signal - the abort signal to cancel the request.
     * @returns {RequestInit} the fetch init object.
     */
    _buildRequestInit(term, signal) {
        return webexpress.webapp.inputSelectionModel.buildRequestInit({
            httpMethod: this._httpMethod,
            queryParam: this._queryParam,
            pageParam: this._pageParam,
            page: this._page
        }, term, signal);
    }
};

// register the class in the controller
webexpress.webui.Controller.registerClass("wx-webapp-input-selection", webexpress.webapp.InputSelectionCtrl);