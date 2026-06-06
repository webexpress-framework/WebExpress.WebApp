/**
 * A REST-enabled tab control extending the standard tab controller.
 * Fetches tab data from a REST endpoint, instantiates templates, binds data dynamically,
 * and allows creating new tabs via POST requests.
 * The following events are triggered:
 * - webexpress.webapp.Event.TAB_ADDED_EVENT
 * - webexpress.webapp.Event.TAB_CLOSED_EVENT
 */
webexpress.webapp.TabCtrl = class extends webexpress.webui.TabCtrl {
    static _defaultTemplateIcon = "far fa-square";

    // configuration
    _restUri = "";
    _readonly = false;
    _movableTab = false;
    _templates = new Map();
    _templateOrder = [];

    // drag & drop reorder state
    _dragTabId = null;

    // dom nodes for dynamic elements
    _addLi = null;
    _addTabButton = null;
    _addTemplateMenu = null;
    _templateMenuItems = new Map();

    /**
     * Constructor for the REST-enabled TabCtrl class.
     * @param {HTMLElement} element - The DOM element associated with the control.
     */
    constructor(element) {
        // initialize base class structure
        super(element);

        // canonical ui state: a single source of truth for the loading flag,
        // seeded from the optional data-wx-state island
        this._store = new webexpress.webapp.Store(Object.assign({
            loading: false,
            error: null
        }, webexpress.webapp.Data.readState(element)));

        this._readonly = element.dataset.readonly === "true";
        this._movableTab = element.dataset.movableTab === "true";

        if (element.hasAttribute("data-uri")) {
            element.removeAttribute("data-uri");
        }
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

        // add specific class for designer styling
        if (this._navElement !== null) {
            this._navElement.classList.add("wx-form-designer-tabs");
        }

        if (!this._readonly) {
            this._initAddButton();
        }

        if (this._restUri !== "") {
            this._element.classList.add("placeholder-glow");
            this._receiveData();
        }
    }

    // loading flag accessor backed by the store, so the single source of truth
    // is the store

    get _isLoading() { return this._store.getState().loading; }
    set _isLoading(value) { this._store.setState({ loading: value }); }

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
        this._addTabButton.innerHTML = `<i class="${this._iconClass("fas fa-plus", "wx-icon-light-plus")}"></i>`;

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

            document.addEventListener("click", (e) => {
                if (!this._addLi || !this._addTemplateMenu || !this._addTemplateMenu.classList.contains("show")) {
                    return;
                }

                if (!this._addLi.contains(e.target)) {
                    this._hideTemplateMenu();
                }
            });
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
        return this._templates.get(templateId)
            || this._templates.get("default")
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
        if (this._restUri === "" || !this._service) {
            return;
        }

        this._isLoading = true;
        this._element.classList.add("placeholder-glow");

        const result = await this._service.query({});

        if (!result.ok) {
            // a superseded query arrives as an abort result and is ignored
            if (result.error.kind === "abort") {
                return;
            }

            console.error("request failed:", result.error.message);
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
        // spinner animation is FontAwesome-only - the light theme has no
        // animated SVG equivalent so _iconClass falls back to FA in both
        // themes, which is intentional here.
        this._addTabButton.innerHTML = `<i class="${this._iconClass("fas fa-spinner fa-spin", null)}"></i>`;
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
            console.error("failed to create new tab:", result.error.message);
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
     * Removes binding metadata attributes from an element after applying binding.
     * @param {HTMLElement} el - Bound element.
     */
    _cleanupBindingAttributes(el) {
        if (el.hasAttribute("data-wx-bind")) {
            el.removeAttribute("data-wx-bind");
        }

        const attrsToRemove = [];
        for (let i = 0; i < el.attributes.length; i++) {
            const attrName = el.attributes[i].name;
            if (attrName.startsWith("data-wx-bind-") && attrName !== "data-wx-bind") {
                attrsToRemove.push(attrName);
            }
        }

        for (let i = 0; i < attrsToRemove.length; i++) {
            el.removeAttribute(attrsToRemove[i]);
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

        const bindingMap = (item.binding && typeof item.binding === "object") ? item.binding : {};
        const boundElements = Array.from(pane.querySelectorAll("[data-wx-bind]"));

        // apply all bindings first
        for (let i = 0; i < boundElements.length; i++) {
            this._applyBindings(boundElements[i], pane, item, bindingMap);
        }

        // cleanup after all binding writes
        for (let i = 0; i < boundElements.length; i++) {
            this._cleanupBindingAttributes(boundElements[i]);
        }
    }

    /**
     * Public API to update the entire tab view with new data from the server.
     * Clears existing tabs and rebuilds the DOM.
     * @param {Array<Object>} tabs - The array of tab definition objects.
     */
    updateData(tabs) {
        if (tabs === undefined || tabs === null) {
            return;
        }

        // clear existing headers except the add button and toolbar
        if (this._navElement !== null) {
            const headers = Array.from(this._navElement.children);
            for (let i = 0; i < headers.length; i++) {
                if (headers[i] !== this._addLi && headers[i] !== this._toolbarLi) {
                    this._navElement.removeChild(headers[i]);
                }
            }
        }

        // clear existing panes
        if (this._contentElement !== null) {
            this._contentElement.innerHTML = "";
        }

        this._tabs = [];

        // build new tabs from data
        for (let i = 0; i < tabs.length; i++) {
            this._renderSingleTab(tabs[i]);
        }

        // select the first tab by default if available
        if (this._tabs.length > 0) {
            this.selectTab(this._tabs[0].id);
        }

        // refresh add button state for the loaded tab set
        this._updateAddButtonState();
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
            primaryAction: item.primaryAction || null,
            primaryTarget: item.primaryTarget || null,
            templateId: item.templateId || null,
            paneElement: pane
        };

        this._tabs.push(tabData);
        this._updateAddButtonState();

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

        // add the drag-to-reorder grip when enabled
        if (this._movableTab && !this._readonly) {
            this._makeTabMovable(li, tab);
        }

        if (this._readonly) {
            return li;
        }

        const a = li.querySelector(".nav-link");

        if (a !== null) {
            const closeBtn = document.createElement("span");
            closeBtn.className = "wx-webapp-tab-close ms-2 text-muted";
            closeBtn.style.cursor = "pointer";
            closeBtn.title = this._i18n("webexpress.webui:close", "Close");
            closeBtn.setAttribute("aria-label", closeBtn.title);
            closeBtn.innerHTML = `<i class="${this._iconClass("fas fa-xmark", "wx-icon-light-xmark")}"></i>`;

            // attach event listener to remove the tab
            closeBtn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                this._closeTab(tab.id);
            });

            a.appendChild(closeBtn);
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
                console.error("failed to persist tab order:", result.error.message);
            }
        });
    }

    /**
     * Handles the closing/removal of a specific tab from the DOM and state.
     * @param {string} tabId - The identifier of the tab to close.
     */
    _closeTab(tabId) {
        if (this._readonly) {
            return;
        }

        // send delete request to the server before removing the tab locally
        if (this._restUri && tabId && this._service) {
            this._service.remove({ params: { id: tabId } }).then((result) => {
                if (!result.ok && result.error.kind !== "abort") {
                    // optionally show error, but still remove tab from ui to ensure responsiveness
                    console.error("delete request failed (still removing tab locally):", result.error.message);
                }
            });
        }

        let closedIndex = -1;

        // filter out the closed tab from the model
        const newTabs = [];
        for (let i = 0; i < this._tabs.length; i++) {
            if (this._tabs[i].id === tabId) {
                closedIndex = i;
            } else {
                newTabs.push(this._tabs[i]);
            }
        }
        this._tabs = newTabs;

        // remove the header element from the navigation
        if (this._navElement !== null) {
            const navLinks = this._navElement.querySelectorAll(".nav-link");
            for (let i = 0; i < navLinks.length; i++) {
                if (navLinks[i].dataset.tabId === tabId) {
                    const li = navLinks[i].parentElement;
                    if (li !== null && li.parentElement !== null) {
                        li.parentElement.removeChild(li);
                    }
                }
            }
        }

        // remove the content pane from the dom
        const pane = document.getElementById(tabId);
        if (pane !== null && pane.parentElement !== null) {
            // trigger destruction of child instances if supported
            if (webexpress && webexpress.webui && webexpress.webui.Controller) {
                webexpress.webui.Controller.removeInstances(pane);
            }
            pane.parentElement.removeChild(pane);
        }

        // handle active state if the closed tab was currently visible
        if (this._activeTabId === tabId) {
            this._activeTabId = null;
            if (this._tabs.length > 0) {
                const nextIndex = Math.max(0, closedIndex - 1);
                this.selectTab(this._tabs[nextIndex].id);
            }
        }

        // refresh the add button availability after the tab list changed
        this._updateAddButtonState();

        // notify external components about tab removal
        this._dispatch(webexpress.webapp.Event.TAB_CLOSED_EVENT, {
            tabId: tabId
        });
    }
};

// register the class in the controller
webexpress.webui.Controller.registerClass("wx-webapp-tab", webexpress.webapp.TabCtrl);