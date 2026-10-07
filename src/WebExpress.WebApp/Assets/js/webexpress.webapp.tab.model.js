var webexpress = webexpress || {}
webexpress.webapp = webexpress.webapp || {}

/**
 * Pure model helpers for the REST tab control (phase two of the View, State and
 * Service migration). These functions carry no DOM or network dependency, so
 * they can be unit tested in isolation. The control composes them with a Store
 * and a RestService whose query, create, update and remove operations replace
 * the four inline fetch calls (list, create, reorder, close).
 *
 * See WebExpress/docs/view-state-service.md.
 */
webexpress.webapp.tabModel = {
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
     * Builds the request body for renaming a tab.
     * @param {string} id - The id of the renamed tab.
     * @param {string} label - The new label.
     * @returns {object} The rename body.
     */
    renameBody(id, label) {
        return { action: "rename", id: id, label: label };
    },

    // the colors the tab menu offers; RestApiTab accepts any #rrggbb value
    COLOR_PALETTE: [
        "#0d6efd", "#6610f2", "#6f42c1", "#d63384", "#dc3545", "#fd7e14",
        "#ffc107", "#198754", "#20c997", "#0dcaf0", "#6c757d", "#343a40"
    ],

    /**
     * Builds the request body for changing the color of a tab.
     * @param {string} id - The id of the tab.
     * @param {string|null} color - The new color, or null for none.
     * @returns {object} The color body.
     */
    colorBody(id, color) {
        return { action: "color", id: id, color: color };
    },

    // the server default of RestApiTab.MaxLabelLength; a longer label is refused there
    MAX_LABEL_LENGTH: 200,

    /**
     * Normalizes a label typed into the rename field. Control characters, which
     * the server refuses, turn into spaces, since a pasted tab or line break was
     * meant as a gap. A label that is empty after trimming is rejected, because
     * a tab without a name cannot be told apart from its neighbours.
     * @param {string|null|undefined} raw - The raw input value.
     * @returns {string|null} The trimmed label, or null when it is unusable.
     */
    normalizeLabel(raw) {
        const label = Array.from(String(raw ?? ""))
            .map(ch => (ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127) ? " " : ch)
            .join("")
            .trim();
        return label !== "" ? label : null;
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
