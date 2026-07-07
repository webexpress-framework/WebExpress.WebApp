var webexpress = webexpress || {}
webexpress.webapp = webexpress.webapp || {}

/**
 * Pure model helpers for the REST sidebar control. These functions carry no DOM
 * or network dependency, so they can be unit tested in isolation. The control
 * composes them with a Store and a RestService.
 *
 * The server payload is a tree of nodes. A node is projected into the item
 * descriptor shape that the shared WebUI sidebar consumes (webexpress.webui.
 * SidebarCtrl), so hierarchy and badges authored on the server flow straight
 * into the client rendering.
 *
 * See WebExpress.WebApp/docs/architecture/view-state-service.md.
 */
webexpress.webapp.sidebarModel = {
    /**
     * Maps a server response into the sidebar item descriptors. The response
     * may be a bare array of nodes or an object carrying an items array, which
     * matches both the plain and the paged endpoint shapes.
     * @param {object|Array} response - The raw server payload.
     * @returns {Array<object>} The normalised item descriptors.
     */
    mapItems(response) {
        const source = Array.isArray(response)
            ? response
            : (response && Array.isArray(response.items))
                ? response.items
                : [];

        return source
            .map((node) => this._mapNode(node))
            .filter((descriptor) => descriptor !== null);
    },

    /**
     * Projects a single server node into an item descriptor, recursing into the
     * node's children. A string node becomes a plain link, a typed node becomes
     * a header or a divider, and everything else becomes a navigable item.
     * @param {*} node - The raw server node.
     * @returns {object|null} The descriptor, or null when the node is unusable.
     */
    _mapNode(node) {
        if (node == null) {
            return null;
        }

        if (typeof node === "string") {
            return { type: "item", label: node, mode: "hide", children: [] };
        }

        if (typeof node !== "object") {
            return null;
        }

        const type = this._typeOf(node);

        if (type === "header") {
            return { type: "header", label: this._labelOf(node), mode: "hide" };
        }

        if (type === "divider") {
            return { type: "divider", mode: "hide" };
        }

        // a badge value of 0 is preserved so a server that reports a real zero
        // keeps control of what shows; a server suppresses the badge by omitting it
        const badge = node.badge != null ? node.badge : (node.count != null ? node.count : null);

        return {
            type: "item",
            id: node.id != null ? node.id : null,
            label: this._labelOf(node),
            iconClass: node.icon || null,
            iconImg: node.image || null,
            link: node.uri || node.link || null,
            tooltip: node.tooltip || node.title || null,
            target: node.target || null,
            active: !!node.active,
            disabled: !!node.disabled,
            badge: badge,
            badgeColor: node.badgeColor || node.badgeColour || null,
            badgeStyle: node.badgeStyle || null,
            mode: node.mode || "hide",
            expanded: !!node.expanded,
            children: this.mapItems(node.items || node.children || [])
        };
    },

    /**
     * Resolves the logical type of a node, tolerating both an explicit type
     * string and the boolean flags a terser payload may use.
     * @param {object} node - The raw server node.
     * @returns {"header"|"divider"|"item"} The logical type.
     */
    _typeOf(node) {
        const type = (node.type || "").toString().toLowerCase();

        if (type === "header" || node.header === true) {
            return "header";
        }

        if (type === "divider" || type === "separator" || node.divider === true || node.separator === true) {
            return "divider";
        }

        return "item";
    },

    /**
     * Resolves the display label from the several names a payload may carry.
     * @param {object} node - The raw server node.
     * @returns {string} The label, or an empty string.
     */
    _labelOf(node) {
        if (node.label != null) {
            return node.label;
        }
        if (node.text != null) {
            return node.text;
        }
        if (node.name != null) {
            return node.name;
        }
        return "";
    }
};
