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
 * It is ViewState-capable: when the host carries a data-wx-resource binding the
 * watchers are a slice of an enclosing ViewState, so the control
 * subscribes to that slice and the ViewState owns the central load; the users
 * service is then resolved from the ViewState through the data-wx-users binding.
 * Without a binding the control owns its own islands and loads itself
 * (standalone).
 *
 * The markup is a pure function of the state (render), patched into the host by the keyed
 * reconciler of the Data base; handlers only change the state or call a service.
 *
 * REST contract:
 *   GET  {data}                             → [{ id, name, team, initials, color, image }]
 *   POST {data}           body { userId }   → { id, name, team, initials, color, image }
 *   DELETE {data}/{userId}                  → 204
 *   GET  {users}?q=…                        → [{ id, name, team, initials, color, image }]
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
        const initialState = Object.assign(
            { watchers: [], dropdownOpen: false, query: "", candidates: null },
            webexpress.webapp.Data.readState(element));

        super(element, { state: initialState, services: services });

        this._maxVisible = parseInt(element.dataset.maxVisible || "6", 10);
        this._readonly = element.dataset.readonly === "true";
        // the resource a ViewState renders; when present the watchers are a pure
        // view of a central resource the enclosing ViewState owns, when absent the
        // control loads itself (standalone)
        this._resource = (element.dataset && element.dataset.wxResource) || null;
        this._service = this.useService("data");
        this._users = this.useService("users");

        this._searchTimer = null;
        // rendered nodes that imperative work needs: focus and the outside-click test
        this._searchInput = null;
        this._dropdownEl = null;
        this._addEl = null;

        // stable handlers, so a render does not swap the listeners of unchanged nodes
        this._onAddClick = (e) => {
            e.stopPropagation();
            this._toggleDropdown();
        };
        this._onSearchInput = (e) => {
            const query = e.target.value;
            this.setState({ query: query });
            clearTimeout(this._searchTimer);
            this._searchTimer = setTimeout(() => this._search(query.trim()), 180);
        };
        this._onSearchKeyDown = (e) => {
            if (e.key === "Escape") {
                this._closeDropdown();
            }
        };
        this._onDocumentMouseDown = (e) => {
            if (!this.state.dropdownOpen || this._dropdownEl?.contains(e.target) || this._addEl?.contains(e.target)) {
                return;
            }
            this._closeDropdown();
        };

        // clean host
        element.textContent = "";
        element.removeAttribute("data-max-visible");
        element.removeAttribute("data-readonly");
        element.classList.add("wx-watcher");

        // subscribe to the store, perform the first render and run onMount
        this.mount();

        // when the server seeded the watchers through the data-wx-state island the
        // first paint needs no round trip; otherwise load them from the endpoint
        if (this._resource) {
            this._attachToViewState(element);
        } else if (this._watchers.length === 0) {
            this._load();
        }
    }

    /**
     * Attaches the control to the enclosing ViewState and renders its
     * resource slice. The ViewState owns the central load and the service; the
     * candidate search users service also comes from the ViewState, resolved by
     * the type-safe users binding the control emits. Additions and removals
     * still persist through the ViewState's data service.
     * @param {HTMLElement} element - The host element.
     */
    _attachToViewState(element) {
        const viewStateId = (element.dataset && element.dataset.wxViewstate) || null;

        webexpress.webapp.ViewStateRegistry.whenReady(element, viewStateId, (viewState) => {
            this._viewState = viewState;

            const service = viewState.serviceForResource(this._resource);
            if (service) {
                this._service = service;
            }

            const usersName = element.dataset && element.dataset.wxUsers;
            const usersService = usersName ? viewState.useService(usersName) : null;
            if (usersService) {
                this._users = usersService;
            }

            const unsubscribe = viewState.watch((state) => viewState.slice(this._resource, state), (slice) => this._applySlice(slice));
            (element._wxCleanup = element._wxCleanup || []).push(unsubscribe);

            this._applySlice(viewState.slice(this._resource));
        });
    }

    /**
     * Renders a resource slice the ViewState loaded centrally.
     * @param {object} slice - The resource slice { items, total, data, loading, error }.
     */
    _applySlice(slice) {
        slice = slice || {};
        if (slice.data) {
            this._watchers = webexpress.webapp.watcherModel.normalizeList(slice.data);
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
     * Listens for clicks outside the control, which close the dropdown, for as long as the
     * control is mounted.
     */
    onMount() {
        if (!this._readonly) {
            document.addEventListener("mousedown", this._onDocumentMouseDown);
        }
    }

    /**
     * Moves the focus into the search field once the dropdown has opened; focus is a side
     * effect of the render, so it is applied after the reconciler placed the field.
     * @param {object} state - The rendered state.
     */
    onUpdate(state) {
        if (state.dropdownOpen && !this._wasOpen && this._searchInput) {
            this._searchInput.focus();
        }
        this._wasOpen = state.dropdownOpen;
    }

    /**
     * Releases the document listener and a pending search.
     */
    onUnmount() {
        document.removeEventListener("mousedown", this._onDocumentMouseDown);
        clearTimeout(this._searchTimer);
        this._searchTimer = null;
    }

    /**
     * Renders the avatar row, and for an editable control the add button and the dropdown.
     * @param {object} state - The current state.
     * @returns {Array<object>} The virtual node tree of the host.
     */
    render(state) {
        const h = webexpress.webui.h;
        const watchers = state.watchers || [];
        const visible = watchers.slice(0, this._maxVisible);
        const hidden = watchers.slice(this._maxVisible);

        // the watchers render as an overlapping avatar group (webexpress.webui)
        const row = h("div", { key: "row", class: "wx-avatar-group" },
            visible.map((user) => this._renderAvatar(user)),
            hidden.length > 0 && h("span", {
                key: "more",
                class: "wx-avatar-group-more wx-watcher-more",
                title: hidden.map((user) => user.name).join(", ")
            }, "+" + hidden.length));

        if (this._readonly) {
            return [row];
        }

        const addLabel = this._i18n("webexpress.webapp:watcher.add", "Add watcher");
        return [
            row,
            h("button", {
                key: "add",
                type: "button",
                class: "wx-watcher-add",
                title: addLabel,
                "aria-label": addLabel,
                on: { click: this._onAddClick },
                ref: (el) => { this._addEl = el; }
            }, h("i", { class: webexpress.webui.IconSet.resolve("plus") })),
            h("div", {
                key: "dropdown",
                class: "wx-watcher-dropdown",
                style: { display: state.dropdownOpen ? "block" : "none" },
                ref: (el) => { this._dropdownEl = el; }
            },
                h("input", {
                    key: "search",
                    type: "text",
                    class: "wx-watcher-search",
                    placeholder: this._i18n("webexpress.webapp:watcher.search.placeholder", "Search person…"),
                    autocomplete: "off",
                    value: state.query,
                    on: { input: this._onSearchInput, keydown: this._onSearchKeyDown },
                    ref: (el) => { this._searchInput = el; }
                }),
                h("div", { key: "results", class: "wx-watcher-results" }, this._renderCandidates(state)))
        ];
    }

    /**
     * Renders a single avatar; a click removes the watcher unless the control is readonly.
     * @param {Object} user - The user record.
     * @returns {object} The avatar virtual node.
     */
    _renderAvatar(user) {
        const h = webexpress.webui.h;
        const title = user.name + (user.team ? " · " + user.team : "");
        return h("button", {
            key: user.id,
            type: "button",
            class: "wx-avatar-group-avatar wx-watcher-avatar",
            title: title,
            "aria-label": title,
            disabled: this._readonly,
            style: user.image ? {} : { background: user.color || "#888" },
            on: this._readonly ? {} : { click: () => this._remove(user) }
        }, user.image
            ? h("img", { class: "wx-avatar-group-img", src: user.image, alt: user.name || "" })
            : this._initials(user));
    }

    /**
     * Renders the answered search: a row per candidate, or a hint when nothing matches. Before
     * the first answer the list stays empty.
     * @param {object} state - The current state.
     * @returns {Array<object>|object|null} The result virtual nodes.
     */
    _renderCandidates(state) {
        const h = webexpress.webui.h;
        if (state.candidates === null) {
            return null;
        }
        if (state.candidates.length === 0) {
            return h("div", { class: "wx-watcher-empty" },
                this._i18n("webexpress.webapp:watcher.no.matches", "No matches"));
        }
        return state.candidates.map((user) => h("button", {
            key: user.id,
            type: "button",
            class: "wx-watcher-result",
            on: { click: () => this._add(user) }
        },
            user.image
                ? h("img", { class: "wx-watcher-result-avatar", src: user.image, alt: "" })
                : h("span", { class: "wx-watcher-result-avatar", style: { background: user.color || "#888" } }, this._initials(user)),
            h("span", { class: "wx-watcher-result-body" },
                h("span", { class: "wx-watcher-result-name" }, user.name),
                user.team && h("span", { class: "wx-watcher-result-team" }, user.team))));
    }

    /**
     * Gets the badge text of a user without a picture.
     * @param {Object} user - The user record.
     * @returns {string} The initials.
     */
    _initials(user) {
        return user.initials || (user.name || "?").slice(0, 2).toUpperCase();
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
     * Toggles the visibility of the dropdown.
     */
    _toggleDropdown() {
        if (this.state.dropdownOpen) {
            this._closeDropdown();
        } else {
            this._openDropdown();
        }
    }

    /**
     * Opens the dropdown with an empty query and runs an empty-query search.
     */
    _openDropdown() {
        this.setState({ dropdownOpen: true, query: "" });
        this._search("");
    }

    /**
     * Closes the dropdown.
     */
    _closeDropdown() {
        this.setState({ dropdownOpen: false });
    }

    /**
     * Queries the users service and keeps the candidates that are not watchers yet.
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

        this.setState({ candidates: webexpress.webapp.watcherModel.candidates(this._watchers, users) });
    }

    /**
     * Adds a watcher through POST and updates the UI.
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

            // in ViewState mode the resource is re-queried so sibling controls refresh
            if (this._viewState && this._resource) {
                this._viewState.reload(this._resource);
            }
        } catch (e) {
            console.warn("WatcherCtrl: add failed", e);
        }
    }

    /**
     * Removes a watcher through DELETE and updates the UI.
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

            // in ViewState mode the resource is re-queried so sibling controls refresh
            if (this._viewState && this._resource) {
                this._viewState.reload(this._resource);
            }
        } catch (e) {
            console.warn("WatcherCtrl: remove failed", e);
        }
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
