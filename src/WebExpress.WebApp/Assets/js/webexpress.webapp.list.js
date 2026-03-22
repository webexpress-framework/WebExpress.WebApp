/**
 * A REST-backed list control extending the base flat ListCtrl.
 * - simple list view without toolbar or pagination controls
 * - shows bootstrap placeholders while loading
 * - queries a REST endpoint
 * - dispatches a data-arrived event on successful retrieval
 * - supports per-item edit and delete actions bound from server-provided options
 */
webexpress.webapp.ListCtrl = class extends webexpress.webui.ListCtrl {
    _search = "";
    _wql = "";
    _filter = "";
    _page = 0;
    _pageSize = 50;

    _orderBy = null;      // current sort property
    _orderDir = null;     // current sort direction ('asc'/'desc')

    // fields
    _restUri = "";
    _progressDiv = this._createProgressDiv();
    
    // placeholder items for loading state
    _previewItems = [
        { id: null, editable: false, content: { html: (() => { const w = document.createElement("span"); const s = document.createElement("span"); s.className = "placeholder col-8 placeholder-lg"; w.appendChild(s); return w; })() } },
        { id: null, editable: false, content: { html: (() => { const w = document.createElement("span"); const s = document.createElement("span"); s.className = "placeholder col-6 placeholder-lg"; w.appendChild(s); return w; })() } },
        { id: null, editable: false, content: { html: (() => { const w = document.createElement("span"); const s = document.createElement("span"); s.className = "placeholder col-7 placeholder-lg"; w.appendChild(s); return w; })() } }
    ];

    /**
     * Constructor for the REST ListCtrl.
     * @param {HTMLElement} - element host element.
     */
    constructor(element) {
        super(element);

        // read rest uri and clean attribute
        this._restUri = element.dataset.uri || "";
        element.removeAttribute("data-uri");

        // insert progress at top
        element.prepend(this._progressDiv);

        // show placeholders while loading
        // list element is inherited from base class (this._list or via public api)
        // access base list element directly via dom lookup if private, 
        // but since we extend ListCtrl, usually the container IS the element or contains the list.
        // based on base class, the ul is appended to element.
        const listUl = element.querySelector("ul.wx-list");
        if (listUl) {
            listUl.classList.add("placeholder-glow");
        }

        // set preview items using base class method
        this.setItems(this._previewItems.map(pi => {
            return {
                id: null,
                class: null,
                style: null,
                color: null,
                editable: false,
                content: { content: "", html: (pi.content?.html instanceof Element) ? pi.content.html.cloneNode(true) : null },
                options: null
            };
        }));

        // initial data load
        this._receiveData();
    }

    /**
     * Retrieves data from the REST endpoint and updates the list.
     */
    _receiveData() {
        this._progressDiv.style.visibility = "visible";

        // abort previous request if present
        if (this._abortController) {
            this._abortController.abort("search replaced");
        }
        this._abortController = new AbortController();

        const base = window.location.origin;
        let urlObj;
        try {
            urlObj = new URL(this._restUri, base);
        } catch (e) {
            urlObj = new URL(this._restUri, document.baseURI);
        }

        // set query parameters
        urlObj.searchParams.set("q", this._search || "");
        urlObj.searchParams.set("wql", this._wql || "");
        urlObj.searchParams.set("f", this._filter || "");
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
            .then(res => {
                if (!res.ok) {
                    throw new Error("Request failed");
                }
                return res.json();
            })
            .then(response => {
                // emit data arrived event
                const evt = new CustomEvent(webexpress.webui.Event.DATA_ARRIVED_EVENT, {
                    detail: {
                        id: this._element.id,
                        response: response
                    }
                });
                this._element.dispatchEvent(evt);

                // remove placeholder state
                const listUl = this._element.querySelector("ul.wx-list");
                if (listUl) {
                    listUl.classList.remove("placeholder-glow");
                }

                // map response into list items
                const mappedItems = this._mapResponseToItems(response);

                // update list via base class
                this.setItems(mappedItems);
                
                // hide progress
                this._progressDiv.style.visibility = "hidden";
                this._abortController = null;
            })
            .catch(error => {
                console.error("The request could not be completed successfully:", error);
                this._progressDiv.style.visibility = "hidden";
                this._abortController = null;
            });
    }

    /**
     * Maps a server response to internal list item structures.
     * @param {any} - response server payload.
     * @returns {Array<Object>} - Normalized items for ListCtrl.
     */
    _mapResponseToItems(response) {
        const result = [];

        // handle response.items array
        if (Array.isArray(response?.items)) {
            for (const it of response.items) {
                if (typeof it === "string") {
                    result.push({
                        id: null,
                        content: { content: it }
                    });
                } else if (it && typeof it === "object") {
                    // detect optional html template
                    let htmlEl = null;
                    if (it.html instanceof Element) {
                        htmlEl = it.html.cloneNode(true);
                    } else if (typeof it.html === "string") {
                        const tmp = document.createElement("span");
                        tmp.innerHTML = it.html;
                        htmlEl = tmp.firstElementChild ? tmp : null;
                    }

                    result.push({
                        id: it.id || null,
                        class: it.class || null,
                        style: it.style || null,
                        color: it.color || null,
                        editable: !!it.editable,
                        rendererType: it.rendererType || it.type || null, // pass through type for templates
                        rendererOptions: it.rendererOptions || {},
                        content: {
                            content: (it.content ?? it.label ?? it.name ?? ""),
                            html: htmlEl,
                            image: it.image || null,
                            icon: it.icon || null,
                            uri: it.uri || null,
                            target: it.target || null,
                            modal: it.modal || null,
                            objectId: it.objectId || null
                        },
                        // action attributes
                        primaryAction: it.primaryAction || null,
                        secondaryAction: it.secondaryAction || null,
                        bind: it.bind || null,

                        options: Array.isArray(it.options) ? it.options : null
                    });
                }
            }
            return result;
        }

        return result;
    }

    /**
     * Updates the control.
     * By default, this method calls the render() method.
     * Derived classes can override this method to implement specific behavior.
     */
    update() {
        if (this._restUri && this._isVisible()) {
            this._receiveData(false);
        }
    }

    /**
     * Sets the search filter and reloads the first page (without modifying order or paging settings).
     * @param {string} pattern - Search pattern (optional, defaults to empty string)
     * @param {string} [searchType="basic"] -  Filter type ("basic" or "wql").
     */
    search(pattern = "", searchType = "basic") {
        this._search = searchType === "basic" ? pattern : null;
        this._wql = searchType === "wql" ? pattern : null;
        this._page = 0;
        if (this._restUri && this._isVisible()) {
            this._receiveData(false);
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

    /**
     * Creates an element and assigns bootstrap classes.
     * @param {string} - tag html tag name.
     * @param {Array<string>} - classList classes to add.
     * @returns {HTMLElement} - Created element.
     */
    _createElement(tag, classList = []) {
        const el = document.createElement(tag);
        if (classList.length) {
            el.classList.add(...classList);
        }
        return el;
    }

    /**
     * Creates a compact progress bar.
     * @returns {HTMLDivElement} - Progress container.
     */
    _createProgressDiv() {
        const div = this._createElement("div", ["progress", "mb-2"]);
        div.setAttribute("role", "status");
        div.style.height = "0.25rem"; // thin line

        const bar = this._createElement("div", [
            "progress-bar",
            "progress-bar-striped",
            "progress-bar-animated"
        ]);
        bar.style.width = "100%";

        div.appendChild(bar);
        return div;
    }
};

// register the class in the controller
webexpress.webui.Controller.registerClass("wx-webapp-list", webexpress.webapp.ListCtrl);