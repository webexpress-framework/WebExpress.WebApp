/**
 * A control showing the watchers of an object as a row of avatars,
 * with an inline dropdown to add new ones via live search.
 *
 * Each avatar is interactive: hover for the name, click to remove (when the
 * remove-on-click affordance is enabled). The "+" button opens a dropdown
 * with a search input that queries `data-users-uri` and lists candidates.
 *
 * Declarative configuration: the host carries a wx-service island named
 * "data" for the watcher endpoint and an optional second island named
 * "users" for the candidate search.
 *
 * REST contract:
 *   GET  {data}                             → [{ id, name, team, initials, color }]
 *   POST {data}           body { userId }   → { id, name, team, initials, color }
 *   DELETE {data}/{userId}                  → 204
 *   GET  {users}?q=…                        → [{ id, name, team, initials, color }]
 *
 * Events dispatched on the host element:
 *   webexpress.webapp.Event.WATCHER_ADDED_EVENT   detail: { user }
 *   webexpress.webapp.Event.WATCHER_REMOVED_EVENT detail: { user }
 */
webexpress.webapp.WatcherCtrl = class extends webexpress.webapp.Data {
    /**
     * Construct a new WatcherCtrl.
     * @param {HTMLElement} element - host element.
     */
    constructor(element) {
        // resolve the services and the initial state before super, so the
        // Component seeds its store from the optional wx-state island and owns
        // the service map
        const services = webexpress.webapp.ServiceRegistry.fromElement(element);
        const initialState = Object.assign({ watchers: [] }, webexpress.webapp.Data.readState(element));

        super(element, { state: initialState, services: services });

        this._maxVisible = parseInt(element.dataset.maxVisible || "6", 10);
        this._readonly = element.dataset.readonly === "true";
        this._service = this.useService("data");
        this._users = this.useService("users");

        this._dropdownOpen = false;
        this._searchTimer = null;

        // clean host
        element.textContent = "";
        element.removeAttribute("data-max-visible");
        element.removeAttribute("data-readonly");
        element.classList.add("wx-watcher");

        this._buildDom();
        this._attachEventHandlers();

        // subscribe to the store, perform the first render and run onMount
        this.mount();

        // when the server seeded the watchers through the data-wx-state island the
        // first paint needs no round trip; otherwise load them from the endpoint
        if (this._watchers.length === 0) {
            this._load();
        }
    }

    /**
     * The watchers, backed by the component store so the store is the single
     * source of truth and a change triggers a re-render through the subscription.
     * @returns {Array<Object>} The current watchers.
     */
    get _watchers() {
        return this.state.watchers || [];
    }

    set _watchers(value) {
        this.setState({ watchers: value });
    }

    /**
     * Renders the avatar row on the first paint.
     */
    onMount() {
        this._render();
    }

    /**
     * Renders the avatar row whenever the watcher state changes.
     */
    onUpdate() {
        this._render();
    }

    /**
     * Builds the static DOM scaffold (avatar row + add button + dropdown).
     */
    _buildDom() {
        this._row = document.createElement("div");
        this._row.className = "wx-watcher-row";

        this._addBtn = document.createElement("button");
        this._addBtn.type = "button";
        this._addBtn.className = "wx-watcher-add";
        this._addBtn.title = this._i18n("webexpress.webapp:watcher.add", "Add watcher");
        this._addBtn.setAttribute("aria-label", this._addBtn.title);
        this._addBtn.textContent = "+";

        this._dropdown = document.createElement("div");
        this._dropdown.className = "wx-watcher-dropdown";
        this._dropdown.style.display = "none";

        this._searchInput = document.createElement("input");
        this._searchInput.type = "text";
        this._searchInput.className = "wx-watcher-search";
        this._searchInput.placeholder = this._i18n("webexpress.webapp:watcher.search.placeholder", "Search person…");
        this._searchInput.autocomplete = "off";

        this._resultsList = document.createElement("div");
        this._resultsList.className = "wx-watcher-results";

        this._dropdown.appendChild(this._searchInput);
        this._dropdown.appendChild(this._resultsList);

        this._element.appendChild(this._row);
        if (!this._readonly) {
            this._element.appendChild(this._addBtn);
            this._element.appendChild(this._dropdown);
        }
    }

    /**
     * Wires click/keyboard handlers for the add-button, the dropdown search,
     * and the outside-click that closes the dropdown.
     */
    _attachEventHandlers() {
        if (this._readonly) {
            return;
        }

        this._addBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            this._toggleDropdown();
        });

        this._searchInput.addEventListener("input", () => {
            clearTimeout(this._searchTimer);
            this._searchTimer = setTimeout(() => this._search(this._searchInput.value.trim()), 180);
        });

        this._searchInput.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                this._closeDropdown();
            }
        });

        document.addEventListener("mousedown", (e) => {
            if (!this._dropdownOpen) {
                return;
            }
            if (this._dropdown.contains(e.target) || this._addBtn.contains(e.target)) {
                return;
            }
            this._closeDropdown();
        });
    }

    /**
     * Loads watchers from the configured URI and renders them.
     */
    async _load() {
        if (!this._service) {
            this._watchers = [];
            return;
        }
        try {
            const res = await this._service.query({});
            if (!res.ok) throw new Error(res.error ? res.error.message : String(res.status));
            this._watchers = webexpress.webapp.watcherModel.normalizeList(res.data);
        } catch (e) {
            console.warn("WatcherCtrl: load failed", e);
            this._watchers = [];
        }
    }

    /**
     * Renders the avatar row from `this._watchers`.
     */
    _render() {
        this._row.replaceChildren();
        const visible = this._watchers.slice(0, this._maxVisible);
        const overflow = this._watchers.length - visible.length;

        for (const u of visible) {
            this._row.appendChild(this._makeAvatar(u));
        }
        if (overflow > 0) {
            const more = document.createElement("span");
            more.className = "wx-watcher-more";
            more.textContent = "+" + overflow;
            more.title = this._watchers.slice(this._maxVisible).map(u => u.name).join(", ");
            this._row.appendChild(more);
        }
    }

    /**
     * Builds a single avatar element for a user.
     * Click on the avatar removes the watcher (unless readonly).
     * @param {Object} user - The user record.
     * @returns {HTMLElement}
     */
    _makeAvatar(user) {
        const av = document.createElement("button");
        av.type = "button";
        av.className = "wx-watcher-avatar";
        av.title = user.name + (user.team ? " · " + user.team : "");
        av.setAttribute("aria-label", av.title);
        av.style.background = user.color || "#888";
        av.textContent = user.initials || (user.name || "?").slice(0, 2).toUpperCase();
        if (!this._readonly) {
            av.addEventListener("click", () => this._remove(user));
        } else {
            av.disabled = true;
        }
        return av;
    }

    /**
     * Toggles the visibility of the dropdown.
     */
    _toggleDropdown() {
        if (this._dropdownOpen) {
            this._closeDropdown();
        } else {
            this._openDropdown();
        }
    }

    /**
     * Opens the dropdown and runs an empty-query search.
     */
    _openDropdown() {
        this._dropdownOpen = true;
        this._dropdown.style.display = "block";
        this._searchInput.value = "";
        this._searchInput.focus();
        this._search("");
    }

    /**
     * Closes the dropdown.
     */
    _closeDropdown() {
        this._dropdownOpen = false;
        this._dropdown.style.display = "none";
    }

    /**
     * Queries the users-URI and renders candidate rows.
     * Candidates that are already watchers are excluded.
     * @param {string} q - Free-text query.
     */
    async _search(q) {
        if (!this._users) {
            return;
        }
        let users = [];
        try {
            const res = await this._users.query({ search: q });
            if (!res.ok) throw new Error(res.error ? res.error.message : String(res.status));
            users = res.data;
        } catch (e) {
            console.warn("WatcherCtrl: search failed", e);
        }

        const candidates = webexpress.webapp.watcherModel.candidates(this._watchers, users);

        this._resultsList.replaceChildren();
        if (candidates.length === 0) {
            const empty = document.createElement("div");
            empty.className = "wx-watcher-empty";
            empty.textContent = this._i18n("webexpress.webapp:watcher.no.matches", "No matches");
            this._resultsList.appendChild(empty);
            return;
        }
        for (const u of candidates) {
            const row = document.createElement("button");
            row.type = "button";
            row.className = "wx-watcher-result";
            row.innerHTML = `
                <span class="wx-watcher-result-avatar" style="background:${u.color || "#888"}">${u.initials || (u.name || "?").slice(0, 2).toUpperCase()}</span>
                <span class="wx-watcher-result-body">
                    <span class="wx-watcher-result-name">${this._esc(u.name)}</span>
                    ${u.team ? `<span class="wx-watcher-result-team">${this._esc(u.team)}</span>` : ""}
                </span>
            `;
            row.addEventListener("click", () => this._add(u));
            this._resultsList.appendChild(row);
        }
    }

    /**
     * Adds an watcher through POST and updates the UI.
     * @param {Object} user
     */
    async _add(user) {
        this._closeDropdown();
        if (!this._service) {
            return;
        }
        try {
            const res = await this._service.create({ userId: user.id });
            if (!res.ok) throw new Error(res.error ? res.error.message : String(res.status));
            const created = res.data;
            this._watchers = this._watchers.concat([created]);
            this._dispatch(webexpress.webapp.Event.WATCHER_ADDED_EVENT, { user: created });
        } catch (e) {
            console.warn("WatcherCtrl: add failed", e);
        }
    }

    /**
     * Removes an watcher through DELETE and updates the UI.
     * @param {Object} user
     */
    async _remove(user) {
        if (!this._service) {
            return;
        }
        try {
            const res = await this._service.remove({ path: webexpress.webapp.watcherModel.removePath(user.id) });
            if (!res.ok && res.status !== 204) throw new Error(res.error ? res.error.message : String(res.status));
            this._watchers = webexpress.webapp.watcherModel.removeById(this._watchers, user.id);
            this._dispatch(webexpress.webapp.Event.WATCHER_REMOVED_EVENT, { user });
        } catch (e) {
            console.warn("WatcherCtrl: remove failed", e);
        }
    }

    /**
     * Minimal HTML escape.
     * @param {string} s
     * @returns {string}
     */
    _esc(s) {
        return String(s ?? "").replace(/[<>"&]/g, c => ({ "<": "&lt;", ">": "&gt;", '"': "&quot;", "&": "&amp;" }[c]));
    }

    /**
     * Gets the current list of watchers.
     * @returns {Array<Object>}
     */
    get value() {
        return this._watchers.slice();
    }
};

// register for declarative auto-init
webexpress.webui.Controller.registerClass("wx-webapp-watcher", webexpress.webapp.WatcherCtrl);