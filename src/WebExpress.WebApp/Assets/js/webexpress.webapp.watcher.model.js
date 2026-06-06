var webexpress = webexpress || {}
webexpress.webapp = webexpress.webapp || {}

/**
 * Pure model helpers for the watcher control (View, State and Service
 * migration). These functions carry no DOM or network dependency, so they can
 * be unit tested in isolation. The control composes them with a RestService
 * whose query loads the watchers, whose create adds one and whose remove
 * deletes one, plus a shared request for the cross endpoint user search.
 *
 * See WebExpress.WebApp/docs/architecture/view-state-service.md.
 */
webexpress.webapp.watcherModel = {
    /**
     * Builds the legacy service descriptor used when the host element does not
     * carry a data-wx-service island. The watchers are loaded with GET, an
     * watcher is added with POST and removed with DELETE on a path.
     * @param {string} uri - The REST endpoint backing the watcher list.
     * @returns {object} A rest service descriptor.
     */
    legacyDescriptor(uri) {
        return { name: "data", kind: "rest", baseUri: uri || "", method: "GET", updateMethod: "PUT" };
    },

    /**
     * Normalises a watcher list response into an array, tolerating a missing or
     * malformed payload so the renderer always receives a list.
     * @param {*} data - The raw response payload.
     * @returns {Array<object>} The watcher array.
     */
    normalizeList(data) {
        return Array.isArray(data) ? data : [];
    },

    /**
     * Builds the user search url from the users endpoint and a free text query,
     * appending the query parameter with the correct separator and encoding.
     * @param {string} usersUri - The users search endpoint.
     * @param {string} q - The free text query.
     * @returns {string} The request url.
     */
    searchUrl(usersUri, q) {
        const base = usersUri || "";
        const sep = base.includes("?") ? "&" : "?";
        return base + sep + "q=" + encodeURIComponent(q == null ? "" : q);
    },

    /**
     * Returns the search results that are not already watchers, keyed by id.
     * @param {Array<object>} watchers - The current watchers.
     * @param {Array<object>} users - The raw search results.
     * @returns {Array<object>} The users that can still be added.
     */
    candidates(watchers, users) {
        const known = new Set((Array.isArray(watchers) ? watchers : []).map((u) => u.id));
        return (Array.isArray(users) ? users : []).filter((u) => !known.has(u.id));
    },

    /**
     * Builds the delete path segment for a watcher id.
     * @param {string} id - The watcher (user) id.
     * @returns {string} The path appended to the base uri.
     */
    removePath(id) {
        return "/" + encodeURIComponent(id);
    },

    /**
     * Returns the list without the watcher carrying the given id.
     * @param {Array<object>} list - The current watchers.
     * @param {string} id - The id to drop.
     * @returns {Array<object>} A new list without the matching watcher.
     */
    removeById(list, id) {
        return (Array.isArray(list) ? list : []).filter((u) => u.id !== id);
    }
};
