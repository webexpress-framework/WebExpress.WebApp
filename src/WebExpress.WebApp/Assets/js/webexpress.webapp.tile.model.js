var webexpress = webexpress || {}
webexpress.webapp = webexpress.webapp || {}

/**
 * Pure model helpers for the REST tile control (View, State and Service
 * migration). These functions carry no DOM or network dependency, so they can
 * be unit tested in isolation. The control composes them with a RestService:
 * the load is fetched through the shared request (it keeps its own abort and
 * loading state), the page is reduced and the items are mapped through the
 * model, and the state is persisted with the service update.
 *
 * See WebExpress.WebApp/docs/architecture/view-state-service.md.
 */
webexpress.webapp.tileModel = {
    /**
     * Builds the legacy service descriptor used when the host element does not
     * carry a data-wx-service island. The tiles are loaded with GET and the
     * state is persisted with PUT.
     * @param {string} uri - The REST endpoint backing the tiles.
     * @returns {object} A rest service descriptor.
     */
    legacyDescriptor(uri) {
        return { name: "data", kind: "rest", baseUri: uri || "", method: "GET", updateMethod: "PUT" };
    },

    /**
     * Caps the received items to a single page, returning the array unchanged
     * when it already fits and tolerating a missing or malformed list.
     * @param {Array<object>} items - The received items.
     * @param {number} pageSize - The page size.
     * @returns {Array<object>} The items capped to the page size.
     */
    sliceItems(items, pageSize) {
        let list = Array.isArray(items) ? items : [];
        if (typeof pageSize === "number" && pageSize >= 0 && list.length > pageSize) {
            list = list.slice(0, pageSize);
        }
        return list;
    },

    /**
     * Determines the total record count, preferring an explicit total from the
     * response and otherwise inferring it from the page, the page size and the
     * number of received rows.
     * @param {object} response - The raw response.
     * @param {number} receivedItems - The number of rows on this page.
     * @param {number} page - The zero based page index.
     * @param {number} pageSize - The page size.
     * @returns {number} The total record count.
     */
    reduceTotal(response, receivedItems, page, pageSize) {
        const total = response ? (response.total ?? null) : null;
        if (total !== null && total !== undefined) {
            return Number(total) || 0;
        }
        return (page * pageSize) + receivedItems;
    },

    /**
     * Maps the response items to the internal tile shape, projecting the many
     * accepted field aliases and defaulting the visibility to true.
     * @param {object} response - The raw response containing items.
     * @returns {Array<object>} The mapped tiles.
     */
    mapTiles(response) {
        const items = (response && Array.isArray(response.items)) ? response.items : [];
        return items.map((item) => {
            let isVisible = true;
            if (typeof item.visible === "boolean") {
                isVisible = item.visible;
            }

            let opts = null;
            if (Array.isArray(item.options)) {
                opts = item.options;
            }

            return {
                id: item.id || null,
                label: item.label || item.title || item.name || "",
                html: item.text || item.description || item.content || null,
                class: item.class || null,
                icon: item.icon || null,
                image: item.image || null,
                colorCss: item.colorCss || item.color || null,
                colorStyle: item.colorStyle || item.style || null,
                visible: isVisible,
                primaryAction: item.primaryAction || null,
                secondaryAction: item.secondaryAction || null,
                bind: item.bind || null,
                options: opts,
                _lc_id: null,
                _lc_label: null
            };
        });
    }
};
