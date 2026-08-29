/**
 * The link surface of one object: every relation it holds - to other objects
 * and to addresses outside the application alike - grouped by what the relation
 * says and rendered as a list or as a graph, with the dialog that establishes a
 * new one and the dialog that shows what one link carries.
 *
 * The control interprets the generic link structure and nothing else. Which
 * relations exist and which systems may be linked through is answered by the
 * server at request time, so a relation or a whole system a plugin contributed
 * appears here without a change to this file.
 *
 * Declarative configuration: the host carries a wx-service island named "data"
 * for the links of the object, one named "systems" for the sidebar of the add
 * dialog and one named "targets" for the search of the object a link points at.
 *
 * It is ViewState-capable: when the host carries a data-wx-resource binding the
 * links are a slice of an enclosing ViewState, so the control subscribes to that
 * slice and the ViewState owns the central load. Without a binding the control
 * owns its own islands and loads itself (standalone).
 *
 * REST contract:
 *   GET    {data}?type=&system=&status=&q=        → { groups, total, objectCount, externalCount }
 *   POST   {data}    body { system, type, … }     → the created link
 *   PUT    {data}/{id} body { status, comment }   → the updated link
 *   DELETE {data}/{id}                            → 204
 *   GET    {systems}                              → [{ id, label, kind, types, … }]
 *   GET    {targets}?q=&type=&system=&source=     → [{ key, class, title, uri, status }]
 *
 * Events dispatched on the host element:
 *   webexpress.webapp.Event.RELATION_ADDED_EVENT    detail: { link }
 *   webexpress.webapp.Event.RELATION_UPDATED_EVENT  detail: { link }
 *   webexpress.webapp.Event.RELATION_REMOVED_EVENT  detail: { link }
 */
