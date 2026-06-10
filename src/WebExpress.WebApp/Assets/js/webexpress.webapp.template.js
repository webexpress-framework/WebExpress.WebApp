var webexpress = webexpress || {}
webexpress.webapp = webexpress.webapp || {}

/**
 * Registry of view templates, part of the View, State and Service
 * architecture. A template is a render function that receives the current
 * state and the owning component and returns a virtual node tree for the
 * keyed reconciler or a DOM node. Components reference a template through the
 * data-wx-template attribute that the C# layer emits, so a view can be
 * authored in C# and reused on the client.
 *
 * The registry follows the same register, get and unregister shape as the
 * Actions, Binds, Intents and Services registries. A template id that is not
 * registered resolves against a server rendered <template> element with the
 * same id, whose content is cloned on every render.
 */
webexpress.webapp.Templates = new class {
    /**
     * Creates the registry.
     */
    constructor() {
        this._templates = new Map();
    }

    /**
     * Registers a template render function.
     * @param {string} id - The template id.
     * @param {Function} render - Receives (state, component) and returns a
     * virtual node tree or a DOM node.
     * @returns {this} The registry for chaining.
     */
    register(id, render) {
        if (typeof id === "string" && typeof render === "function") {
            this._templates.set(id, render);
        }
        return this;
    }

    /**
     * Returns a registered template render function.
     * @param {string} id - The template id.
     * @returns {Function|null} The render function or null.
     */
    get(id) {
        return this._templates.get(id) || null;
    }

    /**
     * Removes a registered template.
     * @param {string} id - The template id.
     */
    unregister(id) {
        this._templates.delete(id);
    }

    /**
     * Resolves a template id into a render function. A registered template
     * wins; otherwise a server rendered <template> element with the same id is
     * used, whose content is cloned on every render.
     * @param {string} id - The template id.
     * @returns {Function|null} The render function or null.
     */
    resolve(id) {
        if (!id) {
            return null;
        }

        const registered = this.get(id);

        if (registered) {
            return registered;
        }

        const element = document.getElementById(id);

        if (element && element.tagName === "TEMPLATE") {
            return () => element.content.cloneNode(true);
        }

        return null;
    }

    /**
     * Removes all templates. Useful for tests.
     */
    clear() {
        this._templates.clear();
    }
};
