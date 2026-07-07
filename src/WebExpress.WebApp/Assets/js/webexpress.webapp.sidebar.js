/**
 * A REST-backed sidebar control extending the shared WebUI SidebarCtrl.
 * - queries a REST endpoint for its navigation items
 * - renders hierarchical items and badges through the base sidebar
 * - shows placeholder rows while loading
 * - seeds from an embedded state island to skip the first round trip
 * - re-queries when the server announces a data change (live updates)
 * Emits events:
 * - webexpress.webui.Event.DATA_ARRIVED_EVENT
 */
webexpress.webapp.SidebarCtrl = class extends webexpress.webui.SidebarCtrl {
    /**
     * Constructor for the REST SidebarCtrl.
     * @param {HTMLElement} element - The host element.
     */
    constructor(element) {
        // consume the islands before the base constructor reshapes the children;
        // later reads are served from the element cache
        webexpress.webapp.Data.readState(element);
        webexpress.webapp.ServiceRegistry.fromElement(element);

        super(element);

        // canonical state for the sidebar: the single source of truth the load
        // and the seed write to. seeded from the optional wx-state island
        this._store = new webexpress.webapp.ViewState(element, {
            standalone: true,
            state: Object.assign({ items: [], loading: false, error: null }, webexpress.webapp.Data.readState(element))
        });

        // data service: the configured island authored in C# through .Service()
        const islandServices = webexpress.webapp.ServiceRegistry.fromElement(element);
        this._service = islandServices.data;

        const seeded = this._store.getState().items;
        if (Array.isArray(seeded) && seeded.length > 0) {
            // the server embedded the items in the state island, so the first
            // paint renders them without a round trip
            this.setItems(webexpress.webapp.sidebarModel.mapItems({ items: seeded }));
        } else {
            this._showPlaceholder();
            this._load();
        }

        // an external change of the service's domains re-queries and flashes, so
        // changes made by other users re-render the sidebar too
        const dataChanges = webexpress.webapp.DataChangeSubscription.attachReload(
            [this._service], () => this._load(), element);
        if (dataChanges) {
            (element._wxCleanup = element._wxCleanup || []).push(() => dataChanges.detach());
        }
    }

    /**
     * Replaces the sidebar items, dropping the loading placeholder first so the
     * skeleton glow never lingers behind real content.
     * @param {Array<object>} descriptors - The new item descriptors.
     */
    setItems(descriptors) {
        if (this._sidebarWrapper) {
            this._sidebarWrapper.classList.remove("placeholder-glow");
        }
        super.setItems(descriptors);
    }

    /**
     * Retrieves the items from the REST endpoint through the data service and
     * renders them. A superseded query is cancelled by the service, so a stale
     * response arrives as an abort result and is ignored here.
     * @returns {Promise<void>} Resolves when the load completes.
     */
    async _load() {
        if (!this._service) {
            return;
        }

        this._store.setState({ loading: true, error: null });

        const result = await this._service.query({});

        if (!result.ok) {
            // ignore aborts (a newer query replaced this one); report the rest
            if (result.error.kind !== "abort") {
                console.error("the sidebar could not be loaded:", result.error.message);
                this._store.setState({ loading: false, error: result.error });
            }
            return;
        }

        const items = webexpress.webapp.sidebarModel.mapItems(result.data);
        this._store.setState({ items: items, loading: false, error: null });
        this.setItems(items);

        this._dispatch(webexpress.webui.Event.DATA_ARRIVED_EVENT, { response: result.data });
    }

    /**
     * Fills the item area with a few skeleton rows so the sidebar has a shape
     * while the first response is in flight. The rows are cleared by the next
     * setItems, which rebuilds the item area from scratch.
     */
    _showPlaceholder() {
        if (!this._sidebarWrapper) {
            return;
        }

        this._sidebarWrapper.classList.add("placeholder-glow");

        for (let i = 0; i < 5; i++) {
            const row = document.createElement("div");
            row.className = "wx-sidebar-link wx-sidebar-placeholder";

            const bar = document.createElement("span");
            bar.className = "wx-label placeholder";
            // stagger the widths so the skeleton reads as a list rather than a block
            bar.style.width = (45 + (i % 3) * 15) + "%";

            row.appendChild(bar);
            this._sidebarWrapper.appendChild(row);
        }
    }

    /**
     * Reloads the sidebar when it is backed by a service and visible.
     */
    update() {
        if (this._service && this._isVisible()) {
            this._load();
        }
    }
};

// register the class in the controller
webexpress.webui.Controller.registerClass("wx-webapp-sidebar", webexpress.webapp.SidebarCtrl);
