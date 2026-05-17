/**
 * Theme picker rendered as a standalone dropdown. Extends
 * webexpress.webui.DropdownCtrl with the persistence semantics required by
 * webexpress.webapp.WebRestApi.RestApiTheme:
 *
 * - On initialisation fetches the theme list via GET <data-uri>; the
 *   response is the same { items, selected } envelope RestApiTheme emits.
 * - The selected theme (or the first item when nothing is selected
 *   server-side) is mirrored as the dropdown's button label so exactly one
 *   theme is always visible to the user.
 * - Clicking a menu item PUTs v=<themeId> to the same REST endpoint and
 *   reloads the page once the server has updated the wx-theme cookie. The
 *   reload lets VisualTreeWebApp.UseThemeFromRequest pick the new cookie
 *   up server-side and re-render with the chosen theme.
 *
 * Registered under the class selector wx-webapp-dropdown-theme.
 */
webexpress.webapp.DropdownTheme = class extends webexpress.webui.DropdownCtrl {
    /**
     * Construct the controller and trigger the initial theme fetch.
     * @param {HTMLElement} element - the host DOM element.
     */
    constructor(element) {
        super(element);

        // configuration
        this._apiEndpoint = element.dataset.uri || null;
        this._reloadOnChange = element.dataset.reloadOnChange !== "false";

        // currently active theme id (mirrors the wx-theme cookie); used both
        // for the dropdown label and to suppress no-op PUTs when the user
        // re-selects the already active theme.
        this._activeId = null;

        // attach a single delegated click listener; each item click bubbles
        // up CLICK_EVENT via the base _createMenuItem listener.
        this._element.addEventListener(webexpress.webui.Event.CLICK_EVENT, (e) => {
            const item = e && e.detail && e.detail.item ? e.detail.item : null;
            if (!item || !item.id) {
                return;
            }
            if (item.id === this._activeId) {
                return;
            }
            this._persistSelection(item.id, item.text || this._label);
        });

        // request the theme list as soon as the controller is constructed.
        if (this._apiEndpoint) {
            this._fetchThemes().catch((err) => {
                console.error("failed to fetch theme list:", err);
            });
        }
    }

    /**
     * Fetches the theme list from the configured endpoint and populates the
     * dropdown menu. Marks the cookie-selected theme as the dropdown label
     * so the user can always see which theme is active.
     * @returns {Promise<void>}
     */
    async _fetchThemes() {
        const res = await fetch(this._apiEndpoint, {
            method: "GET",
            headers: { "Accept": "application/json" },
            credentials: "same-origin"
        });
        if (!res.ok) {
            throw new Error("http error " + res.status);
        }

        const json = await res.json();
        const rawItems = Array.isArray(json && json.items) ? json.items : [];
        const selected = (json && typeof json.selected === "string" && json.selected.length > 0)
            ? json.selected
            : null;

        // map each raw item to the structure the base DropdownCtrl renderer
        // expects (see _createMenuItem in webexpress.webui.dropdown.js).
        const items = rawItems.map((it) => this._mapItem(it));

        // pick the active theme: cookie selection wins, otherwise the first
        // item is chosen so the dropdown is never blank.
        const fallback = items.length > 0 ? items[0].id : null;
        this._activeId = selected || fallback;

        // re-render with the live items and the active theme as the label.
        const activeItem = items.find((it) => it.id === this._activeId) || null;
        this._items = items;
        this._label = (activeItem && activeItem.text) ? activeItem.text : this._label;
        this.render();
    }

    /**
     * Maps a raw API item (id, name/content, description, image, …) to the
     * structure consumed by webexpress.webui.DropdownCtrl._createMenuItem.
     * Inactive themes use a javascript:void(0) uri to suppress default
     * navigation; the actual reload is triggered after the PUT succeeds.
     * @param {Object} apiItem - raw API item.
     * @returns {Object} normalised menu item.
     */
    _mapItem(apiItem) {
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
    }

    /**
     * Sends the chosen theme id to the REST endpoint via PUT and reloads
     * the page once the server has updated the cookie.
     * @param {string} themeId - id chosen by the user.
     * @param {string} themeLabel - label to surface as the dropdown text while waiting.
     * @returns {void}
     */
    _persistSelection(themeId, themeLabel) {
        if (!this._apiEndpoint || !themeId) {
            return;
        }

        // optimistically update the dropdown label so the click feels
        // responsive even before the reload finishes.
        this._activeId = themeId;
        this.label = themeLabel || this._label;

        const body = new URLSearchParams();
        body.set("v", themeId);

        fetch(this._apiEndpoint, {
            method: "PUT",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: body.toString(),
            credentials: "same-origin"
        }).then((res) => {
            if (!res.ok) {
                console.error(`theme persistence failed: http ${res.status}`);
                return;
            }
            if (this._reloadOnChange && typeof window !== "undefined") {
                window.location.reload();
            }
        }).catch((err) => {
            console.error("the theme could not be persisted:", err);
        });
    }
};

// register the class in the controller
webexpress.webui.Controller.registerClass("wx-webapp-dropdown-theme", webexpress.webapp.DropdownTheme);
