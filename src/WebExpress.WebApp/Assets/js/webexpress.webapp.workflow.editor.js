/**
 * A REST-enabled workflow editor control extending the standard graph editor.
 * Fetches the initial graph model from a REST endpoint, saves changes automatically,
 * and restricts node creation to strictly predefined templates using a REST dropdown.
 * Relies on the DialogPanels mechanism for property configuration dialogs.
 */
webexpress.webapp.WorkflowEditorCtrl = class extends webexpress.webui.GraphEditorCtrl {

    // configuration
    _restUri = "";
    _templatesUri = "";
    _guardsUri = "";
    _validatorsUri = "";
    _postfunctionsUri = "";

    // request state
    _isLoading = false;
    _abortController = null;
    _saveDebounce = null;
    
    // dropdown controller instance
    _addNodeDropdownCtrl = null;

    /**
     * Constructor for the REST-enabled WorkflowEditorCtrl class.
     * @param {HTMLElement} element - The DOM element associated with the control.
     */
    constructor(element) {
        super(element);

        this._restUri = element.dataset.uri || "";
        this._templatesUri = element.dataset.templatesUri || "";
        this._guardsUri = element.dataset.guardsUri || "";
        this._validatorsUri = element.dataset.validatorsUri || "";
        this._postfunctionsUri = element.dataset.postfunctionsUri || "";

        if (element.hasAttribute("data-uri")) {
            element.removeAttribute("data-uri");
        }
        if (element.hasAttribute("data-templates-uri")) {
            element.removeAttribute("data-templates-uri");
        }
        if (element.hasAttribute("data-guards-uri")) {
            element.removeAttribute("data-guards-uri");
        }
        if (element.hasAttribute("data-validators-uri")) {
            element.removeAttribute("data-validators-uri");
        }
        if (element.hasAttribute("data-postfunctions-uri")) {
            element.removeAttribute("data-postfunctions-uri");
        }

        this._setupAddNodeDropdown();

        if (this._restUri !== "") {
            this._receiveData();
        }
    }

    /**
     * Replaces the standard add node button from the base class toolbar
     * with a REST-enabled dropdown control.
     */
    _setupAddNodeDropdown() {
        if (this._templatesUri === "") {
            return;
        }

        const oldBtn = this._toolbarContainer.querySelector("#btn-add-node");
        if (oldBtn === null) {
            return;
        }

        const dropdown = document.createElement("div");
        dropdown.className = "";
        dropdown.setAttribute("data-uri", this._templatesUri);
        dropdown.setAttribute("data-searchplaceholder", "Search states...");
        dropdown.setAttribute("data-icon", "fas fa-plus-circle");
        
        oldBtn.parentNode.replaceChild(dropdown, oldBtn);

        this._addNodeDropdownCtrl = new webexpress.webapp.DropdownCtrl(dropdown);

        const eventName = webexpress.webui.Event.CHANGE_VALUE_EVENT || "webexpress.webui.change.value";
        dropdown.addEventListener(eventName, (e) => {
            const selectedId = e.detail.value;
            if (!selectedId) {
                return;
            }

            const stateId = selectedId.startsWith("tpl_") ? selectedId.substring(4) : selectedId;
            let exists = false;
            
            for (let j = 0; j < this._model.nodes.length; j++) {
                if (this._model.nodes[j].id === stateId) {
                    exists = true;
                    break;
                }
            }

            if (exists === true) {
                console.warn("state already exists in workflow.");
                return;
            }

            fetch(this._templatesUri)
                .then((res) => {
                    return res.json();
                })
                .then((data) => {
                    const templates = Array.isArray(data.items) ? data.items : data;
                    const tpl = templates.find((t) => { 
                        return t.id === selectedId; 
                    });
                    
                    if (tpl !== undefined) {
                        this._instantiateNodeFromTemplate(tpl);
                    }
                })
                .catch((err) => {
                    console.error("failed to fetch template details", err);
                });
        });
    }

    /**
     * Fetches the graph data from the configured REST endpoint.
     */
    _receiveData() {
        if (this._restUri === "") {
            return;
        }

        if (this._abortController !== null) {
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
                this.model = response;
                this._element.classList.remove("placeholder-glow");
                this._isLoading = false;
                this._abortController = null;
            })
            .catch((error) => {
                if (error.name === "AbortError") {
                    return;
                }
                console.error("workflow editor load failed:", error);
                this._element.classList.remove("placeholder-glow");
                this._isLoading = false;
                this._abortController = null;
            });
    }

    /**
     * Overrides the base safe change emitter to hook into the automatic save logic.
     */
    _emitChangeSafe() {
        super._emitChangeSafe();
        this._scheduleSave();
    }

    /**
     * Debounces the save operation to prevent spamming the server.
     */
    _scheduleSave() {
        if (this._saveDebounce !== null) {
            clearTimeout(this._saveDebounce);
        }
        
        this._saveDebounce = setTimeout(() => {
            this._saveToServer();
        }, 500);
    }

    /**
     * Sends the current graph model state to the server via PUT request.
     */
    _saveToServer() {
        if (this._restUri === "") {
            return;
        }

        // sync visual positions to model before serializing
        for (let i = 0; i < this._nodes.length; i++) {
            const visualNode = this._nodes[i];
            const modelNode = this._model.nodes.find((n) => { 
                return n.id === visualNode.id; 
            });
            
            if (modelNode !== undefined) {
                modelNode.x = visualNode.x;
                modelNode.y = visualNode.y;
            }
        }

        const payload = {
            nodes: this._model.nodes,
            edges: this._model.edges
        };

        fetch(this._restUri, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        }).catch((err) => {
            console.error("workflow editor save failed:", err);
        });
    }

    /**
     * Disables the base class add node action since we use the dropdown now.
     */
    _addNode() {
        console.warn("manual node addition is disabled. use the dropdown menu.");
    }

    /**
     * Creates a new node based on the selected template and adds it to the model.
     * @param {Object} tpl - the selected template object
     */
    _instantiateNodeFromTemplate(tpl) {
        this._saveStateToHistory();
        
        const rect = this._svg.getBoundingClientRect();
        const centerX = (rect.width / 2 - (this._pan ? this._pan.x : 0)) / (this._scale || 1);
        const centerY = (rect.height / 2 - (this._pan ? this._pan.y : 0)) / (this._scale || 1);

        const stateId = tpl.id.startsWith("tpl_") ? tpl.id.substring(4) : tpl.id;

        const newNode = {
            id: stateId,
            label: tpl.label || stateId,
            x: centerX,
            y: centerY,
            hasPosition: true,
            layout: tpl.layout || "label-inside",
            shape: tpl.shape || "rect",
            backgroundColor: tpl.backgroundColor || "#ffffff",
            foregroundColor: tpl.foregroundColor || "#000000",
            icon: tpl.icon || "",
            image: tpl.image || "",
            uri: tpl.uri || ""
        };

        this._model.nodes.push(newNode);
        
        this._deselectAll();
        this._selectedNodeId = newNode.id;

        this._buildPhysics();
        this.render();
        this._updateToolbarState();
        this._emitChangeSafe();
    }

    /**
     * Opens the properties panel for either the selected state or transition.
     * Integrates advanced configuration panels dynamically as tabs in the ModalSidebarPanel.
     */
    _openPropertiesModal() {
        if (!this._selectedNodeId && !this._selectedEdgeId) {
            return;
        }

        if (this._selectedNodeId) {
            const targetObj = this._model.nodes.find((n) => { 
                return n.id === this._selectedNodeId; 
            });
            if (targetObj !== undefined) {
                this._openModal("workflow-state-properties", "Edit State", { 
                    node: targetObj, 
                    editor: this 
                }, "modal-lg");
            }
        } else if (this._selectedEdgeId) {
            const targetObj = this._model.edges.find((e) => { 
                return (e.id || "") === this._selectedEdgeId; 
            });
            if (targetObj !== undefined) {
                // open the main dialog container and the generic properties page
                const ctrl = this._openModal("workflow-transition-properties", "Edit Transition", { 
                    edge: targetObj, 
                    editor: this 
                }, "modal-xl");
                
                // dynamically append the separate panels directly to the sidebar tree
                this._addAdaptedEdgePage(ctrl, "workflow-guard-management", "guards", "_guardsUri", "Guards", "fas fa-shield-alt");
                this._addAdaptedEdgePage(ctrl, "workflow-validator-management", "validators", "_validatorsUri", "Validators", "fas fa-check-double");
                this._addAdaptedEdgePage(ctrl, "workflow-postfunction-management", "postfunctions", "_postfunctionsUri", "Postfunctions", "fas fa-bolt");
                
                // re-render the tree so the dynamically added pages become visible
                if (typeof ctrl._renderTree === "function") {
                    ctrl._renderTree();
                }
            }
        }
    }

    /**
     * Creates an adapted proxy page definition from an external panel so it integrates cleanly
     * into the multi-page edge modal without affecting its shared global state.
     */
    _addAdaptedEdgePage(ctrl, registryKey, edgeProp, uriProp, title, iconClass) {
        const registry = webexpress?.webui?.DialogPanels;
        if (!registry) {
            return;
        }
        
        const panels = (typeof registry.get === "function") ? registry.get(registryKey) : (registry._panels?.[registryKey] || []);
        if (!panels || panels.length === 0) {
            return;
        }
        
        const originalPage = panels[0];
        const pageState = {}; // isolated state per page
        
        const adaptedPage = Object.assign({}, originalPage, {
            id: registryKey + "-" + Date.now(),
            title: title,
            iconClass: iconClass,
            onShow: function(modal) {
                if (!Array.isArray(modal.context.edge[edgeProp])) {
                    modal.context.edge[edgeProp] = [];
                }
                
                // create proxy to isolate data handling and hide external button interactions
                const proxyModal = new Proxy(modal, {
                    get(target, prop) {
                        if (prop === "localData") return pageState.localData;
                        if (prop === "availableTemplates") return pageState.availableTemplates;
                        
                        if (prop === "_element") {
                            return new Proxy(target._element, {
                                get(elTarget, elProp) {
                                    if (elProp === "querySelector") {
                                        return (selector) => {
                                            if (selector === ".submit-btn") return null; // hide submit to prevent double bindings
                                            return elTarget.querySelector(selector);
                                        };
                                    }
                                    if (typeof elTarget[elProp] === "function") {
                                        return elTarget[elProp].bind(elTarget);
                                    }
                                    return elTarget[elProp];
                                }
                            });
                        }
                        
                        if (prop === "context") {
                            return new Proxy(target.context, {
                                get(ctxTarget, ctxProp) {
                                    if (ctxProp === "items") return ctxTarget.edge[edgeProp];
                                    if (ctxProp === "fetchUri") return ctxTarget.editor[uriProp];
                                    if (ctxProp === "onSave") return () => {}; // swallow explicit saves, handled centrally
                                    return ctxTarget[ctxProp];
                                }
                            });
                        }
                        
                        if (typeof target[prop] === "function") {
                            return target[prop].bind(target);
                        }
                        return target[prop];
                    },
                    set(target, prop, value) {
                        if (prop === "localData") { pageState.localData = value; return true; }
                        if (prop === "availableTemplates") { pageState.availableTemplates = value; return true; }
                        target[prop] = value;
                        return true;
                    }
                });
                
                proxyModal.closeAndClean = () => {};
                
                if (typeof originalPage.onShow === "function") {
                    originalPage.onShow.call(this, proxyModal);
                }
            },
            onSubmit: function(modal) {
                // intercept the form save and transfer the isolated component data back to the edge object
                if (pageState.localData !== undefined) {
                    modal.context.edge[edgeProp] = pageState.localData;
                }
            }
        });
        
        ctrl.addPage(adaptedPage);
    }

    /**
     * Generic modal wrapper that uses ModalSidebarPanel and DialogPanels to render UI.
     * @param {string} key - the registry key for the DialogPanel
     * @param {string} title - modal title
     * @param {Object} context - data passed to the panel
     * @param {string} size - css class for sizing
     * @returns {Object} the ModalSidebarPanel controller instance
     */
    _openModal(key, title, context, size = "modal-lg") {
        const id = "wx-msp-" + key + "-" + Date.now();
        const submitId = id + "-submit";
        
        const el = document.createElement("div");
        el.id = id;
        el.className = "wx-webui-modal";
        el.setAttribute("data-size", size);
        el.setAttribute("data-key", key);
        el.setAttribute("data-submit-id", submitId);
        el.setAttribute("aria-hidden", "true");

        el.innerHTML = `
            <div class="wx-modal-header">
                <h5 class="modal-title">${title}</h5>
            </div>
            <div class="wx-modal-content p-0"></div>
            <div class="wx-modal-footer">
                <button class="btn btn-outline-secondary cancel-btn" type="button" data-bs-dismiss="modal">Cancel</button>
                <button class="btn btn-primary submit-btn" id="${submitId}" type="button">Save</button>
            </div>`;

        document.body.appendChild(el);
        const ctrl = new webexpress.webui.ModalSidebarPanel(el);
        ctrl.context = context;
        
        const closeAndClean = () => {
            if (typeof ctrl.hide === "function") {
                ctrl.hide();
            }
            setTimeout(() => { 
                if (el.parentNode) {
                    el.parentNode.removeChild(el); 
                }
            }, 300);
        };
        
        const cancelBtn = el.querySelector(".cancel-btn");
        if (cancelBtn) {
            cancelBtn.addEventListener("click", closeAndClean);
        }

        ctrl.closeAndClean = closeAndClean;

        if (typeof ctrl.show === "function") {
            ctrl.show();
        }
        
        return ctrl;
    }
};

// register the class in the framework controller
webexpress.webui.Controller.registerClass("wx-webapp-workflow-editor", webexpress.webapp.WorkflowEditorCtrl);