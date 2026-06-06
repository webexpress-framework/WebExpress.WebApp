var webexpress = webexpress || {}
webexpress.webapp = webexpress.webapp || {}

/**
 * Pure model helpers for the REST list control (phase one of the View, State
 * and Service migration). These functions carry no DOM or network dependency,
 * so they can be unit tested in isolation. The control composes them with a
 * Store and a RestService.
 *
 * See WebExpress.WebApp/docs/architecture/view-state-service.md.
 */
webexpress.webapp.listModel = {
    /**
     * Builds the legacy service descriptor used when the host element does not
     * carry a data-wx-service island. It reproduces the historical query
     * parameter names of the list control so that the migration is behaviour
     * preserving until the descriptor is authored in C# in a later phase.
     * @param {string} restUri - The REST endpoint backing the list.
     * @returns {object} A rest service descriptor.
     */
    legacyDescriptor(restUri) {
        return {
            name: "data",
            kind: "rest",
            baseUri: restUri || "",
            method: "GET",
            query: {
                search: "q",
                wql: "wql",
                filter: "f",
                page: "p",
                pageSize: "l",
                orderBy: "o",
                orderDir: "d"
            },
            response: { items: "items", total: "total" }
        };
    },

    /**
     * Builds the logical query parameters from the current state. The order
     * parameters are only included when an order field is set, which matches
     * the historical behaviour.
     * @param {object} state - The list state.
     * @returns {object} The logical query parameters.
     */
    queryParams(state) {
        state = state || {};

        const params = {
            search: state.search || "",
            wql: state.wql || "",
            filter: state.filter || "",
            page: state.page || 0,
            pageSize: state.pageSize || 50
        };

        if (state.orderBy) {
            params.orderBy = state.orderBy;
            if (state.orderDir) {
                params.orderDir = state.orderDir;
            }
        }

        return params;
    },

    /**
     * Reduces a server response into a state patch carrying the paging
     * information and clearing the loading and error flags. The current state
     * provides the fallback values, which matches the historical behaviour.
     * @param {object} state - The current list state.
     * @param {object} response - The raw server response.
     * @returns {object} A state patch.
     */
    reduceResponse(state, response) {
        state = state || {};
        response = response || {};

        const total = Number(response.total ?? response.totalCount ?? response.count ?? 0) || 0;
        const page = Number(response.page ?? state.page ?? 0) || 0;
        const pageSize = Number(response.pageSize ?? state.pageSize ?? 50) || 50;

        return { total: total, page: page, pageSize: pageSize, loading: false, error: null };
    },

    /**
     * Maps a raw server response into the normalised list item structures that
     * the base list control consumes. String items become simple content
     * items, object items are projected field by field.
     * @param {object} response - The raw server response.
     * @returns {Array<object>} The normalised list items.
     */
    mapItems(response) {
        const result = [];

        if (!response || !Array.isArray(response.items)) {
            return result;
        }

        for (const item of response.items) {
            if (typeof item === "string") {
                result.push({ id: null, content: { content: item } });
            } else if (item !== null && typeof item === "object") {
                result.push({
                    id: item.id || null,
                    class: item.class || null,
                    style: item.style || null,
                    color: item.color || null,
                    image: item.image || null,
                    icon: item.icon || null,
                    uri: item.uri || null,
                    target: item.target || null,
                    editable: !!item.editable,
                    rendererType: item.rendererType || item.type || null,
                    rendererOptions: item.rendererOptions || {},
                    content: item.text ?? item.label ?? item.name ?? "",
                    primaryAction: item.primaryAction || null,
                    secondaryAction: item.secondaryAction || null,
                    bind: item.bind || null,
                    options: Array.isArray(item.options) ? item.options : null
                });
            }
        }

        return result;
    }
};
