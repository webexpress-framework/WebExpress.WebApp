/**
 * REST-enabled quick filter control.
 * Fetches available filters from a REST endpoint, registers them, sets up button configs, and renders the UI.
 */
webexpress.webapp.QuickFilterCtrl = class extends webexpress.webui.QuickFilterCtrl {

    /**
     * Initializes the REST quick filter control instance.
     * @param {HTMLElement} element - the root element for the control.
     */
    constructor(element) {
        // consume the island before the base constructor parses the children
        // as filter items; the read caches on the element
        const islandServices = webexpress.webapp.ServiceRegistry.fromElement(element);

        super(element);

        // the endpoint is authored in C# through the wx-service island
        this._service = islandServices.data || null;
        this._restUri = this._service ? this._service.baseUri : "";
        this._abortController = null;

        this._attachViewState(element);

        // a definition changed elsewhere - a second bar on the page, another
        // surface - is adopted by reloading; the originating control has already
        // updated itself and skips its own event, so this cannot loop
        document.addEventListener(webexpress.webui.Event.CHANGE_FILTER_DEFINITION_EVENT, (e) => {
            if (this._restUri && e.detail?.origin !== this._originId()) {
                this._receiveData();
            }
        });

        // a filter defined in a dialog of the application is written by that dialog's
        // form rather than through this control, so nothing here knew about it and the
        // new chip only appeared on the next page load; a successful write to this
        // bar's own service is therefore taken as a change to its filters
        document.addEventListener(webexpress.webui.Event.UPLOAD_SUCCESS_EVENT, (e) => {
            if (this._restUri && this._isOwnService(e.detail?.endpoint)) {
                this._receiveData();
            }
        });

        // initial load if a REST endpoint is defined
        if (this._restUri) {
            this._receiveData();
        }
    }

    /**
     * Determines whether an address addresses the service this bar reads its
     * filters from. The two are compared without their query, because a form
     * writes to the same route the bar reads and only differs in what it appends.
     * @param {string} endpoint - the address that was written to.
     * @returns {boolean} true when the write concerned this bar's filters.
     */
    _isOwnService(endpoint) {
        if (!endpoint || !this._restUri) {
            return false;
        }

        const strip = (uri) => String(uri).split("?")[0].replace(/\/+$/, "");

        return strip(endpoint) === strip(this._restUri);
    }

    /**
     * Returns the id identifying this control as the origin of a definition
     * change, so it can ignore the event it caused itself.
     * @returns {string} the origin id.
     */
    _originId() {
        if (!this._origin) {
            this._origin = this._element.id || `wx-quickfilter-${Math.random().toString(36).slice(2)}`;
        }
        return this._origin;
    }

    /**
     * Creates or changes a user-defined filter through the service and shows the
     * result at once: the endpoint owns the id and may normalise the values, so
     * the returned item - not the entered one - is adopted.
     * @param {Object} values - the values entered in the dialog.
     */
    _saveFilter(values) {
        if (!this._restUri) {
            return;
        }

        const create = !values.id;

        webexpress.webapp.ServiceRegistry.request(this._restUri, {
            method: create ? "POST" : "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(values)
        })
            .then((res) => {
                if (!res || !res.ok) {
                    throw new Error("quick filter could not be saved");
                }

                const item = this._firstFilter(res.data) || values;
                this._applyFilter(item, create);
            })
            .catch((error) => {
                console.error("quick filter save failed:", error);
                this._dispatch(webexpress.webui.Event.DATA_ERROR_EVENT, { error: error });
            });
    }

    /**
     * Removes a user-defined filter through the service and drops it from the
     * bar at once.
     * @param {Object} config - the filter to remove.
     */
    _removeFilter(config) {
        const id = config?.id;
        if (!this._restUri || !id) {
            return;
        }

        const separator = this._restUri.indexOf("?") >= 0 ? "&" : "?";

        webexpress.webapp.ServiceRegistry.request(`${this._restUri}${separator}id=${encodeURIComponent(id)}`, {
            method: "DELETE"
        })
            .then((res) => {
                if (!res || !res.ok) {
                    throw new Error("quick filter could not be removed");
                }

                this._staticButtonConfigs = this._staticButtonConfigs.filter((x) => x.id !== id);
                this._registry.undefineFilter(id, this._originId());
                this.render();
            })
            .catch((error) => {
                console.error("quick filter removal failed:", error);
                this._dispatch(webexpress.webui.Event.DATA_ERROR_EVENT, { error: error });
            });
    }

    /**
     * Adopts a created or changed filter into the local configurations, the
     * registry and the rendered bar, so the change is visible without a reload.
     * @param {Object} item - the filter as the endpoint returned it.
     * @param {boolean} create - whether the filter was newly created.
     */
    _applyFilter(item, create) {
        const config = this._toButtonConfig(item);
        const index = this._staticButtonConfigs.findIndex((x) => x.id === config.id);

        if (index >= 0) {
            this._staticButtonConfigs[index] = config;
        } else {
            this._staticButtonConfigs.push(config);
        }

        this._registry.defineFilter(item, this._originId());

        // a newly created filter is applied right away, which is what the user
        // asked for by defining it; the registry re-renders every bound control
        if (create && item.id) {
            this._registry.activate(item.id);
        }

        this.render();
    }

    /**
     * Maps a filter as the service delivers it onto the chip configuration the
     * renderer expects. The user-defined flag and the opaque criteria travel
     * along, because the options menu and the dialog are built from them.
     * @param {Object} filter - the filter as the service delivered it.
     * @returns {Object} the chip configuration.
     */
    _toButtonConfig(filter) {
        return {
            id: filter.id,
            label: filter.name,
            icon: filter.icon || null,
            color: filter.color || null,
            colorValue: filter.colorValue || null,
            badge: filter.badge != null ? String(filter.badge) : null,
            badgeColor: filter.badgeColor || null,
            badgeStyle: filter.badgeStyle || null,
            custom: filter.custom === true,
            criteria: filter.criteria ?? null,
            class: "wx-quickfilter-btn-chip",
            primaryAction: { target: filter.id }
        };
    }

    /**
     * Reads the single filter out of a write response, which carries the same
     * shape as the list response.
     * @param {Object} data - the response payload.
     * @returns {Object|null} the filter, or null when the response carries none.
     */
    _firstFilter(data) {
        if (Array.isArray(data)) {
            return data[0] || null;
        }
        return (data && Array.isArray(data.filters)) ? (data.filters[0] || null) : null;
    }

    /**
     * Wires the quickfilter to an enclosing ViewState when it was authored with
     * Resource<T>().Model(path). Instead of the BindFilter control-to-control
     * wire, the quickfilter writes the active filter set into the shared state
     * and re-queries the bound resource, so every control that renders it
     * re-renders. A quickfilter without a resource binding stays standalone and
     * keeps coordinating through the change filter event and the BindFilter bind.
     * @param {HTMLElement} element - the host element carrying the binding.
     */
    _attachViewState(element) {
        this._viewState = null;
        this._viewStateResource = element.getAttribute("data-wx-model-query")
            || element.getAttribute("data-wx-resource")
            || null;

        if (!this._viewStateResource) {
            return;
        }

        // the model path defaults to "filter", the query parameter the data
        // query families already carry, when the surface is bound but declares
        // no explicit path
        this._modelPath = element.getAttribute("data-wx-model") || "filter";

        const viewStateId = element.getAttribute("data-wx-viewstate") || null;
        webexpress.webapp.ViewStateRegistry.whenReady(element, viewStateId, (viewState) => {
            this._viewState = viewState;
            // a cookie-restored selection feeds the initial query, so the first
            // paint already reflects the persisted filter
            if (this._registry.getActiveFilters().length > 0) {
                this._writeFilterToViewState();
            }
        });

        document.addEventListener(webexpress.webui.Event.CHANGE_FILTER_EVENT, () => this._writeFilterToViewState());
    }

    /**
     * Writes the active filter set into the bound ViewState and re-queries the
     * resource, resetting the page so a new filter starts at the first page. The
     * viewstate/query intent applies the patch and re-loads in one step.
     */
    _writeFilterToViewState() {
        if (!this._viewState) {
            return;
        }

        const patch = { page: 0 };
        patch[this._modelPath] = this._registry.getActiveFilters();
        this._viewState.dispatch("viewstate/query", { resource: this._viewStateResource, patch: patch });
    }

    /**
     * Fetches the filter definitions from the remote server using fetch API,
     * registers filters, sets up button configs, and updates the UI state.
     */
    _receiveData() {
        if (!this._restUri) {
            return;
        }

        // abort previous fetch request if one is in progress
        if (this._abortController) {
            this._abortController.abort("REST quick filter request replaced");
        }

        this._abortController = new AbortController();
        this._element.classList.add("placeholder-glow");

        let urlObj;
        const base = window.location.origin;

        // build URL object safely
        try {
            urlObj = new URL(this._restUri, base);
        } catch (e) {
            urlObj = new URL(this._restUri, document.baseURI);
        }

        // determine fetch URL (absolute or path)
        const fetchUrl = this._restUri.startsWith("http")
            ? urlObj.href
            : (urlObj.pathname + urlObj.search);

        webexpress.webapp.ServiceRegistry.request(fetchUrl, { signal: this._abortController.signal })
            .then((res) => {
                if (res.error && res.error.kind === "abort") {
                    const abort = new Error("aborted");
                    abort.name = "AbortError";
                    throw abort;
                }
                if (!res.ok) {
                    throw new Error("REST quick filter request failed");
                }
                return res.data;
            })
            .then((response) => {
                // register new filters to the global filter registry if available
                if (response && Array.isArray(response.filters)) {
                    this._registry.registerFilters(response.filters);

                    // set up button configs for all filters; the icon spec is a
                    // css class or an image uri, both handled by the icon factory
                    this._staticButtonConfigs = response.filters.map((flt) => this._toButtonConfig(flt));

                    // initialize registry state using saved cookie
                    this._registry.init();
                }

                // re-render UI after filters are loaded and registered
                this.render();

                // remove loading state
                this._element.classList.remove("placeholder-glow");
                this._abortController = null;
            })
            .catch((error) => {
                // check for abort, otherwise log error and remove loading state
                if (error.name === "AbortError") {
                    return;
                }
                console.error("REST quick filter load failed:", error);
                this._element.classList.remove("placeholder-glow");
                this._abortController = null;
            });
    }

    /**
     * Renders the quick filter UI using the filter registry and static button configs.
     * Overrides the base render function to display filters loaded from REST endpoint.
     */
    render() {
        const el = this._element;
        el.innerHTML = "";

        // do not render if registry is not available
        if (!this._registry || typeof this._registry.getActiveFilters !== "function") {
            return;
        }

        const activeIds = this._registry.getActiveFilters();
        const container = document.createElement("div");

        // render the authored items first (avatars, dropdowns, multi-selects and
        // REST dropdowns), then the REST-loaded filter buttons after them
        const itemFilterIds = this._renderItems(activeIds, container);

        // render chip-like filter buttons first
        for (let i = 0; i < this._staticButtonConfigs.length; i++) {
            const btnCfg = this._staticButtonConfigs[i];
            const btnElem = document.createElement("button");
            btnElem.id = btnCfg.id;
            btnElem.className = "wx-quickfilter-btn-chip";
            btnElem.textContent = btnCfg.label;

            // a system color travels as a btn-<color> class through data-color,
            // which the button controller consumes into a class
            if (btnCfg.color) {
                btnElem.dataset.color = btnCfg.color;
            }

            // mark button as active if filter is enabled
            const filterId = btnCfg.id || (btnCfg.primaryAction && btnCfg.primaryAction.target);
            if (activeIds.includes(filterId)) {
                btnElem.classList.add("active");
                btnElem.setAttribute("aria-pressed", "true");
            }

            // add click event handler to toggle filter
            btnElem.onclick = () => {
                // toggle the filter in the registry
                this._registry.toggle(btnCfg.id);
            };

            // instantiate ButtonCtrl for consistent event and logic handling
            webexpress.webui.Controller.createInstanceByClassType("wx-webui-button", btnElem);

            // the icon and the badge are added after the button controller ran,
            // because the controller rebuilds the chip content and would drop
            // earlier children; the icon factory renders a css spec as <i> and
            // an image spec as <img>
            const icon = webexpress.webui.Icon.create(btnCfg.icon);
            if (icon) {
                btnElem.prepend(icon);
            }

            // a user-defined color feeds the chip accent directly
            if (btnCfg.colorValue) {
                btnElem.style.setProperty("--wx-quickfilter-accent", btnCfg.colorValue);
            }
            this._appendBadge(btnElem, btnCfg.badge, btnCfg.badgeColor, btnCfg.badgeStyle);
            container.appendChild(this._withCustomMenu(btnElem, btnCfg));
        }

        // gather all filter ids represented by static buttons
        const buttonFilterIds = this._staticButtonConfigs
            .map(cfg => cfg.id || (cfg.primaryAction && cfg.primaryAction.target))
            .filter(id => !!id);

        // render filter chips for active filters not represented by an item or button
        const represented = itemFilterIds.concat(buttonFilterIds);
        for (let i = 0; i < activeIds.length; i++) {
            const filterId = activeIds[i];
            if (!represented.includes(filterId)) {
                const config = this._registry.getFilterConfig(filterId);
                if (config) {
                    const chip = this._createFilterChip(config);
                    container.appendChild(chip);
                }
            }
        }

        this._renderAddChips(container);

        el.appendChild(container);
    }

    /**
     * Loads the dropdown options of a REST quick-filter item through the service
     * layer, narrowing the result by the search query when one is given so huge
     * option sets are filtered on the server, and normalising the response into
     * the registry's option shape.
     * @param {string} uri - the endpoint uri.
     * @param {string} [query] - the search query for large option sets.
     * @returns {Promise<Array>} the loaded option descriptors.
     */
    _fetchOptions(uri, query) {
        const url = query
            ? uri + (uri.indexOf("?") >= 0 ? "&" : "?") + "q=" + encodeURIComponent(query)
            : uri;
        return webexpress.webapp.ServiceRegistry.request(url)
            .then((res) => {
                if (!res || !res.ok) {
                    return [];
                }
                if (Array.isArray(res.data)) {
                    return res.data;
                }
                return (res.data && Array.isArray(res.data.filters)) ? res.data.filters : [];
            })
            .catch(() => []);
    }

    /**
     * Forces an update of the control using the REST endpoint if visible.
     */
    update() {
        if (this._restUri) {
            if (this._isVisible && this._isVisible()) {
                this._receiveData();
            }
        }
    }
};

// register the REST quick filter control as a component class
webexpress.webui.Controller.registerClass("wx-webapp-quickfilter", webexpress.webapp.QuickFilterCtrl);