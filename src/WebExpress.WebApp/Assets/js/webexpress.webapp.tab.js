/**
 * A REST-enabled tab control extending the standard tab controller.
 * Fetches tab data from a REST endpoint, instantiates templates, binds data dynamically,
 * and allows creating new tabs via POST requests.
 * The following events are triggered:
 * - webexpress.webapp.Event.TAB_ADDED_EVENT
 * - webexpress.webapp.Event.TAB_CLOSED_EVENT
 */
webexpress.webapp.TabCtrl = class extends webexpress.webui.TabCtrl {

    // configuration
    _restUri = "";
    _templates = new Map();

    // request state
    _isLoading = false;
    _abortController = null;

    // dom nodes for dynamic elements
    _addLi = null;
    _addTabButton = null;

    /**
     * Constructor for the REST-enabled TabCtrl class.
     * @param {HTMLElement} element - The DOM element associated with the control.
     */
    constructor(element) {
        // initialize base class structure
        super(element);

        this._restUri = element.dataset.uri || "";

        if (element.hasAttribute("data-uri")) {
            element.removeAttribute("data-uri");
        }

        // extract and store templates
        this._extractTemplates();

        // add specific class for designer styling
        if (this._navElement !== null) {
            this._navElement.classList.add("wx-form-designer-tabs");
        }

        this._initAddButton();

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
            
            // store html content for later instantiation
            this._templates.set(id, tpl.innerHTML);
            
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
        this._addLi.className = "nav-item ms-auto";

        this._addTabButton = document.createElement("button");
        this._addTabButton.className = "btn btn-sm btn-outline-primary mt-1 me-1";
        this._addTabButton.textContent = "+ AddTab";

        this._addTabButton.addEventListener("click", (e) => {
            e.preventDefault();
            this._createNewTab();
        });

        this._addLi.appendChild(this._addTabButton);
        this._navElement.appendChild(this._addLi);
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
     */
    _createNewTab() {
        if (this._restUri === "") {
            return;
        }

        // indicate loading state on the button
        const originalText = this._addTabButton.textContent;
        this._addTabButton.textContent = "...";
        this._addTabButton.disabled = true;

        const fetchUrl = this._resolveUrl(this._restUri);

        fetch(fetchUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ action: "create" })
        })
        .then((res) => {
            if (res.ok === false) {
                throw new Error("post request failed");
            }
            return res.json();
        })
        .then((response) => {
            // take the first item from response.items (array)
            const newTab = response.newTab;
            if (!newTab) {
                throw new Error("POST response did not contain a valid items array or was empty");
            }
            this._renderSingleTab(newTab);
            this.selectTab(newTab.id);

            // dispatch event to notify other components
            this._dispatch(webexpress.webapp.Event.TAB_ADDED_EVENT, {
                tabId: newTab.id,
            });
        })
        .catch((error) => {
            console.error("failed to create new tab:", error);
        })
        .finally(() => {
            // restore button state
            this._addTabButton.textContent = originalText;
            this._addTabButton.disabled = false;
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
        } catch (e) {
            // fallback to document base uri if parsing fails
            urlObj = new URL(uri, document.baseURI);
        }

        return uri.startsWith("http") ? urlObj.href : (urlObj.pathname + urlObj.search);
    }

    /**
     * Fills the pane with the template content and applies generic data binding via DOM manipulation.
     * Supports intelligent default bindings and explicit "target:property" syntax.
     * @param {HTMLElement} pane - The pane element to populate.
     * @param {Object} item - The tab data item.
     */
    _buildPaneContent(pane, item) {
        // resolve the template from the registered templates
        const templateId = item.templateId || "default";
        const html = this._templates.get(templateId) || this._templates.get("default") || "";

        // insert template HTML markup into the pane
        pane.innerHTML = html;

        // build a map from item.binding
        const bindingMap = (item.binding && typeof item.binding === "object") ? item.binding : {};

        // select all elements with a data-wx-bind attribute
        const boundElements = pane.querySelectorAll("[data-wx-bind]");

        for (let i = 0; i < boundElements.length; i++) {
            const el = boundElements[i];
            const bindAttr = el.getAttribute("data-wx-bind");

            if (bindAttr !== null) {
                // support multi-property binding: data-wx-bind="title, icon"
                const bindings = bindAttr.split(",").map(s => s.trim());
                for (let j = 0; j < bindings.length; j++) {
                    const prop = bindings[j];

                    // get value from bindingMap first, then fallback to item property
                    const value =
                        (bindingMap.hasOwnProperty(prop) ? bindingMap[prop] : undefined) ??
                        (item[prop] !== undefined ? item[prop] : "");

                    // determine the binding target for this property:
                    // 1. prefer data-wx-target-<prop> for explicit mode ("content", "text", "attribute", "html" etc.)
                    let target = "text";
                    const explicitTarget = el.getAttribute("data-wx-target-" + prop);
                    if (explicitTarget) {
                        target = explicitTarget;
                    } else {
                        // 2. else check for data-wx-attribute-<prop> (for custom attribute names)
                        const attr = el.getAttribute("data-wx-attribute-" + prop);
                        if (attr) {
                            target = "attribute:" + attr;
                        }
                    }

                    // apply the value to the target
                    if (target.startsWith("attribute:")) {
                        // write as attribute (e.g. "data-uri", "href")
                        const attrName = target.split(":")[1];
                        el.setAttribute(attrName, value);
                    } else if (target === "content" || target === "text") {
                        // set as text content
                        el.textContent = value;
                    } else if (target === "html") {
                        // set as inner HTML (use with caution)
                        el.innerHTML = value;
                    } else {
                        // fallback: treat as text content
                        el.textContent = value;
                    }
                }
            }
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

        // clear existing headers except the add button
        if (this._navElement !== null) {
            const headers = Array.from(this._navElement.children);
            for (let i = 0; i < headers.length; i++) {
                if (headers[i] !== this._addLi) {
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
            paneElement: pane
        };

        this._tabs.push(tabData);

        // build header using the overridden method
        const navItem = this._buildTabHeader(tabData);
        
        if (this._navElement !== null && this._addLi !== null) {
            // insert before the add button wrapper
            this._navElement.insertBefore(navItem, this._addLi);
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
        // send DELETE request to the server before removing the tab locally
        if (this._restUri && tabId) {
            const fetchUrl = this._resolveUrl(this._restUri + "?id=" + encodeURIComponent(tabId));
            fetch(fetchUrl, { method: "DELETE" })
                .then(res => {
                    if (!res.ok) {
                        throw new Error("failed to DELETE tab: " + res.status);
                    }
                })
                .catch(err => {
                    // optionally show error, but still remove tab from UI to ensure responsiveness
                    console.error("Delete request failed (still removing tab locally):", err);
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

        // notify external components about tab removal
        this._dispatch(webexpress.webapp.Event.TAB_CLOSED_EVENT, {
            tabId: tabId
        });
    }
};

// register the class in the controller
webexpress.webui.Controller.registerClass("wx-webapp-tab", webexpress.webapp.TabCtrl);