/**
 * A REST-enabled Dashboard control.
 * Fetches widgets and layout configuration from a REST endpoint.
 * Automatically synchronizes widget movements and removals with the server.
 */
webexpress.webapp.DashboardCtrl = class extends webexpress.webui.DashboardCtrl {

    _restUri = "";
    _abortController = null;

    /**
     * Initializes the REST Dashboard control.
     * @param {HTMLElement} element - The root element.
     */
    constructor(element) {
        super(element);

        element.removeAttribute("data-uri");

        // the load keeps its own abort and loading state through the shared
        // request; the layout state save flows through this rest service
        const islandServices = webexpress.webapp.ServiceRegistry.fromElement(element);
        this._service = islandServices.data;
        this._restUri = this._service ? this._service.baseUri : "";

        this._initRestPersistence(element);

        if (this._restUri) {
            this._receiveData();
        }
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
        if (this._restUri) {
            if (this._isVisible && this._isVisible()) {
                this._receiveData();
            }
        }
    }
};

// register the class in the webapp controller namespace
webexpress.webui.Controller.registerClass("wx-webapp-dashboard", webexpress.webapp.DashboardCtrl);