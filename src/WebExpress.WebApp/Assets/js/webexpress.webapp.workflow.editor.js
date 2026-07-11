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
 * view inside the right pane (no modal). When nothing is selected the panel
 * shows a preflight status and a quick "Add transition" action.
 *
 * Transition properties group the rule editors (Validations, Guards, Post
 * functions) into a tabbed area mirroring the design handoff.
 *
 * REST integration
 * ----------------
 * A single GET on the data service, keyed by the workflow id from the state
 * island, returns the workflow definition as a `RestApiWorkflowResult`
 * payload. The same response carries the catalogs of available guards,
 * validations and post functions consumed by the rule pickers, so no
 * additional endpoints are needed.
 *
 * It is scope-capable: when the host carries a data-wx-resource binding the
 * workflow is a slice of an enclosing ViewState scope, so the editor
 * subscribes to that slice and the scope owns the central load; the debounced
 * autosave still persists through the scope's data service. Without a binding
 * the editor owns its own wx-service island and loads itself (standalone).
 *
 * Mutations are debounced and persisted automatically.
 */
webexpress.webapp.WorkflowEditorCtrl = class extends webexpress.webui.GraphEditorCtrl {

    // configuration
    _restUri = "";
    _workflowId = "";

    // cached catalogs sourced from the same REST response
    _catalog = { guards: [], validations: [], postfunctions: [] };

    // request state
    _isLoading = false;
    _destroyed = false;
    _saveDebounce = null;

    // workflow header metadata kept for round-tripping
    _meta = { id: "", name: "", state: "", version: "", description: "" };

    // split layout
    _splitHost = null;
    _canvasPane = null;
    _propsPane = null;
    _propsHost = null;
    _toggleBtn = null;

    // remembered tab selection so the panel does not snap back to the first
    // tab on every render (e.g. while picking a rule)
    _activeTransitionTab = "validations";

    /**
     * Initializes the workflow editor on the host element.
     * @param {HTMLElement} element - host element with the wx-webapp-workflow-editor class.
     */
    constructor(element) {
        // consume the islands before the base constructor clears the host;
        // the reads cache on the element, so they survive the dom rebuild
        const state = webexpress.webapp.Data.readState(element);
        const islandServices = webexpress.webapp.ServiceRegistry.fromElement(element);

        super(element);

        // the workflow id is authored in C# through the state island and rides
        // along as the logical id query parameter on load and save; the wire
        // name stays with the service descriptor
        this._workflowId = typeof state.id === "string" ? state.id : "";

        // the debounced autosave PUT flows through this rest service
        this._service = islandServices.data;
        this._restUri = this._service ? this._service.baseUri : "";

        // the resource a scope renders; when present the workflow is loaded
        // centrally by the enclosing scope, when absent the control loads
        // itself (standalone)
        this._resource = (element.dataset && element.dataset.wxResource) || null;

        element.classList.add("wx-workflow-editor");

        this._buildLayout();
        this._setupShortcuts();

        if (this._resource) {
            this._attachToScope(element);
        } else if (this._restUri !== "") {
            this._receiveData();
        }

        this._renderPropsPanel();
    }

    /**
     * Attaches the editor to the enclosing scope ViewState and renders its
     * resource slice. The scope owns the central load and the service, while
     * the debounced autosave still persists through the scope's data service.
     * @param {HTMLElement} element - The host element.
     */
    _attachToScope(element) {
        const viewId = (element.dataset && element.dataset.wxView) || null;

        webexpress.webapp.ViewStateRegistry.whenReady(element, viewId, (viewState) => {
            this._viewState = viewState;

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
     * Renders a resource slice the scope loaded centrally. A slice arriving
     * while an autosave is pending is skipped, because re-applying the server
     * model would clobber the edits the debounce has not persisted yet; the
     * next scope re-query delivers the saved state.
     * @param {object} slice - The resource slice { items, total, data, loading, error }.
     */
    _applySlice(slice) {
        slice = slice || {};
        if (!slice.data || this._destroyed || this._saveDebounce !== null) {
            return;
        }

        const response = slice.data;
        this._meta = webexpress.webapp.workflowEditorModel.normalizeMeta(response);
        this._catalog = webexpress.webapp.workflowEditorModel.normalizeCatalog(response);
        this.model = this._fromWireFormat(response);
        this._element.classList.remove("placeholder-glow");
        this._isLoading = false;
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
            toggle.title = this._i18n("webexpress.webui:workflow.editor.props.toggle");
            toggle.innerHTML = `<i class="${this._iconClass("fas fa-columns", "columns")}" aria-hidden="true"></i>`;
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

        // split host - registered class name `wx-webui-split` is auto-replaced by
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
     * Loads the workflow model from the REST endpoint. A single response
     * carries both the workflow definition (states / transitions) and the
     * catalogs (guards / validations / postfunctions) that drive the rule
     * pickers, matching the `RestApiWorkflowResult` shape.
     */
    _receiveData() {
        if (this._restUri === "") {
            return;
        }

        this._isLoading = true;
        this._element.classList.add("placeholder-glow");

        // the rest service maps the logical id to its wire name and aborts a
        // previous in-flight load when a newer one replaces it
        const params = this._workflowId !== "" ? { id: this._workflowId } : {};

        this._service.query(params)
            .then(res => {
                if (this._destroyed || (res.error && res.error.kind === "abort")) {
                    return;
                }
                if (!res.ok) {
                    console.error("workflow editor: load request failed (" + res.status + ")");
                    this._element.classList.remove("placeholder-glow");
                    this._isLoading = false;
                    return;
                }
                const response = res.data;
                this._meta = webexpress.webapp.workflowEditorModel.normalizeMeta(response);
                this._catalog = webexpress.webapp.workflowEditorModel.normalizeCatalog(response);
                this.model = this._fromWireFormat(response);
                this._element.classList.remove("placeholder-glow");
                this._isLoading = false;
                this._renderPropsPanel();
            });
    }

    /**
     * Translates the REST `{ states, transitions }` payload (or a model that
     * already speaks `{ nodes, edges }`) to the graph editor shape.
     * @param {object} response
     * @returns {{nodes: Array, edges: Array}}
     */
    _fromWireFormat(response) {
        return webexpress.webapp.workflowEditorModel.fromWireFormat(response);
    }

    /**
     * Hooks the autosave flow into the change pipeline. The properties panel
     * is intentionally NOT rebuilt here - that would tear down the input the
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
     * selection actually changes - re-renders triggered while typing in an
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

        const payload = webexpress.webapp.workflowEditorModel.toWirePayload(this._meta, this._model);
        const options = this._workflowId !== "" ? { params: { id: this._workflowId } } : {};

        this._service.update(payload, options)
            .then(res => {
                if (!res.ok) {
                    console.warn("workflow editor: save returned " + res.status);
                }
            });
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
     * Builds the empty-state hint shown when nothing is selected. Mirrors the
     * layout handoff: eyebrow / title / hint, a preflight status block, and a
     * quick "Add transition" action.
     * @returns {HTMLElement}
     */
    _renderEmptyProps() {
        const props = this._buildPropsShell(
            this._i18n("webexpress.webui:workflow.editor.props.eyebrow"),
            this._i18n("webexpress.webui:workflow.editor.props.empty.title")
        );
        const body = props.querySelector(".wx-workflow-editor-props__body");

        const hint = document.createElement("div");
        hint.className = "wx-workflow-editor-props__hint";
        hint.textContent = this._i18n("webexpress.webui:workflow.editor.props.empty.hint");
        body.appendChild(hint);

        body.appendChild(this._renderPreflightStatus());

        const addRow = document.createElement("div");
        addRow.className = "wx-workflow-editor-props__add-action";

        const addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.className = "wx-workflow-editor-btn wx-workflow-editor-btn--ghost";
        addBtn.innerHTML = `<i class="${this._iconClass("fas fa-plus", "plus")}" aria-hidden="true"></i> <span></span>`;
        addBtn.querySelector("span").textContent =
            this._i18n("webexpress.webui:workflow.editor.props.add.transition");
        addBtn.addEventListener("click", () => this._beginAddTransition());
        addRow.appendChild(addBtn);
        body.appendChild(addRow);

        return props;
    }

    /**
     * Computes a quick preflight summary for the current model and renders it
     * as a status block. Reports the first concrete issue when something is
     * off; otherwise reports "all green".
     * @returns {HTMLElement}
     */
    _renderPreflightStatus() {
        const issues = this._collectPreflightIssues();

        const box = document.createElement("div");
        box.className = "wx-workflow-editor-preflight";

        const icon = document.createElement("i");
        const text = document.createElement("span");
        text.className = "wx-workflow-editor-preflight__text";

        if (issues.length === 0) {
            box.classList.add("wx-workflow-editor-preflight--ok");
            icon.className = this._iconClass("fas fa-check", "check");
            text.textContent = this._i18n("webexpress.webui:workflow.editor.preflight.ok");
        } else {
            box.classList.add("wx-workflow-editor-preflight--warn");
            icon.className = this._iconClass("fas fa-triangle-exclamation", "triangle-exclamation");
            text.textContent = issues[0];
        }
        icon.setAttribute("aria-hidden", "true");

        box.appendChild(icon);
        box.appendChild(text);
        return box;
    }

    /**
     * Collects model-level issues used by the preflight indicator. A non-empty
     * list disables the OK badge in the empty-state panel.
     * @returns {string[]}
     */
    _collectPreflightIssues() {
        const issues = [];
        if (!this._model) {
            return issues;
        }
        const nodes = this._model.nodes || [];
        const edges = this._model.edges || [];
        const ids = new Set(nodes.map(n => n.id));

        for (const e of edges) {
            if (!ids.has(e.from) || !ids.has(e.to)) {
                issues.push(this._i18n("webexpress.webui:workflow.editor.preflight.broken.reference"));
                return issues;
            }
        }

        if (nodes.length > 0) {
            const reachable = new Set();
            const queue = [nodes[0].id];
            while (queue.length > 0) {
                const id = queue.shift();
                if (reachable.has(id)) {
                    continue;
                }
                reachable.add(id);
                for (const e of edges) {
                    if (e.from === id) { queue.push(e.to); }
                }
            }
            if (reachable.size < nodes.length) {
                issues.push(this._i18n("webexpress.webui:workflow.editor.preflight.unreachable"));
            }
        }

        return issues;
    }

    /**
     * Inserts a brand-new transition between the first two states and selects
     * it for editing. Used by the empty-state quick action.
     */
    _beginAddTransition() {
        if (!this._model || (this._model.nodes || []).length < 2) {
            return;
        }
        this._saveStateToHistory();

        const [a, b] = this._model.nodes;
        const newEdge = {
            id: "tr_" + Date.now(),
            from: a.id,
            to: b.id,
            label: this._i18n("webexpress.webui:workflow.editor.transition.new"),
            guards: [],
            validators: [],
            postfunctions: []
        };
        this._model.edges.push(newEdge);

        this._deselectAll();
        this._selectedEdgeId = newEdge.id;

        this._buildPhysics();
        this.render();
        this._updateToolbarState();
        this._emitChangeSafe();
    }

    /**
     * Builds the state properties view (read-only metadata + label + colors).
     * @param {object} node
     * @returns {HTMLElement}
     */
    _renderStateProps(node) {
        const props = this._buildPropsShell(
            this._i18n("webexpress.webui:workflow.editor.state.eyebrow"),
            node.label || node.id || ""
        );
        const body = props.querySelector(".wx-workflow-editor-props__body");

        body.appendChild(this._renderStaticRow(
            this._i18n("webexpress.webui:workflow.editor.state.id"),
            node.id, "wx-workflow-editor-prop-row__value--mono"));

        body.appendChild(this._renderInputRow(
            this._i18n("webexpress.webui:workflow.editor.state.label"),
            "label", node.label || "",
            (val) => this._mutateNode(node, { label: val })));

        body.appendChild(this._renderColorRow(
            this._i18n("webexpress.webui:workflow.editor.state.background"),
            node.backgroundColor || "#ffffff",
            (val) => this._mutateNode(node, { backgroundColor: val })));

        body.appendChild(this._renderColorRow(
            this._i18n("webexpress.webui:workflow.editor.state.foreground"),
            node.foregroundColor || "#000000",
            (val) => this._mutateNode(node, { foregroundColor: val })));

        // incoming / outgoing transitions sections
        const incoming = this._model.edges.filter(t => t.to === node.id);
        const outgoing = this._model.edges.filter(t => t.from === node.id);

        body.appendChild(this._renderTransitionListSection(
            this._i18n("webexpress.webui:workflow.editor.state.incoming"),
            incoming, "to"));
        body.appendChild(this._renderTransitionListSection(
            this._i18n("webexpress.webui:workflow.editor.state.outgoing"),
            outgoing, "from"));

        body.appendChild(this._renderDeleteRow(
            this._i18n("webexpress.webui:workflow.editor.state.delete"),
            () => {
                this._selectedNodeId = node.id;
                this._selectedEdgeId = null;
                this._requestDelete();
            }));

        return props;
    }

    /**
     * Builds the transition properties view (label / form / description /
     * source / target) followed by tabs for Validations / Guards / Post
     * functions.
     * @param {object} edge
     * @returns {HTMLElement}
     */
    _renderTransitionProps(edge) {
        const props = this._buildPropsShell(
            this._i18n("webexpress.webui:workflow.editor.transition.eyebrow"),
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
            this._i18n("webexpress.webui:workflow.editor.transition.label"),
            "label", edge.label || "",
            (val) => this._mutateEdge(edge, { label: val })));

        body.appendChild(this._renderSelectRow(
            this._i18n("webexpress.webui:workflow.editor.transition.source"),
            this._model.nodes.map(n => ({ value: n.id, label: n.label || n.id })),
            edge.from || "",
            (val) => this._mutateEdge(edge, { from: val })));

        body.appendChild(this._renderSelectRow(
            this._i18n("webexpress.webui:workflow.editor.transition.target"),
            this._model.nodes.map(n => ({ value: n.id, label: n.label || n.id, disabled: n.id === edge.from })),
            edge.to || "",
            (val) => this._mutateEdge(edge, { to: val })));

        body.appendChild(this._renderInputRow(
            this._i18n("webexpress.webui:workflow.editor.transition.form"),
            "form", edge.form || "",
            (val) => this._mutateEdge(edge, { form: val })));

        body.appendChild(this._renderInputRow(
            this._i18n("webexpress.webui:workflow.editor.transition.description"),
            "description", edge.description || "",
            (val) => this._mutateEdge(edge, { description: val })));

        body.appendChild(this._renderColorRow(
            this._i18n("webexpress.webui:workflow.editor.transition.color"),
            edge.color || "#000000",
            (val) => this._mutateEdge(edge, { color: val })));

        body.appendChild(this._renderInputRow(
            this._i18n("webexpress.webui:workflow.editor.transition.dasharray"),
            "dasharray", edge.dasharray || "",
            (val) => this._mutateEdge(edge, { dasharray: val })));

        body.appendChild(this._renderRuleTabs(edge));

        body.appendChild(this._renderDeleteRow(
            this._i18n("webexpress.webui:workflow.editor.transition.delete"),
            () => {
                this._selectedEdgeId = edge.id;
                this._selectedNodeId = null;
                this._requestDelete();
            }));

        return props;
    }

    /**
     * Builds the tab strip that groups the rule editors (Validations / Guards
     * / Post functions). The tab control is a plain DOM-driven implementation
     * so it can co-exist with the dynamic rebuild that drives the rest of the
     * properties panel.
     * @param {object} edge
     * @returns {HTMLElement}
     */
    _renderRuleTabs(edge) {
        const tabs = [
            {
                id: "validations",
                label: this._i18n("webexpress.webui:workflow.editor.transition.validations"),
                icon: "fas fa-check-double",
                build: () => this._renderRulePanel(edge, "validators",
                    this._catalog.validations,
                    this._i18n("webexpress.webui:workflow.editor.transition.validations.add"),
                    this._i18n("webexpress.webui:workflow.editor.transition.validations.empty"),
                    false)
            },
            {
                id: "guards",
                label: this._i18n("webexpress.webui:workflow.editor.transition.guards"),
                icon: this._iconClass("fas fa-shield-alt", "shield"),
                build: () => this._renderRulePanel(edge, "guards",
                    this._catalog.guards,
                    this._i18n("webexpress.webui:workflow.editor.transition.guards.add"),
                    this._i18n("webexpress.webui:workflow.editor.transition.guards.empty"),
                    false)
            },
            {
                id: "postfunctions",
                label: this._i18n("webexpress.webui:workflow.editor.transition.postfunctions"),
                icon: this._iconClass("fas fa-bolt", "bolt"),
                build: () => this._renderRulePanel(edge, "postfunctions",
                    this._catalog.postfunctions,
                    this._i18n("webexpress.webui:workflow.editor.transition.postfunctions.add"),
                    this._i18n("webexpress.webui:workflow.editor.transition.postfunctions.empty"),
                    true)
            }
        ];

        const wrapper = document.createElement("div");
        wrapper.className = "wx-workflow-editor-tabs";

        const nav = document.createElement("div");
        nav.className = "wx-workflow-editor-tabs__nav";
        nav.setAttribute("role", "tablist");

        const panel = document.createElement("div");
        panel.className = "wx-workflow-editor-tabs__panel";
        panel.setAttribute("role", "tabpanel");

        const counts = {
            validations: Array.isArray(edge.validators) ? edge.validators.length : 0,
            guards: Array.isArray(edge.guards) ? edge.guards.length : 0,
            postfunctions: Array.isArray(edge.postfunctions) ? edge.postfunctions.length : 0
        };

        const activeId = tabs.some(t => t.id === this._activeTransitionTab)
            ? this._activeTransitionTab
            : tabs[0].id;

        const renderActivePanel = () => {
            panel.textContent = "";
            const active = tabs.find(t => t.id === this._activeTransitionTab) || tabs[0];
            panel.appendChild(active.build());
        };

        for (const tab of tabs) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "wx-workflow-editor-tabs__tab";
            btn.setAttribute("role", "tab");
            btn.dataset.tabId = tab.id;
            if (tab.id === activeId) {
                btn.classList.add("is-active");
                btn.setAttribute("aria-selected", "true");
            } else {
                btn.setAttribute("aria-selected", "false");
            }

            const i = document.createElement("i");
            i.className = tab.icon;
            i.setAttribute("aria-hidden", "true");
            btn.appendChild(i);

            const lbl = document.createElement("span");
            lbl.className = "wx-workflow-editor-tabs__label";
            lbl.textContent = tab.label;
            btn.appendChild(lbl);

            const badge = document.createElement("span");
            const count = counts[tab.id] || 0;
            badge.className = "wx-workflow-editor-badge" + (count === 0 ? " wx-workflow-editor-badge--zero" : "");
            badge.textContent = String(count);
            btn.appendChild(badge);

            btn.addEventListener("click", () => {
                if (this._activeTransitionTab === tab.id) {
                    return;
                }
                this._activeTransitionTab = tab.id;
                for (const t of nav.querySelectorAll(".wx-workflow-editor-tabs__tab")) {
                    const isActive = t.dataset.tabId === tab.id;
                    t.classList.toggle("is-active", isActive);
                    t.setAttribute("aria-selected", isActive ? "true" : "false");
                }
                renderActivePanel();
            });

            nav.appendChild(btn);
        }

        wrapper.appendChild(nav);
        wrapper.appendChild(panel);

        this._activeTransitionTab = activeId;
        renderActivePanel();

        return wrapper;
    }

    /**
     * Builds the shared shell (eyebrow + title + body) used by every
     * properties view.
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
        val.textContent = value || "-";
        row.appendChild(val);

        return row;
    }

    /**
     * Renders a label / text input row.
     *
     * One undo snapshot is captured on focus; subsequent keystrokes mutate the
     * model directly without pushing further history entries.
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
        btn.innerHTML = `<i class="${this._iconClass("fas fa-trash", "trash")}" aria-hidden="true"></i> <span></span>`;
        btn.querySelector("span").textContent = label;
        btn.addEventListener("click", onClick);

        wrap.appendChild(btn);
        return wrap;
    }

    /**
     * Renders a labelled section that lists a state's incoming or outgoing
     * transitions.
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
            empty.textContent = this._i18n("webexpress.webui:workflow.editor.section.none");
            body.appendChild(empty);
        } else {
            for (const e of edges) {
                const item = document.createElement("button");
                item.type = "button";
                item.className = "wx-workflow-editor-prop-section__item";
                const otherNode = this._model.nodes.find(n => n.id === e[otherSide]);
                const otherLabel = otherNode ? (otherNode.label || otherNode.id) : "?";
                item.innerHTML = `<i class="${this._iconClass("fas fa-arrow-right", "arrow-right")}" aria-hidden="true"></i><span class="wx-workflow-editor-prop-section__item-label"></span><span class="wx-workflow-editor-prop-section__item-side"></span>`;
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
     * Renders the rule list panel (used inside each tab) with an inline picker
     * for the configured catalog. When `ordered=true` the items are numbered
     * and can be reordered via ↑ / ↓.
     * @param {object} edge
     * @param {"validators"|"guards"|"postfunctions"} kind
     * @param {object[]} catalog - catalog entries from the REST response
     * @param {string} addLabel
     * @param {string} emptyLabel
     * @param {boolean} ordered
     * @returns {HTMLElement}
     */
    _renderRulePanel(edge, kind, catalog, addLabel, emptyLabel, ordered) {
        if (!Array.isArray(edge[kind])) {
            edge[kind] = [];
        }
        const items = edge[kind];

        const panel = document.createElement("div");
        panel.className = "wx-workflow-editor-rule-panel";

        // toolbar row ─ add button (with picker)
        const addWrap = document.createElement("div");
        addWrap.className = "wx-workflow-editor-rule-add";

        const addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.className = "wx-workflow-editor-btn wx-workflow-editor-btn--ghost";
        addBtn.innerHTML = `<i class="${this._iconClass("fas fa-plus", "plus")}" aria-hidden="true"></i> <span></span>`;
        addBtn.querySelector("span").textContent = addLabel;
        addWrap.appendChild(addBtn);

        const picker = document.createElement("div");
        picker.className = "wx-workflow-editor-rule-picker";
        picker.style.display = "none";
        addWrap.appendChild(picker);

        const renderPickerItems = () => {
            picker.textContent = "";
            if (!catalog || catalog.length === 0) {
                const empty = document.createElement("div");
                empty.className = "wx-workflow-editor-rule-picker__empty";
                empty.textContent = this._i18n("webexpress.webui:workflow.editor.picker.empty");
                picker.appendChild(empty);
                return;
            }
            for (const tpl of catalog) {
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
                renderPickerItems();
            }
        });

        panel.appendChild(addWrap);

        // list ─ ordered list of currently configured items
        const body = document.createElement("div");
        body.className = "wx-workflow-editor-rule-panel__body";

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
                        this._i18n("webexpress.webui:workflow.editor.rule.up"),
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
                        this._i18n("webexpress.webui:workflow.editor.rule.down"),
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
                    this._i18n("webexpress.webui:workflow.editor.rule.remove"),
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

        panel.appendChild(body);
        return panel;
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
     * Applies a partial mutation to a state node. Re-renders the canvas and
     * triggers the debounced save.
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
     * triggers the debounced save.
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
        // a load resolving after teardown must not touch the detached DOM
        this._destroyed = true;

        if (this._kbHandler) {
            window.removeEventListener("keydown", this._kbHandler);
            this._kbHandler = null;
        }
        if (this._saveDebounce) {
            clearTimeout(this._saveDebounce);
            this._saveDebounce = null;
        }
    }
};

// register the class in the framework controller
webexpress.webui.Controller.registerClass("wx-webapp-workflow-editor", webexpress.webapp.WorkflowEditorCtrl);
