/**
 * A read-only selection control that fetches its items from a configurable REST API endpoint.
 * Extends the base selection control and triggers standard webexpress events.
 */
webexpress.webapp.SelectionCtrl = class extends webexpress.webui.SelectionCtrl {
    _apiEndpoint = "";
    _httpMethod = "GET";
    _queryParam = "g";
    _pageParam = "p";
    _page = 0;
    _abortCtrl = null;
    _maxItems = 25;

    /**
     * Initializes a new instance of the REST-backed read-only selection control.
     * @param {HTMLElement} element - The DOM element for the selection control.
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
                if (m === "POST" || m === "GET") {
                    this._httpMethod = m;
                } else {
                    this._httpMethod = "GET";
                }
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
            if (typeof element.dataset.maxitems === "string") {
                const mi = parseInt(element.dataset.maxitems, 10);
                if (!Number.isNaN(mi) && mi > 0) {
                    this._maxItems = mi;
                }
            }

            // cleanup configuration attributes from the dom after reading
            this._cleanupDataAttributes(element);
        }

        // fetch initial data
        this.receiveData("");
    }

    /**
     * Removes the used data-* attributes from the element after reading configuration.
     * @param {HTMLElement} element - The DOM element containing the attributes.
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
            "data-max-items"
        ];
        for (let i = 0; i < attrs.length; i++) {
            if (element.hasAttribute(attrs[i])) {
                element.removeAttribute(attrs[i]);
            }
        }
    }

    /**
     * Retrieves data from the REST API and populates the selection.
     * @param {string} filter - The optional filter term to request.
     * @returns {void}
     */
    receiveData(filter) {
        // normalize filter
        const term = (filter === undefined || filter === null) ? "" : String(filter);

        // abort previous in-flight request, if any
        if (this._abortCtrl && typeof this._abortCtrl.abort === "function") {
            this._abortCtrl.abort();
        }
        this._abortCtrl = new AbortController();

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
                const rawData = response.items || [];
                const limitedItems = rawData.slice(0, this._maxItems);

                // map and set options, triggering the setter in the base class
                this.options = limitedItems.map((x) => {
                    return this._mapApiItem(x);
                });
            })
            .catch((err) => {
                // handle aborts silently
                const isAbort = (err && typeof err === "object" && err.name === "AbortError");
                if (!isAbort) {
                    // clear items on failure
                    this.options = [];
                    console.error("the request could not be completed successfully:", err);
                }
            });
    }

    /**
     * Maps a raw API item to the internal selection item format.
     * @param {any} apiItem - The raw item from the API.
     * @returns {Object} A normalized item compatible with the selection list.
     */
    _mapApiItem(apiItem) {
        return webexpress.webapp.selectionModel.mapApiItem(apiItem);
    }

    /**
     * Builds the request URL for GET requests including query and page parameters.
     * @param {string} term - The search term.
     * @returns {string} The composed request URL.
     */
    _buildUrl(term) {
        return webexpress.webapp.selectionModel.buildUrl({
            apiEndpoint: this._apiEndpoint,
            httpMethod: this._httpMethod,
            queryParam: this._queryParam,
            pageParam: this._pageParam,
            page: this._page
        }, term);
    }

    /**
     * Builds the fetch init object depending on HTTP method.
     * @param {string} term - The search term.
     * @param {AbortSignal} signal - The abort signal to cancel the request.
     * @returns {RequestInit} The fetch init object.
     */
    _buildRequestInit(term, signal) {
        return webexpress.webapp.selectionModel.buildRequestInit({
            httpMethod: this._httpMethod,
            queryParam: this._queryParam,
            pageParam: this._pageParam,
            page: this._page
        }, term, signal);
    }
};

// register the class in the controller
webexpress.webui.Controller.registerClass("wx-webapp-selection", webexpress.webapp.SelectionCtrl);