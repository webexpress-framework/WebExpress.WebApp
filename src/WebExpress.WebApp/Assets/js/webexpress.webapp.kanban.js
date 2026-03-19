/**
 * A REST-enabled Kanban control.
 * Fetches the configuration (columns, swimlanes) and cards from a REST endpoint.
 * Automatically synchronizes card movements with the server.
 */
webexpress.webapp.KanbanCtrl = class extends webexpress.webui.KanbanCtrl {

    // configuration
    _restUri = "";
    _abortController = null;

    /**
     * Initializes the REST Kanban control.
     * @param {HTMLElement} element The root element.
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
     * Fetches the board data including columns, swimlanes, and cards.
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
                // log error and reset state
                console.error("kanban load failed:", error);
                this._element.classList.remove("placeholder-glow");
                this._abortController = null;
            });
    }
    
    /**
     * Updates the internal board state using the provided json data and rerenders the board.
     * @param {Object} data - The json payload containing columns, swimlanes, and items.
     */
    updateData(data) {
        // parse column configuration
        if (data.columns) {
            this._columns = data.columns.map((col) => {
                return {
                    id: col.id,
                    label: col.label,
                    size: col.size || "1fr"
                };
            });
        }

        // parse swimlane configuration including the expanded state
        if (data.swimlanes) {
            this._swimlanes = data.swimlanes.map((lane) => {
                return {
                    id: lane.id,
                    label: lane.label,
                    expanded: lane.expanded !== false
                };
            });
        }

        // parse card items
        if (data.items) {
            this._cards = data.items.map((item) => {
                return {
                    id: item.id,
                    columnId: item.columnId,
                    swimlaneId: item.swimlaneId,
                    label: item.label || "",
                    html: item.html || "",
                    colorCss: item.colorCss || "",
                    icon: item.icon || null,
                    image: item.image || null,
                    primaryAction: item.primaryAction || {},
                    secondaryAction: item.secondaryAction || {}
                };
            });
        }

        // redraw the control with new data
        this.render();
    }

    /**
     * Initializes listeners for internal state changes to sync with the server.
     * @param {HTMLElement} element The host element.
     */
    _initRestPersistence(element) {
        const evRoot = webexpress?.webui?.Event;
        const eventName = (evRoot && evRoot.MOVE_EVENT) ? evRoot.MOVE_EVENT : "webexpress.webui.move";

        element.addEventListener(eventName, (e) => {
            if (e.detail && e.detail.id === this._element.id) {
                const payload = {
                    cardId: e.detail.cardId,
                    columnId: e.detail.columnId,
                    swimlaneId: e.detail.swimlaneId || null
                };
                this._sendStateToServer(payload);
            }
        });
    }

    /**
     * Sends the state update to the server.
     * @param {Object} payload The data payload containing card position info.
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
            // log failed update request
            console.error("kanban update state failed", err);
        });
    }

    /**
     * Forces an update of the control data.
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
webexpress.webui.Controller.registerClass("wx-webapp-kanban", webexpress.webapp.KanbanCtrl);