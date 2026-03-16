/**
 * A REST-enabled tree control for managing logical rules (e.g., guards, validators).
 * Extends the standard tree controller with REST API integration, tree serialization,
 * and integrated node management (delete buttons).
 * Triggers state update requests on structural changes.
 */
webexpress.webapp.RuleTreeCtrl = class extends webexpress.webui.TreeCtrl {

    // configuration
    _restUri = "";

    // request state
    _isLoading = false;
    _abortController = null;

    /**
     * Constructor for the RuleTreeCtrl class.
     * @param {HTMLElement} element - The DOM element associated with the control.
     */
    constructor(element) {
        super(element);

        this._restUri = element.dataset.uri || "";

        if (element.hasAttribute("data-uri")) {
            element.removeAttribute("data-uri");
        }

        this._initRestPersistence();

        if (this._restUri !== "") {
            this._element.classList.add("placeholder-glow");
            this._receiveData();
        }
    }

    /**
     * Initializes listeners for state changes (like drag & drop reordering)
     * to automatically sync the new tree structure with the server.
     */
    _initRestPersistence() {
        const evRoot = webexpress?.webui?.Event;
        const moveEvent = (evRoot && evRoot.MOVE_EVENT) ? evRoot.MOVE_EVENT : "webexpress.webui.move";

        this._element.addEventListener(moveEvent, (e) => {
            // timeout ensures that internal tree state has fully settled
            setTimeout(() => {
                this._notifyStateChange();
            }, 0);
        });
    }

    /**
     * Fetches tree data from the configured REST endpoint.
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
                let items = [];
                if (Array.isArray(response.items)) {
                    items = response.items;
                } else if (Array.isArray(response)) {
                    items = response;
                }

                this.updateData(items);

                // remove loading indicators
                this._element.classList.remove("placeholder-glow");
                this._isLoading = false;
                this._abortController = null;
            })
            .catch((error) => {
                if (error.name === "AbortError") {
                    return;
                }

                console.error("ruletreectrl request failed:", error);
                this._element.classList.remove("placeholder-glow");
                this._isLoading = false;
                this._abortController = null;
            });
    }

    /**
     * Public API to update the tree view with new data from the server.
     * @param {Array<Object>} items - The array of rule definition objects.
     */
    updateData(items) {
        if (items === undefined || items === null) {
            return;
        }

        // map flat or nested json arrays to the internal node format
        const mappedNodes = this._mapToTreeNodes(items, null);
        
        // utilizing the base class setter to update state and trigger rendering
        this.nodes = mappedNodes;
    }

    /**
     * Recursively maps raw REST objects to tree nodes required by the base tree controller.
     * @param {Array<Object>} items - The items to map.
     * @param {Object} parent - The parent node reference.
     * @returns {Array<Object>} The mapped tree nodes.
     */
    _mapToTreeNodes(items, parent) {
        const nodes = [];
        
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            
            // logic gates usually receive different icons to distinguish them from conditions
            const isLogical = (item.type === "AND" || item.type === "OR");
            
            const node = {
                id: item.id || "rule_" + Date.now() + "_" + i,
                label: item.label || item.condition || item.type || "unnamed rule",
                expand: true,
                iconOpen: isLogical ? "fas fa-folder-open text-warning" : "fas fa-file-alt text-secondary",
                iconClose: isLogical ? "fas fa-folder text-warning" : "fas fa-file-alt text-secondary",
                parent: parent,
                originalData: item
            };
            
            if (Array.isArray(item.children) && item.children.length > 0) {
                node.children = this._mapToTreeNodes(item.children, node);
            } else {
                node.children = [];
            }
            
            nodes.push(node);
        }
        
        return nodes;
    }

    /**
     * Overrides the base render method to inject rule-specific UI elements
     * such as the remove ('x') button for each node.
     */
    render() {
        // execute standard tree rendering first
        super.render();

        if (this._container === null) {
            return;
        }

        const listItems = this._container.querySelectorAll("li[role='treeitem']");
        
        for (let i = 0; i < listItems.length; i++) {
            const li = listItems[i];
            const div = li.firstElementChild;
            
            // only augment if the node div exists and does not already have a remove button
            if (div !== null && div.querySelector(".wx-rule-remove-btn") === null) {
                // transform into a flex container to align elements
                div.classList.add("d-flex", "align-items-center", "w-100");
                
                const labelContainer = div.querySelector(".wx-tree-label-container");
                if (labelContainer !== null) {
                    // allow the label to occupy available space
                    labelContainer.classList.add("flex-grow-1");
                }

                // create the remove button mimicking the mockup
                const btn = document.createElement("span");
                btn.className = "wx-rule-remove-btn ms-auto text-muted fw-bold px-3";
                btn.style.cursor = "pointer";
                btn.textContent = "x";
                btn.title = "remove condition";

                btn.addEventListener("click", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this._deleteNode(li.id);
                });

                div.appendChild(btn);
            }
        }
    }

    /**
     * Deletes a specific node from the tree and syncs the change.
     * @param {string} nodeId - The identifier of the node to remove.
     */
    _deleteNode(nodeId) {
        const node = this._findNodeById(nodeId);
        
        if (node !== null) {
            // utilize the protected method from the base class
            this._removeNodeFromCurrentPosition(node);
            
            this.render();
            this._notifyStateChange();
        }
    }

    /**
     * Serializes the current tree state and sends it to the server.
     */
    _notifyStateChange() {
        if (this._restUri === "") {
            return;
        }

        const payload = {
            items: this._serializeNodes(this._nodes)
        };

        fetch(this._restUri, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        }).catch((err) => {
            console.error("ruletreectrl update state failed", err);
        });
    }

    /**
     * Recursively serializes internal tree nodes back into generic objects.
     * @param {Array<Object>} nodes - The tree nodes to serialize.
     * @returns {Array<Object>} The serialized node structure.
     */
    _serializeNodes(nodes) {
        const result = [];
        
        for (let i = 0; i < nodes.length; i++) {
            const n = nodes[i];
            const obj = {};
            
            // retain original data fields
            if (n.originalData) {
                Object.assign(obj, n.originalData);
            }
            
            // overwrite potentially changed identifiers
            obj.id = n.id;
            
            // recursively process nested children
            if (Array.isArray(n.children) && n.children.length > 0) {
                obj.children = this._serializeNodes(n.children);
            } else {
                obj.children = [];
            }
            
            result.push(obj);
        }
        
        return result;
    }
};

// register the class in the controller
if (webexpress && webexpress.webui && webexpress.webui.Controller) {
    webexpress.webui.Controller.registerClass("wx-webapp-rule-tree", webexpress.webapp.RuleTreeCtrl);
}