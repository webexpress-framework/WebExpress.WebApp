/**
 * Icon set picker. An icon set is a stylesheet of mask rules linked after the framework
 * rules, so a stored pick is applied by swapping that link - the icons change at once,
 * without the reload a theme needs.
 *
 * Registered under the class selector wx-webapp-dropdown-iconset.
 */
webexpress.webapp.DropdownIconSetCtrl = class extends webexpress.webapp.DropdownThemeCtrl {
    /**
     * Replaces the stylesheet of the previous set by the one of the stored set.
     * @param {string} iconSetId - The stored id.
     */
    _afterPersist(iconSetId) {
        const items = this._items || [];
        const known = new Set(items.map((item) => item.stylesheet).filter(Boolean));

        // the server linked the previous set by its address, so the address identifies it
        for (const link of Array.from(document.querySelectorAll("link[rel='stylesheet']"))) {
            if (known.has(link.getAttribute("href"))) {
                link.remove();
            }
        }

        const chosen = items.find((item) => item.id === iconSetId);
        if (chosen && chosen.stylesheet) {
            // attributes rather than properties, because the swap above finds a sheet by its attribute
            const link = document.createElement("link");
            link.setAttribute("rel", "stylesheet");
            link.setAttribute("href", chosen.stylesheet);
            document.head.appendChild(link);
        }

        document.dispatchEvent(new CustomEvent(webexpress.webapp.DropdownIconSetCtrl.CHANGE_EVENT, {
            detail: { id: iconSetId }
        }));
    }
};

// announces a swapped set, so other switches for the same preference can follow
webexpress.webapp.DropdownIconSetCtrl.CHANGE_EVENT = "webexpress.webapp.iconset.change";

// register the class in the controller
webexpress.webui.Controller.registerClass("wx-webapp-dropdown-iconset", webexpress.webapp.DropdownIconSetCtrl);
