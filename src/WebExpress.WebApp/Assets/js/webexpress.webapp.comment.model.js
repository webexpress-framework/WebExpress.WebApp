var webexpress = webexpress || {}
webexpress.webapp = webexpress.webapp || {}

/**
 * Pure model helpers for the REST comment control (phase two of the View, State
 * and Service migration). These functions carry no DOM dependency, so they can
 * be unit tested in isolation. They cover the endpoint url and path building
 * and the category normalisation. The control composes them with a Store and a
 * RestService whose request, create, update and remove operations replace the
 * nine inline fetch calls (categories, comments, users, edit, delete, like,
 * pin, reaction, reply).
 *
 * See WebExpress.WebApp/docs/architecture/view-state-service.md.
 */
webexpress.webapp.commentModel = {
    /**
     * Builds the service descriptor for the comment endpoint. The id is carried
     * in the path, not the query, so only the base uri is configured. PUT is
     * used for the edit operation.
     * @param {string} uri - The REST endpoint backing the comments.
     * @returns {object} A rest service descriptor.
     */
    legacyDescriptor(uri) {
        return { name: "data", kind: "rest", baseUri: uri || "", method: "GET", updateMethod: "PUT" };
    },

    /**
     * Accepts either an array of category descriptors or an object keyed by
     * category id and returns the canonical object form keyed by id.
     * @param {Array|object} input - The category set.
     * @returns {object} The categories keyed by id.
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
     * Builds the categories url, joining the base uri and the categories
     * segment with a single slash, matching the historical behaviour.
     * @param {string} uri - The comment endpoint.
     * @returns {string} The categories url.
     */
    categoriesUrl(uri) {
        const sep = uri.endsWith("/") ? "" : "/";
        return uri + sep + "categories";
    },

    /**
     * Builds the users preload url, appending the comma separated, encoded ids
     * to the users endpoint and respecting an existing query string.
     * @param {string} usersUri - The users endpoint.
     * @param {Array<string>} ids - The user ids to load.
     * @returns {string} The users url.
     */
    buildUsersUrl(usersUri, ids) {
        const sep = usersUri.includes("?") ? "&" : "?";
        return usersUri + sep + "ids=" + ids.map(encodeURIComponent).join(",");
    },

    /**
     * Builds the path of a single comment relative to the base uri, encoding the
     * id, matching the historical behaviour.
     * @param {string} id - The comment id.
     * @returns {string} The comment path.
     */
    commentPath(id) {
        return "/" + encodeURIComponent(id);
    },

    /**
     * Builds the path of a comment sub resource (likes, pin, reactions or
     * replies) relative to the base uri, encoding the id.
     * @param {string} id - The comment id.
     * @param {string} sub - The sub resource segment.
     * @returns {string} The sub resource path.
     */
    commentSubPath(id, sub) {
        return "/" + encodeURIComponent(id) + "/" + sub;
    }
};
