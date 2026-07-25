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

        // the board carries the persisted wql filter so the settings dialog seeds
        // its field; a present-but-null filter reads as an empty (cleared) filter
        if (Object.prototype.hasOwnProperty.call(data, "filter")) {
            out.filter = data.filter || "";
        }

        if (data.columns) {
            out.columns = data.columns.map((col) => ({
                id: col.id,
                label: col.label,
                size: col.size || "1fr",
                // the column "…" menu persists a hex accent color; older boards
                // that only carry the legacy colorCss class leave it null
                color: col.color || null,
                // an optional trailing badge (e.g. the card count), coloured
                // either by a css class (system color) or an inline style
                badge: col.badge != null ? String(col.badge) : null,
                badgeColor: col.badgeColor || null,
                badgeStyle: col.badgeStyle || null
            }));
        }

        if (data.swimlanes) {
            out.swimlanes = data.swimlanes.map((lane) => ({
                id: lane.id,
                label: lane.label,
                expanded: lane.expanded !== false,
                // the per-swimlane wql filter, seeded so the settings dialog
                // reflects the current value
                filter: lane.filter || "",
                // the swimlane "…" menu persists a hex accent color, mirroring
                // the column color
                color: lane.color || null,
                // an optional trailing badge (e.g. the lane card count)
                badge: lane.badge != null ? String(lane.badge) : null,
                badgeColor: lane.badgeColor || null,
                badgeStyle: lane.badgeStyle || null
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
                assigneeId: item.assigneeId || null,
                assigneeName: item.assigneeName || null,
                assigneeInitials: item.assigneeInitials || null,
                assigneeColor: item.assigneeColor || null,
                assigneeImage: item.assigneeImage || null,
                badge: item.badge != null ? String(item.badge) : null,
                badgeColor: item.badgeColor || null,
                badgeStyle: item.badgeStyle || null,
                footer: this._normalizeFooter(item.footer),
                primaryAction: item.primaryAction || {},
                secondaryAction: item.secondaryAction || {}
            }));
        }

        return out;
    },

    /**
     * Normalises the optional footer of a card into complete chips, so the
     * renderer never sees partial records; entries without a label and an icon
     * carry no information and are dropped. A chip color arrives either as a
     * CSS class (system color) or an inline style (user-defined color).
     * @param {*} footer - The raw footer array.
     * @returns {Array<object>} The normalised footer chips.
     */
    _normalizeFooter(footer) {
        return (Array.isArray(footer) ? footer : [])
            .map((chip) => ({
                label: (chip && chip.label) || "",
                icon: (chip && chip.icon) || null,
                colorCss: (chip && chip.colorCss) || "",
                colorStyle: (chip && chip.colorStyle) || "",
                title: (chip && chip.title) || ""
            }))
            .filter((chip) => chip.label || chip.icon);
    }
};
