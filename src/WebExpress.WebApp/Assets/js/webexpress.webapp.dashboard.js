/**
 * A REST-enabled Dashboard control.
 * Fetches widgets and layout configuration from a REST endpoint.
 * Automatically synchronizes widget movements and removals with the server.
 */
webexpress.webapp.DashboardCtrl = class extends webexpress.webui.DashboardCtrl {

    _restUri = "";
    _abortController = null;
    _viewState = null;

    /**
     * Initializes the REST Dashboard control.
     * @param {HTMLElement} element - The root element.
     */
    constructor(element) {
        // consume the islands before the base constructor reshapes the
        // children; the read caches on the element
        const islandServices = webexpress.webapp.ServiceRegistry.fromElement(element);

        super(element);

        // the resource a scope renders. when present, the dashboard is a pure
        // view of a central resource the enclosing scope owns; when absent it
        // loads itself (standalone).
        this._resource = (element.dataset && element.dataset.wxResource) || null;

        // the load keeps its own abort and loading state through the shared
        // request; the layout state save flows through this rest service
        this._service = islandServices.data;
        this._restUri = this._service ? this._service.baseUri : "";

        this._initRestPersistence(element);

        if (this._resource) {
            // scope mode: the enclosing scope loads the resource centrally
            this._attachToScope(element);
        } else if (this._restUri) {
            this._receiveData();

            // an external change of the service's domains re-queries and
            // flashes, so changes made by other users re-render standalone too
            const dataChanges = webexpress.webapp.DataChangeSubscription.attachReload(
                [this._service], () => this._receiveData(), element);
            if (dataChanges) {
                (element._wxCleanup = element._wxCleanup || []).push(() => dataChanges.detach());
            }
        }
    }

    /**
     * Attaches the dashboard to the enclosing scope ViewState and renders its
     * resource slice. The scope owns the service and the central load, so the
     * dashboard re-renders whenever the scope re-queries the resource, while
     * layout changes still persist through the scope's update service.
     * @param {HTMLElement} element The host element.
     */
    _attachToScope(element) {
        const viewId = (element.dataset && element.dataset.wxView) || null;

        webexpress.webapp.ViewStateRegistry.whenReady(element, viewId, (viewState) => {
            this._viewState = viewState;

            const service = viewState.serviceForResource(this._resource);
            if (service) {
                this._service = service;
                this._restUri = service.baseUri;
            }

            const unsubscribe = viewState.watch((state) => state[this._resource], (slice) => this._applySlice(slice));
            (element._wxCleanup = element._wxCleanup || []).push(unsubscribe);

            this._applySlice(viewState.getState()[this._resource]);
        });
    }

    /**
     * Renders a resource slice the scope loaded centrally, normalising the raw
     * dashboard payload exactly as the standalone load does.
     * @param {object} slice The resource slice { items, total, data, loading, error }.
     */
    _applySlice(slice) {
        slice = slice || {};

        if (slice.data) {
            this.updateData(slice.data);
        }

        this._element.classList.remove("placeholder-glow");
    }

    /**
     * Fetches the dashboard configuration and widgets from the server.
     */
    _receiveData() {
        if (!this._restUri) {
            return;
        }

        if (this._abortController) {
            this._abortController.abort("search replaced");
        }
        
        this._abortController = new AbortController();
        this._element.classList.add("placeholder-glow");

        const base = window.location.origin;
        let urlObj;
        
        try {
            urlObj = new URL(this._restUri, base);
        } catch (e) {
            urlObj = new URL(this._restUri, document.baseURI);
        }

        const fetchUrl = this._restUri.startsWith("http") ? urlObj.href : (urlObj.pathname + urlObj.search);

        webexpress.webapp.ServiceRegistry.request(fetchUrl, { signal: this._abortController.signal })
            .then((res) => {
                if (res.error && res.error.kind === "abort") {
                    const abort = new Error("aborted");
                    abort.name = "AbortError";
                    throw abort;
                }
                if (!res.ok) {
                    throw new Error("request failed");
                }
                return res.data;
            })
            .then((response) => {
                this.updateData(response);
                this._element.classList.remove("placeholder-glow");
                this._abortController = null;
            })
            .catch((error) => {
                if (error.name === "AbortError") {
                    return;
                }
                console.error("dashboard load failed:", error);
                this._element.classList.remove("placeholder-glow");
                this._abortController = null;
            });
    }

    /**
     * Updates the internal column state and redraws the control.
     * @param {Object} data - The json payload containing columns and layout.
     */
    updateData(data) {
        const columns = webexpress.webapp.dashboardModel.normalizeColumns(data);
        if (columns) {
            this._columns = columns;
        }
        this.render();
    }

    /**
     * Initializes listeners for internal state changes to sync with the server.
     * @param {HTMLElement} element - The host element.
     */
    _initRestPersistence(element) {
        const evRoot = webexpress?.webui?.Event;
        const eventName = (evRoot && evRoot.CHANGE_VALUE_EVENT) ? evRoot.CHANGE_VALUE_EVENT : "webexpress.webui.change.value";

        element.addEventListener(eventName, (e) => {
            if (e.detail && e.detail.id === this._element.id) {
                const payload = {
                    action: e.detail.action,
                    layout: e.detail.layout,
                    // column rename / reorder / delete carries the full column list
                    columns: e.detail.columns
                };
                this._sendStateToServer(payload);
            }
        });
    }

    /**
     * Sends the updated dashboard layout state to the server.
     * @param {Object} payload - The data payload containing widget order.
     */
    _sendStateToServer(payload) {
        if (!this._restUri) {
            return;
        }

        this._service.update(payload).then((r) => {
            if (!r.ok) {
                console.error("dashboard update state failed", r.error);
            }
        });
    }

    /**
     * Forces an update of the control data from the server.
     */
    update() {
        if (this._viewState) {
            this._viewState.reload(this._resource);
            return;
        }
        if (this._restUri) {
            if (this._isVisible && this._isVisible()) {
                this._receiveData();
            }
        }
    }
};

// register the class in the webapp controller namespace
webexpress.webui.Controller.registerClass("wx-webapp-dashboard", webexpress.webapp.DashboardCtrl);