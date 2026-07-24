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
            color: col.color || null,
            // an optional trailing badge (e.g. the widget count), coloured either
            // by a css class (system color) or an inline style
            badge: col.badge != null ? String(col.badge) : null,
            badgeColor: col.badgeColor || null,
            badgeStyle: col.badgeStyle || null,
            widgets: (col.widgets || []).map((w, i) => ({
                instanceId: "wx_inst_" + col.id + "_" + i + "_" + Date.now(),
                id: w.id,
                // the widget name is authored either as title or label; carry both
                // so the card header and the settings dialog show the same value
                title: w.title || w.label || null,
                label: w.label || w.title || null,
                icon: w.icon || null,
                image: w.image || null,
                color: w.color || null,
                removable: w.removable !== false,
                movable: w.movable !== false,
                // an optional trailing badge in the widget header (e.g. an item count)
                badge: w.badge != null ? String(w.badge) : null,
                badgeColor: w.badgeColor || null,
                badgeStyle: w.badgeStyle || null,
                html: w.html || "",
                params: w.params || {}
            }))
        }));
    },

    /**
     * Normalises the widget types the server offers for adding into a plain list
     * of { id, title, icon, description }. The server owns which widgets a board
     * may use; the client resolves the render and any missing display metadata
     * from its widget registry. A missing list yields an empty array.
     * @param {object} data - The raw dashboard response.
     * @returns {Array<object>} The available widget descriptors.
     */
    normalizeAvailableWidgets(data) {
        const list = data && Array.isArray(data.availableWidgets) ? data.availableWidgets : [];

        return list
            .filter((widget) => widget && widget.id)
            .map((widget) => ({
                id: widget.id,
                title: widget.title || null,
                icon: widget.icon || null,
                description: widget.description || null
            }));
    }
};
