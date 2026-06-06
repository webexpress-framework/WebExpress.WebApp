var webexpress = webexpress || {}
webexpress.webapp = webexpress.webapp || {}

/**
 * Pure model helpers for the REST kanban control (phase two of the View, State
 * and Service migration). These functions carry no DOM or network dependency,
 * so they can be unit tested in isolation. The control composes them with a
 * Store and a RestService whose query loads the board and whose update persists
 * card moves and column changes.
 *
 * See WebExpress.WebApp/docs/architecture/view-state-service.md.
 */
webexpress.webapp.kanbanModel = {
    /**
     * Builds the legacy service descriptor used when the host element does not
     * carry a data-wx-service island. The board is loaded with GET and state
     * changes are persisted with PUT.
     * @param {string} restUri - The REST endpoint backing the board.
     * @returns {object} A rest service descriptor.
     */
    legacyDescriptor(restUri) {
        return { name: "data", kind: "rest", baseUri: restUri || "", method: "GET", updateMethod: "PUT" };
    },

    /**
     * Normalises a board response into the internal columns, swimlanes and
     * cards. Only the parts present in the response are returned, so that a
     * partial update leaves the other parts of the board untouched, which
     * matches the historical behaviour.
     * @param {object} data - The raw board response.
     * @returns {object} An object with the present columns, swimlanes and cards.
     */
    normalizeBoard(data) {
        data = data || {};
        const out = {};

        if (data.columns) {
            out.columns = data.columns.map((col) => ({
                id: col.id,
                label: col.label,
                size: col.size || "1fr"
            }));
        }

        if (data.swimlanes) {
            out.swimlanes = data.swimlanes.map((lane) => ({
                id: lane.id,
                label: lane.label,
                expanded: lane.expanded !== false
            }));
        }

        if (data.items) {
            out.cards = data.items.map((item) => ({
                id: item.id,
                columnId: item.columnId,
                swimlaneId: item.swimlaneId,
                label: item.label || "",
                html: item.html || "",
                colorCss: item.colorCss || "",
                icon: item.icon || null,
                image: item.image || null,
                primaryAction: item.primaryAction || {},
                secondaryAction: item.secondaryAction || {}
            }));
        }

        return out;
    }
};
