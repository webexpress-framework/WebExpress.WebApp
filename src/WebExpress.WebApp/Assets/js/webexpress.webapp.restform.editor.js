/**
 * Controller for the visual form editor (Designer).
 *
 * A single self-contained web UI control. Renders a fixed two-pane layout with
 * the structure tree on the left (drag-and-drop, inline rename, keyboard
 * navigation, QuickAdd picker, tab bar) and a live preview on the right (with a
 * tab switcher that mirrors the structure). Runs in offline-mock mode when no
 * service is declared.
 *
 * A form definition has the same two meanings of save a document has: "do not
 * lose what I have built" and "let the forms out there use this". Where only the
 * "data" service is declared the two coincide and every mutation is written to
 * it, which is what an editor for a form nobody else fills in yet may do. Where a
 * "draft" service is declared as well, every mutation goes to that one instead -
 * no version, nothing the forms in use see - and the data service is reached
 * only through publish, whose PUT applies the structure and ends the draft in
 * its own transaction. The controller never deletes a draft as part of
 * publishing: a delete racing a publish that failed would destroy the only copy
 * of the work.
 *
 * Which structure the editor opens on is the data endpoint's decision; the draft
 * endpoint is only asked whether an unpublished draft exists, so that the state
 * line and the discard action can say so.
 *
 * Events:
 *  - webexpress.webapp.Event.FORM_EDITOR_LOADED_EVENT
 *  - webexpress.webapp.Event.FORM_EDITOR_NODE_ADDED_EVENT
 *  - webexpress.webapp.Event.FORM_EDITOR_NODE_REMOVED_EVENT
 *  - webexpress.webapp.Event.FORM_EDITOR_NODE_RENAMED_EVENT
 *  - webexpress.webapp.Event.FORM_EDITOR_NODE_MOVED_EVENT
 *  - webexpress.webapp.Event.FORM_EDITOR_TAB_ADDED_EVENT
 *  - webexpress.webapp.Event.FORM_EDITOR_TAB_RENAMED_EVENT
 *  - webexpress.webapp.Event.FORM_EDITOR_SAVED_EVENT
 *  - webexpress.webapp.Event.FORM_EDITOR_DRAFT_SAVED_EVENT
 *  - webexpress.webapp.Event.FORM_EDITOR_DRAFT_DISCARDED_EVENT
 *  - webexpress.webapp.Event.FORM_EDITOR_PUBLISHED_EVENT
 *  - webexpress.webapp.Event.FORM_EDITOR_STATE_EVENT
 *  - webexpress.webapp.Event.FORM_EDITOR_VALIDATION_FAILED_EVENT
 */
