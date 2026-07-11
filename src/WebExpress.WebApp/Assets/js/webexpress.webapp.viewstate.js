var webexpress = webexpress || {}
webexpress.webapp = webexpress.webapp || {}

/**
 * Performs a shallow equality check of two values. Objects are compared by their
 * own enumerable keys with Object.is on each value. Everything else is compared
 * with Object.is directly. This is the equality the ViewState watch uses to
 * decide whether a selected slice changed.
 * @param {*} a - The first value.
 * @param {*} b - The second value.
 * @returns {boolean} True when the two values are shallowly equal.
 */
webexpress.webapp.shallowEqual = function (a, b) {
    if (Object.is(a, b)) {
        return true;
    }

    if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) {
        return false;
    }

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) {
        return false;
    }

    for (const key of keysA) {
        if (!Object.prototype.hasOwnProperty.call(b, key) || !Object.is(a[key], b[key])) {
            return false;
        }
    }

    return true;
};

/**
 * Schedules a callback on the microtask queue, with a promise based fallback for
 * environments without queueMicrotask. The ViewState batches its notifications
 * through this.
 * @param {Function} callback - The callback to run.
 */
webexpress.webapp._microtask = function (callback) {
    if (typeof queueMicrotask === "function") {
        queueMicrotask(callback);
    } else {
        Promise.resolve().then(callback);
    }
};

/**
 * The ViewState, the central artifact of the View, State and Service
 * architecture.
 *
 * A ViewState owns the single source of truth for a region of the page: it is
 * an observable state container, it holds the named services that load the
 * region's data and it holds the named resources that bind that state to those
 * services. Instead of every data control owning a private store and loading
 * itself, the controls of a region subscribe to one ViewState and re-render when
 * the shared state changes, resources are loaded once and centrally, and any
 * control can trigger a re-query through the ViewState. The page is simply the
 * outermost ViewState; ViewStates nest, and a control resolves the nearest enclosing
 * ViewState (or an explicit one by id).
 *
 * The ViewState is the observable state primitive of WebExpress.WebApp. It
 * absorbs the responsibilities of the former Store, so a component never owns a
 * separate store: a patch is a shallow merge, notifications batch on a
 * microtask, and a subscriber can watch a derived slice with shallow equality.
 *
 * A ViewState is hosted by a wx-webapp-viewstate element that the controller
 * instantiates. It seeds its state from the host's wx-state island, resolves
 * its services from the wx-service islands and parses its resources from the
 * wx-resource islands, all of which the C# ControlViewState emits. See
 * WebExpress/docs/view-state-service.md.
 */
