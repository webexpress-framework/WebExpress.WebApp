var webexpress = webexpress || {}
webexpress.webapp = webexpress.webapp || {}

/**
 * Pure model helpers for the scrum backlog control (View, State and Service
 * migration). These functions carry no DOM or network dependency, so they can
 * be unit tested in isolation. The control composes them with a RestService:
 * the query loads sprints and items, the create adds a sprint, the update
 * persists a sprint or an item rank on a path and the remove deletes a sprint.
 * The remaining helpers are the pure ranking, sorting and move classification
 * logic that the control delegates to.
 *
 * See WebExpress.WebApp/docs/architecture/view-state-service.md.
 */
webexpress.webapp.scrumBacklogModel = {
    /**
     * Builds the legacy service descriptor used when the host element does not
     * carry a data-wx-service island. The board is loaded with GET and changes
     * are persisted with POST (create), PUT (update) and DELETE on a path.
     * @param {string} uri - The REST endpoint backing the backlog.
     * @returns {object} A rest service descriptor.
     */
    legacyDescriptor(uri) {
        return { name: "data", kind: "rest", baseUri: uri || "", method: "GET", updateMethod: "PUT" };
    },

    /**
     * Normalises a board response into its sprints and items, tolerating a
     * missing or malformed payload so the renderer always receives arrays.
     * @param {object} data - The raw board response.
     * @returns {{sprints: Array<object>, items: Array<object>}} The arrays.
     */
    normalizeData(data) {
        return {
            sprints: Array.isArray(data && data.sprints) ? data.sprints : [],
            items: Array.isArray(data && data.items) ? data.items : []
        };
    },

    /**
     * Applies the default fields to a sprint without losing any caller supplied
     * field, matching the historical addSprint behaviour.
     * @param {object} sprint - The sprint to normalise.
     * @returns {object} The normalised sprint.
     */
    normalizeSprint(sprint) {
        sprint = sprint || {};
        return Object.assign({
            id: sprint.id || ("sp_" + Date.now()),
            name: sprint.name || "",
            goal: sprint.goal || "",
            status: sprint.status || "planned",
            start: sprint.start || null,
            end: sprint.end || null,
            capacity: typeof sprint.capacity === "number" ? sprint.capacity : 0
        }, sprint);
    },

    /**
     * Builds the path segment used to update or delete a sprint by id.
     * @param {string} id - The sprint id.
     * @returns {string} The path appended to the base uri.
     */
    sprintPath(id) {
        return "/sprints/" + encodeURIComponent(id);
    },

    /**
     * Builds the path segment used to persist a single item rank.
     * @param {string} id - The item id.
     * @returns {string} The path appended to the base uri.
     */
    itemRankPath(id) {
        return "/items/" + encodeURIComponent(id) + "/rank";
    },

    /**
     * Returns the path segment for the optional batch rank endpoint.
     * @returns {string} The path appended to the base uri.
     */
    rankBatchPath() {
        return "/items/rank-batch";
    },

    /**
     * Builds the request body for a single item rank update.
     * @param {object} item - The item carrying sprintId and rank.
     * @returns {{sprintId: (string|null), rank: *}} The body.
     */
    itemRankBody(item) {
        return { sprintId: (item && item.sprintId) || null, rank: item ? item.rank : undefined };
    },

    /**
     * Builds the request body for a batched item rank update.
     * @param {Array<object>} items - The items to persist.
     * @returns {{ranks: Array<object>}} The body.
     */
    rankBatchBody(items) {
        return {
            ranks: (Array.isArray(items) ? items : []).map((i) => ({
                id: i.id,
                sprintId: i.sprintId || null,
                rank: i.rank
            }))
        };
    },

    /**
     * Returns the items belonging to a sprint group sorted by rank, then by a
     * stable key/title fallback. The backlog group (sprintId null) also collects
     * items without a sprint or marked as backlog.
     * @param {Array<object>} items - All items.
     * @param {string|null} sprintId - The sprint id, or null for the backlog.
     * @returns {Array<object>} The filtered and sorted items.
     */
    itemsForSprintSorted(items, sprintId) {
        const sid = sprintId || null;
        const out = (Array.isArray(items) ? items : []).filter((i) => {
            return (i.sprintId || null) === sid || (sid === null && (!i.sprintId || i.status === "backlog"));
        });

        out.sort((a, b) => {
            const ra = typeof a.rank === "number" ? a.rank : Number.MAX_SAFE_INTEGER;
            const rb = typeof b.rank === "number" ? b.rank : Number.MAX_SAFE_INTEGER;
            if (ra !== rb) {
                return ra - rb;
            }
            const ka = String(a.key || a.title || "");
            const kb = String(b.key || b.title || "");
            return ka.localeCompare(kb);
        });

        return out;
    },

    /**
     * Rewrites ranks sequentially for a sprint group, assigning the sprintId and
     * a one based rank to each item in order. Mutates the passed items.
     * @param {string|null} sprintId - The sprint id, or null for the backlog.
     * @param {Array<object>} orderedItems - The items in their target order.
     * @returns {Array<object>} The same items, for chaining.
     */
    rewriteRanks(sprintId, orderedItems) {
        let rank = 1;
        for (const it of (Array.isArray(orderedItems) ? orderedItems : [])) {
            it.sprintId = sprintId || null;
            it.rank = rank++;
        }
        return orderedItems;
    },

    /**
     * Determines whether moving the given items to a target sprint would enter
     * or leave the active sprint. A pure reorder within (or completely outside)
     * the active sprint returns false.
     * @param {Array<object>} items - The items being moved.
     * @param {string|null} targetSprintId - The destination sprint, or null.
     * @param {string|null} activeId - The id of the active sprint, or null.
     * @returns {boolean} True when the move crosses the active sprint boundary.
     */
    crossesActiveSprint(items, targetSprintId, activeId) {
        if (!activeId) {
            return false;
        }
        const targetIsActive = targetSprintId === activeId;
        for (const it of (Array.isArray(items) ? items : [])) {
            const sourceIsActive = (it.sprintId || null) === activeId;
            if (sourceIsActive !== targetIsActive) {
                return true;
            }
        }
        return false;
    }
};