webexpress.webapp.RestFormEditorCtrl = class extends webexpress.webui.Ctrl {

    // mapping between wire-format layout strings and their FormGroup<name> labels
    static LAYOUT_LABELS = {
        "vertical":       "FormGroupVertical",
        "horizontal":     "FormGroupHorizontal",
        "mix":            "FormGroupMix",
        "col-vertical":   "FormGroupColumnVertical",
        "col-horizontal": "FormGroupColumnHorizontal",
        "col-mix":        "FormGroupColumnMix"
    };

    // catalog of group layouts offered to the user (palette + QuickAdd)
    static GROUP_LAYOUTS = [
        { id: "vertical",       label: "Vertical" },
        { id: "horizontal",     label: "Horizontal" },
        { id: "mix",            label: "Mix" },
        { id: "col-vertical",   label: "Two columns · vertical" },
        { id: "col-horizontal", label: "Two columns · horizontal" },
        { id: "col-mix",        label: "Two columns · mix" }
    ];

    // logical field types accepted by the editor. They are coarser than the field types an
    // application models: several of those share a shape and are previewed alike — a
    // calendar reads as a date, a cascading selection as a list.
    static FIELD_TYPES = [
        "string", "text", "richtext", "password", "timestamp", "daterange", "ref", "enum",
        "choice", "tags", "number", "range", "rating", "estimate", "color", "avatar",
        "tile", "move", "file"
    ];

    // the idle time after which a mutation is written; short, because a mutation
    // here is a click rather than a keystroke and nothing is typed in between
    static SAVE_DEBOUNCE = 400;

    _restUrl = null;
    _previewOn = true;
    _indent = 18;
    _readonly = false;

    // runtime state
    _structure = null;
    _activeTabId = null;
    _selectedId = null;
    _editingId = null;
    _collapsed = new Set();
    _dragId = null;
    _dropState = null;
    _pickerOpen = false;
    _pickerHi = 0;
    _fieldCatalog = [];

    // draft state: whether an unpublished draft exists on the server, when it was
    // last written, the save state the footer shows, and whether saving is held
    // off while a publish or discard is deciding the draft's fate
    _draftService = null;
    _draft = false;
    _updated = null;
    _state = "idle";
    _sealed = false;
    _inFlight = null;
    _confirm = null;

    // dom hosts
    _headerHost = null;
    _bodyHost = null;
    _footerHost = null;
    _publishButton = null;
    _stateElement = null;
    _discardButton = null;

    // persistence / global handlers
    _saveTimer = null;
    _keyboardHandler = null;
    _outsideClickHandler = null;
    _leaveHandler = null;
    _visibilityHandler = null;

    /**
     * Creates a form editor controller for the root element.
     * @param {HTMLElement} element - Root node carrying the data-* configuration.
     */
    constructor(element) {
        super(element);

        // the endpoints are authored in C# through the wx-service islands: "data"
        // loads and publishes, the optional "draft" holds the unpublished work
        const islandServices = webexpress.webapp.ServiceRegistry.fromElement(element);
        this._service = islandServices.data || null;
        this._restUrl = this._service ? this._service.baseUri : null;
        this._draftService = islandServices.draft || null;

        // initialize properties from data attributes
        const ds = element.dataset;
        this._previewOn = ds.preview !== "false";
        const indent = parseInt(ds.indent, 10);
        this._indent = isFinite(indent) ? Math.min(32, Math.max(8, indent)) : 18;
        this._readonly = ds.readonly === "true";

        // clean up the dom element and set base classes for styling
        element.removeAttribute("data-initial-structure");
        element.classList.add("wx-form-editor");

        this._buildSkeleton();
        this._bindKeyboard();
        this._bindOutsideClick();
        this._bindLeave();
        this._bootstrap();
    }

    /**
     * Gets whether mutations are written to an unpublished draft rather than to
     * the form itself. This is the one answer everything the draft brings with
     * it hangs off - the publish button, the discard action, the state line.
     * @returns {boolean}
     */
    get drafting() {
        // a draft without a form to publish into is not a mode; it is a misdeclaration
        return !!this._draftService && !!this._service && !this._readonly;
    }

    /**
     * Gets whether an unpublished draft exists on the server.
     * @returns {boolean}
     */
    get draft() {
        return this._draft;
    }

    /**
     * Gets the save state the footer shows.
     * @returns {string} One of idle, draft, pending, saving, saved, error, publishing, discarding.
     */
    get state() {
        return this._state;
    }

    /**
     * Gets whether the live preview pane is shown.
     * @returns {boolean}
     */
    get preview() {
        return this._previewOn;
    }

    /**
     * Sets whether the live preview pane is shown. Re-renders the body if changed.
     * @param {boolean} value
     */
    set preview(value) {
        const next = !!value;
        if (next === this._previewOn) {
            return;
        }
        this._previewOn = next;
        this._renderHeader();
        this._renderBody();
    }

    /**
     * Gets the tree indent in pixels.
     * @returns {number}
     */
    get indent() {
        return this._indent;
    }

    /**
     * Sets the tree indent in pixels (clamped to 8–32). Re-renders the body if changed.
     * @param {number} value
     */
    set indent(value) {
        const n = Math.min(32, Math.max(8, parseInt(value, 10) || 18));
        if (n === this._indent) {
            return;
        }
        this._indent = n;
        this._renderBody();
    }

    /**
     * Gets a deep-cloned snapshot of the current in-memory structure.
     * @returns {object|null}
     */
    getStructure() {
        return this._structure ? JSON.parse(JSON.stringify(this._structure)) : null;
    }

    /**
     * Adds a new tab and selects it.
     */
    addTab() {
        if (this._readonly || !this._structure) {
            return;
        }
        const id = webexpress.webapp.RestFormEditorCtrl._uid("t");
        const tab = {
            id: id,
            name: this._t("formeditor.tab.new.name", this._structure.tabs.length + 1),
            children: []
        };
        this._structure.tabs.push(tab);
        this._activeTabId = id;
        this._selectedId = null;
        this._dispatch(webexpress.webapp.Event.FORM_EDITOR_TAB_ADDED_EVENT, { tab: tab });
        this._renderBody();
        this._scheduleSave();
    }

    /**
     * Adds a node to the active tab. spec is { kind: 'field', name, type, required?, help? }
     * or { kind: 'group', layout, label }.
     * @param {object} spec - Node specification.
     */
    addNode(spec) {
        if (this._readonly || !this._structure || !spec) {
            return;
        }
        const tab = this._getActiveTab();
        if (!tab) {
            return;
        }
        const node = this._buildNode(spec);
        const parent = this._findGroupContaining(tab, this._selectedId);
        (parent || { children: tab.children }).children.push(node);
        this._selectedId = node.id;
        this._dispatch(webexpress.webapp.Event.FORM_EDITOR_NODE_ADDED_EVENT, { node: node });
        this._renderBody();
        this._scheduleSave();
    }

    /**
     * Removes a node by id.
     * @param {string} nodeId - Id of the node to remove.
     */
    removeNode(nodeId) {
        if (this._readonly || !this._structure) {
            return;
        }
        const tab = this._getActiveTab();
        if (!tab) {
            return;
        }
        const removed = this._removeFromList(tab.children, nodeId);
        if (!removed) {
            return;
        }
        if (this._selectedId === nodeId) {
            this._selectedId = null;
        }
        this._dispatch(webexpress.webapp.Event.FORM_EDITOR_NODE_REMOVED_EVENT, { id: nodeId });
        this._renderBody();
        this._scheduleSave();
    }

    /**
     * Renames a node by id (works for tabs, groups, and fields).
     * @param {string} nodeId - Id of the node to rename.
     * @param {string} newName - New name (trimmed; ignored when empty).
     */
    renameNode(nodeId, newName) {
        if (this._readonly || !this._structure) {
            return;
        }
        const next = (newName || "").trim();
        if (!next) {
            return;
        }
        const tab = this._getActiveTab();
        if (!tab) {
            return;
        }
        const node = this._findById(tab.children, nodeId);
        if (!node) {
            return;
        }
        node.label = next;
        this._dispatch(webexpress.webapp.Event.FORM_EDITOR_NODE_RENAMED_EVENT, { id: nodeId, name: next });
        this._renderBody();
        this._scheduleSave();
    }

    /**
     * Writes the current structure now, without waiting for the debounce.
     * @returns {Promise<void>} Resolves when the write is done or was skipped.
     */
    async save() {
        if (!this._saveTimer) {
            return;
        }
        clearTimeout(this._saveTimer);
        this._saveTimer = null;
        await this._save();
    }

    /**
     * Publishes the structure on screen: the data endpoint applies it and ends
     * the draft in its own transaction.
     *
     * A queued draft save is dropped rather than raced against the publication -
     * it would otherwise land after it and re-open the draft - and one already in
     * flight is waited for, for the same reason. The publication carries the
     * structure itself, so nothing is lost by that. Where nothing drafts,
     * publishing is what every save already is, so there is nothing to do.
     * @returns {Promise<boolean>} True when the endpoint accepted the structure.
     */
    async publish() {
        if (!this.drafting || !this._structure || this._sealed) {
            return false;
        }

        const queued = !!this._saveTimer;

        this._sealed = true;
        this._cancelSave();
        await this._inFlight;
        this._setState("publishing");

        const result = await this._service.update(this._structure);

        this._sealed = false;

        if (!result.ok) {
            // the draft still stands, so the surface returns to it; a rejected
            // structure is reported the way a rejected save is, and the change
            // that was queued is only on screen, so it goes to the draft after all
            this._setState(this._restingState());
            this._dispatch(webexpress.webapp.Event.FORM_EDITOR_VALIDATION_FAILED_EVENT, result.data || { status: result.status });
            if (queued) {
                this._scheduleSave();
            }
            return false;
        }

        this._adoptVersion(result.data);
        this._draft = false;
        this._updated = null;
        this._setState("idle");
        this._dispatch(webexpress.webapp.Event.FORM_EDITOR_PUBLISHED_EVENT, {
            structure: this.getStructure(),
            response: result.data
        });
        return true;
    }

    /**
     * Drops the unpublished draft and returns the editor to the published form.
     *
     * The discard goes through here rather than through a link, because this is
     * what owns the endpoint: a pending save would otherwise land after the delete
     * and open the draft again. Saving is stopped first, then the draft is dropped,
     * then the structure is re-loaded so the editor shows what the forms in use
     * see. The page is deliberately not reloaded - a control does not get to
     * navigate its host.
     * @returns {Promise<boolean>} True when the draft is gone and the structure was re-loaded.
     */
    async discard() {
        if (!this.drafting || this._sealed) {
            return false;
        }

        this._sealed = true;
        this._cancelSave();
        await this._inFlight;
        this._setState("discarding");

        const result = await this._draftService.remove();

        if (!result.ok) {
            this._sealed = false;
            this._setState(this._restingState());
            return false;
        }

        this._draft = false;
        this._updated = null;
        this._selectedId = null;
        this._editingId = null;

        // the draft is gone either way; a re-load that fails leaves what is on
        // screen rather than an empty form the next click would draft again
        const previous = this._structure;
        this._structure = null;
        await this._loadStructure();
        this._structure = this._structure || previous;
        this._sealed = false;
        this._ensureStructure();
        this._setState("idle");
        this._dispatch(webexpress.webapp.Event.FORM_EDITOR_DRAFT_DISCARDED_EVENT, {});
        this._dispatch(webexpress.webapp.Event.FORM_EDITOR_LOADED_EVENT, { structure: this.getStructure() });
        this.render();
        return true;
    }

    /**
     * Renders the editor.
     * Triggers a full re-render of header, body and footer. Used after configuration
     * changes that affect the whole UI.
     */
    render() {
        this._renderHeader();
        this._renderBody();
        this._renderFooter();
    }

    /**
     * Releases global event listeners and pending save timers.
     */
    destroy() {
        if (this._keyboardHandler) {
            window.removeEventListener("keydown", this._keyboardHandler);
            this._keyboardHandler = null;
        }
        if (this._outsideClickHandler) {
            document.removeEventListener("mousedown", this._outsideClickHandler);
            this._outsideClickHandler = null;
        }
        if (this._leaveHandler) {
            window.removeEventListener("pagehide", this._leaveHandler);
            this._leaveHandler = null;
        }
        if (this._visibilityHandler) {
            document.removeEventListener("visibilitychange", this._visibilityHandler);
            this._visibilityHandler = null;
        }
        this._cancelSave();
        this._confirm?.destroy();
        this._confirm = null;
        this._draftService?.abort?.();
        this._service?.abort?.();
    }

    /**
     * Builds the static skeleton (head/body/foot containers). Tab bars live
     * inside the structure and preview panes, not at the editor root.
     */
    _buildSkeleton() {
        const root = this._element;
        root.textContent = "";

        this._headerHost = document.createElement("div");
        this._headerHost.className = "wx-form-editor-head";

        this._bodyHost = document.createElement("div");
        this._bodyHost.className = "wx-form-editor-body";

        this._footerHost = document.createElement("div");
        this._footerHost.className = "wx-form-editor-foot";

        root.appendChild(this._headerHost);
        root.appendChild(this._bodyHost);
        root.appendChild(this._footerHost);
    }

    /**
     * Loads the field catalog and the form structure (REST or fallback) and
     * triggers an initial full render.
     * @returns {Promise<void>}
     */
    async _bootstrap() {
        await this._loadStructure();
        this._ensureStructure();

        if (this.drafting) {
            await this._resume();
        }

        this._dispatch(webexpress.webapp.Event.FORM_EDITOR_LOADED_EVENT, { structure: this.getStructure() });
        this.render();
    }

    /**
     * Gives the editor something to edit when the endpoint answered nothing, and
     * a first tab when the form has none, then makes the first tab the active one.
     */
    _ensureStructure() {
        if (!this._structure) {
            this._structure = {
                formName: this._t("formeditor.form.default.name"),
                formDescription: "",
                className: "",
                version: 1
            };
        }

        if (!this._structure.tabs || this._structure.tabs.length == 0) {
            this._structure.tabs = [{
                id: webexpress.webapp.RestFormEditorCtrl._uid("t"),
                name: this._t("formeditor.tab.default.name"),
                children: []
            }];
        }

        this._activeTabId = (this._structure.tabs && this._structure.tabs[0]) ? this._structure.tabs[0].id : null;
    }

    /**
     * Asks the draft endpoint whether the editor is resuming an unpublished draft.
     *
     * Only the two reserved keys of the answer are read. Which structure the
     * editor opens on is the data endpoint's decision, and it has already been
     * loaded; merging a second copy in here would make the control the arbiter of
     * something it deliberately is not.
     * @returns {Promise<void>} Resolves when the draft state reflects the answer.
     */
    async _resume() {
        const result = await this._draftService.load();

        if (!result.ok) {
            return;
        }

        const data = result.data || {};

        this._draft = data.draft === true;
        this._updated = data.updated ? new Date(data.updated) : null;
        this._state = this._restingState();
    }

    /**
     * Loads the form structure and the field catalog from the data service, if
     * one is declared and nothing is loaded yet. What the endpoint answers is
     * what the editor opens on - the draft where one exists, the published form
     * otherwise - and that decision stays with the endpoint.
     * @returns {Promise<void>}
     */
    async _loadStructure() {
        if (this._structure || !this._service) {
            return;
        }

        const result = await this._service.load();

        if (!result.ok || !result.data) {
            return;
        }

        const json = result.data;
        this._structure = json.structure || json.data || json;
        this._fieldCatalog = json.catalog || [];
    }

    /**
     * Renders the header (form name + description + version + preview toggle,
     * and the publish button while the editor drafts).
     *
     * Form name and description are wired up as SmartEditCtrl inline editors;
     * each inline save updates the in-memory structure and triggers the
     * regular debounced save.
     */
    _renderHeader() {
        this._headerHost.textContent = "";

        const title = document.createElement("div");
        title.className = "wx-form-editor-title";

        const titleMain = document.createElement("div");
        titleMain.className = "wx-form-editor-title-main";

        titleMain.appendChild(this._renderNameEditor());

        const version = document.createElement("span");
        version.className = "wx-form-editor-version";
        version.textContent = "v" + ((this._structure && this._structure.version) || 1);
        titleMain.appendChild(version);

        title.appendChild(titleMain);
        title.appendChild(this._renderDescriptionEditor());

        const tools = document.createElement("div");
        tools.className = "wx-form-editor-tools";
        tools.appendChild(this._renderPreviewToggle());

        this._publishButton = this.drafting ? this._renderPublishButton() : null;
        if (this._publishButton) {
            tools.appendChild(this._publishButton);
        }

        this._headerHost.appendChild(title);
        this._headerHost.appendChild(tools);
        this._syncActions();
    }

    /**
     * Renders the publish button. It is the publication decision, not the save -
     * the save happened while the user was working - so it sits apart from the
     * preview toggle and is the only filled button in the chrome.
     * @returns {HTMLElement}
     */
    _renderPublishButton() {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "wx-form-editor-publish";
        btn.textContent = this._t("formeditor.publish");
        btn.addEventListener("click", () => { void this.publish(); });
        return btn;
    }

    /**
     * Renders an inline-editable form-name field driven by SmartEditCtrl.
     *
     * The wrapper deliberately omits the `wx-webui-smart-edit` class - the
     * Controller's MutationObserver auto-instantiates that class on append,
     * which would conflict with the manual instantiation below. We follow
     * the same pattern used by the table renderers in templates/default.js.
     * @returns {HTMLElement}
     */
    _renderNameEditor() {
        const wrap = document.createElement("div");
        wrap.className = "wx-form-editor-name";

        const value = (this._structure && this._structure.formName) || "";

        if (this._readonly) {
            const span = document.createElement("span");
            span.textContent = value || this._t("formeditor.form.fallback.name");
            wrap.appendChild(span);
            return wrap;
        }

        const input = document.createElement("input");
        input.type = "text";
        input.className = "form-control form-control-sm wx-form-editor-name-input";
        input.value = value;
        input.placeholder = this._t("formeditor.form.name.placeholder");
        wrap.appendChild(input);

        const ctrl = new webexpress.webui.SmartEditCtrl(wrap);
        ctrl.onSave = (el, value) => this._applyFormName(value);
        return wrap;
    }

    /**
     * Renders an inline-editable form-description field driven by SmartEditCtrl.
     * @returns {HTMLElement}
     */
    _renderDescriptionEditor() {
        const wrap = document.createElement("div");
        wrap.className = "wx-form-editor-description";

        const value = (this._structure && this._structure.formDescription) || "";

        if (this._readonly) {
            const span = document.createElement("span");
            span.textContent = value;
            wrap.appendChild(span);
            return wrap;
        }

        const input = document.createElement("textarea");
        input.className = "form-control form-control-sm wx-form-editor-description-input";
        input.rows = 2;
        input.value = value;
        input.placeholder = this._t("formeditor.form.description.placeholder");
        wrap.appendChild(input);

        const ctrl = new webexpress.webui.SmartEditCtrl(wrap);
        ctrl.onSave = (el, value) => this._applyFormDescription(value);
        return wrap;
    }

    /**
     * Persists a new form name and refreshes views that show it.
     * @param {string} value
     */
    _applyFormName(value) {
        if (!this._structure) {
            return;
        }
        const next = (value || "").trim();
        if (next === (this._structure.formName || "")) {
            return;
        }
        this._structure.formName = next;
        this._scheduleSave();
        // refresh the preview card title which mirrors formName
        setTimeout(() => this._renderBody(), 0);
    }

    /**
     * Persists a new form description and refreshes views that show it.
     * @param {string} value
     */
    _applyFormDescription(value) {
        if (!this._structure) {
            return;
        }
        const next = value || "";
        if (next === (this._structure.formDescription || "")) {
            return;
        }
        this._structure.formDescription = next;
        this._scheduleSave();
        // refresh the preview card which mirrors formDescription
        setTimeout(() => this._renderBody(), 0);
    }

    /**
     * Persists a renamed tab and refreshes views that depend on tab names
     * (structure heading, both tab bars, preview sub block).
     * @param {string} tabId
     * @param {string} value
     */
    _applyTabName(tabId, value) {
        if (!this._structure || !Array.isArray(this._structure.tabs)) {
            return;
        }
        const tab = this._structure.tabs.find(t => t.id === tabId);
        if (!tab) {
            return;
        }
        const next = (value || "").trim();
        if (!next || next === tab.name) {
            return;
        }
        tab.name = next;
        this._dispatch(webexpress.webapp.Event.FORM_EDITOR_TAB_RENAMED_EVENT, {
            tabId: tabId,
            name: next
        });
        this._scheduleSave();
        setTimeout(() => this._renderBody(), 0);
    }

    /**
     * Renders the preview toggle.
     * @returns {HTMLElement}
     */
    _renderPreviewToggle() {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "wx-form-editor-preview-toggle" + (this._previewOn ? " active" : "");
        btn.textContent = this._previewOn
            ? this._t("formeditor.preview.toggle.hide")
            : this._t("formeditor.preview.toggle.show");
        btn.addEventListener("click", () => { this.preview = !this._previewOn; });
        return btn;
    }

    /**
     * Renders a tab bar for a single pane.
     *
     * The structure pane sets allowEdit=true so the bar always renders (with
     * "+ Add tab" and double-click rename). Read-only / preview panes set
     * allowEdit=false; the bar is then suppressed when there is at most one
     * tab, since there is nothing to switch between.
     *
     * @param {object} opts
     * @param {boolean} opts.allowEdit - Whether the bar may add / rename tabs.
     * @returns {HTMLElement|null}
     */
    _renderPaneTabs(opts) {
        const allowEdit = !this._readonly && !!(opts && opts.allowEdit);
        const tabs = (this._structure && this._structure.tabs) || [];

        if (!allowEdit && tabs.length <= 1) {
            return null;
        }

        const bar = document.createElement("div");
        bar.className = "wx-form-editor-tabs";

        for (const tab of tabs) {
            bar.appendChild(this._renderTab(tab, allowEdit));
        }

        if (allowEdit) {
            const add = document.createElement("button");
            add.type = "button";
            add.className = "wx-form-editor-tab-add";
            add.textContent = this._t("formeditor.tab.add");
            add.addEventListener("click", (e) => {
                e.stopPropagation();
                this.addTab();
            });
            bar.appendChild(add);
        }
        return bar;
    }

    /**
     * Renders a single tab handle.
     *
     * In the structure pane (allowEdit=true) the tab name is wrapped in a
     * SmartEditCtrl so the user can rename via the inline pencil / dblclick
     * trigger; the tab itself becomes a `<div role="button">` so the nested
     * SmartEditCtrl buttons remain valid HTML. In read-only/preview panes the
     * tab is the original `<button>` with a plain text name.
     * @param {object} tab - The tab model.
     * @param {boolean} allowEdit - Whether the tab is editable.
     * @returns {HTMLElement}
     */
    _renderTab(tab, allowEdit) {
        const tabEl = document.createElement(allowEdit ? "div" : "button");
        if (!allowEdit) {
            tabEl.type = "button";
        } else {
            tabEl.setAttribute("role", "button");
            tabEl.setAttribute("tabindex", "0");
        }
        tabEl.className = "wx-form-editor-tab" + (tab.id === this._activeTabId ? " active" : "");
        tabEl.dataset.tabId = tab.id;

        tabEl.appendChild(this._renderTabName(tab, allowEdit));

        const count = document.createElement("span");
        count.className = "wx-form-editor-tab-count";
        count.textContent = String(this._countFields(tab.children));
        tabEl.appendChild(count);

        tabEl.addEventListener("click", (e) => {
            // ignore clicks routed through the inline rename form (input,
            // ok / cancel buttons) so the active tab is not switched and the
            // DOM is not torn down mid-edit.
            if (allowEdit && e.target.closest(".wx-smart-edit form")) {
                return;
            }
            // already active: skip the rebuild so the SmartEditCtrl attached
            // to the active tab's name keeps its event listeners (the
            // dblclick that follows a second click would otherwise land on a
            // detached element).
            if (this._activeTabId === tab.id) {
                return;
            }
            e.stopPropagation();
            this._activeTabId = tab.id;
            this._selectedId = null;
            this._renderBody();
        });
        if (allowEdit) {
            tabEl.addEventListener("keydown", (e) => {
                if ((e.key === "Enter" || e.key === " ") && e.target === tabEl) {
                    e.preventDefault();
                    if (this._activeTabId !== tab.id) {
                        this._activeTabId = tab.id;
                        this._selectedId = null;
                        this._renderBody();
                    }
                }
            });
        }
        return tabEl;
    }

    /**
     * Renders the tab-name slot.
     *
     * Only the currently active tab is wired up with `SmartEditCtrl`: clicking
     * an inactive tab triggers a body rebuild that would tear down the rename
     * controller mid-gesture, so for inactive tabs we render a plain text
     * span. Once a tab is active, the user can rename it via the inline
     * pencil (single click) or by double-clicking the name.
     * @param {object} tab
     * @param {boolean} allowEdit
     * @returns {HTMLElement}
     */
    _renderTabName(tab, allowEdit) {
        const wrap = document.createElement("span");
        wrap.className = "wx-form-editor-tab-name";

        const value = tab.name || "";
        const isActive = tab.id === this._activeTabId;

        if (!allowEdit || !isActive) {
            wrap.textContent = value || this._t("formeditor.tab.fallback.name");
            return wrap;
        }

        const input = document.createElement("input");
        input.type = "text";
        input.className = "wx-form-editor-tab-name-input";
        input.value = value;
        input.placeholder = this._t("formeditor.tab.fallback.name");
        wrap.appendChild(input);

        const ctrl = new webexpress.webui.SmartEditCtrl(wrap);
        ctrl.onSave = (el, val) => this._applyTabName(tab.id, val);
        return wrap;
    }

    /**
     * Renders the body (structure on the left, optional preview on the right).
     *
     * When the preview is visible the two panes are wrapped in a SplitCtrl so
     * the user can resize the divider; the split keeps a stable id, so the
     * localStorage-backed size persists across re-renders. When the preview is
     * hidden the structure pane fills the available space directly.
     */
    _renderBody() {
        this._bodyHost.className = "wx-form-editor-body wx-form-editor-body-pane";
        if (!this._previewOn) {
            this._bodyHost.classList.add("wx-form-editor-body--no-preview");
        }
        this._bodyHost.textContent = "";

        const tab = this._getActiveTab();
        if (!tab) {
            return;
        }
        if (this._previewOn) {
            this._bodyHost.appendChild(this._renderSplitContent(tab));
        } else {
            this._bodyHost.appendChild(this._renderStructurePanel(tab));
        }
    }

    /**
     * Builds the resizable split host that pairs structure (left / side pane)
     * and preview (right / main pane).
     *
     * The host is tagged with `wx-webui-split` so the framework's controller
     * registry auto-instantiates `webexpress.webui.SplitCtrl` once the node
     * is appended to the DOM. The host id stays stable across re-renders so
     * the localStorage-backed splitter size is preserved.
     * @param {object} tab
     * @returns {HTMLElement}
     */
    _renderSplitContent(tab) {
        if (!this._splitId) {
            this._splitId = (this._element.id ? this._element.id : "wx-form-editor")
                + "-split";
        }

        const host = document.createElement("div");
        host.className = "wx-webui-split wx-form-editor-split";
        host.id = this._splitId;
        host.dataset.orientation = "horizontal";
        host.dataset.size = "40%";
        host.dataset.minSide = "260";

        const side = document.createElement("div");
        side.className = "wx-side-pane";
        side.appendChild(this._renderStructurePanel(tab));

        const main = document.createElement("div");
        main.className = "wx-main-pane";
        main.appendChild(this._renderPreviewPanel(tab));

        host.appendChild(side);
        host.appendChild(main);
        return host;
    }

    /**
     * Renders the footer: the keyboard hint, the save state, and - while a draft
     * exists - the way back to the published form.
     *
     * Discard sits down here beside the state it acts on rather than up in the
     * tools next to publish: one of the two is destructive, and a user reaching
     * for the publish button must not be able to throw away their work by being
     * slightly off.
     */
    _renderFooter() {
        this._footerHost.textContent = "";

        const hint = document.createElement("span");
        hint.className = "wx-form-editor-foot-hint";
        hint.textContent = this._t("formeditor.footer.hint");
        this._footerHost.appendChild(hint);

        this._stateElement = document.createElement("span");
        this._stateElement.className = "wx-form-editor-foot-status";
        this._footerHost.appendChild(this._stateElement);

        this._discardButton = null;
        if (this.drafting) {
            this._discardButton = document.createElement("button");
            this._discardButton.type = "button";
            this._discardButton.className = "wx-form-editor-discard";
            this._discardButton.textContent = this._t("formeditor.discard");
            this._discardButton.addEventListener("click", () => this._confirmDiscard());
            this._footerHost.appendChild(this._discardButton);
        }

        this._syncActions();
    }

    /**
     * Asks before discarding, because the draft is the only copy of the work.
     */
    _confirmDiscard() {
        if (!this._draft || this._sealed) {
            return;
        }

        this._confirm = this._confirm || new webexpress.webui.ModalConfirm();
        const accepted = this._confirm.confirmation(
            "webexpress.webapp:formeditor.discard.title",
            this._t("formeditor.discard.message", (this._structure && this._structure.formName) || this._t("formeditor.form.fallback.name")),
            () => this.discard(),
            {
                confirmLabel: this._t("formeditor.discard.confirm"),
                errorMessage: this._t("formeditor.discard.error"),
                fallbackFocus: () => this._publishButton
            }
        );
        if (accepted) {
            this._confirm.show();
        }
    }

    /**
     * Writes the save state into the footer and the actions it enables, without
     * rebuilding either bar: the header carries the inline name editors, and a
     * rebuild would tear one down mid-edit.
     *
     * The state is one attribute rather than a set of classes, so the stylesheet
     * selects on a value and this method swaps one instead of juggling a set.
     */
    _syncActions() {
        if (this._stateElement) {
            this._stateElement.setAttribute("data-wx-state", this._state);
            this._stateElement.textContent = this._stateText();
        }

        const busy = this._sealed;

        if (this._publishButton) {
            this._publishButton.disabled = busy || !this._draft;
        }

        if (this._discardButton) {
            this._discardButton.disabled = busy;
            this._discardButton.hidden = !this._draft;
        }
    }

    /**
     * Returns the text of the footer status for the current mode and state, with
     * the {0} placeholder filled by the local time of the last draft write.
     * @returns {string}
     */
    _stateText() {
        if (!this._restUrl) {
            return this._t("formeditor.footer.offline");
        }
        if (!this.drafting) {
            return this._t("formeditor.footer.autosave");
        }

        const time = this._updated || new Date();

        return this._t("formeditor.state." + this._state,
            time.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }));
    }

    /**
     * Moves the surface to a save state, paints it and announces it.
     * @param {string} state - The new state.
     */
    _setState(state) {
        this._state = state;
        this._syncActions();
        this._dispatch(webexpress.webapp.Event.FORM_EDITOR_STATE_EVENT, { state: state });
    }

    /**
     * Returns the state the surface rests in when nothing is being written:
     * on an unpublished draft, or on the published form.
     * @returns {string}
     */
    _restingState() {
        return this._draft ? (this._updated ? "saved" : "draft") : "idle";
    }

    /**
     * Takes the version the data endpoint answered with, which is what the header
     * shows next to the form name.
     * @param {object} body - The response body.
     */
    _adoptVersion(body) {
        if (body && body.data && typeof body.data.version === "number") {
            this._structure.version = body.data.version;
            const version = this._headerHost.querySelector(".wx-form-editor-version");
            if (version) {
                version.textContent = "v" + this._structure.version;
            }
        }
    }

    /**
     * Renders the live preview pane for the active tab.
     * @param {object} tab
     * @returns {HTMLElement}
     */
    _renderPreviewPanel(tab) {
        const panel = document.createElement("div");
        panel.className = "wx-form-editor-pane wx-form-editor-pane--preview";

        const head = document.createElement("div");
        head.className = "wx-form-editor-pane-head";
        head.textContent = this._t("formeditor.preview.title");
        panel.appendChild(head);

        const body = document.createElement("div");
        body.className = "wx-form-editor-pane-body";

        const card = document.createElement("div");
        card.className = "wx-form-editor-preview-card";

        const title = document.createElement("div");
        title.className = "wx-form-editor-preview-title";
        title.textContent = (this._structure && this._structure.formName)
            || this._t("formeditor.form.fallback.name");
        card.appendChild(title);

        const description = (this._structure && this._structure.formDescription) || "";
        if (description) {
            const desc = document.createElement("div");
            desc.className = "wx-form-editor-preview-description";
            desc.textContent = description;
            card.appendChild(desc);
        }

        // tab navigation sits directly under the heading block.
        const tabsBar = this._renderPaneTabs({ allowEdit: false });
        if (tabsBar) {
            tabsBar.classList.add("wx-form-editor-preview-tabs");
            card.appendChild(tabsBar);
        }

        const list = document.createElement("div");
        list.className = "wx-form-editor-preview-list";
        for (const node of (tab.children || [])) {
            list.appendChild(this._renderPreviewNode(node));
        }
        if (!tab.children || tab.children.length === 0) {
            const empty = document.createElement("div");
            empty.className = "wx-form-editor-preview-empty";
            empty.textContent = this._t("formeditor.preview.empty");
            list.appendChild(empty);
        }
        list.addEventListener("click", () => { this._selectedId = null; this._renderBody(); });

        card.appendChild(list);
        body.appendChild(card);
        panel.appendChild(body);
        return panel;
    }

    /**
     * Dispatches preview rendering by node kind.
     * @param {object} node
     * @returns {HTMLElement}
     */
    _renderPreviewNode(node) {
        return node.kind === "group"
            ? this._renderPreviewGroup(node)
            : this._renderPreviewField(node);
    }

    /**
     * Renders a group as a dashed container with the FormGroup<name> chip.
     * @param {object} node
     * @returns {HTMLElement}
     */
    _renderPreviewGroup(node) {
        const group = document.createElement("div");
        const layoutCls = node.layout || "vertical";
        group.className = "wx-form-editor-preview-group wx-form-editor-preview-group--" + layoutCls
            + (this._selectedId === node.id ? " selected" : "");
        group.dataset.layout = webexpress.webapp.RestFormEditorCtrl.LAYOUT_LABELS[layoutCls]
            || this._t("formeditor.group.fallback");
        group.addEventListener("click", (e) => { e.stopPropagation(); this._select(node.id); });

        for (const c of (node.children || [])) {
            group.appendChild(this._renderPreviewNode(c));
        }
        return group;
    }

    /**
     * Renders a single field with a label and a control matching its type.
     * @param {object} node
     * @returns {HTMLElement}
     */
    _renderPreviewField(node) {
        const wrap = document.createElement("div");
        wrap.className = "wx-form-editor-preview-field" + (this._selectedId === node.id ? " selected" : "");
        wrap.addEventListener("click", (e) => { e.stopPropagation(); this._select(node.id); });

        const label = document.createElement("div");
        label.className = "wx-form-editor-preview-label" + (node.required ? " required" : "");
        label.textContent = node.label || "";
        wrap.appendChild(label);

        wrap.appendChild(this._renderPreviewControl(node));

        if (node.help) {
            const help = document.createElement("div");
            help.className = "wx-form-editor-preview-help";
            help.textContent = node.help;
            wrap.appendChild(help);
        }
        return wrap;
    }

    /**
     * Renders a placeholder control for the given field type.
     * @param {object} node
     * @returns {HTMLElement}
     */
    _renderPreviewControl(node) {
        switch (node.type) {
            case "string":
            case "number": {
                const input = document.createElement("input");
                input.className = "wx-form-editor-preview-input";
                input.placeholder = this._t("formeditor.preview.placeholder.enter", node.placeholder || "");
                return input;
            }
            case "text":
            case "richtext": {
                const ta = document.createElement("textarea");
                ta.className = "wx-form-editor-preview-textarea";
                if (node.type === "richtext") {
                    ta.classList.add("wx-form-editor-preview-richtext");
                }
                ta.placeholder = this._t("formeditor.preview.placeholder.describe", node.placeholder || "");
                return ta;
            }
            case "password": {
                const input = document.createElement("input");
                input.className = "wx-form-editor-preview-input";
                input.value = "••••••••";
                return input;
            }
            case "timestamp": {
                const input = document.createElement("input");
                input.className = "wx-form-editor-preview-input";
                input.value = "2026-03-14 14:32";
                return input;
            }
            case "daterange": {
                const input = document.createElement("input");
                input.className = "wx-form-editor-preview-input";
                input.value = "2026-03-14 – 2026-03-21";
                return input;
            }
            case "range": {
                const range = document.createElement("div");
                range.className = "wx-form-editor-preview-range";
                const bar = document.createElement("span");
                bar.className = "wx-form-editor-preview-range-bar";
                range.appendChild(bar);
                const knob = document.createElement("span");
                knob.className = "wx-form-editor-preview-range-knob";
                range.appendChild(knob);
                return range;
            }
            case "rating": {
                const rating = document.createElement("div");
                rating.className = "wx-form-editor-preview-rating";
                rating.textContent = "★ ★ ★ ☆ ☆";
                return rating;
            }
            case "estimate": {
                return this._renderPreviewPills(["1", "2", "3", "5", "8"], 2);
            }
            case "choice": {
                return this._renderPreviewPills(["A", "B", "C"], 1);
            }
            case "color": {
                const color = document.createElement("div");
                color.className = "wx-form-editor-preview-color";
                for (const value of ["#dc3545", "#fd7e14", "#0d6efd", "#20723d"]) {
                    const dot = document.createElement("span");
                    dot.className = "wx-form-editor-preview-color-dot";
                    dot.style.backgroundColor = value;
                    color.appendChild(dot);
                }
                return color;
            }
            case "avatar": {
                const avatar = document.createElement("div");
                avatar.className = "wx-form-editor-preview-ref";
                const dot = document.createElement("span");
                dot.className = "wx-form-editor-preview-ref-dot";
                dot.textContent = (node.label || "?")[0];
                avatar.appendChild(dot);
                const txt = document.createElement("span");
                txt.textContent = this._t("formeditor.preview.placeholder.image", "Choose an image…");
                avatar.appendChild(txt);
                return avatar;
            }
            case "tile": {
                const tiles = document.createElement("div");
                tiles.className = "wx-form-editor-preview-tiles";
                for (let i = 0; i < 2; i++) {
                    const card = document.createElement("span");
                    card.className = "wx-form-editor-preview-tile";
                    tiles.appendChild(card);
                }
                return tiles;
            }
            case "move": {
                const move = document.createElement("div");
                move.className = "wx-form-editor-preview-move";
                for (let i = 0; i < 2; i++) {
                    const column = document.createElement("span");
                    column.className = "wx-form-editor-preview-move-column";
                    move.appendChild(column);
                }
                return move;
            }
            case "ref": {
                const ref = document.createElement("div");
                ref.className = "wx-form-editor-preview-ref";
                const dot = document.createElement("span");
                dot.className = "wx-form-editor-preview-ref-dot";
                dot.textContent = (node.label || "?")[0];
                ref.appendChild(dot);
                const txt = document.createElement("span");
                txt.textContent = this._t("formeditor.preview.placeholder.unassigned");
                ref.appendChild(txt);
                return ref;
            }
            case "enum":
                return this._renderPreviewEnum(node);
            case "tags": {
                const tags = document.createElement("div");
                tags.className = "wx-form-editor-preview-tags";
                for (const t of ["regression", "ui", "p0"]) {
                    const tag = document.createElement("span");
                    tag.className = "wx-form-editor-preview-tag";
                    tag.textContent = t;
                    tags.appendChild(tag);
                }
                return tags;
            }
            case "file": {
                const file = document.createElement("div");
                file.className = "wx-form-editor-preview-file";
                file.textContent = this._t("formeditor.preview.placeholder.file");
                return file;
            }
            default: {
                const input = document.createElement("input");
                input.className = "wx-form-editor-preview-input";
                return input;
            }
        }
    }

    /**
     * Renders a row of pills, one of them marked as chosen.
     * @param {string[]} values - The labels of the pills.
     * @param {number} active - The index of the chosen pill.
     * @returns {HTMLElement}
     */
    _renderPreviewPills(values, active) {
        const wrap = document.createElement("div");
        wrap.className = "wx-form-editor-preview-pills";

        values.forEach((value, index) => {
            const pill = document.createElement("span");
            pill.className = "wx-form-editor-preview-pill" + (index === active ? " active" : "");
            pill.textContent = value;
            wrap.appendChild(pill);
        });

        return wrap;
    }

    /**
     * Renders enum-style pills, with familiar values for known field names.
     * @param {object} node
     * @returns {HTMLElement}
     */
    _renderPreviewEnum(node) {
        const palette = {
            "Priority":    [{ v: "Low" }, { v: "Medium" }, { v: "High", active: true }, { v: "Urgent" }],
            "Status":      [{ v: "Open" }, { v: "In progress", active: true }, { v: "Fixed" }, { v: "Closed" }],
            "Environment": [{ v: "Dev", active: true }, { v: "Stage" }, { v: "Prod" }]
        };
        const items = palette[node.label] || [{ v: "Option A", active: true }];
        const wrap = document.createElement("div");
        wrap.className = "wx-form-editor-preview-pills";
        for (const o of items) {
            const pill = document.createElement("span");
            pill.className = "wx-form-editor-preview-pill" + (o.active ? " active" : "");
            pill.textContent = o.v;
            wrap.appendChild(pill);
        }
        return wrap;
    }

    /**
     * Renders the structure tree pane for the active tab (head + tree + quick-add + hints).
     * @param {object} tab
     * @returns {HTMLElement}
     */
    _renderStructurePanel(tab) {
        const panel = document.createElement("div");
        panel.className = "wx-form-editor-pane";

        const head = document.createElement("div");
        head.className = "wx-form-editor-pane-head";

        const heading = document.createElement("span");
        heading.textContent = this._t("formeditor.structure.title", tab.name || "");
        head.appendChild(heading);

        const meta = document.createElement("span");
        meta.className = "wx-form-editor-pane-meta";
        meta.textContent = this._t("formeditor.structure.meta", this._countNodes(tab.children));
        head.appendChild(meta);
        panel.appendChild(head);

        const tabsBar = this._renderPaneTabs({ allowEdit: true });
        if (tabsBar) {
            panel.appendChild(tabsBar);
        }

        const body = document.createElement("div");
        body.className = "wx-form-editor-pane-body wx-form-editor-tree-body";

        const tree = document.createElement("div");
        tree.className = "wx-form-editor-tree";

        const rows = this._flatten(tab.children, 0, []);
        for (const row of rows) {
            tree.appendChild(this._renderTreeRow(row));
        }
        if (rows.length === 0) {
            const empty = document.createElement("div");
            empty.className = "wx-form-editor-tree-empty";
            empty.textContent = this._t("formeditor.structure.empty");
            tree.appendChild(empty);
        }
        tree.addEventListener("dragleave", (e) => {
            if (!tree.contains(e.relatedTarget)) {
                this._dropState = null;
                this._clearDropIndicators();
            }
        });
        tree.addEventListener("dragend", () => {
            this._dragId = null;
            this._dropState = null;
            this._clearDropIndicators();
        });
        tree.addEventListener("click", () => { this._selectedId = null; this._renderBody(); });
        body.appendChild(tree);
        panel.appendChild(body);

        if (!this._readonly) {
            panel.appendChild(this._renderQuickAdd(tab));
        }
        panel.appendChild(this._renderHints());
        return panel;
    }

    /**
     * Renders a single tree row (chevron, icon, label, meta, action buttons).
     * @param {object} row - { node, depth }
     * @returns {HTMLElement}
     */
    _renderTreeRow(row) {
        const node = row.node;
        const depth = row.depth;
        const isGroup = node.kind === "group";

        const rowEl = document.createElement("div");
        rowEl.className = "wx-form-editor-tree-row";
        if (this._selectedId === node.id) {
            rowEl.classList.add("selected");
        }
        if (this._dropState && this._dropState.id === node.id) {
            rowEl.classList.add("drop-" + this._dropState.pos);
        }
        rowEl.style.paddingLeft = (12 + depth * this._indent) + "px";
        // The row itself never starts a drag; only the ⠿ grip does. This keeps
        // text selection / clicks on the label and action buttons intact.
        rowEl.draggable = false;
        rowEl.dataset.id = node.id;
        rowEl.dataset.kind = node.kind;

        // ⠿ drag handle (visible on hover/selection)
        const grip = document.createElement("span");
        grip.className = "wx-form-editor-tree-grip";
        grip.textContent = "⠿";
        grip.title = this._t("formeditor.row.action.move");
        const canDrag = !this._readonly && this._editingId !== node.id;
        grip.draggable = canDrag;
        if (!canDrag) {
            grip.classList.add("wx-form-editor-tree-grip--disabled");
        }
        grip.addEventListener("click", (e) => e.stopPropagation());
        grip.addEventListener("dragstart", (e) => this._handleDragStart(e, node));
        rowEl.appendChild(grip);

        // chevron / spacer
        if (isGroup) {
            const collapsed = this._collapsed.has(node.id);
            const chev = document.createElement("button");
            chev.type = "button";
            chev.className = "wx-form-editor-chev" + (collapsed ? " collapsed" : "");
            const drawing = webexpress.webui.Icon.create("angle-down");
                    drawing.style.transform = collapsed ? "rotate(-90deg)" : "none";
                    chev.appendChild(drawing);
            chev.addEventListener("click", (e) => { e.stopPropagation(); this._toggleCollapse(node.id); });
            rowEl.appendChild(chev);
        } else {
            const spacer = document.createElement("span");
            spacer.className = "wx-form-editor-chev wx-form-editor-chev--empty";
            rowEl.appendChild(spacer);
        }

        // type icon / group glyph
        const icon = document.createElement("span");
        icon.className = isGroup
            ? "wx-form-editor-icon wx-form-editor-icon--group"
            : ("wx-form-editor-icon wx-form-editor-type-swatch wx-form-editor-type-" + (node.type || "string"));
        rowEl.appendChild(icon);

        // label (inline-edit when editing)
        if (this._editingId === node.id) {
            rowEl.appendChild(this._renderTreeRowEditor(node, isGroup));
        } else {
            const label = document.createElement("span");
            label.className = "wx-form-editor-tree-label";
            label.textContent = isGroup
                ? (node.label || this._t("formeditor.group.default_label"))
                : (node.label || "");
            label.addEventListener("dblclick", (e) => {
                e.stopPropagation();
                this._editingId = node.id;
                this._renderBody();
            });
            rowEl.appendChild(label);
            if (!isGroup && node.required) {
                const req = document.createElement("span");
                req.className = "wx-form-editor-tree-required";
                req.textContent = this._t("formeditor.structure.required");
                rowEl.appendChild(req);
            }
        }

        // meta (type / FormGroup<name>)
        const meta = document.createElement("span");
        meta.className = "wx-form-editor-tree-meta";
        meta.textContent = isGroup
            ? (webexpress.webapp.RestFormEditorCtrl.LAYOUT_LABELS[node.layout]
                || this._t("formeditor.group.fallback"))
            : (node.type || "");
        rowEl.appendChild(meta);

        // row actions
        if (!this._readonly) {
            rowEl.appendChild(this._renderTreeRowActions(node));
        }

        rowEl.addEventListener("click", (e) => { e.stopPropagation(); this._select(node.id); });
        rowEl.addEventListener("dragover", (e) => this._handleDragOver(e, node));
        rowEl.addEventListener("drop", (e) => this._handleDrop(e, node));
        return rowEl;
    }

    /**
     * Renders the inline rename editor inside a tree row.
     * @param {object} node
     * @param {boolean} isGroup
     * @returns {HTMLElement}
     */
    _renderTreeRowEditor(node, isGroup) {
        const input = document.createElement("input");
        input.className = "wx-form-editor-tree-input";
        input.value = node.label;
        input.addEventListener("click", e => e.stopPropagation());
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                this._commitRename(node.id, input.value);
            } else if (e.key === "Escape") {
                e.preventDefault();
                this._editingId = null;
                this._renderBody();
            }
        });
        input.addEventListener("blur", () => this._commitRename(node.id, input.value));
        // focus once attached to the dom
        setTimeout(() => { input.focus(); input.select(); }, 0);
        return input;
    }

    /**
     * Renders the rename / delete action buttons inside a tree row.
     * @param {object} node
     * @returns {HTMLElement}
     */
    _renderTreeRowActions(node) {
        const actions = document.createElement("span");
        actions.className = "wx-form-editor-tree-actions";

        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = "wx-form-editor-icon-btn";
        edit.title = this._t("formeditor.row.action.rename");
        edit.textContent = "✎";
        edit.addEventListener("click", (e) => {
            e.stopPropagation();
            this._editingId = node.id;
            this._renderBody();
        });
        actions.appendChild(edit);

        const del = document.createElement("button");
        del.type = "button";
        del.className = "wx-form-editor-icon-btn";
        del.title = this._t("formeditor.row.action.delete");
        del.textContent = "✕";
        del.addEventListener("click", (e) => {
            e.stopPropagation();
            this.removeNode(node.id);
        });
        actions.appendChild(del);

        return actions;
    }

    /**
     * Renders the bottom Quick Add input + picker.
     * @param {object} tab
     * @returns {HTMLElement}
     */
    _renderQuickAdd(tab) {
        const wrap = document.createElement("div");
        wrap.className = "wx-form-editor-quickadd";

        const input = document.createElement("input");
        input.type = "text";
        input.className = "wx-form-editor-quickadd-input";
        input.placeholder = this._t("formeditor.quickadd.placeholder");

        const picker = document.createElement("div");
        picker.className = "wx-form-editor-picker";
        picker.style.display = "none";

        const renderPicker = () => {
            picker.textContent = "";
            const q = input.value.toLowerCase();
            const used = this._collectFieldLabels(tab.children);

            const fieldMatches = this._fieldCatalog.filter(f => f.id.toLowerCase().includes(q));
            const groupMatches = webexpress.webapp.RestFormEditorCtrl.GROUP_LAYOUTS
                .filter(g => g.label.toLowerCase().includes(q));

            const total = fieldMatches.length + groupMatches.length;
            if (total === 0) {
                const empty = document.createElement("div");
                empty.className = "wx-form-editor-picker-empty";
                empty.textContent = this._t("formeditor.picker.empty");
                picker.appendChild(empty);
                return;
            }
            this._pickerHi = Math.min(this._pickerHi, total - 1);

            if (fieldMatches.length > 0) {
                const sep = document.createElement("div");
                sep.className = "wx-form-editor-picker-sep";
                sep.textContent = this._t("formeditor.picker.fields");
                picker.appendChild(sep);
            }
            fieldMatches.forEach((f, i) => {
                picker.appendChild(this._renderPickerFieldItem(f, i, used.has(f.id), input));
            });

            if (groupMatches.length > 0) {
                const sep = document.createElement("div");
                sep.className = "wx-form-editor-picker-sep";
                sep.textContent = this._t("formeditor.picker.groups");
                picker.appendChild(sep);
            }
            groupMatches.forEach((g, i) => {
                picker.appendChild(this._renderPickerGroupItem(g, fieldMatches.length + i, input));
            });
        };

        const closePicker = () => {
            this._pickerOpen = false;
            picker.style.display = "none";
        };
        const openPicker = () => {
            this._pickerOpen = true;
            this._pickerHi = 0;
            renderPicker();
            picker.style.display = "block";
        };

        input.addEventListener("focus", openPicker);
        input.addEventListener("input", () => { this._pickerHi = 0; renderPicker(); });
        input.addEventListener("keydown", (e) => this._handlePickerKeydown(e, input, closePicker));

        wrap.appendChild(input);
        wrap.appendChild(picker);

        const add = document.createElement("button");
        add.type = "button";
        add.className = "wx-form-editor-add-btn";
        add.textContent = this._t("formeditor.quickadd.add");
        add.addEventListener("click", () => input.focus());
        wrap.appendChild(add);

        // expose closePicker so the document mousedown handler can find it
        wrap._wxClosePicker = closePicker;
        return wrap;
    }

    /**
     * Renders a single QuickAdd picker field item.
     * @param {object} f - Catalog entry.
     * @param {number} idx - Index within the highlighted set.
     * @param {boolean} used - Whether the field is already used on the tab.
     * @param {HTMLInputElement} input - The picker input (cleared on commit).
     * @returns {HTMLElement}
     */
    _renderPickerFieldItem(f, idx, used, input) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "wx-form-editor-picker-item"
            + (this._pickerHi === idx ? " highlighted" : "")
            + (used ? " disabled" : "");
        btn.disabled = used;

        const swatch = document.createElement("span");
        swatch.className = "wx-form-editor-type-swatch wx-form-editor-type-" + f.type;
        btn.appendChild(swatch);

        const label = document.createElement("span");
        label.className = "wx-form-editor-picker-label";
        label.textContent = f.label;
        btn.appendChild(label);

        const meta = document.createElement("span");
        meta.className = "wx-form-editor-picker-meta";
        meta.textContent = used ? this._t("formeditor.picker.used") : f.type;
        btn.appendChild(meta);

        btn.addEventListener("click", () => {
            if (used) {
                return;
            }
            this.addNode({ kind: "field", id: f.id, label: f.label, type: f.type });
            input.value = "";
            this._pickerOpen = false;
            btn.parentElement.style.display = "none";
        });
        return btn;
    }

    /**
     * Renders a single QuickAdd picker group item.
     * @param {object} g - Group descriptor.
     * @param {number} idx - Index within the highlighted set.
     * @param {HTMLInputElement} input - The picker input (cleared on commit).
     * @returns {HTMLElement}
     */
    _renderPickerGroupItem(g, idx, input) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "wx-form-editor-picker-item" + (this._pickerHi === idx ? " highlighted" : "");

        const glyph = document.createElement("span");
        glyph.className = "wx-form-editor-picker-glyph";
        glyph.textContent = "▦";
        btn.appendChild(glyph);

        const label = document.createElement("span");
        label.className = "wx-form-editor-picker-label";
        label.textContent = g.label;
        btn.appendChild(label);

        const meta = document.createElement("span");
        meta.className = "wx-form-editor-picker-meta";
        meta.textContent = g.id;
        btn.appendChild(meta);

        btn.addEventListener("click", () => {
            this.addNode({
                kind: "group",
                layout: g.id,
                label: g.label.split(" ")[0]
            });
            input.value = "";
            this._pickerOpen = false;
            btn.parentElement.style.display = "none";
        });
        return btn;
    }

    /**
     * Handles keyboard navigation inside the QuickAdd picker input.
     * @param {KeyboardEvent} e
     * @param {HTMLInputElement} input
     * @param {Function} closePicker
     */
    _handlePickerKeydown(e, input, closePicker) {
        const tab = this._getActiveTab();
        const q = input.value.toLowerCase();
        const fieldMatches = this._fieldCatalog.filter(f => f.id.toLowerCase().includes(q));
        const groupMatches = webexpress.webapp.RestFormEditorCtrl.GROUP_LAYOUTS
            .filter(g => g.label.toLowerCase().includes(q));

        if (e.key === "ArrowDown") {
            e.preventDefault();
            this._pickerHi = Math.min(fieldMatches.length + groupMatches.length - 1, this._pickerHi + 1);
            this._renderBody();
            const refocused = this._element.querySelector(".wx-form-editor-quickadd-input");
            if (refocused) { refocused.focus(); refocused.value = input.value; }
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            this._pickerHi = Math.max(0, this._pickerHi - 1);
            this._renderBody();
            const refocused = this._element.querySelector(".wx-form-editor-quickadd-input");
            if (refocused) { refocused.focus(); refocused.value = input.value; }
        } else if (e.key === "Escape") {
            e.preventDefault();
            closePicker();
            input.blur();
        } else if (e.key === "Enter") {
            e.preventDefault();
            const used = this._collectFieldLabels(tab.children);
            if (this._pickerHi < fieldMatches.length) {
                const f = fieldMatches[this._pickerHi];
                if (!used.has(f.id)) {
                    this.addNode({ kind: "field", id: f.id, label: f.label, type: f.type });
                    input.value = "";
                    closePicker();
                }
            } else {
                const g = groupMatches[this._pickerHi - fieldMatches.length];
                if (g) {
                    this.addNode({ kind: "group", layout: g.id, label: g.label.split(" ")[0] });
                    input.value = "";
                    closePicker();
                }
            }
        }
    }

    /**
     * Renders the keyboard hints row at the bottom of the structure pane.
     * @returns {HTMLElement}
     */
    _renderHints() {
        const hints = document.createElement("div");
        hints.className = "wx-form-editor-tree-hints";
        const items = [
            { key: "↑↓", label: this._t("formeditor.hints.navigate") },
            { key: "←→", label: this._t("formeditor.hints.collapse") },
            { key: "F2", label: this._t("formeditor.hints.rename") },
            { key: "Del", label: this._t("formeditor.hints.delete") },
            { key: "N", label: this._t("formeditor.hints.add") }
        ];
        for (const it of items) {
            const span = document.createElement("span");
            span.className = "wx-form-editor-hint";
            const kbd = document.createElement("span");
            kbd.className = "wx-form-editor-kbd";
            kbd.textContent = it.key;
            span.appendChild(kbd);
            span.appendChild(document.createTextNode(" " + it.label));
            hints.appendChild(span);
        }
        return hints;
    }

    /**
     * Selects a node and re-renders.
     * @param {string} id
     */
    _select(id) {
        this._selectedId = id;
        this._renderBody();
    }

    /**
     * Toggles the collapsed state of a group node.
     * @param {string} id
     */
    _toggleCollapse(id) {
        if (this._collapsed.has(id)) {
            this._collapsed.delete(id);
        } else {
            this._collapsed.add(id);
        }
        this._renderBody();
    }

    /**
     * Commits an inline rename initiated via F2 / dbl-click.
     * @param {string} id
     * @param {string} value
     */
    _commitRename(id, value) {
        const tab = this._getActiveTab();
        const node = this._findById(tab.children, id);
        this._editingId = null;
        if (!node) {
            this._renderBody();
            return;
        }
        const next = (value || "").trim();
        if (!next) {
            this._renderBody();
            return;
        }
        node.label = next;
        this._dispatch(webexpress.webapp.Event.FORM_EDITOR_NODE_RENAMED_EVENT, { id: id, name: next });
        this._renderBody();
        this._scheduleSave();
    }

    /**
     * Handles dragstart on a tree row.
     * @param {DragEvent} e
     * @param {object} node
     */
    _handleDragStart(e, node) {
        if (this._readonly) {
            return;
        }
        this._dragId = node.id;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", node.id);
    }

    /**
     * Handles dragover on a tree row, computing the before/after/into drop position.
     *
     * The drop indicator is applied directly to the row classes; rebuilding
     * the tree mid-drag would detach the source element and the browser
     * would abort the drag without firing `drop`, which is why moves used
     * to silently fail.
     * @param {DragEvent} e
     * @param {object} node
     */
    _handleDragOver(e, node) {
        if (this._readonly || !this._dragId || this._dragId === node.id) {
            return;
        }
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const h = rect.height;
        let pos;
        if (node.kind === "group" && y > h * 0.25 && y < h * 0.75) {
            pos = "into";
        } else if (y < h / 2) {
            pos = "before";
        } else {
            pos = "after";
        }
        const next = { id: node.id, pos: pos };
        if (!this._dropState || this._dropState.id !== next.id || this._dropState.pos !== next.pos) {
            this._dropState = next;
            this._clearDropIndicators();
            e.currentTarget.classList.add("drop-" + pos);
        }
    }

    /**
     * Removes any drop-position indicator classes from the rendered tree rows.
     */
    _clearDropIndicators() {
        const rows = this._element.querySelectorAll(".wx-form-editor-tree-row");
        for (const r of rows) {
            r.classList.remove("drop-before", "drop-after", "drop-into");
        }
    }

    /**
     * Handles drop on a tree row, mutating the structure and persisting.
     * @param {DragEvent} e
     * @param {object} target
     */
    _handleDrop(e, target) {
        if (this._readonly) {
            return;
        }
        e.preventDefault();
        const tab = this._getActiveTab();
        const dropState = this._dropState;
        const dragId = this._dragId;
        this._dropState = null;
        this._dragId = null;
        this._clearDropIndicators();
        if (!dragId || !dropState || dragId === target.id) {
            return;
        }

        const source = this._findById(tab.children, dragId);
        if (!source) {
            return;
        }

        // no descendant-into-self moves
        if (source.kind === "group" && dropState.pos === "into" && this._isAncestor(source, target.id)) {
            return;
        }

        this._removeFromList(tab.children, dragId);

        if (dropState.pos === "into" && target.kind === "group") {
            target.children = target.children || [];
            target.children.push(source);
        } else {
            const targetParent = this._findParentList(tab.children, dropState.id) || tab.children;
            const idx = targetParent.findIndex(n => n.id === dropState.id);
            if (idx === -1) {
                tab.children.push(source);
            } else {
                targetParent.splice(idx + (dropState.pos === "after" ? 1 : 0), 0, source);
            }
        }

        this._dispatch(webexpress.webapp.Event.FORM_EDITOR_NODE_MOVED_EVENT, {
            nodeId: dragId, targetId: target.id, position: dropState.pos
        });
        this._renderBody();
        this._scheduleSave();
    }

    /**
     * Wires the global keyboard shortcuts for tree navigation.
     */
    _bindKeyboard() {
        this._keyboardHandler = (e) => this._onGlobalKeydown(e);
        window.addEventListener("keydown", this._keyboardHandler);
    }

    /**
     * Closes the QuickAdd picker on outside clicks.
     */
    _bindOutsideClick() {
        this._outsideClickHandler = (e) => {
            const wrap = this._element.querySelector(".wx-form-editor-quickadd");
            if (wrap && !wrap.contains(e.target) && wrap._wxClosePicker) {
                wrap._wxClosePicker();
            }
        };
        document.addEventListener("mousedown", this._outsideClickHandler);
    }

    /**
     * Global keydown dispatcher handling navigation, rename, delete, add.
     * @param {KeyboardEvent} e
     */
    _onGlobalKeydown(e) {
        if (this._readonly) {
            return;
        }
        if (this._editingId) {
            return;
        }
        const tag = e.target.tagName;
        if (["INPUT", "TEXTAREA", "SELECT"].includes(tag) && !this._element.contains(e.target)) {
            return;
        }
        if (e.target.isContentEditable) {
            return;
        }
        if (!this._element.isConnected) {
            return;
        }

        const tab = this._getActiveTab();
        if (!tab) {
            return;
        }
        const flat = this._flatten(tab.children, 0, []);
        const idx = flat.findIndex(r => r.node.id === this._selectedId);

        if (e.key === "ArrowDown") {
            e.preventDefault();
            const next = flat[Math.min(flat.length - 1, idx + 1)];
            if (next) this._select(next.node.id);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            const next = flat[Math.max(0, idx - 1)];
            if (next) this._select(next.node.id);
        } else if (e.key === "ArrowRight" && idx >= 0) {
            const n = flat[idx].node;
            if (n.kind === "group" && this._collapsed.has(n.id)) {
                e.preventDefault();
                this._toggleCollapse(n.id);
            }
        } else if (e.key === "ArrowLeft" && idx >= 0) {
            const n = flat[idx].node;
            if (n.kind === "group" && !this._collapsed.has(n.id)) {
                e.preventDefault();
                this._toggleCollapse(n.id);
            }
        } else if (e.key === "F2" && this._selectedId) {
            e.preventDefault();
            this._editingId = this._selectedId;
            this._renderBody();
        } else if ((e.key === "Delete" || e.key === "Backspace") && this._selectedId && e.target === document.body) {
            e.preventDefault();
            this.removeNode(this._selectedId);
        } else if ((e.key === "n" || e.key === "N") && !e.metaKey && !e.ctrlKey && e.target === document.body) {
            e.preventDefault();
            const input = this._element.querySelector(".wx-form-editor-quickadd-input");
            if (input) {
                input.focus();
            }
        }
    }

    /**
     * Schedules a debounced write of the structure: to the draft where one is
     * declared, to the form itself otherwise.
     */
    _scheduleSave() {
        if (this._readonly || !this._restUrl || !this._structure || this._sealed) {
            return;
        }
        if (this._saveTimer) {
            clearTimeout(this._saveTimer);
        }
        if (this.drafting) {
            this._setState("pending");
        }
        this._saveTimer = setTimeout(() => { void this._save(); }, webexpress.webapp.RestFormEditorCtrl.SAVE_DEBOUNCE);
    }

    /**
     * Drops the queued write.
     */
    _cancelSave() {
        if (this._saveTimer) {
            clearTimeout(this._saveTimer);
            this._saveTimer = null;
        }
    }

    /**
     * Writes the current structure to the endpoint the mode names.
     *
     * One write is in flight at a time and publish and discard wait for it, so
     * the order the server sees is the order the user acted in. A change made
     * while the request was open is written once it has returned.
     * @returns {Promise<void>}
     */
    async _save() {
        this._saveTimer = null;
        if (this._readonly || !this._restUrl || !this._structure || this._sealed) {
            return;
        }
        if (this._inFlight) {
            await this._inFlight;
            this._scheduleSave();
            return;
        }

        this._inFlight = this.drafting ? this._saveDraft() : this._saveForm();

        try {
            await this._inFlight;
        } finally {
            this._inFlight = null;
        }
    }

    /**
     * Writes the structure to the form itself. Without a draft this is what
     * every save is: the endpoint applies the structure and answers the new version.
     * @returns {Promise<void>}
     */
    async _saveForm() {
        const result = await this._service.update(this._structure);

        if (!result.ok) {
            this._dispatch(webexpress.webapp.Event.FORM_EDITOR_VALIDATION_FAILED_EVENT, result.data || { status: result.status });
            return;
        }

        this._adoptVersion(result.data);
        this._dispatch(webexpress.webapp.Event.FORM_EDITOR_SAVED_EVENT, result.data);
    }

    /**
     * Writes the structure as the unpublished draft.
     * @returns {Promise<void>}
     */
    async _saveDraft() {
        this._setState("saving");

        const result = await this._draftService.update(this._structure);

        if (!result.ok) {
            // the structure is still on screen and the next change retries, so a
            // failed save is reported rather than raised
            this._setState("error");
            return;
        }

        this._draft = true;
        this._updated = new Date();
        this._setState("saved");
        this._dispatch(webexpress.webapp.Event.FORM_EDITOR_DRAFT_SAVED_EVENT, {
            structure: this.getStructure(),
            updated: this._updated
        });
    }

    /**
     * Flushes a queued write as the page goes away, with a request that outlives
     * the document an ordinary one would be cancelled with. The answer cannot be
     * read, so the state on screen is left as it is - the screen is going away too.
     */
    _bindLeave() {
        const leave = () => {
            if (!this._saveTimer || this._sealed || !this._structure) {
                return;
            }
            this._cancelSave();

            const service = this.drafting ? this._draftService : this._service;

            service.request(service.baseUri, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(this._structure),
                keepalive: true
            });
        };

        this._leaveHandler = leave;
        this._visibilityHandler = () => {
            if (document.visibilityState === "hidden") {
                leave();
            }
        };
        window.addEventListener("pagehide", this._leaveHandler);
        document.addEventListener("visibilitychange", this._visibilityHandler);
    }

    /**
     * Returns the active tab (or the first tab as a fallback).
     * @returns {object|null}
     */
    _getActiveTab() {
        if (!this._structure || !this._structure.tabs) {
            return null;
        }
        return this._structure.tabs.find(t => t.id === this._activeTabId)
            || this._structure.tabs[0]
            || null;
    }

    /**
     * Returns a flat list of {node, depth} entries respecting collapsed groups.
     * @param {object[]} list
     * @param {number} depth
     * @param {object[]} out
     * @returns {object[]}
     */
    _flatten(list, depth, out) {
        for (const n of (list || [])) {
            out.push({ node: n, depth: depth });
            if (n.kind === "group" && !this._collapsed.has(n.id) && (n.children || []).length) {
                this._flatten(n.children, depth + 1, out);
            }
        }
        return out;
    }

    /**
     * Recursively finds a node by id.
     * @param {object[]} list
     * @param {string} id
     * @returns {object|null}
     */
    _findById(list, id) {
        for (const n of (list || [])) {
            if (n.id === id) {
                return n;
            }
            if (n.kind === "group") {
                const hit = this._findById(n.children, id);
                if (hit) {
                    return hit;
                }
            }
        }
        return null;
    }

    /**
     * Recursively finds the list containing the node with the given id.
     * @param {object[]} list
     * @param {string} id
     * @returns {object[]|null}
     */
    _findParentList(list, id) {
        for (const n of (list || [])) {
            if (n.id === id) {
                return list;
            }
            if (n.kind === "group") {
                const hit = this._findParentList(n.children, id);
                if (hit) {
                    return hit;
                }
            }
        }
        return null;
    }

    /**
     * Returns the group containing the selected node (used to ViewState add operations
     * to the currently focused group).
     * @param {object} tab
     * @param {string} selectedId
     * @returns {object|null}
     */
    _findGroupContaining(tab, selectedId) {
        if (!selectedId) {
            return null;
        }
        const path = this._pathTo(tab.children, selectedId, []);
        if (!path) {
            return null;
        }
        const last = path[path.length - 1];
        return last.kind === "group" ? last : null;
    }

    /**
     * Returns the list of ancestor nodes leading to the node with the given id.
     * @param {object[]} list
     * @param {string} id
     * @param {object[]} acc
     * @returns {object[]|null}
     */
    _pathTo(list, id, acc) {
        for (const n of (list || [])) {
            if (n.id === id) {
                return acc.concat(n);
            }
            if (n.kind === "group") {
                const sub = this._pathTo(n.children, id, acc.concat(n));
                if (sub) {
                    return sub;
                }
            }
        }
        return null;
    }

    /**
     * Removes the node with the given id from the list and any nested groups.
     * @param {object[]} list
     * @param {string} id
     * @returns {boolean} True if a node was removed.
     */
    _removeFromList(list, id) {
        for (let i = 0; i < (list || []).length; i++) {
            if (list[i].id === id) {
                list.splice(i, 1);
                return true;
            }
            if (list[i].kind === "group" && this._removeFromList(list[i].children, id)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Returns true when target is a descendant of group.
     * @param {object} group
     * @param {string} targetId
     * @returns {boolean}
     */
    _isAncestor(group, targetId) {
        for (const child of (group.children || [])) {
            if (child.id === targetId) {
                return true;
            }
            if (child.kind === "group" && this._isAncestor(child, targetId)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Counts all nodes (fields and groups) in the given list, recursively.
     * @param {object[]} list
     * @returns {number}
     */
    _countNodes(list) {
        let n = 0;
        for (const c of (list || [])) {
            n++;
            if (c.kind === "group") {
                n += this._countNodes(c.children);
            }
        }
        return n;
    }

    /**
     * Counts only field leaves in the given list, recursively.
     * @param {object[]} list
     * @returns {number}
     */
    _countFields(list) {
        let n = 0;
        for (const c of (list || [])) {
            if (c.kind === "field") {
                n++;
            } else {
                n += this._countFields(c.children);
            }
        }
        return n;
    }

    /**
     * Collects every used field label in the given list, recursively.
     * @param {object[]} list
     * @param {Set<string>} [out]
     * @returns {Set<string>}
     */
    _collectFieldLabels(list, out) {
        out = out || new Set();
        for (const n of (list || [])) {
            if (n.kind === "field") {
                out.add(n.label);
            } else {
                this._collectFieldLabels(n.children, out);
            }
        }
        return out;
    }

    /**
     * Builds a node from the supplied spec, normalizing optional properties.
     * @param {object} spec
     * @returns {object}
     */
    _buildNode(spec) {
        if (spec.kind === "field") {
            const type = webexpress.webapp.RestFormEditorCtrl.FIELD_TYPES.includes(spec.type)
                ? spec.type
                : "string";
            return {
                id: webexpress.webapp.RestFormEditorCtrl._uid("n"),
                kind: "field",
                label: spec.label || this._t("formeditor.field.default_name"),
                type: type,
                required: !!spec.required,
                help: spec.help || undefined
            };
        }
        return {
            id: webexpress.webapp.RestFormEditorCtrl._uid("n"),
            kind: "group",
            layout: spec.layout || "vertical",
            label: spec.label || this._t("formeditor.group.default_label"),
            children: []
        };
    }

    /**
     * Looks up an i18n value in the "webexpress.webapp" namespace and applies
     * positional argument substitution ({0}, {1}, …).
     * @param {string} key  - Key relative to the "webexpress.webapp" namespace.
     * @param  {...any} args - Positional substitution arguments.
     * @returns {string}
     */
    _t(key, ...args) {
        let str = this._i18n("webexpress.webapp:" + key, key);
        for (let i = 0; i < args.length; i++) {
            str = str.split("{" + i + "}").join(String(args[i]));
        }
        return str;
    }

    /**
     * Generates a short prefixed identifier suitable for new nodes.
     * @param {string} prefix
     * @returns {string}
     */
    static _uid(prefix) {
        return (prefix || "n") + Math.random().toString(36).slice(2, 10);
    }
};

// register the class in the controller
webexpress.webui.Controller.registerClass("wx-webapp-restform-editor", webexpress.webapp.RestFormEditorCtrl);
