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
 * It is ViewState-capable: when the host carries a data-wx-resource binding the
 * workflow is a slice of an enclosing ViewState, so the editor
 * subscribes to that slice and the ViewState owns the central load; the debounced
 * autosave still persists through the ViewState's data service. Without a binding
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
    _saveInFlight = false;

    // the persistence state the status indicator reflects: "idle" before the
    // first change, "dirty" while edits are queued, "saving", "saved" and
    // "error" (a failed save or a failed load, both offering a retry)
    _saveState = "idle";
    _lastSavedAt = null;
    _statusMessage = null;
    _statusEl = null;
    _statusIcon = null;
    _statusText = null;
    _statusRetry = null;
    _retryAction = null;

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

        // the resource a ViewState renders; when present the workflow is loaded
        // centrally by the enclosing ViewState, when absent the control loads
        // itself (standalone)
        this._resource = (element.dataset && element.dataset.wxResource) || null;

        element.classList.add("wx-workflow-editor");

        this._buildLayout();
        this._setupShortcuts();

        if (this._resource) {
            this._attachToViewState(element);
        } else if (this._restUri !== "") {
            this._receiveData();
        }

        this._renderPropsPanel();
    }

    /**
     * Attaches the editor to the enclosing ViewState and renders its
     * resource slice. The ViewState owns the central load and the service, while
     * the debounced autosave still persists through the ViewState's data service.
     * @param {HTMLElement} element - The host element.
     */
    _attachToViewState(element) {
        const viewStateId = (element.dataset && element.dataset.wxViewstate) || null;

        webexpress.webapp.ViewStateRegistry.whenReady(element, viewStateId, (viewState) => {
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
     * Renders a resource slice the ViewState loaded centrally. A slice arriving
     * while an autosave is pending is skipped, because re-applying the server
     * model would clobber the edits the debounce has not persisted yet; the
     * next ViewState re-query delivers the saved state.
     * @param {object} slice - The resource slice { items, total, data, loading, error }.
     */
    _applySlice(slice) {
        slice = slice || {};
        if (this._destroyed) {
            return;
        }

        // a ViewState that failed to load its slice would otherwise leave the
        // canvas empty and silent
        if (slice.error) {
            this._element.classList.remove("placeholder-glow");
            this._isLoading = false;
            this._statusMessage = this._i18n("webexpress.webui:workflow.editor.status.load.error");
            this._setSaveState("error", () => {
                if (this._viewState && typeof this._viewState.reload === "function") {
                    this._viewState.reload();
                } else {
                    this._receiveData();
                }
            });
            return;
        }

        if (!slice.data || this._saveDebounce !== null) {
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
            this._appendIcon(toggle, this._iconClass("columns"));
            toggle.onclick = (e) => {
                e.stopPropagation();
                this._togglePropsPane();
            };
            this._toolbarContainer.appendChild(toggle);
            this._toggleBtn = toggle;

            this._buildStatusIndicator();
        }

        // properties pane (right side)
        this._propsPane = document.createElement("div");
        this._propsPane.className = "wx-side-pane wx-workflow-editor-props-pane";

        this._propsHost = document.createElement("div");
        this._propsHost.className = "wx-workflow-editor-props-host";
        this._propsPane.appendChild(this._propsHost);

        this._buildPropsActions();

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
     * Narrows the inherited toolbar: creating, editing and deleting all move
     * into the properties panel.
     *
     * The panel is where those actions belong here - it already shows the
     * properties of whatever is selected, so a toolbar button that "opens" them
     * has nothing left to do; a new state is created next to the fields that
     * will describe it, and deleting sits at the bottom of the very element it
     * removes rather than behind an icon that acts on an invisible selection.
     * The Delete key keeps working throughout.
     * @returns {string[]} the action keys the toolbar keeps
     */
    _toolbarActions() {
        return ["undo", "redo", "|", "export"];
    }

    /**
     * Builds the action bar at the top of the properties pane, carrying the
     * creation actions the toolbar no longer shows. It sits outside the panel
     * body so a selection change does not rebuild it.
     */
    _buildPropsActions() {
        const bar = document.createElement("div");
        bar.className = "wx-workflow-editor-props-actions";

        this._btnNewState = this._buildIconButton(
            "wx-workflow-editor-btn wx-workflow-editor-btn--ghost",
            this._iconClass("circle-plus"),
            this._i18n("webexpress.webui:workflow.editor.actions.state"));
        this._btnNewState.addEventListener("click", (e) => {
            e.stopPropagation();
            if (this._isAddEdgeMode) {
                this._resetAddEdgeMode();
            }
            this._addNode();
        });
        bar.appendChild(this._btnNewState);

        this._btnNewTransition = this._buildIconButton(
            "wx-workflow-editor-btn wx-workflow-editor-btn--ghost",
            this._iconClass("share-nodes"),
            this._i18n("webexpress.webui:workflow.editor.actions.transition"));
        this._btnNewTransition.addEventListener("click", (e) => {
            e.stopPropagation();
            this._toggleAddEdgeMode(!this._isAddEdgeMode);
        });
        bar.appendChild(this._btnNewTransition);

        this._propsActions = bar;
        this._propsPane.insertBefore(bar, this._propsHost);
    }

    /**
     * Reflects the add-transition mode on its panel button, which is the only
     * place that mode is now visible.
     */
    _updatePropsActions() {
        if (!this._btnNewTransition) {
            return;
        }
        const active = !!this._isAddEdgeMode;
        this._btnNewTransition.classList.toggle("is-active", active);
        this._btnNewTransition.setAttribute("aria-pressed", active ? "true" : "false");
    }

    /**
     * Builds the persistence status indicator that lives at the end of the
     * toolbar. Autosave is silent by nature, so without it a failed save is
     * indistinguishable from a successful one and the user keeps editing work
     * that never reaches the server.
     */
    _buildStatusIndicator() {
        const status = document.createElement("div");
        status.className = "wx-workflow-editor-status";
        status.setAttribute("role", "status");
        status.setAttribute("aria-live", "polite");

        this._statusIcon = document.createElement("i");
        this._statusIcon.setAttribute("aria-hidden", "true");
        status.appendChild(this._statusIcon);

        this._statusText = document.createElement("span");
        this._statusText.className = "wx-workflow-editor-status__text";
        status.appendChild(this._statusText);

        this._statusRetry = document.createElement("button");
        this._statusRetry.type = "button";
        this._statusRetry.className = "wx-workflow-editor-status__retry";
        this._statusRetry.textContent = this._i18n("webexpress.webui:workflow.editor.status.retry");
        this._statusRetry.style.display = "none";
        this._statusRetry.addEventListener("click", (e) => {
            e.stopPropagation();
            if (this._retryAction) {
                this._retryAction();
            }
        });
        status.appendChild(this._statusRetry);

        this._statusEl = status;
        this._toolbarContainer.appendChild(status);
        this._renderSaveState();
    }

    /**
     * Records the current persistence state and repaints the indicator.
     * @param {"idle"|"dirty"|"saving"|"saved"|"error"} state - The new state.
     * @param {Function} [retry] - The action the retry button should run.
     */
    _setSaveState(state, retry) {
        this._saveState = state;
        this._retryAction = retry || null;
        if (state === "saved") {
            this._lastSavedAt = new Date();
        }
        this._renderSaveState();
    }

    /**
     * Paints the indicator for the current state. A saved state carries the
     * time of the last successful write, so the user can tell a stale success
     * from a fresh one.
     */
    _renderSaveState() {
        if (!this._statusEl) {
            return;
        }

        const states = {
            idle: { key: "", icon: "circle-check", modifier: "" },
            dirty: { key: "workflow.editor.status.dirty", icon: "pen", modifier: "--dirty" },
            saving: { key: "workflow.editor.status.saving", icon: "arrows-rotate", modifier: "--saving" },
            saved: { key: "workflow.editor.status.saved", icon: "circle-check", modifier: "--saved" },
            error: { key: "workflow.editor.status.error", icon: "triangle-exclamation", modifier: "--error" }
        };
        const current = states[this._saveState] || states.idle;

        this._statusEl.className = "wx-workflow-editor-status"
            + (current.modifier ? " wx-workflow-editor-status" + current.modifier : "");
        this._statusIcon.className = this._iconClass(current.icon);

        let text = current.key ? this._i18n("webexpress.webui:" + current.key) : "";
        if (this._saveState === "saved" && this._lastSavedAt) {
            text += " " + this._lastSavedAt.toLocaleTimeString();
        }
        if (this._saveState === "error" && this._statusMessage) {
            text += " (" + this._statusMessage + ")";
        }
        this._statusText.textContent = text;

        this._statusRetry.style.display = this._saveState === "error" && this._retryAction ? "" : "none";
    }

    /**
     * Whether edits exist that the server has not acknowledged yet.
     * @returns {boolean} True while a save is queued, running or has failed.
     */
    _hasUnsavedChanges() {
        return this._saveDebounce !== null || this._saveInFlight || this._saveState === "error";
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
            if (this._destroyed || !this._element.isConnected) {
                return;
            }

            // Ctrl+S has to work while a property field has the focus, which is
            // exactly where the base ownership test refuses; it is therefore
            // scoped to the host rather than to the canvas
            if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
                if (e.target && e.target.nodeType === 1 && this._element.contains(e.target)) {
                    e.preventDefault();
                    this._flushSave();
                }
                return;
            }

            // everything else follows the same ownership rule as the graph
            // shortcuts, so a second editor or a foreign form is never affected
            if (!this._ownsKeyEvent(e)) {
                return;
            }

            if (e.key === "F2" && this._selectedNodeId) {
                e.preventDefault();
                const input = this._propsHost.querySelector("[data-edit-key='label']");
                if (input) {
                    input.focus();
                    input.select();
                }
            }
        };
        this._addWindowListener("keydown", this._kbHandler);

        // a teardown flushes, but a browser navigation cannot be delayed; the
        // user is warned instead so the pending edits are not lost silently
        this._beforeUnloadHandler = (e) => {
            if (!this._hasUnsavedChanges()) {
                return undefined;
            }
            this._flushSave();
            e.preventDefault();
            e.returnValue = "";
            return "";
        };
        this._addWindowListener("beforeunload", this._beforeUnloadHandler);
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
                    // a failed load leaves an empty canvas that looks like an
                    // empty workflow; the state has to be visible and retryable
                    this._element.classList.remove("placeholder-glow");
                    this._isLoading = false;
                    this._statusMessage = this._i18n("webexpress.webui:workflow.editor.status.load.error")
                        + " " + res.status;
                    this._setSaveState("error", () => this._receiveData());
                    return;
                }
                this._statusMessage = null;
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
        this._updatePropsActions();

        const sel = (this._selectedNodeId || "") + "::" + (this._selectedEdgeId || "");
        if (sel !== this._lastRenderedSelection) {
            this._lastRenderedSelection = sel;
            this._renderPropsPanel();
        }
    }

    /**
     * Preserves the workflow-specific fields the base graph normalizer would
     * otherwise drop, because it only knows about the visual schema: the state
     * markers (isStart / isEnd) on nodes and the rule fields (description,
     * form, guards, validators, postfunctions) on edges.
     * @param {object} model
     * @returns {{nodes: Array, edges: Array}}
     */
    _normalizeModel(model) {
        const normalized = super._normalizeModel(model);
        if (!model || !normalized) {
            return normalized;
        }

        const sourceNodes = Array.isArray(model.nodes)
            ? model.nodes
            : (Array.isArray(model.states) ? model.states : []);

        if (sourceNodes.length > 0) {
            const nodesById = new Map();
            for (const n of sourceNodes) {
                if (n && n.id !== undefined) {
                    nodesById.set(n.id, n);
                }
            }
            for (const n of normalized.nodes) {
                const orig = nodesById.get(n.id);
                if (!orig) {
                    continue;
                }
                if (orig.isStart !== undefined) { n.isStart = !!orig.isStart; }
                if (orig.isEnd !== undefined) { n.isEnd = !!orig.isEnd; }
            }
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
        this._setSaveState("dirty");
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

        this._syncModelPositions();

        const payload = webexpress.webapp.workflowEditorModel.toWirePayload(this._meta, this._model);
        const options = this._workflowId !== "" ? { params: { id: this._workflowId } } : {};

        this._saveInFlight = true;
        this._setSaveState("saving");

        this._service.update(payload, options)
            .then(res => {
                this._saveInFlight = false;
                if (this._destroyed) {
                    return;
                }
                if (res.status === 409) {
                    // someone else saved a newer revision; retrying the same
                    // payload would only lose their work, so the only offer is
                    // to reload and re-apply the edits on top
                    this._statusMessage = this._i18n("webexpress.webui:workflow.editor.status.conflict");
                    this._setSaveState("error", () => this._reloadAfterConflict());
                    return;
                }
                if (!res.ok) {
                    this._statusMessage = String(res.status);
                    this._setSaveState("error", () => this._flushSave());
                    return;
                }

                // the server hands back the version the next save has to
                // present; without adopting it every following save conflicts
                if (res.data && typeof res.data.version === "string") {
                    this._meta.version = res.data.version;
                }
                this._statusMessage = null;
                this._setSaveState("saved");
            })
            .catch(() => {
                this._saveInFlight = false;
                if (this._destroyed) {
                    return;
                }
                this._statusMessage = this._i18n("webexpress.webui:workflow.editor.status.offline");
                this._setSaveState("error", () => this._flushSave());
            });
    }

    /**
     * Discards the local edits and reloads the server revision after a save was
     * rejected as conflicting. Merging two graph revisions automatically is not
     * something the editor can do safely, so the user gets the current state
     * back and decides what to re-apply.
     */
    _reloadAfterConflict() {
        this._statusMessage = null;
        this._setSaveState("idle");

        if (this._viewState && typeof this._viewState.reload === "function") {
            this._viewState.reload();
            return;
        }
        this._receiveData();
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

        // the creation actions used to be repeated here; they now sit in the
        // panel's action bar, which is visible whatever is selected
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
            icon.className = this._iconClass("check");
            text.textContent = this._i18n("webexpress.webui:workflow.editor.preflight.ok");
        } else {
            box.classList.add("wx-workflow-editor-preflight--warn");
            icon.className = this._iconClass("triangle-exclamation");
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
     *
     * Reachability is computed from the states the model marks as entry points.
     * Starting from an arbitrary state instead - the first one in the array, as
     * an earlier version did - makes the verdict depend on the order the server
     * happened to serialize the states in, so the same workflow reports green
     * or red on alternating loads. When no state is marked, that missing marker
     * is itself the finding and reachability is not guessed at.
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

        if (nodes.length === 0) {
            return issues;
        }

        const starts = nodes.filter(n => n.isStart);
        if (starts.length === 0) {
            issues.push(this._i18n("webexpress.webui:workflow.editor.preflight.no.start"));
            return issues;
        }

        const reachable = new Set();
        const queue = starts.map(n => n.id);
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

        // a state with no way out traps the workflow unless it is declared to
        // be an end state
        const withOutgoing = new Set(edges.map(e => e.from));
        const deadEnd = nodes.find(n => !n.isEnd && !withOutgoing.has(n.id));
        if (deadEnd) {
            issues.push(this._i18n("webexpress.webui:workflow.editor.preflight.dead.end")
                + ": " + (deadEnd.label || deadEnd.id));
        }

        return issues;
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

        // the markers drive the preflight, so they have to be editable here
        // rather than only settable by the backing store
        body.appendChild(this._renderToggleRow(
            this._i18n("webexpress.webui:workflow.editor.state.start"),
            !!node.isStart,
            (val) => this._mutateNode(node, { isStart: val })));

        body.appendChild(this._renderToggleRow(
            this._i18n("webexpress.webui:workflow.editor.state.end"),
            !!node.isEnd,
            (val) => this._mutateNode(node, { isEnd: val })));

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

        body.appendChild(this._renderDashRow(
            this._i18n("webexpress.webui:workflow.editor.transition.dasharray"),
            edge.dasharray || "", edge.color || "#000000",
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
                icon: "wx-icon-light wx-icon-light-check-double",
                build: () => this._renderRulePanel(edge, "validators",
                    this._catalog.validations,
                    this._i18n("webexpress.webui:workflow.editor.transition.validations.add"),
                    this._i18n("webexpress.webui:workflow.editor.transition.validations.empty"),
                    false)
            },
            {
                id: "guards",
                label: this._i18n("webexpress.webui:workflow.editor.transition.guards"),
                icon: this._iconClass("shield"),
                build: () => this._renderRulePanel(edge, "guards",
                    this._catalog.guards,
                    this._i18n("webexpress.webui:workflow.editor.transition.guards.add"),
                    this._i18n("webexpress.webui:workflow.editor.transition.guards.empty"),
                    false)
            },
            {
                id: "postfunctions",
                label: this._i18n("webexpress.webui:workflow.editor.transition.postfunctions"),
                icon: this._iconClass("bolt"),
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
     * Appends an icon element to a container.
     * @param {HTMLElement} container - The parent element.
     * @param {string} iconClass - The resolved icon class.
     * @returns {HTMLElement} The icon element.
     */
    _appendIcon(container, iconClass) {
        const icon = document.createElement("i");
        icon.className = iconClass;
        icon.setAttribute("aria-hidden", "true");
        container.appendChild(icon);
        return icon;
    }

    /**
     * Appends a span carrying text to a container.
     * @param {HTMLElement} container - The parent element.
     * @param {string} className - The span class, or an empty string.
     * @param {string} text - The text content.
     * @returns {HTMLElement} The span element.
     */
    _appendSpan(container, className, text) {
        const span = document.createElement("span");
        if (className) {
            span.className = className;
        }
        span.textContent = text === undefined || text === null ? "" : String(text);
        container.appendChild(span);
        return span;
    }

    /**
     * Builds a button carrying an icon and a label.
     * @param {string} className - The button class.
     * @param {string} iconClass - The resolved icon class.
     * @param {string} label - The button label.
     * @returns {HTMLButtonElement} The button.
     */
    _buildIconButton(className, iconClass, label) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = className;
        this._appendIcon(btn, iconClass);
        this._appendSpan(btn, "", label);
        return btn;
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
     * Renders a label / colour-picker row.
     *
     * The picker is the framework colour control (ControlFormItemInputColor and
     * its InputColorCtrl counterpart), so the panel offers the same curated
     * palette and the same look as every other colour field in the application
     * instead of a bare native swatch. Where that control is not part of the
     * bundle the row degrades to the native input rather than rendering nothing.
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
        row.appendChild(wrap);

        if (this._colorControlAvailable()) {
            const host = document.createElement("div");
            host.className = "wx-webui-input-color wx-workflow-editor-prop-row__color-control";
            host.dataset.value = value;
            wrap.appendChild(host);

            // the control replaces the host content in place; going through the
            // controller keeps its teardown wired to the controller as well
            webexpress.webui.Controller.createInstances(host);

            // subscribing only after construction: the control announces its
            // initial value while it is being built, and treating that as an
            // edit would dirty the model and re-enter this very render
            host.addEventListener(webexpress.webui.Event.CHANGE_VALUE_EVENT, (e) => {
                this._saveStateToHistory();
                onChange(e.detail.value);
            });
            return row;
        }

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

        return row;
    }

    /**
     * Renders a label / stroke-pattern row. The pattern is picked from drawn
     * samples rather than typed as a dasharray, because the numbers say nothing
     * about what the line will look like.
     * @param {string} label
     * @param {string} value - the current dasharray
     * @param {string} color - the colour the samples are drawn in
     * @param {Function} onChange
     * @returns {HTMLElement}
     */
    _renderDashRow(label, value, color, onChange) {
        const row = document.createElement("div");
        row.className = "wx-workflow-editor-prop-row";

        const lbl = document.createElement("span");
        lbl.className = "wx-workflow-editor-prop-row__label";
        lbl.textContent = label;
        row.appendChild(lbl);

        row.appendChild(this._buildDashPicker(value, color, (next) => {
            this._saveStateToHistory();
            onChange(next);
        }));

        return row;
    }

    /**
     * Whether the framework colour control is present in the loaded bundle.
     * @returns {boolean} True when the control can be instantiated.
     */
    _colorControlAvailable() {
        return !!(webexpress.webui.Controller
            && webexpress.webui.Controller.classRegistry
            && webexpress.webui.Controller.classRegistry.has("wx-webui-input-color"));
    }

    /**
     * Renders a label / checkbox row for a boolean state flag.
     * @param {string} label
     * @param {boolean} value
     * @param {Function} onChange - (boolean) => void
     * @returns {HTMLElement}
     */
    _renderToggleRow(label, value, onChange) {
        const row = document.createElement("div");
        row.className = "wx-workflow-editor-prop-row";

        const lbl = document.createElement("span");
        lbl.className = "wx-workflow-editor-prop-row__label";
        lbl.textContent = label;
        row.appendChild(lbl);

        const input = document.createElement("input");
        input.type = "checkbox";
        input.className = "wx-workflow-editor-prop-row__toggle";
        input.checked = value;
        input.addEventListener("change", () => {
            this._saveStateToHistory();
            onChange(input.checked);
            this._renderPropsPanel();
        });

        row.appendChild(input);
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

        const btn = this._buildIconButton(
            "wx-workflow-editor-btn wx-workflow-editor-btn--danger",
            this._iconClass("trash"),
            label);
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
                this._appendIcon(item, this._iconClass("arrow-right"));
                this._appendSpan(item, "wx-workflow-editor-prop-section__item-label", e.label || e.id || "");
                this._appendSpan(item, "wx-workflow-editor-prop-section__item-side", otherLabel);
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

        const addBtn = this._buildIconButton(
            "wx-workflow-editor-btn wx-workflow-editor-btn--ghost",
            this._iconClass("plus"),
            addLabel);
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
                this._appendSpan(opt, "wx-workflow-editor-rule-picker__kind", tpl.type || tpl.kind || "rule");
                this._appendSpan(opt, "wx-workflow-editor-rule-picker__text", tpl.label || tpl.text || tpl.id);
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
     *
     * The pending autosave is pushed through first. Discarding the debounce
     * timer without firing it would drop every edit made in the last 500 ms,
     * and a single-page navigation lands inside that window as a matter of
     * course - the user would lose work without ever being told.
     */
    destroy() {
        if (this._saveDebounce !== null) {
            clearTimeout(this._saveDebounce);
            this._saveDebounce = null;
            this._saveToServer();
        }

        // a load or save resolving after teardown must not touch the detached DOM
        this._destroyed = true;
        this._kbHandler = null;
        this._beforeUnloadHandler = null;

        // the base teardown releases every recorded listener and the frame loop
        super.destroy();
    }
};

// register the class in the framework controller
webexpress.webui.Controller.registerClass("wx-webapp-workflow-editor", webexpress.webapp.WorkflowEditorCtrl);
