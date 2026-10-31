/**
 * Controller for the visual form editor (Designer).
 *
 * A single self-contained web UI control. Renders a fixed two-pane layout with
 * the structure tree on the left (drag-and-drop, inline rename, keyboard
 * navigation, QuickAdd picker, tab bar) and a live preview on the right (with a
 * tab switcher that mirrors the structure).
 *
 * A form definition has the same two meanings of save a document has: "do not
 * lose what I have built" and "let the forms out there use this". Where only the
 * "data" service is declared the two coincide and every change is written to
 * it, which is what an editor for a form nobody else fills in yet may do. Where a
 * "draft" service is declared as well, every change goes to that one instead -
 * no version, nothing the forms in use see - and the data service is reached
 * only through publish, whose PUT applies the structure and ends the draft in
 * its own transaction. The controller never deletes a draft as part of
 * publishing: a delete racing a publish that failed would destroy the only copy
 * of the work.
 *
 * The control is a Data control. Its state is one container with three parts
 * kept apart: the form definition, the surface state (active tab, selection,
 * collapsed groups, preview) and the persistence state (the phase of the
 * definition, the save status, the local change revision, the draft and the last
 * error). What is rendered and which actions are offered is derived from it. The
 * phase says where the definition came from - loading, ready (loaded), offline
 * (no service declared), create (a new form was asked for) or error (the load
 * failed) - and only a definition that is ready, offline or created may be
 * edited, so a failed load never produces a structure an autosave could write
 * over the form it failed to load. A sixth phase, stale, marks a discarded draft
 * whose published form could not be loaded.
 *
 * Every change runs through one path that refuses while the definition is not
 * editable, read-only, or while a publication or a discard decides the draft's
 * fate. Every write sends a copy of the definition taken at a known revision;
 * one write is in flight at a time, changes made meanwhile are written together
 * afterwards, and a write only marks the editor saved when no newer change was
 * made. Leaving the page and destroy() go through the same coordination, and
 * what the server has not confirmed by then is also kept in the browser and
 * offered for restoring on the next load. A draft save presents the revision of
 * the draft it was edited on top of, so a draft endpoint can refuse to let two
 * editors overwrite each other's drafts.
 *
 * Standalone the editor owns its wx-service islands and loads itself; bound to a
 * resource of an enclosing ViewState (data-wx-resource) it renders that slice and
 * writes through the ViewState's service, and a slice never replaces unsaved work.
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
 *
 * The phases, save states, events and service contracts are documented in
 * WebExpress.WebApp/docs/js/form-editor.md.
 */
