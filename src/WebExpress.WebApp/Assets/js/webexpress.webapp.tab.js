/**
 * A REST-enabled tab control extending the standard tab controller.
 * Fetches tab data from a REST endpoint, instantiates templates, binds data dynamically,
 * and allows creating new tabs via POST requests.
 * The following events are triggered:
 * - webexpress.webapp.Event.TAB_ADDED_EVENT
 * - webexpress.webapp.Event.TAB_CLOSED_EVENT
 */
webexpress.webapp.TabCtrl = class extends webexpress.webui.TabCtrl {
    static _defaultTemplateIcon = "wx-icon-light wx-icon-light-card";

    // configuration
    _restUri = "";
    _viewState = null;
    _readonly = false;
    _movableTab = false;
    _templates = new Map();
    _templateOrder = [];
    _confirm = null;
    _deletingTabId = null;
    _destroyed = false;
    _onDocumentClick = null;
    _queryVersion = 0;
    _lastSliceData = null;

    // drag & drop reorder state
    _dragTabId = null;

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

        if (element.hasAttribute("data-readonly")) {
            element.removeAttribute("data-readonly");
        }
        if (element.hasAttribute("data-movable-tab")) {
            element.removeAttribute("data-movable-tab");
        }

        // data service: a configured island when present, otherwise a legacy
        // descriptor. its query, create, update and remove operations back the
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

            const unsubscribe = viewState.watch((state) => state[this._resource], (slice) => this._applySlice(slice));
            (element._wxCleanup = element._wxCleanup || []).push(unsubscribe);

            this._applySlice(viewState.getState()[this._resource]);
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

        this._addLi = document.createElement("li");
        this._addLi.className = "nav-item position-relative";

        this._addTabButton = document.createElement("button");
        this._addTabButton.className = "nav-link text-primary";
        this._addTabButton.type = "button";
        this._addTabButton.setAttribute("role", "tab");
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
                    e.stopPropagation();
                    if (itemBtn.disabled) {
                        return;
                    }
                    this._hideTemplateMenu();
                    this._createNewTab(templateId);
                });

                this._templateMenuItems.set(templateId, itemBtn);
                li.appendChild(itemBtn);
                this._addTemplateMenu.appendChild(li);
            }

            this._addTabButton.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                this._toggleTemplateMenu();
            });

            this._onDocumentClick = (e) => {
                if (!this._addLi || !this._addTemplateMenu || !this._addTemplateMenu.classList.contains("show")) {
                    return;
                }

                if (!this._addLi.contains(e.target)) {
                    this._hideTemplateMenu();
                }
            };
            document.addEventListener("click", this._onDocumentClick);
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

        if (this._toolbarLi) {
            this._navElement.insertBefore(this._addLi, this._toolbarLi);
        } else {
            this._navElement.appendChild(this._addLi);
        }
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
     * Toggles the template selection dropdown menu.
     */
    _toggleTemplateMenu() {
        if (this._addTemplateMenu === null) {
            return;
        }

        this._addTemplateMenu.classList.toggle("show");
    }

    /**
     * Hides the template selection dropdown menu.
     */
    _hideTemplateMenu() {
        if (this._addTemplateMenu === null) {
            return;
        }

        this._addTemplateMenu.classList.remove("show");
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
        const activeTabId = this._activeTabId;

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

        if (this._navElement !== null && this._addLi !== null) {
            // insert before the add button wrapper
            this._navElement.insertBefore(navItem, this._addLi);
        } else if (this._navElement !== null && this._toolbarLi !== null) {
            // insert before the toolbar if no add button exists
            this._navElement.insertBefore(navItem, this._toolbarLi);
        } else if (this._navElement !== null) {
            this._navElement.appendChild(navItem);
        }

        // trigger controller to initialize new elements within the newly created pane
        if (webexpress && webexpress.webui && webexpress.webui.Controller) {
            webexpress.webui.Controller.createInstances(pane);
        }
    }

    /**
     * Overrides the base method to append a close button to each tab header.
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

        // add the drag-to-reorder grip when enabled
        if (movable && !readonly) {
            this._makeTabMovable(li, tab);
        }

        if (readonly) {
            return li;
        }

        const a = li.querySelector(".nav-link");

        if (a !== null) {
            const closeBtn = document.createElement("button");
            closeBtn.type = "button";
            closeBtn.className = "wx-webapp-tab-close";
            closeBtn.title = this._i18n("webexpress.webapp:tab.delete.label", "Delete tab “{name}”").replace("{name}", () => tab.label);
            closeBtn.setAttribute("aria-label", closeBtn.title);
            closeBtn.innerHTML = `<i class="${this._iconClass("xmark")}"></i>`;

            // attach event listener to remove the tab
            closeBtn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                this._closeTab(tab.id);
            });

            li.classList.add("wx-webapp-tab-closable");
            li.appendChild(closeBtn);
        }

        return li;
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
     * Confirms deletion while retaining the selected tab until the service succeeds.
     * @param {string} tabId - The identifier of the tab to close.
     */
    _closeTab(tabId) {
        const tab = this._tabs.find(item => item.id === tabId);
        if (this._readonly || this._destroyed || this._deletingTabId !== null || !tab) {
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
            const slice = state[this._resource];
            if (!slice?.data) {
                return null;
            }
            const previous = webexpress.webapp.tabModel.mapTabs(slice.data);
            const items = previous.filter(tab => String(tab.id) !== tabId);
            return { [this._resource]: {
                ...slice,
                data: { ...slice.data, items: items },
                items: Array.isArray(slice.items) ? slice.items.filter(tab => String(tab.id) !== tabId) : slice.items,
                total: typeof slice.total === "number" ? Math.max(0, slice.total - (previous.length - items.length)) : slice.total
            } };
        });
        this._viewState.load(this._resource);
    }

    /**
     * Releases the detached placeholder, document listener and separately owned modal.
     */
    destroy() {
        this._destroyed = true;
        this._confirm?.destroy();
        this._confirm = null;
        if (this._onDocumentClick) {
            document.removeEventListener("click", this._onDocumentClick);
            this._onDocumentClick = null;
        }
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