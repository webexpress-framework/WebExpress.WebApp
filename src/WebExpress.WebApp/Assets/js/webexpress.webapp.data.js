var webexpress = webexpress || {}
webexpress.webapp = webexpress.webapp || {}

/**
 * Component base, part of the View, State and Service architecture.
 *
 * A Component extends the existing Ctrl base and ties together a Store, a set
 * of services, a render function and the lifecycle. It seeds its store from the
 * wx-state island element, resolves its services from the wx-service island
 * elements, exposes a dispatch method for intents and runs the onMount,
 * onUpdate and onUnmount hooks. Existing controls migrate to extend Component,
 * while Ctrl stays available for trivial controls that hold no state and
 * perform no network access.
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
        this._dataChanges = null;
        this._renderRoot = options.renderRoot || element;

        const initialState = options.state || webexpress.webapp.Data.readState(element);

        // the store is a standalone ViewState: the observable state container
        // without the ViewState machinery, so the Data base owns one source of truth
        // and depends on no separate store type.
        this._store = options.store
            || new webexpress.webapp.ViewState(element, { state: initialState, standalone: true });

        this._services = options.services || webexpress.webapp.ServiceRegistry.fromElement(element);
        this._templateId = options.template
            || (element && typeof element.getAttribute === "function" ? element.getAttribute("data-wx-template") : null);
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
     * @returns {webexpress.webapp.ViewState} The store.
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

        // when a service declares the domains its endpoint serves, a server
        // side data change of those domains reloads the component and plays
        // the change flash on the host, so the user sees changes made by
        // other users; components without a load or without domain-declaring
        // services stay detached from the queue
        if (typeof this.load === "function") {
            this._dataChanges = webexpress.webapp.DataChangeSubscription.attachReload(
                this._services, () => this.load(), this._element);
        }

        if (typeof this.onMount === "function") {
            this.onMount(this._store.getState());
        }

        // announce the mount, so binds that target this component can resolve
        // its store even when they were bound before the component existed
        if (this._element && typeof this._element.dispatchEvent === "function") {
            this._element.dispatchEvent(new CustomEvent("webexpress.webapp.data.mount", {
                bubbles: true,
                detail: { component: this }
            }));
        }

        return this;
    }

    /**
     * Renders the current state into the render root and runs onUpdate after
     * the first render. The first render is driven by mount and runs onMount
     * instead of onUpdate. A view referenced through data-wx-template is the
     * C# authored view of the component and wins; otherwise the subclass
     * render method is used (the Ctrl base carries a no operation render, so
     * the template could never win the other way around). A virtual node tree
     * is patched by the keyed reconciler, a DOM node replaces the content of
     * the render root.
     * @param {object} state - The current state.
     */
    _apply(state) {
        let tree;
        const template = this._templateId && webexpress.webapp.Templates
            ? webexpress.webapp.Templates.resolve(this._templateId)
            : null;

        if (template) {
            tree = template(state, this);
        } else if (typeof this.render === "function") {
            tree = this.render(state);
        }

        if (tree !== undefined && tree !== null) {
            if (typeof Node !== "undefined" && tree instanceof Node) {
                (this._renderRoot || this._element).replaceChildren(tree);
            } else if (webexpress.webapp.Renderer) {
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

        if (this._dataChanges) {
            this._dataChanges.detach();
            this._dataChanges = null;
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

        this._mounted = false;

        super.destroy();
    }

    /**
     * Reads the wx-state island of a host element and returns the initial
     * state. Each wx-prop child carries the state key as its name attribute
     * and the value as its text, with an optional type marker (number,
     * boolean, json) restoring non-string values. The island is consumed on
     * the first read and the parsed state is cached on the element, so a
     * control and its component base can both seed from the same island. Each
     * call returns a fresh shallow copy, so a caller may extend the result.
     * @param {HTMLElement} element - The host element.
     * @returns {object} The parsed initial state, or an empty object.
     */
    static readState(element) {
        if (!element || typeof element.removeChild !== "function") {
            return {};
        }

        if (element._wxState === undefined) {
            element._wxState = webexpress.webapp.Data._consumeStateIslands(element);
        }

        return Object.assign({}, element._wxState);
    }

    /**
     * Parses and removes the wx-state island elements of a host element. Only
     * direct children are read, so a nested data bound control keeps its own
     * islands.
     * @param {HTMLElement} element - The host element.
     * @returns {object} The parsed state.
     */
    static _consumeStateIslands(element) {
        const state = {};
        const islands = Array.from(element.childNodes || [])
            .filter((node) => node.nodeType === 1 && node.tagName === "WX-STATE");

        for (const island of islands) {
            for (const prop of Array.from(island.childNodes || [])) {
                if (prop.nodeType !== 1 || prop.tagName !== "WX-PROP") {
                    continue;
                }
                const name = prop.getAttribute("name");
                if (!name) {
                    continue;
                }
                state[name] = webexpress.webapp.Data._coerceStateValue(prop.getAttribute("type"), prop.textContent);
            }
            element.removeChild(island);
        }

        return state;
    }

    /**
     * Restores a state value from its island text by the declared type marker.
     * Strings are the default and carry no marker, mirroring the formatting in
     * the C# DataState island emission.
     * @param {string|null} type - The type marker (number, boolean, json) or null.
     * @param {string} text - The island text.
     * @returns {*} The restored value.
     */
    static _coerceStateValue(type, text) {
        const value = text == null ? "" : text;

        switch (type) {
            case "number":
                return Number(value);
            case "boolean":
                return value === "true";
            case "json":
                try {
                    return JSON.parse(value);
                } catch (error) {
                    console.warn("invalid wx-prop json value", error);
                    return null;
                }
            default:
                return value;
        }
    }
};
