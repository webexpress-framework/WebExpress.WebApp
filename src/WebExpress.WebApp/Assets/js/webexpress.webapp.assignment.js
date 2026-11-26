/**
 * A control showing the assignee of an object as one row: a round portrait or the
 * initials, a small caption above the name and the action at the end of the row. The
 * caller assigns the object to themselves, removes their assignment or, with a users
 * service, searches for another assignee. Every change is stored through the data
 * service and the row is redrawn from the answer, without reloading the page.
 *
 * Declarative configuration: the host carries a wx-service island named "data" for the
 * assignment endpoint and an optional second island named "users" for the search. The
 * server renders the row in advance and seeds the state through a wx-state island
 * { assignee, self, mayChange }; without the seed the control loads it from the endpoint.
 *
 * It is ViewState-capable: when the host carries a data-wx-resource binding the assignment
 * is a slice of an enclosing ViewState, which owns the central load; the control renders the
 * slice, writes through the ViewState's service for the resource and then re-queries it, so
 * every control bound to the resource follows. The users service is then resolved from the
 * ViewState through the data-wx-users binding. Without a binding the control owns its own
 * islands and loads itself (standalone).
 *
 * The markup is a pure function of the state (render), patched into the host by the keyed
 * reconciler of the Data base; handlers only change the state or call a service.
 *
 * REST contract:
 *   GET    {data}                   → { assignee, self, mayChange }
 *   PUT    {data}   body { userId } → { assignee, self, mayChange }   (no userId: the caller)
 *   DELETE {data}                   → { assignee, self, mayChange }
 *   GET    {users}?q=…              → [{ id, name, image, initials }]
 *
 * Events dispatched on the host element:
 *   webexpress.webapp.Event.ASSIGNMENT_CHANGED_EVENT detail: { assignee, previous }
 *   webexpress.webui.Event.BEFORE_SAVE_EVENT / SAVED_EVENT / DATA_ERROR_EVENT
 */