webexpress.webapp.RestFormEditorCtrl = class extends webexpress.webapp.Data {

    // mapping between wire-format layout strings and their FormGroup<name> labels
    static LAYOUT_LABELS = {
        "vertical":       "FormGroupVertical",
        "horizontal":     "FormGroupHorizontal",
        "mix":            "FormGroupMix",
        "col-vertical":   "FormGroupColumnVertical",
        "col-horizontal": "FormGroupColumnHorizontal",
        "col-mix":        "FormGroupColumnMix"
    };

    // catalog of group layouts offered to the user (palette + QuickAdd), labelled by formeditor.layout.<id>
    static GROUP_LAYOUTS = ["vertical", "horizontal", "mix", "col-vertical", "col-horizontal", "col-mix"];

    // logical field types accepted by the editor. They are coarser than the field types an
    // application models: several of those share a shape and are previewed alike — a
    // calendar reads as a date, a cascading selection as a list.
    static FIELD_TYPES = [
        "string", "text", "richtext", "password", "timestamp", "daterange", "ref", "enum",
        "choice", "tags", "number", "range", "rating", "estimate", "color", "avatar",
        "tile", "move", "file"
    ];

    // the idle time after which a change is written; short, because a change
    // here is a click rather than a keystroke and nothing is typed in between
    static SAVE_DEBOUNCE = 400;

    // the phases in which the definition on screen is a valid starting point
    static EDITABLE_PHASES = ["ready", "offline", "create"];

    // the browser keeps the changes the server had not confirmed when the editor
    // went away under this prefix and the address they were to be written to
    static RECOVERY_PREFIX = "wx-form-editor:recovery:";

    // the body budget of a keepalive request; browsers allow 64 KiB in flight per
    // page and refuse a larger one outright
    static KEEPALIVE_LIMIT = 60000;

    // configuration
    _readonly = false;
    _resource = null;
    _create = false;
    _seed = null;
    _service = null;
    _draftService = null;
    _viewState = null;

    // lifecycle
    _destroyed = false;
    _instanceId = null;
    _bindings = [];
    _headerEdits = new Set();
    _bodyEdits = new Set();
    _confirm = null;
    _unwatch = null;
    _cancelViewState = null;
    _lastEditable = undefined;

    // save coordination: the debounce, the running write loop, the write in
    // flight with the revision it carries, and whether the next write has to
    // outlive the document
    _saveTimer = null;
    _flushing = null;
    _writing = null;
    _keepalive = false;
    _conflictOrigin = null;
    _resumed = false;
    _adoptedRaw = null;

    // a ViewState slice that arrived while it could not be taken over, and whether
    // the editor wrote since it took over a definition - after a write an answer of
    // the same version may be older than what the editor holds
    _pendingSlice = null;
    _wroteSinceAdopt = false;

    // transient gesture state
    _dragId = null;
    _dropState = null;
    _pickerOpen = false;
    _pickerHi = 0;
    _splitId = null;
    _noticeKey = "";

    // dom hosts
    _headerHost = null;
    _noticeHost = null;
    _bodyHost = null;
    _footerHost = null;
    _publishButton = null;
    _stateElement = null;
    _discardButton = null;
    _versionElement = null;

    /**
     * Creates a form editor controller for the root element.
     * @param {HTMLElement} element - Root node carrying the data-* configuration.
     */
    constructor(element) {
        // the islands are consumed before the skeleton replaces the children of the
        // host; both reads cache on the element, so the Data base sees the same answers
        const seed = webexpress.webapp.Data.readState(element);
        const islandServices = webexpress.webapp.ServiceRegistry.fromElement(element);

        super(element, { state: webexpress.webapp.RestFormEditorCtrl._initialState(element, seed) });

        // the endpoints are authored in C# through the wx-service islands: "data"
        // loads and publishes, the optional "draft" holds the unpublished work
        this._service = islandServices.data || null;
        this._draftService = islandServices.draft || null;
        this._readonly = webexpress.webapp.RestFormEditorCtrl._attribute(element, "data-readonly", "readonly") === "true";
        this._resource = webexpress.webapp.RestFormEditorCtrl._attribute(element, "data-wx-resource", "wxResource") || null;
        this._create = seed.create === true;
        this._seed = seed.structure && typeof seed.structure === "object" && !Array.isArray(seed.structure) ? seed.structure : null;
        this._instanceId = webexpress.webapp.RestFormEditorCtrl._uid("fe");

        element.classList.add("wx-form-editor");

        this._buildSkeleton();
        this._bindKeyboard();
        this._bindOutsideClick();
        this._bindLeave();
        this.mount();

        // the start waits for the constructor to return, so a listener attached
        // right after the instantiation hears the load
        Promise.resolve().then(() => this._bootstrap());
    }

    /**
     * Gets whether changes are written to an unpublished draft rather than to
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
        return this._p.draft;
    }

    /**
     * Gets the save state the footer shows. It keeps the meaning it had before
     * the control became a Data control; the whole state is available through
     * store.getState().
     * @returns {string} One of idle, draft, pending, saving, saved, error, conflict, publishing, discarding.
     */
    get state() {
        return this._p.status;
    }

    /**
     * Gets the phase of the definition on screen.
     * @returns {string} One of loading, ready, offline, create, error, stale.
     */
    get phase() {
        return this._p.phase;
    }

    /**
     * Gets whether the definition on screen holds changes the server has not confirmed.
     * @returns {boolean}
     */
    get dirty() {
        return this._dirty;
    }

    /**
     * Gets whether the live preview pane is shown.
     * @returns {boolean}
     */
    get preview() {
        return this._ui.preview;
    }

    /**
     * Sets whether the live preview pane is shown. Re-renders the body if changed.
     * @param {boolean} value
     */
    set preview(value) {
        const next = !!value;
        if (next === this._ui.preview) {
            return;
        }
        this._patchUi({ preview: next });
        this._renderHeader();
        this._renderBody();
    }

    /**
     * Gets the tree indent in pixels.
     * @returns {number}
     */
    get indent() {
        return this._ui.indent;
    }

    /**
     * Sets the tree indent in pixels (clamped to 8–32). Re-renders the body if changed.
     * @param {number} value
     */
    set indent(value) {
        const n = webexpress.webapp.RestFormEditorCtrl._clampIndent(value);
        if (n === this._ui.indent) {
            return;
        }
        this._patchUi({ indent: n });
        this._renderBody();
    }

    /**
     * Gets a deep-cloned snapshot of the current in-memory structure.
     * @returns {object|null}
     */
    getStructure() {
        return this._structure ? webexpress.webapp.RestFormEditorCtrl._clone(this._structure) : null;
    }

    /**
     * Adds a new tab and selects it.
     */
    addTab() {
        let tab = null;
        const changed = this._commit((definition) => {
            tab = {
                id: webexpress.webapp.RestFormEditorCtrl._uid("t"),
                name: this._t("formeditor.tab.new.name", definition.tabs.length + 1),
                children: []
            };
            definition.tabs.push(tab);
        });
        if (!changed) {
            return;
        }
        this._patchUi({ activeTabId: tab.id, selectedId: null });
        this._dispatch(webexpress.webapp.Event.FORM_EDITOR_TAB_ADDED_EVENT, { tab: webexpress.webapp.RestFormEditorCtrl._clone(tab) });
        this._renderBody();
    }

    /**
     * Adds a node to the active tab. spec is { kind: 'field', name, type, required?, help? }
     * or { kind: 'group', layout, label }.
     * @param {object} spec - Node specification.
     */
    addNode(spec) {
        if (!spec) {
            return;
        }
        const selected = this._ui.selectedId;
        let node = null;
        const changed = this._commit((definition) => {
            const tab = this._tabOf(definition);
            if (!tab) {
                return false;
            }
            node = this._buildNode(spec);
            const parent = this._findGroupContaining(tab, selected);
            if (parent) {
                (parent.children = parent.children || []).push(node);
            } else {
                tab.children.push(node);
            }
        });
        if (!changed) {
            return;
        }
        this._patchUi({ selectedId: node.id });
        this._dispatch(webexpress.webapp.Event.FORM_EDITOR_NODE_ADDED_EVENT, { node: webexpress.webapp.RestFormEditorCtrl._clone(node) });
        this._renderBody();
    }

    /**
     * Removes a node by id.
     * @param {string} nodeId - Id of the node to remove.
     */
    removeNode(nodeId) {
        const changed = this._commit((definition) => {
            const tab = this._tabOf(definition);
            return !!tab && this._removeFromList(tab.children, nodeId);
        });
        if (!changed) {
            return;
        }
        if (this._ui.selectedId === nodeId) {
            this._patchUi({ selectedId: null });
        }
        this._dispatch(webexpress.webapp.Event.FORM_EDITOR_NODE_REMOVED_EVENT, { id: nodeId });
        this._renderBody();
    }

    /**
     * Renames a node of the active tab, or a tab, by id.
     * @param {string} nodeId - Id of the node or tab to rename.
     * @param {string} newName - New name (trimmed; ignored when empty).
     */
    renameNode(nodeId, newName) {
        const next = (newName || "").trim();
        if (!next) {
            return;
        }
        let renamedTab = false;
        const changed = this._commit((definition) => {
            const tab = this._tabOf(definition);
            const node = tab ? this._findById(tab.children, nodeId) : null;
            if (node) {
                if (node.label === next) {
                    return false;
                }
                node.label = next;
                return true;
            }
            const named = definition.tabs.find(t => t.id === nodeId);
            if (!named || named.name === next) {
                return false;
            }
            named.name = next;
            renamedTab = true;
            return true;
        });
        if (!changed) {
            return;
        }
        if (renamedTab) {
            this._dispatch(webexpress.webapp.Event.FORM_EDITOR_TAB_RENAMED_EVENT, { tabId: nodeId, name: next });
        } else {
            this._dispatch(webexpress.webapp.Event.FORM_EDITOR_NODE_RENAMED_EVENT, { id: nodeId, name: next });
        }
        this._renderBody();
    }

    /**
     * Writes the unsaved changes now, without waiting for the debounce.
     * @returns {Promise<boolean>} Resolves when the writes are done or were skipped;
     *     true when nothing unsaved is left.
     */
    async save() {
        this._cancelSave();
        await this._flush();
        return !this._dirty;
    }

    /**
     * Repeats what failed: the load of the definition, the publication, or the
     * write of the unsaved changes.
     * @returns {Promise<boolean>} True when the repeated operation succeeded.
     */
    async retry() {
        const p = this._p;
        if (p.phase === "error") {
            return this.reload();
        }
        if (p.status !== "error" && !(p.error && p.error.origin === "publish")) {
            return false;
        }
        if (p.error && p.error.origin === "publish") {
            return this.publish();
        }
        return this.save();
    }

    /**
     * Loads the definition the server holds and replaces what is on screen,
     * unsaved changes included. It is the controlled way out of a conflict, of a
     * failed load and of a discarded draft whose published form could not be loaded.
     * @returns {Promise<boolean>} True when a valid definition was loaded.
     */
    async reload() {
        if (this._destroyed || this._p.busy || (!this._service && !this._viewState)) {
            return false;
        }

        const firstLoad = !this._structure;

        this._cancelSave();
        this._patchPersistence({ busy: "reloading" });

        try {
            await this._settled();
            if (this._destroyed) {
                return false;
            }

            const loaded = await this._fetch();
            if (this._destroyed || loaded.aborted) {
                return false;
            }
            if (!loaded.ok) {
                if (!this._structure || this._p.phase === "error" || this._p.phase === "loading") {
                    this._fail(loaded.error);
                } else {
                    this._patchPersistence({ busy: null, error: loaded.error });
                }
                return false;
            }

            if (this.drafting) {
                await this._resume();
                if (this._destroyed) {
                    return false;
                }
            }

            // replacing what was on screen is the user's choice of the server's
            // version, so a kept copy no longer applies; a first successful load after
            // a failed one is an ordinary load and still offers it
            this._conflictOrigin = null;
            if (firstLoad) {
                this._adopt(loaded, "ready", { recover: true });
            } else {
                this._forgetRecovery();
                this._adopt(loaded, "ready");
            }
            return true;
        } finally {
            if (!this._destroyed && this._p.busy === "reloading") {
                this._patchPersistence({ busy: null });
            }
        }
    }

    /**
     * Resolves a version conflict the server reported. Nothing is overwritten on
     * its own: "reload" drops the local changes for the version the server holds,
     * "overwrite" writes the local version on top of it, which takes the user's
     * decision to discard the other change.
     * @param {"reload"|"overwrite"} choice - How the conflict is resolved.
     * @returns {Promise<boolean>} True when the chosen resolution went through.
     */
    async resolveConflict(choice) {
        const p = this._p;
        if (this._destroyed || p.status !== "conflict" || p.busy) {
            return false;
        }
        if (choice === "reload") {
            return this.reload();
        }
        if (choice !== "overwrite") {
            return false;
        }

        const origin = this._conflictOrigin;

        if (this.drafting && origin === "save") {
            // a draft save is written on top of the draft revision the server holds now
            let revision = p.error && typeof p.error.revision === "number" ? p.error.revision : null;
            if (revision === null) {
                await this._resume();
                if (this._destroyed) {
                    return false;
                }
                revision = this._p.draftRevision;
            }
            this._patchPersistence({ draftRevision: revision });
        } else {
            // the version written on top of is the one the server holds now, which is
            // asked for rather than guessed when the conflict answer did not name it
            let version = p.error && typeof p.error.version === "number" ? p.error.version : null;
            if (version === null) {
                const loaded = await this._fetch();
                if (this._destroyed || !loaded.ok) {
                    return false;
                }
                version = loaded.definition.version;
            }
            this.setState({ definition: Object.assign({}, this._structure, { version: version }) });
        }

        this._conflictOrigin = null;
        this._patchPersistence({ status: this._dirty ? "pending" : this._restingState(), error: null });

        return origin === "publish" ? this.publish() : this.save();
    }

    /**
     * Writes the definition kept after a discarded draft whose published form could
     * not be loaded back as a draft. The content is only restored on request, so
     * it is never saved again unnoticed.
     * @returns {Promise<boolean>} True when the draft was written.
     */
    async restore() {
        const p = this._p;
        if (this._destroyed || p.phase !== "stale" || p.busy || !this.drafting) {
            return false;
        }
        this._patchPersistence({ phase: "ready", revision: p.revision + 1, status: "pending", error: null });
        return this.save();
    }

    /**
     * Takes over the changes the browser kept from an earlier session that the
     * server had not confirmed, as a change of its own, and writes them. They are
     * only restored on request, because the form may have moved on since.
     * @returns {Promise<boolean>} True when the restored changes were written.
     */
    async recover() {
        const kept = webexpress.webui.LocalStorage.getJson(webexpress.webapp.RestFormEditorCtrl._recoveryKey(this._writeService()));
        if (!this._p.recovery || !this._canEdit()) {
            return false;
        }
        // another editor of the same form restored or dismissed the copy meanwhile
        if (!kept || !kept.definition) {
            this._patchPersistence({ recovery: null });
            return false;
        }

        const restored = this._normalize(kept.definition);
        this._patchPersistence({ recovery: null });
        this._commit((definition) => {
            const version = definition.version;
            for (const key of Object.keys(definition)) {
                delete definition[key];
            }
            Object.assign(definition, restored, { version: version });
            return true;
        });
        if (!restored.tabs.some(t => t.id === this._ui.activeTabId)) {
            this._patchUi({ activeTabId: restored.tabs[0].id, selectedId: null });
        }
        this.render();

        return this.save();
    }

    /**
     * Drops the changes the browser kept from an earlier session.
     */
    dismissRecovery() {
        this._forgetRecovery();
        this._patchPersistence({ recovery: null });
    }

    /**
     * Publishes the structure on screen: the data endpoint applies it and ends
     * the draft in its own transaction.
     *
     * Editing is locked while the publication runs. A queued draft save is dropped
     * rather than raced against the publication - it would otherwise land after it
     * and re-open the draft - and one already in flight is waited for, for the same
     * reason. The publication carries the structure itself, so nothing is lost by
     * that. Where nothing drafts, publishing is what every save already is, so
     * there is nothing to do.
     * @returns {Promise<boolean>} True when the endpoint accepted the structure.
     */
    async publish() {
        const p = this._p;
        if (this._destroyed || !this.drafting || !this._structure || p.busy || p.status === "conflict"
            || (p.phase !== "ready" && p.phase !== "create")) {
            return false;
        }

        this._cancelSave();
        this._patchPersistence({ busy: "publishing", status: "publishing" });

        let published = false;

        try {
            await this._settled();
            if (this._destroyed) {
                return false;
            }

            const revision = this._p.revision;
            const result = await this._service.update(webexpress.webapp.RestFormEditorCtrl._clone(this._structure));
            if (this._destroyed) {
                return false;
            }

            if (!result || !result.ok) {
                const error = this._writeError(result, "publish");
                if (error.kind === "conflict") {
                    this._conflictOrigin = "publish";
                }
                this._patchPersistence({ busy: null, status: error.kind === "conflict" ? "conflict" : "error", error: error });
                if (error.kind === "validation") {
                    this._dispatch(webexpress.webapp.Event.FORM_EDITOR_VALIDATION_FAILED_EVENT, (result && result.data) || { status: result ? result.status : 0 });
                }
                return false;
            }

            this._adoptVersion(result.data);
            this._wroteSinceAdopt = true;
            this._forgetRecovery();
            this._patchPersistence({
                busy: null,
                phase: "ready",
                savedRevision: Math.max(this._p.savedRevision, revision),
                draft: false,
                draftRevision: 0,
                updated: null,
                savedAt: Date.now(),
                status: "idle",
                error: null
            });
            published = true;
            this._dispatch(webexpress.webapp.Event.FORM_EDITOR_PUBLISHED_EVENT, {
                structure: this.getStructure(),
                response: result.data
            });
            return true;
        } finally {
            if (!this._destroyed) {
                if (this._p.busy === "publishing") {
                    this._patchPersistence({ busy: null, status: this._restingState() });
                }
                // the draft still stands after a failed publication, so a change that
                // was queued when publish was clicked goes to it after all
                if (!published && this._dirty) {
                    this._requestSave();
                }
            }
        }
    }

    /**
     * Drops the unpublished draft and returns the editor to the published form.
     *
     * The discard goes through here rather than through a link, because this is
     * what owns the endpoint: a pending save would otherwise land after the delete
     * and open the draft again. Editing and saving are stopped first, then the
     * draft is dropped, then the structure is re-loaded so the editor shows what
     * the forms in use see. The page is deliberately not reloaded - a control does
     * not get to navigate its host.
     *
     * A re-load that fails after the draft is gone does not count as success: the
     * former draft stays on screen for recovery, marked as stale and locked, because
     * the next autosave would otherwise silently re-create the draft just discarded.
     * @returns {Promise<boolean>} True when the draft is gone and the published structure was re-loaded.
     */
    async discard() {
        const p = this._p;
        if (this._destroyed || !this.drafting || p.busy || (p.phase !== "ready" && p.phase !== "create")) {
            return false;
        }

        const creating = p.phase === "create";

        this._cancelSave();
        this._patchPersistence({ busy: "discarding", status: "discarding" });

        try {
            await this._settled();
            if (this._destroyed) {
                return false;
            }

            const result = await this._draftService.remove();
            if (this._destroyed) {
                return false;
            }

            if (!result || !result.ok) {
                this._patchPersistence({ busy: null, status: this._restingState() });
                if (this._dirty) {
                    this._requestSave();
                }
                return false;
            }

            this._forgetRecovery();
            this._patchPersistence({ draft: false, draftRevision: 0, updated: null });

            // a form that is still being created has no published version to return to
            const loaded = creating
                ? { ok: true, definition: this._seed || this._defaultDefinition(), catalog: this._s.catalog }
                : await this._fetch();
            if (this._destroyed) {
                return false;
            }

            if (!loaded.ok) {
                this._patchPersistence({
                    busy: null,
                    phase: "stale",
                    status: "error",
                    error: {
                        kind: "stale",
                        origin: "discard",
                        status: loaded.error ? loaded.error.status : 0,
                        message: this._t("formeditor.error.stale"),
                        details: loaded.error && loaded.error.message ? [loaded.error.message] : []
                    }
                });
                this._dispatch(webexpress.webapp.Event.FORM_EDITOR_DRAFT_DISCARDED_EVENT, { reloaded: false });
                this.render();
                return false;
            }

            this._dispatch(webexpress.webapp.Event.FORM_EDITOR_DRAFT_DISCARDED_EVENT, { reloaded: true });
            this._adopt(loaded, creating ? "create" : "ready");
            return true;
        } finally {
            if (!this._destroyed && this._p.busy === "discarding") {
                this._patchPersistence({ busy: null, status: this._restingState() });
            }
        }
    }

    /**
     * Renders the editor.
     * Triggers a full re-render of header, body and footer. Used after configuration
     * changes that affect the whole UI.
     */
    render() {
        if (this._destroyed) {
            return;
        }
        this._lastEditable = this._canEdit();
        this._renderHeader();
        this._renderBody();
        this._renderFooter();
    }

    /**
     * Renders the editor again; a host that shows the editor after it was hidden
     * asks for this, and the state-based update of the base would only sync the
     * status line.
     */
    update() {
        this.render();
    }

    /**
     * Tears the editor down. Safe to call more than once.
     *
     * A teardown inside a running application does not drop unsaved changes: a
     * change that is queued, or that was made while a write was in flight, is
     * written once that write has returned, carrying the version it answered. The
     * outcome is no longer shown and raises no event, because the control is gone;
     * a change that cannot be saved - a conflict, a read-only or stale editor, a
     * publication or discard in progress - is reported on the console instead.
     */
    destroy() {
        if (this._destroyed) {
            return;
        }

        // the browser keeps what the server has not confirmed; the write that
        // confirms it removes the copy again, one that fails leaves it for the next load
        if (this._hasUnsavedChanges()) {
            this._keepRecovery();
        }

        const pending = this._pendingOnDestroy();

        this._destroyed = true;
        this._cancelSave();

        for (const binding of this._bindings) {
            binding.target.removeEventListener(binding.type, binding.handler);
        }
        this._bindings = [];

        this._detachViewState();
        this._releaseEdits(this._headerEdits);
        this._releaseEdits(this._bodyEdits);

        if (this._confirm) {
            this._confirm.destroy();
            this._confirm = null;
        }

        // the base detaches the data changes, aborts the queries of the own
        // services and stops rendering; a write is not abortable and survives it
        super.destroy();

        if (pending) {
            void this._drain(pending);
        }
    }

    /**
     * Applies a state patch unless the control is torn down, so a response that
     * arrives late cannot change anything.
     * @param {object|Function} patch - The patch.
     * @returns {object} The resulting state.
     */
    setState(patch) {
        if (this._destroyed) {
            return this._store.getState();
        }
        return super.setState(patch);
    }

    /**
     * Dispatches an event unless the control is torn down.
     * @param {string} type - Event type.
     * @param {object} detail - Payload.
     */
    _dispatch(type, detail) {
        if (this._destroyed) {
            return;
        }
        super._dispatch(type, detail);
    }

    /**
     * The designer is rendered imperatively: its inline editors must survive the
     * state changes a save brings, which a reconciled view tree would rebuild. A
     * template referenced through data-wx-template is not supported - it would
     * replace the whole designer - and is ignored.
     * @returns {undefined}
     */
    _viewTree() {
        return undefined;
    }

    /**
     * The editor holds the user's unsaved work, so a data change announced by the
     * server must not reload it; a conflict is detected on the next write instead.
     * @returns {boolean} Always false.
     */
    _reloadsOnDataChange() {
        return false;
    }

    /**
     * Follows every state change with the derived surface: the status line, the
     * actions and the notices; when the editability changed, the whole editor is
     * rendered again so no editing affordance is left on a locked definition.
     */
    onUpdate() {
        if (this._destroyed || !this._headerHost) {
            return;
        }
        if (this._lastEditable !== undefined && this._canEdit() !== this._lastEditable) {
            this.render();
            return;
        }
        this._syncActions();
    }

    // the three parts of the state

    get _s() { return this._store.getState(); }
    get _structure() { return this._s.definition; }
    get _ui() { return this._s.ui; }
    get _p() { return this._s.persistence; }
    get _dirty() { return this._p.revision > this._p.savedRevision; }

    /**
     * Patches the surface state.
     * @param {object} patch - The changed surface values.
     */
    _patchUi(patch) {
        this.setState({ ui: Object.assign({}, this._ui, patch) });
    }

    /**
     * Patches the persistence state and shows it at once, because it reports a
     * request that just started or ended rather than a gesture; a change of the
     * phase or of the save status is announced.
     * @param {object} patch - The changed persistence values.
     */
    _patchPersistence(patch) {
        if (this._destroyed) {
            return;
        }
        const before = this._p;
        this.setState({ persistence: Object.assign({}, before, patch) });
        this._store.flush();
        const after = this._p;
        if (after.status !== before.status || after.phase !== before.phase) {
            this._dispatch(webexpress.webapp.Event.FORM_EDITOR_STATE_EVENT, {
                state: after.status,
                phase: after.phase,
                error: after.error
            });
        }
    }

    /**
     * Builds the static skeleton (head, notice, body and foot containers). Tab bars
     * live inside the structure and preview panes, not at the editor root.
     */
    _buildSkeleton() {
        const root = this._element;
        root.textContent = "";

        this._headerHost = document.createElement("div");
        this._headerHost.className = "wx-form-editor-head";

        this._noticeHost = document.createElement("div");
        this._noticeHost.className = "wx-form-editor-notices";
        this._noticeHost.hidden = true;

        this._bodyHost = document.createElement("div");
        this._bodyHost.className = "wx-form-editor-body";

        this._footerHost = document.createElement("div");
        this._footerHost.className = "wx-form-editor-foot";

        root.appendChild(this._headerHost);
        root.appendChild(this._noticeHost);
        root.appendChild(this._bodyHost);
        root.appendChild(this._footerHost);
    }

    /**
     * Opens the editor on its definition: a new one where creating was asked for,
     * the resource slice inside a ViewState, a local one without any service, and
     * otherwise the answer of the data endpoint.
     * @returns {Promise<void>}
     */
    async _bootstrap() {
        if (this._destroyed) {
            return;
        }

        if (this._create) {
            if (this.drafting) {
                await this._resume();
                if (this._destroyed) {
                    return;
                }
            }
            this._adopt({ definition: this._seed || this._defaultDefinition() }, this._service || this._resource ? "create" : "offline", { recover: true });
            // the ViewState only hands over its service; a slice never replaces a new form
            if (this._resource) {
                this._attachToViewState();
            }
            return;
        }

        if (this._resource) {
            this.render();
            this._attachToViewState();
            return;
        }

        if (!this._service) {
            this._adopt({ definition: this._seed || this._defaultDefinition() }, "offline");
            return;
        }

        this._patchPersistence({ phase: "loading", error: null });
        this.render();

        const loaded = await this._fetch();
        if (this._destroyed || loaded.aborted) {
            return;
        }
        if (!loaded.ok) {
            this._fail(loaded.error);
            return;
        }

        if (this.drafting) {
            await this._resume();
            if (this._destroyed) {
                return;
            }
        }

        this._adopt(loaded, "ready", { recover: true });
    }

    /**
     * Asks the draft endpoint whether the editor is resuming an unpublished draft.
     *
     * Only the reserved keys of the answer are read: whether a draft exists, when
     * it was written and its revision, which every draft save presents. Which
     * structure the editor opens on is the data endpoint's decision, and it has
     * already been loaded; merging a second copy in here would make the control
     * the arbiter of something it deliberately is not.
     * @returns {Promise<void>} Resolves when the draft state reflects the answer.
     */
    async _resume() {
        this._resumed = true;

        const result = await this._draftService.load();

        if (this._destroyed || !result || !result.ok) {
            return;
        }

        const data = result.data || {};
        const revision = webexpress.webapp.RestFormEditorCtrl._revisionOf(data);

        this._patchPersistence({
            draft: data.draft === true,
            draftRevision: revision !== null ? revision : 0,
            updated: data.updated ? new Date(data.updated) : null
        });
    }

    /**
     * Loads the definition and the field catalog: through the ViewState where the
     * editor is bound to one, so the central slice follows, and from the data
     * service otherwise. What the endpoint answers is what the editor opens on -
     * the draft where one exists, the published form otherwise - and that decision
     * stays with the endpoint.
     * @returns {Promise<object>} { ok, definition, catalog, raw } or { ok: false, error, aborted }.
     */
    async _fetch() {
        let result = null;

        if (this._viewState) {
            result = await this._viewState.reload(this._resource);
        } else if (this._service) {
            result = await this._service.load();
        }

        if (!result) {
            return { ok: false, error: this._loadError({ status: 0, error: null }) };
        }
        if (result.error && result.error.kind === "abort") {
            return { ok: false, aborted: true };
        }
        if (!result.ok) {
            return { ok: false, error: this._loadError(result) };
        }

        const parsed = webexpress.webapp.RestFormEditorCtrl._parseResponse(result.data);
        if (!parsed) {
            return {
                ok: false,
                error: { kind: "invalid", origin: "load", status: result.status || 0, message: this._t("formeditor.error.load.invalid") }
            };
        }

        return Object.assign({ ok: true, raw: result.data }, parsed);
    }

    /**
     * Takes a valid definition over as the confirmed starting point: nothing on
     * screen is unsaved afterwards, the selection is reset and the load is announced.
     * @param {object} source - { definition, catalog?, raw? }.
     * @param {string} phase - The phase the definition comes with: ready, offline or create.
     * @param {object} [options] - recover: whether a copy an earlier session kept is looked for.
     */
    _adopt(source, phase, options = {}) {
        const recovery = options.recover ? this._findRecovery(source.definition) : null;
        const definition = this._normalize(source.definition);

        this._wroteSinceAdopt = false;
        this._pendingSlice = null;
        const active = definition.tabs.some(t => t.id === this._ui.activeTabId)
            ? this._ui.activeTabId
            : definition.tabs[0].id;

        this._adoptedRaw = source.raw || null;
        this.setState({
            definition: definition,
            catalog: Array.isArray(source.catalog) ? source.catalog : this._s.catalog
        });
        this._patchUi({ activeTabId: active, selectedId: null, editingId: null });
        this._patchPersistence({
            phase: phase,
            busy: null,
            savedRevision: this._p.revision,
            status: this._restingState(),
            error: null,
            recovery: recovery
        });

        this._dispatch(webexpress.webapp.Event.FORM_EDITOR_LOADED_EVENT, { structure: this.getStructure(), phase: phase });
        this.render();
    }

    /**
     * Records a failed load. Nothing is put in place of the definition that could
     * not be loaded, so there is nothing to edit and nothing an autosave could write.
     * @param {object} error - The classified load error.
     */
    _fail(error) {
        this._patchPersistence({ phase: "error", busy: null, error: error });
        this.render();
    }

    /**
     * Makes a definition editable: a first tab when the form has none, a children
     * list on every tab. It is a copy, so the answer of the endpoint stays untouched.
     * @param {object} definition - The definition.
     * @returns {object} The normalized copy.
     */
    _normalize(definition) {
        const next = webexpress.webapp.RestFormEditorCtrl._clone(definition);

        if (!Array.isArray(next.tabs) || next.tabs.length === 0) {
            next.tabs = [{
                id: webexpress.webapp.RestFormEditorCtrl._uid("t"),
                name: this._t("formeditor.tab.default.name"),
                children: []
            }];
        }

        for (const tab of next.tabs) {
            tab.id = tab.id || webexpress.webapp.RestFormEditorCtrl._uid("t");
            tab.children = Array.isArray(tab.children) ? tab.children : [];
        }

        return next;
    }

    /**
     * Returns the definition a new or an offline form starts with.
     * @returns {object}
     */
    _defaultDefinition() {
        return {
            formName: this._t("formeditor.form.default.name"),
            formDescription: "",
            className: "",
            version: 1,
            tabs: []
        };
    }

    /**
     * Attaches the editor to the enclosing ViewState: the ViewState owns the load
     * of the resource and its service, which the editor then also writes through.
     */
    _attachToViewState() {
        const viewStateId = webexpress.webapp.RestFormEditorCtrl._attribute(this._element, "data-wx-viewstate", "wxViewstate") || null;

        this._cancelViewState = webexpress.webapp.ViewStateRegistry.whenReady(this._element, viewStateId, (viewState) => {
            if (this._destroyed) {
                return;
            }

            this._viewState = viewState;

            const service = viewState.serviceForResource(this._resource);
            if (service) {
                this._service = service;
            }

            this._unwatch = viewState.watch((state) => viewState.slice(this._resource, state), (slice) => { void this._applySlice(slice); });
            (this._element._wxCleanup = this._element._wxCleanup || []).push(() => this._detachViewState());

            // the drafting mode depends on the service the ViewState just handed over
            this.render();

            if (this._dirty) {
                this._requestSave();
            }

            void this._applySlice(viewState.slice(this._resource));
        });
    }

    /**
     * Releases the ViewState subscription and a pending ViewState resolution.
     */
    _detachViewState() {
        if (this._unwatch) {
            this._unwatch();
            this._unwatch = null;
        }
        if (this._cancelViewState) {
            this._cancelViewState();
            this._cancelViewState = null;
        }
    }

    /**
     * Renders a resource slice the ViewState loaded centrally. A slice never
     * replaces unsaved changes, a write in flight, a conflict waiting for the user,
     * or a definition the editor did not load (offline, create, stale). A slice
     * arriving at such a moment is held back and looked at again once everything
     * is confirmed.
     *
     * Only a slice that is newer than what the editor holds is taken over: one of
     * an older version is the answer to a query that was sent before the editor's
     * own write. Without a newer version - a draft, whose saves do not move it, or
     * a store that does not version - a slice is taken over only as long as the
     * editor has not written, because after a write it cannot be told apart from
     * an answer that predates it.
     * @param {object} slice - The resource slice { data, loading, error }.
     * @returns {Promise<void>}
     */
    async _applySlice(slice) {
        slice = slice || {};
        const p = this._p;

        if (this._destroyed || p.phase === "create" || p.phase === "offline" || p.phase === "stale") {
            return;
        }

        if (p.busy || p.status === "conflict" || this._dirty || this._flushing) {
            if (slice.data && !slice.loading && !slice.error) {
                this._pendingSlice = slice;
            }
            return;
        }

        if (slice.loading) {
            if (!this._structure && p.phase !== "loading") {
                this._patchPersistence({ phase: "loading", error: null });
                this._renderBody();
            }
            return;
        }

        if (slice.error) {
            // a refresh that failed leaves a loaded definition standing
            if (!this._structure) {
                this._fail(this._loadError({ status: slice.error.status || 0, error: slice.error }));
            }
            return;
        }

        if (!slice.data || slice.data === this._adoptedRaw) {
            return;
        }

        const parsed = webexpress.webapp.RestFormEditorCtrl._parseResponse(slice.data);
        if (!parsed) {
            if (!this._structure) {
                this._fail({ kind: "invalid", origin: "load", status: 0, message: this._t("formeditor.error.load.invalid") });
            }
            return;
        }

        // an unchanged definition is not taken over again, which would reset the selection
        const ctrl = webexpress.webapp.RestFormEditorCtrl;
        if (this._structure && (!this._isNewer(parsed.definition)
            || ctrl._canonical(parsed.definition) === ctrl._canonical(this._structure))) {
            this._adoptedRaw = slice.data;
            return;
        }

        if (this.drafting && !this._resumed) {
            await this._resume();
            if (this._destroyed || this._dirty || this._p.busy) {
                return;
            }
        }

        this._adopt(Object.assign({ raw: slice.data }, parsed), "ready", { recover: true });
    }

    /**
     * Tells whether a definition the server answered may replace the one on screen
     * (see _applySlice).
     * @param {object} definition - The definition the server answered.
     * @returns {boolean}
     */
    _isNewer(definition) {
        const current = this._structure.version;
        const incoming = definition.version;

        if (typeof current === "number" && typeof incoming === "number" && incoming !== current) {
            return incoming > current;
        }
        return !this._wroteSinceAdopt;
    }

    /**
     * Tells whether the definition on screen may be changed.
     * @returns {boolean}
     */
    _canEdit() {
        const p = this._p;
        return !this._destroyed && !this._readonly && !!this._structure && !p.busy
            && webexpress.webapp.RestFormEditorCtrl.EDITABLE_PHASES.includes(p.phase);
    }

    /**
     * Tells whether the definition on screen may be written. A conflict holds every
     * write until the user decided how to resolve it.
     * @returns {boolean}
     */
    _canSave() {
        const p = this._p;
        return !this._destroyed && !this._readonly && !!this._writeService() && !!this._structure && !p.busy
            && (p.phase === "ready" || p.phase === "create") && p.status !== "conflict";
    }

    /**
     * Applies a change to the definition. It is the one path every change takes:
     * it refuses while the definition may not be changed, applies the change to a
     * copy so that a write in flight keeps the revision it took, counts the
     * revision and queues the write.
     * @param {Function} mutate - Changes the copy it receives; returns false when nothing changed.
     * @returns {boolean} True when the definition was changed.
     */
    _commit(mutate) {
        if (!this._canEdit()) {
            return false;
        }

        const next = webexpress.webapp.RestFormEditorCtrl._clone(this._structure);
        if (mutate(next) === false) {
            return false;
        }

        const p = this._p;
        const conflict = p.status === "conflict";

        this.setState({ definition: next });
        this._patchPersistence({
            revision: p.revision + 1,
            status: conflict ? p.status : (this._writeService() ? "pending" : p.status),
            error: conflict ? p.error : null
        });
        this._requestSave();
        return true;
    }

    /**
     * Returns the service the regular writes go to: the draft where the editor
     * drafts, the form itself otherwise.
     * @returns {object|null}
     */
    _writeService() {
        if (this._readonly || !this._service) {
            return null;
        }
        return this.drafting ? this._draftService : this._service;
    }

    /**
     * Tells whether leaving would lose something: changes the server has not
     * confirmed, or the content of a discarded draft that is no longer stored.
     * @returns {boolean}
     */
    _hasUnsavedChanges() {
        if (!this._writeService()) {
            return false;
        }
        return this._dirty || this._p.phase === "stale";
    }

    /**
     * Returns the state the surface rests in when nothing is being written:
     * on an unpublished draft, or on the published form.
     * @returns {string}
     */
    _restingState() {
        const p = this._p;
        return p.draft ? (p.updated ? "saved" : "draft") : "idle";
    }

    /**
     * Queues a debounced write of the unsaved changes.
     */
    _requestSave() {
        if (!this._canSave()) {
            return;
        }
        this._cancelSave();
        this._saveTimer = setTimeout(() => {
            this._saveTimer = null;
            void this._flush();
        }, webexpress.webapp.RestFormEditorCtrl.SAVE_DEBOUNCE);
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
     * Writes the unsaved changes. There is one write loop per editor; a call while
     * it runs joins it, and a request for a write that outlives the document is
     * taken over by the next write it sends.
     * @param {object} [options] - keepalive: whether the next write has to outlive the document.
     * @returns {Promise<void>} Resolves when nothing is left to write or a write failed.
     */
    _flush(options = {}) {
        if (options.keepalive) {
            this._keepalive = true;
        }
        if (!this._flushing) {
            this._flushing = this._drainWrites().finally(() => {
                this._flushing = null;
                // a request to leave that arrived while the loop was winding down
                if (this._keepalive && this._dirty && this._canSave()) {
                    void this._flush();
                    return;
                }
                // a ViewState slice held back while the loop ran may be taken over
                // now, if it is newer than what the server confirmed
                const pendingSlice = this._pendingSlice;
                this._pendingSlice = null;
                if (pendingSlice && !this._destroyed) {
                    void this._applySlice(pendingSlice);
                }
            });
        }
        return this._flushing;
    }

    /**
     * Sends one write after the other until the server confirmed the latest
     * revision. Each write carries a copy taken at its revision, so a change made
     * while the request is open belongs to the next one, which then carries all of
     * them together.
     * @returns {Promise<void>}
     */
    async _drainWrites() {
        while (this._dirty && this._canSave()) {
            this._cancelSave();

            const revision = this._p.revision;
            const snapshot = webexpress.webapp.RestFormEditorCtrl._clone(this._structure);
            const service = this._writeService();
            const keepalive = this._keepalive;
            this._keepalive = false;

            this._patchPersistence({ status: "saving" });

            const promise = this._send(service, this._writeBody(snapshot), keepalive);
            this._writing = { revision: revision, promise: promise };
            const result = await promise;
            this._writing = null;

            // a teardown took the rest over, see destroy
            if (this._destroyed || !this._settleWrite(revision, snapshot, result)) {
                return;
            }
        }
    }

    /**
     * Sends a write through the service layer. A write that has to outlive the
     * document goes out as a keepalive request; it still answers while the page
     * lives, and only that answer counts as a save.
     * @param {object} service - The service written to.
     * @param {object} body - The snapshot to write.
     * @param {boolean} keepalive - Whether the request has to outlive the document.
     * @returns {Promise<object>} The normalised result.
     */
    _send(service, body, keepalive) {
        const json = keepalive ? JSON.stringify(body) : null;

        // a body over the keepalive budget would be refused before it is sent, so it
        // goes out as an ordinary request; the copy the browser kept covers the rest
        if (!keepalive || webexpress.webapp.RestFormEditorCtrl._byteLength(json) > webexpress.webapp.RestFormEditorCtrl.KEEPALIVE_LIMIT) {
            return service.update(body);
        }
        return service.request(service.baseUri, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: json,
            keepalive: true
        });
    }

    /**
     * Takes the answer to a write. A success confirms the revision the write
     * carried and marks the editor saved only when no newer change was made; a
     * failure keeps the changes unsaved and offers the way out its kind allows.
     * @param {number} revision - The revision the write carried.
     * @param {object} snapshot - The definition the write carried.
     * @param {object} result - The normalised result.
     * @returns {boolean} True when the write succeeded.
     */
    _settleWrite(revision, snapshot, result) {
        const p = this._p;

        if (result && result.ok) {
            this._adoptVersion(result.data);
            this._wroteSinceAdopt = true;

            const patch = {
                savedRevision: Math.max(p.savedRevision, revision),
                status: revision >= this._p.revision ? "saved" : "pending",
                savedAt: Date.now(),
                // a refused publication is still unresolved after the draft was written
                error: p.error && p.error.origin === "publish" ? p.error : null
            };

            if (this.drafting) {
                const draftRevision = webexpress.webapp.RestFormEditorCtrl._revisionOf(result.data);
                patch.draft = true;
                patch.updated = new Date();
                if (draftRevision !== null) {
                    patch.draftRevision = draftRevision;
                }
            } else if (p.phase === "create") {
                patch.phase = "ready";
            }

            this._patchPersistence(patch);

            if (this.drafting) {
                this._dispatch(webexpress.webapp.Event.FORM_EDITOR_DRAFT_SAVED_EVENT, {
                    structure: snapshot,
                    updated: patch.updated
                });
            } else {
                this._dispatch(webexpress.webapp.Event.FORM_EDITOR_SAVED_EVENT, result.data);
            }

            // everything is confirmed, so a kept copy is obsolete
            if (!this._dirty) {
                this._forgetRecovery();
            }
            return true;
        }

        const error = this._writeError(result, "save");
        if (error.kind === "conflict") {
            this._conflictOrigin = "save";
        }
        this._patchPersistence({ status: error.kind === "conflict" ? "conflict" : "error", error: error });
        if (error.kind === "validation") {
            this._dispatch(webexpress.webapp.Event.FORM_EDITOR_VALIDATION_FAILED_EVENT, (result && result.data) || { status: result ? result.status : 0 });
        }
        return false;
    }

    /**
     * Resolves once the write loop has come to rest.
     * @returns {Promise<void>}
     */
    _settled() {
        return this._flushing ? this._flushing.catch(() => { }) : Promise.resolve();
    }

    /**
     * Collects what a teardown still has to write: the definition on screen when
     * it holds a change that neither the server confirmed nor a write in flight carries.
     * @returns {object|null} { service, snapshot, writing } or null.
     */
    _pendingOnDestroy() {
        if (!this._canSave()) {
            if (this._hasUnsavedChanges() && this._p.busy !== "publishing") {
                console.warn("form editor torn down with changes that cannot be saved; the browser keeps them for the next load", { phase: this._p.phase, state: this._p.status });
            }
            return null;
        }

        const covered = this._writing ? this._writing.revision : this._p.savedRevision;
        if (this._p.revision <= covered) {
            return null;
        }

        return {
            service: this._writeService(),
            body: this._writeBody(webexpress.webapp.RestFormEditorCtrl._clone(this._structure)),
            drafting: this.drafting,
            writing: this._writing ? this._writing.promise : null
        };
    }

    /**
     * Writes what a teardown left behind, after the write in flight, with the
     * version and the draft revision that write answered. Once the server
     * confirmed it, the copy the browser kept is dropped; a failure leaves the
     * copy for the next load, where it is offered for restoring.
     * @param {object} pending - { service, body, drafting, writing }.
     * @returns {Promise<void>}
     */
    async _drain(pending) {
        const ctrl = webexpress.webapp.RestFormEditorCtrl;
        let body = pending.body;

        if (pending.writing) {
            const previous = await pending.writing;
            const data = previous && previous.ok ? previous.data : null;
            const version = ctrl._versionOf(data);
            const revision = ctrl._revisionOf(data);
            if (version !== null) {
                body = Object.assign({}, body, { version: version });
            }
            if (pending.drafting && revision !== null) {
                body = Object.assign({}, body, { draftRevision: revision });
            }
        }

        const result = await this._send(pending.service, body, false);
        if (result && result.ok) {
            webexpress.webui.LocalStorage.removeItem(ctrl._recoveryKey(pending.service));
        } else {
            console.warn("form editor could not save the changes pending at its teardown; the browser keeps them for the next load", result ? result.error : null);
        }
    }

    /**
     * Returns the body of a regular write: the snapshot, and where the editor
     * drafts the draft revision it was edited on top of, which a draft endpoint
     * checks so two editors drafting one form cannot overwrite each other.
     * @param {object} snapshot - The definition the write carries.
     * @returns {object} The body.
     */
    _writeBody(snapshot) {
        return this.drafting ? Object.assign({}, snapshot, { draftRevision: this._p.draftRevision || 0 }) : snapshot;
    }

    /**
     * Keeps the definition on screen in the browser, so changes the server has
     * not confirmed when the editor goes away can be restored on the next load.
     */
    _keepRecovery() {
        const key = webexpress.webapp.RestFormEditorCtrl._recoveryKey(this._writeService());
        if (!key || !this._structure) {
            return;
        }
        webexpress.webui.LocalStorage.setJson(key, {
            definition: webexpress.webapp.RestFormEditorCtrl._clone(this._structure),
            version: this._structure.version,
            savedAt: Date.now()
        });
    }

    /**
     * Drops the copy the browser kept for the current write target.
     */
    _forgetRecovery() {
        webexpress.webui.LocalStorage.removeItem(webexpress.webapp.RestFormEditorCtrl._recoveryKey(this._writeService()));
    }

    /**
     * Looks for a copy an earlier session kept and compares it with the definition
     * the server answered. A copy whose content the server already holds was saved
     * after all and is dropped; any other one is offered for restoring.
     * @param {object} definition - The definition the server answered.
     * @returns {object|null} { savedAt, changedSince } or null.
     */
    _findRecovery(definition) {
        const ctrl = webexpress.webapp.RestFormEditorCtrl;
        const key = ctrl._recoveryKey(this._writeService());
        const kept = key ? webexpress.webui.LocalStorage.getJson(key) : null;

        if (!kept || !kept.definition || typeof kept.definition !== "object") {
            return null;
        }
        if (ctrl._canonical(kept.definition) === ctrl._canonical(definition)) {
            webexpress.webui.LocalStorage.removeItem(key);
            return null;
        }

        return {
            savedAt: kept.savedAt || null,
            changedSince: typeof kept.version === "number" && typeof definition.version === "number" && kept.version !== definition.version
        };
    }

    /**
     * Takes the version the data endpoint answered with, which is what the header
     * shows next to the form name and what the next write presents. It is a token
     * of the server, not a change of the user, so the revision stays.
     * @param {object} body - The response body.
     */
    _adoptVersion(body) {
        const version = webexpress.webapp.RestFormEditorCtrl._versionOf(body);
        if (version !== null && this._structure) {
            this.setState({ definition: Object.assign({}, this._structure, { version: version }) });
        }
    }

    /**
     * Classifies a failed load by what the user can do about it.
     * @param {object} result - The normalised result.
     * @returns {object} { kind, origin, status, message }.
     */
    _loadError(result) {
        const status = (result && result.status) || 0;
        const kind = result && result.error ? result.error.kind : null;

        if (kind === "network" || (status === 0 && kind !== "http")) {
            return { kind: "network", origin: "load", status: status, message: this._t("formeditor.error.load.network") };
        }
        if (status === 404) {
            return { kind: "http", origin: "load", status: status, message: this._t("formeditor.error.load.notfound") };
        }
        return { kind: "http", origin: "load", status: status, message: this._t("formeditor.error.load", status) };
    }

    /**
     * Classifies a failed write by the service result: a version conflict, a
     * rejected definition (with the messages assigned to the elements they name,
     * where they name one), an unreachable server, or a technical failure.
     * @param {object} result - The normalised result.
     * @param {string} origin - save or publish.
     * @returns {object} { kind, origin, status, message, details, items, version }.
     */
    _writeError(result, origin) {
        const status = (result && result.status) || 0;
        const kind = result && result.error ? result.error.kind : null;
        const data = result ? result.data : null;

        if (status === 409 || status === 412) {
            return {
                kind: "conflict",
                origin: origin,
                status: status,
                message: this._t("formeditor.error.conflict"),
                details: [],
                items: [],
                version: data && typeof data.version === "number" ? data.version : null,
                revision: data && typeof data.revision === "number" ? data.revision : null
            };
        }

        if (status === 400 || status === 422) {
            // the rest form reads the same answers; its classification is reused
            const model = webexpress.webapp.restFormModel;
            const classified = model && typeof model.classifyResponse === "function"
                ? model.classifyResponse(false, 400, data)
                : { errors: [], message: data && data.message };
            const items = (classified.errors || []).map((e) => ({
                nodeId: this._resolveNodeId(e.field),
                message: String(e.message)
            }));
            let details = items.map((item) => item.message);
            if (details.length === 0 && data && Array.isArray(data.validation)) {
                details = data.validation.map(String);
            }
            if (details.length === 0 && classified.message) {
                details = [String(classified.message)];
            }
            return { kind: "validation", origin: origin, status: status, message: this._t("formeditor.error.validation"), details: details, items: items };
        }

        if (kind === "network" || status === 0) {
            return { kind: "network", origin: origin, status: status, message: this._t("formeditor.error.network"), details: [], items: [] };
        }

        return { kind: "server", origin: origin, status: status, message: this._t("formeditor.error.server", status), details: [], items: [] };
    }

    /**
     * Finds the element a validation message names, by its id first and by its
     * label otherwise.
     * @param {*} field - What the server named.
     * @returns {string|null} The id of the node or tab, or null.
     */
    _resolveNodeId(field) {
        if (field === null || field === undefined || !this._structure) {
            return null;
        }
        const key = String(field);
        const lower = key.toLowerCase();
        const tabs = this._structure.tabs || [];

        for (const tab of tabs) {
            if (tab.id === key) {
                return tab.id;
            }
            const hit = this._findById(tab.children, key);
            if (hit) {
                return hit.id;
            }
        }
        for (const tab of tabs) {
            const hit = this._findWhere(tab.children, (n) => String(n.label || "").toLowerCase() === lower);
            if (hit) {
                return hit.id;
            }
        }
        return null;
    }

    /**
     * Writes the unsaved changes as the page is hidden or goes away, through the
     * same write loop as every other write, so a keepalive request can never
     * overtake a write in flight: while one is open the request to leave is
     * handed to the write that follows it. A navigation cannot be delayed, so the
     * user is asked before leaving with something unsaved.
     */
    _bindLeave() {
        const leave = () => {
            if (this._hasUnsavedChanges()) {
                // what the server has not confirmed is kept in the browser first: a
                // write that is still open, or the keepalive after it, may not land
                this._keepRecovery();
                void this._flush({ keepalive: true });
            }
        };

        this._listen(window, "pagehide", leave);
        this._listen(document, "visibilitychange", () => {
            if (document.visibilityState === "hidden") {
                leave();
            }
        });
        this._listen(window, "beforeunload", (e) => {
            if (!this._hasUnsavedChanges()) {
                return undefined;
            }
            leave();
            e.preventDefault();
            e.returnValue = "";
            return "";
        });
    }

    /**
     * Renders the header (form name + description + version + preview toggle,
     * and the publish button while the editor drafts).
     *
     * Form name and description are wired up as SmartEditCtrl inline editors
     * while the definition may be changed; each inline save runs through the
     * common change path.
     */
    _renderHeader() {
        if (this._destroyed) {
            return;
        }
        this._releaseEdits(this._headerEdits);
        this._headerHost.textContent = "";

        const title = document.createElement("div");
        title.className = "wx-form-editor-title";

        const titleMain = document.createElement("div");
        titleMain.className = "wx-form-editor-title-main";

        titleMain.appendChild(this._renderNameEditor());

        this._versionElement = document.createElement("span");
        this._versionElement.className = "wx-form-editor-version";
        this._versionElement.textContent = this._versionText();
        titleMain.appendChild(this._versionElement);

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
     * Returns the version label of the header.
     * @returns {string}
     */
    _versionText() {
        return this._structure ? "v" + (this._structure.version || 1) : "";
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

        if (!this._canEdit()) {
            const span = document.createElement("span");
            span.textContent = value || (this._structure ? this._t("formeditor.form.fallback.name") : "");
            wrap.appendChild(span);
            return wrap;
        }

        const input = document.createElement("input");
        input.type = "text";
        input.className = "form-control form-control-sm wx-form-editor-name-input";
        input.value = value;
        input.placeholder = this._t("formeditor.form.name.placeholder");
        wrap.appendChild(input);

        this._smartEdit(wrap, this._headerEdits, (val) => this._applyFormName(val));
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

        if (!this._canEdit()) {
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

        this._smartEdit(wrap, this._headerEdits, (val) => this._applyFormDescription(val));
        return wrap;
    }

    /**
     * Applies a new form name and refreshes the preview that mirrors it.
     * @param {string} value
     */
    _applyFormName(value) {
        const next = (value || "").trim();
        const changed = this._commit((definition) => {
            if (next === (definition.formName || "")) {
                return false;
            }
            definition.formName = next;
            return true;
        });
        if (changed) {
            // the inline editor is still finishing its own update of the header
            this._later(() => this._renderBody());
        }
    }

    /**
     * Applies a new form description and refreshes the preview that mirrors it.
     * @param {string} value
     */
    _applyFormDescription(value) {
        const next = value || "";
        const changed = this._commit((definition) => {
            if (next === (definition.formDescription || "")) {
                return false;
            }
            definition.formDescription = next;
            return true;
        });
        if (changed) {
            this._later(() => this._renderBody());
        }
    }

    /**
     * Applies a renamed tab and refreshes the views that depend on tab names
     * (structure heading, both tab bars, preview sub block).
     * @param {string} tabId
     * @param {string} value
     */
    _applyTabName(tabId, value) {
        const next = (value || "").trim();
        const changed = this._commit((definition) => {
            const tab = definition.tabs.find(t => t.id === tabId);
            if (!tab || !next || next === tab.name) {
                return false;
            }
            tab.name = next;
            return true;
        });
        if (!changed) {
            return;
        }
        this._dispatch(webexpress.webapp.Event.FORM_EDITOR_TAB_RENAMED_EVENT, {
            tabId: tabId,
            name: next
        });
        this._later(() => this._renderBody());
    }

    /**
     * Renders the preview toggle.
     * @returns {HTMLElement}
     */
    _renderPreviewToggle() {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "wx-form-editor-preview-toggle" + (this._ui.preview ? " active" : "");
        btn.textContent = this._ui.preview
            ? this._t("formeditor.preview.toggle.hide")
            : this._t("formeditor.preview.toggle.show");
        btn.addEventListener("click", () => { this.preview = !this._ui.preview; });
        return btn;
    }

    /**
     * Renders a tab bar for a single pane.
     *
     * The structure pane sets allowEdit=true so the bar always renders (with
     * "+ Add tab" and double-click rename) while the definition may be changed.
     * Read-only / preview panes set allowEdit=false; the bar is then suppressed
     * when there is at most one tab, since there is nothing to switch between.
     *
     * @param {object} opts
     * @param {boolean} opts.allowEdit - Whether the bar may add / rename tabs.
     * @returns {HTMLElement|null}
     */
    _renderPaneTabs(opts) {
        const allowEdit = this._canEdit() && !!(opts && opts.allowEdit);
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
        tabEl.className = "wx-form-editor-tab" + (tab.id === this._ui.activeTabId ? " active" : "");
        tabEl.setAttribute("data-tab-id", tab.id);

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
            if (this._ui.activeTabId === tab.id) {
                return;
            }
            e.stopPropagation();
            this._patchUi({ activeTabId: tab.id, selectedId: null });
            this._renderBody();
        });
        if (allowEdit) {
            tabEl.addEventListener("keydown", (e) => {
                if ((e.key === "Enter" || e.key === " ") && e.target === tabEl) {
                    e.preventDefault();
                    if (this._ui.activeTabId !== tab.id) {
                        this._patchUi({ activeTabId: tab.id, selectedId: null });
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
        const isActive = tab.id === this._ui.activeTabId;

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

        this._smartEdit(wrap, this._bodyEdits, (val) => this._applyTabName(tab.id, val));
        return wrap;
    }

    /**
     * Renders the body (structure on the left, optional preview on the right).
     *
     * When the preview is visible the two panes are wrapped in a SplitCtrl so
     * the user can resize the divider; the split keeps a stable id, so the
     * localStorage-backed size persists across re-renders. When the preview is
     * hidden the structure pane fills the available space directly. Without a
     * definition the body says why: it is loading, or the load failed.
     */
    _renderBody() {
        if (this._destroyed) {
            return;
        }
        this._releaseEdits(this._bodyEdits);

        this._bodyHost.className = "wx-form-editor-body wx-form-editor-body-pane";
        if (!this._ui.preview) {
            this._bodyHost.classList.add("wx-form-editor-body--no-preview");
        }
        this._bodyHost.textContent = "";

        if (!this._structure) {
            this._bodyHost.appendChild(this._renderPlaceholder());
            return;
        }

        const tab = this._getActiveTab();
        if (!tab) {
            return;
        }
        if (this._ui.preview) {
            this._bodyHost.appendChild(this._renderSplitContent(tab));
        } else {
            this._bodyHost.appendChild(this._renderStructurePanel(tab));
        }
        this._syncValidation();
    }

    /**
     * Renders what the body shows without a definition: the loading mark, or the
     * reason the load failed with the way to try again. It offers nothing to edit.
     * @returns {HTMLElement}
     */
    _renderPlaceholder() {
        const p = this._p;
        const box = document.createElement("div");

        if (p.phase !== "error") {
            box.className = "wx-form-editor-loading";
            box.setAttribute("role", "status");
            box.textContent = this._t("formeditor.load.loading");
            return box;
        }

        box.className = "wx-form-editor-load-error";
        box.setAttribute("role", "alert");

        const message = document.createElement("span");
        message.className = "wx-form-editor-load-error-text";
        message.textContent = (p.error && p.error.message) || this._t("formeditor.error.load", 0);
        box.appendChild(message);

        if (this._service || this._viewState) {
            const retry = document.createElement("button");
            retry.type = "button";
            retry.className = "wx-form-editor-retry";
            retry.textContent = this._t("formeditor.action.retry");
            retry.addEventListener("click", () => { void this.reload(); });
            box.appendChild(retry);
        }
        return box;
    }

    /**
     * Builds the resizable split host that pairs structure (left / side pane)
     * and preview (right / main pane).
     *
     * The host is tagged with `wx-webui-split` so the framework's controller
     * registry auto-instantiates `webexpress.webui.SplitCtrl` once the node
     * is appended to the DOM. The host id stays stable across re-renders so
     * the localStorage-backed splitter size is preserved; an editor without an
     * id gets one of its own, so two editors on a page never share a split.
     * @param {object} tab
     * @returns {HTMLElement}
     */
    _renderSplitContent(tab) {
        if (!this._splitId) {
            this._splitId = (this._element.id ? this._element.id : this._instanceId) + "-split";
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
        if (this._destroyed) {
            return;
        }
        this._footerHost.textContent = "";

        const hint = document.createElement("span");
        hint.className = "wx-form-editor-foot-hint";
        hint.textContent = this._t("formeditor.footer.hint");
        this._footerHost.appendChild(hint);

        this._stateElement = document.createElement("span");
        this._stateElement.className = "wx-form-editor-foot-status";
        this._stateElement.setAttribute("role", "status");
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
        if (!this._p.draft || this._p.busy) {
            return;
        }

        this._confirm = this._confirm || new webexpress.webui.ModalConfirm();
        const accepted = this._confirm.confirmation(
            "webexpress.webapp:formeditor.discard.title",
            this._t("formeditor.discard.message", (this._structure && this._structure.formName) || this._t("formeditor.form.fallback.name")),
            // a draft that is gone although the published form did not follow is no
            // failure of the discard; the notice of the editor explains what is left
            async () => (await this.discard()) || this._p.phase === "stale",
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
     * Writes the derived surface - the status line, the actions it enables, the
     * notices and the validation marks - without rebuilding either bar: the header
     * carries the inline name editors, and a rebuild would tear one down mid-edit.
     *
     * The state is one attribute rather than a set of classes, so the stylesheet
     * selects on a value and this method swaps one instead of juggling a set.
     */
    _syncActions() {
        if (this._destroyed) {
            return;
        }

        const p = this._p;
        const settled = p.phase === "ready" || p.phase === "create";

        this._element.classList.toggle("wx-form-editor--locked", !this._canEdit());
        if (p.busy || p.phase === "loading") {
            this._element.setAttribute("aria-busy", "true");
        } else {
            this._element.removeAttribute("aria-busy");
        }

        if (this._stateElement) {
            this._stateElement.setAttribute("data-wx-state", p.status);
            this._stateElement.setAttribute("data-wx-phase", p.phase);
            this._stateElement.textContent = this._stateText();
        }

        if (this._publishButton) {
            this._publishButton.disabled = !!p.busy || !settled || p.status === "conflict" || !(p.draft || this._dirty);
        }

        if (this._discardButton) {
            this._discardButton.disabled = !!p.busy || !settled;
            this._discardButton.hidden = !p.draft;
        }

        if (this._versionElement) {
            this._versionElement.textContent = this._versionText();
        }

        this._syncNotice();
        this._syncValidation();
    }

    /**
     * Returns the text of the footer status for the current phase and state, with
     * the {0} placeholder filled by the local time of the last write.
     * @returns {string}
     */
    _stateText() {
        const p = this._p;

        if (p.phase === "loading") {
            return this._t("formeditor.state.loading");
        }
        if (p.phase === "error") {
            return this._t("formeditor.state.failed");
        }
        if (p.phase === "offline") {
            return this._t("formeditor.footer.offline");
        }
        if (this._readonly) {
            return this._t("formeditor.state.readonly");
        }
        if (p.phase === "stale") {
            return this._t("formeditor.state.stale");
        }
        if (p.status === "conflict") {
            return this._t("formeditor.state.conflict");
        }

        const format = (time) => (time ? new Date(time) : new Date())
            .toLocaleTimeString(webexpress.webui.I18N.language, { hour: "2-digit", minute: "2-digit" });

        if (this.drafting) {
            return this._t("formeditor.state." + p.status, format(p.updated));
        }
        if (p.status === "idle") {
            return this._t("formeditor.footer.autosave");
        }
        return this._t("formeditor.state.direct." + p.status, format(p.savedAt));
    }

    /**
     * Describes the notice the editor owes the user, if any: a discarded draft
     * that is shown but no longer stored, a conflict, or a failed write.
     * @returns {object|null} { kind, message, details, actions }.
     */
    _describeNotice() {
        const p = this._p;

        if (p.phase === "stale") {
            const details = p.error && p.error.kind !== "stale" ? [p.error.message] : ((p.error && p.error.details) || []);
            return {
                kind: "stale",
                message: this._t("formeditor.error.stale"),
                details: details,
                actions: this.drafting ? ["reload", "restore"] : ["reload"]
            };
        }

        if (p.phase === "error" || p.phase === "loading") {
            return null;
        }

        if (p.error && p.status === "conflict") {
            return {
                kind: "conflict",
                message: p.error.kind === "conflict" ? p.error.message : this._t("formeditor.error.conflict"),
                details: p.error.kind === "conflict" ? [] : [p.error.message],
                actions: ["discard-local", "overwrite"]
            };
        }

        if (p.error) {
            return {
                kind: p.error.kind,
                message: p.error.message,
                details: p.error.details || [],
                actions: p.error.origin === "load" ? ["reload"] : ["retry"]
            };
        }

        if (p.recovery) {
            const time = p.recovery.savedAt
                ? new Date(p.recovery.savedAt).toLocaleString(webexpress.webui.I18N.language, { dateStyle: "short", timeStyle: "short" })
                : "";
            return {
                kind: "recovery",
                message: this._t("formeditor.recovery.found", time)
                    + (p.recovery.changedSince ? " " + this._t("formeditor.recovery.changed") : ""),
                details: [],
                actions: this._canEdit() ? ["recover", "dismiss-recovery"] : ["dismiss-recovery"]
            };
        }

        return null;
    }

    /**
     * Shows the notice of the current state above the body, rebuilt only when it
     * changed so a status update does not take the focus off its buttons.
     */
    _syncNotice() {
        if (!this._noticeHost) {
            return;
        }

        const notice = this._describeNotice();
        const key = notice ? JSON.stringify(notice) : "";
        if (key === this._noticeKey) {
            return;
        }
        this._noticeKey = key;
        this._noticeHost.textContent = "";
        this._noticeHost.hidden = !notice;

        if (!notice) {
            return;
        }

        const box = document.createElement("div");
        box.className = "wx-form-editor-notice wx-form-editor-notice--" + notice.kind;
        box.setAttribute("role", "alert");

        const text = document.createElement("span");
        text.className = "wx-form-editor-notice-text";
        text.textContent = notice.message;
        box.appendChild(text);

        if (notice.details.length > 0) {
            const list = document.createElement("ul");
            list.className = "wx-form-editor-notice-details";
            for (const detail of notice.details) {
                const item = document.createElement("li");
                item.textContent = detail;
                list.appendChild(item);
            }
            box.appendChild(list);
        }

        const actions = document.createElement("span");
        actions.className = "wx-form-editor-notice-actions";
        const labels = {
            "retry": "formeditor.action.retry",
            "reload": "formeditor.action.reload",
            "discard-local": "formeditor.action.reload.theirs",
            "overwrite": "formeditor.action.overwrite",
            "restore": "formeditor.action.restore",
            "recover": "formeditor.action.recover",
            "dismiss-recovery": "formeditor.action.dismiss"
        };
        for (const action of notice.actions) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "wx-form-editor-notice-action";
            btn.setAttribute("data-wx-action", action);
            btn.textContent = this._t(labels[action]);
            btn.addEventListener("click", () => { void this._runNoticeAction(action); });
            actions.appendChild(btn);
        }
        box.appendChild(actions);

        this._noticeHost.appendChild(box);
    }

    /**
     * Runs the action a notice offers.
     * @param {string} action - retry, reload, discard-local, overwrite, restore, recover or dismiss-recovery.
     * @returns {Promise<boolean>}
     */
    _runNoticeAction(action) {
        switch (action) {
            case "retry": return this.retry();
            case "reload": return this.reload();
            case "discard-local": return this.resolveConflict("reload");
            case "overwrite": return this.resolveConflict("overwrite");
            case "restore": return this.restore();
            case "recover": return this.recover();
            case "dismiss-recovery": this.dismissRecovery(); return Promise.resolve(true);
            default: return Promise.resolve(false);
        }
    }

    /**
     * Marks the tree rows a rejected definition names with the message the server
     * gave for them.
     */
    _syncValidation() {
        if (!this._bodyHost) {
            return;
        }

        const p = this._p;
        const items = (p.error && p.error.kind === "validation" && p.error.items) || [];
        const messages = new Map();
        for (const item of items) {
            if (item.nodeId && !messages.has(item.nodeId)) {
                messages.set(item.nodeId, item.message);
            }
        }

        for (const row of this._bodyHost.querySelectorAll(".wx-form-editor-tree-row")) {
            const message = messages.get(row.getAttribute("data-id"));
            row.classList.toggle("invalid", !!message);
            if (message) {
                row.setAttribute("title", message);
            } else {
                row.removeAttribute("title");
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
        list.addEventListener("click", () => {
            this._patchUi({ selectedId: null });
            this._renderBody();
        });

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
            + (this._ui.selectedId === node.id ? " selected" : "");
        group.dataset.layout = webexpress.webapp.RestFormEditorCtrl.LAYOUT_LABELS[layoutCls]
            || this._t("formeditor.group.fallback");
        group.addEventListener("click", (e) => { e.stopPropagation(); this._select(node.id, false); });

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
        wrap.className = "wx-form-editor-preview-field" + (this._ui.selectedId === node.id ? " selected" : "");
        wrap.addEventListener("click", (e) => { e.stopPropagation(); this._select(node.id, false); });

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
        const editable = this._canEdit();
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
            tree.appendChild(this._renderTreeRow(row, editable));
        }
        if (rows.length === 0) {
            const empty = document.createElement("div");
            empty.className = "wx-form-editor-tree-empty";
            empty.textContent = this._t("formeditor.structure.empty");
            tree.appendChild(empty);
        } else {
            // the keyboard actions belong to the tree that has the focus, so the
            // tree is what takes it, and the selection is announced through it
            tree.setAttribute("tabindex", "0");
            tree.setAttribute("role", "tree");
            tree.setAttribute("aria-label", this._t("formeditor.tree.label"));
            if (this._ui.selectedId && rows.some(r => r.node.id === this._ui.selectedId)) {
                tree.setAttribute("aria-activedescendant", this._rowId(this._ui.selectedId));
            }
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
        tree.addEventListener("click", () => {
            this._patchUi({ selectedId: null });
            this._renderBody();
        });
        body.appendChild(tree);
        panel.appendChild(body);

        if (editable) {
            panel.appendChild(this._renderQuickAdd(tab));
        }
        panel.appendChild(this._renderHints());
        return panel;
    }

    /**
     * Returns the dom id of a tree row, unique per editor instance.
     * @param {string} nodeId
     * @returns {string}
     */
    _rowId(nodeId) {
        return this._instanceId + "-node-" + nodeId;
    }

    /**
     * Renders a single tree row (chevron, icon, label, meta, action buttons).
     * @param {object} row - { node, depth }
     * @param {boolean} editable - Whether the definition may be changed.
     * @returns {HTMLElement}
     */
    _renderTreeRow(row, editable) {
        const node = row.node;
        const depth = row.depth;
        const isGroup = node.kind === "group";

        const rowEl = document.createElement("div");
        rowEl.className = "wx-form-editor-tree-row";
        rowEl.id = this._rowId(node.id);
        rowEl.setAttribute("role", "treeitem");
        rowEl.setAttribute("aria-selected", this._ui.selectedId === node.id ? "true" : "false");
        if (this._ui.selectedId === node.id) {
            rowEl.classList.add("selected");
        }
        if (this._dropState && this._dropState.id === node.id) {
            rowEl.classList.add("drop-" + this._dropState.pos);
        }
        rowEl.style.paddingLeft = (12 + depth * this._ui.indent) + "px";
        // The row itself never starts a drag; only the ⠿ grip does. This keeps
        // text selection / clicks on the label and action buttons intact.
        rowEl.draggable = false;
        rowEl.setAttribute("data-id", node.id);
        rowEl.setAttribute("data-kind", node.kind);

        // ⠿ drag handle (visible on hover/selection)
        const grip = document.createElement("span");
        grip.className = "wx-form-editor-tree-grip";
        grip.textContent = "⠿";
        grip.title = this._t("formeditor.row.action.move");
        const canDrag = editable && this._ui.editingId !== node.id;
        grip.draggable = canDrag;
        if (!canDrag) {
            grip.classList.add("wx-form-editor-tree-grip--disabled");
        }
        grip.addEventListener("click", (e) => e.stopPropagation());
        grip.addEventListener("dragstart", (e) => this._handleDragStart(e, node));
        rowEl.appendChild(grip);

        // chevron / spacer
        if (isGroup) {
            const collapsed = this._isCollapsed(node.id);
            const chev = document.createElement("button");
            chev.type = "button";
            chev.className = "wx-form-editor-chev" + (collapsed ? " collapsed" : "");
            // the chevron is drawn only, so its purpose and state are spoken instead
            chev.setAttribute("aria-label", this._t("formeditor.hints.collapse"));
            chev.setAttribute("aria-expanded", collapsed ? "false" : "true");
            const drawing = webexpress.webui.Icon.create("angle-down");
            drawing.setAttribute("aria-hidden", "true");
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
        if (editable && this._ui.editingId === node.id) {
            rowEl.appendChild(this._renderTreeRowEditor(node));
        } else {
            const label = document.createElement("span");
            label.className = "wx-form-editor-tree-label";
            label.textContent = isGroup
                ? (node.label || this._t("formeditor.group.default_label"))
                : (node.label || "");
            if (editable) {
                label.addEventListener("dblclick", (e) => {
                    e.stopPropagation();
                    this._startRename(node.id);
                });
            }
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
        if (editable) {
            rowEl.appendChild(this._renderTreeRowActions(node));
        }

        rowEl.addEventListener("click", (e) => { e.stopPropagation(); this._select(node.id, true); });
        rowEl.addEventListener("dragover", (e) => this._handleDragOver(e, node));
        rowEl.addEventListener("drop", (e) => this._handleDrop(e, node));
        return rowEl;
    }

    /**
     * Renders the inline rename editor inside a tree row.
     * @param {object} node
     * @returns {HTMLElement}
     */
    _renderTreeRowEditor(node) {
        const input = document.createElement("input");
        input.className = "wx-form-editor-tree-input";
        input.value = node.label || "";
        input.addEventListener("click", e => e.stopPropagation());
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                this._commitRename(node.id, input.value);
            } else if (e.key === "Escape") {
                e.preventDefault();
                this._patchUi({ editingId: null });
                this._renderBody();
                this._focusTree();
            }
        });
        input.addEventListener("blur", () => this._commitRename(node.id, input.value));
        // focus once attached to the dom
        this._later(() => {
            if (input.isConnected !== false) {
                input.focus({ preventScroll: true });
                input.select();
            }
        });
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
            this._startRename(node.id);
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

            const fieldMatches = this._s.catalog.filter(f => f.id.toLowerCase().includes(q));
            const groupMatches = this._groupLayouts()
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
            this.addNode({ kind: "group", layout: g.id });
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
        const fieldMatches = this._s.catalog.filter(f => f.id.toLowerCase().includes(q));
        const groupMatches = this._groupLayouts()
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
            const used = this._collectFieldLabels(tab ? tab.children : []);
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
                    this.addNode({ kind: "group", layout: g.id });
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
     * @param {boolean} focusTree - Whether the tree takes the focus, so its keys apply.
     */
    _select(id, focusTree) {
        this._patchUi({ selectedId: id });
        this._renderBody();
        if (focusTree) {
            this._focusTree();
        }
    }

    /**
     * Tells whether a group is collapsed.
     * @param {string} id
     * @returns {boolean}
     */
    _isCollapsed(id) {
        return this._ui.collapsed.includes(id);
    }

    /**
     * Toggles the collapsed state of a group node.
     * @param {string} id
     */
    _toggleCollapse(id) {
        const collapsed = this._isCollapsed(id)
            ? this._ui.collapsed.filter(c => c !== id)
            : this._ui.collapsed.concat([id]);
        this._patchUi({ collapsed: collapsed });
        this._renderBody();
    }

    /**
     * Opens the inline rename of a tree row.
     * @param {string} id
     */
    _startRename(id) {
        if (!this._canEdit()) {
            return;
        }
        this._patchUi({ editingId: id });
        this._renderBody();
    }

    /**
     * Commits an inline rename initiated via F2 / dbl-click. The blur that follows
     * an Enter finds the rename already closed and does nothing.
     * @param {string} id
     * @param {string} value
     */
    _commitRename(id, value) {
        if (this._destroyed || this._ui.editingId !== id) {
            return;
        }
        this._patchUi({ editingId: null });

        const next = (value || "").trim();
        const changed = !!next && this._commit((definition) => {
            const tab = this._tabOf(definition);
            const node = tab ? this._findById(tab.children, id) : null;
            if (!node || node.label === next) {
                return false;
            }
            node.label = next;
            return true;
        });
        if (changed) {
            this._dispatch(webexpress.webapp.Event.FORM_EDITOR_NODE_RENAMED_EVENT, { id: id, name: next });
        }
        this._renderBody();
        this._focusTree();
    }

    /**
     * Handles dragstart on a tree row.
     * @param {DragEvent} e
     * @param {object} node
     */
    _handleDragStart(e, node) {
        if (!this._canEdit()) {
            e.preventDefault();
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
        if (!this._canEdit() || !this._dragId || this._dragId === node.id) {
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
     * Handles drop on a tree row: the move runs through the common change path.
     * @param {DragEvent} e
     * @param {object} target
     */
    _handleDrop(e, target) {
        e.preventDefault();
        const dropState = this._dropState;
        const dragId = this._dragId;
        this._dropState = null;
        this._dragId = null;
        this._clearDropIndicators();
        if (!dragId || !dropState || dragId === target.id) {
            return;
        }

        const moved = this._commit((definition) => {
            const tab = this._tabOf(definition);
            const source = tab ? this._findById(tab.children, dragId) : null;
            const destination = source ? this._findById(tab.children, target.id) : null;
            if (!destination) {
                return false;
            }

            // a group cannot be moved next to or into its own descendants
            if (source.kind === "group" && this._isAncestor(source, target.id)) {
                return false;
            }

            this._removeFromList(tab.children, dragId);

            if (dropState.pos === "into" && destination.kind === "group") {
                (destination.children = destination.children || []).push(source);
            } else {
                const targetParent = this._findParentList(tab.children, dropState.id) || tab.children;
                const idx = targetParent.findIndex(n => n.id === dropState.id);
                if (idx === -1) {
                    tab.children.push(source);
                } else {
                    targetParent.splice(idx + (dropState.pos === "after" ? 1 : 0), 0, source);
                }
            }
            return true;
        });
        if (!moved) {
            return;
        }

        this._dispatch(webexpress.webapp.Event.FORM_EDITOR_NODE_MOVED_EVENT, {
            nodeId: dragId, targetId: target.id, position: dropState.pos
        });
        this._renderBody();
    }

    /**
     * Wires the tree keys. They are listened for on the body of this editor and
     * act only on a tree of this editor that holds the focus, so a second editor
     * on the page and every field outside the tree keep their keys.
     */
    _bindKeyboard() {
        this._listen(this._bodyHost, "keydown", (e) => this._onTreeKeydown(e));
    }

    /**
     * Closes the QuickAdd picker on outside clicks.
     */
    _bindOutsideClick() {
        this._listen(document, "mousedown", (e) => {
            const wrap = this._element.querySelector(".wx-form-editor-quickadd");
            if (wrap && !wrap.contains(e.target) && wrap._wxClosePicker) {
                wrap._wxClosePicker();
            }
        });
    }

    /**
     * Handles the keys of the focused structure tree: navigation always, rename,
     * delete and add only while the definition may be changed.
     * @param {KeyboardEvent} e
     */
    _onTreeKeydown(e) {
        const target = e.target;
        if (this._destroyed || !target || typeof target.closest !== "function") {
            return;
        }

        const tree = target.closest(".wx-form-editor-tree");
        if (!tree || tree.closest(".wx-form-editor") !== this._element) {
            return;
        }
        // a field inside the tree - the inline rename above all - keeps its own keys
        if (this._isTextEntry(target) || this._ui.editingId || e.ctrlKey || e.metaKey || e.altKey) {
            return;
        }

        const tab = this._getActiveTab();
        if (!tab) {
            return;
        }
        const editable = this._canEdit();
        const selectedId = this._ui.selectedId;
        const flat = this._flatten(tab.children, 0, []);
        const idx = flat.findIndex(r => r.node.id === selectedId);

        if (e.key === "ArrowDown") {
            e.preventDefault();
            const next = flat[Math.min(flat.length - 1, idx + 1)];
            if (next) {
                this._select(next.node.id, true);
            }
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            const next = flat[Math.max(0, idx - 1)];
            if (next) {
                this._select(next.node.id, true);
            }
        } else if (e.key === "ArrowRight" && idx >= 0) {
            const n = flat[idx].node;
            if (n.kind === "group" && this._isCollapsed(n.id)) {
                e.preventDefault();
                this._toggleCollapse(n.id);
                this._focusTree();
            }
        } else if (e.key === "ArrowLeft" && idx >= 0) {
            const n = flat[idx].node;
            if (n.kind === "group" && !this._isCollapsed(n.id)) {
                e.preventDefault();
                this._toggleCollapse(n.id);
                this._focusTree();
            }
        } else if (e.key === "F2" && selectedId && editable) {
            e.preventDefault();
            this._startRename(selectedId);
        } else if ((e.key === "Delete" || e.key === "Backspace") && selectedId && editable) {
            e.preventDefault();
            this.removeNode(selectedId);
            this._focusTree();
        } else if ((e.key === "n" || e.key === "N") && editable) {
            e.preventDefault();
            const input = this._bodyHost.querySelector(".wx-form-editor-quickadd-input");
            if (input) {
                input.focus({ preventScroll: true });
            }
        }
    }

    /**
     * Tells whether an element takes text input and therefore keeps its keys.
     * @param {HTMLElement} el
     * @returns {boolean}
     */
    _isTextEntry(el) {
        return ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)
            || el.isContentEditable === true
            || !!el.closest("[contenteditable=true]");
    }

    /**
     * Gives the focus back to the tree after it was rebuilt, so the keys keep working.
     */
    _focusTree() {
        const tree = this._bodyHost.querySelector(".wx-form-editor-tree");
        if (tree && tree.getAttribute("tabindex") !== null && typeof tree.focus === "function") {
            tree.focus({ preventScroll: true });
        }
    }

    /**
     * Creates an inline editor the editor owns, so it is released on the next
     * render and on teardown; a save arriving after the teardown is dropped.
     * @param {HTMLElement} wrap - The host of the inline editor.
     * @param {Set} edits - The set the editor is released with.
     * @param {Function} onSave - Receives the saved value.
     */
    _smartEdit(wrap, edits, onSave) {
        const ctrl = new webexpress.webui.SmartEditCtrl(wrap);
        ctrl.onSave = (el, value) => {
            if (!this._destroyed) {
                onSave(value);
            }
        };
        edits.add(ctrl);
    }

    /**
     * Releases the inline editors of a render.
     * @param {Set} edits
     */
    _releaseEdits(edits) {
        for (const ctrl of edits) {
            if (typeof ctrl.destroy === "function") {
                ctrl.destroy();
            }
        }
        edits.clear();
    }

    /**
     * Adds a listener the editor removes on teardown.
     * @param {EventTarget} target
     * @param {string} type
     * @param {Function} handler
     */
    _listen(target, type, handler) {
        target.addEventListener(type, handler);
        this._bindings.push({ target: target, type: type, handler: handler });
    }

    /**
     * Runs a callback after the current task, unless the editor is torn down by then.
     * @param {Function} callback
     */
    _later(callback) {
        setTimeout(() => {
            if (!this._destroyed) {
                callback();
            }
        }, 0);
    }

    /**
     * Returns the active tab of the definition on screen (or the first tab as a fallback).
     * @returns {object|null}
     */
    _getActiveTab() {
        return this._structure ? this._tabOf(this._structure) : null;
    }

    /**
     * Returns the active tab of a definition (or its first tab as a fallback).
     * @param {object} definition
     * @returns {object|null}
     */
    _tabOf(definition) {
        if (!definition || !Array.isArray(definition.tabs)) {
            return null;
        }
        return definition.tabs.find(t => t.id === this._ui.activeTabId)
            || definition.tabs[0]
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
            if (n.kind === "group" && !this._isCollapsed(n.id) && (n.children || []).length) {
                this._flatten(n.children, depth + 1, out);
            }
        }
        return out;
    }

    /**
     * Recursively finds the first node a predicate accepts.
     * @param {object[]} list
     * @param {Function} predicate
     * @returns {object|null}
     */
    _findWhere(list, predicate) {
        for (const n of (list || [])) {
            if (predicate(n)) {
                return n;
            }
            if (n.kind === "group") {
                const hit = this._findWhere(n.children, predicate);
                if (hit) {
                    return hit;
                }
            }
        }
        return null;
    }

    /**
     * Recursively finds a node by id.
     * @param {object[]} list
     * @param {string} id
     * @returns {object|null}
     */
    _findById(list, id) {
        return this._findWhere(list, (n) => n.id === id);
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
     * Returns the selected node when it is a group, which is where an added
     * node goes.
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
     * Pairs the offered group layouts with their labels in the page language; the labels
     * double as the QuickAdd search text, so they are matched the way the user reads them.
     * @returns {{id: string, label: string}[]}
     */
    _groupLayouts() {
        return webexpress.webapp.RestFormEditorCtrl.GROUP_LAYOUTS
            .map(id => ({ id, label: this._t("formeditor.layout." + id) }));
    }

    /**
     * Builds the initial state from the configuration attributes and the wx-state
     * island: the initial definition and catalog for a new or offline form, the
     * active tab, the collapsed groups and the preview.
     * @param {HTMLElement} element - The host element.
     * @param {object} seed - The parsed wx-state island.
     * @returns {object} The initial state.
     */
    static _initialState(element, seed) {
        const ctrl = webexpress.webapp.RestFormEditorCtrl;
        const preview = typeof seed.preview === "boolean"
            ? seed.preview
            : ctrl._attribute(element, "data-preview", "preview") !== "false";

        return {
            definition: null,
            catalog: Array.isArray(seed.catalog) ? seed.catalog : [],
            ui: {
                activeTabId: typeof seed.activeTab === "string" ? seed.activeTab : null,
                selectedId: null,
                editingId: null,
                collapsed: Array.isArray(seed.collapsed) ? seed.collapsed.map(String) : [],
                preview: preview,
                indent: ctrl._clampIndent(ctrl._attribute(element, "data-indent", "indent"))
            },
            persistence: {
                phase: "loading",
                status: "idle",
                revision: 0,
                savedRevision: 0,
                draft: false,
                draftRevision: 0,
                updated: null,
                savedAt: null,
                busy: null,
                error: null,
                recovery: null
            }
        };
    }

    /**
     * Reads a configuration attribute, through the dataset where the attribute is absent.
     * @param {HTMLElement} element
     * @param {string} name - The attribute name.
     * @param {string} key - The dataset key.
     * @returns {string|null}
     */
    static _attribute(element, name, key) {
        const value = typeof element.getAttribute === "function" ? element.getAttribute(name) : null;
        if (value !== null && value !== undefined) {
            return value;
        }
        return element.dataset && element.dataset[key] !== undefined ? element.dataset[key] : null;
    }

    /**
     * Clamps a tree indent to 8–32 pixels, 18 when it is not a number.
     * @param {*} value
     * @returns {number}
     */
    static _clampIndent(value) {
        const n = parseInt(value, 10);
        return isFinite(n) ? Math.min(32, Math.max(8, n)) : 18;
    }

    /**
     * Reads the definition and the catalog from the answer of the data endpoint
     * ({ catalog, data }, { structure } or a bare definition). An answer that does
     * not carry a definition is rejected rather than turned into an empty one.
     * @param {*} json - The response body.
     * @returns {object|null} { definition, catalog } or null.
     */
    static _parseResponse(json) {
        if (!json || typeof json !== "object" || Array.isArray(json)) {
            return null;
        }

        const definition = "structure" in json ? json.structure : ("data" in json ? json.data : json);
        if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
            return null;
        }
        if (definition.tabs !== undefined && definition.tabs !== null && !Array.isArray(definition.tabs)) {
            return null;
        }
        for (const tab of definition.tabs || []) {
            if (!tab || typeof tab !== "object" || (tab.children !== undefined && tab.children !== null && !Array.isArray(tab.children))) {
                return null;
            }
        }

        return { definition: definition, catalog: Array.isArray(json.catalog) ? json.catalog : [] };
    }

    /**
     * Reads the version from the answer to a write.
     * @param {*} body - The response body.
     * @returns {number|null}
     */
    static _versionOf(body) {
        if (body && body.data && typeof body.data.version === "number") {
            return body.data.version;
        }
        return null;
    }

    /**
     * Reads the draft revision from the answer of the draft endpoint.
     * @param {*} body - The response body.
     * @returns {number|null}
     */
    static _revisionOf(body) {
        if (body && typeof body.revision === "number") {
            return body.revision;
        }
        if (body && body.data && typeof body.data.revision === "number") {
            return body.data.revision;
        }
        return null;
    }

    /**
     * Returns the key the browser keeps the unconfirmed changes for a write target under.
     * @param {object|null} service - The service the changes were to be written to.
     * @returns {string|null}
     */
    static _recoveryKey(service) {
        return service && service.baseUri ? webexpress.webapp.RestFormEditorCtrl.RECOVERY_PREFIX + service.baseUri : null;
    }

    /**
     * Reduces a definition to what the editor changes, so the copy of a client and
     * the answer of a server compare equal whatever defaults and nulls the server
     * serializer adds.
     * @param {object} definition
     * @returns {string}
     */
    static _canonical(definition) {
        const text = (value) => (value === null || value === undefined ? "" : String(value));
        const node = (n) => n.kind === "group"
            ? ["g", text(n.id), text(n.label), text(n.layout || "vertical"), (n.children || []).map(node)]
            : ["f", text(n.id), text(n.label), text(n.type || "string"), !!n.required, text(n.help)];

        return JSON.stringify([
            text(definition.formName),
            text(definition.formDescription),
            (definition.tabs || []).map((t) => [text(t.id), text(t.name), (t.children || []).map(node)])
        ]);
    }

    /**
     * Returns the size of a text in utf-8, the unit the keepalive budget is counted in.
     * @param {string} text
     * @returns {number}
     */
    static _byteLength(text) {
        return typeof TextEncoder === "function" ? new TextEncoder().encode(text).length : text.length * 3;
    }

    /**
     * Copies a definition deeply; it is plain json.
     * @param {*} value
     * @returns {*}
     */
    static _clone(value) {
        return value === null || value === undefined ? value : JSON.parse(JSON.stringify(value));
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
