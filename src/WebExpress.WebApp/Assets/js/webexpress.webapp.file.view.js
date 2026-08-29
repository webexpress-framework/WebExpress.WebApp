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
 * The following events are triggered:
 * - webexpress.webui.Event.DATA_ARRIVED_EVENT
 * - webexpress.webui.Event.CHANGE_VISIBILITY_EVENT
 * - webexpress.webui.Event.CHANGE_VALUE_EVENT
 */
webexpress.webapp.FileViewCtrl = class extends webexpress.webui.Ctrl {

    // configuration
    _resource = null;
    _viewState = null;
    _sliceTotal = 0;
    _service = null;
    _layout = "togglegroup";
    _editable = false;
    _storageKey = "";

    // received data
    _files = [];

    // presentations, in the order the switcher offers them
    _panes = [];
    _activePane = null;

    // ui references
    _listCtrl = null;
    _tileHost = null;
    _toolbar = null;
    _body = null;
    _statusbar = null;
    _infoDiv = null;
    _progressDiv = null;
    _switcher = null;
    _title = null;
    _description = null;
    _dataChanges = null;

    /**
     * Constructor for the file view control.
     * @param {HTMLElement} element - The DOM element associated with the control.
     */
    constructor(element) {
        super(element);

        // the islands are read before the children are relocated into the panes,
        // so a consumed island cannot travel into one of them
        const seed = webexpress.webapp.Data.readState(element);
        const services = webexpress.webapp.ServiceRegistry.fromElement(element);

        // the resource an enclosing ViewState renders. when present the files are a
        // pure view of a central resource the ViewState owns; when absent the control
        // owns its state and loads itself
        this._resource = (element.dataset && element.dataset.wxResource) || null;

        this._store = new webexpress.webapp.ViewState(element, {
            standalone: true,
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
                error: null
            }, seed)
        });

        this._service = services.data || null;
        this._editable = element.dataset.editableDescription === "true";
        this._storageKey = `wx_file_view_${element.id || "wx-file-view"}`;

        // the presentations of a file view are few and equal, so the switch
        // stands alone by default; the view control names its active view beside
        // it, which a page asks for with the default layout
        this._layout = (element.dataset.layout || "togglegroup").trim().toLowerCase() === "default"
            ? "default"
            : "togglegroup";

        if (element.dataset.pageSize) {
            const pageSize = parseInt(element.dataset.pageSize, 10);
            this._store.setState({ pageSize: isNaN(pageSize) || pageSize <= 0 ? 50 : pageSize });
        }

        this._buildLayout(element, this._collect(element));

        // the configuration attributes are dropped once the layout stands, so
        // the mounted control carries no markup that repeats its own state
        element.removeAttribute("data-page-size");
        element.removeAttribute("data-editable-description");
        element.removeAttribute("data-views");
        element.removeAttribute("data-layout");

        this._activate(this._restorePane());
        this._render();

        if (this._resource) {
            this._attachToViewState(element);
        } else if (this._service) {
            this._receiveData();

            // an external change of the service's domains re-queries, so files
            // another user added show up here too
            this._dataChanges = webexpress.webapp.DataChangeSubscription.attachReload(
                [this._service], () => this._receiveData(), element);
        }

        this._announce();
    }

    /**
     * Announces the mount, so a bind that targets this control resolves it.
     *
     * The binds of an element run before the controller constructs that
     * element's own instance, so a bind declared on this control - the upload
     * bind above all - finds nothing and waits for this announcement. It is the
     * same event the data component base dispatches; this control extends the
     * plain control base, so it makes the announcement itself.
     *
     * It is deferred by one turn because the controller records the instance
     * only after the constructor returned: a bind resolving from inside the
     * constructor would look the control up and still find nothing.
     */
    _announce() {
        setTimeout(() => {
            if (this._element && typeof this._element.dispatchEvent === "function") {
                this._element.dispatchEvent(new CustomEvent("webexpress.webapp.data.mount", {
                    bubbles: true,
                    detail: { component: this }
                }));
            }
        }, 0);
    }

    /**
     * Releases the subscriptions the control holds.
     */
    destroy() {
        if (this._dataChanges) {
            this._dataChanges.detach();
            this._dataChanges = null;
        }

        if (this._unsubscribe) {
            this._unsubscribe();
            this._unsubscribe = null;
        }

        if (this._service && typeof this._service.abort === "function") {
            this._service.abort();
        }

        super.destroy();
    }

    // state accessors backed by the store, so the single source of truth is the
    // store while the rendering below keeps reading plain fields

    get _search() { return this._store.getState().search; }
    set _search(value) { this._store.setState({ search: value }); }

    get _page() { return this._store.getState().page; }
    set _page(value) { this._store.setState({ page: value }); }

    get _pageSize() { return this._store.getState().pageSize; }
    set _pageSize(value) { this._store.setState({ pageSize: value }); }

    // in ViewState mode the total comes from the resource slice rather than from a
    // top level state key, so several resources in one ViewState keep separate totals
    get _totalRecords() { return this._viewState ? this._sliceTotal : this._store.getState().total; }
    set _totalRecords(value) { this._store.setState({ total: value }); }

    /**
     * Returns the store, which is what the state and source binds resolve.
     * @returns {object} The store.
     */
    get store() {
        return this._store;
    }

    /**
     * Returns the files the control shows.
     * @returns {Array<object>} The files.
     */
    get files() {
        return this._files;
    }

    /**
     * Replaces the files the control shows and redraws every presentation.
     * @param {Array<object>} value - The files.
     */
    set files(value) {
        this._files = Array.isArray(value) ? value : [];

        this._render();
    }

    /**
     * Collects the panes the server contributed: the file list that becomes the
     * list presentation and the additional views. They are read as they are and
     * moved into their pane later, rather than rebuilt, so the controls the
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
     * Builds the toolbar, the panes and the status bar.
     * @param {HTMLElement} element - The host element.
     * @param {object} collected - The nodes the server contributed.
     */
    _buildLayout(element, collected) {
        element.classList.add("wx-file-view");

        this._toolbar = document.createElement("div");
        this._toolbar.className = "wx-file-view-toolbar";

        this._body = document.createElement("div");
        this._body.className = "wx-file-view-body";

        this._progressDiv = document.createElement("div");
        this._progressDiv.className = "progress wx-file-view-progress";
        this._progressDiv.setAttribute("role", "status");
        const bar = document.createElement("div");
        bar.className = "progress-bar progress-bar-striped progress-bar-animated";
        this._progressDiv.appendChild(bar);
        this._progressDiv.style.visibility = "hidden";

        this._statusbar = document.createElement("div");
        this._statusbar.className = "wx-file-view-statusbar";
        this._infoDiv = document.createElement("div");
        this._infoDiv.className = "text-muted small";
        this._statusbar.appendChild(this._infoDiv);

        // appended before the panes are filled: the collected nodes are still
        // children of the host at this point and are moved out of it below
        element.appendChild(this._toolbar);
        element.appendChild(this._progressDiv);
        element.appendChild(this._body);
        element.appendChild(this._statusbar);

        this._buildPanes(element, collected);
        this._buildSwitcher();
    }

    /**
     * Builds one pane per presentation, in the order the server declared them,
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
            this._files = (seedCtrl.files || []).slice();
        }

        for (const name of names) {
            const presentation = webexpress.webapp.fileViewModel.presentations[name];
            const pane = this._createPane(name);

            if (name === "list") {
                const host = seedHost || document.createElement("div");
                pane.appendChild(host);

                // the file list is instantiated by hand when the server did not
                // render one, which is also why the marker class is not added:
                // it would make the controller construct a second instance
                this._listCtrl = seedCtrl || new webexpress.webui.FileListCtrl(host);
                this._listCtrl.descriptionRenderer = (file) => this._descriptionCell(file);
            } else {
                this._tileHost = document.createElement("div");
                this._tileHost.className = "wx-file-view-tiles";
                pane.appendChild(this._tileHost);
            }

            this._panes.push({
                name: name,
                label: this._i18n(presentation.label, presentation.fallback),
                description: "",
                icon: this._iconClass(presentation.icon),
                image: null,
                element: pane
            });
        }

        // a list that is not among the presentations has done its job as the
        // seed; left where the server put it, it would sit beside the panes as a
        // second, unswitchable copy of the files
        if (!this._listCtrl && seedHost && seedHost.parentNode) {
            seedHost.parentNode.removeChild(seedHost);
        }

        collected.views.forEach((node, index) => {
            const pane = this._createPane(`view-${index}`);
            pane.appendChild(node);

            this._panes.push({
                name: `view-${index}`,
                label: node.dataset.label || node.dataset.title || `View ${index + 1}`,
                description: node.dataset.description || "",
                icon: node.dataset.icon ? this._iconClass(node.dataset.icon) : null,
                image: node.dataset.image || null,
                element: pane
            });
        });
    }

    /**
     * Creates an initially hidden pane.
     * @param {string} name - The pane name.
     * @returns {HTMLElement} The pane.
     */
    _createPane(name) {
        const pane = document.createElement("div");
        pane.className = "wx-file-view-pane";
        pane.dataset.view = name;
        pane.style.display = "none";
        this._body.appendChild(pane);

        return pane;
    }

    /**
     * Builds the toolbar: the presentation switch, and - in the default layout -
     * the title and description of the active presentation beside it.
     *
     * The switch itself is the shared one, so it looks and behaves the same here
     * as on every other surface that offers several views of one subject; the
     * layout only decides what stands next to it.
     */
    _buildSwitcher() {
        if (this._layout === "default") {
            const titleGroup = document.createElement("div");
            titleGroup.className = "wx-file-view-title";

            this._title = document.createElement("h5");
            this._description = document.createElement("small");
            this._description.className = "text-muted";
            titleGroup.appendChild(this._title);
            titleGroup.appendChild(this._description);
            this._toolbar.appendChild(titleGroup);
        }

        this._switcher = new webexpress.webui.ViewSwitcher({
            views: this._panes.map((pane) => ({
                name: pane.name,
                label: pane.label,
                icon: pane.icon,
                image: pane.image
            })),
            onSelect: (name) => this._activate(name)
        });

        this._toolbar.appendChild(this._switcher.element);
    }

    /**
     * Shows one pane and hides the others.
     * @param {string} name - The pane name.
     */
    _activate(name) {
        const target = this._panes.find((pane) => pane.name === name) || this._panes[0];

        if (!target || this._activePane === target.name) {
            return;
        }

        this._activePane = target.name;

        for (const pane of this._panes) {
            pane.element.style.display = pane === target ? "" : "none";
        }

        if (this._switcher) {
            this._switcher.active = target.name;
        }

        if (this._title) {
            this._title.textContent = target.label;
            this._description.textContent = target.description;
        }

        this._persistPane(target.name);
        this._dispatch(webexpress.webui.Event.CHANGE_VISIBILITY_EVENT, { view: target.name });
    }

    /**
     * Returns the pane the user last chose, or the first declared one.
     * @returns {string} The pane name.
     */
    _restorePane() {
        const stored = this._readCookie(this._storageKey);

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
        const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
        document.cookie = `${this._storageKey}=${encodeURIComponent(name)}; expires=${expires}; path=/; SameSite=Lax`;
    }

    /**
     * Reads a cookie by name.
     * @param {string} name - The cookie name.
     * @returns {string|null} The value, or null when the cookie is not set.
     */
    _readCookie(name) {
        const match = (document.cookie || "").split(";")
            .map((part) => part.trim())
            .find((part) => part.indexOf(`${name}=`) === 0);

        return match ? decodeURIComponent(match.substring(name.length + 1)) : null;
    }

    /**
     * Redraws every presentation from the files the control holds.
     */
    _render() {
        if (this._listCtrl) {
            this._listCtrl.files = this._files;
        }

        this._renderTiles();
        this._renderInfo();
    }

    /**
     * Redraws the tile board.
     */
    _renderTiles() {
        if (!this._tileHost) {
            return;
        }

        while (this._tileHost.firstChild) {
            this._tileHost.removeChild(this._tileHost.firstChild);
        }

        const fragment = document.createDocumentFragment();

        for (const file of this._files) {
            fragment.appendChild(this._createCard(file));
        }

        this._tileHost.appendChild(fragment);
    }

    /**
     * Builds the card of one file.
     * @param {object} file - The file.
     * @returns {HTMLElement} The card.
     */
    _createCard(file) {
        const card = document.createElement("div");
        card.className = "wx-file-view-card";
        card.dataset.fileName = file.name;

        const preview = document.createElement("div");
        preview.className = "wx-file-view-card-preview";

        if (file.image) {
            const image = document.createElement("img");
            image.src = file.image;
            image.alt = file.name;
            preview.appendChild(image);
        } else {
            const icon = document.createElement("i");
            icon.className = this._iconClass(file.icon || "file");
            preview.appendChild(icon);
        }

        const name = document.createElement("a");
        name.className = "wx-file-view-card-name wx-link";
        name.href = file.uri || "#";
        name.target = "_blank";
        name.rel = "noopener noreferrer";
        name.textContent = file.name;
        name.title = file.name;

        const description = document.createElement("div");
        description.className = "wx-file-view-card-description";
        description.appendChild(this._descriptionCell(file));

        const meta = document.createElement("div");
        meta.className = "wx-file-view-card-meta";

        if (file.size) {
            meta.appendChild(this._createMeta("database", file.size));
        }

        if (file.date) {
            meta.appendChild(this._createMeta("calendar", file.date));
        }

        card.appendChild(preview);
        card.appendChild(name);
        card.appendChild(description);
        card.appendChild(meta);

        const versions = Array.isArray(file.versions) ? file.versions : [];

        if (versions.length > 0) {
            const list = this._createVersionList(versions);
            card.appendChild(this._createVersionToggle(versions.length, list));
            card.appendChild(list);
        }

        return card;
    }

    /**
     * Builds the button that folds the earlier versions of a card open and shut.
     * @param {number} count - The number of earlier versions.
     * @param {HTMLElement} list - The list the button folds.
     * @returns {HTMLElement} The toggle.
     */
    _createVersionToggle(count, list) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "wx-file-view-card-versions";
        button.setAttribute("aria-expanded", "false");

        const icon = document.createElement("i");
        icon.className = this._iconClass("chevron-right");
        button.appendChild(icon);

        const label = document.createElement("span");
        // the count includes the version on the card itself, because that is what
        // a reader counts: how many versions of this file exist
        label.textContent = this._i18n("webexpress.webapp:fileview.versions", "{0} versions")
            .replace("{0}", String(count + 1));
        button.appendChild(label);

        button.addEventListener("click", (e) => {
            e.preventDefault();

            const expanded = button.getAttribute("aria-expanded") === "true";
            button.setAttribute("aria-expanded", expanded ? "false" : "true");
            icon.className = this._iconClass(expanded ? "chevron-right" : "chevron-down");
            list.style.display = expanded ? "none" : "";
        });

        return button;
    }

    /**
     * Builds the folded list of the earlier versions of a file. A version is a
     * record of what was, so it is read rather than edited: only its number, its
     * size and its date are shown.
     * @param {Array<object>} versions - The earlier versions, newest first.
     * @returns {HTMLElement} The list.
     */
    _createVersionList(versions) {
        const list = document.createElement("ul");
        list.className = "wx-file-view-card-version-list";
        list.style.display = "none";

        for (const version of versions) {
            const item = document.createElement("li");

            const label = document.createElement("a");
            label.className = "wx-link";
            label.href = version.uri || "#";
            label.target = "_blank";
            label.rel = "noopener noreferrer";
            label.textContent = `v${Number(version.version) || 0}`;
            item.appendChild(label);

            for (const text of [version.date, version.size]) {
                if (text) {
                    const part = document.createElement("span");
                    part.textContent = text;
                    item.appendChild(part);
                }
            }

            list.appendChild(item);
        }

        return list;
    }

    /**
     * Builds one labelled metadata chip of a card.
     * @param {string} icon - The symbolic icon name.
     * @param {string} text - The text.
     * @returns {HTMLElement} The chip.
     */
    _createMeta(icon, text) {
        const chip = document.createElement("span");
        const glyph = document.createElement("i");
        glyph.className = `${this._iconClass(icon)} text-muted`;
        chip.appendChild(glyph);
        chip.appendChild(document.createTextNode(text));

        return chip;
    }

    /**
     * Builds the cell that shows the description of a file, as plain text or as
     * an inline editor.
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

        file.description = next;

        // the other presentation shows the same file, so it has to follow the
        // edit even while it is hidden
        this._render();
        this._dispatch(webexpress.webui.Event.CHANGE_VALUE_EVENT, { id: file.id, value: next });

        if (!this._service || !file.id) {
            return;
        }

        // the payload names the file rather than the address doing it, so the
        // endpoint stays a single address for the whole set - the same shape the
        // table uses to take its configuration
        const payload = webexpress.webapp.fileViewModel.describePayload(file, next);

        this._service.update(payload).then((result) => {
            if (!result.ok) {
                console.error("FileViewCtrl update description failed:",
                    webexpress.webapp.ServiceResult.describe(result));
            }
        });
    }

    /**
     * Writes the count line below the presentations.
     */
    _renderInfo() {
        if (!this._infoDiv) {
            return;
        }

        const total = Number(this._totalRecords) || this._files.length;

        this._infoDiv.textContent = this._i18n("webexpress.webapp:fileview.count", "{0} file(s)")
            .replace("{0}", String(total));
    }

    /**
     * Attaches the control to the enclosing ViewState and renders its resource
     * slice. The ViewState owns the state, the service and the central load, so the
     * control becomes a pure view that re-renders whenever the ViewState
     * re-queries the resource.
     * @param {HTMLElement} element - The host element.
     */
    _attachToViewState(element) {
        const viewStateId = (element.dataset && element.dataset.wxViewstate) || null;

        webexpress.webapp.ViewStateRegistry.whenReady(element, viewStateId, (viewState) => {
            this._viewState = viewState;
            this._store = viewState;

            const service = viewState.serviceForResource(this._resource);
            if (service) {
                this._service = service;
            }

            this._unsubscribe = viewState.watch(
                (state) => state[this._resource],
                (slice) => this._applySlice(slice));

            this._applySlice(viewState.getState()[this._resource]);
        });
    }

    /**
     * Renders a resource slice the ViewState loaded centrally. The slice carries
     * the raw response, which is mapped exactly as the standalone load maps it.
     * @param {object} slice - The resource slice { items, total, data, loading, error }.
     */
    _applySlice(slice) {
        slice = slice || {};
        this._sliceTotal = Number(slice.total) || 0;

        if (slice.data) {
            const model = webexpress.webapp.fileViewModel;
            this._files = model.mergePending(model.groupVersions(model.mapFiles(slice.data)), this._files);
            this._render();
        }

        this._toggleProgress(false);
    }

    /**
     * Shows or hides the loading indicator.
     * @param {boolean} show - Whether the control is loading.
     */
    _toggleProgress(show) {
        if (this._progressDiv) {
            this._progressDiv.style.visibility = show ? "visible" : "hidden";
        }

        this._element.classList.toggle("placeholder-glow", !!show);
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

        this._store.setState({ loading: true, error: null });
        this._toggleProgress(true);

        const result = await this._service.query(model.queryParams(this._store.getState()));

        if (!result.ok) {
            // ignore aborts (a newer query replaced this one); report the rest
            if (result.error.kind !== "abort") {
                console.error("FileViewCtrl request failed:", webexpress.webapp.ServiceResult.describe(result));
                this._store.setState({ loading: false, error: result.error });
                this._toggleProgress(false);
            }
            return;
        }

        const response = result.data;
        const files = model.mapFiles(response);

        this._totalRecords = model.reduceTotal(response, files.length, this._page, this._pageSize);
        this._files = model.mergePending(model.groupVersions(files), this._files);
        this._render();

        this._dispatch(webexpress.webui.Event.DATA_ARRIVED_EVENT, { response: response, page: this._page });

        this._store.setState({ loading: false, error: null });
        this._toggleProgress(false);
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
            this._files = model.addUpload(this._files, entry);
            this._render();
        }

        this.load();
    }

    /**
     * Dispatches an intent against the control's store and service, mirroring the
     * dispatch surface of the data base, so the binds and the dispatch action all
     * feed the same unidirectional loop.
     * @param {string} name - The intent name.
     * @param {*} payload - The intent payload.
     * @returns {*} The return value of the intent effect, when present.
     */
    dispatch(name, payload) {
        return webexpress.webapp.Intents.dispatch(name, {
            store: this._store,
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