webexpress.webapp.AssignmentCtrl = class extends webexpress.webapp.Data {
    /**
     * Debounce of the search, long enough to skip the keystrokes of a word being typed.
     */
    static SEARCH_DELAY = 180;

    /**
     * Construct a new AssignmentCtrl.
     * @param {HTMLElement} element - host element.
     */
    constructor(element) {
        // resolve the services and the seed before super, so the Data base owns the
        // service map and its store starts from the server's state
        const services = webexpress.webapp.ServiceRegistry.fromElement(element);
        const seed = webexpress.webapp.Data.readState(element);
        const seeded = Object.prototype.hasOwnProperty.call(seed, "mayChange");
        const initialState = Object.assign(
            { busy: false, pickerOpen: false, query: "", candidates: null, searchable: !!services.users },
            webexpress.webapp.assignmentModel.normalize(seed));

        super(element, { state: initialState, services: services });

        this._readonly = element.getAttribute("data-readonly") === "true";
        // the resource a ViewState renders; when present the assignment is a view of a central
        // resource the enclosing ViewState owns, when absent the control loads itself
        this._resource = element.getAttribute("data-wx-resource") || null;
        this._viewState = null;
        this._texts = {
            caption: this._text(element, "data-caption", "webexpress.webapp:assignment.caption", "Assignee"),
            placeholder: this._text(element, "data-placeholder", "webexpress.webapp:assignment.placeholder", "Unassigned"),
            assignToMe: this._text(element, "data-assign-to-me", "webexpress.webapp:assignment.assign.me", "Assign to me"),
            unassign: this._text(element, "data-unassign", "webexpress.webapp:assignment.unassign", "Unassign"),
            assignTo: this._text(element, "data-assign-to", "webexpress.webapp:assignment.assign.to", "Assign to …")
        };
        this._service = this.useService("data");
        this._users = this.useService("users");

        this._searchTimer = null;
        // rendered nodes that imperative work needs: focus and the outside-click test
        this._searchInput = null;
        this._pickerEl = null;
        this._pickEl = null;

        // stable handlers, so a render does not swap the listeners of unchanged nodes
        this._onPrimaryClick = () => {
            const action = webexpress.webapp.assignmentModel.primaryAction(this.state);
            if (action === "unassign") {
                this._change("unassign", null);
            } else if (action === "assign") {
                this._change("assign", {});
            }
        };
        this._onPickClick = (e) => {
            e.stopPropagation();
            if (this.state.busy) {
                return;
            }
            if (this.state.pickerOpen) {
                this._closePicker(true);
            } else {
                this._openPicker();
            }
        };
        this._onSearchInput = (e) => {
            const query = e.target.value;
            this.setState({ query: query });
            clearTimeout(this._searchTimer);
            this._searchTimer = setTimeout(() => this._search(query.trim()), webexpress.webapp.AssignmentCtrl.SEARCH_DELAY);
        };
        this._onPickerKeyDown = (e) => {
            if (e.key === "Escape") {
                e.stopPropagation();
                this._closePicker(true);
            }
        };
        this._onDocumentMouseDown = (e) => {
            if (!this.state.pickerOpen || this._pickerEl?.contains(e.target) || this._pickEl?.contains(e.target)) {
                return;
            }
            this._closePicker(false);
        };

        // clean host: the server rendered row is replaced by the rendered state
        element.textContent = "";
        for (const name of ["data-readonly", "data-caption", "data-placeholder", "data-assign-to-me", "data-unassign", "data-assign-to"]) {
            element.removeAttribute(name);
        }
        element.classList.add("wx-assignment");

        // subscribe to the store, perform the first render and run onMount
        this.mount();

        // the seed spares the first round trip; a bound row is loaded by its ViewState
        if (this._resource) {
            this._attachToViewState(element);
        } else if (!seeded) {
            this.load();
        }
    }

    /**
     * Attaches the control to the enclosing ViewState and renders its resource slice. The
     * ViewState owns the central load and the service; the search uses the ViewState's users
     * service named by the users binding.
     * @param {HTMLElement} element - The host element.
     */
    _attachToViewState(element) {
        const viewStateId = element.getAttribute("data-wx-viewstate") || null;

        webexpress.webapp.ViewStateRegistry.whenReady(element, viewStateId, (viewState) => {
            this._viewState = viewState;

            const service = viewState.serviceForResource(this._resource);
            if (service) {
                this._service = service;
            }

            const usersName = element.getAttribute("data-wx-users");
            const users = usersName ? viewState.useService(usersName) : null;
            if (users) {
                this._users = users;
            }

            const unsubscribe = viewState.watch((state) => viewState.slice(this._resource, state), (slice) => this._applySlice(slice));
            (element._wxCleanup = element._wxCleanup || []).push(unsubscribe);

            this.setState({ searchable: !!this._users });
            this._applySlice(viewState.slice(this._resource));
        });
    }

    /**
     * Renders a resource slice the ViewState loaded centrally. A slice still loading keeps
     * what is shown, which is the server rendered seed.
     * @param {object} slice - The resource slice { items, total, data, loading, error }.
     */
    _applySlice(slice) {
        if (slice && slice.data) {
            this.setState(webexpress.webapp.assignmentModel.normalize(slice.data));
        }
    }

    /**
     * Gets the current assignee.
     * @returns {object|null} A copy of the assignee, or null when the object is unassigned.
     */
    get value() {
        const assignee = this.state.assignee;
        return assignee ? Object.assign({}, assignee) : null;
    }

    /**
     * Loads the assignment from the endpoint and redraws the row. A failed load keeps what
     * is shown, which is the server rendered state or the last answer. A bound row asks its
     * ViewState to re-query the resource, so every control bound to it follows.
     * @returns {Promise<void>} Settles when the answer is applied.
     */
    async load() {
        if (this._resource) {
            if (this._viewState) {
                await this._viewState.reload(this._resource);
            }
            return;
        }
        if (!this._service) {
            return;
        }
        const res = await this._service.query({});
        if (res.ok) {
            this.setState(webexpress.webapp.assignmentModel.normalize(res.data));
        } else if (res.error && res.error.kind !== "abort") {
            console.warn("AssignmentCtrl: load failed", webexpress.webapp.ServiceResult.describe(res));
        }
    }

    /**
     * Marks the host after the first render and listens for clicks outside the picker,
     * which close it, for as long as the control is mounted.
     * @param {object} state - The rendered state.
     */
    onMount(state) {
        this._markEmpty(state);
        if (!this._readonly) {
            document.addEventListener("mousedown", this._onDocumentMouseDown);
        }
    }

    /**
     * Applies what the render cannot express: the empty marker on the host and the focus
     * of the search field once the picker has opened.
     * @param {object} state - The rendered state.
     */
    onUpdate(state) {
        this._markEmpty(state);

        if (state.pickerOpen && !this._wasOpen && this._searchInput) {
            this._searchInput.focus({ preventScroll: true });
        }
        this._wasOpen = state.pickerOpen;
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
     * Renders the row: avatar, caption and name, and the actions the caller may use.
     * @param {object} state - The current state.
     * @returns {Array<object>} The virtual node tree of the host.
     */
    render(state) {
        const h = webexpress.webui.h;
        const model = webexpress.webapp.assignmentModel;
        const assignee = state.assignee;

        const nodes = [
            h("span", { key: "avatar", class: "wx-assignment-avatar", "aria-hidden": "true" },
                assignee && assignee.image
                    ? h("img", { src: assignee.image, alt: "" })
                    : model.initials(assignee)),
            // a polite live region, so the new assignee is announced once the row is redrawn
            h("span", { key: "text", class: "wx-assignment-text", "aria-live": "polite" },
                h("span", { key: "caption", class: "wx-assignment-caption" }, this._texts.caption),
                h("span", { key: "name", class: "wx-assignment-name" }, assignee ? assignee.name || "" : this._texts.placeholder))
        ];

        const primary = this._readonly ? null : model.primaryAction(state);
        const pickable = !this._readonly && state.mayChange && state.searchable;
        if (!primary && !pickable) {
            return nodes;
        }

        nodes.push(h("span", { key: "actions", class: "wx-assignment-actions", "aria-busy": state.busy ? "true" : null },
            // one key for both kinds, so the button keeps the focus when assign turns into unassign
            primary && this._renderAction("primary", primary === "unassign" ? "user-xmark" : "user-plus",
                primary === "unassign" ? this._texts.unassign : this._texts.assignToMe, state, {
                    "data-wx-assignment-action": primary,
                    on: { click: this._onPrimaryClick }
                }),
            pickable && this._renderAction("pick", "user-pen", this._texts.assignTo, state, {
                "data-wx-assignment-action": "pick",
                "aria-haspopup": "true",
                "aria-expanded": state.pickerOpen ? "true" : "false",
                on: { click: this._onPickClick },
                ref: (el) => { this._pickEl = el; }
            })));

        if (pickable) {
            nodes.push(this._renderPicker(state));
        }

        return nodes;
    }

    /**
     * Renders one action button. A busy button stays focusable and announces that it is
     * waiting, rather than being disabled and dropping the focus.
     * @param {string} key - The reconciler key.
     * @param {string} icon - The symbolic icon name.
     * @param {string} text - The visible text, which is the accessible name.
     * @param {object} state - The current state.
     * @param {object} props - Additional properties.
     * @returns {object} The button virtual node.
     */
    _renderAction(key, icon, text, state, props) {
        const h = webexpress.webui.h;
        return h("button", Object.assign({
            key: key,
            type: "button",
            class: "wx-assignment-action",
            "aria-busy": state.busy ? "true" : null,
            "aria-disabled": state.busy ? "true" : null
        }, props),
            h("i", { class: webexpress.webui.IconSet.resolve(icon), "aria-hidden": "true" }),
            h("span", {}, text));
    }

    /**
     * Renders the search for another assignee: a field and the matching people.
     * @param {object} state - The current state.
     * @returns {object} The picker virtual node.
     */
    _renderPicker(state) {
        const h = webexpress.webui.h;
        return h("div", {
            key: "picker",
            class: "wx-assignment-picker",
            style: { display: state.pickerOpen ? "flex" : "none" },
            on: { keydown: this._onPickerKeyDown },
            ref: (el) => { this._pickerEl = el; }
        },
            h("input", {
                key: "search",
                type: "search",
                class: "wx-assignment-search",
                placeholder: this._i18n("webexpress.webapp:assignment.search.placeholder", "Search person…"),
                "aria-label": this._i18n("webexpress.webapp:assignment.search.label", "Search for the new assignee"),
                autocomplete: "off",
                value: state.query,
                on: { input: this._onSearchInput },
                ref: (el) => { this._searchInput = el; }
            }),
            h("div", { key: "results", class: "wx-assignment-results" }, this._renderCandidates(state)));
    }

    /**
     * Renders the answered search: a row per candidate, or a hint when nothing matches.
     * Before the first answer the list stays empty.
     * @param {object} state - The current state.
     * @returns {Array<object>|object|null} The result virtual nodes.
     */
    _renderCandidates(state) {
        const h = webexpress.webui.h;
        const model = webexpress.webapp.assignmentModel;
        if (state.candidates === null) {
            return null;
        }
        if (state.candidates.length === 0) {
            return h("div", { class: "wx-assignment-no-matches" },
                this._i18n("webexpress.webapp:assignment.no.matches", "No matches"));
        }
        return state.candidates.map((user) => h("button", {
            key: user.id,
            type: "button",
            class: "wx-assignment-result",
            "data-wx-assignment-user": user.id,
            on: { click: () => this._pick(user) }
        },
            h("span", { class: "wx-assignment-avatar", "aria-hidden": "true" },
                user.image ? h("img", { src: user.image, alt: "" }) : model.initials(user)),
            h("span", { class: "wx-assignment-result-name" }, user.name || "")));
    }

    /**
     * Opens the picker with an empty query and runs an empty-query search.
     */
    _openPicker() {
        this.setState({ pickerOpen: true, query: "", candidates: null });
        this._search("");
    }

    /**
     * Closes the picker.
     * @param {boolean} refocus - True to hand the focus back to the action that opened it.
     */
    _closePicker(refocus) {
        clearTimeout(this._searchTimer);
        this.setState({ pickerOpen: false });
        if (refocus && this._pickEl) {
            this._pickEl.focus({ preventScroll: true });
        }
    }

    /**
     * Queries the users service and keeps the people that can be assigned.
     * @param {string} q - Free-text query.
     */
    async _search(q) {
        if (!this._users) {
            return;
        }
        const res = await this._users.query({ search: q });
        if (res.error && res.error.kind === "abort") {
            return;
        }
        if (!res.ok) {
            console.warn("AssignmentCtrl: search failed", webexpress.webapp.ServiceResult.describe(res));
        }
        this.setState({ candidates: webexpress.webapp.assignmentModel.candidates(res.ok ? res.data : [], this.state.assignee) });
    }

    /**
     * Assigns the object to a person chosen in the picker.
     * @param {object} user - The chosen person.
     */
    _pick(user) {
        this._closePicker(true);
        this._change("assign", { userId: user.id });
    }

    /**
     * Stores a change and redraws the row from the answer. The action is locked while the
     * request runs; a change the server refuses leaves the row as it was.
     * @param {"assign"|"unassign"} action - The change.
     * @param {object|null} payload - The body of an assign request.
     * @returns {Promise<void>} Settles when the answer is applied.
     */
    async _change(action, payload) {
        if (this.state.busy || !this._service) {
            return;
        }

        const previous = this.state.assignee;
        this.setState({ busy: true });

        const send = action === "unassign"
            ? () => this._service.remove({})
            : (sent) => this._service.update(sent || {});
        const result = await this._saveAction(action, payload, send);

        if (result && result.ok) {
            // the service layer hands no body back for a DELETE, so a confirmed unassign
            // keeps the caller and the right and only drops the assignee
            const next = result.data
                ? webexpress.webapp.assignmentModel.normalize(result.data)
                : { assignee: null, self: this.state.self, mayChange: this.state.mayChange };
            this.setState(Object.assign(next, { busy: false }));
            if (webexpress.webapp.assignmentModel.changed(previous, next.assignee)) {
                this._dispatch(webexpress.webapp.Event.ASSIGNMENT_CHANGED_EVENT, { assignee: next.assignee, previous: previous });
            }
            // in ViewState mode the resource is re-queried so sibling controls refresh
            if (this._viewState) {
                this._viewState.reload(this._resource);
            }
            return;
        }

        this.setState({ busy: false });

        // a change vetoed before it was sent is no failure
        if (result && result.error && result.error.kind !== "abort") {
            this._reject(action, result);
        }
    }

    /**
     * Puts a refused change in front of the user. The row was not touched, so it still
     * shows the stored assignee; the popup says why the action had no effect. When the
     * server took the right away meanwhile, the state is loaded again so the action that
     * no longer applies disappears.
     * @param {string} action - The refused change.
     * @param {object} result - The failed service result.
     */
    _reject(action, result) {
        const status = result.error.status || result.status || 0;
        const fallback = status === 403
            ? this._i18n("webexpress.webapp:assignment.forbidden", "You may not change the assignee.")
            : this._i18n("webexpress.webapp:assignment.update.rejected", "The assignee was not changed.");

        webexpress.webapp.ErrorChannel.present(result, {
            service: this._service.name,
            heading: this._i18n("webexpress.webapp:assignment.heading", "Assignee"),
            message: this._refusalReason(result) || fallback
        });

        this._dispatch(webexpress.webui.Event.DATA_ERROR_EVENT, { action: action, error: result.error });

        if (status === 403) {
            this.load();
        }
    }

    /**
     * Reads the reason a RestApiRefusal put into the body of a refused write.
     * @param {object} result - The failed service result.
     * @returns {string|null} The reason, escaped for the popup, or null when the server gave none.
     */
    _refusalReason(result) {
        const reason = result && result.data && result.data.message;

        if (typeof reason !== "string" || !reason.trim()) {
            return null;
        }

        // the popup renders its message as html, and a reason may quote a name the user typed
        return reason.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c]);
    }

    /**
     * Marks the host of an unassigned object, the hook of the dashed circle and the muted
     * placeholder; the host is the render root, so the render cannot set its class.
     * @param {object} state - The rendered state.
     */
    _markEmpty(state) {
        if (state && state.assignee) {
            this._element.classList.remove("wx-assignment-empty");
        } else {
            this._element.classList.add("wx-assignment-empty");
        }
    }

    /**
     * Returns a text the server overrode on the host, else the translated default.
     * @param {HTMLElement} element - The host element.
     * @param {string} attribute - The attribute carrying the override.
     * @param {string} key - The i18n key of the default.
     * @param {string} fallback - The text when no dictionary is loaded.
     * @returns {string} The text.
     */
    _text(element, attribute, key, fallback) {
        const value = element.getAttribute(attribute);
        return value ? value : this._i18n(key, fallback);
    }
};

// register for declarative auto-init
webexpress.webui.Controller.registerClass("wx-webapp-assignment", webexpress.webapp.AssignmentCtrl);
