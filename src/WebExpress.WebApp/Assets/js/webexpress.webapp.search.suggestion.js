/**
 * SearchSuggestionCtrl extends webexpress.webui.SearchCtrl and fills the suggestion menu
 * from a REST endpoint instead of from the static suggestions in the markup. The menu
 * opens underneath the search box: with an empty term it shows whatever the endpoint
 * offers up front (the recently opened entries, for example), and every keystroke queries
 * the endpoint again, debounced.
 *
 * A suggestion is a link to its target, so a click opens it directly. The arrow keys walk
 * the menu and enter opens the highlighted suggestion; with nothing highlighted, enter
 * submits the term to the page declared through data-submituri, which is how the box
 * reaches the full search results.
 *
 * The endpoint is authored in C# through the wx-service island of
 * WebExpress.WebApp.WebControl.ControlDataSearch.
 *
 * The following events are triggered:
 * - webexpress.webui.Event.CHANGE_FILTER_EVENT
 * - webexpress.webui.Event.DROPDOWN_SHOW_EVENT
 * - webexpress.webui.Event.DROPDOWN_HIDDEN_EVENT
 * - webexpress.webui.Event.DATA_REQUESTED_EVENT
 * - webexpress.webui.Event.DATA_ARRIVED_EVENT
 */
webexpress.webapp.SearchSuggestionCtrl = class extends webexpress.webui.SearchCtrl {
    /**
     * Creates a new suggestion search controller instance.
     * @param {HTMLElement} element - The DOM element associated with the instance.
     */
    constructor(element) {
        // consume the islands before the base constructor empties the host; the read caches
        // on the element, so the second read below returns the same services
        webexpress.webapp.ServiceRegistry.fromElement(element);

        // read the configuration before the base constructor strips the attributes it owns
        const maxItems = parseInt(element.dataset.maxitems, 10);
        const queryParam = element.dataset.queryparam;
        const submitUri = element.dataset.submituri;
        const emptyText = element.dataset.emptytext;
        const httpMethod = element.dataset.method;

        super(element);

        this._maxItems = Number.isFinite(maxItems) && maxItems > 0 ? maxItems : 10;
        this._queryParam = queryParam || "q";
        this._submitUri = submitUri || null;
        this._emptyText = emptyText || this._i18n("webexpress.webapp:search.suggestion.empty", "");
        this._httpMethod = (httpMethod || "GET").toUpperCase();

        // data service used to fetch the suggestions through the service layer; the endpoint
        // is authored in C# through the wx-service island
        const islandServices = webexpress.webapp.ServiceRegistry.fromElement(element);
        this._service = islandServices.data || null;
        this._apiEndpoint = this._service ? this._service.baseUri : null;

        // the loaded suggestions and the term they belong to; a null term means nothing has
        // been loaded yet, which is what makes the first focus fetch
        this._items = [];
        this._loadedTerm = null;
        this._itemNodes = [];
        this._activeIndex = -1;

        // only the answer to the newest request may render, so a slow one that resolves late
        // cannot overwrite the suggestions of a later keystroke
        this._requestId = 0;

        this._debouncedFetch = this._debounce((term) => {
            this._fetch(term).catch((err) => {
                console.error("failed to fetch search suggestions:", err);
            });
        }, 180);

        this._attachKeyboard();
    }

    /**
     * Renders the loaded suggestions and requests the ones for the current term. The base
     * class calls this on focus and on every keystroke, which is exactly when the menu has
     * to open and the endpoint has to be asked again.
     */
    _refreshSuggestions() {
        // the base constructor wires the focus and input handlers before this instance is
        // fully set up; nothing to render until it is
        if (!this._itemNodes) {
            return;
        }

        const term = this._searchInput.value || "";

        this._renderSuggestions();

        if (term !== this._loadedTerm) {
            this._debouncedFetch(term);
        }
    }

    /**
     * Fetches the suggestions for a term from the configured endpoint and renders them.
     * @param {string} term - The search term to query for.
     * @returns {Promise<void>} Resolves when the suggestions are rendered.
     */
    async _fetch(term) {
        if (!this._service || !this._apiEndpoint) {
            this._loadedTerm = term;
            this._items = [];
            this._renderSuggestions();
            return;
        }

        const requestId = ++this._requestId;
        const startedAt = Date.now();

        this._dispatch(webexpress.webui.Event.DATA_REQUESTED_EVENT, {
            endpoint: this._apiEndpoint,
            method: this._httpMethod,
            queryParam: this._queryParam,
            term: term || ""
        });

        try {
            const res = await this._service.request(this._buildUri(term), {
                method: this._httpMethod,
                headers: {}
            });

            if (!res.ok) {
                throw new Error("http error " + res.status);
            }

            // a stale answer is dropped rather than rendered over the newer term
            if (requestId !== this._requestId) {
                return;
            }

            const items = (res.data && res.data.items) || [];
            this._items = items.map((x) => this._mapItem(x));
            this._loadedTerm = term;
            this._renderSuggestions();

            this._dispatch(webexpress.webui.Event.DATA_ARRIVED_EVENT, {
                endpoint: this._apiEndpoint,
                method: this._httpMethod,
                queryParam: this._queryParam,
                term: term || "",
                count: this._items.length,
                durationMs: Date.now() - startedAt,
                error: null
            });
        } catch (err) {
            if (requestId !== this._requestId) {
                return;
            }

            // on error the menu falls back to its empty state rather than to stale hits
            this._items = [];
            this._loadedTerm = term;
            this._renderSuggestions();

            this._dispatch(webexpress.webui.Event.DATA_ARRIVED_EVENT, {
                endpoint: this._apiEndpoint,
                method: this._httpMethod,
                queryParam: this._queryParam,
                term: term || "",
                count: 0,
                durationMs: Date.now() - startedAt,
                error: String((err && err.message) || err)
            });

            console.error("failed to fetch search suggestions:", err);
        }
    }

    /**
     * Builds the request uri for a term, carrying the term in the configured query parameter
     * and the entry cap the control declares.
     * @param {string} term - The search term.
     * @returns {string} The request uri.
     */
    _buildUri(term) {
        const params = new URLSearchParams();
        params.set(this._queryParam, term || "");

        if (this._queryParam !== "q") {
            // the canonical dropdown search parameter, so an endpoint that reads only the
            // convention still receives the term
            params.set("q", term || "");
        }

        if (this._maxItems > 0) {
            params.set("l", String(this._maxItems));
        }

        return this._apiEndpoint + (this._apiEndpoint.includes("?") ? "&" : "?") + params.toString();
    }

    /**
     * Maps a raw endpoint item onto the internal suggestion format.
     * @param {any} apiItem - The raw item from the endpoint.
     * @returns {object} The normalized suggestion.
     */
    _mapItem(apiItem) {
        return {
            // headers and dividers ride in the same stream as the items and are told apart
            // by their type, so it has to survive the mapping
            type: apiItem.type || "item",
            id: apiItem.id || null,
            uri: apiItem.uri || apiItem.url || null,
            label: apiItem.text || apiItem.name || apiItem.label || apiItem.title || "",
            icon: apiItem.icon || null,
            image: apiItem.image || apiItem.img || null,
            color: apiItem.color || null
        };
    }

    /**
     * Renders the loaded suggestions into the menu and opens it. The menu also opens with no
     * suggestions at all, because the empty state and the footer are what the user needs to
     * see in that case.
     */
    _renderSuggestions() {
        const box = this._suggestionBox;

        if (!box) {
            return;
        }

        box.innerHTML = "";
        this._itemNodes = [];
        this._activeIndex = -1;

        for (const item of this._items) {
            if (item.type === "header") {
                box.appendChild(this._createHeader(item));
                continue;
            }

            if (item.type === "divider") {
                box.appendChild(this._createDivider());
                continue;
            }

            // headers and dividers are structural, so only selectable suggestions count
            // against the cap
            if (this._itemNodes.length >= this._maxItems) {
                continue;
            }

            const node = this._createSuggestion(item);
            box.appendChild(node);
            this._itemNodes.push(node);
        }

        if (this._itemNodes.length === 0 && this._emptyText) {
            box.appendChild(this._createEmptyState());
        }

        const hasContent = box.children.length > 0 || this._suggestionMenu.querySelector("footer") !== null;

        if (hasContent) {
            this._suggestionMenu.style.display = "flex";
            // the menu is only measurable once it is visible and filled
            this._repositionMenu(this._suggestionMenu);
            this._triggerDropdownShow();
        } else {
            this._suggestionMenu.style.display = "none";
            this._triggerDropdownHidden();
        }
    }

    /**
     * Creates a suggestion entry: a link to the target of the item.
     * @param {object} item - The suggestion to render.
     * @returns {HTMLElement} The list item element.
     */
    _createSuggestion(item) {
        const li = document.createElement("li");
        li.className = "dropdown-item";

        const link = document.createElement("a");
        // the target is set as an attribute rather than through the href property, so it can
        // be read back as authored - the keyboard opens the highlighted entry through it
        link.setAttribute("href", item.uri || "#");

        if (item.icon) {
            const icon = document.createElement("i");
            icon.className = item.icon;
            link.appendChild(icon);
        } else if (item.image) {
            const image = document.createElement("img");
            image.className = "wx-icon";
            image.src = item.image;
            link.appendChild(image);
        }

        const label = document.createElement("span");
        label.textContent = item.label;

        if (item.color) {
            label.className = item.color;
        }

        link.appendChild(label);
        li.appendChild(link);

        // an entry without a target cannot be opened, so it adopts the term instead
        if (!item.uri) {
            li.addEventListener("click", (e) => {
                e.preventDefault();
                this.value = item.label;
                this._hideSuggestions();
                this._searchInput.focus();
            });
        }

        return li;
    }

    /**
     * Creates a non-clickable group heading.
     * @param {object} item - The header entry to render.
     * @returns {HTMLElement} The list item element.
     */
    _createHeader(item) {
        const li = document.createElement("li");
        li.className = "dropdown-header";
        li.textContent = item.label;
        return li;
    }

    /**
     * Creates a separator between suggestions.
     * @returns {HTMLElement} The list item element.
     */
    _createDivider() {
        const li = document.createElement("li");
        li.className = "dropdown-divider";
        return li;
    }

    /**
     * Creates the entry shown in place of the suggestions when nothing matched.
     * @returns {HTMLElement} The list item element.
     */
    _createEmptyState() {
        const li = document.createElement("li");
        li.className = "dropdown-item wx-search-empty disabled";
        li.setAttribute("aria-disabled", "true");

        const label = document.createElement("span");
        label.textContent = this._emptyText;
        li.appendChild(label);

        return li;
    }

    /**
     * Wires the keyboard: the arrow keys walk the suggestions, enter opens the highlighted
     * one or submits the term, and escape closes the menu.
     */
    _attachKeyboard() {
        this._searchInput.addEventListener("keydown", (e) => {
            switch (e.key) {
                case "ArrowDown":
                    e.preventDefault();
                    this._moveActive(1);
                    break;
                case "ArrowUp":
                    e.preventDefault();
                    this._moveActive(-1);
                    break;
                case "Enter":
                    e.preventDefault();
                    this._submit();
                    break;
                case "Escape":
                    this._hideSuggestions();
                    break;
                default:
                    break;
            }
        });
    }

    /**
     * Moves the highlight through the suggestions, stopping at both ends.
     * @param {number} delta - The number of entries to move by.
     */
    _moveActive(delta) {
        if (this._itemNodes.length === 0) {
            return;
        }

        const next = Math.min(Math.max(this._activeIndex + delta, 0), this._itemNodes.length - 1);
        this._setActive(next);
    }

    /**
     * Highlights a suggestion by index and scrolls it into view.
     * @param {number} index - The index of the suggestion to highlight.
     */
    _setActive(index) {
        this._itemNodes.forEach((node, i) => node.classList.toggle("active", i === index));
        this._activeIndex = index;

        const active = this._itemNodes[index];

        if (active && typeof active.scrollIntoView === "function") {
            active.scrollIntoView({ block: "nearest" });
        }
    }

    /**
     * Opens the highlighted suggestion; with nothing highlighted, submits the term to the
     * declared page. A term-less submit is ignored, because it would open the results page
     * with no query at all.
     */
    _submit() {
        const active = this._itemNodes[this._activeIndex];
        const uri = active ? active.querySelector("a")?.getAttribute("href") : null;

        if (uri && uri !== "#") {
            this._navigate(uri);
            return;
        }

        if (active) {
            active.click();
            return;
        }

        const term = this._searchInput.value || "";

        if (!this._submitUri || !term) {
            return;
        }

        const separator = this._submitUri.includes("?") ? "&" : "?";
        this._navigate(this._submitUri + separator + this._queryParam + "=" + encodeURIComponent(term));
    }

    /**
     * Opens a uri in the current window.
     * @param {string} uri - The uri to open.
     */
    _navigate(uri) {
        if (typeof window !== "undefined" && window.location) {
            window.location.href = uri;
        }
    }

    /**
     * Closes the suggestion menu and drops the highlight.
     */
    _hideSuggestions() {
        this._suggestionMenu.style.display = "none";
        this._setActive(-1);
        this._triggerDropdownHidden();
    }

    /**
     * Simple debounce helper to delay execution of a function.
     * @param {Function} fn - The function to debounce.
     * @param {number} delay - The debounce delay in milliseconds.
     * @returns {Function} The debounced function.
     */
    _debounce(fn, delay) {
        let timer = null;
        return (...args) => {
            if (timer !== null) {
                clearTimeout(timer);
            }
            timer = setTimeout(() => {
                fn.apply(this, args);
            }, delay);
        };
    }
};

// register the class in the controller
webexpress.webui.Controller.registerClass("wx-webapp-search-suggestion", webexpress.webapp.SearchSuggestionCtrl);
