var webexpress = webexpress || {}
webexpress.webapp = webexpress.webapp || {}

/**
 * Intent registry, part of the View, State and Service architecture.
 *
 * An intent is the single bridge from a user gesture, expressed through the
 * Actions and Binds registries, to the Service and State layers. An intent
 * definition has an optional reducer and an optional effect. The reducer is a
 * pure state transition that returns a patch. The effect is an asynchronous
 * routine that may call a service and then dispatch a follow up intent with the
 * result. Side effects live only in effects, never in reducers and never in the
 * view.
 *
 * The registry follows the same register, get and unregister shape as the
 * Actions and Binds registries, so the surface stays uniform.
 */
webexpress.webapp.Intents = new class {
    /**
     * Creates the registry.
     */
    constructor() {
        this._intents = new Map();
    }

    /**
     * Registers an intent definition.
     * @param {string} name - The intent name, for example "list search".
     * @param {object} definition - An object with an optional reduce and an optional effect.
     * @returns {this} The registry for chaining.
     */
    register(name, definition) {
        if (typeof name !== "string" || name.trim() === "") {
            return this;
        }
        if (!definition || typeof definition !== "object") {
            console.error(`Intent "${name}" must be defined as an object.`);
            return this;
        }
        this._intents.set(name, definition);
        return this;
    }

    /**
     * Returns an intent definition by name.
     * @param {string} name - The intent name.
     * @returns {object|null} The definition or null.
     */
    get(name) {
        return this._intents.get(name) || null;
    }

    /**
     * Returns whether an intent is registered.
     * @param {string} name - The intent name.
     * @returns {boolean} True when registered.
     */
    has(name) {
        return this._intents.has(name);
    }

    /**
     * Removes an intent by name.
     * @param {string} name - The intent name.
     */
    unregister(name) {
        this._intents.delete(name);
    }

    /**
     * Removes all intents. Useful for tests.
     */
    clear() {
        this._intents.clear();
    }

    /**
     * Dispatches an intent. The reducer, when present, produces a patch that is
     * applied to the store. The effect, when present, runs afterwards and may
     * perform input or output. The context carries the store, the payload, the
     * services and a reference to the dispatching component.
     * @param {string} name - The intent name.
     * @param {object} context - { store, payload, services, component, element, dispatch }.
     * @returns {*} The return value of the effect, when present.
     */
    dispatch(name, context) {
        const definition = this.get(name);

        if (!definition) {
            console.warn(`Intent "${name}" is not registered.`);
            return undefined;
        }

        context = context || {};

        if (typeof context.dispatch !== "function") {
            context.dispatch = (nextName, payload) => this.dispatch(nextName, Object.assign({}, context, { payload: payload }));
        }

        if (typeof definition.reduce === "function" && context.store) {
            try {
                const patch = definition.reduce(context.store.getState(), context.payload, context);
                if (patch) {
                    context.store.setState(patch);
                }
            } catch (error) {
                console.error(`Intent "${name}" reducer failed`, error);
            }
        }

        if (typeof definition.effect === "function") {
            try {
                return definition.effect(context);
            } catch (error) {
                console.error(`Intent "${name}" effect failed`, error);
            }
        }

        return undefined;
    }
};
