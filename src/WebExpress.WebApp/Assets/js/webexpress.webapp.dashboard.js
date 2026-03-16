/**
 * A REST-enabled Dashboard control.
 * Fetches widgets and layout configuration from a REST endpoint.
 * Automatically synchronizes widget movements and removals with the server.
 */
webexpress.webapp.DashboardCtrl = class extends webexpress.webui.DashboardCtrl {

    // configuration
    _restUri = "";
    _abortController = null;

    /**
     * Initializes the REST Dashboard control.
     * @param {HTMLElement} element - The root element.
     */
    constructor(element) {
        super(element);

        this._restUri = element.dataset.uri || "";
        element.removeAttribute("data-uri");

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

        fetch(fetchUrl, { signal: this._abortController.signal })
            .then((res) => {
                if (!res.ok) {
                    throw new Error("request failed");
                }
                return res.json();
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
                    order: e.detail.order
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

        fetch(this._restUri, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        }).catch((err) => {
            console.error("dashboard update state failed", err);
        });
    }

    /**
     * Forces an update of the control data from the server.
     */
    update() {
        if (this._restUri) {
            if (this._isVisible()) {
                this._receiveData();
            }
        }
    }
};

// register the class in the webapp controller namespace
webexpress.webui.Controller.registerClass("wx-webapp-dashboard", webexpress.webapp.DashboardCtrl);