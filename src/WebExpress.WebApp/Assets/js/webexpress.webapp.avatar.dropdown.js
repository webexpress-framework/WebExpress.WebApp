/**
 * AvatarDropdownCtrl extends WebUI.AvatarDropdownCtrl to fetch items from a REST API.
 *
 * The following events are triggered:
 * - webexpress.webui.Event.CLICK_EVENT
 * - webexpress.webui.Event.CHANGE_VISIBILITY_EVENT
 * - webexpress.webui.Event.DATA_REQUESTED_EVENT
 * - webexpress.webui.Event.DATA_ARRIVED_EVENT
 */
webexpress.webapp.AvatarDropdownCtrl = class extends webexpress.webui.AvatarDropdownCtrl {
    /**
     * Creates a new remote dropdown controller instance.
     * Captures static items from the initial DOM, prepares structure, and fetches initial data.
     * @param {HTMLElement} element - The DOM element associated with the instance.
     */
    constructor(element) {
        super(element);

        // capture static items parsed by base class to append later
        this._staticItems = Array.isArray(this._items) ? this._items.slice(0) : [];

        // read configuration from data-attributes
        this._apiEndpoint = element.dataset.uri || null;
        this._httpMethod = (element.dataset.method || "GET").toUpperCase();
        this._maxItems = Number.isFinite(parseInt(element.dataset.maxitems, 10)) ? parseInt(element.dataset.maxitems, 10) : 25;

        // dynamic items storage
        this._allItems = [];

        // avoid rendering items via base for now; structure will be ensured by _ensurestructure
        this._items = [];

        // internal flags and node references for incremental updates
        this._structureReady = false;
        this._currentDynamicNodes = [];
        this._staticNodes = [];
        this._dynamicStaticDivider = null;
        this._dynamicAnchor = null;

        // initial fetch or initial render (for static-only)
        if (this._apiEndpoint) {
            this._fetchData().catch((err) => {
                console.error("failed to fetch dropdown data:", err);
                this._ensureStructure();
                this._updateDynamicItems([]);
            });
        } else {
            this._ensureStructure();
            this._updateDynamicItems([]);
        }
    }

    /**
     * Helper to create a single menu item LI element.
     * Overrides or polyfills the base class method to ensure action attributes are applied.
     * @param {Object} item - The item data object.
     * @returns {HTMLElement} The constructed LI element containing the link/button.
     */
    _createMenuItem(item) {
        // handle dividers and headers
        if (item.type === "divider") {
            const li = document.createElement("li");
            li.className = "dropdown-divider";

            return li;
        }

        if (item.type === "header") {
            const li = document.createElement("li");
            const h = document.createElement("h6");
            h.className = "dropdown-header";
            h.textContent = item.text || item.content || "";
            li.appendChild(h);

            return li;
        }

        // standard item
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.className = "dropdown-item";
        a.href = item.uri || "#";

        if (item.id) {
            a.id = item.id;
        }

        // apply action attributes
        if (item.primaryAction) {
            for (const [key, value] of Object.entries(item.primaryAction)) {
                if (value) {
                    const htmlName = `data-wx-primary-${key.toLowerCase()}`;
                    a.setAttribute(htmlName, value);
                }
            }
        }

        if (item.secondaryAction) {
            for (const [key, value] of Object.entries(item.secondaryAction)) {
                if (value) {
                    const htmlName = `data-wx-secondary-${key.toLowerCase()}`;
                    a.setAttribute(htmlName, value);
                }
            }
        }

        if (item.color) {
            a.classList.add(item.color);
        }

        if (item.disabled) {
            a.classList.add("disabled");
            a.setAttribute("aria-disabled", "true");
        }

        // add icon
        if (item.icon) {
            const i = document.createElement("i");
            i.className = item.icon;

            if (!i.classList.contains("me-2")) {
                i.classList.add("me-2");
            }

            a.appendChild(i);
        } else if (item.image) {
            const img = document.createElement("img");
            img.src = item.image;
            img.className = "wx-icon me-2";

            a.appendChild(img);
        }

        // add text
        const span = document.createElement("span");
        span.textContent = item.text || item.content || item.label || "";
        a.appendChild(span);

        // add custom data attributes
        if (Array.isArray(item.data)) {
            item.data.forEach(([key, val]) => {
                a.setAttribute(key, val);
            });
        }

        // add click listener from base class logic
        a.addEventListener("click", (e) => {
            // re-use logic from base class if available, or implement standard behavior
            if (typeof this._handleItemClick === "function") {
                this._handleItemClick(e, item, a);
            } else {
                // fallback implementation
                if (item.disabled) {
                    e.preventDefault();
                    return;
                }

                this._dispatch(webexpress.webui.Event.CHANGE_VALUE_EVENT, { value: item.id, item: item });
            }
        });

        li.appendChild(a);

        return li;
    }

    /**
     * Ensures the dropdown DOM structure is present exactly once and stable across updates.
     * Inserts the button/menu, dynamic anchor, static divider, and static items.
     */
    _ensureStructure() {
        if (this._structureReady) {
            return;
        }

        // build base structure
        super.render();

        const ul = this._element.querySelector("ul.dropdown-menu");
        if (!ul) {
            return;
        }

        const fragment = document.createDocumentFragment();

        // dynamic region anchor (invisible marker)
        const anchor = document.createElement("li");
        anchor.className = "wx-dynamic-anchor d-none";
        anchor.setAttribute("aria-hidden", "true");
        fragment.appendChild(anchor);
        this._dynamicAnchor = anchor;

        // divider between dynamic and static (created now, toggled later)
        const dsDivider = document.createElement("li");
        dsDivider.className = "dropdown-divider";
        dsDivider.style.display = "none";
        fragment.appendChild(dsDivider);
        this._dynamicStaticDivider = dsDivider;

        // append static items
        this._staticNodes = [];
        if (Array.isArray(this._staticItems)) {
            for (let i = 0; i < this._staticItems.length; i++) {
                const node = this._createMenuItem(this._staticItems[i]);
                fragment.appendChild(node);
                this._staticNodes.push(node);
            }
        }

        // prepend the constructed fragment to the list
        if (ul.firstChild) {
            ul.insertBefore(fragment, ul.firstChild);
        } else {
            ul.appendChild(fragment);
        }

        this._structureReady = true;
    }

    /**
     * Updates the avatar dom elements with new data without destroying the dropdown menu.
     * @param {string|null} username - the username.
     * @param {string|null} image - the image url.
     */
    _updateAvatarDom(username, image) {
        if (username) {
            this._name = username;
            this._initials = this._deriveInitials(username);

            const button = this._element.querySelector(".wx-avatar-dropdown-toggle");
            if (button) {
                button.setAttribute("aria-label", this._i18n("webexpress.webui:avatar.of", "avatar of") + " " + username);
            }
        }

        const imgEl = this._element.querySelector(".wx-avatar-dropdown-img");
        const fallbackEl = this._element.querySelector(".wx-avatar-dropdown-initials");

        if (imgEl && fallbackEl) {
            if (username) {
                imgEl.alt = username;
                fallbackEl.textContent = this._initials;
            }

            if (image) {
                this._src = image;

                imgEl.onload = () => {
                    imgEl.style.display = "block";
                    fallbackEl.style.display = "none";
                };
                imgEl.onerror = () => {
                    imgEl.style.display = "none";
                    fallbackEl.style.display = "flex";
                };

                imgEl.src = image;

                // show initials until image loads
                fallbackEl.style.display = "flex";
                imgEl.style.display = "none";
            }
        }
    }

    /**
     * Fetches data from the configured REST endpoint and updates the dropdown items.
     * Dispatches DATA_REQUESTED_EVENT before the request and DATA_ARRIVED_EVENT after completion.
     * @returns {Promise<void>} Resolves when data is fetched and the menu updated.
     */
    async _fetchData() {
        // ensure structure exists before async update to avoid layout jumps
        this._ensureStructure();

        if (!this._apiEndpoint) {
            this._updateDynamicItems([]);
            return;
        }

        const startedAt = Date.now();

        // dispatch "requested" event via internal dispatcher
        try {
            this._dispatch(webexpress.webui.Event.DATA_REQUESTED_EVENT, {
                endpoint: this._apiEndpoint,
                method: this._httpMethod
            });
        } catch (e) {
            // noop
        }

        try {
            // build request config
            let url = this._apiEndpoint;
            const init = {
                method: this._httpMethod,
                headers: {}
            };

            if (this._httpMethod === "GET") {
                const params = new URLSearchParams();

                // support dropdown paging hints
                if (typeof this._page === "number" && this._page >= 0) {
                    params.set("p", String(this._page));
                }

                if (typeof this._pageSize === "number" && this._pageSize > 0) {
                    params.set("l", String(this._pageSize));
                } else if (typeof this._max === "number" && this._max > 0) {
                    params.set("m", String(this._max));
                }

                const paramString = params.toString();
                if (paramString) {
                    const hasQuery = url.includes("?");
                    url = url + (hasQuery ? "&" : "?") + paramString;
                }
            }

            const res = await fetch(url, init);

            if (!res.ok) {
                throw new Error("http error " + res.status);
            }

            const json = await res.json();
            const username = json.username || null;
            const image = json.image || null;
            const rawItems = json.items;

            // update the avatar dom elements directly
            this._updateAvatarDom(username, image);

            if (Array.isArray(rawItems)) {
                this._allItems = rawItems.map((x) => {
                    return this._mapApiItem(x);
                });
            } else {
                this._allItems = [];
            }

            // dynamic update without re-rendering the whole menu
            this._applyLimit();

            try {
                const finishedAt = Date.now();
                this._dispatch(webexpress.webui.Event.DATA_ARRIVED_EVENT, {
                    endpoint: this._apiEndpoint,
                    method: this._httpMethod,
                    count: this._allItems.length,
                    durationMs: finishedAt - startedAt,
                    error: null
                });
            } catch (e) {
                // noop
            }
        } catch (err) {
            // on error, clear dynamic items for visual consistency
            this._allItems = [];
            this._applyLimit();

            try {
                const finishedAt = Date.now();
                this._dispatch(webexpress.webui.Event.DATA_ARRIVED_EVENT, {
                    endpoint: this._apiEndpoint,
                    method: this._httpMethod,
                    count: 0,
                    durationMs: finishedAt - startedAt,
                    error: String(err && err.message ? err.message : err)
                });
            } catch (e) {
                // ignore
            }

            console.error("failed to fetch dropdown data:", err);
        }
    }

    /**
     * Maps a raw API item to the internal dropdown item format.
     * @param {any} apiItem - The raw item from the API.
     * @returns {Object} A normalized item compatible with DropdownCtrl._createMenuItem.
     */
    _mapApiItem(apiItem) {
        const id = apiItem.id || null;
        const uri = apiItem.uri || apiItem.url || "javascript:void(0);";
        const text = apiItem.text || apiItem.name || apiItem.label || apiItem.title || "";
        const icon = apiItem.icon || null;
        const image = apiItem.image || apiItem.img || null;
        const color = apiItem.color || null;
        const disabled = Boolean(apiItem.disabled);
        const role = apiItem.role || null;

        const dataTuples = [];

        if (apiItem.data && typeof apiItem.data === "object") {
            Object.keys(apiItem.data).forEach((k) => {
                const key = k.startsWith("data-") ? k : "data-" + k;
                dataTuples.push([key, String(apiItem.data[k])]);
            });
        }

        const ariaTuples = [];

        if (apiItem.aria && typeof apiItem.aria === "object") {
            Object.keys(apiItem.aria).forEach((k) => {
                const key = k.startsWith("aria-") ? k : "aria-" + k;
                ariaTuples.push([key, String(apiItem.aria[k])]);
            });
        }

        return {
            id: id,
            uri: uri,
            image: image,
            icon: icon,
            text: text,
            color: color,
            disabled: disabled,
            data: dataTuples,
            aria: ariaTuples,
            role: role,

            // action attributes to be used by _createMenuItem
            primaryAction: apiItem.primaryAction || null,
            secondaryAction: apiItem.secondaryAction || null,
            bind: apiItem.bind || null
        };
    }

    /**
     * Applies capping to dynamic items and updates the dynamic region only.
     * Also toggles the divider to static items as needed.
     */
    _applyLimit() {
        this._ensureStructure();

        const limited = [];
        let remaining = this._maxItems;

        for (let i = 0; i < this._allItems.length; i++) {
            if (remaining <= 0) {
                break;
            }

            limited.push(this._allItems[i]);
            remaining--;
        }

        this._updateDynamicItems(limited);
    }

    /**
     * Replaces the dynamic items between the dynamic anchor and the dynamic-static divider
     * without re-rendering the entire dropdown structure.
     * @param {Array<any>} items - The dynamic items to render.
     */
    _updateDynamicItems(items) {
        const ul = this._element.querySelector("ul.dropdown-menu");

        if (!ul || !this._dynamicAnchor || !this._dynamicStaticDivider) {
            return;
        }

        // remove previous dynamic nodes efficiently
        if (Array.isArray(this._currentDynamicNodes)) {
            for (let i = 0; i < this._currentDynamicNodes.length; i++) {
                const n = this._currentDynamicNodes[i];
                if (n && n.parentNode === ul) {
                    ul.removeChild(n);
                }
            }
        }

        this._currentDynamicNodes = [];

        // insert new dynamic nodes using a document fragment
        const fragment = document.createDocumentFragment();

        for (let i = 0; i < items.length; i++) {
            const li = this._createMenuItem(items[i]);
            fragment.appendChild(li);
            this._currentDynamicNodes.push(li);
        }

        ul.insertBefore(fragment, this._dynamicStaticDivider);

        // toggle divider visibility depending on presence of dynamic and static
        const hasDynamic = this._currentDynamicNodes.length > 0;
        const hasStatic = this._staticNodes && this._staticNodes.length > 0;

        if (hasDynamic && hasStatic) {
            this._dynamicStaticDivider.style.display = "";
        } else {
            this._dynamicStaticDivider.style.display = "none";
        }
    }
};

// register the class in the controller
webexpress.webui.Controller.registerClass("wx-webapp-avatar-dropdown", webexpress.webapp.AvatarDropdownCtrl);