/**
 * A REST file view: one set of files shown in several interchangeable
 * presentations. The tabular file list and the tile board are built in and both
 * render the same files, so switching a presentation never means re-querying;
 * further presentations are contributed by the server as .wx-view children and
 * take part in the same switcher.
 *
 * The list presentation is the framework file list control, not a copy of it, so
 * an entry looks and behaves the same whether it is shown here or by the list on
 * its own. The description of a file can be changed in place through the smart
 * edit control and is persisted through the update operation of the data
 * service.
 *
 * The view is rendered from the state: the files, the active presentation and the
 * cards whose versions are unfolded. The file list, the switch, the views the
 * server contributed and the smart edit of a description are controls of their
 * own, which the view places and keeps. The query state (search, filter, page) is
 * the control's own when it loads itself; inside a ViewState it belongs to the
 * ViewState, whose central query reads it, and the binds and intents address it
 * there.
 *
 * The following events are triggered:
 * - webexpress.webui.Event.DATA_ARRIVED_EVENT
 * - webexpress.webui.Event.CHANGE_VISIBILITY_EVENT
 * - webexpress.webui.Event.CHANGE_VALUE_EVENT
 */
webexpress.webapp.FileViewCtrl = class extends webexpress.webapp.Data {

    // configuration
    _resource = null;
    _viewState = null;
    _service = null;
    _layout = "togglegroup";
    _editable = false;
    _storageKey = "";

    // presentations, in the order the switcher offers them
    _panes = [];

    // the controls the view places
    _listHost = null;
    _listCtrl = null;
    _listFiles = null;
    _switcher = null;
    _views = [];
    _unwatchSlice = null;

    /**
     * Constructor for the file view control.
     * @param {HTMLElement} element - The DOM element associated with the control.
     */
    constructor(element) {
        const seed = webexpress.webapp.Data.readState(element);

        super(element, {
            state: Object.assign({
                search: "",
                wql: "",
                filter: "",
                page: 0,
                pageSize: 50,
                orderBy: null,
                orderDir: null,
                total: 0,
                loading: false,
                error: null,
                files: [],
                activePane: null,
                // the names of the files whose card shows the earlier versions
                expanded: []
            }, seed)
        });

        // the resource an enclosing ViewState renders. when present the files are a
        // pure view of a central resource the ViewState owns; when absent the control
        // owns its state and loads itself
        this._resource = (element.dataset && element.dataset.wxResource) || null;

        this._service = this.useService("data");
        this._editable = element.dataset.editableDescription === "true";
        this._storageKey = element.dataset.persistKey || (element.id ? `wx_file_view_${element.id}` : null);

        // the presentations of a file view are few and equal, so the switch
        // stands alone by default; the view control names its active view beside
        // it, which a page asks for with the default layout
        this._layout = (element.dataset.layout || "togglegroup").trim().toLowerCase() === "default"
            ? "default"
            : "togglegroup";

        if (element.dataset.pageSize) {
            const pageSize = parseInt(element.dataset.pageSize, 10);
            this.setState({ pageSize: isNaN(pageSize) || pageSize <= 0 ? 50 : pageSize });
        }

        element.classList.add("wx-file-view");
        this._buildPanes(element, this._collect(element));
        this._buildSwitcher();

        // the configuration attributes are dropped once the layout stands, so
        // the mounted control carries no markup that repeats its own state
        element.removeAttribute("data-page-size");
        element.removeAttribute("data-editable-description");
        element.removeAttribute("data-views");
        element.removeAttribute("data-layout");

        this.mount();
        this._activate(this._restorePane());

        if (this._resource) {
            this._attachToViewState(element);
        } else if (this._service) {
            this._receiveData();
        }
    }

    /**
     * Announces the mount, so a bind that targets this control resolves it.
     *
     * The binds of an element run before the controller constructs that
     * element's own instance, so a bind declared on this control - the upload
     * bind above all - finds nothing and waits for this announcement. It is
     * deferred by one turn because the controller records the instance only
     * after the constructor returned: a bind resolving from inside the
     * constructor would look the control up and still find nothing.
     */
    _announceMount() {
        setTimeout(() => super._announceMount(), 0);
    }

    /**
     * A view inside a ViewState is reloaded by its ViewState, which re-queries its
     * resources on a data change itself; only a view that loads itself follows the
     * changes of its service.
     * @returns {boolean} True when the view loads itself.
     */
    _reloadsOnDataChange() {
        return !this._resource;
    }

    /**
     * Releases the subscriptions the control holds. The service a ViewState lends for
     * the bound resource is shared with every other resource of that ViewState, so it
     * is not the control's to abort; the Data base aborts only the control's own.
     */
    destroy() {
        if (this._unwatchSlice) {
            this._unwatchSlice();
            this._unwatchSlice = null;
        }

        super.destroy();
    }

    /**
     * Gets the state the query lives in: the control's own, or - inside a ViewState -
     * the ViewState, whose central query reads it.
     * @returns {object} The query store.
     */
    get _queryStore() {
        return this._viewState || this._store;
    }

    // state accessors backed by the query store, so the single source of truth is
    // the store the binds and intents address

    get _search() { return this._queryStore.getState().search; }
    set _search(value) { this._queryStore.setState({ search: value }); }

    get _page() { return this._queryStore.getState().page; }
    set _page(value) { this._queryStore.setState({ page: value }); }

    get _pageSize() { return this._queryStore.getState().pageSize; }
    set _pageSize(value) { this._queryStore.setState({ pageSize: value }); }

    // in ViewState mode the total comes from the resource slice rather than from a
    // top level state key, so several resources in one ViewState keep separate totals
    get _totalRecords() { return this._store.getState().total; }
    set _totalRecords(value) { this._store.setState({ total: value }); }

    /**
     * Returns the store the state and source binds resolve: the query store.
     * @returns {object} The store.
     */
    get store() {
        return this._queryStore;
    }

    /**
     * Gets the name of the shown presentation.
     * @returns {string|null} The pane name.
     */
    get _activePane() {
        return this._store.getState().activePane;
    }

    /**
     * Returns the files the control shows.
     * @returns {Array<object>} The files.
     */
    get files() {
        return this._store.getState().files;
    }

    /**
     * Replaces the files the control shows; every presentation follows.
     * @param {Array<object>} value - The files.
     */
    set files(value) {
        this.setState({ files: Array.isArray(value) ? value : [] });
    }

    /**
     * Collects the panes the server contributed: the file list that becomes the
     * list presentation and the additional views. They are read as they are and
     * placed into their pane by the view, rather than rebuilt, so the controls the
     * server rendered keep the instances the controller already created for them.
     * @param {HTMLElement} element - The host element.
     * @returns {object} The collected nodes.
     */
    _collect(element) {
        const children = Array.from(element.children);

        return {
            // the controller consumed the marker class before this control was
            // constructed (children are initialized first), so the host is found
            // by the class the file list gives itself; the marker is the fallback
            // for a control that was constructed by hand
            list: children.find((node) => node.classList
                && (node.classList.contains("wx-file-list") || node.classList.contains("wx-webui-file-list"))) || null,
            views: children.filter((node) => node.classList && node.classList.contains("wx-view"))
        };
    }

    /**
     * Describes one pane per presentation, in the order the server declared them,
     * followed by the additional views.
     * @param {HTMLElement} element - The host element.
     * @param {object} collected - The nodes the server contributed.
     */
    _buildPanes(element, collected) {
        const declared = (element.dataset.views || "list,tile")
            .split(",")
            .map((name) => name.trim().toLowerCase())
            .filter((name) => webexpress.webapp.fileViewModel.presentations[name]);

        const names = declared.length > 0 ? declared : ["list"];

        // the file list the server rendered carries the files the control starts
        // with, whether or not the list is among the presentations offered: a
        // page that shows the tile board alone still shows those files
        const seedHost = collected.list;
        const seedCtrl = seedHost
            ? (webexpress.webui.Controller.getInstanceByElement(seedHost) || new webexpress.webui.FileListCtrl(seedHost))
            : null;

        if (seedCtrl) {
            this.setState({ files: (seedCtrl.files || []).slice() });
        }

        for (const name of names) {
            const presentation = webexpress.webapp.fileViewModel.presentations[name];

            if (name === "list") {
                // without a list the server rendered, the view places a host of its own
                // and the list is instantiated by hand once it stands; the marker class
                // is not added, it would make the controller construct a second instance
                this._listHost = seedHost || document.createElement("div");
                this._listCtrl = seedCtrl;
            }

            this._panes.push({
                name: name,
                label: this._i18n(presentation.label, presentation.fallback),
                description: "",
                icon: this._iconClass(presentation.icon),
                image: null,
                view: null
            });
        }

        if (this._listCtrl) {
            this._listCtrl.descriptionRenderer = (file) => this._descriptionCell(file);
        }

        collected.views.forEach((node, index) => {
            this._panes.push({
                name: `view-${index}`,
                label: node.dataset.label || node.dataset.title || `View ${index + 1}`,
                description: node.dataset.description || "",
                icon: node.dataset.icon ? this._iconClass(node.dataset.icon) : null,
                image: node.dataset.image || null,
                view: node
            });
        });
    }

    /**
     * Builds the presentation switch. It is the shared one, so it looks and behaves
     * the same here as on every other surface that offers several views of one
     * subject; the layout only decides what stands next to it.
     */
    _buildSwitcher() {
        this._switcher = new webexpress.webui.ViewSwitcher({
            views: this._panes.map((pane) => ({
                name: pane.name,
                label: pane.label,
                icon: pane.icon,
                image: pane.image
            })),
            onSelect: (name) => this._activate(name)
        });
    }

    /**
     * Describes the control: the toolbar with the switch, the loading indicator, the
     * panes and the count line.
     * @param {object} state - The current state.
     * @returns {Array<object>} The virtual node tree of the host.
     */
    render(state) {
        const h = webexpress.webui.h;
        const active = this._panes.find((pane) => pane.name === state.activePane) || this._panes[0] || null;
        const total = Number(state.total) || state.files.length;

        return [
            h("div", { key: "toolbar", class: "wx-file-view-toolbar" },
                this._layout === "default" && active && h("div", { key: "title", class: "wx-file-view-title" },
                    h("h5", null, active.label),
                    h("small", { class: "text-muted" }, active.description)),
                webexpress.webui.Renderer.adopt(this._switcher.element)),
            h("div", {
                key: "progress",
                class: "progress wx-file-view-progress",
                role: "status",
                style: { visibility: state.loading ? "visible" : "hidden" }
            }, h("div", { class: "progress-bar progress-bar-striped progress-bar-animated" })),
            h("div", { key: "body", class: "wx-file-view-body" },
                this._panes.map((pane) => h("div", {
                    key: pane.name,
                    class: "wx-file-view-pane",
                    dataset: { view: pane.name },
                    style: { display: active && pane.name === active.name ? "" : "none" }
                }, this._renderPane(state, pane)))),
            h("div", { key: "status", class: "wx-file-view-statusbar" },
                h("div", { class: "text-muted small" },
                    this._i18n("webexpress.webapp:fileview.count", "{0} file(s)").replace("{0}", String(total))))
        ];
    }

    /**
     * Describes the content of a pane: the file list, the tile board or a view the
     * server contributed.
     * @param {object} state - The current state.
     * @param {object} pane - The pane.
     * @returns {object|null} The pane content.
     */
    _renderPane(state, pane) {
        if (pane.view) {
            return webexpress.webui.Renderer.adopt(pane.view);
        }
        if (pane.name === "list") {
            return webexpress.webui.Renderer.adopt(this._listHost);
        }

        return webexpress.webui.h("div", { class: "wx-file-view-tiles" },
            state.files.map((file) => this._renderCard(state, file)));
    }

    /**
     * Describes the card of one file.
     * @param {object} state - The current state.
     * @param {object} file - The file.
     * @returns {object} The card virtual node.
     */
    _renderCard(state, file) {
        const h = webexpress.webui.h;
        const versions = Array.isArray(file.versions) ? file.versions : [];
        const expanded = state.expanded.includes(file.name);

        return h("div", { key: file.name, class: "wx-file-view-card", dataset: { fileName: file.name } },
            h("div", { key: "preview", class: "wx-file-view-card-preview" },
                file.image
                    ? h("img", { src: file.image, alt: file.name })
                    : h("i", { class: this._iconClass(file.icon || "file") })),
            h("a", {
                key: "name",
                class: "wx-file-view-card-name wx-link",
                href: file.uri || "#",
                target: "_blank",
                rel: "noopener noreferrer",
                title: file.name
            }, file.name),
            // the description is a control of its own when it is editable, which keeps
            // its node and is built anew only when the description changed
            h("div", {
                key: "description",
                class: "wx-file-view-card-description",
                keep: true,
                ref: (el) => this._placeDescription(el, file)
            }),
            h("div", { key: "meta", class: "wx-file-view-card-meta" },
                file.size && this._renderMeta("database", file.size),
                file.date && this._renderMeta("calendar", file.date)),
            versions.length > 0 && h("button", {
                key: "versions",
                type: "button",
                class: "wx-file-view-card-versions",
                "aria-expanded": expanded ? "true" : "false",
                on: {
                    click: this._handler("versions", file.name, () => (e) => {
                        e.preventDefault();
                        this._toggleVersions(file.name);
                    })
                }
            },
                h("i", { class: this._iconClass(expanded ? "angle-down" : "chevron-right") }),
                // the count includes the version on the card itself, because that is
                // what a reader counts: how many versions of this file exist
                h("span", null, this._i18n("webexpress.webapp:fileview.versions", "{0} versions").replace("{0}", String(versions.length + 1)))),
            versions.length > 0 && this._renderVersionList(versions, expanded));
    }

    /**
     * Describes the list of the earlier versions of a file. A version is a record of
     * what was, so it is read rather than edited: only its number, its size and its
     * date are shown.
     * @param {Array<object>} versions - The earlier versions, newest first.
     * @param {boolean} expanded - Whether the list is unfolded.
     * @returns {object} The list virtual node.
     */
    _renderVersionList(versions, expanded) {
        const h = webexpress.webui.h;

        return h("ul", { key: "version-list", class: "wx-file-view-card-version-list", style: { display: expanded ? "" : "none" } },
            versions.map((version) => h("li", null,
                h("a", { class: "wx-link", href: version.uri || "#", target: "_blank", rel: "noopener noreferrer" },
                    `v${Number(version.version) || 0}`),
                [version.date, version.size].filter(Boolean).map((text) => h("span", null, text)))));
    }

    /**
     * Describes one labelled metadata chip of a card.
     * @param {string} icon - The symbolic icon name.
     * @param {string} text - The text.
     * @returns {object} The chip virtual node.
     */
    _renderMeta(icon, text) {
        const h = webexpress.webui.h;
        return h("span", { key: icon }, h("i", { class: `${this._iconClass(icon)} text-muted` }), text);
    }

    /**
     * Fills the description slot of a card, anew only when the description changed,
     * so an inline editor is not rebuilt under the hands of the user by a render.
     * @param {HTMLElement} slot - The description slot.
     * @param {object} file - The file.
     */
    _placeDescription(slot, file) {
        const description = file.description || "";
        if (slot._wxDescription === description && slot.firstChild) {
            return;
        }
        slot._wxDescription = description;
        slot.replaceChildren(this._descriptionCell(file));
    }

    /**
     * Folds the earlier versions of a card open or shut.
     * @param {string} name - The file name.
     */
    _toggleVersions(name) {
        const expanded = this.state.expanded;
        this.setState({ expanded: expanded.includes(name) ? expanded.filter((n) => n !== name) : expanded.concat([name]) });
    }

    /**
     * Places what the view cannot describe: the file list instantiated by hand, the
     * files it shows and the active entry of the switch.
     * @param {object} state - The rendered state.
     */
    onMount(state) {
        if (!this._listCtrl && this._listHost) {
            this._listCtrl = new webexpress.webui.FileListCtrl(this._listHost);
            this._listCtrl.descriptionRenderer = (file) => this._descriptionCell(file);
        }
        this.onUpdate(state);
    }

    /**
     * Hands the files to the file list when they changed and marks the active entry
     * of the switch; both are controls of their own.
     * @param {object} state - The rendered state.
     */
    onUpdate(state) {
        if (this._listCtrl && this._listFiles !== state.files) {
            this._listFiles = state.files;
            this._listCtrl.files = state.files;
        }

        if (state.activePane !== null && this._switcher.active !== state.activePane) {
            this._switcher.active = state.activePane;
        }
    }

    /**
     * Shows one pane and hides the others. A listener of the switch may measure the
     * pane it was told about, so the switch is rendered before it is announced.
     * @param {string} name - The pane name.
     */
    _activate(name) {
        const target = this._panes.find((pane) => pane.name === name) || this._panes[0];

        if (!target || this._activePane === target.name) {
            return;
        }

        this.setState({ activePane: target.name });
        this._store.flush();

        this._persistPane(target.name);
        this._dispatch(webexpress.webui.Event.CHANGE_VISIBILITY_EVENT, { view: target.name });
    }

    /**
     * Returns the pane the user last chose, or the first declared one.
     * @returns {string} The pane name.
     */
    _restorePane() {
        const stored = webexpress.webui.LocalStorage.getItem(this._storageKey);

        return this._panes.some((pane) => pane.name === stored)
            ? stored
            : (this._panes[0] ? this._panes[0].name : null);
    }

    /**
     * Remembers the chosen pane, so the control comes back in the presentation
     * the user works in rather than in the one the page declares first.
     * @param {string} name - The pane name.
     */
    _persistPane(name) {
        webexpress.webui.LocalStorage.setItem(this._storageKey, name);
    }

    /**
     * Builds the cell that shows the description of a file, as plain text or as
     * an inline editor. The file list asks for it as well, so it is built as DOM.
     *
     * The wrapper deliberately omits the wx-webui-smart-edit class: the
     * controller instantiates that class as soon as the element is appended,
     * which would race the manual instantiation below. This is the same pattern
     * the table cell renderers use.
     *
     * @param {object} file - The file.
     * @returns {HTMLElement} The cell.
     */
    _descriptionCell(file) {
        if (!this._editable) {
            const text = document.createElement("span");
            text.textContent = file.description || "";

            return text;
        }

        const wrap = document.createElement("div");
        wrap.className = "wx-file-view-description";

        const input = document.createElement("input");
        input.type = "text";
        input.className = "form-control form-control-sm";
        input.value = file.description || "";
        input.placeholder = this._i18n("webexpress.webapp:fileview.description.placeholder", "Description");
        wrap.appendChild(input);

        const ctrl = new webexpress.webui.SmartEditCtrl(wrap);
        ctrl.onSave = (element, value) => this._saveDescription(file, value);

        return wrap;
    }

    /**
     * Applies an edited description to the file and persists it through the
     * update operation of the data service. Without a service the change stays
     * on the client and the host is told about it through the change event, so a
     * view of statically declared files is still editable.
     * @param {object} file - The file whose description changed.
     * @param {string} value - The new description.
     */
    _saveDescription(file, value) {
        const next = (value == null ? "" : String(value)).trim();

        if (next === (file.description || "")) {
            return;
        }

        // the editor that saved may hold a file of an earlier render, so the file is
        // found again by its identity in the files shown now
        const same = (other) => (file.id ? other.id === file.id : other.name === file.name);
        const changed = Object.assign({}, file, { description: next });

        // the other presentation shows the same file, so it follows the edit even
        // while it is hidden
        this.setState({ files: this.files.map((other) => same(other) ? Object.assign({}, other, { description: next }) : other) });
        this._dispatch(webexpress.webui.Event.CHANGE_VALUE_EVENT, { id: file.id, value: next });

        if (!this._service || !file.id) {
            return;
        }

        // the payload names the file rather than the address doing it, so the
        // endpoint stays a single address for the whole set - the same shape the
        // table uses to take its configuration
        const payload = webexpress.webapp.fileViewModel.describePayload(changed, next);

        this._service.update(payload).then((result) => {
            if (!result.ok) {
                console.error("FileViewCtrl update description failed:",
                    webexpress.webapp.ServiceResult.describe(result));
            }
        });
    }

    /**
     * Attaches the control to the enclosing ViewState and renders its resource
     * slice. The ViewState owns the query, the service and the central load, so the
     * files become a pure view that re-renders whenever the ViewState re-queries the
     * resource.
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

            this._unwatchSlice = viewState.watch(
                (state) => viewState.slice(this._resource, state),
                (slice) => this._applySlice(slice));

            this._applySlice(viewState.slice(this._resource));
        });
    }

    /**
     * Renders a resource slice the ViewState loaded centrally. The slice carries
     * the raw response, which is mapped exactly as the standalone load maps it.
     * @param {object} slice - The resource slice { items, total, data, loading, error }.
     */
    _applySlice(slice) {
        slice = slice || {};
        const patch = { total: Number(slice.total) || 0, loading: false };

        if (slice.data) {
            const model = webexpress.webapp.fileViewModel;
            patch.files = model.mergePending(model.groupVersions(model.mapFiles(slice.data)), this.files);
        }

        this.setState(patch);
        this._element.classList.remove("placeholder-glow");
    }

    /**
     * Retrieves the files from the endpoint through the data service. A
     * superseded query is cancelled by the service, so a stale response arrives
     * as an abort result and is ignored here.
     * @returns {Promise<void>} Resolves when the load completed.
     */
    async _receiveData() {
        if (!this._service) {
            return;
        }

        const model = webexpress.webapp.fileViewModel;

        this.setState({ loading: true, error: null });
        this._element.classList.add("placeholder-glow");

        const result = await this._service.query(model.queryParams(this._store.getState()));

        if (!result.ok) {
            // ignore aborts (a newer query replaced this one); report the rest
            if (result.error.kind !== "abort") {
                console.error("FileViewCtrl request failed:", webexpress.webapp.ServiceResult.describe(result));
                this.setState({ loading: false, error: result.error });
                this._element.classList.remove("placeholder-glow");
            }
            return;
        }

        const response = result.data;
        const files = model.mapFiles(response);

        this.setState({
            total: model.reduceTotal(response, files.length, this._page, this._pageSize),
            files: model.mergePending(model.groupVersions(files), this.files),
            loading: false,
            error: null
        });
        this._element.classList.remove("placeholder-glow");

        this._dispatch(webexpress.webui.Event.DATA_ARRIVED_EVENT, { response: response, page: this._page });
    }

    /**
     * Shows a file that has just finished uploading and asks the server for the
     * record behind it. The optimistic entry is what makes the upload visible
     * immediately; the reload replaces it with the file as the server knows it,
     * with its address, its date and its size. Uploading a name that is already
     * there is a new version of that file rather than a second entry.
     * @param {File} file - The uploaded file.
     */
    uploaded(file) {
        const model = webexpress.webapp.fileViewModel;
        const entry = model.fromUpload(file);

        if (entry) {
            this.setState({ files: model.addUpload(this.files, entry) });
        }

        this.load();
    }

    /**
     * Dispatches an intent against the query store and the service, so the binds and
     * the dispatch action all feed the same unidirectional loop.
     * @param {string} name - The intent name.
     * @param {*} payload - The intent payload.
     * @returns {*} The return value of the intent effect, when present.
     */
    dispatch(name, payload) {
        return webexpress.webapp.Intents.dispatch(name, {
            store: this._queryStore,
            payload: payload,
            services: { data: this._service },
            component: this,
            viewState: this._viewState,
            element: this._element
        });
    }

    /**
     * Loads the files when the control is backed by a service.
     * @returns {Promise<void>|undefined} Resolves when the load completed.
     */
    load() {
        if (this._viewState) {
            return this._viewState.reload(this._resource);
        }

        if (this._service) {
            return this._receiveData();
        }

        return undefined;
    }

    /**
     * Updates the control.
     */
    update() {
        this.load();
    }

    /**
     * Sets the search filter and reloads the first page.
     * @param {string} pattern - The search pattern.
     * @param {string} [searchType="basic"] - The filter type.
     */
    search(pattern = "", searchType = "basic") {
        this.dispatch("fileview/search", { pattern: pattern, searchType: searchType });
    }

    /**
     * Sets the filter and reloads the first page.
     * @param {string} pattern - The filter pattern.
     */
    filter(pattern = "") {
        this.dispatch("fileview/filter", { pattern: pattern });
    }

    /**
     * Sets and loads the page.
     * @param {number} page - The page index.
     */
    paging(page = 0) {
        this.dispatch("fileview/page", { page: page });
    }
};

// register the class in the controller
webexpress.webui.Controller.registerClass("wx-webapp-file-view", webexpress.webapp.FileViewCtrl);
