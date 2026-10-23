var webexpress = webexpress || {}
webexpress.webapp = webexpress.webapp || {}

/**
 * The Data base, part of the View, State and Service architecture: the base class of a
 * control that owns state and services of its own.
 *
 * It extends webexpress.webui.StateCtrl, which owns the render loop and the lifecycle
 * (render, mount, onMount, onUpdate, onUnmount), and adds what belongs to the data
 * concept: a standalone ViewState as the state container, the services of the
 * wx-service islands, the seed of the wx-state island, a C# authored template, the
 * dispatch of intents and the reload on server side data changes. A control that keeps
 * its state imperatively and only reaches the network stays on Ctrl. Older comments call
 * this base the Component and its ViewState the Store; the vocabulary is recorded in
 * section 0.2 of WebExpress/docs/view-state-service.md.
 *
 * A subclass implements render(state) to return a virtual node tree, which the renderer
 * patches into the render root. A subclass that prefers imperative updates may instead
 * implement onUpdate(state) and omit render, which is the form most controls use today.
 */
webexpress.webapp.Data = class extends webexpress.webui.StateCtrl {
    /**
     * Creates a control for a host element.
     * @param {HTMLElement} element - The host element.
     * @param {object} [options={}] - Optional overrides: state, store (a ViewState to use as
     *     the state), services, template, renderRoot.
     */
    constructor(element, options = {}) {
        // the state is a standalone ViewState: the observable state container without
        // the resource and registry machinery of a hosted one, so the Data base owns one
        // source of truth and depends on no second container type
        super(element, {
            renderRoot: options.renderRoot,
            store: options.store || new webexpress.webapp.ViewState(element, {
                state: options.state || webexpress.webapp.Data.readState(element),
                standalone: true
            })
        });

        this._dataChanges = null;
        this._services = options.services || webexpress.webapp.ServiceRegistry.fromElement(element);
        this._templateId = options.template
            || (element && typeof element.getAttribute === "function" ? element.getAttribute("data-wx-template") : null);
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
     * Dispatches an intent against this control's ViewState and services.
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
     * Mounts the control (see StateCtrl.mount), wires it to the server side data changes
     * and announces the mount.
     * @returns {this} The control for chaining.
     */
    mount() {
        if (this._mounted) {
            return this;
        }

        // when a service declares the domains its endpoint serves, a server
        // side data change of those domains reloads the control and plays
        // the change flash on the host, so the user sees changes made by
        // other users; controls without a load or without domain-declaring
        // services stay detached from the queue
        if (this._reloadsOnDataChange()) {
            this._dataChanges = webexpress.webapp.DataChangeSubscription.attachReload(
                this._services, () => this.load(), this._element);
        }

        super.mount();
        this._announceMount();

        return this;
    }

    /**
     * Announces the mount, so binds that target this control can resolve its ViewState
     * even when they were bound before the control existed.
     */
    _announceMount() {
        if (this._element && typeof this._element.dispatchEvent === "function") {
            this._element.dispatchEvent(new CustomEvent("webexpress.webapp.data.mount", {
                bubbles: true,
                detail: { component: this }
            }));
        }
    }

    /**
     * Tells whether a server side data change reloads the control. A control with a load
     * does by default; a control that holds what the user is typing opts out, since a
     * change made elsewhere must not overwrite it.
     * @returns {boolean} True when a data change reloads the control.
     */
    _reloadsOnDataChange() {
        return typeof this.load === "function";
    }

    /**
     * Produces the view of a state. A view referenced through data-wx-template is the C#
     * authored view of the component and wins over the subclass render method (the Ctrl
     * base carries a no operation render, so the template could never win the other way
     * around).
     * @param {object} state - The state.
     * @returns {*} A virtual node tree, a DOM node or nothing.
     */
    _viewTree(state) {
        const template = this._templateId && webexpress.webapp.Templates
            ? webexpress.webapp.Templates.resolve(this._templateId)
            : null;

        return template ? template(state, this) : super._viewTree(state);
    }

    /**
     * Tears the control down. It detaches from the data changes, aborts in flight
     * services and then stops rendering (see StateCtrl.destroy).
     */
    destroy() {
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
