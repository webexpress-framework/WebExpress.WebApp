/**
 * A read-only DNF view whose terms are resolved against a REST endpoint.
 *
 * An expression stores term ids, so a view that has no options renders the ids
 * themselves - readable to the database, not to the reader. This control fetches
 * the term set once and relabels the expression already on screen, which is what
 * the read state of a REST backed column and the read view of a REST backed
 * smart edit both need.
 *
 * The request shaping and the item mapping are the ones the REST selection uses:
 * a DNF term set is queried from a selection endpoint, so a second, identical
 * model would only be a copy that can drift.
 */
webexpress.webapp.DnfCtrl = class extends webexpress.webui.DnfCtrl {
    _apiEndpoint = "";
    _httpMethod = "GET";
    _queryParam = "g";
    _pageParam = "p";
    _page = 0;
    _abortCtrl = null;
    _maxItems = 25;

    /**
     * Initializes a new instance of the REST backed read-only DNF view.
     * @param {HTMLElement} element - The host element of the view.
     */
    constructor(element) {
        // consume the island before the base constructor clears the children
        const islandServices = webexpress.webapp.ServiceRegistry.fromElement(element);

        super(element);

        this._service = islandServices.data || null;
        if (this._service) {
            this._apiEndpoint = this._service.baseUri;
        }

        if (element && element.dataset) {
            if (typeof element.dataset.method === "string") {
                const method = element.dataset.method.trim().toUpperCase();
                this._httpMethod = (method === "POST" || method === "GET") ? method : "GET";
            }
            if (typeof element.dataset.queryParam === "string") {
                this._queryParam = element.dataset.queryParam;
            }
            if (typeof element.dataset.pageParam === "string") {
                this._pageParam = element.dataset.pageParam;
            }
            if (typeof element.dataset.page === "string") {
                const page = parseInt(element.dataset.page, 10);
                if (!Number.isNaN(page) && page > 0) {
                    this._page = page;
                }
            }
            if (typeof element.dataset.maxitems === "string") {
                const maxItems = parseInt(element.dataset.maxitems, 10);
                if (!Number.isNaN(maxItems) && maxItems > 0) {
                    this._maxItems = maxItems;
                }
            }
        }

        this.receiveData("");
    }

    /**
     * Retrieves the term set from the REST API and relabels the expression.
     * @param {string} filter - The optional filter term to request.
     */
    receiveData(filter) {
        if (!this._apiEndpoint) {
            return;
        }

        const term = (filter === undefined || filter === null) ? "" : String(filter);

        if (this._abortCtrl && typeof this._abortCtrl.abort === "function") {
            this._abortCtrl.abort();
        }
        this._abortCtrl = new AbortController();

        const url = this._buildUrl(term);
        const init = this._buildRequestInit(term, this._abortCtrl.signal);

        webexpress.webapp.ServiceRegistry.request(url, init)
            .then((res) => {
                // ignore superseded requests that a newer read aborted
                if (res.error && res.error.kind === "abort") {
                    const abort = new Error("aborted");
                    abort.name = "AbortError";
                    throw abort;
                }
                if (!res.ok) {
                    throw new Error(`http ${res.status}`);
                }
                return res.data;
            })
            .then((response) => {
                const items = (response.items || []).slice(0, this._maxItems);
                this.options = items.map((x) => this._mapApiItem(x));

                this._dispatch(webexpress.webui.Event.DATA_ARRIVED_EVENT, {
                    endpoint: this._apiEndpoint,
                    term: term,
                    count: items.length,
                    error: null
                });
            })
            .catch((err) => {
                const isAbort = (err && typeof err === "object" && err.name === "AbortError");
                if (isAbort) {
                    return;
                }

                // the expression keeps rendering its term ids rather than being
                // blanked: an unreadable filter still says which rows are filtered,
                // an empty one claims there is no filter at all
                console.error("the request could not be completed successfully:", err);

                this._dispatch(webexpress.webui.Event.DATA_ARRIVED_EVENT, {
                    endpoint: this._apiEndpoint,
                    term: term,
                    count: 0,
                    error: (err instanceof Error) ? err.message : String(err)
                });
            });
    }

    /**
     * Maps a raw API item to the internal item format.
     * @param {any} apiItem - The raw item from the API.
     * @returns {object} A normalized item.
     */
    _mapApiItem(apiItem) {
        return webexpress.webapp.selectionModel.mapApiItem(apiItem);
    }

    /**
     * Builds the request URL including the query and page parameters.
     * @param {string} term - The search term.
     * @returns {string} The composed request url.
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
     * Builds the fetch init depending on the HTTP method.
     * @param {string} term - The search term.
     * @param {AbortSignal} signal - The abort signal to cancel the request.
     * @returns {object} The fetch init.
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
webexpress.webui.Controller.registerClass("wx-webapp-dnf", webexpress.webapp.DnfCtrl);
