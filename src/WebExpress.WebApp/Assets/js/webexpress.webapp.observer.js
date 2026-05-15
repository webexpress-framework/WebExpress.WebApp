/**
 * A control showing the watchers/observers of an object as a row of avatars,
 * with an inline dropdown to add new ones via live search.
 *
 * Each avatar is interactive: hover for the name, click to remove (when the
 * remove-on-click affordance is enabled). The "+" button opens a dropdown
 * with a search input that queries `data-users-uri` and lists candidates.
 *
 * Declarative configuration:
 *   <div class="wx-webapp-observer"
 *        data-uri="/api/observers/INC-00123"
 *        data-users-uri="/api/users"></div>
 *
 * REST contract:
 *   GET  {uri}                              → [{ id, name, team, initials, color }]
 *   POST {uri}            body { userId }   → { id, name, team, initials, color }
 *   DELETE {uri}/{userId}                   → 204
 *   GET  {users-uri}?q=…                    → [{ id, name, team, initials, color }]
 *
 * Events dispatched on the host element:
 *   webexpress.webapp.Event.OBSERVER_ADDED_EVENT   detail: { user }
 *   webexpress.webapp.Event.OBSERVER_REMOVED_EVENT detail: { user }
 */
webexpress.webapp.ObserverCtrl = class extends webexpress.webui.Ctrl {
    /**
     * Construct a new ObserverCtrl.
     * @param {HTMLElement} element - host element.
     */
    constructor(element) {
        super(element);

        this._uri = element.dataset.uri || null;
        this._usersUri = element.dataset.usersUri || null;
        this._maxVisible = parseInt(element.dataset.maxVisible || "6", 10);
        this._readonly = element.dataset.readonly === "true";

        // state
        this._observers = [];
        this._dropdownOpen = false;
        this._searchTimer = null;

        // clean host
        element.textContent = "";
        element.removeAttribute("data-uri");
        element.removeAttribute("data-users-uri");
        element.removeAttribute("data-max-visible");
        element.removeAttribute("data-readonly");
        element.classList.add("wx-webapp-observer");

        this._buildDom();
        this._attachEventHandlers();
        this._load();
    }

    /**
     * Builds the static DOM scaffold (avatar row + add button + dropdown).
     */
    _buildDom() {
        this._row = document.createElement("div");
        this._row.className = "wx-webapp-observer-row";

        this._addBtn = document.createElement("button");
        this._addBtn.type = "button";
        this._addBtn.className = "wx-webapp-observer-add";
        this._addBtn.title = this._i18n("webexpress.webapp:observer.add", "Add observer");
        this._addBtn.setAttribute("aria-label", this._addBtn.title);
        this._addBtn.textContent = "+";

        this._dropdown = document.createElement("div");
        this._dropdown.className = "wx-webapp-observer-dropdown";
        this._dropdown.style.display = "none";

        this._searchInput = document.createElement("input");
        this._searchInput.type = "text";
        this._searchInput.className = "wx-webapp-observer-search";
        this._searchInput.placeholder = this._i18n("webexpress.webapp:observer.search.placeholder", "Search person…");
        this._searchInput.autocomplete = "off";

        this._resultsList = document.createElement("div");
        this._resultsList.className = "wx-webapp-observer-results";

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
     * Loads observers from the configured URI and renders them.
     */
    async _load() {
        if (!this._uri) {
            this._observers = [];
            this._render();
            return;
        }
        try {
            const res = await fetch(this._uri, { headers: { "Accept": "application/json" } });
            if (!res.ok) throw new Error(res.statusText);
            this._observers = await res.json();
        } catch (e) {
            console.warn("ObserverCtrl: load failed", e);
            this._observers = [];
        }
        this._render();
    }

    /**
     * Renders the avatar row from `this._observers`.
     */
    _render() {
        this._row.replaceChildren();
        const visible = this._observers.slice(0, this._maxVisible);
        const overflow = this._observers.length - visible.length;

        for (const u of visible) {
            this._row.appendChild(this._makeAvatar(u));
        }
        if (overflow > 0) {
            const more = document.createElement("span");
            more.className = "wx-webapp-observer-more";
            more.textContent = "+" + overflow;
            more.title = this._observers.slice(this._maxVisible).map(u => u.name).join(", ");
            this._row.appendChild(more);
        }
    }

    /**
     * Builds a single avatar element for a user.
     * Click on the avatar removes the observer (unless readonly).
     * @param {Object} user - The user record.
     * @returns {HTMLElement}
     */
    _makeAvatar(user) {
        const av = document.createElement("button");
        av.type = "button";
        av.className = "wx-webapp-observer-avatar";
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
     * Candidates that are already observers are excluded.
     * @param {string} q - Free-text query.
     */
    async _search(q) {
        if (!this._usersUri) {
            return;
        }
        let users = [];
        try {
            const url = this._usersUri + (this._usersUri.includes("?") ? "&" : "?") + "q=" + encodeURIComponent(q);
            const res = await fetch(url, { headers: { "Accept": "application/json" } });
            if (!res.ok) throw new Error(res.statusText);
            users = await res.json();
        } catch (e) {
            console.warn("ObserverCtrl: search failed", e);
        }

        const known = new Set(this._observers.map(u => u.id));
        const candidates = users.filter(u => !known.has(u.id));

        this._resultsList.replaceChildren();
        if (candidates.length === 0) {
            const empty = document.createElement("div");
            empty.className = "wx-webapp-observer-empty";
            empty.textContent = this._i18n("webexpress.webapp:observer.no.matches", "No matches");
            this._resultsList.appendChild(empty);
            return;
        }
        for (const u of candidates) {
            const row = document.createElement("button");
            row.type = "button";
            row.className = "wx-webapp-observer-result";
            row.innerHTML = `
                <span class="wx-webapp-observer-result-avatar" style="background:${u.color || "#888"}">${u.initials || (u.name || "?").slice(0, 2).toUpperCase()}</span>
                <span class="wx-webapp-observer-result-body">
                    <span class="wx-webapp-observer-result-name">${this._esc(u.name)}</span>
                    ${u.team ? `<span class="wx-webapp-observer-result-team">${this._esc(u.team)}</span>` : ""}
                </span>
            `;
            row.addEventListener("click", () => this._add(u));
            this._resultsList.appendChild(row);
        }
    }

    /**
     * Adds an observer through POST and updates the UI.
     * @param {Object} user
     */
    async _add(user) {
        this._closeDropdown();
        if (!this._uri) {
            return;
        }
        try {
            const res = await fetch(this._uri, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Accept": "application/json" },
                body: JSON.stringify({ userId: user.id })
            });
            if (!res.ok) throw new Error(res.statusText);
            const created = await res.json();
            this._observers.push(created);
            this._render();
            this._dispatch(webexpress.webapp.Event.OBSERVER_ADDED_EVENT, { user: created });
        } catch (e) {
            console.warn("ObserverCtrl: add failed", e);
        }
    }

    /**
     * Removes an observer through DELETE and updates the UI.
     * @param {Object} user
     */
    async _remove(user) {
        if (!this._uri) {
            return;
        }
        try {
            const res = await fetch(this._uri + "/" + encodeURIComponent(user.id), { method: "DELETE" });
            if (!res.ok && res.status !== 204) throw new Error(res.statusText);
            this._observers = this._observers.filter(u => u.id !== user.id);
            this._render();
            this._dispatch(webexpress.webapp.Event.OBSERVER_REMOVED_EVENT, { user });
        } catch (e) {
            console.warn("ObserverCtrl: remove failed", e);
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
     * Gets the current list of observers.
     * @returns {Array<Object>}
     */
    get value() {
        return this._observers.slice();
    }
};

// register for declarative auto-init
webexpress.webui.Controller.registerClass("wx-webapp-observer", webexpress.webapp.ObserverCtrl);