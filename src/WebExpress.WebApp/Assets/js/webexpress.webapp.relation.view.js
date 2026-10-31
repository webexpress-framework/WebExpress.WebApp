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
 * The surface is a pure function of the state (render), patched into the host by the keyed
 * reconciler of the Data base. The view switch, the graph viewer and the server rendered panes are
 * nested parts: the switch and the panes are placed into the tree as they are, the graph viewer
 * lives on a node the reconciler keeps.
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
        // nodes the render captures for imperative work and for the nested graph viewer
        this._graphCtrl = null;
        this._graphHost = null;
        this._body = null;
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

        this._switcher = this._createSwitcher();

        // stable handlers, so a render does not swap the listeners of unchanged nodes
        this._onAdd = () => this._openDialog();
        this._onBodyClick = this._onBodyClick.bind(this);

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
            this.setState(webexpress.webapp.relationViewModel.normalizeResult(slice.data));
        }
    }

    /**
     * Creates the shared presentation switch, so the surface offers its views the way every
     * other one does. The switch is a nested control: its element is placed into the toolbar
     * by the render, and its selection is mirrored in onUpdate.
     * @returns {object} The view switcher.
     */
    _createSwitcher() {
        return new webexpress.webui.ViewSwitcher({
            views: [
                { name: "list", icon: "list", label: this._i18n("webexpress.webapp:relation.view.list", "List") },
                { name: "graph", icon: "share-nodes", label: this._i18n("webexpress.webapp:relation.view.graph", "Graph") },
                // a contributed presentation states its caption and its icon on
                // the pane itself, so the page declares it once and the switch
                // follows
                ...this._panes.map((pane) => ({
                    name: pane.getAttribute("data-view"),
                    label: pane.getAttribute("data-label") || pane.getAttribute("data-view"),
                    icon: pane.getAttribute("data-icon"),
                    image: pane.getAttribute("data-image")
                }))
            ],
            active: this.state.view,
            onSelect: (view) => this.setState({ view: view })
        });
    }

    /**
     * Mirrors the state into what lies outside the rendered tree on the first paint.
     * @param {object} state - The rendered state.
     */
    onMount(state) {
        this._syncNested(state);
    }

    /**
     * Mirrors the state into what lies outside the rendered tree on every later paint.
     * @param {object} state - The rendered state.
     */
    onUpdate(state) {
        this._syncNested(state);
    }

    /**
     * Applies the state to the parts the render does not own: the loading marker on the host,
     * the selection of the switch and the model of the nested graph viewer.
     * @param {object} state - The rendered state.
     */
    _syncNested(state) {
        const contributed = this._paneOf(state.view);

        this._element.classList.toggle("wx-relation-view-loading", !!state.loading);
        this._switcher.active = contributed ? state.view : (state.view === "graph" ? "graph" : "list");

        if (!contributed && state.view === "graph" && this._graphCtrl) {
            // the model is derived from the loaded groups rather than from a second endpoint,
            // so both presentations always show the same links
            this._graphCtrl.model = webexpress.webapp.relationViewModel.graph(this._subject, state.groups);
        } else if (contributed || state.view !== "graph") {
            this._graphCtrl = null;
            this._graphHost = null;
        }
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

        this.setState({ loading: true });

        const result = await this._service.query(webexpress.webapp.relationViewModel.query(this.state));

        if (!result.ok) {
            // a superseded query arrives as an abort and is not an error
            if (result.error.kind === "abort") {
                return;
            }

            console.warn("RelationViewCtrl: load failed", webexpress.webapp.ServiceResult.describe(result));
            this.setState({ groups: [], total: 0, loading: false });
            return;
        }

        this.setState(Object.assign(webexpress.webapp.relationViewModel.normalizeResult(result.data), { loading: false }));
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
     * Renders the toolbar, the body in the selected presentation and the server rendered panes
     * of the contributed presentations, of which only the selected one is shown.
     * @param {object} state - The current state.
     * @returns {Array<object>} The virtual node tree of the host.
     */
    render(state) {
        const h = webexpress.webui.h;
        const adopt = webexpress.webui.Renderer.adopt;
        const contributed = this._paneOf(state.view);
        const graph = !contributed && state.view === "graph";

        const heading = [
            this._header.icon && this._icon("link", "wx-relation-view-heading-icon"),
            this._header.text && h("span", { class: "wx-relation-view-caption" },
                this._i18n("webexpress.webapp:relation.title", "Links")),
            this._header.badge && h("span", {
                class: "wx-relation-view-total",
                ref: (el) => { this._totalBadge = el; }
            }, String(state.total || 0))
        ].filter(Boolean);

        let content = null;
        if (graph) {
            content = h("div", { key: "graph", class: "wx-relation-view-graph", keep: true, ref: (el) => this._mountGraph(el) });
        } else if (!contributed) {
            content = state.groups.length === 0
                ? h("div", { key: "empty", class: "wx-relation-view-empty" }, this._i18n("webexpress.webapp:relation.empty", "No links yet"))
                : state.groups.map((group) => this._renderGroup(group));
        }

        return [
            h("div", { key: "toolbar", class: "wx-relation-view-toolbar" },
                // an empty heading would still claim the gap of the toolbar, which is
                // what a page that switched every part off does not want
                heading.length > 0 && h("span", { class: "wx-relation-view-heading" }, heading),
                adopt(this._switcher.element),
                !this._readonly && h("button", {
                    type: "button",
                    class: "btn btn-primary wx-relation-view-add",
                    on: { click: this._onAdd }
                }, this._icon("plus"), this._i18n("webexpress.webapp:relation.add", "Link"))),
            // a contributed presentation is server rendered, so switching to it only
            // reveals its pane and puts the built-in body aside
            h("div", {
                key: "body",
                class: graph ? "wx-relation-view-body wx-relation-view-body-graph" : "wx-relation-view-body",
                hidden: contributed ? "hidden" : false,
                on: { click: this._onBodyClick },
                ref: (el) => { this._body = el; }
            }, content),
            this._panes.map((pane) => adopt(pane, { hidden: pane === contributed ? false : "hidden" }))
        ];
    }

    /**
     * Creates the graph viewer in a newly rendered graph host; the host is kept from the
     * reconciler, so the viewer owns everything inside it.
     * @param {HTMLElement} host - The graph host.
     */
    _mountGraph(host) {
        if (this._graphHost === host) {
            return;
        }
        this._graphHost = host;
        this._graphCtrl = new webexpress.webui.GraphViewerCtrl(host);
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
     * Renders an icon the way webexpress.webui.Icon builds one: an image for an image source,
     * otherwise an i element carrying the resolved icon classes.
     * @param {string} spec - The symbolic icon name, class string or image source.
     * @param {string} [extraClass] - Extra classes for the icon.
     * @returns {object|null} The icon virtual node, or null without a spec.
     */
    _icon(spec, extraClass) {
        const h = webexpress.webui.h;
        const value = (spec || "").trim();
        if (!value) {
            return null;
        }
        if (webexpress.webui.Icon._isImage(value)) {
            return h("img", { class: ("wx-icon-img " + (extraClass || "")).trim(), src: value, alt: "" });
        }
        return h("i", { class: (this._iconClass(value) + " " + (extraClass || "")).trim() });
    }

    /**
     * Renders one relation group: the heading that names the relation from both
     * sides and the rows below it.
     * @param {object} group - The normalised group.
     * @returns {object} The group virtual node.
     */
    _renderGroup(group) {
        const h = webexpress.webui.h;

        return h("div", { key: group.type + (group.inverse ? "/inverse" : ""), class: "wx-relation-view-group" },
            h("div", { class: "wx-relation-view-group-head" },
                this._icon(group.icon, "wx-relation-view-group-icon"),
                h("span", { class: "wx-relation-view-group-label" }, group.label),
                group.counterpart && h("span", { class: "wx-relation-view-group-counterpart" },
                    this._i18n("webexpress.webapp:relation.counterpart", "counterpart: {0}").replace("{0}", group.counterpart)),
                h("span", { class: "wx-relation-view-group-count" }, String(group.count))),
            group.items.map((item) => this._renderRow(item, group)));
    }

    /**
     * Renders one link row. The row states the linked object and opens the detail
     * dialog when it is picked; the note, the metadata and the actions live
     * there, so the list stays one line per link and stays scannable.
     * @param {object} item - The normalised link.
     * @param {object} group - The group the link is rendered under.
     * @returns {object} The row virtual node.
     */
    _renderRow(item, group) {
        const h = webexpress.webui.h;
        const other = webexpress.webapp.relationViewModel.opposite(item);
        // a web link without an object key leaves the application, so it opens beside it
        const external = other.uri && !other.key;

        // the whole row opens the detail for the pointer; the keyboard reaches the detail
        // through the button at its end, because a row that is itself a button could not
        // hold the link to the object without nesting one control in another
        return h("div", {
            key: item.id,
            class: item.status === "obsolete" ? "wx-relation-view-row wx-relation-view-obsolete" : "wx-relation-view-row",
            dataset: { link: item.id },
            "data-command": "detail"
        },
            // the relation icon opens the row, so a link stays recognisable by what
            // it says even when the group heading has scrolled out of sight
            this._icon(group.icon, "wx-relation-view-row-icon"),
            h(other.uri ? "a" : "span", {
                class: "wx-relation-view-key",
                href: other.uri || null,
                target: external ? "_blank" : null,
                rel: external ? "noopener noreferrer" : null
            }, other.key || other.uri),
            other.class && h("span", { class: "wx-relation-view-class" }, other.class),
            h("span", { class: "wx-relation-view-title" }, other.title),
            other.status && h("span", {
                class: "wx-relation-view-status " + webexpress.webapp.relationViewModel.statusClass(other.statusColor)
            }, other.status),
            h("span", { class: "wx-relation-view-since" }, this._since(item.created)),
            h("button", {
                type: "button",
                class: "wx-relation-view-row-more",
                "aria-label": this._i18n("webexpress.webapp:relation.detail", "Details") + ": " + (other.title || other.key || other.uri || "")
            }, this._icon("chevron-right")));
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
        const host = document.createElement("dialog");
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
     * Fills the detail dialog with one link; body and actions are rendered from the link by
     * the same reconciler the surface uses.
     * @param {object} item - The normalised link.
     */
    _fillDetail(item) {
        const h = webexpress.webui.h;
        const other = webexpress.webapp.relationViewModel.opposite(item);
        const line = (label, value) => h("div", { class: "wx-relation-view-detail-row" },
            h("span", { class: "wx-relation-view-detail-label" }, label),
            h("span", { class: "wx-relation-view-detail-value" }, value || ""));

        this._detailLink = item.id;
        this._detailTarget = other;

        webexpress.webui.Renderer.patch(this._detailBody, [
            line(this._i18n("webexpress.webapp:relation.detail.target", "Linked object"),
                other.key ? `${other.key} - ${other.title}`.trim() : (other.title || other.uri)),
            other.status && line(this._i18n("webexpress.webapp:relation.detail.status", "State"), other.status),
            line(this._i18n("webexpress.webapp:relation.detail.since", "Linked"),
                this._since(item.created) + (item.createdBy ? ` · ${item.createdBy}` : "")),
            h("p", { class: "wx-relation-view-note" },
                item.comment || this._i18n("webexpress.webapp:relation.note.empty", "No note on this link.")),
            Object.entries(item.metadata || {}).map(([name, value]) =>
                h("span", { class: "wx-relation-view-meta" }, `${name}: ${value}`))
        ]);

        // reading where the link points is what the dialog is for, so it is
        // offered on a read-only surface too
        webexpress.webui.Renderer.patch(this._detailActions, [
            other.uri && this._renderAction("navigate", "arrow-up-right-from-square", this._i18n("webexpress.webapp:relation.navigate", "Navigate to")),
            !this._readonly && item.status === "obsolete"
                && this._renderAction("reactivate", "link", this._i18n("webexpress.webapp:relation.reactivate", "Reactivate")),
            !this._readonly && this._renderAction("remove", "unlink", this._i18n("webexpress.webapp:relation.remove", "Remove link"), "danger")
        ]);
    }

    /**
     * Renders one action button of the detail dialog.
     * @param {string} command - The command the click reports.
     * @param {string} icon - The symbolic icon name.
     * @param {string} label - The caption.
     * @param {string} [variant] - The WebExpress variant, for an action that is not reversible.
     * @returns {object} The button virtual node.
     */
    _renderAction(command, icon, label, variant) {
        return webexpress.webui.h("button", {
            key: command,
            type: "button",
            class: `btn btn-${variant || "secondary"} wx-relation-view-action`,
            "data-command": command
        }, this._icon(icon), label);
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
        const host = document.createElement("dialog");

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

        return this._i18n("webexpress.webapp:relation.since", "since {0}").replace("{0}", date.toLocaleDateString(webexpress.webui.I18N.language));
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
