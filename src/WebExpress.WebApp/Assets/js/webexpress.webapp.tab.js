/**
 * A REST-enabled tab control extending the standard tab controller.
 * Fetches tab data from a REST endpoint and provides dynamic tab management.
 * The following events are triggered:
 * - webexpress.webapp.Event.TAB_ADDED_EVENT
 * - webexpress.webapp.Event.TAB_CLOSED_EVENT
 */
webexpress.webapp.TabCtrl = class extends webexpress.webui.TabCtrl {

    // configuration
    _restUri = "";

    // request state
    _isLoading = false;
    _abortController = null;

    // dom nodes for dynamic elements
    _addLi = null;
    _addTabButton = null;

    /**
     * Constructor for the REST-enabled TabCtrl class.
     * @param {HTMLElement} element The DOM element associated with the control.
     */
    constructor(element) {
        // initialize base class structure
        super(element);

        this._restUri = element.dataset.uri || "";

        if (element.hasAttribute("data-uri")) {
            element.removeAttribute("data-uri");
        }

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
            
            const evRoot = webexpress?.webui?.Event;
            const evName = (evRoot && evRoot.TAB_ADDED_EVENT) ? evRoot.TAB_ADDED_EVENT : "webexpress.webui.tab.added";
            
            this._element.dispatchEvent(new CustomEvent(evName, {
                bubbles: true,
                detail: {
                    sourceId: this._element.id
                }
            }));
        });

        this._addLi.appendChild(this._addTabButton);
        this._navElement.appendChild(this._addLi);
    }

    /**
     * Fetches tab data from the configured REST endpoint.
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

        const base = window.location.origin;
        let urlObj;
        
        try {
            urlObj = new URL(this._restUri, base);
        } catch (e) {
            // fallback to document base uri if parsing fails
            urlObj = new URL(this._restUri, document.baseURI);
        }

        const fetchUrl = this._restUri.startsWith("http") ? urlObj.href : (urlObj.pathname + urlObj.search);

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
     * Public API to update the tab view with new data from the server.
     * Clears existing tabs and rebuilds the DOM.
     * @param {Array<Object>} tabs The array of tab definition objects.
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
            const item = tabs[i];
            
            // dynamically create pane element since it does not exist in the initial dom
            const pane = document.createElement("div");
            pane.id = item.id || "wx-tab-rest-" + Date.now() + "-" + i;
            pane.className = "tab-pane fade";
            pane.setAttribute("role", "tabpanel");
            
            if (item.html) {
                pane.innerHTML = item.html;
            }

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
            
            if (this._navElement !== null) {
                // insert before the add button wrapper to keep it at the end
                this._navElement.insertBefore(navItem, this._addLi);
            }
        }

        // select the first tab by default if available
        if (this._tabs.length > 0) {
            this.selectTab(this._tabs[0].id);
        }
    }

    /**
     * Overrides the base method to append a close button to each tab header.
     * @param {Object} tab Tab model.
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
     * @param {string} tabId The identifier of the tab to close.
     */
    _closeTab(tabId) {
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
            pane.parentElement.removeChild(pane);
        }

        // handle active state if the closed tab was currently visible
        if (this._activeTabId === tabId) {
            this._activeTabId = null;
            if (this._tabs.length > 0) {
                // fallback to the previous tab or the first available one
                const nextIndex = Math.max(0, closedIndex - 1);
                this.selectTab(this._tabs[nextIndex].id);
            }
        }

        // notify external components about tab removal
        const evRoot = webexpress?.webui?.Event;
        const evName = (evRoot && evRoot.TAB_CLOSED_EVENT) ? evRoot.TAB_CLOSED_EVENT : "webexpress.webui.tab.closed";
        
        this._element.dispatchEvent(new CustomEvent(evName, {
            bubbles: true,
            detail: {
                tabId: tabId
            }
        }));
    }
};

// register the class in the controller
if (webexpress && webexpress.webui && webexpress.webui.Controller) {
    webexpress.webui.Controller.registerClass("wx-webapp-tab", webexpress.webapp.TabCtrl);
}