/**
 * DropdownCtrl extends WebUI.DropdownCtrl to fetch items from a REST API and adds a 
 * search field at the top of the menu.
 *
 * The following events are triggered:
 * - webexpress.webui.Event.CLICK_EVENT
 * - webexpress.webui.Event.CHANGE_VISIBILITY_EVENT
 * - webexpress.webui.Event.DATA_REQUESTED_EVENT
 * - webexpress.webui.Event.DATA_ARRIVED_EVENT
 */
webexpress.webapp.DropdownCtrl = class extends webexpress.webui.DropdownCtrl {
    /**
     * Creates a new remote dropdown controller instance.
     * Captures static items from the initial DOM, prepares structure, and fetches initial data.
     * @param {HTMLElement} element - The DOM element associated with the instance.
     */
    constructor(element) {
        super(element);

        // capture static items parsed by base class to append later without filtering
        this._staticItems = Array.isArray(this._items) ? this._items.slice(0) : [];

        // read configuration from data-attributes
        this._apiEndpoint = element.dataset.uri || null;
        this._httpMethod = (element.dataset.method || "GET").toUpperCase();
        this._queryParam = element.dataset.queryparam || "q";
        this._maxItems = Number.isFinite(parseInt(element.dataset.maxitems, 10)) ? parseInt(element.dataset.maxitems, 10) : 25;
        this._searchPlaceholder = element.dataset.searchplaceholder || this._i18n(
            "webexpress.webapp:dropdown.search.placeholder", "");

        // dynamic items storage
        this._allItems = [];
        this._searchTerm = "";

        // avoid rendering items via base for now; structure will be ensured by _ensureStructure
        this._items = [];

        // internal flags and node references for incremental updates
        this._structureReady = false;
        this._currentDynamicNodes = [];
        this._staticNodes = [];
        this._dynamicStaticDivider = null;
        this._dynamicAnchor = null; // marker li before dynamic region
        this._searchInput = null;

        // debounce helper for remote search
        this._debouncedFetch = this._debounce((value) => {
            this._fetchData(value).catch((err) => {
                console.error("failed to fetch dropdown data (remote search):", err);
            });
        }, 180);

        // initial fetch or initial render (for static-only)
        if (this._apiEndpoint) {
            this._fetchData("").catch((err) => {
                console.error("failed to fetch dropdown data:", err);
                this._ensureStructure(); // still ensure search exists even on error
                this._updateDynamicItems([]);
            });
        } else {
            this._ensureStructure();
            this._updateDynamicItems([]);
        }
    }

    /**
     * Ensures the dropdown DOM structure is present exactly once and stable across updates.
     * Inserts the button/menu, search row, dynamic anchor, static divider, and static items.
     */
    _ensureStructure() {
        if (this._structureReady) {
            return;
        }

        // build base structure
        super.render();

        const ul = this._element.querySelector("ul.dropdown-menu");
        if (!ul) {
            return;
        }

        // insert search input as the first menu item
        const liSearch = document.createElement("li");
        liSearch.className = "px-3 py-2";

        const input = document.createElement("input");
        input.type = "search";
        input.className = "form-control";
        input.placeholder = this._searchPlaceholder;
        input.value = this._searchTerm || "";

        // prevent dropdown from closing while interacting with the search field
        input.addEventListener("click", (e) => { e.stopPropagation(); });
        input.addEventListener("mousedown", (e) => { e.stopPropagation(); });
        input.addEventListener("pointerdown", (e) => { e.stopPropagation(); });
        input.addEventListener("keydown", (e) => {
            if (e.key !== "Escape") {
                e.stopPropagation();
            }
        });

        // handle input for remote search (debounced)
        input.addEventListener("input", (e) => {
            const value = e.target.value || "";
            this._searchTerm = value;
            this._debouncedFetch(value);
        });

        liSearch.appendChild(input);
        this._searchInput = input;

        if (ul.firstChild) {
            ul.insertBefore(liSearch, ul.firstChild);
        } else {
            ul.appendChild(liSearch);
        }

        // add a small divider after the search row; this stays in place
        const liAfterSearchDivider = document.createElement("li");
        liAfterSearchDivider.className = "dropdown-divider";
        if (liSearch.nextSibling) {
            ul.insertBefore(liAfterSearchDivider, liSearch.nextSibling);
        } else {
            ul.appendChild(liAfterSearchDivider);
        }

        // dynamic region anchor (invisible marker)
        const anchor = document.createElement("li");
        anchor.className = "wx-dynamic-anchor d-none";
        anchor.setAttribute("aria-hidden", "true");
        ul.appendChild(anchor);
        this._dynamicAnchor = anchor;

        // divider between dynamic and static (created now, toggled later)
        const dsDivider = document.createElement("li");
        dsDivider.className = "dropdown-divider";
        dsDivider.style.display = "none";
        ul.appendChild(dsDivider);
        this._dynamicStaticDivider = dsDivider;

        // append static items (never filtered)
        this._staticNodes = [];
        if (Array.isArray(this._staticItems)) {
            for (let i = 0; i < this._staticItems.length; i++) {
                const node = this._createMenuItem(this._staticItems[i]);
                ul.appendChild(node);
                this._staticNodes.push(node);
            }
        }

        this._structureReady = true;
    }

    /**
     * Fetches data from the configured REST endpoint and updates the dropdown items.
     * Dispatches DATA_REQUESTED_EVENT before the request and DATA_ARRIVED_EVENT after completion using this._dispatch.
     * @param {string} term - The current search term to pass to the endpoint.
     * @returns {Promise<void>} Resolves when data is fetched and the menu updated.
     */
    async _fetchData(term) {
        // ensure structure exists before async update to avoid layout jumps
        this._ensureStructure();

        if (!this._apiEndpoint) {
            this._updateDynamicItems([]);
            return;
        }

        // dispatch "requested" event via internal dispatcher
        const startedAt = Date.now();
        try {
            // Trigger event for external listeners
            this._dispatch(webexpress.webui.Event.DATA_REQUESTED_EVENT, {
                endpoint: this._apiEndpoint,
                method: this._httpMethod,
                queryParam: this._queryParam,
                term: term || ""
            });
        } catch (e) {
            // noop: event dispatch should not block execution
        }

        try {
            // build request config
            let url = this._apiEndpoint;
            const init = {
                method: this._httpMethod,
                headers: {}
            };

            if (this._httpMethod === "GET") {
                const hasQuery = url.includes("?");
                const qp = encodeURIComponent(this._queryParam) + "=" + encodeURIComponent(term || "");
                url = url + (hasQuery ? "&" : "?") + qp;
            } else if (this._httpMethod === "POST") {
                init.headers["Content-Type"] = "application/json";
                init.body = JSON.stringify({ [this._queryParam]: term || "" });
            }

            const res = await fetch(url, init);
            if (!res.ok) {
                throw new Error("http error " + res.status);
            }

            const json = await res.json();

            let rawItems = [];
            if (Array.isArray(json)) {
                rawItems = json;
            } else if (json && Array.isArray(json.items)) {
                rawItems = json.items;
            } else if (json && Array.isArray(json.data)) {
                rawItems = json.data;
            } else {
                rawItems = [];
            }

            this._allItems = rawItems.map((x) => this._mapApiItem(x));

            // dynamic update without re-rendering the whole menu
            this._applyFilter(this._searchTerm);

            // dispatch "arrived" event (success) via internal dispatcher
            try {
                const finishedAt = Date.now();
                // Trigger event for external listeners
                this._dispatch(webexpress.webui.Event.DATA_ARRIVED_EVENT, {
                    endpoint: this._apiEndpoint,
                    method: this._httpMethod,
                    queryParam: this._queryParam,
                    term: term || "",
                    count: this._allItems.length,
                    durationMs: finishedAt - startedAt,
                    error: null
                });
            } catch (e) {
                // noop
            }
        } catch (err) {
            // on error, clear dynamic items for visual consistency
            this._allItems = [];
            this._applyFilter(this._searchTerm);

            // dispatch "arrived" event (error) via internal dispatcher
            try {
                const finishedAt = Date.now();
                // Trigger event for external listeners
                this._dispatch(webexpress.webui.Event.DATA_ARRIVED_EVENT, {
                    endpoint: this._apiEndpoint,
                    method: this._httpMethod,
                    queryParam: this._queryParam,
                    term: term || "",
                    count: 0,
                    durationMs: finishedAt - startedAt,
                    error: String(err && err.message ? err.message : err)
                });
            } catch (e) {
                // noop
            }

            console.error("failed to fetch dropdown data:", err);
        }
    }

    /**
     * Maps a raw API item to the internal dropdown item format.
     * Expected fields (flexible): id, uri/url, content/name/title, icon, image/img, color, disabled, data (object), aria (object), role.
     * @param {any} apiItem - The raw item from the API.
     * @returns {Object} A normalized item compatible with DropdownCtrl._createMenuItem.
     */
    _mapApiItem(apiItem) {
        // choose field aliases defensively
        const id = apiItem.id || null;
        const uri = apiItem.uri || apiItem.url || "javascript:void(0);";
        const content = apiItem.content || apiItem.name || apiItem.text || apiItem.title || "";
        const icon = apiItem.icon || null;
        const image = apiItem.image || apiItem.img || null;
        const color = apiItem.color || null;
        const disabled = Boolean(apiItem.disabled);
        const role = apiItem.role || null;

        // transform data/aria objects into attribute tuples
        const dataTuples = [];
        if (apiItem.data && typeof apiItem.data === "object") {
            Object.keys(apiItem.data).forEach((k) => {
                // ensure attribute key has data- prefix
                const key = k.startsWith("data-") ? k : "data-" + k;
                dataTuples.push([key, String(apiItem.data[k])]);
            });
        }

        const ariaTuples = [];
        if (apiItem.aria && typeof apiItem.aria === "object") {
            Object.keys(apiItem.aria).forEach((k) => {
                // ensure attribute key has aria- prefix
                const key = k.startsWith("aria-") ? k : "aria-" + k;
                ariaTuples.push([key, String(apiItem.aria[k])]);
            });
        }

        return {
            id: id,
            uri: uri,
            image: image,
            icon: icon,
            content: content,
            color: color,
            disabled: disabled,
            data: dataTuples,
            aria: ariaTuples,
            role: role
        };
    }

    /**
     * Applies capping to dynamic items and updates the dynamic region only.
     * Also toggles the divider to static items as needed.
     * @param {string} term - The current search term (server-filtered).
     */
    _applyFilter(term) {
        this._ensureStructure();

        const filtered = this._allItems.slice(0);

        const limited = [];
        let remaining = this._maxItems;
        for (let i = 0; i < filtered.length; i++) {
            if (remaining <= 0) {
                break;
            }
            limited.push(filtered[i]);
            remaining--;
        }

        this._updateDynamicItems(limited);
    }

    /**
     * Replaces the dynamic items between the dynamic anchor and the dynamic-static divider
     * without re-rendering the entire dropdown structure.
     * @param {Array<any>} items - The dynamic items to render.
     */
    _updateDynamicItems(items) {
        const ul = this._element.querySelector("ul.dropdown-menu");
        if (!ul || !this._dynamicAnchor || !this._dynamicStaticDivider) {
            return;
        }

        // remove previous dynamic nodes
        if (Array.isArray(this._currentDynamicNodes)) {
            for (let i = 0; i < this._currentDynamicNodes.length; i++) {
                const n = this._currentDynamicNodes[i];
                if (n && n.parentNode === ul) {
                    ul.removeChild(n);
                }
            }
        }
        this._currentDynamicNodes = [];

        // insert new dynamic nodes before the dynamic-static divider
        for (let i = 0; i < items.length; i++) {
            const li = this._createMenuItem(items[i]);
            ul.insertBefore(li, this._dynamicStaticDivider);
            this._currentDynamicNodes.push(li);
        }

        // toggle divider visibility depending on presence of dynamic and static
        const hasDynamic = this._currentDynamicNodes.length > 0;
        const hasStatic = this._staticNodes && this._staticNodes.length > 0;
        this._dynamicStaticDivider.style.display = hasDynamic && hasStatic ? "" : "none";
    }

    /**
     * Simple debounce helper to delay execution of a function.
     * @param {Function} fn - The function to debounce.
     * @param {number} delay - The debounce delay in milliseconds.
     * @returns {Function} The debounced function.
     */
    _debounce(fn, delay) {
        let t = null;
        return (...args) => {
            if (t !== null) {
                clearTimeout(t);
            }
            t = setTimeout(() => {
                fn.apply(this, args);
            }, delay);
        };
    }
};

// Register the class in the controller
webexpress.webui.Controller.registerClass("wx-webapp-dropdown", webexpress.webapp.DropdownCtrl);