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
        super(element);

        // extract REST endpoint URI from data attribute
        this._restUri = element.dataset.uri || "";
        element.removeAttribute("data-uri");
        this._abortController = null;

        // initial load if a REST endpoint is defined
        if (this._restUri) {
            this._receiveData();
        }
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

        fetch(fetchUrl, { signal: this._abortController.signal })
            .then((res) => {
                if (!res.ok) {
                    throw new Error("REST quick filter request failed");
                }
                return res.json();
            })
            .then((response) => {
                // register new filters to the global filter registry if available
                if (response && Array.isArray(response.filters)) {
                    this._registry.registerFilters(response.filters);

                    // set up button configs for all filters
                    this._staticButtonConfigs = response.filters.map(flt => {
                        return {
                            id: flt.id,
                            label: flt.name,
                            class: "wx-quickfilter-btn-chip",
                            primaryAction: { target: flt.id }
                            // add more properties as needed (icon, color, etc.)
                        };
                    });

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
        
        // render chip-like filter buttons first
        for (let i = 0; i < this._staticButtonConfigs.length; i++) {
            const btnCfg = this._staticButtonConfigs[i];
            const btnElem = document.createElement("button");
            btnElem.id = btnCfg.id;
            btnElem.className = "wx-quickfilter-btn-chip";
            btnElem.textContent = btnCfg.label;

            // add icon element if specified in config
            if (btnCfg.icon) {
                const icon = document.createElement("i");
                icon.className = btnCfg.icon;
                btnElem.prepend(icon);
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
            container.appendChild(btnElem);
        }

        // gather all filter ids represented by static buttons
        const buttonFilterIds = this._staticButtonConfigs
            .map(cfg => cfg.id || (cfg.primaryAction && cfg.primaryAction.target))
            .filter(id => !!id);

        // render filter chips for active filters not represented by a button
        for (let i = 0; i < activeIds.length; i++) {
            const filterId = activeIds[i];
            if (!buttonFilterIds.includes(filterId)) {
                const config = this._registry.getFilterConfig(filterId);
                if (config) {
                    const chip = this._createFilterChip(config);
                    container.appendChild(chip);
                }
            }
        }

        el.appendChild(container);
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