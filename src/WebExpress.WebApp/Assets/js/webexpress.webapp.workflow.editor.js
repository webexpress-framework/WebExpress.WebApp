/**
 * REST-enabled workflow editor control.
 *
 * Layout
 * ------
 * The host element is split horizontally with `webexpress.webui.SplitCtrl` into
 * a designer canvas pane (left) and a properties panel pane (right). The
 * splitter handle lets the user drag the divider; double-clicking it
 * collapses / expands the properties pane. The split state persists across
 * reloads via a cookie keyed by the editor id.
 *
 * Properties panel
 * ----------------
 * Selecting a state or transition in the canvas renders an inline properties
 * view inside the right pane (no modal). The DOM containers and CSS classes
 * mirror the KleeneStar Workflows.html prototype (props / prop-row /
 * prop-section / rule-list) translated to the framework's `wx-workflow-editor-`
 * namespace, so styling stays consistent and centralized in
 * `webexpress.webapp.workflow.editor.css`.
 *
 * REST integration
 * ----------------
 * - data-uri               GET / PUT for the workflow model (states, transitions).
 * - data-templates-uri     GET dropdown of state templates (Add state).
 * - data-guards-uri        GET catalog of available guards.
 * - data-validators-uri    GET catalog of available validators.
 * - data-postfunctions-uri GET catalog of available post functions.
 *
 * Mutations are debounced and persisted automatically.
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

    // dropdown controller instance (Add state)
    _addNodeDropdownCtrl = null;

    // split layout
    _splitHost = null;
    _canvasPane = null;
    _propsPane = null;
    _propsHost = null;
    _toggleBtn = null;

    // cached rule libraries (lazy-loaded the first time the rule picker opens)
    _libraryCache = {};

    /**
     * Initializes the workflow editor on the host element.
     * @param {HTMLElement} element - host element with the wx-webapp-workflow-editor class.
     */
    constructor(element) {
        super(element);

        const ds = element.dataset;
        this._restUri = ds.uri || "";
        this._templatesUri = ds.templatesUri || "";
        this._guardsUri = ds.guardsUri || "";
        this._validatorsUri = ds.validatorsUri || "";
        this._postfunctionsUri = ds.postfunctionsUri || "";

        for (const a of ["uri", "templates-uri", "guards-uri", "validators-uri", "postfunctions-uri"]) {
            element.removeAttribute("data-" + a);
        }

        element.classList.add("wx-workflow-editor");

        this._buildLayout();
        this._setupAddNodeDropdown();
        this._setupShortcuts();

        if (this._restUri !== "") {
            this._receiveData();
        }

        this._renderPropsPanel();
    }

    /**
     * Builds the split layout that wraps the canvas pane and the right-side
     * properties pane. The base GraphEditorCtrl has already added the toolbar
     * and SVG as direct children of `this._element`; we move them into a
     * dedicated canvas pane, then wrap canvas pane + props pane with a
     * `wx-webui-split` host so SplitCtrl auto-instantiates and provides the
     * draggable divider.
     */
    _buildLayout() {
        const host = this._element;

        // pull existing children (toolbar + svg) into the canvas pane
        this._canvasPane = document.createElement("div");
        this._canvasPane.className = "wx-main-pane wx-workflow-editor-canvas";

        const movable = Array.from(host.childNodes);
        for (const child of movable) {
            this._canvasPane.appendChild(child);
        }

        // collapse-toggle button lives in the toolbar so the user can hide /
        // show the side panel without touching the splitter handle.
        if (this._toolbarContainer) {
            const sep = document.createElement("div");
            sep.className = "wx-simple-sep";
            this._toolbarContainer.appendChild(sep);

            const toggle = document.createElement("button");
            toggle.type = "button";
            toggle.id = "btn-toggle-props";
            toggle.className = "wx-simple-btn wx-workflow-editor-toggle";
            toggle.title = this._i18n("webexpress.webapp:workflow.editor.props.toggle", "Toggle properties panel");
            toggle.innerHTML = `<i class="fas fa-columns" aria-hidden="true"></i>`;
            toggle.onclick = (e) => {
                e.stopPropagation();
                this._togglePropsPane();
            };
            this._toolbarContainer.appendChild(toggle);
            this._toggleBtn = toggle;
        }

        // properties pane (right side)
        this._propsPane = document.createElement("div");
        this._propsPane.className = "wx-side-pane wx-workflow-editor-props-pane";

        this._propsHost = document.createElement("div");
        this._propsHost.className = "wx-workflow-editor-props-host";
        this._propsPane.appendChild(this._propsHost);

        // split host — registered class name `wx-webui-split` is auto-replaced by
        // the controller registry once appended to the DOM.
        this._splitHost = document.createElement("div");
        this._splitHost.className = "wx-webui-split wx-workflow-editor-split";
        this._splitHost.id = (host.id || "wx-workflow-editor") + "-split";
        this._splitHost.dataset.orientation = "horizontal";
        this._splitHost.dataset.order = "main-side";
        this._splitHost.dataset.size = "340";
        this._splitHost.dataset.minSide = "260";
        this._splitHost.dataset.maxSide = "560";

        this._splitHost.appendChild(this._canvasPane);
        this._splitHost.appendChild(this._propsPane);

        host.appendChild(this._splitHost);
    }

    /**
     * Toggles the right-side properties pane via the SplitCtrl instance that
     * was auto-instantiated for the split host.
     */
    _togglePropsPane() {
        const split = webexpress.webui.Controller.getInstanceByElement
            ? webexpress.webui.Controller.getInstanceByElement(this._splitHost)
            : null;

        if (split && typeof split.toggleSidePane === "function") {
            split.toggleSidePane();
            return;
        }

        // fallback: only collapse visibility if the controller is not (yet) live.
        this._propsPane.classList.toggle("wx-workflow-editor-props-pane--collapsed");
    }

    /**
     * Replaces the standard add-node toolbar button with a REST dropdown
     * sourced from `data-templates-uri`. When no templates URI is configured
     * the original add-node button stays untouched.
     */
    _setupAddNodeDropdown() {
        if (this._templatesUri === "") {
            return;
        }

        const oldBtn = this._toolbarContainer && this._toolbarContainer.querySelector("#btn-add-node");
        if (!oldBtn) {
            return;
        }

        const dropdown = document.createElement("div");
        dropdown.setAttribute("data-uri", this._templatesUri);
        dropdown.setAttribute("data-searchplaceholder",
            this._i18n("webexpress.webapp:workflow.editor.state.search", "Search states..."));
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
            if (this._model && this._model.nodes.some(n => n.id === stateId)) {
                console.warn("workflow editor: state already exists.");
                return;
            }

            fetch(this._templatesUri)
                .then(res => res.json())
                .then(data => {
                    const items = Array.isArray(data.items) ? data.items : data;
                    const tpl = items.find(t => t.id === selectedId);
                    if (tpl) {
                        this._instantiateNodeFromTemplate(tpl);
                    }
                })
                .catch(err => console.error("workflow editor: template fetch failed", err));
        });
    }

    /**
     * Wires keyboard shortcuts that complement the existing graph-editor keys.
     *  - F2     Rename selected state (focus inline edit).
     *  - Esc    Clear selection (collapses the properties panel preview).
     *  - Ctrl+S Force-flush the pending save.
     */
    _setupShortcuts() {
        this._kbHandler = (e) => {
            if (!this._element.isConnected) {
                return;
            }
            const tag = e.target.tagName;
            if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) {
                return;
            }
            if (e.target.isContentEditable) {
                return;
            }

            if (e.key === "F2" && this._selectedNodeId) {
                e.preventDefault();
                const input = this._propsHost.querySelector("[data-edit-key='label']");
                if (input) {
                    input.focus();
                    input.select();
                }
            } else if (e.key === "Escape") {
                if (this._selectedNodeId || this._selectedEdgeId) {
                    e.preventDefault();
                    this._deselectAll();
                    this._updateToolbarState();
                    this.render();
                }
            } else if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
                if (this._element.contains(e.target) || e.target === document.body) {
                    e.preventDefault();
                    this._flushSave();
                }
            }
        };
        window.addEventListener("keydown", this._kbHandler);
    }

    /**
     * Loads the workflow model from the REST endpoint. Translates the
     * states / transitions wire format to the nodes / edges shape the graph
     * editor expects.
     */
    _receiveData() {
        if (this._restUri === "") {
            return;
        }

        if (this._abortController !== null) {
            this._abortController.abort("workflow editor: request replaced");
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
            .then(res => {
                if (!res.ok) {
                    throw new Error("workflow editor: load request failed (" + res.status + ")");
                }
                return res.json();
            })
            .then(response => {
                this.model = this._fromWireFormat(response);
                this._element.classList.remove("placeholder-glow");
                this._isLoading = false;
                this._abortController = null;
                this._renderPropsPanel();
            })
            .catch(error => {
                if (error.name === "AbortError") {
                    return;
                }
                console.error("workflow editor: load failed", error);
                this._element.classList.remove("placeholder-glow");
                this._isLoading = false;
                this._abortController = null;
            });
    }

    /**
     * Translates the REST `{ states, transitions }` payload (or a model that
     * already speaks `{ nodes, edges }`) to the graph editor shape.
     * @param {object} response
     * @returns {{nodes: Array, edges: Array}}
     */
    _fromWireFormat(response) {
        const nodesIn = Array.isArray(response.nodes)
            ? response.nodes
            : (Array.isArray(response.states) ? response.states : []);
        const edgesIn = Array.isArray(response.edges)
            ? response.edges
            : (Array.isArray(response.transitions) ? response.transitions : []);

        const nodes = nodesIn.map(n => Object.assign({}, n));
        const edges = edgesIn.map(e => {
            const out = Object.assign({}, e);
            // accept the prototype's source/target alias for compatibility
            if (out.from === undefined && out.source !== undefined) { out.from = out.source; }
            if (out.to === undefined && out.target !== undefined) { out.to = out.target; }
            return out;
        });

        return { nodes, edges };
    }

    /**
     * Hooks the autosave flow into the change pipeline. The properties panel
     * is intentionally NOT rebuilt here — that would tear down the input the
     * user is currently typing in. Panel refresh is driven by selection
     * changes (`_updateToolbarState`) and by the rule editors that explicitly
     * request a refresh after non-input mutations (add / remove / reorder).
     */
    _emitChangeSafe() {
        super._emitChangeSafe();
        this._scheduleSave();
    }

    /**
     * Toolbar updates fire whenever the selection changes, so the right-side
     * panel can be refreshed in lockstep. The panel is only rebuilt when the
     * selection actually changes — re-renders triggered while typing in an
     * input field are avoided to preserve focus.
     */
    _updateToolbarState() {
        super._updateToolbarState();
        const sel = (this._selectedNodeId || "") + "::" + (this._selectedEdgeId || "");
        if (sel !== this._lastRenderedSelection) {
            this._lastRenderedSelection = sel;
            this._renderPropsPanel();
        }
    }

    /**
     * Preserves workflow-specific edge fields (description, form, guards,
     * validators, postfunctions) which the base graph normalizer would
     * otherwise drop because it only knows about the visual edge schema.
     * @param {object} model
     * @returns {{nodes: Array, edges: Array}}
     */
    _normalizeModel(model) {
        const normalized = super._normalizeModel(model);
        if (!model || !normalized) {
            return normalized;
        }

        const sourceEdges = Array.isArray(model.edges)
            ? model.edges
            : (Array.isArray(model.transitions) ? model.transitions : []);

        if (sourceEdges.length === 0) {
            return normalized;
        }

        const byId = new Map();
        for (const e of sourceEdges) {
            if (e && e.id !== undefined) {
                byId.set(e.id, e);
            }
        }

        for (const e of normalized.edges) {
            const orig = byId.get(e.id);
            if (!orig) {
                continue;
            }
            if (orig.description !== undefined) { e.description = orig.description; }
            if (orig.form !== undefined) { e.form = orig.form; }
            if (Array.isArray(orig.guards)) { e.guards = orig.guards; }
            if (Array.isArray(orig.validators)) { e.validators = orig.validators; }
            if (Array.isArray(orig.postfunctions)) { e.postfunctions = orig.postfunctions; }
        }

        return normalized;
    }

    /**
     * Debounces the autosave so a burst of edits collapses into a single PUT.
     */
    _scheduleSave() {
        if (this._saveDebounce !== null) {
            clearTimeout(this._saveDebounce);
        }
        this._saveDebounce = setTimeout(() => this._saveToServer(), 500);
    }

    /**
     * Forces a pending save to flush immediately (Ctrl+S).
     */
    _flushSave() {
        if (this._saveDebounce !== null) {
            clearTimeout(this._saveDebounce);
            this._saveDebounce = null;
        }
        this._saveToServer();
    }

    /**
     * Persists the current model state. Visual node positions are merged back
     * into the model first so a pure drag also gets persisted.
     */
    _saveToServer() {
        this._saveDebounce = null;
        if (this._restUri === "") {
            return;
        }

        for (const visualNode of (this._nodes || [])) {
            const modelNode = this._model.nodes.find(n => n.id === visualNode.id);
            if (modelNode) {
                modelNode.x = visualNode.x;
                modelNode.y = visualNode.y;
            }
        }

        const payload = {
            nodes: this._model.nodes,
            edges: this._model.edges,
            // mirror payload using the REST wire names so backends that prefer
            // states / transitions can read either field.
            states: this._model.nodes,
            transitions: this._model.edges
        };

        fetch(this._restUri, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        })
            .then(res => {
                if (!res.ok) {
                    console.warn("workflow editor: save returned " + res.status);
                }
            })
            .catch(err => console.error("workflow editor: save failed", err));
    }

    /**
     * Disables the base class manual add-node action — adding nodes is gated
     * through the Add State dropdown.
     */
    _addNode() {
        if (this._templatesUri === "") {
            super._addNode();
            return;
        }
        console.warn("workflow editor: use the Add State dropdown to insert new states.");
    }

    /**
     * Materializes a new state node from a template. The node is selected
     * after creation so the side panel immediately shows its inspector.
     * @param {object} tpl - selected template object.
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
     * Override: replaces the modal-based properties dialog with the inline
     * right-side panel. Selecting an item updates `_selectedNodeId` /
     * `_selectedEdgeId`, so we just re-render the panel and ensure it is
     * visible.
     */
    _openPropertiesModal() {
        if (!this._selectedNodeId && !this._selectedEdgeId) {
            return;
        }
        this._renderPropsPanel();

        const split = webexpress.webui.Controller.getInstanceByElement
            ? webexpress.webui.Controller.getInstanceByElement(this._splitHost)
            : null;
        if (split && split._sidePaneCollapsed) {
            split.expandSidePane();
        }
    }

    /**
     * Renders the inline properties view based on the current selection.
     */
    _renderPropsPanel() {
        if (!this._propsHost) {
            return;
        }
        this._propsHost.textContent = "";

        if (this._selectedNodeId) {
            const node = (this._model && this._model.nodes.find(n => n.id === this._selectedNodeId)) || null;
            if (node) {
                this._propsHost.appendChild(this._renderStateProps(node));
                return;
            }
        }
        if (this._selectedEdgeId) {
            const edge = (this._model && this._model.edges.find(e => (e.id || "") === this._selectedEdgeId)) || null;
            if (edge) {
                this._propsHost.appendChild(this._renderTransitionProps(edge));
                return;
            }
        }

        this._propsHost.appendChild(this._renderEmptyProps());
    }

    /**
     * Builds the empty-state hint shown when nothing is selected.
     * @returns {HTMLElement}
     */
    _renderEmptyProps() {
        const props = this._buildPropsShell(
            this._i18n("webexpress.webapp:workflow.editor.props.eyebrow", "Properties"),
            this._i18n("webexpress.webapp:workflow.editor.props.empty.title", "Select an item")
        );
        const body = props.querySelector(".wx-workflow-editor-props__body");

        const hint = document.createElement("div");
        hint.className = "wx-workflow-editor-props__hint";
        hint.textContent = this._i18n("webexpress.webapp:workflow.editor.props.empty.hint",
            "Click a state or transition in the canvas to inspect and edit its properties.");
        body.appendChild(hint);
        return props;
    }

    /**
     * Builds the state properties view (read-only metadata + label + colors).
     * @param {object} node
     * @returns {HTMLElement}
     */
    _renderStateProps(node) {
        const props = this._buildPropsShell(
            this._i18n("webexpress.webapp:workflow.editor.state.eyebrow", "State"),
            node.label || node.id || ""
        );
        const body = props.querySelector(".wx-workflow-editor-props__body");

        body.appendChild(this._renderStaticRow(
            this._i18n("webexpress.webapp:workflow.editor.state.id", "Key"),
            node.id, "wx-workflow-editor-prop-row__value--mono"));

        body.appendChild(this._renderInputRow(
            this._i18n("webexpress.webapp:workflow.editor.state.label", "Label"),
            "label", node.label || "",
            (val) => this._mutateNode(node, { label: val })));

        body.appendChild(this._renderColorRow(
            this._i18n("webexpress.webapp:workflow.editor.state.background", "Background"),
            node.backgroundColor || "#ffffff",
            (val) => this._mutateNode(node, { backgroundColor: val })));

        body.appendChild(this._renderColorRow(
            this._i18n("webexpress.webapp:workflow.editor.state.foreground", "Text colour"),
            node.foregroundColor || "#000000",
            (val) => this._mutateNode(node, { foregroundColor: val })));

        // incoming / outgoing transitions sections
        const incoming = this._model.edges.filter(t => t.to === node.id);
        const outgoing = this._model.edges.filter(t => t.from === node.id);

        body.appendChild(this._renderTransitionListSection(
            this._i18n("webexpress.webapp:workflow.editor.state.incoming", "Incoming transitions"),
            incoming, "to"));
        body.appendChild(this._renderTransitionListSection(
            this._i18n("webexpress.webapp:workflow.editor.state.outgoing", "Outgoing transitions"),
            outgoing, "from"));

        body.appendChild(this._renderDeleteRow(
            this._i18n("webexpress.webapp:workflow.editor.state.delete", "Delete state"),
            () => {
                this._selectedNodeId = node.id;
                this._selectedEdgeId = null;
                this._requestDelete();
            }));

        return props;
    }

    /**
     * Builds the transition properties view (label / form / description /
     * source / target / guards / validators / post functions).
     * @param {object} edge
     * @returns {HTMLElement}
     */
    _renderTransitionProps(edge) {
        const props = this._buildPropsShell(
            this._i18n("webexpress.webapp:workflow.editor.transition.eyebrow", "Transition"),
            edge.label || edge.id || ""
        );
        const body = props.querySelector(".wx-workflow-editor-props__body");

        // source/target meta
        const src = this._model.nodes.find(n => n.id === edge.from);
        const tgt = this._model.nodes.find(n => n.id === edge.to);
        if (src && tgt) {
            const meta = document.createElement("div");
            meta.className = "wx-workflow-editor-props__subtitle";
            meta.textContent = (src.label || src.id) + " → " + (tgt.label || tgt.id);
            props.querySelector(".wx-workflow-editor-props__head").appendChild(meta);
        }

        body.appendChild(this._renderInputRow(
            this._i18n("webexpress.webapp:workflow.editor.transition.label", "Label"),
            "label", edge.label || "",
            (val) => this._mutateEdge(edge, { label: val })));

        body.appendChild(this._renderSelectRow(
            this._i18n("webexpress.webapp:workflow.editor.transition.source", "Source"),
            this._model.nodes.map(n => ({ value: n.id, label: n.label || n.id })),
            edge.from || "",
            (val) => this._mutateEdge(edge, { from: val })));

        body.appendChild(this._renderSelectRow(
            this._i18n("webexpress.webapp:workflow.editor.transition.target", "Target"),
            this._model.nodes.map(n => ({ value: n.id, label: n.label || n.id, disabled: n.id === edge.from })),
            edge.to || "",
            (val) => this._mutateEdge(edge, { to: val })));

        body.appendChild(this._renderInputRow(
            this._i18n("webexpress.webapp:workflow.editor.transition.form", "Form"),
            "form", edge.form || "",
            (val) => this._mutateEdge(edge, { form: val })));

        body.appendChild(this._renderInputRow(
            this._i18n("webexpress.webapp:workflow.editor.transition.description", "Description"),
            "description", edge.description || "",
            (val) => this._mutateEdge(edge, { description: val })));

        body.appendChild(this._renderColorRow(
            this._i18n("webexpress.webapp:workflow.editor.transition.color", "Colour"),
            edge.color || "#000000",
            (val) => this._mutateEdge(edge, { color: val })));

        body.appendChild(this._renderInputRow(
            this._i18n("webexpress.webapp:workflow.editor.transition.dasharray", "Dash array"),
            "dasharray", edge.dasharray || "",
            (val) => this._mutateEdge(edge, { dasharray: val })));

        body.appendChild(this._renderRuleSection(
            edge, "guards",
            this._i18n("webexpress.webapp:workflow.editor.transition.guards", "Guards"),
            "fas fa-shield-alt",
            this._guardsUri,
            this._i18n("webexpress.webapp:workflow.editor.transition.guards.add", "Add guard"),
            this._i18n("webexpress.webapp:workflow.editor.transition.guards.empty", "No guards configured.")));

        body.appendChild(this._renderRuleSection(
            edge, "validators",
            this._i18n("webexpress.webapp:workflow.editor.transition.validators", "Validators"),
            "fas fa-check-double",
            this._validatorsUri,
            this._i18n("webexpress.webapp:workflow.editor.transition.validators.add", "Add validator"),
            this._i18n("webexpress.webapp:workflow.editor.transition.validators.empty", "No validators configured.")));

        body.appendChild(this._renderRuleSection(
            edge, "postfunctions",
            this._i18n("webexpress.webapp:workflow.editor.transition.postfunctions", "Post functions"),
            "fas fa-bolt",
            this._postfunctionsUri,
            this._i18n("webexpress.webapp:workflow.editor.transition.postfunctions.add", "Add post function"),
            this._i18n("webexpress.webapp:workflow.editor.transition.postfunctions.empty", "No post functions configured."),
            true));

        body.appendChild(this._renderDeleteRow(
            this._i18n("webexpress.webapp:workflow.editor.transition.delete", "Delete transition"),
            () => {
                this._selectedEdgeId = edge.id;
                this._selectedNodeId = null;
                this._requestDelete();
            }));

        return props;
    }

    /**
     * Builds the shared shell (eyebrow + title + body) used by every
     * properties view. The eyebrow / title classes mirror the Workflows.html
     * prototype's `props__eyebrow` / `props__title`.
     * @param {string} eyebrow
     * @param {string} title
     * @returns {HTMLElement}
     */
    _buildPropsShell(eyebrow, title) {
        const props = document.createElement("div");
        props.className = "wx-workflow-editor-props";

        const head = document.createElement("div");
        head.className = "wx-workflow-editor-props__head";

        const eyebrowEl = document.createElement("div");
        eyebrowEl.className = "wx-workflow-editor-props__eyebrow";
        eyebrowEl.textContent = eyebrow;
        head.appendChild(eyebrowEl);

        const titleEl = document.createElement("div");
        titleEl.className = "wx-workflow-editor-props__title";
        titleEl.textContent = title;
        head.appendChild(titleEl);

        const body = document.createElement("div");
        body.className = "wx-workflow-editor-props__body";

        props.appendChild(head);
        props.appendChild(body);
        return props;
    }

    /**
     * Renders a label / read-only value row.
     * @param {string} label
     * @param {string} value
     * @param {string} [valueClass]
     * @returns {HTMLElement}
     */
    _renderStaticRow(label, value, valueClass) {
        const row = document.createElement("div");
        row.className = "wx-workflow-editor-prop-row";

        const lbl = document.createElement("span");
        lbl.className = "wx-workflow-editor-prop-row__label";
        lbl.textContent = label;
        row.appendChild(lbl);

        const val = document.createElement("span");
        val.className = "wx-workflow-editor-prop-row__value" + (valueClass ? " " + valueClass : "");
        val.textContent = value || "—";
        row.appendChild(val);

        return row;
    }

    /**
     * Renders a label / text input row.
     *
     * One undo snapshot is captured on focus; subsequent keystrokes mutate the
     * model directly without pushing further history entries, so a typing
     * session collapses into a single undoable edit. The canvas re-renders
     * live and the autosave is debounced.
     * @param {string} label
     * @param {string} key
     * @param {string} value
     * @param {Function} onChange - (string) => void
     * @returns {HTMLElement}
     */
    _renderInputRow(label, key, value, onChange) {
        const row = document.createElement("div");
        row.className = "wx-workflow-editor-prop-row";

        const lbl = document.createElement("span");
        lbl.className = "wx-workflow-editor-prop-row__label";
        lbl.textContent = label;
        row.appendChild(lbl);

        const input = document.createElement("input");
        input.type = "text";
        input.className = "wx-workflow-editor-prop-row__input";
        input.value = value;
        input.dataset.editKey = key;

        let snapshotTaken = false;
        input.addEventListener("focus", () => {
            if (!snapshotTaken) {
                this._saveStateToHistory();
                snapshotTaken = true;
            }
        });
        input.addEventListener("input", () => onChange(input.value));
        input.addEventListener("blur", () => { snapshotTaken = false; });

        row.appendChild(input);
        return row;
    }

    /**
     * Renders a label / select row with auto-save on change.
     * @param {string} label
     * @param {{value:string,label:string,disabled?:boolean}[]} options
     * @param {string} value
     * @param {Function} onChange
     * @returns {HTMLElement}
     */
    _renderSelectRow(label, options, value, onChange) {
        const row = document.createElement("div");
        row.className = "wx-workflow-editor-prop-row";

        const lbl = document.createElement("span");
        lbl.className = "wx-workflow-editor-prop-row__label";
        lbl.textContent = label;
        row.appendChild(lbl);

        const sel = document.createElement("select");
        sel.className = "wx-workflow-editor-prop-row__input";
        for (const o of options) {
            const opt = document.createElement("option");
            opt.value = o.value;
            opt.textContent = o.label;
            if (o.disabled) {
                opt.disabled = true;
            }
            if (o.value === value) {
                opt.selected = true;
            }
            sel.appendChild(opt);
        }
        sel.addEventListener("change", () => {
            this._saveStateToHistory();
            onChange(sel.value);
            this._renderPropsPanel();
        });
        row.appendChild(sel);
        return row;
    }

    /**
     * Renders a label / colour-picker row. The native colour input is paired
     * with a swatch so the picker has more visual weight than a stock control.
     * @param {string} label
     * @param {string} value
     * @param {Function} onChange
     * @returns {HTMLElement}
     */
    _renderColorRow(label, value, onChange) {
        const row = document.createElement("div");
        row.className = "wx-workflow-editor-prop-row";

        const lbl = document.createElement("span");
        lbl.className = "wx-workflow-editor-prop-row__label";
        lbl.textContent = label;
        row.appendChild(lbl);

        const wrap = document.createElement("span");
        wrap.className = "wx-workflow-editor-prop-row__color";

        const swatch = document.createElement("span");
        swatch.className = "wx-workflow-editor-prop-row__swatch";
        swatch.style.background = value;
        wrap.appendChild(swatch);

        const input = document.createElement("input");
        input.type = "color";
        input.className = "wx-workflow-editor-prop-row__color-input";
        input.value = value;

        let snapshotTaken = false;
        input.addEventListener("focus", () => {
            if (!snapshotTaken) {
                this._saveStateToHistory();
                snapshotTaken = true;
            }
        });
        input.addEventListener("input", () => {
            swatch.style.background = input.value;
            onChange(input.value);
        });
        input.addEventListener("change", () => { snapshotTaken = false; });
        wrap.appendChild(input);
        row.appendChild(wrap);

        return row;
    }

    /**
     * Renders a danger-styled delete row.
     * @param {string} label
     * @param {Function} onClick
     * @returns {HTMLElement}
     */
    _renderDeleteRow(label, onClick) {
        const wrap = document.createElement("div");
        wrap.className = "wx-workflow-editor-props__danger";

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "wx-workflow-editor-btn wx-workflow-editor-btn--danger";
        btn.innerHTML = `<i class="fas fa-trash" aria-hidden="true"></i> <span></span>`;
        btn.querySelector("span").textContent = label;
        btn.addEventListener("click", onClick);

        wrap.appendChild(btn);
        return wrap;
    }

    /**
     * Renders a labelled, collapsible-style section that lists a state's
     * incoming or outgoing transitions.
     * @param {string} title
     * @param {object[]} edges
     * @param {string} otherSide - "from" or "to" (the side that isn't this state).
     * @returns {HTMLElement}
     */
    _renderTransitionListSection(title, edges, otherSide) {
        const section = document.createElement("div");
        section.className = "wx-workflow-editor-prop-section";

        const head = document.createElement("div");
        head.className = "wx-workflow-editor-prop-section__head";

        const titleEl = document.createElement("span");
        titleEl.textContent = title;
        head.appendChild(titleEl);

        const badge = document.createElement("span");
        badge.className = "wx-workflow-editor-badge" + (edges.length === 0 ? " wx-workflow-editor-badge--zero" : "");
        badge.textContent = String(edges.length);
        head.appendChild(badge);

        section.appendChild(head);

        const body = document.createElement("div");
        body.className = "wx-workflow-editor-prop-section__body";
        if (edges.length === 0) {
            const empty = document.createElement("div");
            empty.className = "wx-workflow-editor-prop-section__empty";
            empty.textContent = this._i18n("webexpress.webapp:workflow.editor.section.none", "—");
            body.appendChild(empty);
        } else {
            for (const e of edges) {
                const item = document.createElement("button");
                item.type = "button";
                item.className = "wx-workflow-editor-prop-section__item";
                const otherNode = this._model.nodes.find(n => n.id === e[otherSide]);
                const otherLabel = otherNode ? (otherNode.label || otherNode.id) : "?";
                item.innerHTML = `<i class="fas fa-arrow-right" aria-hidden="true"></i><span class="wx-workflow-editor-prop-section__item-label"></span><span class="wx-workflow-editor-prop-section__item-side"></span>`;
                item.querySelector(".wx-workflow-editor-prop-section__item-label").textContent = e.label || e.id || "";
                item.querySelector(".wx-workflow-editor-prop-section__item-side").textContent = otherLabel;
                item.addEventListener("click", () => {
                    this._deselectAll();
                    this._selectedEdgeId = e.id || "";
                    this._updateToolbarState();
                    this.render();
                });
                body.appendChild(item);
            }
        }
        section.appendChild(body);
        return section;
    }

    /**
     * Renders a guard / validator / post-function section with an inline
     * picker dropdown (lazy-loaded from the corresponding URI). When
     * `ordered=true` the items are numbered and can be reordered via ↑ / ↓.
     * @param {object} edge
     * @param {"guards"|"validators"|"postfunctions"} kind
     * @param {string} title
     * @param {string} iconClass
     * @param {string} uri
     * @param {string} addLabel
     * @param {string} emptyLabel
     * @param {boolean} [ordered=false]
     * @returns {HTMLElement}
     */
    _renderRuleSection(edge, kind, title, iconClass, uri, addLabel, emptyLabel, ordered = false) {
        if (!Array.isArray(edge[kind])) {
            edge[kind] = [];
        }
        const items = edge[kind];

        const section = document.createElement("div");
        section.className = "wx-workflow-editor-prop-section";

        // head ─ title / count badge / add button (with picker)
        const head = document.createElement("div");
        head.className = "wx-workflow-editor-prop-section__head";

        const icon = document.createElement("i");
        icon.className = iconClass;
        icon.setAttribute("aria-hidden", "true");
        head.appendChild(icon);

        const titleEl = document.createElement("span");
        titleEl.textContent = title;
        head.appendChild(titleEl);

        const badge = document.createElement("span");
        badge.className = "wx-workflow-editor-badge" + (items.length === 0 ? " wx-workflow-editor-badge--zero" : "");
        badge.textContent = String(items.length);
        head.appendChild(badge);

        const addWrap = document.createElement("div");
        addWrap.className = "wx-workflow-editor-rule-add";

        const addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.className = "wx-workflow-editor-btn wx-workflow-editor-btn--ghost";
        addBtn.innerHTML = `<i class="fas fa-plus" aria-hidden="true"></i> <span></span>`;
        addBtn.querySelector("span").textContent = addLabel;
        addWrap.appendChild(addBtn);

        const picker = document.createElement("div");
        picker.className = "wx-workflow-editor-rule-picker";
        picker.style.display = "none";
        addWrap.appendChild(picker);

        const renderPickerItems = (lib) => {
            picker.textContent = "";
            if (!lib || lib.length === 0) {
                const empty = document.createElement("div");
                empty.className = "wx-workflow-editor-rule-picker__empty";
                empty.textContent = this._i18n("webexpress.webapp:workflow.editor.picker.empty",
                    "No catalog entries available.");
                picker.appendChild(empty);
                return;
            }
            for (const tpl of lib) {
                const opt = document.createElement("button");
                opt.type = "button";
                opt.className = "wx-workflow-editor-rule-picker__item";
                opt.innerHTML = `<span class="wx-workflow-editor-rule-picker__kind"></span><span class="wx-workflow-editor-rule-picker__text"></span>`;
                opt.querySelector(".wx-workflow-editor-rule-picker__kind").textContent = tpl.type || tpl.kind || "rule";
                opt.querySelector(".wx-workflow-editor-rule-picker__text").textContent = tpl.label || tpl.text || tpl.id;
                opt.addEventListener("click", () => {
                    this._saveStateToHistory();
                    const next = items.slice();
                    next.push({
                        id: kind + "_" + Date.now(),
                        type: tpl.type || tpl.kind || "rule",
                        label: tpl.label || tpl.text || tpl.id,
                        children: kind === "postfunctions" ? undefined : []
                    });
                    this._mutateEdge(edge, { [kind]: next });
                    picker.style.display = "none";
                    this._renderPropsPanel();
                });
                picker.appendChild(opt);
            }
        };

        addBtn.addEventListener("click", (ev) => {
            ev.stopPropagation();
            const visible = picker.style.display === "block";
            // close other open pickers
            for (const p of this._propsHost.querySelectorAll(".wx-workflow-editor-rule-picker")) {
                p.style.display = "none";
            }
            picker.style.display = visible ? "none" : "block";
            if (!visible) {
                this._loadLibrary(uri).then(lib => renderPickerItems(lib));
            }
        });

        head.appendChild(addWrap);
        section.appendChild(head);

        // body ─ ordered list of currently configured items
        const body = document.createElement("div");
        body.className = "wx-workflow-editor-prop-section__body";

        if (items.length === 0) {
            const empty = document.createElement("div");
            empty.className = "wx-workflow-editor-prop-section__empty";
            empty.textContent = emptyLabel;
            body.appendChild(empty);
        } else {
            const list = document.createElement(ordered ? "ol" : "ul");
            list.className = "wx-workflow-editor-rule-list";

            items.forEach((it, idx) => {
                const li = document.createElement("li");
                li.className = "wx-workflow-editor-rule-list__item";

                if (ordered) {
                    const num = document.createElement("span");
                    num.className = "wx-workflow-editor-rule-list__num";
                    num.textContent = String(idx + 1);
                    li.appendChild(num);
                }

                const kindEl = document.createElement("span");
                kindEl.className = "wx-workflow-editor-rule-list__kind";
                kindEl.textContent = it.type || it.kind || "rule";
                li.appendChild(kindEl);

                const textEl = document.createElement("span");
                textEl.className = "wx-workflow-editor-rule-list__text";
                textEl.textContent = it.label || it.text || it.id || "";
                li.appendChild(textEl);

                const actions = document.createElement("span");
                actions.className = "wx-workflow-editor-rule-list__actions";

                if (ordered && idx > 0) {
                    actions.appendChild(this._buildSmallBtn("↑",
                        this._i18n("webexpress.webapp:workflow.editor.rule.up", "Move up"),
                        () => {
                            this._saveStateToHistory();
                            const next = items.slice();
                            const [moved] = next.splice(idx, 1);
                            next.splice(idx - 1, 0, moved);
                            this._mutateEdge(edge, { [kind]: next });
                            this._renderPropsPanel();
                        }));
                }
                if (ordered && idx < items.length - 1) {
                    actions.appendChild(this._buildSmallBtn("↓",
                        this._i18n("webexpress.webapp:workflow.editor.rule.down", "Move down"),
                        () => {
                            this._saveStateToHistory();
                            const next = items.slice();
                            const [moved] = next.splice(idx, 1);
                            next.splice(idx + 1, 0, moved);
                            this._mutateEdge(edge, { [kind]: next });
                            this._renderPropsPanel();
                        }));
                }
                actions.appendChild(this._buildSmallBtn("×",
                    this._i18n("webexpress.webapp:workflow.editor.rule.remove", "Remove"),
                    () => {
                        this._saveStateToHistory();
                        const next = items.slice();
                        next.splice(idx, 1);
                        this._mutateEdge(edge, { [kind]: next });
                        this._renderPropsPanel();
                    }, "wx-workflow-editor-rule-list__btn--danger"));

                li.appendChild(actions);
                list.appendChild(li);
            });

            body.appendChild(list);
        }

        section.appendChild(body);
        return section;
    }

    /**
     * Helper for small icon-style buttons used inside rule rows.
     * @param {string} text
     * @param {string} title
     * @param {Function} onClick
     * @param {string} [extraClass]
     * @returns {HTMLButtonElement}
     */
    _buildSmallBtn(text, title, onClick, extraClass) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "wx-workflow-editor-rule-list__btn" + (extraClass ? " " + extraClass : "");
        btn.title = title;
        btn.textContent = text;
        btn.addEventListener("click", (ev) => {
            ev.stopPropagation();
            onClick();
        });
        return btn;
    }

    /**
     * Lazy-loads a catalog (guards / validators / post functions) from the
     * configured URI and caches the result. Returns an empty list when no URI
     * is configured.
     * @param {string} uri
     * @returns {Promise<object[]>}
     */
    _loadLibrary(uri) {
        if (!uri) {
            return Promise.resolve([]);
        }
        if (this._libraryCache[uri]) {
            return Promise.resolve(this._libraryCache[uri]);
        }
        return fetch(uri)
            .then(res => res.json())
            .then(data => {
                const items = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : []);
                this._libraryCache[uri] = items;
                return items;
            })
            .catch(err => {
                console.error("workflow editor: failed to load library", uri, err);
                return [];
            });
    }

    /**
     * Applies a partial mutation to a state node. Re-renders the canvas and
     * triggers the debounced save. The caller is responsible for taking an
     * undo snapshot at the right granularity (per-action, not per-keystroke).
     * @param {object} node
     * @param {object} patch
     */
    _mutateNode(node, patch) {
        Object.assign(node, patch);

        // sync visual node for repaint
        const visual = (this._nodes || []).find(n => n.id === node.id);
        if (visual) {
            Object.assign(visual, patch);
        }

        this._buildPhysics();
        this.render();
        this._emitChangeSafe();
    }

    /**
     * Applies a partial mutation to a transition. Re-renders the canvas and
     * triggers the debounced save. The caller is responsible for taking an
     * undo snapshot at the right granularity (per-action, not per-keystroke).
     * @param {object} edge
     * @param {object} patch
     */
    _mutateEdge(edge, patch) {
        Object.assign(edge, patch);

        this.render();
        this._emitChangeSafe();
    }

    /**
     * Tears down handlers so reloading the editor does not leak listeners.
     */
    destroy() {
        if (this._kbHandler) {
            window.removeEventListener("keydown", this._kbHandler);
            this._kbHandler = null;
        }
        if (this._saveDebounce) {
            clearTimeout(this._saveDebounce);
            this._saveDebounce = null;
        }
        if (this._abortController) {
            this._abortController.abort("workflow editor: destroyed");
        }
    }
};

// register the class in the framework controller
webexpress.webui.Controller.registerClass("wx-webapp-workflow-editor", webexpress.webapp.WorkflowEditorCtrl);
