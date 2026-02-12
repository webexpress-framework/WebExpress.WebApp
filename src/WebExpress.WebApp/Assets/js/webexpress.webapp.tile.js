/**
 * A rest tile control extending the standard tile controller with REST-API integration.
 * Fetches tile data from a REST endpoint.
 * Supports server-side sorting, filtering, and persisting order/visibility via PUT requests.
 * The following events are triggered:
 * - webexpress.webui.Event.DATA_ARRIVED_EVENT
 */
webexpress.webapp.TileCtrl = class extends webexpress.webui.TileCtrl {

    _restUri = "";
    _orderBy = null;      // current sort property
    _orderDir = null;     // current sort direction ('asc'/'desc')

    _filter = "";
    _page = 0;
    _pageSize = 50;

    /**
     * Constructor for the TileCtrl class.
     * @param {HTMLElement} element - The DOM element associated with the control.
     */
    constructor(element) {
        super(element);

        this._restUri = element.dataset.uri || "";
        element.removeAttribute("data-uri");

        this._initRestPersistence(element);

        // initial fetch if configured as standalone
        if (this._restUri) {
            // set loading state visually on the container
            this._element.classList.add("placeholder-glow");
            this._receiveData();
        }
    }

    /**
     * Fetches data from the configured REST endpoint (Standalone Mode).
     */
    _receiveData() {
        if (!this._restUri) {
            return;
        }

        const filter = encodeURIComponent(this._filter ?? "");
        const separator = this._restUri.includes("?") ? "&" : "?";
        let url = `${this._restUri}${separator}q=${filter}&p=${this._page}&limit=${this._pageSize}`;

        if (this._orderBy) {
            url += `&o=${encodeURIComponent(this._orderBy)}`;
            if (this._orderDir) {
                url += `&d=${encodeURIComponent(this._orderDir)}`;
            }
        }

        fetch(url)
            .then((res) => {
                if (!res.ok) {
                    throw new Error("Request failed");
                }
                return res.json();
            })
            .then((response) => {
                this.updateData(response);

                // dispatch event so other components (e.g. external paginator) can update
                this._element.dispatchEvent(new CustomEvent(webexpress.webui.Event.DATA_ARRIVED_EVENT, {
                    detail: { id: this._element.id, response: response }
                }));
            })
            .catch((error) => {
                console.error("TileCtrl Request failed:", error);
                this._element.classList.remove("placeholder-glow");
            });
    }

    /**
     * Public API to update the tile view with new data.
     * Maps API response rows to tile objects.
     * @param {Object} response - The API response object containing 'rows'.
     */
    updateData(response) {
        if (!response) {
            return;
        }

        // map items to tile structure
        // we assume the server sends properties compatible with tiles (label, icon, html, etc.)
        // or a generic 'items' structure which we try to map intelligently.
        this._tiles = (response.items || []).map((item) => {
            return {
                id: item.id || null,
                label: item.label || item.title || item.name || "",
                html: item.text || item.description || item.content || null,
                class: item.class || null,
                icon: item.icon || null,
                image: item.image || null,
                colorCss: item.colorCss || item.color || null,
                colorStyle: item.colorStyle || item.style || null,
                visible: typeof item.visible === "boolean" ? item.visible : true,
                
                // action attributes mapping from API response
                primaryAction: item.primaryAction || null,
                primaryTarget: item.primaryTarget || null,
                primaryUri: item.primaryUri || null,
                secondaryAction: item.secondaryAction || null,
                secondaryTarget: item.secondaryTarget || null,
                secondaryUri: item.secondaryUri || null,

                // internal cache fields for search
                _lc_id: null,
                _lc_label: null
            };
        });

        // if the response contains sort info, update local state
        if (response.meta && response.meta.sort) {
            this._orderBy = response.meta.sort;
            this._orderDir = response.meta.dir;
        }

        this._markSearchDirty();
        this._element.classList.remove("placeholder-glow");
        this.render();
    }

    /**
     * Overrides the base orderTiles method to perform server-side sorting.
     * @param {string} property Property name.
     * @param {"asc"|"desc"} direction Direction.
     */
    orderTiles(property = "label", direction = "asc") {
        this._orderBy = property;
        this._orderDir = direction;
        
        // fetch new data instead of sorting client-side
        this._receiveData();

        // dispatch event for UI consistency (arrows etc if external controls exist)
        this._dispatchSortEvent(property, direction);
    }

    /**
     * Overrides searchTiles to optionally perform server-side filtering.
     * Currently keeps client-side behavior for speed, but updates the internal filter state
     * so subsequent fetches (pagination/sorting) keep the context.
     * @param {string} term Search term.
     * @returns {Array<Object>} Matches.
     */
    searchTiles(term) {
        this._filter = term;
        
        return super.searchTiles(term);
    }

    /**
     * Initializes listeners for state changes (reorder/visibility) to sync with server.
     * @param {HTMLElement} element Host element.
     */
    _initRestPersistence(element) {
        // listen for drag & drop moves
        element.addEventListener(webexpress.webui.Event.MOVE_EVENT, (e) => {
            if (e.detail.id === this._element.id) {
                this._notifyStateChange("reorder");
            }
        });

        // listen for visibility toggles
        element.addEventListener(webexpress.webui.Event.CHANGE_VISIBILITY_EVENT, (e) => {
             if (e.detail.id === this._element.id) {
                this._notifyStateChange("visibility");
            }
        });
    }

    /**
     * Collects current state and sends it to the server.
     * @param {string} type The type of change ('reorder' or 'visibility').
     */
    _notifyStateChange(type) {
        if (!this._restUri) {
            return;
        }

        // construct payload similar to table control
        const tileOrder = this._tiles.map((t) => t.id).join(",");
        const visibleTiles = this._tiles
            .filter((t) => t.visible)
            .map((t) => t.id)
            .join(",");

        const payload = {};
        
        // optimization: send only what changed, or send generic structure
        if (type === "reorder") {
            payload.order = tileOrder;
        } else if (type === "visibility") {
            payload.visible = visibleTiles;
            payload.order = tileOrder; // usually order is relevant for visibility too
        }

        // dispatch event for external listeners (e.g. ViewCtrl)
        this._element.dispatchEvent(new CustomEvent("wx-req-update-state", {
            bubbles: true,
            detail: {
                type: `tile-${type}`,
                order: tileOrder,
                visible: visibleTiles
            }
        }));

        this._sendStateToServer(payload);
    }

    /**
     * Sends state update to server (Standalone mode).
     * @param {Object} stateObj Data to send.
     */
    _sendStateToServer(stateObj) {
        if (!this._restUri) {
            return;
        }
        
        fetch(this._restUri, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(stateObj)
        }).catch((err) => {
            console.error("TileCtrl update state failed", err);
        });
    }
};

// register the class in the controller
webexpress.webui.Controller.registerClass("wx-webapp-tile", webexpress.webapp.TileCtrl);