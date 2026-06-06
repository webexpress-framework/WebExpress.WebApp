var webexpress = webexpress || {}
webexpress.webapp = webexpress.webapp || {}

/**
 * Pure model helpers for the REST tab control (phase two of the View, State and
 * Service migration). These functions carry no DOM or network dependency, so
 * they can be unit tested in isolation. The control composes them with a Store
 * and a RestService whose query, create, update and remove operations replace
 * the four inline fetch calls (list, create, reorder, close).
 *
 * See WebExpress.WebApp/docs/architecture/view-state-service.md.
 */
webexpress.webapp.tabModel = {
    /**
     * Builds the legacy service descriptor used when the host element does not
     * carry a data-wx-service island. All four operations target the same
     * endpoint; the id query parameter is used by the close (delete) operation.
     * @param {string} restUri - The REST endpoint backing the tabs.
     * @returns {object} A rest service descriptor.
     */
    legacyDescriptor(restUri) {
        return {
            name: "data",
            kind: "rest",
            baseUri: restUri || "",
            method: "GET",
            updateMethod: "PUT",
            query: { id: "id" },
            response: { items: "items" }
        };
    },

    /**
     * Extracts the tab list from the server response.
     * @param {object} response - The raw server response.
     * @returns {Array<object>} The tab items, or an empty array.
     */
    mapTabs(response) {
        return (response && Array.isArray(response.items)) ? response.items : [];
    },

    /**
     * Builds the request body for creating a new tab.
     * @param {string|null} templateId - The optional template id.
     * @returns {object} The create body.
     */
    createBody(templateId) {
        return { action: "create", templateId: templateId };
    },

    /**
     * Builds the request body for persisting a new tab order.
     * @param {Array<string>} order - The ordered tab ids.
     * @returns {object} The reorder body.
     */
    reorderBody(order) {
        return { action: "reorder", order: order };
    },

    /**
     * Extracts the created tab from a create response, applying the requested
     * template id when the server did not echo it. Returns null when the
     * response does not carry a new tab.
     * @param {object} response - The create response.
     * @param {string|null} templateId - The requested template id.
     * @returns {object|null} The new tab, or null.
     */
    extractNewTab(response, templateId) {
        const newTab = response && response.newTab;
        if (!newTab) {
            return null;
        }
        if (!newTab.templateId && templateId) {
            newTab.templateId = templateId;
        }
        return newTab;
    },

    /**
     * Parses a raw multiplicity attribute into a non negative integer or null
     * when it is unset or invalid (which is treated as unlimited).
     * @param {string|null|undefined} raw - The raw multiplicity value.
     * @returns {number|null} The parsed multiplicity.
     */
    parseMultiplicity(raw) {
        if (raw === undefined || raw === null || raw === "") {
            return null;
        }
        const parsed = parseInt(raw, 10);
        return (!isNaN(parsed) && parsed >= 0) ? parsed : null;
    },

    /**
     * Determines whether another tab may be created from the given template.
     * A template without a defined multiplicity is treated as unlimited.
     * @param {object|null|undefined} template - The template definition.
     * @param {number} count - The number of existing tabs of this template.
     * @returns {boolean} True when another tab may be created.
     */
    isTemplateAvailable(template, count) {
        if (!template) {
            return true;
        }
        if (template.multiplicity === null || template.multiplicity === undefined) {
            return true;
        }
        return count < template.multiplicity;
    }
};
