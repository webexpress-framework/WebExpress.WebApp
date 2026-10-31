/**
 * The administration of the relation types of a class: which relations exist,
 * how they read from either end, which classes they accept, how often they may
 * meet, what they do to the workflow, how heavily they are used and whether they
 * may still be used at all.
 *
 * It is the administrative half of the link system. What is defined here is
 * immediately available everywhere - the link surface groups by it and the add
 * dialog offers it - because both read the same registry the endpoint writes.
 *
 * The table is a pure function of the state (render), patched into the host by the keyed
 * reconciler of the Data base; a drag in progress is state too, so its marks are rendered.
 *
 * Declarative configuration: the host carries a wx-service island named "data"
 * for the type endpoint.
 *
 * REST contract:
 *   GET    {data}?class=&q=                    → { items, total, active, classes }
 *   POST   {data}        body { label, … }     → the created type
 *   POST   {data}/order  body { ids }          → 204
 *   PUT    {data}/{id}   body { label, … }     → the updated type
 *   DELETE {data}/{id}                         → 204
 *
 * Events dispatched on the host element:
 *   webexpress.webapp.Event.RELATION_TYPE_SAVED_EVENT     detail: { type }
 *   webexpress.webapp.Event.RELATION_TYPE_REMOVED_EVENT   detail: { id }
 *   webexpress.webapp.Event.RELATION_TYPE_REORDERED_EVENT detail: { ids }
 */
