var webexpress = webexpress || {}
webexpress.webapp = webexpress.webapp || {}

/**
 * Pure model helpers for the watcher control (View, State and Service
 * migration). These functions carry no DOM or network dependency, so they can
 * be unit tested in isolation. The control composes them with a RestService
 * whose query loads the watchers, whose create adds one and whose remove
 * deletes one, plus a second users service for the candidate search.
 *
 * See WebExpress.WebApp/docs/architecture/view-state-service.md.
 */
webexpress.webapp.watcherModel = {
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
