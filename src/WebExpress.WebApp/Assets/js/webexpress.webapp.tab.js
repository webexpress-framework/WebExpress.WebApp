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
    _templates = new Map();
    _templateOrder = [];

    // request state
    _isLoading = false;
    _abortController = null;

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

        this._restUri = element.dataset.uri || "";
        this._readonly = element.dataset.readonly === "true";

        if (element.hasAttribute("data-uri")) {
            element.removeAttribute("data-uri");
        }
        if (element.hasAttribute("data-readonly")) {
            element.removeAttribute("data-readonly");
        }

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
            const multiplicityRaw = tpl.dataset.multiplicity;
            let multiplicity = null;
            if (multiplicityRaw !== undefined && multiplicityRaw !== null && multiplicityRaw !== "") {
                const parsed = parseInt(multiplicityRaw, 10);
                if (!isNaN(parsed) && parsed >= 0) {
                    multiplicity = parsed;
                }
            }

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
        const tpl = this._templates.get(templateId);
        if (!tpl) {
            return true;
        }
        if (tpl.multiplicity === null || tpl.multiplicity === undefined) {
            return true;
        }
        return this._countTabsByTemplate(templateId) < tpl.multiplicity;
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
    _receiveData() {
        if (this._restUri === "") {
            return;
        }

        if (this._abortController !== null) {
            // abort previous running requests
            this._abortController.abort("search replaced");
        }

        this._abortController = new AbortController();
        this._isLoading = true;
        this._element.classList.add("placeholder-glow");

        const fetchUrl = this._resolveUrl(this._restUri);

        fetch(fetchUrl, { signal: this._abortController.signal })
            .then((res) => {
                if (res.ok === false) {
                    throw new Error("request failed");
                }
                return res.json();
            })
            .then((response) => {
                let newTabs = [];
                if (Array.isArray(response.items)) {
                    newTabs = response.items;
                }

                this.updateData(newTabs);

                // remove loading indicators
                this._element.classList.remove("placeholder-glow");
                this._isLoading = false;
                this._abortController = null;
            })
            .catch((error) => {
                if (error.name === "AbortError") {
                    return;
                }

                console.error("request failed:", error);
                this._element.classList.remove("placeholder-glow");
                this._isLoading = false;
                this._abortController = null;
            });
    }

    /**
     * Sends a POST request to the server to create a new tab and appends it to the UI.
     * @param {string|null} templateId - Optional template id to create the tab from.
     */
    _createNewTab(templateId = null) {
        if (this._readonly) {
            return;
        }

        if (this._restUri === "") {
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

        const fetchUrl = this._resolveUrl(this._restUri);

        fetch(fetchUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                action: "create",
                templateId: templateId
            })
        })
            .then((res) => {
                if (res.ok === false) {
                    throw new Error("post request failed");
                }
                return res.json();
            })
            .then((response) => {
                const newTab = response.newTab;
                if (!newTab) {
                    throw new Error("post response did not contain newTab");
                }

                if (!newTab.templateId && templateId) {
                    newTab.templateId = templateId;
                }

                this._renderSingleTab(newTab);
                this.selectTab(newTab.id);

                // dispatch event to notify other components
                this._dispatch(webexpress.webapp.Event.TAB_ADDED_EVENT, {
                    tabId: newTab.id
                });
            })
            .catch((error) => {
                console.error("failed to create new tab:", error);
            })
            .finally(() => {
                // restore button state
                this._addTabButton.innerHTML = originalHtml;
                this._addTabButton.disabled = false;
                // re-apply multiplicity-based disabled state
                this._updateAddButtonState();
            });
    }

    /**
     * Resolves a potentially relative URI to a fully qualified URL string.
     * @param {string} uri - The URI to resolve.
     * @returns {string} The fully qualified URL.
     */
    _resolveUrl(uri) {
        const base = window.location.origin;
        let urlObj;

        try {
            urlObj = new URL(uri, base);
        } catch (error) {
            // fallback to document base uri if parsing fails
            urlObj = new URL(uri, document.baseURI);
        }

        if (uri.startsWith("http")) {
            return urlObj.href;
        }

        return urlObj.pathname + urlObj.search;
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

        if (this._readonly) {
            return li;
        }

        const a = li.querySelector(".nav-link");

        if (a !== null) {
            const closeBtn = document.createElement("span");
            closeBtn.className = "ms-2 text-muted fw-bold";
            closeBtn.style.cursor = "pointer";
            closeBtn.textContent = "x";

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
     * Handles the closing/removal of a specific tab from the DOM and state.
     * @param {string} tabId - The identifier of the tab to close.
     */
    _closeTab(tabId) {
        if (this._readonly) {
            return;
        }

        // send delete request to the server before removing the tab locally
        if (this._restUri && tabId) {
            const fetchUrl = this._resolveUrl(this._restUri + "?id=" + encodeURIComponent(tabId));
            fetch(fetchUrl, { method: "DELETE" })
                .then((res) => {
                    if (!res.ok) {
                        throw new Error("failed to delete tab: " + res.status);
                    }
                })
                .catch((err) => {
                    // optionally show error, but still remove tab from ui to ensure responsiveness
                    console.error("delete request failed (still removing tab locally):", err);
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