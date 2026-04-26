/**
 * Controller for the visual form editor (Designer).
 *
 * Translates the KleeneStar Forms Designer prototype into a single self-contained
 * web UI control. Hosts a tab bar, a structure tree (drag-and-drop, inline rename,
 * keyboard navigation, QuickAdd picker), a live preview pane and an optional
 * palette pane (three-pane layout). Persists every mutation to the REST endpoint
 * pointed to by data-rest-url; runs in offline-mock mode when no REST URL is
 * configured.
 *
 * Events:
 *  - webexpress.webapp.Event.FORM_EDITOR_LOADED_EVENT
 *  - webexpress.webapp.Event.FORM_EDITOR_NODE_ADDED_EVENT
 *  - webexpress.webapp.Event.FORM_EDITOR_NODE_REMOVED_EVENT
 *  - webexpress.webapp.Event.FORM_EDITOR_NODE_RENAMED_EVENT
 *  - webexpress.webapp.Event.FORM_EDITOR_NODE_MOVED_EVENT
 *  - webexpress.webapp.Event.FORM_EDITOR_TAB_ADDED_EVENT
 *  - webexpress.webapp.Event.FORM_EDITOR_TAB_RENAMED_EVENT
 *  - webexpress.webapp.Event.FORM_EDITOR_LAYOUT_CHANGED_EVENT
 *  - webexpress.webapp.Event.FORM_EDITOR_SAVED_EVENT
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

    // logical field types accepted by the editor
    static FIELD_TYPES = ["string", "text", "timestamp", "ref", "enum", "tags", "number", "file"];

    // small built-in catalog used when no field-catalog url is configured
    static FALLBACK_FIELD_CATALOG = [
        { id: "Title",       type: "string"    },
        { id: "Description", type: "text"      },
        { id: "Status",      type: "enum"      },
        { id: "Priority",    type: "enum"      },
        { id: "Owner",       type: "ref"       },
        { id: "Tags",        type: "tags"      },
        { id: "DueDate",     type: "timestamp" },
        { id: "Attachments", type: "file"      }
    ];

    // designer layout names accepted on data-layout / setLayout()
    static KNOWN_LAYOUTS = new Set(["two-pane", "tree-table", "three-pane"]);
    _formId = null;
    _restUrl = null;
    _fieldCatalogUrl = null;
    _layout = "two-pane";
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
    _fieldCatalog = webexpress.webapp.RestFormEditorCtrl?.FALLBACK_FIELD_CATALOG?.slice() || [];

    // dom hosts
    _headerHost = null;
    _tabsHost = null;
    _bodyHost = null;
    _footerHost = null;

    // persistence / global handlers
    _saveTimer = null;
    _keyboardHandler = null;
    _outsideClickHandler = null;

    /**
     * Creates a form editor controller for the root element.
     * @param {HTMLElement} element - Root node carrying the data-* configuration.
     */
    constructor(element) {
        super(element);

        // initialize properties from data attributes
        const ds = element.dataset;
        this._formId = ds.formId || null;
        this._restUrl = ds.restUrl || null;
        this._fieldCatalogUrl = ds.fieldCatalogUrl || null;
        this._layout = webexpress.webapp.RestFormEditorCtrl.KNOWN_LAYOUTS.has(ds.layout) ? ds.layout : "two-pane";
        this._previewOn = ds.preview !== "false";
        const indent = parseInt(ds.indent, 10);
        this._indent = isFinite(indent) ? Math.min(32, Math.max(8, indent)) : 18;
        this._readonly = ds.readonly === "true";

        // optionally hydrate from inline structure JSON
        const inline = ds.initialStructure;
        if (inline) {
            try { this._structure = JSON.parse(inline); }
            catch { this._structure = null; }
        }

        // clean up the dom element and set base classes for styling
        element.removeAttribute("data-initial-structure");
        element.classList.add("wx-form-editor");

        this._buildSkeleton();
        this._bindKeyboard();
        this._bindOutsideClick();
        this._bootstrap();
    }

    /**
     * Gets the id of the form currently loaded in the editor.
     * @returns {string|null}
     */
    get formId() {
        return this._formId;
    }

    /**
     * Gets the active designer layout.
     * @returns {"two-pane"|"tree-table"|"three-pane"}
     */
    get layout() {
        return this._layout;
    }

    /**
     * Sets the active designer layout. Re-renders the body if the value changed.
     * @param {"two-pane"|"tree-table"|"three-pane"} value
     */
    set layout(value) {
        if (!webexpress.webapp.RestFormEditorCtrl.KNOWN_LAYOUTS.has(value) || value === this._layout) {
            return;
        }
        this._layout = value;
        this._dispatch(webexpress.webapp.Event.FORM_EDITOR_LAYOUT_CHANGED_EVENT, { layout: value });
        this._renderHeader();
        this._renderBody();
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
     * Loads a form by id. When no rest url is configured and no inline structure
     * was supplied, builds an empty placeholder structure with one tab.
     * @param {string} formId - The form id to load.
     * @returns {Promise<void>}
     */
    async loadForm(formId) {
        this._formId = formId || this._formId;
        await this._bootstrap();
    }

    /**
     * Adds a new tab and selects it.
     */
    addTab() {
        if (this._readonly || !this._structure) {
            return;
        }
        const id = webexpress.webapp.RestFormEditorCtrl._uid("t");
        const tab = { id: id, name: "Tab " + (this._structure.tabs.length + 1), children: [] };
        this._structure.tabs.push(tab);
        this._activeTabId = id;
        this._selectedId = null;
        this._dispatch(webexpress.webapp.Event.FORM_EDITOR_TAB_ADDED_EVENT, { tab: tab });
        this._renderTabs();
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
        if (node.kind === "field") {
            node.name = next;
        } else {
            node.label = next;
        }
        this._dispatch(webexpress.webapp.Event.FORM_EDITOR_NODE_RENAMED_EVENT, { id: nodeId, name: next });
        this._renderBody();
        this._scheduleSave();
    }

    /**
     * Renders the editor.
     * Triggers a full re-render of header, tabs and body. Used after configuration
     * changes that affect the whole UI.
     */
    render() {
        this._renderHeader();
        this._renderTabs();
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
        if (this._saveTimer) {
            clearTimeout(this._saveTimer);
            this._saveTimer = null;
        }
    }

    /**
     * Builds the static skeleton (head/tabs/body/foot containers).
     */
    _buildSkeleton() {
        const root = this._element;
        root.textContent = "";

        this._headerHost = document.createElement("div");
        this._headerHost.className = "wx-form-editor-head";

        this._tabsHost = document.createElement("div");
        this._tabsHost.className = "wx-form-editor-tabs";

        this._bodyHost = document.createElement("div");
        this._bodyHost.className = "wx-form-editor-body";

        this._footerHost = document.createElement("div");
        this._footerHost.className = "wx-form-editor-foot";

        root.appendChild(this._headerHost);
        root.appendChild(this._tabsHost);
        root.appendChild(this._bodyHost);
        root.appendChild(this._footerHost);
    }

    /**
     * Loads the field catalog and the form structure (REST or fallback) and
     * triggers an initial full render.
     * @returns {Promise<void>}
     */
    async _bootstrap() {
        await this._loadFieldCatalog();
        await this._loadStructure();

        if (!this._structure) {
            this._structure = {
                formId: this._formId || webexpress.webapp.RestFormEditorCtrl._uid("form"),
                formName: "New form",
                className: "",
                version: 1,
                tabs: [{ id: webexpress.webapp.RestFormEditorCtrl._uid("t"), name: "Details", children: [] }]
            };
        }

        this._activeTabId = (this._structure.tabs && this._structure.tabs[0]) ? this._structure.tabs[0].id : null;
        this._dispatch(webexpress.webapp.Event.FORM_EDITOR_LOADED_EVENT, { structure: this.getStructure() });
        this.render();
    }

    /**
     * Loads the field catalog from data-field-catalog-url, if configured.
     * @returns {Promise<void>}
     */
    async _loadFieldCatalog() {
        if (!this._fieldCatalogUrl) {
            return;
        }
        try {
            const res = await fetch(this._fieldCatalogUrl, {
                method: "GET",
                headers: { "Accept": "application/json" }
            });
            if (!res.ok) {
                return;
            }
            const json = await res.json();
            if (Array.isArray(json.fields)) {
                this._fieldCatalog = json.fields;
            } else if (Array.isArray(json)) {
                this._fieldCatalog = json;
            }
        } catch (e) {
            console.warn("FormEditor: failed to load field catalog, falling back to defaults.", e);
        }
    }

    /**
     * Loads the form structure for the current form id from data-rest-url, if configured
     * and no inline structure was supplied at construction time.
     * @returns {Promise<void>}
     */
    async _loadStructure() {
        if (this._structure || !this._restUrl || !this._formId) {
            return;
        }
        try {
            const res = await fetch(this._restUrl + "/item/" + encodeURIComponent(this._formId), {
                method: "GET",
                headers: { "Accept": "application/json" }
            });
            if (!res.ok) {
                return;
            }
            const json = await res.json();
            this._structure = json.structure || json.data || json;
        } catch (e) {
            console.warn("FormEditor: failed to load form, falling back to placeholder.", e);
        }
    }

    /**
     * Renders the header (form name + version + layout switch + preview toggle).
     */
    _renderHeader() {
        this._headerHost.textContent = "";

        const title = document.createElement("div");
        title.className = "wx-form-editor-title";

        const name = document.createElement("span");
        name.className = "wx-form-editor-name";
        name.textContent = (this._structure && this._structure.formName) || "Form";
        title.appendChild(name);

        const version = document.createElement("span");
        version.className = "wx-form-editor-version";
        version.textContent = "v" + ((this._structure && this._structure.version) || 1);
        title.appendChild(version);

        const tools = document.createElement("div");
        tools.className = "wx-form-editor-tools";
        tools.appendChild(this._renderLayoutSwitch());
        const toggle = this._renderPreviewToggle();
        if (toggle) {
            tools.appendChild(toggle);
        }

        this._headerHost.appendChild(title);
        this._headerHost.appendChild(tools);
    }

    /**
     * Renders the layout switcher (two-pane / tree / three-pane).
     * @returns {HTMLElement}
     */
    _renderLayoutSwitch() {
        const wrap = document.createElement("div");
        wrap.className = "wx-form-editor-mode";
        const layouts = [
            { id: "two-pane",   label: "Two-pane",   title: "Preview + structure" },
            { id: "tree-table", label: "Tree",       title: "Spec-style tree table" },
            { id: "three-pane", label: "Three-pane", title: "Palette + preview + structure" }
        ];
        for (const l of layouts) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.title = l.title;
            btn.textContent = l.label;
            if (this._layout === l.id) {
                btn.classList.add("active");
            }
            btn.addEventListener("click", () => { this.layout = l.id; });
            wrap.appendChild(btn);
        }
        return wrap;
    }

    /**
     * Renders the preview toggle. Returns null in tree-table layout (no preview).
     * @returns {HTMLElement|null}
     */
    _renderPreviewToggle() {
        if (this._layout === "tree-table") {
            return null;
        }
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "wx-form-editor-preview-toggle" + (this._previewOn ? " active" : "");
        btn.textContent = this._previewOn ? "Hide preview" : "Show preview";
        btn.addEventListener("click", () => { this.preview = !this._previewOn; });
        return btn;
    }

    /**
     * Renders the tab bar.
     */
    _renderTabs() {
        this._tabsHost.textContent = "";
        if (!this._structure || !this._structure.tabs) {
            return;
        }
        for (const tab of this._structure.tabs) {
            this._tabsHost.appendChild(this._renderTab(tab));
        }
        if (!this._readonly) {
            const add = document.createElement("button");
            add.type = "button";
            add.className = "wx-form-editor-tab-add";
            add.textContent = "+ Add tab";
            add.addEventListener("click", () => this.addTab());
            this._tabsHost.appendChild(add);
        }
    }

    /**
     * Renders a single tab handle.
     * @param {object} tab - The tab model.
     * @returns {HTMLElement}
     */
    _renderTab(tab) {
        const tabEl = document.createElement("button");
        tabEl.type = "button";
        tabEl.className = "wx-form-editor-tab" + (tab.id === this._activeTabId ? " active" : "");
        tabEl.dataset.tabId = tab.id;

        const name = document.createElement("span");
        name.className = "wx-form-editor-tab-name";
        name.textContent = tab.name || "Tab";
        tabEl.appendChild(name);

        const count = document.createElement("span");
        count.className = "wx-form-editor-tab-count";
        count.textContent = String(this._countFields(tab.children));
        tabEl.appendChild(count);

        tabEl.addEventListener("click", () => {
            this._activeTabId = tab.id;
            this._selectedId = null;
            this._renderTabs();
            this._renderBody();
        });
        tabEl.addEventListener("dblclick", (e) => {
            e.stopPropagation();
            this._beginRenameTab(tab.id, tabEl);
        });
        return tabEl;
    }

    /**
     * Begins inline rename for the given tab.
     * @param {string} tabId
     * @param {HTMLElement} tabEl
     */
    _beginRenameTab(tabId, tabEl) {
        if (this._readonly) {
            return;
        }
        const tab = this._structure.tabs.find(t => t.id === tabId);
        if (!tab) {
            return;
        }

        const input = document.createElement("input");
        input.className = "wx-form-editor-tab-input";
        input.value = tab.name || "";

        tabEl.textContent = "";
        tabEl.appendChild(input);
        input.focus();
        input.select();

        const commit = () => {
            const next = input.value.trim() || tab.name;
            if (next !== tab.name) {
                tab.name = next;
                this._dispatch(webexpress.webapp.Event.FORM_EDITOR_TAB_RENAMED_EVENT, { tabId: tabId, name: next });
                this._scheduleSave();
            }
            this._renderTabs();
        };

        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                commit();
            } else if (e.key === "Escape") {
                e.preventDefault();
                this._renderTabs();
            }
        });
        input.addEventListener("blur", commit);
        input.addEventListener("click", e => e.stopPropagation());
    }

    /**
     * Renders the body grid (palette / preview / tree depending on layout).
     */
    _renderBody() {
        this._bodyHost.className = "wx-form-editor-body wx-form-editor-body--" + this._layout;
        if (!this._previewOn) {
            this._bodyHost.classList.add("wx-form-editor-body--no-preview");
        }
        this._bodyHost.textContent = "";

        const tab = this._getActiveTab();
        if (!tab) {
            return;
        }
        if (this._layout === "three-pane") {
            this._bodyHost.appendChild(this._renderPalette());
        }
        if (this._layout !== "tree-table" && this._previewOn) {
            this._bodyHost.appendChild(this._renderPreviewPanel(tab));
        }
        this._bodyHost.appendChild(this._renderStructurePanel(tab));
    }

    /**
     * Renders the footer (status hint).
     */
    _renderFooter() {
        this._footerHost.textContent = "";

        const hint = document.createElement("span");
        hint.className = "wx-form-editor-foot-hint";
        hint.textContent = "Drag nodes to reorder · double-click to rename · press N to add";
        this._footerHost.appendChild(hint);

        const status = document.createElement("span");
        status.className = "wx-form-editor-foot-status";
        status.textContent = this._restUrl
            ? "Draft · autosaves on every change"
            : "Offline preview · changes are not persisted";
        this._footerHost.appendChild(status);
    }

    /**
     * Renders the palette pane (search + fields + groups).
     * @returns {HTMLElement}
     */
    _renderPalette() {
        const panel = document.createElement("div");
        panel.className = "wx-form-editor-pane wx-form-editor-pane--palette";

        const head = document.createElement("div");
        head.className = "wx-form-editor-pane-head";
        head.textContent = "Palette";
        panel.appendChild(head);

        const body = document.createElement("div");
        body.className = "wx-form-editor-pane-body";

        const search = document.createElement("input");
        search.type = "search";
        search.className = "wx-form-editor-palette-search";
        search.placeholder = "Filter…";
        body.appendChild(search);

        const fieldsHeader = document.createElement("div");
        fieldsHeader.className = "wx-form-editor-palette-header";
        fieldsHeader.textContent = "Fields";

        const fieldsList = document.createElement("div");
        fieldsList.className = "wx-form-editor-palette-list";
        fieldsList.dataset.kind = "fields";

        const groupsHeader = document.createElement("div");
        groupsHeader.className = "wx-form-editor-palette-header";
        groupsHeader.textContent = "Groups";

        const groupsList = document.createElement("div");
        groupsList.className = "wx-form-editor-palette-list";
        groupsList.dataset.kind = "groups";

        const renderLists = () => {
            const q = search.value.toLowerCase();
            fieldsList.textContent = "";
            groupsList.textContent = "";
            for (const f of this._fieldCatalog) {
                if (!f.id.toLowerCase().includes(q)) continue;
                fieldsList.appendChild(this._renderPaletteFieldItem(f));
            }
            for (const g of webexpress.webapp.RestFormEditorCtrl.GROUP_LAYOUTS) {
                if (!g.label.toLowerCase().includes(q)) continue;
                groupsList.appendChild(this._renderPaletteGroupItem(g));
            }
        };
        search.addEventListener("input", renderLists);

        body.appendChild(fieldsHeader);
        body.appendChild(fieldsList);
        body.appendChild(groupsHeader);
        body.appendChild(groupsList);
        renderLists();

        panel.appendChild(body);
        return panel;
    }

    /**
     * Renders a single palette field item.
     * @param {object} f - Catalog entry with id and type.
     * @returns {HTMLElement}
     */
    _renderPaletteFieldItem(f) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "wx-form-editor-palette-item";
        btn.title = "Add " + f.id + " (" + f.type + ")";

        const swatch = document.createElement("span");
        swatch.className = "wx-form-editor-type-swatch wx-form-editor-type-" + f.type;
        btn.appendChild(swatch);

        const label = document.createElement("span");
        label.className = "wx-form-editor-palette-label";
        label.textContent = f.id;
        btn.appendChild(label);

        const type = document.createElement("span");
        type.className = "wx-form-editor-palette-type";
        type.textContent = f.type;
        btn.appendChild(type);

        btn.addEventListener("click", () => this.addNode({ kind: "field", name: f.id, type: f.type }));
        return btn;
    }

    /**
     * Renders a single palette group item.
     * @param {object} g - Group layout descriptor.
     * @returns {HTMLElement}
     */
    _renderPaletteGroupItem(g) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "wx-form-editor-palette-item";

        const glyph = document.createElement("span");
        glyph.className = "wx-form-editor-palette-glyph";
        glyph.textContent = "▦";
        btn.appendChild(glyph);

        const label = document.createElement("span");
        label.className = "wx-form-editor-palette-label";
        label.textContent = g.label;
        btn.appendChild(label);

        const type = document.createElement("span");
        type.className = "wx-form-editor-palette-type";
        type.textContent = g.id;
        btn.appendChild(type);

        btn.addEventListener("click", () => this.addNode({
            kind: "group",
            layout: g.id,
            label: g.label.split(" ")[0]
        }));
        return btn;
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
        head.textContent = "Live preview";
        panel.appendChild(head);

        const body = document.createElement("div");
        body.className = "wx-form-editor-pane-body";

        const card = document.createElement("div");
        card.className = "wx-form-editor-preview-card";

        const title = document.createElement("div");
        title.className = "wx-form-editor-preview-title";
        title.textContent = (this._structure && this._structure.formName) || "Form";
        card.appendChild(title);

        const sub = document.createElement("div");
        sub.className = "wx-form-editor-preview-sub";
        const className = (this._structure && this._structure.className) || "";
        sub.textContent = className + (className ? " · " : "") + (tab.name || "");
        card.appendChild(sub);

        const list = document.createElement("div");
        list.className = "wx-form-editor-preview-list";
        for (const node of (tab.children || [])) {
            list.appendChild(this._renderPreviewNode(node));
        }
        if (!tab.children || tab.children.length === 0) {
            const empty = document.createElement("div");
            empty.className = "wx-form-editor-preview-empty";
            empty.textContent = "Empty tab — add fields from the structure pane.";
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
        group.dataset.layout = webexpress.webapp.RestFormEditorCtrl.LAYOUT_LABELS[layoutCls] || "FormGroup";
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
        label.textContent = node.name || "";
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
                input.placeholder = "Enter " + (node.name || "");
                return input;
            }
            case "text": {
                const ta = document.createElement("textarea");
                ta.className = "wx-form-editor-preview-textarea";
                ta.placeholder = "Describe " + (node.name || "") + "…";
                return ta;
            }
            case "timestamp": {
                const input = document.createElement("input");
                input.className = "wx-form-editor-preview-input";
                input.value = "2026-03-14 14:32";
                return input;
            }
            case "ref": {
                const ref = document.createElement("div");
                ref.className = "wx-form-editor-preview-ref";
                const dot = document.createElement("span");
                dot.className = "wx-form-editor-preview-ref-dot";
                dot.textContent = (node.name || "?")[0];
                ref.appendChild(dot);
                const txt = document.createElement("span");
                txt.textContent = "Unassigned";
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
                file.textContent = "Drop files or browse…";
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
        const items = palette[node.name] || [{ v: "Option A", active: true }];
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
        panel.className = "wx-form-editor-pane wx-form-editor-pane--tree";

        const head = document.createElement("div");
        head.className = "wx-form-editor-pane-head";

        const heading = document.createElement("span");
        heading.textContent = "Structure · " + (tab.name || "");
        head.appendChild(heading);

        const meta = document.createElement("span");
        meta.className = "wx-form-editor-pane-meta";
        meta.textContent = this._countNodes(tab.children) + " nodes";
        head.appendChild(meta);
        panel.appendChild(head);

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
            empty.textContent = "No fields on this tab yet. Use Add field below or press N.";
            tree.appendChild(empty);
        }
        tree.addEventListener("dragleave", () => { this._dropState = null; });
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
        rowEl.draggable = !this._readonly && this._editingId !== node.id;
        rowEl.dataset.id = node.id;
        rowEl.dataset.kind = node.kind;

        // chevron / spacer
        if (isGroup) {
            const collapsed = this._collapsed.has(node.id);
            const chev = document.createElement("button");
            chev.type = "button";
            chev.className = "wx-form-editor-chev" + (collapsed ? " collapsed" : "");
            chev.textContent = collapsed ? "▸" : "▾";
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
            label.textContent = isGroup ? (node.label || "Group") : (node.name || "");
            label.addEventListener("dblclick", (e) => {
                e.stopPropagation();
                this._editingId = node.id;
                this._renderBody();
            });
            rowEl.appendChild(label);
            if (!isGroup && node.required) {
                const req = document.createElement("span");
                req.className = "wx-form-editor-tree-required";
                req.textContent = "REQUIRED";
                rowEl.appendChild(req);
            }
        }

        // meta (type / FormGroup<name>)
        const meta = document.createElement("span");
        meta.className = "wx-form-editor-tree-meta";
        meta.textContent = isGroup
            ? (webexpress.webapp.RestFormEditorCtrl.LAYOUT_LABELS[node.layout] || "FormGroup")
            : (node.type || "");
        rowEl.appendChild(meta);

        // row actions
        if (!this._readonly) {
            rowEl.appendChild(this._renderTreeRowActions(node));
        }

        rowEl.addEventListener("click", (e) => { e.stopPropagation(); this._select(node.id); });
        rowEl.addEventListener("dragstart", (e) => this._handleDragStart(e, node));
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
        input.value = (isGroup ? node.label : node.name) || "";
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
        edit.title = "Rename (F2)";
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
        del.title = "Delete (Del)";
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
        input.placeholder = "Quick add — type field name or \"vertical\", \"horizontal\"…";

        const picker = document.createElement("div");
        picker.className = "wx-form-editor-picker";
        picker.style.display = "none";

        const renderPicker = () => {
            picker.textContent = "";
            const q = input.value.toLowerCase();
            const used = this._collectFieldNames(tab.children);

            const fieldMatches = this._fieldCatalog.filter(f => f.id.toLowerCase().includes(q));
            const groupMatches = webexpress.webapp.RestFormEditorCtrl.GROUP_LAYOUTS
                .filter(g => g.label.toLowerCase().includes(q));

            const total = fieldMatches.length + groupMatches.length;
            if (total === 0) {
                const empty = document.createElement("div");
                empty.className = "wx-form-editor-picker-empty";
                empty.textContent = "No matches.";
                picker.appendChild(empty);
                return;
            }
            this._pickerHi = Math.min(this._pickerHi, total - 1);

            if (fieldMatches.length > 0) {
                const sep = document.createElement("div");
                sep.className = "wx-form-editor-picker-sep";
                sep.textContent = "Fields";
                picker.appendChild(sep);
            }
            fieldMatches.forEach((f, i) => {
                picker.appendChild(this._renderPickerFieldItem(f, i, used.has(f.id), input));
            });

            if (groupMatches.length > 0) {
                const sep = document.createElement("div");
                sep.className = "wx-form-editor-picker-sep";
                sep.textContent = "Layout groups";
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
        add.textContent = "+ Add";
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
        label.textContent = f.id;
        btn.appendChild(label);

        const meta = document.createElement("span");
        meta.className = "wx-form-editor-picker-meta";
        meta.textContent = used ? "already used" : f.type;
        btn.appendChild(meta);

        btn.addEventListener("click", () => {
            if (used) {
                return;
            }
            this.addNode({ kind: "field", name: f.id, type: f.type });
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
            const used = this._collectFieldNames(tab.children);
            if (this._pickerHi < fieldMatches.length) {
                const f = fieldMatches[this._pickerHi];
                if (!used.has(f.id)) {
                    this.addNode({ kind: "field", name: f.id, type: f.type });
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
            { key: "↑↓", label: "Navigate" },
            { key: "←→", label: "Collapse / expand" },
            { key: "F2", label: "Rename" },
            { key: "Del", label: "Delete" },
            { key: "N", label: "Add" }
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
        if (node.kind === "field") {
            node.name = next;
        } else {
            node.label = next;
        }
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
            this._renderBody();
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
        if (!dragId || !dropState || dragId === target.id) {
            this._renderBody();
            return;
        }

        const source = this._findById(tab.children, dragId);
        if (!source) {
            this._renderBody();
            return;
        }

        // no descendant-into-self moves
        if (source.kind === "group" && dropState.pos === "into" && this._isAncestor(source, target.id)) {
            this._renderBody();
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
     * Schedules a debounced PUT against the structure endpoint.
     */
    _scheduleSave() {
        if (this._readonly || !this._restUrl || !this._formId || !this._structure) {
            return;
        }
        if (this._saveTimer) {
            clearTimeout(this._saveTimer);
        }
        this._saveTimer = setTimeout(() => this._save(), 400);
    }

    /**
     * Sends the current structure to the REST endpoint.
     * @returns {Promise<void>}
     */
    async _save() {
        this._saveTimer = null;
        if (this._readonly || !this._restUrl || !this._formId || !this._structure) {
            return;
        }
        try {
            const res = await fetch(this._restUrl + "/item/" + encodeURIComponent(this._formId), {
                method: "PUT",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(this._structure)
            });
            if (!res.ok) {
                let body = null;
                try { body = await res.json(); } catch { body = null; }
                this._dispatch(webexpress.webapp.Event.FORM_EDITOR_VALIDATION_FAILED_EVENT, body || { status: res.status });
                return;
            }
            const body = await res.json();
            if (body && body.data && typeof body.data.version === "number") {
                this._structure.version = body.data.version;
                this._renderHeader();
            }
            this._dispatch(webexpress.webapp.Event.FORM_EDITOR_SAVED_EVENT, body);
        } catch (e) {
            console.warn("FormEditor: save failed.", e);
        }
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
     * Returns the group containing the selected node (used to scope add operations
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
     * Collects every used field name in the given list, recursively.
     * @param {object[]} list
     * @param {Set<string>} [out]
     * @returns {Set<string>}
     */
    _collectFieldNames(list, out) {
        out = out || new Set();
        for (const n of (list || [])) {
            if (n.kind === "field") {
                out.add(n.name);
            } else {
                this._collectFieldNames(n.children, out);
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
                name: spec.name || "Untitled",
                type: type,
                required: !!spec.required,
                help: spec.help || undefined
            };
        }
        return {
            id: webexpress.webapp.RestFormEditorCtrl._uid("n"),
            kind: "group",
            layout: spec.layout || "vertical",
            label: spec.label || "Group",
            children: []
        };
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
