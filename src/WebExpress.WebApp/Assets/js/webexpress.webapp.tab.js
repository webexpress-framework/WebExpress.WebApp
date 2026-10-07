/**
 * A REST-enabled tab control extending the standard tab controller.
 * Fetches tab data from a REST endpoint, instantiates templates, binds data dynamically,
 * and allows creating new tabs via POST requests.
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

    // drag & drop reorder state
    _dragTabId = null;

    // the open rename field, at most one at a time
    _rename = null;

    // the announcement of an error whose menu has already closed
    _statusElement = null;
    _statusTimer = null;

    // dom nodes for dynamic elements
    _addLi = null;
    _addTabButton = null;
    _addTemplateMenu = null;
    _templateMenuItems = new Map();

    // the server-rendered placeholder for an empty tab set, and whether a tab
    // set was applied at all; the placeholder must not flash while the first
    // payload is still in flight
    _emptyStateElement = null;
    _dataApplied = false;

    /**
     * Constructor for the REST-enabled TabCtrl class.
     * @param {HTMLElement} element - The DOM element associated with the control.
     */
    constructor(element) {
        // consume the islands before the base constructor reshapes the
        // children; later reads are served from the element cache
        webexpress.webapp.Data.readState(element);
        webexpress.webapp.ServiceRegistry.fromElement(element);

        // initialize base class structure
        super(element);

        // the resource a ViewState renders. when present, the tabs are a pure view
        // of a central resource the enclosing ViewState owns; when absent the control
        // owns its state and loads itself (standalone).
        this._resource = (element.dataset && element.dataset.wxResource) || null;

        // canonical ui state: a single source of truth for the loading flag,
        // seeded from the optional wx-state island. in ViewState mode this is
        // replaced by the ViewState once it resolves.
        this._store = new webexpress.webapp.ViewState(element, { standalone: true, state: Object.assign({
            loading: false,
            error: null
        }, webexpress.webapp.Data.readState(element)) });

        this._readonly = element.dataset.readonly === "true";
        this._movableTab = element.dataset.movableTab === "true";
        this._editableTab = element.dataset.editableTab === "true";
        this._deletableTab = element.dataset.deletableTab === "true";

        if (element.hasAttribute("data-readonly")) {
            element.removeAttribute("data-readonly");
        }
        if (element.hasAttribute("data-movable-tab")) {
            element.removeAttribute("data-movable-tab");
        }
        if (element.hasAttribute("data-editable-tab")) {
            element.removeAttribute("data-editable-tab");
        }
        if (element.hasAttribute("data-deletable-tab")) {
            element.removeAttribute("data-deletable-tab");
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

        // add specific class for designer styling
        if (this._navElement !== null) {
            this._navElement.classList.add("wx-form-designer-tabs");
        }

        // the rename field is laid over a tab header from the header row
        this._headerElement?.classList.add("wx-webapp-tab-header");

        if (!this._readonly) {
            this._initAddButton();
        }

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
        } else {
            // without a data source no payload will ever arrive, so the tab set is
            // already known to be empty
            this._dataApplied = true;
            this._updateEmptyState();
        }
    }

    // loading flag accessor backed by the store, so the single source of truth
    // is the store

    get _isLoading() { return this._store.getState().loading; }
    set _isLoading(value) { this._store.setState({ loading: value }); }

    /**
     * Attaches the tabs to the enclosing ViewState and renders its
     * resource slice. The ViewState owns the state, the service and the central
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
            this._store = viewState;

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
     * empty; it is shown again the moment it gets attached.
     */
    _extractEmptyState() {
        const placeholder = this._element.querySelector(":scope > .wx-webapp-tab-empty");

        if (placeholder === null) {
            return;
        }

        placeholder.classList.remove("d-none");

        this._emptyStateElement = placeholder;
        this._detachEmptyState();
    }

    /**
     * Detaches the placeholder while keeping the instances of its call-to-action
     * controls alive, so a placeholder that is shown, hidden and shown again
     * keeps working.
     */
    _detachEmptyState() {
        if (this._emptyStateElement === null || this._emptyStateElement.parentNode === null) {
            return;
        }

        this._emptyStateElement._wxDetached = true;
        this._emptyStateElement.parentNode.removeChild(this._emptyStateElement);
    }

    /**
     * Attaches the placeholder while the tab set carries no items and detaches it
     * as soon as a tab exists, so an empty control reads as deliberately empty
     * rather than broken. A load still in flight keeps the placeholder away.
     */
    _updateEmptyState() {
        if (this._emptyStateElement === null || this._contentElement === null) {
            return;
        }

        // updateData empties the pane host, so the placeholder is re-attached
        // rather than assumed to still be in place
        if (this._dataApplied && this._tabs.length === 0) {
            if (this._emptyStateElement.parentNode !== this._contentElement) {
                this._contentElement.appendChild(this._emptyStateElement);
            }
        } else {
            this._detachEmptyState();
        }
    }

    /**
     * Initializes the add tab button at the end of the navigation list.
     */
    _initAddButton() {
        if (this._navElement === null) {
            return;
        }

        // the add button is a command beside the tab list, not a tab in it
        this._addLi = document.createElement("div");
        this._addLi.className = "wx-tab-tools-item nav-item";

        this._addTabButton = document.createElement("button");
        this._addTabButton.className = "nav-link text-primary";
        this._addTabButton.type = "button";
        // a command in the tab list, not a tab: the arrow keys skip it and it keeps its own name
        this._addTabButton.title = this._i18n("webexpress.webapp:tab.add", "Add tab");
        this._addTabButton.setAttribute("aria-label", this._addTabButton.title);
        this._addTabButton.innerHTML = `<i class="${this._iconClass("plus")}"></i>`;

        const hasMultipleTemplates = this._templateOrder.length > 1;
        if (hasMultipleTemplates) {
            this._addTemplateMenu = document.createElement("ul");
            this._addTemplateMenu.className = "dropdown-menu";

            for (let i = 0; i < this._templateOrder.length; i++) {
                const templateId = this._templateOrder[i];
                const tpl = this._templates.get(templateId);
                if (!tpl) {
                    continue;
                }

                const li = document.createElement("li");
                const itemBtn = document.createElement("button");
                itemBtn.type = "button";
                itemBtn.className = "dropdown-item";

                const titleLine = document.createElement("div");
                titleLine.className = "fw-semibold";
                titleLine.appendChild(this._createTemplateIcon(tpl.icon));
                titleLine.appendChild(document.createTextNode(" " + (tpl.name || tpl.id)));
                itemBtn.appendChild(titleLine);

                if (tpl.description) {
                    const descLine = document.createElement("small");
                    descLine.className = "d-block text-muted";
                    descLine.textContent = tpl.description;
                    itemBtn.appendChild(descLine);
                }

                itemBtn.addEventListener("click", (e) => {
                    e.preventDefault();
                    if (itemBtn.disabled) {
                        return;
                    }
                    this._createNewTab(templateId);
                });

                this._templateMenuItems.set(templateId, itemBtn);
                li.appendChild(itemBtn);
                this._addTemplateMenu.appendChild(li);
            }

            // the browser owns toggle, placement and light dismiss of the menu, and
            // the top layer keeps the open menu out of the header row, which would
            // otherwise stretch every tab header to the height of the menu
            webexpress.webui.NativeMenu.bind(this._addTabButton, this._addTemplateMenu);
        } else {
            this._addTabButton.addEventListener("click", (e) => {
                e.preventDefault();
                this._createNewTab(this._templateOrder[0] || null);
            });
        }

        this._addLi.appendChild(this._addTabButton);
        if (this._addTemplateMenu !== null) {
            this._addLi.appendChild(this._addTemplateMenu);
        }

        // the add button leads the tools, ahead of a toolbar the host may render
        this._toolsElement.insertBefore(this._addLi, this._toolsElement.firstChild);
    }

    /**
     * Creates an icon element used in template selection entries.
     * @param {string} iconClass
     * @returns {HTMLElement}
     */
    _createTemplateIcon(iconClass) {
        const icon = document.createElement("i");
        const classes = (iconClass || webexpress.webapp.TabCtrl._defaultTemplateIcon).trim().split(/\s+/);
        icon.className = classes.join(" ");
        return icon;
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
        let count = 0;
        for (let i = 0; i < this._tabs.length; i++) {
            if (this._tabs[i].templateId === templateId) {
                count++;
            }
        }
        return count;
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
     * Updates the disabled state of the add button and template dropdown
     * entries based on per-template multiplicities.
     */
    _updateAddButtonState() {
        if (this._addTabButton === null) {
            return;
        }

        let anyAvailable = false;

        for (let i = 0; i < this._templateOrder.length; i++) {
            const templateId = this._templateOrder[i];
            const available = this._isTemplateAvailable(templateId);
            if (available) {
                anyAvailable = true;
            }

            const itemBtn = this._templateMenuItems.get(templateId);
            if (itemBtn) {
                itemBtn.disabled = !available;
                itemBtn.classList.toggle("disabled", !available);
            }
        }

        if (this._templateOrder.length === 0) {
            anyAvailable = true;
        }

        this._addTabButton.disabled = !anyAvailable;
        this._addTabButton.classList.toggle("disabled", !anyAvailable);
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
     * @param {string|null} templateId - Optional template id to create the tab from.
     */
    async _createNewTab(templateId = null) {
        if (this._readonly) {
            return;
        }

        if (this._restUri === "" || !this._service) {
            return;
        }

        if (this._addTabButton === null) {
            return;
        }

        // respect template multiplicity limits
        if (templateId !== null && !this._isTemplateAvailable(templateId)) {
            return;
        }

        // indicate loading state on the button
        const originalHtml = this._addTabButton.innerHTML;
        this._addTabButton.innerHTML = `<i class="${this._iconClass("spinner") + " wx-icon-spin"}"></i>`;
        this._addTabButton.disabled = true;

        const result = await this._service.create(webexpress.webapp.tabModel.createBody(templateId));

        if (result.ok) {
            const newTab = webexpress.webapp.tabModel.extractNewTab(result.data, templateId);
            if (newTab) {
                this._renderSingleTab(newTab);
                this.selectTab(newTab.id);

                // dispatch event to notify other components
                this._dispatch(webexpress.webapp.Event.TAB_ADDED_EVENT, {
                    tabId: newTab.id
                });
            } else {
                console.error("failed to create new tab:", "post response did not contain newTab");
            }
        } else {
            console.error("failed to create new tab:", webexpress.webapp.ServiceResult.describe(result));
        }

        // restore button state
        this._addTabButton.innerHTML = originalHtml;
        this._addTabButton.disabled = false;
        // re-apply multiplicity-based disabled state
        this._updateAddButtonState();
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
     * Public API to update the entire tab view with new data from the server.
     * Clears existing tabs and rebuilds the DOM.
     * @param {Array<Object>} tabs - The array of tab definition objects.
     */
    updateData(tabs) {
        if (this._destroyed || !Array.isArray(tabs)) {
            return;
        }

        this._dataApplied = true;
        const activeTabId = this._activeTabId || webexpress.webui.LocalStorage.getItem(this._storageKey);

        // the placeholder leaves through the flagged detach, so wiping the pane
        // host cannot tear down the instances of its call-to-action controls
        this._detachEmptyState();

        for (const tab of this._tabs) {
            this._removeTabElements(tab);
        }

        this._tabs = [];
        this._activeTabId = null;

        // build new tabs from data
        for (let i = 0; i < tabs.length; i++) {
            this._renderSingleTab(tabs[i]);
        }

        // rebuilt panes need their active classes even when the selected id did not change
        if (this._tabs.length > 0) {
            this.selectTab(this._tabs.some(tab => tab.id === activeTabId) ? activeTabId : this._tabs[0].id);
        }

        // refresh add button state for the loaded tab set
        this._updateAddButtonState();
        this._updateEmptyState();
    }

    /**
     * Creates the DOM structures for a single tab based on the provided item data and appends it.
     * @param {Object} item - The tab data item.
     */
    _renderSingleTab(item) {
        // dynamically create pane element
        const pane = document.createElement("div");
        pane.id = item.id || "wx-tab-rest-" + Date.now();
        pane.className = "tab-pane fade";
        pane.setAttribute("role", "tabpanel");
        pane.setAttribute("aria-labelledby", pane.id + "-tab");
        pane.setAttribute("tabindex", "0");

        // apply template and bindings via dom
        this._buildPaneContent(pane, item);

        if (this._contentElement !== null) {
            this._contentElement.appendChild(pane);
        }

        const tabData = {
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
            templateId: item.templateId || null,
            paneElement: pane
        };

        this._tabs.push(tabData);
        this._updateAddButtonState();
        this._updateEmptyState();

        // build header using the overridden method
        const navItem = this._buildTabHeader(tabData);

        // the list holds tabs only, so a new one goes at its end
        if (this._navElement !== null) {
            this._navElement.appendChild(navItem);
        }

        // trigger controller to initialize new elements within the newly created pane
        if (webexpress && webexpress.webui && webexpress.webui.Controller) {
            webexpress.webui.Controller.createInstances(pane);
        }
    }

    /**
     * Overrides the base method to add the drag grip, the tab color and the "…"
     * menu to each tab header.
     * @param {Object} tab - The Tab model.
     * @returns {HTMLElement} List item element.
     */
    _buildTabHeader(tab) {
        // call the base class implementation first
        const li = super._buildTabHeader(tab);
        tab.headerElement = li;
        // the base constructor also builds authored tabs before derived fields are initialized
        const readonly = this._readonly ?? (this._element.dataset.readonly === "true");
        const movable = this._movableTab ?? (this._element.dataset.movableTab === "true");
        const editable = !readonly && (this._editableTab ?? (this._element.dataset.editableTab === "true"));
        const deletable = !readonly && (this._deletableTab ?? (this._element.dataset.deletableTab === "true"));

        this._applyTabColor(tab, tab.tabColor || null);

        // add the drag-to-reorder grip when enabled
        if (movable && !readonly) {
            this._makeTabMovable(li, tab);
        }

        const a = li.querySelector(".nav-link");
        if (a === null || (!editable && !deletable)) {
            return li;
        }

        // a tab list may hold nothing but tabs, so the "…" glyph is no control of its own:
        // the pointer clicks it, the keyboard opens the same menu as a context menu and
        // reaches the entries through their shortcuts
        const trigger = document.createElement("span");
        trigger.className = "wx-webapp-tab-menu";
        trigger.title = this._i18n("webexpress.webapp:tab.menu", "Tab options");
        trigger.setAttribute("aria-hidden", "true");
        const triggerIcon = document.createElement("i");
        triggerIcon.className = this._iconClass("more");
        trigger.appendChild(triggerIcon);
        tab.menuTrigger = trigger;

        // the open menu dismisses itself on the pointerdown that precedes this click,
        // so whether the click closes it is decided by the state before that
        let openBeforeClick = false;
        trigger.addEventListener("pointerdown", () => {
            openBeforeClick = tab.menuElement?.matches(":popover-open") === true;
        });
        trigger.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!openBeforeClick) {
                this._openTabMenu(tab, false);
            }
            openBeforeClick = false;
        });

        // the browser raises contextmenu for a right click, the menu key and shift+f10 alike
        a.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            this._openTabMenu(tab, true);
        });

        const shortcuts = ["Shift+F10"];
        if (editable) {
            shortcuts.push("F2");
        }
        if (deletable) {
            shortcuts.push("Delete");
        }
        a.setAttribute("aria-keyshortcuts", shortcuts.join(" "));
        a.addEventListener("keydown", (e) => {
            if (e.key === "F2" && editable) {
                e.preventDefault();
                this._startRename(tab);
            } else if (e.key === "Delete" && deletable) {
                e.preventDefault();
                this._closeTab(tab.id);
            }
        });

        li.classList.add("wx-webapp-tab-has-menu");
        li.appendChild(trigger);

        return li;
    }

    /**
     * Opens the "…" menu of a tab. The menu holds real buttons, which a tab list may
     * not, so it lives in the header row outside the list and is only anchored to the
     * glyph of its tab. It is built on first use, since most tabs never open it.
     * @param {Object} tab - The Tab model.
     * @param {boolean} focusFirst - Whether the keyboard opened it and needs the first entry.
     */
    _openTabMenu(tab, focusFirst) {
        if (this._destroyed || !tab.menuTrigger || this._headerElement === null || !this._tabs.includes(tab)) {
            return;
        }

        let menu = tab.menuElement;
        if (!menu) {
            menu = document.createElement("ul");
            menu.className = "dropdown-menu dropdown-menu-end wx-webapp-tab-menu-list";
            menu.setAttribute("aria-label", this._i18n("webexpress.webapp:tab.menu", "Tab options"));

            webexpress.webui.NativeMenu.bind(tab.menuTrigger, menu, null);

            // the color entry drills down in place, so a click on an entry must not
            // close the menu; every entry that leaves it closes it itself
            menu.setAttribute("data-wx-keep-open", "");

            menu.addEventListener("toggle", (e) => {
                const open = e.newState === "open";
                tab.headerElement?.classList.toggle("wx-menu-open", open);

                // the glyph is no focus target, so the browser has nowhere to return the
                // focus to; the tab takes it unless an entry moved it on purpose
                const active = document.activeElement;
                if (!open && (active === null || active === document.body || menu.contains(active))) {
                    tab.headerElement?.querySelector(".nav-link")?.focus({ preventScroll: true });
                }
            });

            tab.menuElement = menu;
            this._headerElement.appendChild(menu);
        }

        this._populateTabMenuRoot(menu, tab);
        webexpress.webui.NativeMenu.show(menu);

        if (focusFirst) {
            menu.querySelector(".dropdown-item")?.focus({ preventScroll: true });
        }
    }

    /**
     * Populates the tab menu with its top-level entries.
     * @param {HTMLElement} menu - The dropdown menu element.
     * @param {Object} tab - The Tab model.
     */
    _populateTabMenuRoot(menu, tab) {
        menu.replaceChildren();

        if (this._editableTab && !this._readonly) {
            menu.appendChild(this._buildTabMenuEntry(menu, "pen",
                this._i18n("webexpress.webapp:tab.edit", "Rename tab"),
                () => this._startRename(tab)));
            menu.appendChild(this._buildTabSubmenuEntry(menu, "palette",
                this._i18n("webexpress.webapp:tab.color", "Color"),
                () => this._populateTabMenuColors(menu, tab)));
        }

        if (this._deletableTab && !this._readonly) {
            if (menu.childNodes.length > 0) {
                const divider = document.createElement("li");
                const rule = document.createElement("hr");
                rule.className = "dropdown-divider";
                divider.appendChild(rule);
                menu.appendChild(divider);
            }
            menu.appendChild(this._buildTabMenuEntry(menu, "trash",
                this._i18n("webexpress.webapp:tab.delete", "Delete tab"),
                () => this._closeTab(tab.id)));
        }
    }

    /**
     * Populates the tab menu with the color palette and a "none" option.
     * @param {HTMLElement} menu - The dropdown menu element.
     * @param {Object} tab - The Tab model.
     */
    _populateTabMenuColors(menu, tab) {
        menu.replaceChildren();

        const back = document.createElement("li");
        const backBtn = document.createElement("button");
        backBtn.type = "button";
        backBtn.className = "dropdown-item text-muted d-flex align-items-center";
        const backIcon = document.createElement("i");
        backIcon.className = this._iconClass("chevron-left") + " me-2";
        backBtn.appendChild(backIcon);
        backBtn.appendChild(document.createTextNode(this._i18n("webexpress.webapp:back", "Back")));
        backBtn.addEventListener("click", (e) => {
            e.preventDefault();
            this._populateTabMenuRoot(menu, tab);
            menu.querySelector(".dropdown-item")?.focus({ preventScroll: true });
        });
        back.appendChild(backBtn);
        menu.appendChild(back);

        menu.appendChild(this._buildTabMenuEntry(menu, tab.tabColor ? null : "check",
            this._i18n("webexpress.webapp:tab.color.none", "None"),
            () => this._recolorTab(tab.id, null)));

        const li = document.createElement("li");
        const grid = document.createElement("div");
        grid.className = "wx-webapp-tab-color-grid";

        const palette = webexpress.webapp.tabModel.COLOR_PALETTE;
        for (let i = 0; i < palette.length; i++) {
            const color = palette[i];
            const swatch = document.createElement("button");
            swatch.type = "button";
            swatch.className = "wx-webapp-tab-swatch";
            swatch.style.backgroundColor = color;
            swatch.title = color;
            swatch.setAttribute("aria-label", color);
            if (tab.tabColor && tab.tabColor.toLowerCase() === color) {
                swatch.classList.add("active");
                swatch.setAttribute("aria-current", "true");
            }
            swatch.addEventListener("click", (e) => {
                e.preventDefault();
                webexpress.webui.NativeMenu.hide(menu);
                this._recolorTab(tab.id, color);
            });
            grid.appendChild(swatch);
        }

        li.appendChild(grid);
        menu.appendChild(li);

        backBtn.focus({ preventScroll: true });
    }

    /**
     * Builds an entry that leaves the menu and runs its action.
     * @param {HTMLElement} menu - The dropdown menu element.
     * @param {string|null} icon - The symbolic icon name, or null for an indent.
     * @param {string} label - The entry label.
     * @param {Function} action - The action to run once the menu is closed.
     * @returns {HTMLElement} The list item element.
     */
    _buildTabMenuEntry(menu, icon, label, action) {
        const li = this._buildTabMenuItem(icon, label);
        li.firstChild.addEventListener("click", (e) => {
            e.preventDefault();
            webexpress.webui.NativeMenu.hide(menu);
            action();
        });
        return li;
    }

    /**
     * Builds an entry that repopulates the menu in place with a sub-level, so no
     * nested flyout has to be positioned.
     * @param {HTMLElement} menu - The dropdown menu element.
     * @param {string} icon - The symbolic icon name.
     * @param {string} label - The entry label.
     * @param {Function} populate - Repopulates the menu with the sub-level.
     * @returns {HTMLElement} The list item element.
     */
    _buildTabSubmenuEntry(menu, icon, label, populate) {
        const li = this._buildTabMenuItem(icon, label);
        const button = li.firstChild;

        const chevron = document.createElement("i");
        chevron.className = this._iconClass("chevron-right") + " ms-auto ps-3";
        button.appendChild(chevron);

        button.addEventListener("click", (e) => {
            e.preventDefault();
            populate();
        });
        return li;
    }

    /**
     * Builds the markup of a menu entry without its behavior.
     * @param {string|null} icon - The symbolic icon name, or null for an indent.
     * @param {string} label - The entry label.
     * @returns {HTMLElement} The list item element.
     */
    _buildTabMenuItem(icon, label) {
        const li = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "dropdown-item d-flex align-items-center";

        // an entry without icon keeps the indent, so the labels stay aligned
        const iconEl = document.createElement("i");
        iconEl.className = (icon ? this._iconClass(icon) + " " : "") + "me-2 wx-webapp-tab-menu-icon";
        button.appendChild(iconEl);
        button.appendChild(document.createTextNode(label));

        li.appendChild(button);
        return li;
    }

    /**
     * Shows a tab color on its header. The value only ever lands in a custom
     * property through the CSSOM, so a malformed color from the server is
     * ignored by the browser rather than injected.
     * @param {Object} tab - The Tab model.
     * @param {string|null} color - The color, or null for none.
     */
    _applyTabColor(tab, color) {
        tab.tabColor = color || null;

        const li = tab.headerElement;
        if (!li) {
            return;
        }

        if (tab.tabColor) {
            li.style.setProperty("--wx-webapp-tab-color", tab.tabColor);
        } else {
            li.style.removeProperty("--wx-webapp-tab-color");
        }
        li.classList.toggle("wx-webapp-tab-colored", tab.tabColor !== null);
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

        // a load that finished while the request was pending rebuilt the headers
        const tab = this._tabs.find(item => item.id === tabId);
        if (tab) {
            this._applyTabColor(tab, color);
        }

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
        if (this._headerElement === null) {
            return;
        }

        if (!this._statusElement) {
            this._statusElement = document.createElement("div");
            this._statusElement.className = "wx-webapp-tab-status";
            this._statusElement.setAttribute("role", "alert");
            this._headerElement.appendChild(this._statusElement);
        }

        this._statusElement.textContent = message;
        this._statusElement.hidden = false;

        clearTimeout(this._statusTimer);
        this._statusTimer = setTimeout(() => {
            if (this._statusElement) {
                this._statusElement.hidden = true;
                this._statusElement.textContent = "";
            }
        }, webexpress.webapp.TabCtrl.STATUS_DURATION);
    }

    /**
     * Adds a ⠿ drag handle to a tab header and wires the drag & drop reorder
     * behavior. Only the grip starts a drag, so clicking the tab to select it
     * keeps working.
     * @param {HTMLElement} li - The tab header list item.
     * @param {Object} tab - The Tab model.
     */
    _makeTabMovable(li, tab) {
        li.classList.add("wx-webapp-tab-movable");

        // ⠿ grip handle
        const grip = document.createElement("span");
        grip.className = "wx-webapp-tab-grip";
        grip.textContent = "⠿";
        grip.title = this._i18n("webexpress.webapp:tab.move", "Reorder tab");
        grip.setAttribute("aria-label", grip.title);
        grip.draggable = true;

        // clicking the grip must not select or activate the tab
        grip.addEventListener("click", (e) => e.stopPropagation());
        grip.addEventListener("dragstart", (e) => this._onTabDragStart(e, tab, li));
        grip.addEventListener("dragend", () => this._onTabDragEnd(li));

        // place the grip inside the tab (nav-link), in front of icon/label,
        // so it sits within the tab frame
        const a = li.querySelector(".nav-link");
        if (a !== null) {
            a.insertBefore(grip, a.firstChild);
        } else {
            li.insertBefore(grip, li.firstChild);
        }

        // the whole header is a drop target
        li.addEventListener("dragover", (e) => this._onTabDragOver(e, li));
        li.addEventListener("drop", (e) => this._onTabDrop(e, tab, li));
    }

    /**
     * Starts a tab drag from the grip.
     * @param {DragEvent} e - The dragstart event.
     * @param {Object} tab - The dragged tab model.
     * @param {HTMLElement} li - The dragged tab header.
     */
    _onTabDragStart(e, tab, li) {
        this._dragTabId = tab.id;
        li.classList.add("wx-webapp-tab-dragging");

        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = "move";
            try {
                e.dataTransfer.setData("text/plain", tab.id);
            } catch (err) {
                // some browsers restrict setData; the drag still works via _dragTabId
            }
        }
    }

    /**
     * Ends a tab drag and clears the visual state.
     * @param {HTMLElement} li - The dragged tab header.
     */
    _onTabDragEnd(li) {
        li.classList.remove("wx-webapp-tab-dragging");
        this._clearDropIndicators();
        this._dragTabId = null;
    }

    /**
     * Handles dragover on a tab header, showing a drop indicator on the side
     * the dragged tab would be inserted.
     * @param {DragEvent} e - The dragover event.
     * @param {HTMLElement} li - The hovered tab header.
     */
    _onTabDragOver(e, li) {
        if (this._dragTabId === null) {
            return;
        }

        e.preventDefault();
        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = "move";
        }

        const rect = li.getBoundingClientRect();
        const after = e.clientX > rect.left + rect.width / 2;

        this._clearDropIndicators();
        li.classList.add(after ? "wx-webapp-tab-drop-after" : "wx-webapp-tab-drop-before");
    }

    /**
     * Handles a drop on a tab header and reorders the tabs accordingly.
     * @param {DragEvent} e - The drop event.
     * @param {Object} tab - The target tab model.
     * @param {HTMLElement} li - The target tab header.
     */
    _onTabDrop(e, tab, li) {
        if (this._dragTabId === null) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        const draggedId = this._dragTabId;
        const targetId = tab.id;

        this._clearDropIndicators();

        if (draggedId === targetId) {
            return;
        }

        const rect = li.getBoundingClientRect();
        const after = e.clientX > rect.left + rect.width / 2;

        this._moveTab(draggedId, targetId, after);
    }

    /**
     * Moves a tab in the DOM and the model relative to a target tab, then
     * persists the new order.
     * @param {string} draggedId - The id of the dragged tab.
     * @param {string} targetId - The id of the target tab.
     * @param {boolean} after - Whether to insert after (true) or before (false) the target.
     */
    _moveTab(draggedId, targetId, after) {
        if (this._navElement === null) {
            return;
        }

        const draggedLi = this._findTabLi(draggedId);
        const targetLi = this._findTabLi(targetId);
        if (draggedLi === null || targetLi === null || draggedLi === targetLi) {
            return;
        }

        // reorder the dom
        if (after) {
            targetLi.parentNode.insertBefore(draggedLi, targetLi.nextSibling);
        } else {
            targetLi.parentNode.insertBefore(draggedLi, targetLi);
        }

        // reorder the model
        const fromIndex = this._tabs.findIndex((t) => t.id === draggedId);
        if (fromIndex >= 0) {
            const moved = this._tabs.splice(fromIndex, 1)[0];
            let toIndex = this._tabs.findIndex((t) => t.id === targetId);
            if (toIndex < 0) {
                toIndex = this._tabs.length;
            } else if (after) {
                toIndex += 1;
            }
            this._tabs.splice(toIndex, 0, moved);
        }

        this._persistOrder();
    }

    /**
     * Finds a tab header list item by its tab id.
     * @param {string} tabId - The tab id.
     * @returns {HTMLElement|null} The list item, or null when not found.
     */
    _findTabLi(tabId) {
        if (this._navElement === null) {
            return null;
        }

        const escaped = (window.CSS && typeof CSS.escape === "function") ? CSS.escape(tabId) : tabId;
        const link = this._navElement.querySelector(".nav-link[data-tab-id=\"" + escaped + "\"]");

        return link !== null ? link.closest("li") : null;
    }

    /**
     * Clears all drop indicators from the tab headers.
     */
    _clearDropIndicators() {
        if (this._navElement === null) {
            return;
        }

        const marked = this._navElement.querySelectorAll(".wx-webapp-tab-drop-before, .wx-webapp-tab-drop-after");
        for (let i = 0; i < marked.length; i++) {
            marked[i].classList.remove("wx-webapp-tab-drop-before", "wx-webapp-tab-drop-after");
        }
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
     * Opens the rename field over a tab header. The field is no tab, and a tab
     * list may hold nothing but tabs, so it lives in the header row outside the
     * list and is only laid over the header it renames; the header keeps its
     * place so the row does not jump.
     * @param {Object} tab - The Tab model.
     */
    _startRename(tab) {
        const li = tab.headerElement;
        const a = li ? li.querySelector(".nav-link") : null;
        if (this._readonly || !this._editableTab || this._destroyed || a === null || this._rename !== null || this._headerElement === null) {
            return;
        }

        const container = document.createElement("div");
        container.className = "wx-webapp-tab-rename";

        const input = document.createElement("input");
        input.type = "text";
        input.className = "wx-webapp-tab-rename-input";
        input.value = tab.label;
        input.maxLength = webexpress.webapp.tabModel.MAX_LABEL_LENGTH;
        input.setAttribute("aria-label", this._i18n("webexpress.webapp:tab.rename.label", "Rename tab “{name}”").replace("{name}", () => tab.label));

        const error = document.createElement("div");
        error.className = "wx-webapp-tab-rename-error";
        error.id = tab.id + "-rename-error";
        error.setAttribute("role", "alert");
        error.hidden = true;

        container.appendChild(input);
        container.appendChild(error);

        const session = { tab: tab, container: container, input: input, error: error, busy: false };
        this._rename = session;

        // the tab list walks its tabs with the arrow keys, which must move the caret here instead
        input.addEventListener("keydown", (e) => {
            e.stopPropagation();

            // the enter that picks an ime candidate belongs to the composition, not to the field
            if (e.isComposing || session.busy) {
                return;
            }

            if (e.key === "Enter") {
                e.preventDefault();
                this._commitRename(session);
            } else if (e.key === "Escape") {
                e.preventDefault();
                this._closeRename(session);
            }
        });
        input.addEventListener("blur", () => {
            // switching to another window blurs the field too, but the edit is not finished then
            if (!document.hasFocus() || session.busy) {
                return;
            }
            this._commitRename(session);
        });

        const headerRect = this._headerElement.getBoundingClientRect();
        const liRect = li.getBoundingClientRect();
        container.style.left = (liRect.left - headerRect.left) + "px";
        container.style.top = (liRect.top - headerRect.top) + "px";
        container.style.minWidth = liRect.width + "px";

        li.classList.add("wx-webapp-tab-renaming");
        this._headerElement.appendChild(container);
        input.focus({ preventScroll: true });
        input.select();
    }

    /**
     * Sends an accepted label and keeps the field open until the server answers,
     * so a refused rename can be told and retried where it was typed.
     * @param {Object} session - The open rename.
     * @returns {Promise<void>}
     */
    async _commitRename(session) {
        if (this._rename !== session || session.busy) {
            return;
        }

        const { tab, input, error } = session;
        const label = webexpress.webapp.tabModel.normalizeLabel(input.value);
        if (label === null || label === tab.label) {
            this._closeRename(session);
            return;
        }

        session.busy = true;
        input.readOnly = true;
        input.setAttribute("aria-busy", "true");

        const renamed = await this._renameTab(tab.id, label);

        // a refresh or teardown already closed the field
        if (this._rename !== session) {
            return;
        }

        session.busy = false;
        input.readOnly = false;
        input.removeAttribute("aria-busy");

        if (renamed) {
            this._closeRename(session);
            return;
        }

        error.textContent = this._i18n("webexpress.webapp:tab.rename.error", "The tab could not be renamed. Please try again.");
        error.hidden = false;
        input.setAttribute("aria-invalid", "true");
        input.setAttribute("aria-describedby", error.id);
    }

    /**
     * Closes the rename field. Focus returns to the tab only when the field still
     * holds it; a field left by a click elsewhere must not pull focus back.
     * @param {Object} session - The open rename.
     */
    _closeRename(session) {
        if (this._rename !== session) {
            return;
        }
        this._rename = null;

        const hadFocus = document.activeElement === session.input;
        session.container.remove();

        const li = session.tab.headerElement;
        li?.classList.remove("wx-webapp-tab-renaming");

        if (hadFocus && li?.isConnected) {
            li.querySelector(".nav-link")?.focus({ preventScroll: true });
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

        // a load that finished while the request was pending rebuilt the headers with
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
                fallbackFocus: () => this._tabs.find(item => item.id === this._activeTabId)?.headerElement.querySelector(".nav-link") || this._addTabButton
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
     * Keeps model, selection and empty state consistent after a successful deletion.
     * @param {string} tabId - The deleted tab id.
     */
    _removeTab(tabId) {
        const closedIndex = this._tabs.findIndex(tab => tab.id === tabId);
        if (closedIndex === -1) {
            return;
        }
        const [tab] = this._tabs.splice(closedIndex, 1);
        this._removeTabElements(tab);
        if (this._activeTabId === tabId) {
            this._activeTabId = null;
            if (this._tabs.length > 0) {
                const nextIndex = Math.max(0, closedIndex - 1);
                this.selectTab(this._tabs[nextIndex].id);
            }
        }

        this._updateAddButtonState();
        this._updateEmptyState();
    }

    /**
     * Limits teardown to owned elements and detaches before controller cleanup,
     * because connected nodes are deliberately excluded by removeInstances.
     * @param {object} tab - The tab whose rendered elements are no longer needed.
     */
    _removeTabElements(tab) {
        tab.headerElement?.remove();
        tab.menuElement?.remove();
        // the rename field lives outside the header and would outlast it
        if (this._rename?.tab === tab) {
            this._closeRename(this._rename);
        }
        tab.paneElement.remove();
        webexpress.webui.Controller.removeInstances(tab.paneElement);
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
        if (this._rename) {
            this._closeRename(this._rename);
        }
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