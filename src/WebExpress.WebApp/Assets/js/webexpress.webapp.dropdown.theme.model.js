var webexpress = webexpress || {}
webexpress.webapp = webexpress.webapp || {}

/**
 * Pure model helpers for the theme dropdown control (View, State and Service
 * migration). The control loads the themes through the shared request and
 * persists the selection with a form encoded PUT, so the network access stays
 * in the control. The model owns the theme item mapping and the theme list
 * normalisation, which carry no DOM or network dependency and can be unit
 * tested in isolation.
 *
 * See WebExpress.WebApp/docs/architecture/view-state-service.md.
 */
webexpress.webapp.dropdownThemeModel = {
    /**
     * Maps a raw API theme item to the structure the base DropdownCtrl renderer
     * expects. Inactive themes use a javascript:void(0) uri to suppress default
     * navigation; the reload is triggered after the PUT succeeds.
     * @param {object} apiItem - The raw API item.
     * @returns {object} The normalised menu item.
     */
    mapItem(apiItem) {
        const id = apiItem && apiItem.id ? String(apiItem.id) : null;
        const text = (apiItem && (apiItem.content || apiItem.name || apiItem.label || apiItem.title)) || id || "";
        return {
            id: id,
            uri: "javascript:void(0);",
            text: text,
            icon: apiItem && apiItem.icon ? apiItem.icon : null,
            image: apiItem && apiItem.image ? apiItem.image : null,
            data: [],
            aria: []
        };
    },

    /**
     * Normalises a themes response into the mapped items and the selected id.
     * The items array is the mapped raw items; the selected id is the non empty
     * string carried in the response, or null.
     * @param {object} json - The raw themes response.
     * @returns {{items: Array<object>, selected: (string|null)}} The themes.
     */
    normalizeThemes(json) {
        const rawItems = Array.isArray(json && json.items) ? json.items : [];
        const items = rawItems.map((it) => this.mapItem(it));
        const selected = (json && typeof json.selected === "string" && json.selected.length > 0)
            ? json.selected
            : null;
        return { items: items, selected: selected };
    }
};
