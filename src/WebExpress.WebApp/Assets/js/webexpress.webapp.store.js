var webexpress = webexpress || {}
webexpress.webapp = webexpress.webapp || {}

/**
 * Performs a shallow equality check of two values. Objects are compared by
 * their own enumerable keys with Object.is on each value. Everything else is
 * compared with Object.is directly.
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
 * Schedules a callback on the microtask queue, with a promise based fallback
 * for environments without queueMicrotask.
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
 * The observable state container.
 */
webexpress.webapp.Store = class {
    /**
     * Creates a new store.
     * @param {object} [initialState={}] - The initial state object. It is copied, not referenced.
     */
    constructor(initialState = {}) {
        this._state = Object.assign({}, initialState);
        this._listeners = new Set();
        this._notifyScheduled = false;
    }

    /**
     * Returns the current state object. The returned object must be treated as
     * immutable. Use setState to produce a new state.
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
     * Applies a shallow patch to the state. The patch may be an object that is
     * merged into the current state, or a function that receives the current
     * state and returns such an object. Subscribers are notified once on the
     * next microtask, and only when at least one value actually changed.
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
     * Subscribes a listener to every state change. The listener receives the
     * current state. Returns an unsubscribe function.
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
     * Subscribes a listener to a derived slice of the state. The listener is
     * only invoked when the selected slice changes according to the equality
     * function, which defaults to shallow equality. Returns an unsubscribe
     * function.
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
     * Forces any pending notification to run synchronously. This is intended
     * for tests and for deterministic teardown, not for normal operation.
     */
    flush() {
        if (this._notifyScheduled) {
            this._notifyScheduled = false;
            this._notify();
        }
    }

    /**
     * Removes all listeners. Used during teardown of a shared store.
     */
    dispose() {
        this._listeners.clear();
        this._notifyScheduled = false;
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
                console.error("Store listener failed", error);
            }
        }
    }
};

/**
 * Registry of named, shared stores. A shared store is created when the first
 * consumer acquires it and disposed when the last consumer releases it, which
 * gives cross component state a single owner and a deterministic lifetime.
 */
webexpress.webapp.StoreRegistry = new class {
    /**
     * Creates a new registry.
     */
    constructor() {
        this._stores = new Map();
    }

    /**
     * Acquires a shared store by id, creating it on first use and increasing
     * its reference count.
     * @param {string} id - The store id.
     * @param {object} [initialState={}] - The initial state used on creation.
     * @returns {webexpress.webapp.Store} The shared store.
     */
    acquire(id, initialState = {}) {
        let entry = this._stores.get(id);

        if (!entry) {
            entry = { store: new webexpress.webapp.Store(initialState), refs: 0 };
            this._stores.set(id, entry);
        }

        entry.refs += 1;

        return entry.store;
    }

    /**
     * Returns a shared store by id without changing its reference count.
     * @param {string} id - The store id.
     * @returns {webexpress.webapp.Store|null} The store or null.
     */
    get(id) {
        const entry = this._stores.get(id);
        return entry ? entry.store : null;
    }

    /**
     * Releases a shared store by id, decreasing its reference count and
     * disposing it when no consumer remains.
     * @param {string} id - The store id.
     */
    release(id) {
        const entry = this._stores.get(id);

        if (!entry) {
            return;
        }

        entry.refs -= 1;

        if (entry.refs <= 0) {
            entry.store.dispose();
            this._stores.delete(id);
        }
    }

    /**
     * Removes all shared stores. Useful for tests and full resets.
     */
    clear() {
        for (const entry of this._stores.values()) {
            entry.store.dispose();
        }
        this._stores.clear();
    }
};
