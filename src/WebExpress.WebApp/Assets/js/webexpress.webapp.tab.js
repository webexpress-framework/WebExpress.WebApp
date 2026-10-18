/**
 * A REST-enabled tab control extending the standard tab controller.
 * Fetches tab data from a REST endpoint, instantiates templates, binds data dynamically,
 * and allows creating new tabs via POST requests. The tab headers with their grip, color
 * and "…" glyph, the add button, the tab menus, the rename field and the drag marks are
 * rendered from the state through the hooks of the base; the panes are built from the
 * templates once per payload and placed by the view.
 * The following events are triggered:
 * - webexpress.webapp.Event.TAB_ADDED_EVENT
 * - webexpress.webapp.Event.TAB_CLOSED_EVENT
 * - webexpress.webapp.Event.TAB_REORDERED_EVENT
 * - webexpress.webapp.Event.TAB_RENAMED_EVENT
 * - webexpress.webapp.Event.TAB_RECOLORED_EVENT
 */
webexpress.webapp.TabCtrl = class extends webexpress.webui.TabCtrl {
    static _defaultTemplateIcon = "wx-icon-light wx-icon-light-card";

    // how long an error of a closed menu stays announced, in milliseconds
    static STATUS_DURATION = 6000;

    // configuration
    _restUri = "";
    _viewState = null;
    _readonly = false;
    _movableTab = false;
    _editableTab = false;
    _deletableTab = false;
    _templates = new Map();
    _templateOrder = [];
    _confirm = null;
    _deletingTabId = null;
    _destroyed = false;
    _queryVersion = 0;
    _lastSliceData = null;
    _statusTimer = null;

    // the server-rendered placeholder for an empty tab set
    _emptyStateElement = null;

    // panes built since the last render; their controls are created once they are placed
    _pendingPanes = new Set();

    // nodes captured while rendering
    _addTabButton = null;
    _addTemplateMenu = null;
    _headers = new Map();
    _triggers = new Map();
    _menus = new Map();
    _renameInput = null;

    // the open menu dismisses itself on the pointerdown that precedes a click on its
    // glyph, so whether that click closes it is decided by the state before
    _menuOpenBeforeClick = false;

    // work that needs the nodes of the next render, such as a focus
    _afterRender = [];

    _onAddClick = (e) => {
        e.preventDefault();
        this._createNewTab(this._templateOrder[0] || null);
    };

    _bindTemplateMenu = (menu) => {
        this._addTemplateMenu = menu;
        if (!menu._wxMenuBound) {
            menu._wxMenuBound = true;
            // the browser owns toggle, placement and light dismiss of the menu, and
            // the top layer keeps the open menu out of the header row, which would
            // otherwise stretch every tab header to the height of the menu
            webexpress.webui.NativeMenu.bind(this._addTabButton, menu);
        }
    };

    _onRenameInput = () => {
        const rename = this.state.rename;
        if (rename && this._renameInput) {
            this.setState({ rename: Object.assign({}, rename, { draft: this._renameInput.value }) });
        }
    };

    _onRenameKeyDown = (e) => {
        // the tab list walks its tabs with the arrow keys, which must move the caret here instead
        e.stopPropagation();

        // the enter that picks an ime candidate belongs to the composition, not to the field
        if (e.isComposing || !this.state.rename || this.state.rename.busy) {
            return;
        }

        if (e.key === "Enter") {
            e.preventDefault();
            this._commitRename();
        } else if (e.key === "Escape") {
            e.preventDefault();
            this._closeRename();
        }
    };

    _onRenameBlur = () => {
        // switching to another window blurs the field too, but the edit is not finished then
        if (!document.hasFocus() || !this.state.rename || this.state.rename.busy) {
            return;
        }
        this._commitRename();
    };

    /**
     * Constructor for the REST-enabled TabCtrl class.
     * @param {HTMLElement} element - The DOM element associated with the control.
     */
    constructor(element) {
        // consume the islands before the base constructor reshapes the
        // children; later reads are served from the element cache
        webexpress.webapp.Data.readState(element);
        webexpress.webapp.ServiceRegistry.fromElement(element);

        // the state of the view is the control's own, also inside a ViewState: the
        // ViewState of the region holds the resource slices, and keys such as tabs or
        // menu of every control living there would collide in it
        super(element, {
            store: new webexpress.webapp.ViewState(element, { standalone: true, state: Object.assign({
                loading: false,
                error: null,
                // whether a tab set was applied at all; the placeholder of an empty one
                // must not flash while the first payload is still in flight
                dataApplied: false,
                // a create request in flight
                adding: false,
                // the open tab menu { tabId, level }
                menu: null,
                // the open rename field { tabId, draft, busy, error, box }
                rename: null,
                // a running reorder { tabId, overId, after }
                drag: null,
                // the announcement of an error whose menu has already closed
                status: null
            }, webexpress.webapp.Data.readState(element)) })
        });

        // the resource a ViewState renders. when present, the tabs are a pure view
        // of a central resource the enclosing ViewState owns; when absent the control
        // owns its state and loads itself (standalone).
        this._resource = (element.dataset && element.dataset.wxResource) || null;

        this._readonly = element.dataset.readonly === "true";
        this._movableTab = element.dataset.movableTab === "true";
        this._editableTab = element.dataset.editableTab === "true";
        this._deletableTab = element.dataset.deletableTab === "true";

        for (const name of ["data-readonly", "data-movable-tab", "data-editable-tab", "data-deletable-tab"]) {
            if (element.hasAttribute(name)) {
                element.removeAttribute(name);
            }
        }

        // data service from the wx-service island; a host without it loads
        // nothing. its query, create, update and remove operations back the
        // list, create, reorder and close requests.
        const islandServices = webexpress.webapp.ServiceRegistry.fromElement(element);
        this._service = islandServices.data;
        this._restUri = this._service ? this._service.baseUri : "";

        // extract and store templates
        this._extractTemplates();
        this._extractEmptyState();

        if (!this._resource && this._restUri === "") {
            // without a data source no payload will ever arrive, so the tab set is
            // already known to be empty
            this.setState({ dataApplied: true });
        }

        this._open();

        if (this._resource) {
            // ViewState mode: the enclosing ViewState loads the resource centrally
            this._attachToViewState(element);
        } else if (this._restUri !== "") {
            this._element.classList.add("placeholder-glow");
            this._receiveData();

            // an external change of the service's domains re-queries and
            // flashes, so changes made by other users re-render standalone too
            const dataChanges = webexpress.webapp.DataChangeSubscription.attachReload(
                [this._service], () => this._receiveData(), element);
            if (dataChanges) {
                (element._wxCleanup = element._wxCleanup || []).push(() => dataChanges.detach());
            }
        }
    }

    // loading flag accessor backed by the store, so the single source of truth
    // is the store

    get _isLoading() { return this._store.getState().loading; }
    set _isLoading(value) { this._store.setState({ loading: value }); }

    /**
     * Attaches the tabs to the enclosing ViewState and renders its
     * resource slice. The ViewState owns the resource, the service and the central
     * load, so the tab set re-renders whenever the ViewState re-queries the
     * resource, while create, reorder and close still flow through the ViewState's
     * service.
     * @param {HTMLElement} element The host element.
     */
    _attachToViewState(element) {
        const viewStateId = (element.dataset && element.dataset.wxViewstate) || null;

        webexpress.webapp.ViewStateRegistry.whenReady(element, viewStateId, (viewState) => {
            if (this._destroyed) {
                return;
            }
            this._viewState = viewState;

            const service = viewState.serviceForResource(this._resource);
            if (service) {
                this._service = service;
                this._restUri = service.baseUri;
            }

            const unsubscribe = viewState.watch((state) => viewState.slice(this._resource, state), (slice) => this._applySlice(slice));
            (element._wxCleanup = element._wxCleanup || []).push(unsubscribe);

            this._applySlice(viewState.slice(this._resource));
        });
    }

    /**
     * Renders a resource slice the ViewState loaded centrally, mapping the raw tab
     * payload into the tab set exactly as the standalone load does.
     * @param {object} slice The resource slice { items, total, data, loading, error }.
     */
    _applySlice(slice) {
        if (this._destroyed) {
            return;
        }
        slice = slice || {};

        if (slice.data) {
            if (slice.data !== this._lastSliceData) {
                this._lastSliceData = slice.data;
                this.updateData(webexpress.webapp.tabModel.mapTabs(slice.data));
            }
        } else if (slice.loading === false && !slice.error) {
            // a settled load without a payload is an empty tab set, not a pending
            // one, so the placeholder applies
            this._lastSliceData = null;
            this.updateData([]);
        }

        this._element.classList.toggle("placeholder-glow", slice.loading === true);
    }

    /**
     * Extracts template definitions from the element and removes them from the DOM.
     */
    _extractTemplates() {
        // find all elements acting as templates
        const templateNodes = Array.from(this._element.querySelectorAll(".wx-template, template"));

        for (let i = 0; i < templateNodes.length; i++) {
            const tpl = templateNodes[i];
            const id = tpl.id || "default";
            const icon = tpl.dataset.icon || "";
            const name = tpl.dataset.name || id;
            const description = tpl.dataset.description || "";
            const multiplicity = webexpress.webapp.tabModel.parseMultiplicity(tpl.dataset.multiplicity);

            // store template payload for later instantiation
            this._templates.set(id, {
                id: id,
                html: tpl.innerHTML,
                icon: icon,
                name: name,
                description: description,
                multiplicity: multiplicity
            });

            if (!this._templateOrder.includes(id)) {
                this._templateOrder.push(id);
            }

            // remove template node from dom
            if (tpl.parentNode !== null) {
                tpl.parentNode.removeChild(tpl);
            }
        }
    }

    /**
     * Takes the placeholder for an empty tab set out of the host element. It is
     * authored on the server (ControlEmptyState), so its icon, wording and
     * actions stay with the control declaration instead of being rebuilt here.
     * The server hides it, because only the client knows whether the tab set is
     * empty; the view places it while the tab set is empty.
     */
    _extractEmptyState() {
        const placeholder = this._element.querySelector(":scope > .wx-webapp-tab-empty");

        if (placeholder === null) {
            return;
        }

        placeholder.classList.remove("d-none");

        // the view attaches and detaches it with the tab set; the flag keeps the
        // controller from tearing down the instances of its call-to-action controls,
        // so a placeholder that is shown, hidden and shown again keeps working
        placeholder._wxDetached = true;
        if (placeholder.parentNode !== null) {
            placeholder.parentNode.removeChild(placeholder);
        }

        this._emptyStateElement = placeholder;
    }

    /**
     * Gets the classes of the tab list, which designer styling addresses.
     * @returns {string} The css classes.
     */
    _navClass() {
        return super._navClass() + " wx-form-designer-tabs";
    }

    /**
     * Gets the classes of the header row, over which the rename field is laid.
     * @returns {string} The css classes.
     */
    _headerClass() {
        return super._headerClass() + " wx-webapp-tab-header";
    }

    /**
     * Tells whether the tabs can be reordered by dragging their grip.
     * @returns {boolean} True when movable.
     */
    _movable() {
        return this._movableTab && !this._readonly;
    }

    /**
     * Tells whether the tabs carry the "…" menu, which only makes sense when an entry
     * is allowed.
     * @returns {boolean} True when the tabs have a menu.
     */
    _hasMenu() {
        return !this._readonly && (this._editableTab || this._deletableTab);
    }

    /**
     * Describes the tools: the add button leads, ahead of a toolbar the host may render.
     * @param {object} state The current state.
     * @returns {Array<object>} The tool items.
     */
    _renderTools(state) {
        return [this._readonly ? null : this._renderAddButton(state)].concat(super._renderTools(state));
    }

    /**
     * Describes the add button, a command beside the tab list rather than a tab in it.
     * With several templates it opens a menu of them, each disabled once its
     * multiplicity is used up.
     * @param {object} state The current state.
     * @returns {object} The tool item virtual node.
     */
    _renderAddButton(state) {
        const h = webexpress.webui.h;
        const counts = new Map();
        for (const tab of state.tabs) {
            counts.set(tab.templateId, (counts.get(tab.templateId) || 0) + 1);
        }
        const available = (templateId) => webexpress.webapp.tabModel.isTemplateAvailable(
            this._templates.get(templateId), counts.get(templateId) || 0);
        const anyAvailable = this._templateOrder.length === 0 || this._templateOrder.some(available);
        const label = this._i18n("webexpress.webapp:tab.add", "Add tab");
        const multiple = this._templateOrder.length > 1;

        return h("div", { key: "add", class: "wx-tab-tools-item nav-item" },
            h("button", {
                class: ["nav-link text-primary", !anyAvailable && "disabled"],
                type: "button",
                // a command in the tab list, not a tab: the arrow keys skip it and it keeps its own name
                title: label,
                "aria-label": label,
                disabled: state.adding || !anyAvailable,
                ref: (el) => { this._addTabButton = el; },
                on: multiple ? {} : { click: this._onAddClick }
            }, h("i", { class: state.adding ? this._iconClass("spinner") + " wx-icon-spin" : this._iconClass("plus") })),
            multiple && h("ul", { class: "dropdown-menu", ref: this._bindTemplateMenu },
                this._templateOrder.filter((id) => this._templates.has(id)).map((templateId) => {
                    const tpl = this._templates.get(templateId);
                    const open = available(templateId);
                    return h("li", { key: templateId },
                        h("button", {
                            type: "button",
                            class: ["dropdown-item", !open && "disabled"],
                            disabled: !open,
                            on: {
                                click: this._handler("template", templateId, () => (e) => {
                                    e.preventDefault();
                                    if (this._isTemplateAvailable(templateId)) {
                                        this._createNewTab(templateId);
                                    }
                                })
                            }
                        },
                            h("div", { class: "fw-semibold" }, this._templateIcon(tpl.icon), " " + (tpl.name || tpl.id)),
                            tpl.description && h("small", { class: "d-block text-muted" }, tpl.description)));
                })));
    }

    /**
     * Describes the icon of a template selection entry.
     * @param {string} iconClass The icon classes of the template, empty for the default.
     * @returns {object} The icon virtual node.
     */
    _templateIcon(iconClass) {
        return webexpress.webui.h("i", {
            class: (iconClass || webexpress.webapp.TabCtrl._defaultTemplateIcon).trim().split(/\s+/).join(" ")
        });
    }

    /**
     * Gets the classes, the color and the drop target of a tab header.
     * @param {object} state The current state.
     * @param {object} tab The tab model.
     * @returns {object} The list item props.
     */
    _tabItemProps(state, tab) {
        const drag = state.drag;
        const props = {
            class: [
                tab.tabColor && "wx-webapp-tab-colored",
                this._movable() && "wx-webapp-tab-movable",
                this._hasMenu() && "wx-webapp-tab-has-menu",
                state.rename !== null && state.rename.tabId === tab.id && "wx-webapp-tab-renaming",
                state.menu !== null && state.menu.tabId === tab.id && "wx-menu-open",
                drag !== null && drag.tabId === tab.id && "wx-webapp-tab-dragging",
                drag !== null && drag.overId === tab.id && (drag.after ? "wx-webapp-tab-drop-after" : "wx-webapp-tab-drop-before")
            ],
            // the color only ever lands in a custom property, so a malformed value from
            // the server is ignored by the browser rather than injected
            style: tab.tabColor ? { "--wx-webapp-tab-color": tab.tabColor } : {},
            ref: this._handler("header", tab.id, () => (el) => { this._headers.set(tab.id, el); })
        };

        if (this._movable()) {
            // the whole header is a drop target
            props.on = {
                dragover: this._handler("dragover", tab.id, () => (e) => this._onTabDragOver(e, tab.id)),
                drop: this._handler("drop", tab.id, () => (e) => this._onTabDrop(e, tab.id))
            };
        }

        return props;
    }

    /**
     * Gets the shortcuts of a tab that stand in for its menu glyph: a tab list may hold
     * nothing but tabs, so the glyph is no control of its own, and the keyboard opens
     * the same menu as a context menu and reaches its entries through their shortcuts.
     * @param {object} state The current state.
     * @param {object} tab The tab model.
     * @returns {object|null} The button props, or null without a menu.
     */
    _tabLinkProps(state, tab) {
        if (!this._hasMenu()) {
            return null;
        }

        const shortcuts = ["Shift+F10"];
        if (this._editableTab) {
            shortcuts.push("F2");
        }
        if (this._deletableTab) {
            shortcuts.push("Delete");
        }

        return {
            "aria-keyshortcuts": shortcuts.join(" "),
            on: {
                // the browser raises contextmenu for a right click, the menu key and shift+f10 alike
                contextmenu: this._handler("contextmenu", tab.id, () => (e) => {
                    e.preventDefault();
                    this._openTabMenu(tab.id, true);
                }),
                keydown: this._handler("shortcut", tab.id, () => (e) => {
                    if (e.key === "F2" && this._editableTab) {
                        e.preventDefault();
                        this._startRename(tab.id);
                    } else if (e.key === "Delete" && this._deletableTab) {
                        e.preventDefault();
                        this._closeTab(tab.id);
                    }
                })
            }
        };
    }

    /**
     * Describes the ⠿ grip of a movable tab. Only the grip starts a drag, so clicking
     * the tab to select it keeps working; it sits inside the tab frame, ahead of the
     * icon and the label.
     * @param {object} state The current state.
     * @param {object} tab The tab model.
     * @returns {object|null} The grip virtual node, or null when the tabs do not move.
     */
    _tabLinkLead(state, tab) {
        if (!this._movable()) {
            return null;
        }

        const title = this._i18n("webexpress.webapp:tab.move", "Reorder tab");
        return webexpress.webui.h("span", {
            key: "grip",
            class: "wx-webapp-tab-grip",
            title: title,
            "aria-label": title,
            draggable: "true",
            on: {
                // clicking the grip must not select or activate the tab
                click: this._handler("grip", "", () => (e) => e.stopPropagation()),
                dragstart: this._handler("dragstart", tab.id, () => (e) => this._onTabDragStart(e, tab.id)),
                dragend: this._handler("dragend", "", () => () => this._onTabDragEnd())
            }
        }, "⠿");
    }

    /**
     * Describes the "…" glyph that opens the menu of a tab. The pointer clicks it; it
     * is hidden from assistive technology, which reaches the menu through the tab.
     * @param {object} state The current state.
     * @param {object} tab The tab model.
     * @returns {object|null} The glyph virtual node, or null without a menu.
     */
    _tabItemTail(state, tab) {
        if (!this._hasMenu()) {
            return null;
        }

        const h = webexpress.webui.h;
        return h("span", {
            key: "menu",
            class: "wx-webapp-tab-menu",
            title: this._i18n("webexpress.webapp:tab.menu", "Tab options"),
            "aria-hidden": "true",
            ref: this._handler("trigger", tab.id, () => (el) => { this._triggers.set(tab.id, el); }),
            on: {
                pointerdown: this._handler("trigger-down", tab.id, () => () => {
                    this._menuOpenBeforeClick = this._menus.get(tab.id)?.matches(":popover-open") === true;
                }),
                click: this._handler("trigger-click", tab.id, () => (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!this._menuOpenBeforeClick) {
                        this._openTabMenu(tab.id, false);
                    }
                    this._menuOpenBeforeClick = false;
                })
            }
        }, h("i", { class: this._iconClass("more") }));
    }

    /**
     * Describes what the header row holds beside the tab list: the tab menus, which hold
     * real buttons a tab list may not and are only anchored to the glyph of their tab,
     * the rename field laid over a header, and the status that announces an error.
     * @param {object} state The current state.
     * @returns {Array<object>} The virtual nodes.
     */
    _renderHeaderExtras(state) {
        const h = webexpress.webui.h;
        const menus = this._hasMenu() ? state.tabs.map((tab) => this._renderTabMenu(state, tab)) : [];

        return menus.concat([
            state.rename !== null && this._renderRename(state),
            h("div", { key: "status", class: "wx-webapp-tab-status", role: "alert", hidden: state.status === null }, state.status || "")
        ]);
    }

    /**
     * Describes the menu of a tab on its current level: the top level, or the colors,
     * which drill down in place so no nested flyout has to be positioned.
     * @param {object} state The current state.
     * @param {object} tab The tab model.
     * @returns {object} The menu virtual node.
     */
    _renderTabMenu(state, tab) {
        const level = state.menu !== null && state.menu.tabId === tab.id ? state.menu.level : "root";

        return webexpress.webui.h("ul", {
            key: "menu-" + tab.id,
            class: "dropdown-menu dropdown-menu-end wx-webapp-tab-menu-list",
            "aria-label": this._i18n("webexpress.webapp:tab.menu", "Tab options"),
            // the color entry drills down in place, so a click on an entry must not
            // close the menu; every entry that leaves it closes it itself
            "data-wx-keep-open": "",
            ref: this._handler("menu", tab.id, () => (el) => this._bindTabMenu(tab.id, el)),
            on: { toggle: this._handler("menu-toggle", tab.id, () => (e) => this._onTabMenuToggle(tab.id, e)) }
        }, level === "colors" ? this._renderColorEntries(tab) : this._renderRootEntries(tab));
    }

    /**
     * Describes the top level of a tab menu.
     * @param {object} tab The tab model.
     * @returns {Array<object>} The entries.
     */
    _renderRootEntries(tab) {
        const h = webexpress.webui.h;
        const entries = [];

        if (this._editableTab) {
            entries.push(this._menuEntry(tab.id, "rename", "pen", this._i18n("webexpress.webapp:tab.edit", "Rename tab"),
                () => this._startRename(tab.id)));
            entries.push(h("li", { key: "color" },
                h("button", {
                    type: "button",
                    class: "dropdown-item d-flex align-items-center",
                    on: {
                        click: this._handler("entry-color", tab.id, () => (e) => {
                            e.preventDefault();
                            this._showMenuLevel(tab.id, "colors");
                        })
                    }
                },
                    this._menuIcon("palette"),
                    this._i18n("webexpress.webapp:tab.color", "Color"),
                    h("i", { class: this._iconClass("chevron-right") + " ms-auto ps-3" }))));
        }

        if (this._deletableTab) {
            if (entries.length > 0) {
                entries.push(h("li", { key: "divider" }, h("hr", { class: "dropdown-divider" })));
            }
            entries.push(this._menuEntry(tab.id, "delete", "trash", this._i18n("webexpress.webapp:tab.delete", "Delete tab"),
                () => this._closeTab(tab.id)));
        }

        return entries;
    }

    /**
     * Describes the color level of a tab menu: the way back, "none" and the palette.
     * @param {object} tab The tab model.
     * @returns {Array<object>} The entries.
     */
    _renderColorEntries(tab) {
        const h = webexpress.webui.h;
        const current = tab.tabColor ? tab.tabColor.toLowerCase() : null;

        return [
            h("li", { key: "back" },
                h("button", {
                    type: "button",
                    class: "dropdown-item text-muted d-flex align-items-center",
                    on: {
                        click: this._handler("entry-back", tab.id, () => (e) => {
                            e.preventDefault();
                            this._showMenuLevel(tab.id, "root");
                        })
                    }
                }, h("i", { class: this._iconClass("chevron-left") + " me-2" }), this._i18n("webexpress.webapp:back", "Back"))),
            this._menuEntry(tab.id, "none", tab.tabColor ? null : "check", this._i18n("webexpress.webapp:tab.color.none", "None"),
                () => this._recolorTab(tab.id, null)),
            h("li", { key: "palette" },
                h("div", { class: "wx-webapp-tab-color-grid" },
                    webexpress.webapp.tabModel.COLOR_PALETTE.map((color) => h("button", {
                        key: color,
                        type: "button",
                        class: ["wx-webapp-tab-swatch", current === color && "active"],
                        style: { backgroundColor: color },
                        title: color,
                        "aria-label": color,
                        "aria-current": current === color ? "true" : null,
                        on: {
                            click: this._handler("swatch-" + color, tab.id, () => (e) => {
                                e.preventDefault();
                                this._hideTabMenu(tab.id);
                                this._recolorTab(tab.id, color);
                            })
                        }
                    }))))
        ];
    }

    /**
     * Describes an entry that leaves the menu and runs its action.
     * @param {string} tabId The id of the tab the menu belongs to.
     * @param {string} name The name of the entry, unique within the menu.
     * @param {string|null} icon The symbolic icon name, or null for an indent.
     * @param {string} label The entry label.
     * @param {Function} action The action to run once the menu is closed.
     * @returns {object} The entry virtual node.
     */
    _menuEntry(tabId, name, icon, label, action) {
        const h = webexpress.webui.h;

        return h("li", { key: name },
            h("button", {
                type: "button",
                class: "dropdown-item d-flex align-items-center",
                on: {
                    click: this._handler("entry-" + name, tabId, () => (e) => {
                        e.preventDefault();
                        this._hideTabMenu(tabId);
                        action();
                    })
                }
            }, this._menuIcon(icon), label));
    }

    /**
     * Describes the icon of a menu entry; an entry without one keeps the indent, so
     * the labels stay aligned.
     * @param {string|null} icon The symbolic icon name, or null.
     * @returns {object} The icon virtual node.
     */
    _menuIcon(icon) {
        return webexpress.webui.h("i", { class: (icon ? this._iconClass(icon) + " " : "") + "me-2 wx-webapp-tab-menu-icon" });
    }

    /**
     * Describes the rename field. The field is no tab, and a tab list may hold nothing
     * but tabs, so it lives in the header row and is only laid over the header it
     * renames; the header keeps its place so the row does not jump.
     * @param {object} state The current state.
     * @returns {object|null} The field virtual node, or null when its tab is gone.
     */
    _renderRename(state) {
        const h = webexpress.webui.h;
        const rename = state.rename;
        const tab = state.tabs.find((item) => item.id === rename.tabId);
        if (!tab) {
            return null;
        }
        const errorId = tab.id + "-rename-error";

        return h("div", {
            key: "rename",
            class: "wx-webapp-tab-rename",
            style: { left: rename.box.left + "px", top: rename.box.top + "px", minWidth: rename.box.width + "px" }
        },
            h("input", {
                key: "input",
                type: "text",
                class: "wx-webapp-tab-rename-input",
                value: rename.draft,
                maxlength: String(webexpress.webapp.tabModel.MAX_LABEL_LENGTH),
                "aria-label": this._i18n("webexpress.webapp:tab.rename.label", "Rename tab “{name}”").replace("{name}", () => tab.label),
                readonly: rename.busy,
                "aria-busy": rename.busy ? "true" : null,
                "aria-invalid": rename.error !== null ? "true" : null,
                "aria-describedby": rename.error !== null ? errorId : null,
                ref: (el) => { this._renameInput = el; },
                on: { input: this._onRenameInput, keydown: this._onRenameKeyDown, blur: this._onRenameBlur }
            }),
            h("div", {
                key: "error",
                class: "wx-webapp-tab-rename-error",
                id: errorId,
                role: "alert",
                hidden: rename.error === null
            }, rename.error || ""));
    }

    /**
     * Describes what the pane host holds besides the panes: the placeholder, while the
     * tab set is known to be empty, so an empty control reads as deliberately empty
     * rather than broken.
     * @param {object} state The current state.
     * @returns {object|null} The adopting virtual node, or null.
     */
    _renderContentExtras(state) {
        return this._emptyStateElement !== null && state.dataApplied && state.tabs.length === 0
            ? webexpress.webui.Renderer.adopt(this._emptyStateElement)
            : null;
    }

    /**
     * Follows the first render as any other.
     * @param {object} state The rendered state.
     */
    onMount(state) {
        this.onUpdate(state);
    }

    /**
     * Follows a render with what the DOM has to do itself: the controls of the panes
     * just placed are created, the references of tabs that are gone are dropped, and a
     * focus waiting for its node is placed.
     * @param {object} state The rendered state.
     */
    onUpdate(state) {
        for (const pane of Array.from(this._pendingPanes)) {
            if (pane.parentNode === this._contentElement) {
                this._pendingPanes.delete(pane);
                webexpress.webui.Controller.createInstances(pane);
            }
        }

        const ids = new Set(state.tabs.map((tab) => tab.id));
        for (const map of [this._headers, this._triggers, this._menus]) {
            for (const id of Array.from(map.keys())) {
                if (!ids.has(id)) {
                    map.delete(id);
                }
            }
        }

        const work = this._afterRender;
        this._afterRender = [];
        for (const step of work) {
            step();
        }
    }

    /**
     * Resolves the template by id with fallback to default or first template.
     * @param {string} templateId
     * @returns {Object|null}
     */
    _resolveTemplate(templateId) {
        const template = this._templates.get(templateId);
        if (template) {
            return template;
        }

        // a server item referencing an unknown template renders the fallback,
        // which would otherwise hide the id mismatch behind an empty pane
        if (templateId && this._templates.size > 0) {
            console.warn(`tab template "${templateId}" not found, using fallback; known templates:`, this._templateOrder);
        }

        return this._templates.get("default")
            || (this._templateOrder.length > 0 ? this._templates.get(this._templateOrder[0]) : null);
    }

    /**
     * Counts how many existing tabs were instantiated from the given template.
     * @param {string} templateId
     * @returns {number}
     */
    _countTabsByTemplate(templateId) {
        return this._tabs.filter((tab) => tab.templateId === templateId).length;
    }

    /**
     * Determines whether the given template can be used to create another tab.
     * Templates without a defined multiplicity are treated as unlimited.
     * @param {string} templateId
     * @returns {boolean}
     */
    _isTemplateAvailable(templateId) {
        return webexpress.webapp.tabModel.isTemplateAvailable(
            this._templates.get(templateId), this._countTabsByTemplate(templateId));
    }

    /**
     * Fetches tab data from the configured REST endpoint via GET.
     */
    async _receiveData() {
        if (this._destroyed || this._restUri === "" || !this._service) {
            return;
        }

        this._isLoading = true;
        this._element.classList.add("placeholder-glow");

        const version = ++this._queryVersion;
        const result = await this._service.query({});
        if (this._destroyed || version !== this._queryVersion) {
            return;
        }

        if (!result.ok) {
            // a superseded query arrives as an abort result and is ignored
            if (result.error.kind === "abort") {
                return;
            }

            console.error("request failed:", webexpress.webapp.ServiceResult.describe(result));
            this._element.classList.remove("placeholder-glow");
            this._isLoading = false;
            return;
        }

        this.updateData(webexpress.webapp.tabModel.mapTabs(result.data));

        // remove loading indicators
        this._element.classList.remove("placeholder-glow");
        this._isLoading = false;
    }

    /**
     * Sends a POST request to the server to create a new tab and appends it to the UI.
     * The add button shows the request in flight and refuses a second one meanwhile.
     * @param {string|null} templateId - Optional template id to create the tab from.
     */
    async _createNewTab(templateId = null) {
        if (this._readonly || this._restUri === "" || !this._service || this.state.adding) {
            return;
        }

        // respect template multiplicity limits
        if (templateId !== null && !this._isTemplateAvailable(templateId)) {
            return;
        }

        this.setState({ adding: true });

        const result = await this._service.create(webexpress.webapp.tabModel.createBody(templateId));
        if (this._destroyed) {
            return;
        }

        if (result.ok) {
            const newTab = webexpress.webapp.tabModel.extractNewTab(result.data, templateId);
            if (newTab) {
                const tab = this._addTab(newTab);
                this.selectTab(tab.id);

                // dispatch event to notify other components
                this._dispatch(webexpress.webapp.Event.TAB_ADDED_EVENT, {
                    tabId: tab.id
                });
            } else {
                console.error("failed to create new tab:", "post response did not contain newTab");
            }
        } else {
            console.error("failed to create new tab:", webexpress.webapp.ServiceResult.describe(result));
        }

        this.setState({ adding: false });
    }

    /**
     * Gets a value from binding map or item with fallback to empty string.
     * @param {Object} item - Data item.
     * @param {Object} bindingMap - Flattened binding map.
     * @param {string} key - Property name.
     * @returns {*} Resolved value.
     */
    _resolveBindingValue(item, bindingMap, key) {
        if (Object.prototype.hasOwnProperty.call(bindingMap, key)) {
            return bindingMap[key];
        }

        if (item[key] !== undefined) {
            return item[key];
        }

        return "";
    }

    /**
     * Resolves target elements for a binding and always includes source element.
     * @param {HTMLElement} rootElement - Current bound element.
     * @param {HTMLElement} pane - Pane root.
     * @param {string} targetSelector - Optional selector.
     * @returns {HTMLElement[]} Target elements.
     */
    _resolveBindingTargets(rootElement, pane, targetSelector) {
        const targets = [rootElement];

        if (!targetSelector || targetSelector === "self") {
            return targets;
        }

        const nodes = Array.from(pane.querySelectorAll(targetSelector));
        for (let i = 0; i < nodes.length; i++) {
            if (!targets.includes(nodes[i])) {
                targets.push(nodes[i]);
            }
        }

        return targets;
    }

    /**
     * Applies one normalized binding operation to target elements.
     * @param {HTMLElement[]} targets - Target elements.
     * @param {string} mode - Binding mode.
     * @param {string} name - Optional mode-specific name.
     * @param {*} value - Value to apply.
     */
    _applyBindingToTargets(targets, mode, name, value) {
        const finalValue = value == null ? "" : String(value);

        for (let i = 0; i < targets.length; i++) {
            const target = targets[i];

            if (mode === "text") {
                target.textContent = finalValue;
            } else if (mode === "html") {
                target.innerHTML = finalValue;
            } else if (mode === "attr") {
                if (name) {
                    target.setAttribute(name, finalValue);
                }
            } else if (mode === "prop") {
                if (name) {
                    target[name] = value;
                }
            } else if (mode === "class") {
                if (name) {
                    target.classList.add(finalValue);
                } else {
                    target.className = finalValue;
                }
            } else if (mode === "style") {
                if (name) {
                    target.style.setProperty(name, finalValue);
                }
            } else if (mode === "toggle") {
                if (name) {
                    target.classList.toggle(name, Boolean(value));
                }
            } else {
                target.textContent = finalValue;
            }
        }
    }

    /**
     * Applies all bindings declared in data-wx-bind using per-key attributes:
     * - data-wx-bind-<key>-mode
     * - data-wx-bind-<key>-name
     * - data-wx-bind-<key>-target
     * @param {HTMLElement} el - Bound element.
     * @param {HTMLElement} pane - Pane root.
     * @param {Object} item - Data item.
     * @param {Object} bindingMap - Binding map.
     * @returns {boolean} True if at least one binding was applied.
     */
    _applyBindings(el, pane, item, bindingMap) {
        const bindAttr = el.getAttribute("data-wx-bind");
        if (bindAttr === null) {
            return false;
        }

        const keys = bindAttr.split(",").map(function(s) {
            return s.trim();
        });

        let applied = false;

        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            if (key === "") {
                continue;
            }

            // data-wx-bind is shared with the WebUI bind system (search, filter,
            // paging, show, ...); a bare WebUI bind key carries no item data, so
            // writing its empty value would wipe the host's children including
            // its wx-service/wx-state islands. only bind keys that carry data.
            if (!this._isItemBindingKey(el, item, bindingMap, key)) {
                continue;
            }

            const mode = (el.getAttribute("data-wx-bind-" + key + "-mode") || "text").trim().toLowerCase();
            const name = (el.getAttribute("data-wx-bind-" + key + "-name") || "").trim();
            const targetSelector = (el.getAttribute("data-wx-bind-" + key + "-target") || "self").trim();

            const value = this._resolveBindingValue(item, bindingMap, key);
            const targets = this._resolveBindingTargets(el, pane, targetSelector);

            this._applyBindingToTargets(targets, mode, name, value);
            applied = true;
        }

        return applied;
    }

    /**
     * Determines whether a data-wx-bind key is a tab item binding the tab
     * controller owns, rather than a WebUI bind (search, filter, paging,
     * show, ...) that only shares the attribute name. An item binding either
     * declares per-key template metadata or resolves to a field the item
     * carries; a bare WebUI bind key has neither, so it is left untouched and
     * its host keeps its islands and content.
     * @param {HTMLElement} el - Bound element.
     * @param {Object} item - Data item.
     * @param {Object} bindingMap - Binding map.
     * @param {string} key - The binding key.
     * @returns {boolean} True when the key is a tab item binding.
     */
    _isItemBindingKey(el, item, bindingMap, key) {
        if (el.hasAttribute("data-wx-bind-" + key + "-mode")
            || el.hasAttribute("data-wx-bind-" + key + "-name")
            || el.hasAttribute("data-wx-bind-" + key + "-target")) {
            return true;
        }

        return Object.prototype.hasOwnProperty.call(bindingMap, key)
            || (item != null && item[key] !== undefined);
    }

    /**
     * Removes the tab item-binding metadata from an element after binding,
     * while preserving a WebUI bind (search, filter, paging, show, ...) that
     * shares the data-wx-bind attribute, so its wiring survives the pane build.
     * @param {HTMLElement} el - Bound element.
     * @param {Object} item - Data item.
     * @param {Object} bindingMap - Binding map.
     */
    _cleanupBindingAttributes(el, item, bindingMap) {
        const bindAttr = el.getAttribute("data-wx-bind");
        if (bindAttr === null) {
            return;
        }

        const keys = bindAttr.split(",").map((s) => s.trim()).filter((s) => s !== "");
        const itemKeys = keys.filter((key) => this._isItemBindingKey(el, item, bindingMap, key));

        for (let i = 0; i < itemKeys.length; i++) {
            const key = itemKeys[i];
            el.removeAttribute("data-wx-bind-" + key + "-mode");
            el.removeAttribute("data-wx-bind-" + key + "-name");
            el.removeAttribute("data-wx-bind-" + key + "-target");
        }

        const remainingKeys = keys.filter((key) => !itemKeys.includes(key));
        if (remainingKeys.length > 0) {
            el.setAttribute("data-wx-bind", remainingKeys.join(", "));
        } else {
            el.removeAttribute("data-wx-bind");
        }
    }

    /**
     * Fills the pane with template content and applies unified data binding.
     * @param {HTMLElement} pane - The pane element to populate.
     * @param {Object} item - The tab data item.
     */
    _buildPaneContent(pane, item) {
        const template = this._resolveTemplate(item.templateId || "default");
        const html = template ? template.html : "";
        pane.innerHTML = html;

        // a template renders once on the server, so instantiating it into more
        // than one pane repeats its baked-in ids; uniquify them before the
        // bindings resolve any #id targets and before the controls mount.
        this._uniquifyIds(pane, item.id);

        const bindingMap = (item.binding && typeof item.binding === "object") ? item.binding : {};
        const boundElements = Array.from(pane.querySelectorAll("[data-wx-bind]"));

        // apply all bindings first
        for (let i = 0; i < boundElements.length; i++) {
            this._applyBindings(boundElements[i], pane, item, bindingMap);
        }

        // cleanup after all binding writes
        for (let i = 0; i < boundElements.length; i++) {
            this._cleanupBindingAttributes(boundElements[i], item, bindingMap);
        }
    }

    /**
     * Makes every id defined inside a freshly built pane unique and rewrites the
     * intra-pane references that point at those ids. A template renders once on
     * the server, so several tabs from one template - or a template with a
     * multiplicity above one - would otherwise repeat every baked-in id, and a
     * duplicate id makes a document-global lookup (for example a bind source
     * resolved through document.querySelector) resolve to the wrong pane. Only
     * ids the pane declares are renamed, and only references whose target is one
     * of them, so a reference to a shared element outside the template keeps
     * pointing there.
     * @param {HTMLElement} pane - The pane whose subtree was just built.
     * @param {string} suffix - A per-pane unique suffix; the pane id is unique per tab.
     */
    _uniquifyIds(pane, suffix) {
        const safeSuffix = (suffix != null && String(suffix) !== "")
            ? String(suffix)
            : ("p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));

        // collect the ids the pane defines (querySelectorAll excludes the pane
        // itself, so its own id - already unique per tab - is left alone)
        const owned = Array.from(pane.querySelectorAll("[id]"));
        const rename = new Map();
        for (let i = 0; i < owned.length; i++) {
            const oldId = owned[i].id;
            if (oldId && !rename.has(oldId)) {
                rename.set(oldId, oldId + "__" + safeSuffix);
            }
        }

        if (rename.size === 0) {
            return;
        }

        for (let i = 0; i < owned.length; i++) {
            const next = rename.get(owned[i].id);
            if (next) {
                owned[i].id = next;
            }
        }

        const all = Array.from(pane.querySelectorAll("*"));
        for (let i = 0; i < all.length; i++) {
            this._rewriteIdReferences(all[i], rename);
        }
    }

    /**
     * Rewrites the id references of a single element against a rename map so a
     * pane whose ids were made unique stays internally consistent. Bare-id
     * attributes carry a whitespace separated id list; selector attributes carry
     * a "#id" reference. Only ids present in the map are replaced, so a reference
     * that leaves the pane is preserved.
     * @param {HTMLElement} el - The element to rewrite.
     * @param {Map<string, string>} rename - The old id to new id map.
     */
    _rewriteIdReferences(el, rename) {
        // attributes whose value is a whitespace separated list of bare ids
        const bareIdAttributes = [
            "for", "form", "list", "headers",
            "aria-controls", "aria-labelledby", "aria-describedby", "aria-owns", "aria-activedescendant"
        ];
        for (let i = 0; i < bareIdAttributes.length; i++) {
            const name = bareIdAttributes[i];
            const value = el.getAttribute(name);
            if (value === null) {
                continue;
            }
            const rewritten = value.split(/\s+/).map((token) => rename.get(token) || token).join(" ");
            if (rewritten !== value) {
                el.setAttribute(name, rewritten);
            }
        }

        // snapshot the names first, since the values are rewritten in place
        const attributeNames = Array.from(el.attributes || []).map((attr) => attr.name);
        for (let i = 0; i < attributeNames.length; i++) {
            const name = attributeNames[i];
            const value = el.getAttribute(name);
            if (typeof value !== "string" || value.indexOf("#") === -1) {
                continue;
            }

            let rewritten = value;

            // "#id" selector references, only on the data-wx-source family, the
            // tab template binding targets and the WebExpress and framework target
            // attributes, so a value that merely contains "#" (a colour, a
            // fragment) is not misread as a selector
            const isSelectorAttribute = name === "href"
                || name === "data-wx-target"
                || name === "data-wx-parent"
                || name === "data-wx-target"
                || name === "data-wx-source"
                || name.startsWith("data-wx-source-")
                || (name.startsWith("data-wx-bind-") && name.endsWith("-target"));
            if (isSelectorAttribute) {
                rewritten = rewritten.replace(/#([\w-]+)/g, (match, id) => {
                    const next = rename.get(id);
                    return next ? "#" + next : match;
                });
            }

            // svg "url(#id)" references may sit in any attribute, style included
            if (rewritten.indexOf("url(") !== -1) {
                rewritten = rewritten.replace(/(url\(\s*['"]?#)([\w-]+)/g, (match, prefix, id) => {
                    const next = rename.get(id);
                    return next ? prefix + next : match;
                });
            }

            if (rewritten !== value) {
                el.setAttribute(name, rewritten);
            }
        }
    }

    /**
     * Public API to update the entire tab view with new data from the server. The panes
     * are built anew from their templates, the headers of tabs that stay keep their
     * nodes, so a refresh neither moves the focus nor closes a menu or a rename field
     * whose tab is still there.
     * @param {Array<Object>} tabs - The array of tab definition objects.
     */
    updateData(tabs) {
        if (this._destroyed || !Array.isArray(tabs)) {
            return;
        }

        const remembered = this.state.activeTabId || webexpress.webui.LocalStorage.getItem(this._storageKey);

        for (const tab of this._tabs) {
            this._removeTabElements(tab.id);
        }

        const next = tabs.map((item) => this._buildTab(item));
        const ids = new Set(next.map((tab) => tab.id));
        const rename = this.state.rename;
        const menu = this.state.menu;

        this.setState({
            tabs: next,
            activeTabId: null,
            dataApplied: true,
            // a field or a menu of a tab the refresh removed has nothing left to act on
            rename: rename !== null && ids.has(rename.tabId) ? rename : null,
            menu: menu !== null && ids.has(menu.tabId) ? menu : null
        });

        // rebuilt panes need their active classes even when the selected id did not change
        if (next.length > 0) {
            this.selectTab(next.some((tab) => tab.id === remembered) ? remembered : next[0].id);
        }
    }

    /**
     * Builds the pane of a tab item from its template and returns the tab model. The
     * pane is placed by the next render, which also creates its controls.
     * @param {Object} item - The tab data item.
     * @returns {object} The tab model.
     */
    _buildTab(item) {
        const pane = document.createElement("div");
        pane.id = item.id || "wx-tab-rest-" + Date.now();
        pane.className = "tab-pane fade";
        pane.setAttribute("role", "tabpanel");
        pane.setAttribute("aria-labelledby", pane.id + "-tab");
        pane.setAttribute("tabindex", "0");

        // apply template and bindings via dom
        this._buildPaneContent(pane, item);

        this._panes.set(pane.id, pane);
        this._paneClasses.set(pane.id, pane.className);
        this._pendingPanes.add(pane);

        return {
            id: pane.id,
            label: item.label || item.title || item.name || "unnamed tab",
            icon: item.icon || null,
            color: item.color || null,
            tabColor: item.tabColor || null,
            badge: item.badge != null ? String(item.badge) : null,
            badgeColor: item.badgeColor || null,
            badgeStyle: item.badgeStyle || null,
            primaryAction: item.primaryAction || null,
            primaryTarget: item.primaryTarget || null,
            templateId: item.templateId || null
        };
    }

    /**
     * Appends a tab built from a single item, as a created tab arrives.
     * @param {Object} item - The tab data item.
     * @returns {object} The tab model.
     */
    _addTab(item) {
        const tab = this._buildTab(item);
        this.setState({ tabs: this._tabs.concat([tab]) });
        return tab;
    }

    /**
     * Changes fields of one tab model.
     * @param {string} tabId - The tab id.
     * @param {object} fields - The changed fields.
     */
    _patchTab(tabId, fields) {
        this.setState({ tabs: this._tabs.map((tab) => tab.id === tabId ? Object.assign({}, tab, fields) : tab) });
    }

    /**
     * Gets the button of a tab header.
     * @param {string|null} tabId - The tab id.
     * @returns {HTMLElement|null} The button, or null.
     */
    _linkOf(tabId) {
        const header = tabId !== null ? this._headers.get(tabId) : null;
        return header ? header.querySelector(".nav-link") : null;
    }

    /**
     * Binds a tab menu to the glyph of its tab the first time it is rendered.
     * @param {string} tabId - The tab id.
     * @param {HTMLElement} menu - The menu element.
     */
    _bindTabMenu(tabId, menu) {
        this._menus.set(tabId, menu);
        if (!menu._wxMenuBound && this._triggers.has(tabId)) {
            menu._wxMenuBound = true;
            webexpress.webui.NativeMenu.bind(this._triggers.get(tabId), menu, null);
        }
    }

    /**
     * Opens the "…" menu of a tab on its top level.
     * @param {string} tabId - The tab id.
     * @param {boolean} focusFirst - Whether the keyboard opened it and needs the first entry.
     */
    _openTabMenu(tabId, focusFirst) {
        const menu = this._menus.get(tabId);
        if (this._destroyed || !menu || !this._tabs.some((tab) => tab.id === tabId)) {
            return;
        }

        webexpress.webui.NativeMenu.show(menu);

        if (focusFirst) {
            menu.querySelector(".dropdown-item")?.focus({ preventScroll: true });
        }
    }

    /**
     * Closes the menu of a tab.
     * @param {string} tabId - The tab id.
     */
    _hideTabMenu(tabId) {
        const menu = this._menus.get(tabId);
        if (menu) {
            webexpress.webui.NativeMenu.hide(menu);
        }
    }

    /**
     * Follows the browser opening and closing a tab menu. A closed menu returns to its
     * top level, and the focus to the tab: the glyph is no focus target, so the browser
     * has nowhere to return it to, unless an entry moved it on purpose.
     * @param {string} tabId - The tab id.
     * @param {Event} e - The toggle event.
     */
    _onTabMenuToggle(tabId, e) {
        if (e.newState === "open") {
            this.setState({ menu: { tabId: tabId, level: "root" } });
            return;
        }

        if (this.state.menu !== null && this.state.menu.tabId === tabId) {
            this.setState({ menu: null });
        }

        const menu = this._menus.get(tabId);
        const active = document.activeElement;
        if (active === null || active === document.body || (menu && menu.contains(active))) {
            this._linkOf(tabId)?.focus({ preventScroll: true });
        }
    }

    /**
     * Shows another level of an open tab menu in place and moves the focus to its first
     * entry once it is rendered.
     * @param {string} tabId - The tab id.
     * @param {string} level - The level: "root" or "colors".
     */
    _showMenuLevel(tabId, level) {
        this.setState({ menu: { tabId: tabId, level: level } });
        this._afterRender.push(() => {
            this._menus.get(tabId)?.querySelector(".dropdown-item")?.focus({ preventScroll: true });
        });
    }

    /**
     * Persists a tab color via PUT and shows it once the server accepted it. A
     * refused change is announced, because the menu that asked for it is gone.
     * @param {string} tabId - The id of the tab.
     * @param {string|null} color - The palette color, or null for none.
     * @returns {Promise<boolean>} Whether the color took effect.
     */
    async _recolorTab(tabId, color) {
        if (this._readonly || !this._editableTab || this._destroyed || !this._tabs.some(item => item.id === tabId) || (this._resource && !this._service)) {
            return false;
        }

        if (this._service) {
            const result = await this._service.update(webexpress.webapp.tabModel.colorBody(tabId, color));
            if (!result.ok) {
                if (result.error.kind !== "abort") {
                    console.error("failed to change the tab color:", webexpress.webapp.ServiceResult.describe(result));
                    this._announceError(this._i18n("webexpress.webapp:tab.color.error", "The tab color could not be changed. Please try again."));
                }
                return false;
            }
        }

        if (this._destroyed) {
            return false;
        }

        // a load that finished while the request was pending rebuilt the tab set, so the
        // color goes to whatever tab carries the id now
        this._patchTab(tabId, { tabColor: color || null });

        if (this._viewState) {
            this._patchSliceItem(tabId, { tabColor: color });
        } else {
            // a GET still in flight was answered before the change and would undo it
            this._queryVersion++;
            this._isLoading = false;
            this._element.classList.remove("placeholder-glow");
        }

        this._dispatch(webexpress.webapp.Event.TAB_RECOLORED_EVENT, { tabId: tabId, color: color });
        return true;
    }

    /**
     * Announces an error of an action whose own surface has already closed. The
     * message sits beside the tab list and leaves after a while, so it does not
     * linger over content the user has moved on to.
     * @param {string} message - The translated message.
     */
    _announceError(message) {
        this.setState({ status: message });

        clearTimeout(this._statusTimer);
        this._statusTimer = setTimeout(() => {
            if (!this._destroyed) {
                this.setState({ status: null });
            }
        }, webexpress.webapp.TabCtrl.STATUS_DURATION);
    }

    /**
     * Starts a tab drag from the grip.
     * @param {DragEvent} e - The dragstart event.
     * @param {string} tabId - The dragged tab id.
     */
    _onTabDragStart(e, tabId) {
        this.setState({ drag: { tabId: tabId, overId: null, after: false } });

        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = "move";
            try {
                e.dataTransfer.setData("text/plain", tabId);
            } catch (err) {
                // some browsers restrict setData; the drag still works through the state
            }
        }
    }

    /**
     * Ends a tab drag and with it its marks.
     */
    _onTabDragEnd() {
        this.setState({ drag: null });
    }

    /**
     * Marks the side of a tab header the dragged tab would be inserted on.
     * @param {DragEvent} e - The dragover event.
     * @param {string} tabId - The hovered tab id.
     */
    _onTabDragOver(e, tabId) {
        const drag = this.state.drag;
        if (drag === null) {
            return;
        }

        e.preventDefault();
        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = "move";
        }

        const after = this._dropsAfter(e, tabId);
        if (drag.overId !== tabId || drag.after !== after) {
            this.setState({ drag: Object.assign({}, drag, { overId: tabId, after: after }) });
        }
    }

    /**
     * Reorders the tabs on a drop on a tab header.
     * @param {DragEvent} e - The drop event.
     * @param {string} tabId - The target tab id.
     */
    _onTabDrop(e, tabId) {
        const drag = this.state.drag;
        if (drag === null) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        const after = this._dropsAfter(e, tabId);
        this.setState({ drag: Object.assign({}, drag, { overId: null }) });

        if (drag.tabId !== tabId) {
            this._moveTab(drag.tabId, tabId, after);
        }
    }

    /**
     * Tells on which side of a tab header the pointer of a drag is.
     * @param {DragEvent} e - The drag event.
     * @param {string} tabId - The tab whose header is under the pointer.
     * @returns {boolean} True for the trailing half.
     */
    _dropsAfter(e, tabId) {
        const header = this._headers.get(tabId);
        if (!header) {
            return false;
        }
        const rect = header.getBoundingClientRect();
        return e.clientX > rect.left + rect.width / 2;
    }

    /**
     * Moves a tab relative to a target tab, then persists the new order.
     * @param {string} draggedId - The id of the dragged tab.
     * @param {string} targetId - The id of the target tab.
     * @param {boolean} after - Whether to insert after (true) or before (false) the target.
     */
    _moveTab(draggedId, targetId, after) {
        const tabs = this._tabs.slice();
        const fromIndex = tabs.findIndex((t) => t.id === draggedId);
        if (fromIndex < 0 || draggedId === targetId || !tabs.some((t) => t.id === targetId)) {
            return;
        }

        const moved = tabs.splice(fromIndex, 1)[0];
        const toIndex = tabs.findIndex((t) => t.id === targetId) + (after ? 1 : 0);
        tabs.splice(toIndex, 0, moved);

        this.setState({ tabs: tabs });
        this._persistOrder();
    }

    /**
     * Persists the current tab order to the server via PUT.
     */
    _persistOrder() {
        if (this._restUri === "" || !this._service) {
            return;
        }

        const order = this._tabs.map((t) => t.id);

        this._service.update(webexpress.webapp.tabModel.reorderBody(order)).then((result) => {
            if (result.ok) {
                // notify external components about the new order
                this._dispatch(webexpress.webapp.Event.TAB_REORDERED_EVENT, {
                    order: order
                });
            } else if (result.error.kind !== "abort") {
                console.error("failed to persist tab order:", webexpress.webapp.ServiceResult.describe(result));
            }
        });
    }

    /**
     * Opens the rename field over a tab header and places the focus in it, with the
     * label selected.
     * @param {string|Object} tabOrId - The tab id, or the tab model.
     */
    _startRename(tabOrId) {
        const tabId = typeof tabOrId === "string" ? tabOrId : (tabOrId && tabOrId.id);
        const tab = this._tabs.find((item) => item.id === tabId);
        const header = this._headers.get(tabId);
        if (this._readonly || !this._editableTab || this._destroyed || !tab || !header || this.state.rename !== null || this._headerElement === null) {
            return;
        }

        const headerRect = this._headerElement.getBoundingClientRect();
        const rect = header.getBoundingClientRect();

        this.setState({
            rename: {
                tabId: tabId,
                draft: tab.label,
                busy: false,
                error: null,
                box: { left: rect.left - headerRect.left, top: rect.top - headerRect.top, width: rect.width }
            }
        });

        this._afterRender.push(() => {
            if (this._renameInput) {
                this._renameInput.focus({ preventScroll: true });
                this._renameInput.select();
            }
        });
    }

    /**
     * Sends an accepted label and keeps the field open until the server answers,
     * so a refused rename can be told and retried where it was typed.
     * @returns {Promise<void>}
     */
    async _commitRename() {
        const rename = this.state.rename;
        if (rename === null || rename.busy) {
            return;
        }

        const tab = this._tabs.find((item) => item.id === rename.tabId);
        const value = this._renameInput ? this._renameInput.value : rename.draft;
        const label = webexpress.webapp.tabModel.normalizeLabel(value);
        if (!tab || label === null || label === tab.label) {
            this._closeRename();
            return;
        }

        this.setState({ rename: Object.assign({}, rename, { draft: value, busy: true, error: null }) });

        const renamed = await this._renameTab(tab.id, label);

        // a refresh that removed the tab, or a teardown, already closed the field
        const current = this.state.rename;
        if (this._destroyed || current === null || current.tabId !== rename.tabId) {
            return;
        }

        if (renamed) {
            this._closeRename();
            return;
        }

        this.setState({
            rename: Object.assign({}, current, {
                busy: false,
                error: this._i18n("webexpress.webapp:tab.rename.error", "The tab could not be renamed. Please try again.")
            })
        });
    }

    /**
     * Closes the rename field. Focus returns to the tab only when the field still
     * holds it; a field left by a click elsewhere must not pull focus back.
     */
    _closeRename() {
        const rename = this.state.rename;
        if (rename === null) {
            return;
        }

        const hadFocus = this._renameInput !== null && document.activeElement === this._renameInput;
        this.setState({ rename: null });

        if (hadFocus) {
            this._afterRender.push(() => {
                this._linkOf(rename.tabId)?.focus({ preventScroll: true });
            });
        }
    }

    /**
     * Persists a new label via PUT and shows it once the server accepted it.
     * @param {string} tabId - The id of the renamed tab.
     * @param {string} label - The new label.
     * @returns {Promise<boolean>} Whether the rename took effect.
     */
    async _renameTab(tabId, label) {
        if (this._readonly || !this._editableTab || this._destroyed || !this._tabs.some(item => item.id === tabId) || (this._resource && !this._service)) {
            return false;
        }

        if (this._service) {
            const result = await this._service.update(webexpress.webapp.tabModel.renameBody(tabId, label));
            if (!result.ok) {
                if (result.error.kind !== "abort") {
                    console.error("failed to rename tab:", webexpress.webapp.ServiceResult.describe(result));
                }
                return false;
            }
        }

        if (this._destroyed) {
            return false;
        }

        // a load that finished while the request was pending rebuilt the tab set with
        // the old label, so the label is applied to whatever tab carries the id now
        this.setTabLabel(tabId, label);

        if (this._viewState) {
            this._patchSliceItem(tabId, { label: label });
        } else {
            // a GET still in flight was answered before the rename and would undo it
            this._queryVersion++;
            this._isLoading = false;
            this._element.classList.remove("placeholder-glow");
        }

        this._dispatch(webexpress.webapp.Event.TAB_RENAMED_EVENT, { tabId: tabId, label: label });
        return true;
    }

    /**
     * Writes changed fields of one tab into the central slice, so other views of
     * the resource and later re-renders show them. The header already shows them,
     * which is why the patched slice is marked as applied rather than rebuilding
     * every pane.
     * @param {string} tabId - The changed tab id.
     * @param {object} fields - The changed item fields.
     */
    _patchSliceItem(tabId, fields) {
        this._viewState.setState(state => {
            const key = this._viewState.sliceKey(this._resource);
            const slice = state[key];
            if (!slice?.data) {
                return null;
            }
            const patch = item => String(item.id) === tabId ? { ...item, ...fields } : item;
            const data = { ...slice.data, items: webexpress.webapp.tabModel.mapTabs(slice.data).map(patch) };
            this._lastSliceData = data;
            return { [key]: {
                ...slice,
                data: data,
                items: Array.isArray(slice.items) ? slice.items.map(patch) : slice.items
            } };
        });
    }

    /**
     * Confirms deletion while retaining the selected tab until the service succeeds.
     * @param {string} tabId - The identifier of the tab to close.
     */
    _closeTab(tabId) {
        const tab = this._tabs.find(item => item.id === tabId);
        if (this._readonly || !this._deletableTab || this._destroyed || this._deletingTabId !== null || !tab) {
            return;
        }

        this._confirm = this._confirm || new webexpress.webui.ModalConfirm();
        const accepted = this._confirm.confirmation(
            "webexpress.webapp:tab.delete.title",
            this._i18n("webexpress.webapp:tab.delete.message", "Delete tab “{name}”? This action cannot be undone.").replace("{name}", () => tab.label),
            () => this._deleteTab(tabId),
            {
                confirmLabel: this._i18n("webexpress.webapp:tab.delete.confirm", "Delete"),
                errorMessage: this._i18n("webexpress.webapp:tab.delete.error", "The tab could not be deleted. Please try again."),
                fallbackFocus: () => this._linkOf(this.state.activeTabId) || this._addTabButton
            }
        );
        if (accepted) {
            this._confirm.show();
        }
    }

    /**
     * Commits a confirmed deletion once, keeping failures available for retry.
     * @param {string} tabId - The confirmed tab id.
     * @returns {Promise<boolean>} Whether the confirmation can be dismissed.
     */
    async _deleteTab(tabId) {
        if (this._readonly || this._destroyed || this._deletingTabId !== null) {
            return false;
        }
        if (!this._tabs.some(tab => tab.id === tabId)) {
            return true;
        }
        if (this._resource && !this._service) {
            return false;
        }

        this._deletingTabId = tabId;
        try {
            if (this._service) {
                const result = await this._service.remove({ params: { id: tabId } });
                if (!result.ok) {
                    return false;
                }
            }
            if (this._destroyed) {
                return false;
            }
            this._removeTab(tabId);
            if (this._viewState) {
                this._syncDeletedTab(tabId);
            } else {
                // a GET started before this deletion may still contain the removed id
                this._queryVersion++;
                this._isLoading = false;
                this._element.classList.remove("placeholder-glow");
            }
            this._dispatch(webexpress.webapp.Event.TAB_CLOSED_EVENT, { tabId: tabId });
            return true;
        } finally {
            this._deletingTabId = null;
        }
    }

    /**
     * Keeps model, selection and empty state consistent after a successful deletion:
     * a deleted active tab hands the selection to its left neighbour.
     * @param {string} tabId - The deleted tab id.
     */
    _removeTab(tabId) {
        const closedIndex = this._tabs.findIndex(tab => tab.id === tabId);
        if (closedIndex === -1) {
            return;
        }

        this._removeTabElements(tabId);

        const tabs = this._tabs.filter((tab) => tab.id !== tabId);
        const wasActive = this.state.activeTabId === tabId;
        const rename = this.state.rename;
        const menu = this.state.menu;

        this.setState({
            tabs: tabs,
            activeTabId: wasActive ? null : this.state.activeTabId,
            rename: rename !== null && rename.tabId === tabId ? null : rename,
            menu: menu !== null && menu.tabId === tabId ? null : menu
        });

        if (wasActive && tabs.length > 0) {
            this.selectTab(tabs[Math.max(0, closedIndex - 1)].id);
        }
    }

    /**
     * Tears down the pane of a tab and the controls in it. The pane is detached first,
     * because connected nodes are deliberately excluded by removeInstances.
     * @param {string} tabId - The tab whose pane is no longer needed.
     */
    _removeTabElements(tabId) {
        const pane = this._panes.get(tabId);
        this._panes.delete(tabId);
        this._paneClasses.delete(tabId);

        if (pane) {
            this._pendingPanes.delete(pane);
            pane.remove();
            webexpress.webui.Controller.removeInstances(pane);
        }
    }

    /**
     * Updates the central slice before reloading so its loading notification cannot
     * resurrect the deleted tab. The new load also supersedes an older resource query.
     * @param {string} tabId - The id whose deletion the server acknowledged.
     */
    _syncDeletedTab(tabId) {
        this._viewState.setState(state => {
            const key = this._viewState.sliceKey(this._resource);
            const slice = state[key];
            if (!slice?.data) {
                return null;
            }
            const previous = webexpress.webapp.tabModel.mapTabs(slice.data);
            const items = previous.filter(tab => String(tab.id) !== tabId);
            return { [key]: {
                ...slice,
                data: { ...slice.data, items: items },
                items: Array.isArray(slice.items) ? slice.items.filter(tab => String(tab.id) !== tabId) : slice.items,
                total: typeof slice.total === "number" ? Math.max(0, slice.total - (previous.length - items.length)) : slice.total
            } };
        });
        this._viewState.load(this._resource);
    }

    /**
     * Releases the detached placeholder and separately owned modal.
     */
    destroy() {
        this._destroyed = true;
        clearTimeout(this._statusTimer);
        this._confirm?.destroy();
        this._confirm = null;
        if (this._emptyStateElement) {
            this._emptyStateElement.remove();
            this._emptyStateElement._wxDetached = false;
            webexpress.webui.Controller.removeInstances(this._emptyStateElement);
        }
        super.destroy();
    }
};

// register the class in the controller
webexpress.webui.Controller.registerClass("wx-webapp-tab", webexpress.webapp.TabCtrl);