webexpress.webapp.ViewState = class extends webexpress.webui.Ctrl {
    /**
     * Creates a ViewState for a ViewState host element.
     * @param {HTMLElement} element - The ViewState host element.
     * @param {object} [options={}] - Optional overrides: state, services, resources, viewStateId.
     */
    constructor(element, options = {}) {
        super(element);

        this._mounted = false;
        this._notifyScheduled = false;
        this._listeners = new Set();
        this._dataChanges = null;

        // a standalone ViewState is a plain observable state container a control
        // creates as its own store, with no ViewState machinery: it does not register
        // as a ViewState, does not claim the element and does not load resources. The
        // ViewState the controller instantiates for a wx-webapp-viewstate
        // host is the full form, with the registry, the back-reference and the
        // central resource load.
        this._standalone = !!options.standalone;

        // the ViewState id keys the registry for explicit, non-ancestor lookup. it
        // survives instantiation because it is a data attribute, while the
        // selector class is stripped by the controller on instantiation.
        this._viewStateId = options.viewStateId
            || (element && element.dataset && element.dataset.wxViewstate)
            || (element && element.id)
            || "viewstate";

        // seed from the islands the C# ControlViewState emits. each read
        // consumes and caches the island on the element, so a later control
        // that probes the same host does not re-read a stale island.
        this._state = Object.assign({}, options.state || webexpress.webapp.Data.readState(element));
        this._services = options.services || webexpress.webapp.ServiceRegistry.fromElement(element);
        this._resources = options.resources || webexpress.webapp.ViewState._consumeResourceIslands(element);

        if (this._standalone) {
            return;
        }

        // an immediate back-reference, so a descendant control resolves this
        // ViewState even though the controller instantiates children before their
        // host (depth-first), well before this instance enters the instance map.
        if (element) {
            element._wxViewState = this;
        }

        webexpress.webapp.ViewStateRegistry.register(this._viewStateId, this);

        this.mount();
    }

    /**
     * Returns the ViewState id of this ViewState.
     * @returns {string} The ViewState id.
     */
    get viewStateId() {
        return this._viewStateId;
    }

    /**
     * Returns the current state object, which must be treated as immutable.
     * @returns {object} The current state.
     */
    getState() {
        return this._state;
    }

    /**
     * Convenience accessor for the current state.
     * @returns {object} The current state.
     */
    get state() {
        return this._state;
    }

    /**
     * Applies a shallow patch to the state. The patch may be an object merged
     * into the current state, or a function that receives the current state and
     * returns such an object. Subscribers are notified once on the next
     * microtask, and only when at least one value actually changed, which is
     * what keeps a response that echoes an unchanged parameter from looping back
     * into a fresh query.
     * @param {object|Function} patch - The patch object or a producer function.
     * @returns {object} The resulting state.
     */
    setState(patch) {
        if (typeof patch === "function") {
            patch = patch(this._state);
        }

        if (!patch || typeof patch !== "object") {
            return this._state;
        }

        let changed = false;
        const next = Object.assign({}, this._state);

        for (const key of Object.keys(patch)) {
            if (!Object.is(next[key], patch[key])) {
                next[key] = patch[key];
                changed = true;
            }
        }

        if (!changed) {
            return this._state;
        }

        this._state = next;
        this._scheduleNotify();

        return this._state;
    }

    /**
     * Subscribes a listener to every state change and returns an unsubscribe
     * function. The listener receives the current state.
     * @param {Function} listener - Called with the new state after a change.
     * @returns {Function} An unsubscribe function.
     */
    subscribe(listener) {
        if (typeof listener !== "function") {
            return () => { };
        }

        this._listeners.add(listener);

        return () => {
            this._listeners.delete(listener);
        };
    }

    /**
     * Computes a derived slice of the current state.
     * @param {Function} selector - Receives the state and returns a slice.
     * @returns {*} The selected slice.
     */
    select(selector) {
        return typeof selector === "function" ? selector(this._state) : undefined;
    }

    /**
     * Subscribes a listener to a derived slice of the state, so a control only
     * re-renders when the slice it depends on changes. The equality defaults to
     * shallow equality. Returns an unsubscribe function.
     * @param {Function} selector - Receives the state and returns a slice.
     * @param {Function} listener - Called with the selected slice and the state.
     * @param {Function} [equality] - Compares the previous and next slice.
     * @returns {Function} An unsubscribe function.
     */
    watch(selector, listener, equality) {
        const isEqual = typeof equality === "function" ? equality : webexpress.webapp.shallowEqual;
        let previous = this.select(selector);

        return this.subscribe((state) => {
            const nextSlice = selector(state);
            if (!isEqual(previous, nextSlice)) {
                previous = nextSlice;
                listener(nextSlice, state);
            }
        });
    }

    /**
     * Forces any pending notification to run synchronously. Intended for tests
     * and deterministic teardown, not for normal operation.
     */
    flush() {
        if (this._notifyScheduled) {
            this._notifyScheduled = false;
            this._notify();
        }
    }

    /**
     * Returns a service of this ViewState by name.
     * @param {string} name - The service name.
     * @returns {webexpress.webapp.Service|null} The service or null.
     */
    useService(name) {
        return (this._services && this._services[name]) || null;
    }

    /**
     * Returns the resource descriptor of this ViewState by name.
     * @param {string} name - The resource name.
     * @returns {object|null} The resource descriptor or null.
     */
    resource(name) {
        return (this._resources && this._resources[name]) || null;
    }

    /**
     * Returns the names of the resources this ViewState declares, so the registry
     * can index a control to the ViewState that owns the resource it binds to. This
     * is what lets a control resolve its ViewState by its resource rather than by
     * DOM ancestry, so the ViewState host no longer needs to wrap its controls.
     * @returns {Array<string>} The declared resource names.
     */
    get resourceNames() {
        return Object.keys(this._resources || {});
    }

    /**
     * Returns the service a resource is loaded through, resolved from the
     * resource's declared service name. A control bound to a resource uses this
     * for its data and its mutations, so the service is identified by the
     * resource rather than by a hard-coded name.
     * @param {string} name - The resource name.
     * @returns {webexpress.webapp.Service|null} The service or null.
     */
    serviceForResource(name) {
        const resource = this.resource(name);
        return resource ? this.useService(resource.service) : null;
    }

    /**
     * Dispatches an intent against this ViewState's state and services, so the
     * search, paging and filter binds and the dispatch action feed the same
     * unidirectional loop. The ViewState is itself the store the intent reduces
     * into, so an intent reducer that calls store.setState writes this ViewState's
     * state.
     * @param {string} name - The intent name.
     * @param {*} payload - The intent payload.
     * @returns {*} The return value of the intent effect, when present.
     */
    dispatch(name, payload) {
        return webexpress.webapp.Intents.dispatch(name, {
            store: this,
            payload: payload,
            services: this._services,
            viewState: this,
            element: this._element
        });
    }

    /**
     * Loads a resource centrally and reduces the result into its target slice.
     * The request parameters are read from the state keys the resource binds
     * outbound, the resulting items and total are projected into
     * state[target] = { items, total, loading, error }, and the values the
     * response echoes for inbound parameters are written back to state, which
     * is the inbound half of the bidirectional parameter binding (for example a
     * server that clamps the page index). A superseded query is cancelled by
     * the service, so a stale response arrives as an abort result and is
     * ignored. The historical data arrived event is re-dispatched on the host,
     * so existing listeners keep working.
     * @param {string} name - The resource name.
     * @returns {Promise<object>|undefined} The normalised result, or undefined when the resource is unknown.
     */
    async load(name) {
        const resource = this.resource(name);
        if (!resource) {
            console.warn(`ViewState resource "${name}" is not declared.`);
            return undefined;
        }

        const service = this.useService(resource.service);
        if (!service || typeof service.query !== "function") {
            console.warn(`ViewState resource "${name}" has no queryable service "${resource.service}".`);
            return undefined;
        }

        const target = resource.target || name;
        const state = this.getState();

        const params = {};
        for (const param of resource.params) {
            if (param.dir === "in") {
                continue;
            }
            const value = state[param.state];
            if (value !== undefined && value !== null) {
                params[param.name] = value;
            }
        }

        this.setState({ [target]: Object.assign({}, state[target], { loading: true, error: null }) });

        const result = await service.query(params);

        if (!result.ok) {
            if (result.error && result.error.kind !== "abort") {
                this.setState({ [target]: Object.assign({}, this.getState()[target], { loading: false, error: result.error }) });
            }
            return result;
        }

        const data = result.data;
        const projected = typeof service.project === "function"
            ? service.project(data)
            : { items: Array.isArray(data) ? data : [], total: 0 };

        // the slice carries the projected items and total for the common list
        // case, plus the raw response, so a control with a different response
        // shape (a table's rows and columns, a kanban board) renders from the
        // raw data while still sharing the central load and the loading flags
        const patch = { [target]: { items: projected.items, total: projected.total, data: data, loading: false, error: null } };

        for (const param of resource.params) {
            if (param.dir === "out") {
                continue;
            }
            if (data && data[param.name] !== undefined) {
                patch[param.state] = data[param.name];
            }
        }

        this.setState(patch);

        const arrived = webexpress.webui.Event && webexpress.webui.Event.DATA_ARRIVED_EVENT;
        if (arrived && this._element && typeof this._element.dispatchEvent === "function") {
            this._element.dispatchEvent(new CustomEvent(arrived, {
                bubbles: true,
                detail: { resource: name, response: data }
            }));
        }

        return result;
    }

    /**
     * Re-queries a resource. An alias of load with a re-query semantic, because
     * the service cancels the superseded query for a fresh one.
     * @param {string} name - The resource name.
     * @returns {Promise<object>|undefined} The normalised result.
     */
    reload(name) {
        return this.load(name);
    }

    /**
     * Loads every resource that is declared to load automatically. Called once
     * on mount, so the first paint of the ViewState needs no per control load.
     * @returns {Promise<Array>} Resolves when every automatic load settles.
     */
    loadAll() {
        const pending = [];
        for (const name of Object.keys(this._resources)) {
            if (this._resources[name].auto !== false) {
                pending.push(this.load(name));
            }
        }
        return Promise.all(pending);
    }

    /**
     * Subscribes nothing of its own, loads the automatic resources and
     * announces readiness, so a descendant control or a bind that resolved this
     * ViewState before it existed attaches now. Called at the end of the
     * constructor once the state, services and resources are in place.
     * @returns {this} The ViewState for chaining.
     */
    mount() {
        if (this._mounted) {
            return this;
        }

        this._mounted = true;
        this.loadAll();
        this._attachDataChanges();

        if (this._element && typeof this._element.dispatchEvent === "function") {
            this._element.dispatchEvent(new CustomEvent("webexpress.webapp.viewstate.ready", {
                bubbles: true,
                detail: { viewState: this, viewStateId: this._viewStateId }
            }));
        }

        return this;
    }

    /**
     * Tears the ViewState down. It drops its subscribers, aborts in-flight
     * services, releases the ViewState back-reference and unregisters from the
     * registry, so a removed ViewState leaves nothing behind.
     */
    destroy() {
        this._listeners.clear();
        this._notifyScheduled = false;
        this._detachDataChanges();

        if (this._services) {
            for (const service of Object.values(this._services)) {
                if (service && typeof service.abort === "function") {
                    service.abort();
                }
            }
        }

        if (this._element && this._element._wxViewState === this) {
            delete this._element._wxViewState;
        }

        webexpress.webapp.ViewStateRegistry.unregister(this._viewStateId, this);

        this._mounted = false;

        super.destroy();
    }

    /**
     * Schedules a single batched notification on the microtask queue.
     */
    _scheduleNotify() {
        if (this._notifyScheduled) {
            return;
        }

        this._notifyScheduled = true;

        webexpress.webapp._microtask(() => {
            if (!this._notifyScheduled) {
                return;
            }
            this._notifyScheduled = false;
            this._notify();
        });
    }

    /**
     * Notifies all listeners with the current state.
     */
    _notify() {
        const snapshot = this._state;
        for (const listener of Array.from(this._listeners)) {
            try {
                listener(snapshot);
            } catch (error) {
                console.error("ViewState listener failed", error);
            }
        }
    }

    /**
     * Wires the ViewState to the server side data change channel. The domains are
     * derived from the ViewState's services (each wx-service island may carry the
     * domains of the data its endpoint serves); when at least one service
     * declares a domain, the ViewState subscribes them and re-queries the
     * resources of a changed domain, so every subscribing control re-renders
     * when data changes on the server - including changes made by other
     * users. The originator of a change receives the message too and
     * re-queries like everyone else, which keeps its slices on the canonical
     * server state; the coalescing window and the service's abort of
     * superseded queries absorb the overlap with its own post-mutation
     * reload. A ViewState without domain-declaring services stays entirely
     * detached from the queue.
     */
    _attachDataChanges() {
        this._domainResources = this._mapDomainsToResources();
        if (this._domainResources.size === 0) {
            return;
        }

        this._dataChanges = new webexpress.webapp.DataChangeSubscription(
            Array.from(this._domainResources.keys()),
            (changed) => this._reloadChangedResources(changed)
        ).attach();
    }

    /**
     * Releases the data change wiring.
     */
    _detachDataChanges() {
        if (this._dataChanges) {
            this._dataChanges.detach();
            this._dataChanges = null;
        }
    }

    /**
     * Indexes the ViewState's resources by the domains their services declare, so
     * an incoming change message resolves directly to the resources that must
     * re-query.
     * @returns {Map<string, Set<string>>} A map of domain name to resource names.
     */
    _mapDomainsToResources() {
        const map = new Map();

        for (const name of Object.keys(this._resources || {})) {
            const service = this.serviceForResource(name);
            const domains = (service && service.domains) || [];
            for (const domain of domains) {
                const key = String(domain).toLowerCase();
                if (!map.has(key)) {
                    map.set(key, new Set());
                }
                map.get(key).add(name);
            }
        }

        return map;
    }

    /**
     * Re-queries every resource of the changed domains once, deduplicated
     * across domains, so a resource whose service serves several changed
     * domains loads a single time. When the fresh data has been reduced, the
     * controls bound to the resource play the change flash, so the user sees
     * that the update came from outside rather than from an own action.
     * @param {Set<string>} changed - The changed domain names.
     */
    _reloadChangedResources(changed) {
        const resources = new Set();
        for (const domain of changed) {
            for (const name of this._domainResources.get(domain) || []) {
                resources.add(name);
            }
        }

        for (const name of resources) {
            Promise.resolve(this.reload(name)).then((result) => {
                if (result && result.ok) {
                    webexpress.webapp.ViewState._flashBoundControls(name);
                }
            }).catch(() => {
                // a failed re-query already surfaced through the error channel
            });
        }
    }

    /**
     * Plays the change flash on every control bound to a resource. The bound
     * controls are found by their data-wx-resource binding, which is also how
     * they resolve their ViewState, so no control has to opt in individually.
     * @param {string} resource - The resource name.
     */
    static _flashBoundControls(resource) {
        if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
            return;
        }

        const escaped = (typeof CSS !== "undefined" && typeof CSS.escape === "function")
            ? CSS.escape(resource)
            : String(resource).replace(/["\\]/g, "\\$&");

        for (const element of document.querySelectorAll(`[data-wx-resource="${escaped}"]`)) {
            webexpress.webapp.DataChangeSubscription.flash(element);
        }
    }

    /**
     * Parses and removes the wx-resource island elements of a ViewState host into a
     * map of resource descriptors. Only direct children are read, so a nested
     * ViewState keeps its own resources.
     * @param {HTMLElement} element - The ViewState host element.
     * @returns {object} A map of resource name to descriptor.
     */
    static _consumeResourceIslands(element) {
        const resources = {};

        if (!element || typeof element.removeChild !== "function") {
            return resources;
        }

        const islands = Array.from(element.childNodes || [])
            .filter((node) => node.nodeType === 1 && node.tagName === "WX-RESOURCE");

        for (const island of islands) {
            const descriptor = webexpress.webapp.ViewState._parseResourceIsland(island);
            resources[descriptor.name] = descriptor;
            element.removeChild(island);
        }

        return resources;
    }

    /**
     * Parses one wx-resource island element into a resource descriptor. The
     * parameter children declare the bidirectional binding between a state key
     * and a query parameter; the direction defaults to inout, so by default a
     * parameter feeds the request and accepts the value the response echoes.
     * @param {HTMLElement} island - The island element.
     * @returns {object} The resource descriptor.
     */
    static _parseResourceIsland(island) {
        const name = island.getAttribute("name") || "default";
        const descriptor = {
            name: name,
            service: island.getAttribute("service") || "data",
            target: island.getAttribute("target") || name,
            auto: island.getAttribute("auto") !== "false",
            params: []
        };

        for (const child of Array.from(island.childNodes || [])) {
            if (child.nodeType !== 1 || child.tagName !== "WX-PARAM") {
                continue;
            }
            const paramName = child.getAttribute("name");
            if (!paramName) {
                continue;
            }
            descriptor.params.push({
                name: paramName,
                state: child.getAttribute("state") || paramName,
                dir: child.getAttribute("dir") || "inout"
            });
        }

        return descriptor;
    }
};

/**
 * The registry of ViewStates. It keys a ViewState by its ViewState id for an
 * explicit, non-ancestor lookup, and resolves the ViewState a control belongs to by
 * walking up to the nearest enclosing host. A ViewState's lifetime is its host
 * element's lifetime, which the controller already tears down on removal, so
 * the registry holds no reference counts of its own.
 */
webexpress.webapp.ViewStateRegistry = new class {
    /**
     * Creates the registry.
     */
    constructor() {
        this._states = new Map();
        this._byResource = new Map();
        this._pending = [];
    }

    /**
     * Registers a ViewState under its ViewState id, indexes the resources it
     * declares and resolves any control that asked for a ViewState before it
     * existed. A later ViewState with the same id replaces the earlier one, which
     * mirrors a re-rendered host.
     * @param {string} id - The ViewState id.
     * @param {webexpress.webapp.ViewState} viewState - The ViewState instance.
     * @returns {this} The registry for chaining.
     */
    register(id, viewState) {
        if (typeof id === "string" && viewState) {
            this._states.set(id, viewState);
            for (const name of viewState.resourceNames) {
                this._byResource.set(name, viewState);
            }
            this._flushPending();
        }
        return this;
    }

    /**
     * Returns the ViewState that declares a resource, so a control resolves its
     * ViewState by the resource it binds to rather than by DOM ancestry.
     * @param {string} name - The resource name.
     * @returns {webexpress.webapp.ViewState|null} The ViewState or null.
     */
    resolveByResource(name) {
        return this._byResource.get(name) || null;
    }

    /**
     * Returns a ViewState by ViewState id without resolving by ancestry.
     * @param {string} id - The ViewState id.
     * @returns {webexpress.webapp.ViewState|null} The ViewState or null.
     */
    get(id) {
        return this._states.get(id) || null;
    }

    /**
     * Unregisters a ViewState by ViewState id. The guard keeps a fresh ViewState that
     * already re-registered the same id from being dropped when an old instance
     * tears down.
     * @param {string} id - The ViewState id.
     * @param {webexpress.webapp.ViewState} [viewState] - The expected instance.
     */
    unregister(id, viewState) {
        if (viewState && this._states.get(id) !== viewState) {
            return;
        }
        this._states.delete(id);
    }

    /**
     * Resolves the ViewState a control belongs to. An explicit id wins and may
     * point at a ViewState that is not an ancestor, for example a toolbar that
     * drives a content region; otherwise the nearest enclosing ViewState is used.
     * @param {HTMLElement} element - The control element.
     * @param {string} [id] - An explicit ViewState id.
     * @returns {webexpress.webapp.ViewState|null} The resolved ViewState or null.
     */
    resolve(element, id) {
        if (id) {
            return this.get(id);
        }

        // a control that binds a resource resolves the ViewState that declares it,
        // which is how a control finds its ViewState when the ViewState host no longer
        // wraps it
        const resourceName = element && element.dataset && element.dataset.wxResource;
        if (resourceName) {
            const byResource = this.resolveByResource(resourceName);
            if (byResource) {
                return byResource;
            }
        }

        let current = element;
        while (current) {
            if (current._wxViewState) {
                return current._wxViewState;
            }
            current = current.parentElement;
        }

        return null;
    }

    /**
     * Resolves the ViewState a control belongs to and invokes the callback once
     * it is available. The ViewState may not exist yet when the control is
     * constructed, because the controller instantiates children before their
     * host; in that case the request is queued and resolved when the ViewState
     * registers itself, which is independent of DOM event order and timing.
     * @param {HTMLElement} element - The control element.
     * @param {string} [id] - An explicit ViewState id.
     * @param {Function} callback - Receives the resolved ViewState.
     */
    whenReady(element, id, callback) {
        const found = this.resolve(element, id);
        if (found) {
            callback(found);
            return;
        }

        this._pending.push({ element: element, id: id, callback: callback });
    }

    /**
     * Resolves the controls that asked for a ViewState before it existed. A request
     * that still cannot be resolved stays queued for a later ViewState.
     */
    _flushPending() {
        if (this._pending.length === 0) {
            return;
        }

        const stillPending = [];

        for (const waiter of this._pending) {
            const resolved = this.resolve(waiter.element, waiter.id);
            if (resolved) {
                try {
                    waiter.callback(resolved);
                } catch (error) {
                    console.error("ViewState whenReady callback failed", error);
                }
            } else {
                stillPending.push(waiter);
            }
        }

        this._pending = stillPending;
    }

    /**
     * Removes all registered ViewStates and pending resolutions. Useful for tests.
     */
    clear() {
        this._states.clear();
        this._byResource.clear();
        this._pending = [];
    }
};

// register the ViewState host with the controller, so an emitted
// wx-webapp-viewstate element is instantiated as a ViewState
webexpress.webui.Controller.registerClass("wx-webapp-viewstate", webexpress.webapp.ViewState);
