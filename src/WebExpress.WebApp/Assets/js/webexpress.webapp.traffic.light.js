/**
 * TrafficLightCtrl is the REST-backed traffic light surface for a domain object.
 * It composes a WebUI lamp control and backs the value with data: it loads the
 * current status and persists a change.
 *
 * It chooses its representation by mode, exactly like the table template does:
 * - read-only (data-readonly="true") composes the read-only
 *   webexpress.webui.TrafficLightCtrl (a static, role="img" display);
 * - editable composes the interactive webexpress.webui.InputTrafficLightCtrl and
 *   persists each change.
 *
 * It is scope-capable: when the host carries a data-wx-resource binding the
 * status is a slice of an enclosing ViewState scope, so the control subscribes
 * to that slice and the scope owns the central load; without a binding it owns
 * its own wx-service island and loads itself (standalone).
 *
 * The following event is triggered (in addition to the composed control's
 * webexpress.webui.Event.CHANGE_VALUE_EVENT):
 * - webexpress.webapp.Event.CHANGE_STATUS_EVENT
 */
webexpress.webapp.TrafficLightCtrl = class extends webexpress.webui.Ctrl {
    /**
     * Constructor: composes the matching representation and connects it to data.
     * @param {HTMLElement} element - Host element for the control.
     */
    constructor(element) {
        // consume the service island before the host content is touched
        const islandServices = webexpress.webapp.ServiceRegistry.fromElement(element);

        super(element);

        // styling hook (the registered marker is consumed by the controller)
        element.classList.add("wx-webapp-traffic-light");

        this._readonly = element.dataset.readonly === "true";
        // the resource a scope renders; when present the status is a pure view of
        // a central resource the enclosing scope owns, when absent the control
        // loads itself (standalone)
        this._resource = (element.dataset && element.dataset.wxResource) || null;
        this._service = islandServices.data || null;
        this._suppressPersist = false;

        // the inner host carries the presentation seeded by C#; the composed WebUI
        // control builds the lamps inside it, so read-only and editable share the
        // exact same markup and css
        this._inner = document.createElement("div");
        if (element.dataset.orientation) {
            this._inner.dataset.orientation = element.dataset.orientation;
        }
        if (element.dataset.value) {
            this._inner.dataset.value = element.dataset.value;
        }
        const sizeClass = (element.className || "").split(/\s+/).find((c) => c.indexOf("wx-traffic-light-") === 0);
        if (sizeClass) {
            this._inner.classList.add(sizeClass);
        }
        element.appendChild(this._inner);

        if (this._readonly) {
            this._ctrl = new webexpress.webui.TrafficLightCtrl(this._inner);
        } else {
            this._ctrl = new webexpress.webui.InputTrafficLightCtrl(this._inner);
            this._inner.addEventListener(webexpress.webui.Event.CHANGE_VALUE_EVENT, () => {
                if (!this._suppressPersist) {
                    this._persist();
                }
            });
        }

        if (this._resource) {
            this._attachToScope(element);
        } else if (this._service) {
            this._load();
        }
    }

    /**
     * Normalizes a server response into a traffic light state token. Accepts a
     * bare string or an object carrying value/state/status.
     * @param {any} json - The raw server response.
     * @returns {string} One of "off", "red", "yellow", "green".
     */
    _toState(json) {
        if (json == null) {
            return "off";
        }
        if (typeof json === "string") {
            return json.trim().toLowerCase();
        }
        const value = json.value || json.state || json.status;
        return value ? String(value).trim().toLowerCase() : "off";
    }

    /**
     * Gets the current status token from the composed control.
     * @returns {string} One of "off", "red", "yellow", "green".
     */
    get value() {
        return this._ctrl.value;
    }

    /**
     * Sets the status on the composed control without triggering a persist.
     * @param {string} v - The new status token.
     */
    set value(v) {
        this._suppressPersist = true;
        this._ctrl.value = v;
        this._suppressPersist = false;
    }

    /**
     * Loads the current status from the service (standalone mode).
     * @returns {Promise<void>} Resolves when the status is loaded.
     */
    async _load() {
        try {
            const res = await this._service.load();
            if (!res.ok) {
                throw new Error("http " + res.status);
            }

            this.value = this._toState(res.data);
        } catch (err) {
            console.error("failed to load traffic light state:", err);
        }
    }

    /**
     * Attaches the control to the enclosing scope ViewState and renders its
     * resource slice. The scope owns the central load and the service; this
     * control becomes a pure view that re-renders whenever the scope re-queries
     * the resource.
     * @param {HTMLElement} element - The host element.
     */
    _attachToScope(element) {
        const viewId = (element.dataset && element.dataset.wxView) || null;

        webexpress.webapp.ViewStateRegistry.whenReady(element, viewId, (viewState) => {
            this._viewState = viewState;

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
     * Renders a resource slice the scope loaded centrally.
     * @param {object} slice - The resource slice { data, loading, error }.
     */
    _applySlice(slice) {
        slice = slice || {};
        if (slice.data !== undefined && slice.data !== null) {
            this.value = this._toState(slice.data);
        }
    }

    /**
     * Persists the current status through the service's update method. In scope
     * mode the resource is re-queried afterwards so sibling controls refresh.
     * @returns {Promise<void>} Resolves when the status is persisted.
     */
    async _persist() {
        if (!this._service) {
            return;
        }

        try {
            const res = await this._service.update({ value: this._ctrl.value });
            if (!res.ok && res.status !== 204) {
                throw new Error("http " + res.status);
            }

            if (this._viewState && this._resource) {
                this._viewState.reload(this._resource);
            }

            this._dispatch(webexpress.webapp.Event.CHANGE_STATUS_EVENT, { value: this._ctrl.value });
        } catch (err) {
            console.error("failed to persist traffic light state:", err);
        }
    }

    /**
     * Destroy control.
     */
    destroy() {
        if (this._ctrl && typeof this._ctrl.destroy === "function") {
            this._ctrl.destroy();
        }
    }
};

// register the control
webexpress.webui.Controller.registerClass("wx-webapp-traffic-light", webexpress.webapp.TrafficLightCtrl);