webexpress.webapp.RelationViewCtrl = class extends webexpress.webapp.Data {
    /**
     * Construct a new RelationViewCtrl.
     * @param {HTMLElement} element - host element.
     */
    constructor(element) {
        // the services and the initial state are resolved before super, so the
        // Data base seeds its store from the optional wx-state island and owns
        // the service map
        const services = webexpress.webapp.ServiceRegistry.fromElement(element);
        const initialState = Object.assign({
            view: element.dataset.view || "list",
            groups: [],
            total: 0
        }, webexpress.webapp.Data.readState(element));

        super(element, { state: initialState, services: services });

        this._subject = {
            key: element.dataset.subject || "",
            class: element.dataset.subjectClass || ""
        };
        this._readonly = element.dataset.readonly === "true";

        // every part of the header is on unless the server switched it off, so a
        // surface that carries no attributes at all still has its full header
        this._header = {
            icon: element.dataset.headerIcon !== "false",
            text: element.dataset.headerText !== "false",
            badge: element.dataset.headerBadge !== "false"
        };
        this._resource = (element.dataset && element.dataset.wxResource) || null;

        this._service = this.useService("data");
        this._systemsService = this.useService("systems");
        this._targetsService = this.useService("targets");

        this._systems = [];
        this._dialog = null;
        this._detail = null;
        this._detailTarget = null;
        this._graphCtrl = null;
        this._totalBadge = null;

        // the panes of the contributed presentations are server rendered children
        // of the host, so they are taken out before the host is cleared
        this._panes = Array.from(element.childNodes || [])
            .filter((node) => node.nodeType === 1 && node.classList && node.classList.contains("wx-relation-view-pane"));

        element.textContent = "";
        element.removeAttribute("data-view");
        element.removeAttribute("data-readonly");
        element.removeAttribute("data-header-icon");
        element.removeAttribute("data-header-text");
        element.removeAttribute("data-header-badge");
        element.classList.add("wx-relation-view");

        this._buildDom();
        this._attachEventHandlers();

        this.mount();

        if (this._resource) {
            this._attachToViewState(element);
        } else if (this.state.groups.length === 0) {
            this._load();
        }
    }

    /**
     * Attaches the control to the enclosing ViewState and renders its resource
     * slice. The ViewState owns the central load and the service; establishing
     * and removing a link still persists through the ViewState service and
     * re-queries the resource, so sibling controls refresh with it.
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

            const unsubscribe = viewState.watch((state) => state[this._resource], (slice) => this._applySlice(slice));
            (element._wxCleanup = element._wxCleanup || []).push(unsubscribe);

            this._applySlice(viewState.getState()[this._resource]);
        });
    }

    /**
     * Renders a resource slice the ViewState loaded centrally.
     * @param {object} slice - The resource slice { items, total, data, loading, error }.
     */
    _applySlice(slice) {
        slice = slice || {};

        if (slice.data) {
            this.setState(webexpress.webapp.relationViewModel.normalizeResult(slice.data));
        }
    }

    /**
     * Builds the static scaffold: the toolbar with the presentation switch and
     * the add affordance, and the body the groups or the graph are rendered
     * into.
     */
    _buildDom() {
        this._toolbar = document.createElement("div");
        this._toolbar.className = "wx-relation-view-toolbar";

        const heading = document.createElement("span");
        heading.className = "wx-relation-view-heading";

        if (this._header.icon) {
            heading.appendChild(webexpress.webui.Icon.create(this._iconClass("link"), "wx-relation-view-heading-icon"));
        }

        if (this._header.text) {
            const caption = document.createElement("span");
            caption.className = "wx-relation-view-caption";
            caption.textContent = this._i18n("webexpress.webapp:relation.title", "Links");
            heading.appendChild(caption);
        }

        if (this._header.badge) {
            this._totalBadge = document.createElement("span");
            this._totalBadge.className = "wx-relation-view-total";
            heading.appendChild(this._totalBadge);
        }

        this._viewTabs = document.createElement("div");
        this._viewTabs.className = "wx-relation-view-views";
        this._listTab = this._buildViewTab("list", "list", this._i18n("webexpress.webapp:relation.view.list", "List"));
        this._graphTab = this._buildViewTab("graph", "share-nodes", this._i18n("webexpress.webapp:relation.view.graph", "Graph"));
        this._viewTabs.appendChild(this._listTab);
        this._viewTabs.appendChild(this._graphTab);

        // a contributed presentation states its caption and its icon on the pane
        // itself, so the page declares it once and the switch follows
        for (const pane of this._panes) {
            this._viewTabs.appendChild(this._buildPaneTab(pane));
        }

        this._addButton = document.createElement("button");
        this._addButton.type = "button";
        this._addButton.className = "btn btn-primary wx-relation-view-add";
        this._addButton.appendChild(webexpress.webui.Icon.create(this._iconClass("plus")));
        this._addButton.appendChild(document.createTextNode(this._i18n("webexpress.webapp:relation.add", "Link")));

        // an empty heading would still claim the gap of the toolbar, which is
        // what a page that switched every part off does not want
        if (heading.childNodes.length > 0) {
            this._toolbar.appendChild(heading);
        }

        this._toolbar.appendChild(this._viewTabs);

        if (!this._readonly) {
            this._toolbar.appendChild(this._addButton);
        }

        this._body = document.createElement("div");
        this._body.className = "wx-relation-view-body";

        this._element.appendChild(this._toolbar);
        this._element.appendChild(this._body);

        for (const pane of this._panes) {
            this._element.appendChild(pane);
        }
    }

    /**
     * Builds the switch entry of a contributed presentation from the pane the
     * server rendered.
     * @param {HTMLElement} pane - The pane of the presentation.
     * @returns {HTMLElement} The tab.
     */
    _buildPaneTab(pane) {
        const view = pane.getAttribute("data-view");
        const tab = document.createElement("button");

        tab.type = "button";
        tab.className = "wx-relation-view-view";
        tab.dataset.view = view;
        tab.setAttribute("data-view-tab", view);

        const icon = webexpress.webui.Icon.create(pane.getAttribute("data-image") || pane.getAttribute("data-icon"));
        if (icon) {
            tab.appendChild(icon);
        }

        const text = document.createElement("span");
        text.textContent = pane.getAttribute("data-label") || view;
        tab.appendChild(text);

        return tab;
    }

    /**
     * Builds one presentation tab of the toolbar.
     * @param {string} view - The presentation the tab selects.
     * @param {string} icon - The symbolic icon name.
     * @param {string} label - The caption.
     * @returns {HTMLElement} The tab.
     */
    _buildViewTab(view, icon, label) {
        const tab = document.createElement("button");
        tab.type = "button";
        tab.className = "wx-relation-view-view";
        tab.dataset.view = view;
        tab.setAttribute("data-view-tab", view);
        tab.appendChild(webexpress.webui.Icon.create(this._iconClass(icon)));

        const text = document.createElement("span");
        text.textContent = label;
        tab.appendChild(text);

        return tab;
    }

    /**
     * Wires the toolbar. The rows report through one delegated listener on the
     * body, so a re-rendered group needs no listeners of its own.
     */
    _attachEventHandlers() {
        this._viewTabs.addEventListener("click", (e) => {
            const tab = e.target.closest ? e.target.closest("[data-view-tab]") : null;

            if (tab && tab.getAttribute("data-view-tab") !== this.state.view) {
                this.setState({ view: tab.getAttribute("data-view-tab") });
            }
        });

        this._addButton.addEventListener("click", () => this._openDialog());

        this._body.addEventListener("click", (e) => this._onBodyClick(e));
    }

    /**
     * Renders the surface on the first paint.
     */
    onMount() {
        this._render();
    }

    /**
     * Renders the surface whenever the state changes.
     */
    onUpdate() {
        this._render();
    }

    /**
     * Loads the links of the selected category and the systems the dialog
     * offers. The systems are loaded once and kept, because the catalog does not
     * change while the page is open.
     * @returns {Promise<void>} Resolves when the load completed.
     */
    async _load() {
        if (!this._service) {
            return;
        }

        this._element.classList.add("wx-relation-view-loading");

        const result = await this._service.query(webexpress.webapp.relationViewModel.query(this.state));

        this._element.classList.remove("wx-relation-view-loading");

        if (!result.ok) {
            // a superseded query arrives as an abort and is not an error
            if (result.error.kind === "abort") {
                return;
            }

            console.warn("RelationViewCtrl: load failed", webexpress.webapp.ServiceResult.describe(result));
            this.setState({ groups: [], total: 0 });
            return;
        }

        this.setState(webexpress.webapp.relationViewModel.normalizeResult(result.data));
    }

    /**
     * Loads the registered link systems once.
     * @returns {Promise<Array<object>>} The systems.
     */
    async _loadSystems() {
        if (this._systems.length > 0 || !this._systemsService) {
            return this._systems;
        }

        const result = await this._systemsService.query({});

        if (!result.ok) {
            console.warn("RelationViewCtrl: systems load failed", webexpress.webapp.ServiceResult.describe(result));
            return this._systems;
        }

        this._systems = webexpress.webapp.relationViewModel.normalizeSystems(result.data);

        return this._systems;
    }

    /**
     * Renders the toolbar counters and the body in the selected presentation.
     */
    _render() {
        const state = this.state;
        const contributed = this._paneOf(state.view);

        if (this._totalBadge) {
            this._totalBadge.textContent = String(state.total || 0);
        }

        for (const tab of this._viewTabs.childNodes) {
            tab.classList.toggle("wx-relation-view-active", tab.getAttribute("data-view-tab") === (contributed ? state.view : (state.view === "graph" ? "graph" : "list")));
        }

        // a contributed presentation is server rendered, so switching to it only
        // reveals its pane and puts the built-in body aside
        for (const pane of this._panes) {
            this._toggle(pane, pane === contributed);
        }

        this._toggle(this._body, !contributed);

        if (contributed) {
            return;
        }

        if (state.view === "graph") {
            this._renderGraph(state);
        } else {
            this._renderList(state);
        }
    }

    /**
     * Returns the pane of a contributed presentation, or null for the built-in
     * list and graph.
     * @param {string} view - The selected presentation.
     * @returns {HTMLElement|null} The pane.
     */
    _paneOf(view) {
        return this._panes.find((pane) => pane.getAttribute("data-view") === view) || null;
    }

    /**
     * Shows or hides an element through the hidden attribute the server renders
     * its panes with, so the two agree on one mechanism.
     * @param {HTMLElement} element - The element.
     * @param {boolean} visible - Whether it should be shown.
     */
    _toggle(element, visible) {
        if (visible) {
            element.removeAttribute("hidden");
        } else {
            element.setAttribute("hidden", "hidden");
        }
    }

    /**
     * Renders the groups as the list of relations.
     * @param {object} state - The current state.
     */
    _renderList(state) {
        this._graphCtrl = null;
        this._body.classList.remove("wx-relation-view-body-graph");
        this._body.replaceChildren();

        if (state.groups.length === 0) {
            this._body.appendChild(this._buildEmpty());
            return;
        }

        const fragment = document.createDocumentFragment();

        for (const group of state.groups) {
            fragment.appendChild(this._buildGroup(group));
        }

        this._body.appendChild(fragment);
    }

    /**
     * Renders the same relations as a graph around the object. The model is
     * derived from the loaded groups rather than from a second endpoint, so both
     * presentations always show the same links.
     * @param {object} state - The current state.
     */
    _renderGraph(state) {
        const model = webexpress.webapp.relationViewModel.graph(this._subject, state.groups);

        this._body.classList.add("wx-relation-view-body-graph");

        if (this._graphCtrl) {
            this._graphCtrl.model = model;
            return;
        }

        this._body.replaceChildren();

        const host = document.createElement("div");
        host.className = "wx-relation-view-graph";
        this._body.appendChild(host);

        this._graphCtrl = new webexpress.webui.GraphViewerCtrl(host);
        this._graphCtrl.model = model;
    }

    /**
     * Builds the empty state of the surface.
     * @returns {HTMLElement} The empty state.
     */
    _buildEmpty() {
        const empty = document.createElement("div");
        empty.className = "wx-relation-view-empty";
        empty.textContent = this._i18n("webexpress.webapp:relation.empty", "No links yet");

        return empty;
    }

    /**
     * Builds one relation group: the heading that names the relation from both
     * sides and the rows below it.
     * @param {object} group - The normalised group.
     * @returns {HTMLElement} The group element.
     */
    _buildGroup(group) {
        const element = document.createElement("div");
        element.className = "wx-relation-view-group";

        const head = document.createElement("div");
        head.className = "wx-relation-view-group-head";
        head.appendChild(webexpress.webui.Icon.create(this._iconClass(group.icon), "wx-relation-view-group-icon"));

        const label = document.createElement("span");
        label.className = "wx-relation-view-group-label";
        label.textContent = group.label;
        head.appendChild(label);

        if (group.counterpart) {
            const counterpart = document.createElement("span");
            counterpart.className = "wx-relation-view-group-counterpart";
            counterpart.textContent = this._i18n("webexpress.webapp:relation.counterpart", "counterpart: {0}").replace("{0}", group.counterpart);
            head.appendChild(counterpart);
        }

        const count = document.createElement("span");
        count.className = "wx-relation-view-group-count";
        count.textContent = String(group.count);
        head.appendChild(count);

        element.appendChild(head);

        for (const item of group.items) {
            element.appendChild(this._buildRow(item, group));
        }

        return element;
    }

    /**
     * Builds one link row. The row states the linked object and opens the detail
     * dialog when it is picked; the note, the metadata and the actions live
     * there, so the list stays one line per link and stays scannable.
     * @param {object} item - The normalised link.
     * @param {object} group - The group the link is rendered under.
     * @returns {HTMLElement} The row element.
     */
    _buildRow(item, group) {
        const other = webexpress.webapp.relationViewModel.opposite(item);

        const row = document.createElement("div");
        row.className = "wx-relation-view-row";
        row.dataset.link = item.id;
        row.setAttribute("data-command", "detail");
        row.setAttribute("role", "button");
        row.setAttribute("tabindex", "0");

        if (item.status === "obsolete") {
            row.classList.add("wx-relation-view-obsolete");
        }

        // the relation icon opens the row, so a link stays recognisable by what
        // it says even when the group heading has scrolled out of sight
        row.appendChild(webexpress.webui.Icon.create(this._iconClass(group.icon), "wx-relation-view-row-icon"));

        const key = document.createElement(other.uri ? "a" : "span");
        key.className = "wx-relation-view-key";
        key.textContent = other.key || other.uri;
        if (other.uri) {
            key.href = other.uri;
            if (!other.key) {
                key.target = "_blank";
                key.rel = "noopener noreferrer";
            }
        }
        row.appendChild(key);

        if (other.class) {
            const className = document.createElement("span");
            className.className = "wx-relation-view-class";
            className.textContent = other.class;
            row.appendChild(className);
        }

        const title = document.createElement("span");
        title.className = "wx-relation-view-title";
        title.textContent = other.title;
        row.appendChild(title);

        if (other.status) {
            const status = document.createElement("span");
            status.className = "wx-relation-view-status " + webexpress.webapp.relationViewModel.statusClass(other.statusColor);
            status.textContent = other.status;
            row.appendChild(status);
        }

        const since = document.createElement("span");
        since.className = "wx-relation-view-since";
        since.textContent = this._since(item.created);
        row.appendChild(since);

        row.appendChild(webexpress.webui.Icon.create(this._iconClass("chevron-right"), "wx-relation-view-row-more"));

        return row;
    }

    /**
     * Applies a click inside the body: a row opens the detail dialog. A click on
     * the key follows the link instead, because that is what a link is for.
     * @param {Event} e - The click event.
     */
    _onBodyClick(e) {
        if (e.target.closest && e.target.closest(".wx-relation-view-key")) {
            return;
        }

        const row = e.target.closest ? e.target.closest("[data-command]") : null;

        if (row && row.getAttribute("data-command") === "detail" && row.dataset.link) {
            this._openDetail(row.dataset.link);
        }
    }

    /**
     * Opens the detail dialog of a link: the note it was created with, what a
     * plugin carries on it and the actions that change or drop it. The dialog is
     * the framework modal, built once and refilled for every link.
     * @param {string} id - The link id.
     */
    _openDetail(id) {
        const item = this.value.find((link) => link.id === id);

        if (!item) {
            return;
        }

        if (!this._detail) {
            this._detail = this._buildDetailDialog();
        }

        this._fillDetail(item);
        this._detail.show();
    }

    /**
     * Builds the host and the controller of the detail dialog.
     * @returns {object} The dialog.
     */
    _buildDetailDialog() {
        const host = document.createElement("div");
        host.id = `${this._element.id || "wx-relation-view"}_detail`;
        host.classList.add("wx-relation-view-detail-modal");

        const header = document.createElement("div");
        header.className = "wx-modal-header";
        header.textContent = this._i18n("webexpress.webapp:relation.detail", "Details");

        this._detailBody = document.createElement("div");
        this._detailBody.className = "wx-modal-content wx-relation-view-detail";

        this._detailActions = document.createElement("div");
        this._detailActions.className = "wx-modal-footer wx-relation-view-actions";
        this._detailActions.addEventListener("click", (e) => this._onDetailClick(e));

        host.appendChild(header);
        host.appendChild(this._detailBody);
        host.appendChild(this._detailActions);
        document.body.appendChild(host);

        return new webexpress.webui.ModalCtrl(host);
    }

    /**
     * Fills the detail dialog with one link.
     * @param {object} item - The normalised link.
     */
    _fillDetail(item) {
        const other = webexpress.webapp.relationViewModel.opposite(item);

        this._detailLink = item.id;
        this._detailBody.replaceChildren();

        this._detailBody.appendChild(this._detailRow(
            this._i18n("webexpress.webapp:relation.detail.target", "Linked object"),
            other.key ? `${other.key} - ${other.title}`.trim() : (other.title || other.uri)));

        if (other.status) {
            this._detailBody.appendChild(this._detailRow(
                this._i18n("webexpress.webapp:relation.detail.status", "State"), other.status));
        }

        this._detailBody.appendChild(this._detailRow(
            this._i18n("webexpress.webapp:relation.detail.since", "Linked"),
            this._since(item.created) + (item.createdBy ? ` · ${item.createdBy}` : "")));

        const note = document.createElement("p");
        note.className = "wx-relation-view-note";
        note.textContent = item.comment || this._i18n("webexpress.webapp:relation.note.empty", "No note on this link.");
        this._detailBody.appendChild(note);

        for (const [name, value] of Object.entries(item.metadata || {})) {
            const entry = document.createElement("span");
            entry.className = "wx-relation-view-meta";
            entry.textContent = `${name}: ${value}`;
            this._detailBody.appendChild(entry);
        }

        this._detailTarget = other;
        this._detailActions.replaceChildren();

        // reading where the link points is what the dialog is for, so it is
        // offered on a read-only surface too
        if (other.uri) {
            this._detailActions.appendChild(this._buildAction("navigate", "arrow-up-right-from-square", this._i18n("webexpress.webapp:relation.navigate", "Navigate to")));
        }

        if (this._readonly) {
            return;
        }

        if (item.status === "obsolete") {
            this._detailActions.appendChild(this._buildAction("reactivate", "link", this._i18n("webexpress.webapp:relation.reactivate", "Reactivate")));
        }

        this._detailActions.appendChild(this._buildAction("remove", "unlink", this._i18n("webexpress.webapp:relation.remove", "Remove link"), "danger"));
    }

    /**
     * Builds one labelled line of the detail dialog.
     * @param {string} label - The caption.
     * @param {string} value - The value.
     * @returns {HTMLElement} The line.
     */
    _detailRow(label, value) {
        const row = document.createElement("div");
        row.className = "wx-relation-view-detail-row";

        const caption = document.createElement("span");
        caption.className = "wx-relation-view-detail-label";
        caption.textContent = label;

        const text = document.createElement("span");
        text.className = "wx-relation-view-detail-value";
        text.textContent = value || "";

        row.appendChild(caption);
        row.appendChild(text);

        return row;
    }

    /**
     * Builds one action button of the detail dialog.
     * @param {string} command - The command the click reports.
     * @param {string} icon - The symbolic icon name.
     * @param {string} label - The caption.
     * @param {string} [variant] - The bootstrap variant, for an action that is not reversible.
     * @returns {HTMLElement} The button.
     */
    _buildAction(command, icon, label, variant) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `btn btn-${variant || "secondary"} wx-relation-view-action`;
        button.setAttribute("data-command", command);
        button.appendChild(webexpress.webui.Icon.create(this._iconClass(icon)));
        button.appendChild(document.createTextNode(label));

        return button;
    }

    /**
     * Applies an action of the detail dialog and closes it: what it was showing
     * either changed or was left behind.
     * @param {Event} e - The click event.
     */
    _onDetailClick(e) {
        const button = e.target.closest ? e.target.closest("[data-command]") : null;
        const id = this._detailLink;

        if (!button || !id) {
            return;
        }

        switch (button.getAttribute("data-command")) {
            case "navigate":
                this._navigate(this._detailTarget);
                break;
            case "remove":
                this._remove(id);
                break;
            case "reactivate":
                this._setStatus(id, "active");
                break;
            default:
                return;
        }

        this._detail.hide();
    }

    /**
     * Follows a link to where it points. A linked object of the application is
     * opened in place, because it is the same application; a web link is opened
     * beside it, because leaving the application over a link someone pasted is
     * not what picking it means. This is the rule the key in the list follows
     * too.
     * @param {object} reference - The reference the link points at.
     */
    _navigate(reference) {
        if (!reference || !reference.uri || typeof window === "undefined" || !window.location) {
            return;
        }

        if (reference.key) {
            window.location.href = reference.uri;
        } else {
            window.open(reference.uri, "_blank", "noopener,noreferrer");
        }
    }

    /**
     * Opens the dialog that establishes a new link. The dialog is the framework
     * sidebar modal, assembled the way the editor toolbar assembles its own
     * dialogs: a header, a content area and a footer with the submit button,
     * handed to <c>webexpress.webui.ModalSidebarPanelCtrl</c>, which then owns
     * the sidebar, the page switching, the validation and the submit. The
     * instance is built once and reused.
     *
     * It deliberately does not use the registry autoload of that modal. The
     * pages here depend on what the server answers - which systems exist, which
     * relations they offer, under which names - and the autoload runs inside the
     * modal constructor, before any of that can be attached; the pages would
     * render with an empty relation picker. The control therefore waits for the
     * catalog and adds the pages itself, resolving each one through the same
     * panel registry.
     * @returns {Promise<void>} Resolves when the dialog is open.
     */
    async _openDialog() {
        const systems = await this._loadSystems();

        if (!this._dialog) {
            this._dialog = this._buildDialog(systems);
        }

        this._dialog.show();
    }

    /**
     * Builds the modal host, its controller and one page per usable system.
     * @param {Array<object>} systems - The normalised systems the server offers.
     * @returns {object} The dialog.
     */
    _buildDialog(systems) {
        const id = `${this._element.id || "wx-relation-view"}_dialog`;
        const host = document.createElement("div");

        host.id = id;
        host.setAttribute("aria-labelledby", `${id}-label`);
        host.setAttribute("aria-hidden", "true");
        host.setAttribute("data-submit-id", `${id}-submit`);
        host.setAttribute("data-size", "modal-lg");
        // only the page the user is on is validated; the others carry drafts the
        // user did not intend to submit
        host.setAttribute("data-validate-active-only", "true");
        host.classList.add("wx-relation-view-dialog");

        const header = document.createElement("div");
        header.className = "wx-modal-header";
        header.textContent = this._i18n("webexpress.webapp:relation.dialog.title", "Add link");

        const content = document.createElement("div");
        content.className = "wx-modal-content";

        const footer = document.createElement("div");
        footer.className = "wx-modal-footer";

        const submit = document.createElement("button");
        submit.id = `${id}-submit`;
        submit.type = "button";
        submit.className = "btn btn-primary";
        submit.textContent = this._i18n("webexpress.webapp:relation.dialog.submit", "Link");
        footer.appendChild(submit);

        host.appendChild(header);
        host.appendChild(content);
        host.appendChild(footer);
        document.body.appendChild(host);

        const dialog = new webexpress.webui.ModalSidebarPanelCtrl(host);

        // the back reference the pages reach the surface through, mirroring the
        // link the editor toolbar sets on its own modals; both are attached
        // before the first page is added, because a page renders as it is added
        dialog._linkCtrl = this;
        dialog._linkSystems = systems;

        this._addSystemPages(dialog, systems);

        return dialog;
    }

    /**
     * Adds one page per system the server offers, each rendered by the panel
     * registered for it or, failing that, by the generic panel of its category -
     * which is what lets a plugin contribute a link system without shipping any
     * JavaScript.
     * @param {object} dialog - The dialog.
     * @param {Array<object>} systems - The normalised systems.
     */
    _addSystemPages(dialog, systems) {
        const model = webexpress.webapp.relationViewModel;

        for (const system of systems) {
            // a system that cannot accept links is not offered; the dialog
            // creates links, so a page nobody may submit would only mislead
            if (!system.enabled || dialog._pages.some((page) => page.id === system.id)) {
                continue;
            }

            const panel = model.panelOf(system);

            if (!panel) {
                continue;
            }

            dialog.addPage({
                id: system.id,
                title: system.label,
                iconClass: this._iconClass(system.kind === model.KIND_EXTERNAL ? "arrow-up-right-from-square" : "link"),
                render: (pane, modal) => panel.render(pane, modal, system.id),
                onShow: (modal) => panel.onShow && panel.onShow(modal, system.id),
                validate: (modal) => (panel.validate ? panel.validate(modal, system.id) : null),
                onSubmit: (modal) => panel.onSubmit(modal, system.id)
            });
        }
    }

    /**
     * Establishes a link from the draft a dialog page produced. The framework
     * dialog submits synchronously and closes, so a rejection the server alone
     * can see - a duplicate that appeared meanwhile, an exhausted cardinality -
     * is reported as a notification rather than inside the closed dialog; what
     * the page could check itself was already refused by its validation.
     * @param {object} draft - The draft as { system, type, target, address, title, comment }.
     * @returns {Promise<void>} Resolves when the attempt completed.
     */
    async createLink(draft) {
        if (!this._service) {
            return;
        }

        const result = await this._service.create(webexpress.webapp.relationViewModel.createBody(draft));

        if (!result.ok) {
            webexpress.webapp.relationViewModel.notifyFault(this, result,
                this._i18n("webexpress.webapp:relation.error.create", "The link could not be established."));
            return;
        }

        this._dispatch(webexpress.webapp.Event.RELATION_ADDED_EVENT, { link: result.data });
        await this._reload();
    }

    /**
     * Removes a link and reloads the surface, so the counters and the grouping
     * stay authoritative on the server.
     * @param {string} id - The link id.
     * @returns {Promise<void>} Resolves when the removal completed.
     */
    async _remove(id) {
        if (!this._service) {
            return;
        }

        const result = await this._service.remove({ path: webexpress.webapp.relationViewModel.linkPath(id) });

        if (!result.ok && result.status !== 204) {
            console.warn("RelationViewCtrl: remove failed", webexpress.webapp.ServiceResult.describe(result));
            return;
        }

        this._dispatch(webexpress.webapp.Event.RELATION_REMOVED_EVENT, { link: { id: id } });
        await this._reload();
    }

    /**
     * Moves a link into another lifecycle state. A relation that stopped holding
     * is marked obsolete rather than deleted, because the fact that it once held
     * is part of the history of both objects.
     * @param {string} id - The link id.
     * @param {string} status - The status token.
     * @returns {Promise<void>} Resolves when the change completed.
     */
    async _setStatus(id, status) {
        if (!this._service) {
            return;
        }

        const result = await this._service.update({ status: status }, { path: webexpress.webapp.relationViewModel.linkPath(id) });

        if (!result.ok) {
            console.warn("RelationViewCtrl: update failed", webexpress.webapp.ServiceResult.describe(result));
            return;
        }

        this._dispatch(webexpress.webapp.Event.RELATION_UPDATED_EVENT, { link: result.data });
        await this._reload();
    }

    /**
     * Reloads the surface through whichever path owns the data: the enclosing
     * ViewState when the control is bound, its own service otherwise.
     * @returns {Promise<void>} Resolves when the reload was triggered.
     */
    async _reload() {
        if (this._viewState && this._resource) {
            this._viewState.reload(this._resource);
            return;
        }

        await this._load();
    }

    /**
     * Formats the moment a link was established as the "since" of a row.
     * @param {string} value - The iso timestamp.
     * @returns {string} The formatted caption, or an empty string.
     */
    _since(value) {
        if (!value) {
            return "";
        }

        const date = new Date(value);

        if (isNaN(date.getTime())) {
            return "";
        }

        return this._i18n("webexpress.webapp:relation.since", "since {0}").replace("{0}", date.toLocaleDateString());
    }

    /**
     * Gets the service the dialog pages search their targets through.
     * @returns {object|null} The targets service.
     */
    get targets() {
        return this._targetsService;
    }

    /**
     * Gets the object the surface belongs to, which is the source of every link
     * a dialog page establishes.
     * @returns {object} The object as { key, class }.
     */
    get subject() {
        return this._subject;
    }

    /**
     * Gets the links of the loaded groups, flattened.
     * @returns {Array<object>} The links.
     */
    get value() {
        return this.state.groups.reduce((all, group) => all.concat(group.items), []);
    }
};

// register for declarative auto-init
webexpress.webui.Controller.registerClass("wx-webapp-relation-view", webexpress.webapp.RelationViewCtrl);
