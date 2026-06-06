var webexpress = webexpress || {}
webexpress.webapp = webexpress.webapp || {}

/**
 * Component base, part of the View, State and Service architecture.
 *
 * A Component extends the existing Ctrl base and ties together a Store, a set
 * of services, a render function and the lifecycle. It seeds its store from the
 * data-wx-state island, resolves its services from the data-wx-service island,
 * exposes a dispatch method for intents and runs the onMount, onUpdate and
 * onUnmount hooks. Existing controls migrate to extend Component, while Ctrl
 * stays available for trivial controls that hold no state and perform no
 * network access.
 *
 * A subclass implements render(state) to return a virtual node tree, which the
 * renderer patches into the render root. A subclass that prefers imperative
 * updates may instead implement onUpdate(state) and omit render, which is the
 * first level of adoption described in the design.
 */
webexpress.webapp.Data = class extends webexpress.webui.Ctrl {
    /**
     * Creates a component for a host element.
     * @param {HTMLElement} element - The host element.
     * @param {object} [options={}] - Optional overrides: state, store, services, shared, renderRoot.
     */
    constructor(element, options = {}) {
        super(element);

        this._mounted = false;
        this._unsubscribe = null;
        this._sharedStoreId = null;
        this._renderRoot = options.renderRoot || element;

        const initialState = options.state || webexpress.webapp.Data.readState(element);

        if (options.store) {
            this._store = options.store;
        } else if (options.shared && element && element.id) {
            this._sharedStoreId = element.id;
            this._store = webexpress.webapp.StoreRegistry.acquire(element.id, initialState);
        } else {
            this._store = new webexpress.webapp.Store(initialState);
        }

        this._services = options.services || webexpress.webapp.ServiceRegistry.fromElement(element);
    }

    /**
     * Returns the current state.
     * @returns {object} The state.
     */
    get state() {
        return this._store.getState();
    }

    /**
     * Returns the store.
     * @returns {webexpress.webapp.Store} The store.
     */
    get store() {
        return this._store;
    }

    /**
     * Applies a shallow patch to the state.
     * @param {object|Function} patch - The patch.
     * @returns {object} The resulting state.
     */
    setState(patch) {
        return this._store.setState(patch);
    }

    /**
     * Returns a service by name.
     * @param {string} name - The service name.
     * @returns {webexpress.webapp.Service|null} The service or null.
     */
    useService(name) {
        return (this._services && this._services[name]) || null;
    }

    /**
     * Dispatches an intent against this component's store and services.
     * @param {string} name - The intent name.
     * @param {*} payload - The intent payload.
     * @returns {*} The return value of the intent effect, when present.
     */
    dispatch(name, payload) {
        return webexpress.webapp.Intents.dispatch(name, {
            store: this._store,
            payload: payload,
            services: this._services,
            component: this,
            element: this._element
        });
    }

    /**
     * Subscribes to the store, performs the first render and runs onMount. A
     * subclass calls this at the end of its constructor once it has finished
     * its own setup.
     * @returns {this} The component for chaining.
     */
    mount() {
        if (this._mounted) {
            return this;
        }

        this._unsubscribe = this._store.subscribe((state) => this._apply(state));
        this._apply(this._store.getState());
        this._mounted = true;

        if (typeof this.onMount === "function") {
            this.onMount(this._store.getState());
        }

        return this;
    }

    /**
     * Renders the current state into the render root and runs onUpdate after
     * the first render. The first render is driven by mount and runs onMount
     * instead of onUpdate.
     * @param {object} state - The current state.
     */
    _apply(state) {
        if (typeof this.render === "function" && webexpress.webapp.Renderer) {
            const tree = this.render(state);
            if (tree !== undefined && tree !== null) {
                webexpress.webapp.Renderer.patch(this._renderRoot || this._element, tree);
            }
        }

        if (this._mounted && typeof this.onUpdate === "function") {
            this.onUpdate(state);
        }
    }

    /**
     * Tears the component down. It unsubscribes from the store, aborts in
     * flight services, releases a shared store and runs onUnmount.
     */
    destroy() {
        if (this._unsubscribe) {
            this._unsubscribe();
            this._unsubscribe = null;
        }

        if (this._services) {
            for (const service of Object.values(this._services)) {
                if (service && typeof service.abort === "function") {
                    service.abort();
                }
            }
        }

        if (typeof this.onUnmount === "function") {
            this.onUnmount();
        }

        if (this._sharedStoreId) {
            webexpress.webapp.StoreRegistry.release(this._sharedStoreId);
            this._sharedStoreId = null;
        }

        this._mounted = false;

        super.destroy();
    }

    /**
     * Reads and parses the data-wx-state island of a host element.
     * @param {HTMLElement} element - The host element.
     * @returns {object} The parsed initial state, or an empty object.
     */
    static readState(element) {
        if (!element || typeof element.getAttribute !== "function") {
            return {};
        }

        const raw = element.getAttribute("data-wx-state");

        if (!raw) {
            return {};
        }

        try {
            const parsed = JSON.parse(raw);
            return (parsed && typeof parsed === "object") ? parsed : {};
        } catch (error) {
            console.warn("invalid data-wx-state island", error);
            return {};
        }
    }
};
