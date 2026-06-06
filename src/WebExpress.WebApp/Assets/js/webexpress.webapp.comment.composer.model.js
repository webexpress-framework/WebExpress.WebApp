var webexpress = webexpress || {}
webexpress.webapp = webexpress.webapp || {}

/**
 * Pure model helpers for the comment composer control (View, State and Service
 * migration). These functions carry no DOM or network dependency, so they can
 * be unit tested in isolation. The control composes them with a RestService:
 * the categories are loaded through the shared request from the categories url,
 * the categories payload is normalised through the model, the labels are parsed
 * through the model and the new comment is posted with the service create.
 *
 * See WebExpress.WebApp/docs/architecture/view-state-service.md.
 */
webexpress.webapp.commentComposerModel = {
    /**
     * Builds the legacy service descriptor used when the host element does not
     * carry a data-wx-service island. The comment is posted with POST against
     * the base uri.
     * @param {string} uri - The REST endpoint backing the comments.
     * @returns {object} A rest service descriptor.
     */
    legacyDescriptor(uri) {
        return { name: "data", kind: "rest", baseUri: uri || "", method: "GET", updateMethod: "PUT" };
    },

    /**
     * Builds the categories url, appending the categories segment with a single
     * separating slash regardless of a trailing slash on the base uri.
     * @param {string} uri - The base comments uri.
     * @returns {string} The categories url.
     */
    categoriesUrl(uri) {
        const base = uri || "";
        const sep = base.endsWith("/") ? "" : "/";
        return base + sep + "categories";
    },

    /**
     * Accepts either an array or an object keyed by category id and returns the
     * canonical object form keyed by id, dropping array entries without an id.
     * @param {Array|Object} input - The raw categories payload.
     * @returns {Object<string, Object>} The categories keyed by id.
     */
    normalizeCategories(input) {
        if (!input) {
            return {};
        }
        if (Array.isArray(input)) {
            const obj = {};
            for (const c of input) {
                if (c && c.id) {
                    obj[c.id] = c;
                }
            }
            return obj;
        }
        return input;
    },

    /**
     * Parses a comma separated label string into a trimmed, non empty list.
     * @param {string} raw - The raw label input value.
     * @returns {Array<string>} The parsed labels.
     */
    parseLabels(raw) {
        return String(raw == null ? "" : raw).split(",").map((s) => s.trim()).filter(Boolean);
    }
};
