/**
 * A REST-enabled graph viewer. It extends the WebUI graph viewer with the data
 * path: the nodes and edges are loaded from a REST endpoint instead of being
 * authored as DOM children, while the pan, zoom, drag and layout behaviour stays
 * the one of the base control.
 *
 * Declarative configuration: the host carries a wx-service island named "data"
 * for the graph endpoint and the base control's data attributes (data-node-style,
 * data-edge-style, data-physics-enabled, data-grid, data-grid-snap, data-label).
 *
 * It is ViewState-capable: when the host carries a data-wx-resource binding the
 * graph is a slice of an enclosing ViewState, so the control subscribes to that
 * slice and the ViewState owns the central load; without a binding it owns its
 * wx-service island and loads itself (standalone).
 *
 * REST contract:
 *   GET {data} → { nodes: [...], edges: [...] }
 *
 * The viewer is read-only, so it never writes back. Events dispatched on the
 * host element, in addition to the base control's click events:
 *   webexpress.webui.Event.DATA_REQUESTED_EVENT
 *   webexpress.webui.Event.DATA_ARRIVED_EVENT
 *   webexpress.webui.Event.UPDATED_EVENT
 */
webexpress.webapp.GraphViewerCtrl = class extends webexpress.webui.GraphViewerCtrl {

    /**
     * Initializes the REST graph viewer.
     * @param {HTMLElement} element - The host element.
     */
    constructor(element) {
        // consume the islands before the base constructor empties the host;
        // later reads are served from the element cache
        webexpress.webapp.Data.readState(element);
        webexpress.webapp.ServiceRegistry.fromElement(element);

        super(element);

        // the resource a ViewState renders. when present, the graph is a pure view
        // of a central resource the enclosing ViewState owns; when absent it owns
        // its state and loads itself (standalone).
        this._resource = (element.dataset && element.dataset.wxResource) || null;
        this._viewState = null;

        // canonical ui state: a single source of truth for the loading flag,
        // seeded from the optional wx-state island. in ViewState mode this is
        // replaced by the ViewState once it resolves.
        const seed = webexpress.webapp.Data.readState(element);
        this._store = new webexpress.webapp.ViewState(element, {
            standalone: true,
            state: Object.assign({ loading: false }, seed)
        });

        const services = webexpress.webapp.ServiceRegistry.fromElement(element);
        this._service = services.data || null;

        // a graph the server seeded through the wx-state island paints without a
        // round trip; the endpoint is then only asked on an explicit refresh
        const seeded = Array.isArray(seed.nodes) || Array.isArray(seed.edges);
        if (seeded) {
            this._applyGraph(seed);
        }

        if (this._resource) {
            this._attachToViewState(element);
        } else if (this._service && !seeded) {
            this._load();

            // an external change of the service's domains re-queries and flashes,
            // so changes made by other users re-render standalone too
            const dataChanges = webexpress.webapp.DataChangeSubscription.attachReload(
                [this._service], () => this._load(), element);
            if (dataChanges) {
                (element._wxCleanup = element._wxCleanup || []).push(() => dataChanges.detach());
            }
        }
    }

    /**
     * Attaches the viewer to the enclosing ViewState and renders its resource
     * slice. The ViewState owns the state, the service and the central load, so
     * the graph re-renders whenever the ViewState re-queries the resource.
     * @param {HTMLElement} element - The host element.
     */
    _attachToViewState(element) {
        const viewStateId = (element.dataset && element.dataset.wxViewstate) || null;

        webexpress.webapp.ViewStateRegistry.whenReady(element, viewStateId, (viewState) => {
            this._viewState = viewState;
            this._store = viewState;

            const service = viewState.serviceForResource(this._resource);
            if (service) {
                this._service = service;
            }

            const unsubscribe = viewState.watch((state) => state[this._resource], (slice) => this._applySlice(slice));
            (element._wxCleanup = element._wxCleanup || []).push(unsubscribe);

            this._applySlice(viewState.getState()[this._resource]);
        });
    }

    /**
     * Renders a resource slice the ViewState loaded centrally, normalising the
     * raw payload exactly as the standalone load does.
     * @param {object} slice - The resource slice { items, total, data, loading, error }.
     */
    _applySlice(slice) {
        slice = slice || {};

        if (slice.data) {
            this._applyGraph(slice.data);
        }

        this._element.classList.remove("placeholder-glow");
        this._loading = false;
    }

    // loading flag accessor backed by the store, so the single source of truth
    // is the store

    get _loading() { return this._store.getState().loading; }
    set _loading(value) { this._store.setState({ loading: value }); }

    /**
     * Loads the graph from the configured service and renders it.
     */
    async _load() {
        if (!this._service) {
            return;
        }

        this._loading = true;
        this._element.classList.add("placeholder-glow");
        this._dispatch(webexpress.webui.Event.DATA_REQUESTED_EVENT, {});

        const result = await this._service.query({});

        if (!result.ok) {
            // a superseded query arrives as an abort result and is ignored
            if (result.error.kind !== "abort") {
                console.error("graph viewer load failed:", result.error.message);
                this._element.classList.remove("placeholder-glow");
                this._loading = false;
            }
            return;
        }

        this._applyGraph(result.data);
        this._dispatch(webexpress.webui.Event.DATA_ARRIVED_EVENT, {});

        this._element.classList.remove("placeholder-glow");
        this._loading = false;
    }

    /**
     * Normalises a raw graph payload and hands it to the base control, which
     * re-renders and refits the view.
     * @param {object} data - The raw payload carrying the nodes and edges.
     */
    _applyGraph(data) {
        this.model = webexpress.webapp.graphViewerModel.normalizeGraph(data);
        this._dispatch(webexpress.webui.Event.UPDATED_EVENT, {});
    }

    /**
     * Reloads the graph, in ViewState mode through the ViewState's central
     * re-query and standalone from the configured endpoint.
     */
    refresh() {
        if (this._viewState && this._resource) {
            this._viewState.reload(this._resource);
            return;
        }

        this._load();
    }

    /**
     * Forces an update of the control data. Standalone the reload is skipped
     * while the host is not visible, because a hidden canvas cannot be fitted to
     * the view and would come back at the wrong zoom.
     */
    update() {
        if (this._viewState && this._resource) {
            this._viewState.reload(this._resource);
            return;
        }

        if (this._service && this._isVisible()) {
            this._load();
        }
    }

    /**
     * Gets the current nodes and edges.
     * @returns {{nodes: Array<object>, edges: Array<object>}} The graph.
     */
    get value() {
        return this.model;
    }
};

// register the class in the webapp controller namespace
webexpress.webui.Controller.registerClass("wx-webapp-graph-viewer", webexpress.webapp.GraphViewerCtrl);
