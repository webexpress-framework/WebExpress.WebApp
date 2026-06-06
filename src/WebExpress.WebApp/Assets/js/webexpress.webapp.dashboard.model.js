var webexpress = webexpress || {}
webexpress.webapp = webexpress.webapp || {}

/**
 * Pure model helpers for the REST dashboard control (View, State and Service
 * migration). These functions carry no DOM or network dependency, so they can
 * be unit tested in isolation. The control composes them with a RestService:
 * the load is fetched through the shared request (it keeps its own abort and
 * loading state), the columns are normalised through the model and the layout
 * state is persisted with the service update.
 *
 * See WebExpress.WebApp/docs/architecture/view-state-service.md.
 */
webexpress.webapp.dashboardModel = {
    /**
     * Builds the legacy service descriptor used when the host element does not
     * carry a data-wx-service island. The dashboard is loaded with GET and the
     * layout state is persisted with PUT.
     * @param {string} uri - The REST endpoint backing the dashboard.
     * @returns {object} A rest service descriptor.
     */
    legacyDescriptor(uri) {
        return { name: "data", kind: "rest", baseUri: uri || "", method: "GET", updateMethod: "PUT" };
    },

    /**
     * Normalises a dashboard response into its columns and widgets, assigning a
     * fresh instance id to each widget. Returns null when the response carries no
     * columns, so the caller can leave the current layout untouched, which
     * matches the historical behaviour.
     * @param {object} data - The raw dashboard response.
     * @returns {Array<object>|null} The normalised columns, or null.
     */
    normalizeColumns(data) {
        if (!data || !data.columns) {
            return null;
        }

        return data.columns.map((col) => ({
            id: col.id,
            label: col.label || "",
            size: col.size || "1fr",
            widgets: (col.widgets || []).map((w, i) => ({
                instanceId: "wx_inst_" + col.id + "_" + i + "_" + Date.now(),
                id: w.id,
                label: w.label || null,
                icon: w.icon || null,
                image: w.image || null,
                color: w.color || null,
                removable: w.removable !== false,
                movable: w.movable !== false,
                html: w.html || "",
                params: w.params || {}
            }))
        }));
    }
};