webexpress.webapp.RelationEditorCtrl = class extends webexpress.webapp.Data {
    /**
     * Construct a new RelationEditorCtrl.
     * @param {HTMLElement} element - host element.
     */
    constructor(element) {
        const services = webexpress.webapp.ServiceRegistry.fromElement(element);
        const initialState = Object.assign({
            items: [],
            total: 0,
            active: 0,
            classes: [],
            drag: null
        }, webexpress.webapp.Data.readState(element));

        super(element, { state: initialState, services: services });

        this._class = element.dataset.class || "";
        this._sample = element.dataset.sample || this._class;
        this._readonly = element.dataset.readonly === "true";
        this._service = this.useService("data");
        this._dialog = null;
        // nodes the render captures for imperative access
        this._counts = null;
        this._rows = null;

        element.textContent = "";
        element.removeAttribute("data-class");
        element.removeAttribute("data-sample");
        element.removeAttribute("data-readonly");
        element.classList.add("wx-relation-editor");

        // stable handlers, so a render does not swap the listeners of unchanged nodes
        this._onNew = () => this._edit(null);
        this._rowHandlers = {
            click: (e) => this._onRowClick(e),
            change: (e) => this._onRowChange(e),
            dragstart: (e) => this._onDragStart(e),
            dragover: (e) => this._onDragOver(e),
            dragleave: (e) => this._onDragLeave(e),
            dragend: () => this.setState({ drag: null }),
            drop: (e) => this._onDrop(e)
        };

        this.mount();

        if (this.state.items.length === 0) {
            this._load();
        }
    }

    /**
     * Loads the administered types.
     * @returns {Promise<void>} Resolves when the load completed.
     */
    async _load() {
        if (!this._service) {
            return;
        }

        const result = await this._service.query(this._class ? { class: this._class } : {});

        if (!result.ok) {
            if (result.error.kind === "abort") {
                return;
            }

            console.warn("RelationEditorCtrl: load failed", webexpress.webapp.ServiceResult.describe(result));
            return;
        }

        this.setState(webexpress.webapp.relationEditorModel.normalizeResult(result.data));
    }

    /**
     * Renders the toolbar with the caption, the counts and the define affordance, and the table
     * of the types. The drag marks are part of the state, so the rows show them like any other
     * attribute of a type.
     * @param {object} state - The current state.
     * @returns {Array<object>} The virtual node tree of the host.
     */
    render(state) {
        const h = webexpress.webui.h;

        return [
            h("div", { key: "toolbar", class: "wx-relation-editor-toolbar" },
                h("span", { class: "wx-relation-editor-caption" }, this._class
                    ? this._i18n("webexpress.webapp:relation.type.title.class", "Link types of class {0}").replace("{0}", this._class)
                    : this._i18n("webexpress.webapp:relation.type.title", "Link types")),
                h("span", { class: "wx-relation-editor-counts", ref: (el) => { this._counts = el; } },
                    this._i18n("webexpress.webapp:relation.type.counts", "{0} active, {1} defined")
                        .replace("{0}", String(state.active || 0))
                        .replace("{1}", String(state.total || 0))),
                !this._readonly && h("button", {
                    type: "button",
                    class: "btn btn-primary wx-relation-editor-new",
                    on: { click: this._onNew }
                }, this._icon("plus"), this._i18n("webexpress.webapp:relation.type.new", "New type"))),
            h("div", { key: "table", class: "wx-relation-editor-table", role: "table" },
                this._renderHead(),
                // the rows report through delegated listeners, so a row needs none of its own
                h("div", {
                    class: "wx-relation-editor-rows",
                    on: this._rowHandlers,
                    ref: (el) => { this._rows = el; }
                }, state.items.map((item) => this._renderRow(item, state.drag))))
        ];
    }

    /**
     * Renders an icon from a symbolic name, the way webexpress.webui.Icon builds a class icon.
     * @param {string} name - The symbolic icon name.
     * @returns {object} The icon virtual node.
     */
    _icon(name) {
        return webexpress.webui.h("i", { class: this._iconClass(name) });
    }

    /**
     * Renders the column headings of the table.
     * @returns {object} The heading row virtual node.
     */
    _renderHead() {
        const h = webexpress.webui.h;
        // the grip and the menu columns are named too, though the name need not be seen
        const columns = [
            ["grip", this._i18n("webexpress.webapp:relation.type.column.move", "Move"), true],
            ["pair", this._i18n("webexpress.webapp:relation.type.column.relation", "Relation")],
            ["classes", this._i18n("webexpress.webapp:relation.type.column.target", "Target type")],
            ["cardinality", this._i18n("webexpress.webapp:relation.type.column.cardinality", "Cardinality")],
            ["effect", this._i18n("webexpress.webapp:relation.type.column.effect", "Effect")],
            ["usage", this._i18n("webexpress.webapp:relation.type.column.usage", "Usage")],
            ["active", this._i18n("webexpress.webapp:relation.type.column.active", "Active")],
            ["menu", this._i18n("webexpress.webapp:relation.type.column.actions", "Actions"), true]
        ];

        return h("div", { class: "wx-relation-editor-head", role: "row" },
            columns.map(([name, label, hidden]) => h("span", {
                class: `wx-relation-editor-cell wx-relation-editor-${name}`,
                role: "columnheader"
            }, hidden ? h("span", { class: "visually-hidden" }, label) : label)));
    }

    /**
     * Renders one row of the table.
     * @param {object} item - The normalised type.
     * @param {object|null} drag - The drag in progress, as { id, target, side }.
     * @returns {object} The row virtual node.
     */
    _renderRow(item, drag) {
        const h = webexpress.webui.h;
        const classes = ["wx-relation-editor-row"];

        if (!item.active) {
            classes.push("wx-relation-editor-inactive");
        }
        if (drag && drag.id === item.id) {
            classes.push("wx-relation-editor-dragging");
        }
        // the marks are the ones the other reorderable controls use, so a drop reads the same everywhere
        if (drag && drag.target === item.id) {
            classes.push("wx-drop-target", drag.side === "after" ? "wx-drop-after" : "wx-drop-before");
        }

        return h("div", {
            key: item.id,
            class: classes.join(" "),
            role: "row",
            dataset: { type: item.id },
            draggable: this._readonly ? null : "true"
        },
            h("span", { class: "wx-relation-editor-cell wx-relation-editor-grip", role: "cell" },
                !this._readonly && this._icon("grip-vertical")),
            this._renderPair(item),
            this._renderClasses(item),
            this._renderCell("cardinality", item.cardinality),
            this._renderCell("effect", webexpress.webapp.relationEditorModel.effectLabel(item.effect, (key, fallback) => this._i18n(key, fallback))),
            this._renderCell("usage", String(item.usage)),
            h("span", { class: "wx-relation-editor-cell wx-relation-editor-active", role: "cell" },
                h("input", {
                    type: "checkbox",
                    class: "form-check-input wx-relation-editor-switch",
                    checked: item.active,
                    disabled: this._readonly,
                    "data-command": "toggle",
                    "aria-label": this._i18n("webexpress.webapp:relation.type.column.active", "Active")
                })),
            this._renderMenu(item));
    }

    /**
     * Renders the type pair cell: the relation as it reads from this object above
     * the way it reads from the other one, which is the one thing an
     * administrator has to see at a glance.
     * @param {object} item - The normalised type.
     * @returns {object} The cell virtual node.
     */
    _renderPair(item) {
        const h = webexpress.webui.h;

        return h("span", { class: "wx-relation-editor-cell wx-relation-editor-pair", role: "cell", "data-command": "edit" },
            h("span", { class: "wx-relation-editor-forward" }, "→ " + item.label),
            h("span", { class: "wx-relation-editor-backward" }, "← " + (item.inverse || "—")),
            item.symmetric && h("span", { class: "wx-relation-editor-symmetric" },
                this._i18n("webexpress.webapp:relation.type.symmetric", "symmetric")));
    }

    /**
     * Renders the target class cell, as chips or as the "all classes" marker.
     * @param {object} item - The normalised type.
     * @returns {object} The cell virtual node.
     */
    _renderClasses(item) {
        const h = webexpress.webui.h;

        return h("span", { class: "wx-relation-editor-cell wx-relation-editor-classes", role: "cell" }, item.allClasses
            ? h("span", { class: "wx-relation-editor-chip wx-relation-editor-chip-all" },
                this._i18n("webexpress.webapp:relation.type.all.classes", "all classes"))
            : item.targetClasses.map((name) => h("span", { key: name, class: "wx-relation-editor-chip" }, name)));
    }

    /**
     * Renders a plain text cell.
     * @param {string} name - The column name.
     * @param {string} text - The content.
     * @returns {object} The cell virtual node.
     */
    _renderCell(name, text) {
        return webexpress.webui.h("span", { class: `wx-relation-editor-cell wx-relation-editor-${name}`, role: "cell" }, text);
    }

    /**
     * Renders the options cell of a row. A type that is shipped by code or still
     * carries links offers no removal, because dropping it would strip the
     * meaning from the links that reference it.
     * @param {object} item - The normalised type.
     * @returns {object} The cell virtual node.
     */
    _renderMenu(item) {
        const h = webexpress.webui.h;
        const option = (command, icon, title, danger) => h("button", {
            key: command,
            type: "button",
            class: danger ? "wx-relation-editor-option wx-relation-editor-option-danger" : "wx-relation-editor-option",
            "data-command": command,
            title: title,
            "aria-label": title
        }, this._icon(icon));

        return h("span", { class: "wx-relation-editor-cell wx-relation-editor-menu", role: "cell" },
            !this._readonly && option("edit", "pen", this._i18n("webexpress.webapp:relation.type.edit", "Edit link type")),
            !this._readonly && !item.builtin && item.usage === 0
                && option("remove", "trash", this._i18n("webexpress.webapp:relation.type.remove", "Delete link type"), true));
    }

    /**
     * Applies a click inside the table.
     * @param {Event} e - The click event.
     */
    _onRowClick(e) {
        const command = e.target.closest ? e.target.closest("[data-command]") : null;
        const row = e.target.closest ? e.target.closest(".wx-relation-editor-row") : null;

        if (!command || !row || this._readonly) {
            return;
        }

        const item = this._itemOf(row.dataset.type);

        if (command.getAttribute("data-command") === "edit") {
            this._edit(item);
        } else if (command.getAttribute("data-command") === "remove") {
            this._remove(item);
        }
    }

    /**
     * Applies a change of the activation toggle.
     * @param {Event} e - The change event.
     */
    _onRowChange(e) {
        const toggle = e.target;
        const row = toggle.closest ? toggle.closest(".wx-relation-editor-row") : null;

        if (!row || typeof toggle.getAttribute !== "function" || toggle.getAttribute("data-command") !== "toggle") {
            return;
        }

        const item = this._itemOf(row.dataset.type);

        if (item) {
            this.saveType(Object.assign({}, item, { active: toggle.checked }));
        }
    }

    /**
     * Remembers which row is being dragged, so the reader keeps track of what they picked up.
     * @param {Event} e - The dragstart event.
     */
    _onDragStart(e) {
        const row = e.target.closest ? e.target.closest(".wx-relation-editor-row") : null;

        this.setState({ drag: row ? { id: row.dataset.type, target: null, side: null } : null });
    }

    /**
     * Marks where the dragged relation would land: above the row the pointer is
     * in the upper half of, below it otherwise.
     * @param {Event} e - The dragover event.
     */
    _onDragOver(e) {
        e.preventDefault();

        const drag = this.state.drag;
        const row = e.target.closest ? e.target.closest(".wx-relation-editor-row") : null;

        if (!drag) {
            return;
        }

        if (!row || row.dataset.type === drag.id) {
            if (drag.target) {
                this.setState({ drag: { id: drag.id, target: null, side: null } });
            }
            return;
        }

        const bounds = typeof row.getBoundingClientRect === "function" ? row.getBoundingClientRect() : null;
        const side = bounds && e.clientY > bounds.top + bounds.height / 2 ? "after" : "before";

        // dragover fires continuously; only a new place is a new state
        if (drag.target !== row.dataset.type || drag.side !== side) {
            this.setState({ drag: { id: drag.id, target: row.dataset.type, side: side } });
        }
    }

    /**
     * Drops the mark once the pointer left the row it belonged to.
     * @param {Event} e - The dragleave event.
     */
    _onDragLeave(e) {
        const drag = this.state.drag;
        const row = e.target.closest ? e.target.closest(".wx-relation-editor-row") : null;

        if (drag && row && drag.target === row.dataset.type) {
            this.setState({ drag: { id: drag.id, target: null, side: null } });
        }
    }

    /**
     * Applies a drop, moving the dragged relation to the marked place.
     * @param {Event} e - The drop event.
     */
    _onDrop(e) {
        e.preventDefault();

        const drag = this.state.drag;
        const row = e.target.closest ? e.target.closest(".wx-relation-editor-row") : null;

        this.setState({ drag: null });

        if (drag && row) {
            const side = drag.target === row.dataset.type ? drag.side : null;
            this._move(drag.id, this._insertBefore(row.dataset.type, side, drag.id));
        }
    }

    /**
     * Resolves the relation the dragged one is put in front of. Dropping below a
     * row means taking the place of the one after it, and dropping below the
     * last one means the end of the list.
     * @param {string} targetId - The relation the drop landed on.
     * @param {string} side - Whether the drop was above or below it.
     * @param {string} draggedId - The relation being moved.
     * @returns {string|null} The relation to insert in front of, or null for the end.
     */
    _insertBefore(targetId, side, draggedId) {
        if (side !== "after") {
            return targetId;
        }

        const items = this.state.items;
        const next = items[items.findIndex((item) => item.id === targetId) + 1];

        // the row after the target may be the dragged one itself, which would
        // ask the move to put it in front of where it already is
        return next && next.id !== draggedId ? next.id : null;
    }

    /**
     * Moves a type in front of another one and persists the resulting order. The
     * table shows the new order at once and the request carries exactly that
     * order, so the two cannot disagree.
     * @param {string} movedId - The dragged type.
     * @param {string} beforeId - The type it was dropped on.
     * @returns {Promise<void>} Resolves when the order was persisted.
     */
    async _move(movedId, beforeId) {
        const model = webexpress.webapp.relationEditorModel;
        const items = model.reorder(this.state.items, movedId, beforeId);
        const ids = model.orderIds(items);

        this.setState({ items: items });

        if (!this._service) {
            return;
        }

        const result = await this._service.create({ ids: ids }, { path: model.orderPath() });

        if (!result.ok && result.status !== 204) {
            console.warn("RelationEditorCtrl: reorder failed", webexpress.webapp.ServiceResult.describe(result));
            await this._load();
            return;
        }

        this._dispatch(webexpress.webapp.Event.RELATION_TYPE_REORDERED_EVENT, { ids: ids });
    }

    /**
     * Opens the editor for a type, or for a new definition when none is given.
     * The editor is the framework sidebar modal with a single page, which puts
     * it into its single pane mode - the plain framework dialog, with the
     * framework submit button and the framework validation. The page itself is
     * registered in the panel registry, like the pages of the add dialog.
     * @param {object|null} item - The type to edit.
     */
    _edit(item) {
        if (!this._dialog) {
            this._dialog = this._buildDialog();
        }

        // the page reads what it edits off the modal when it is shown, so a
        // second opening never carries the values of the first
        this._dialog._linkTypeClasses = this.state.classes;
        this._dialog._linkTypeDraft = item || webexpress.webapp.relationEditorModel.emptyItem();
        this._dialog.show();
    }

    /**
     * Builds the modal host, its controller and the editor page.
     * @returns {object} The dialog.
     */
    _buildDialog() {
        const id = `${this._element.id || "wx-relation-editor"}_dialog`;
        const host = document.createElement("dialog");

        host.id = id;
        host.setAttribute("aria-labelledby", `${id}-label`);
        host.setAttribute("aria-hidden", "true");
        host.setAttribute("data-submit-id", `${id}-submit`);
        host.setAttribute("data-size", "modal-lg");

        const header = document.createElement("div");
        header.className = "wx-modal-header";
        header.textContent = this._i18n("webexpress.webapp:relation.type.dialog.title", "Edit link type");

        const content = document.createElement("div");
        content.className = "wx-modal-content";

        const footer = document.createElement("div");
        footer.className = "wx-modal-footer";

        const submit = document.createElement("button");
        submit.id = `${id}-submit`;
        submit.type = "button";
        submit.className = "btn btn-primary";
        submit.textContent = this._i18n("webexpress.webapp:relation.type.dialog.submit", "Apply changes");
        footer.appendChild(submit);

        host.appendChild(header);
        host.appendChild(content);
        host.appendChild(footer);
        document.body.appendChild(host);

        const dialog = new webexpress.webui.ModalSidebarPanelCtrl(host);

        // the page renders as it is added and speaks through the surface, so the
        // back reference is attached first; that is also why the page is added
        // here rather than through the registry autoload, which runs inside the
        // constructor above
        dialog._linkTypeCtrl = this;
        dialog._linkTypeSample = this._sample;

        const page = (webexpress.webui.DialogPanels.get(webexpress.webapp.relationEditorModel.PANELS_KEY) || [])[0];

        if (page) {
            dialog.addPage(page);
        }

        return dialog;
    }

    /**
     * Persists a definition. A type that carries an id is changed, one without
     * is defined, which is the only difference between the two paths. The
     * framework dialog submits synchronously and closes, so a rejection only the
     * server can see is reported as a notification; what the page could check
     * itself was already refused by its validation.
     * @param {object} draft - The edited type.
     * @returns {Promise<void>} Resolves when the attempt completed.
     */
    async saveType(draft) {
        if (!this._service) {
            return;
        }

        const model = webexpress.webapp.relationEditorModel;
        const body = model.payload(draft);
        const result = draft.id
            ? await this._service.update(body, { path: model.typePath(draft.id) })
            : await this._service.create(body);

        if (!result.ok) {
            webexpress.webapp.relationViewModel.notifyFault(this, result,
                this._i18n("webexpress.webapp:relation.type.error.save", "The link type could not be stored."));
            await this._load();

            return;
        }

        this._dispatch(webexpress.webapp.Event.RELATION_TYPE_SAVED_EVENT, { type: result.data });
        await this._load();
    }

    /**
     * Removes a type that carries no links.
     * @param {object} item - The type to remove.
     * @returns {Promise<void>} Resolves when the removal completed.
     */
    async _remove(item) {
        if (!item || !this._service) {
            return;
        }

        const result = await this._service.remove({ path: webexpress.webapp.relationEditorModel.typePath(item.id) });

        if (!result.ok && result.status !== 204) {
            console.warn("RelationEditorCtrl: remove failed", webexpress.webapp.ServiceResult.describe(result));
            return;
        }

        this._dispatch(webexpress.webapp.Event.RELATION_TYPE_REMOVED_EVENT, { id: item.id });
        await this._load();
    }

    /**
     * Returns the loaded type of an id.
     * @param {string} id - The type id.
     * @returns {object|null} The type.
     */
    _itemOf(id) {
        return this.state.items.find((item) => item.id === id) || null;
    }

    /**
     * Gets the administered types.
     * @returns {Array<object>} The types.
     */
    get value() {
        return this.state.items.slice();
    }
};

// register for declarative auto-init
webexpress.webui.Controller.registerClass("wx-webapp-relation-editor", webexpress.webapp.RelationEditorCtrl);
