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
            classes: []
        }, webexpress.webapp.Data.readState(element));

        super(element, { state: initialState, services: services });

        this._class = element.dataset.class || "";
        this._sample = element.dataset.sample || this._class;
        this._readonly = element.dataset.readonly === "true";
        this._service = this.useService("data");
        this._dialog = null;
        this._dragged = null;

        element.textContent = "";
        element.removeAttribute("data-class");
        element.removeAttribute("data-sample");
        element.removeAttribute("data-readonly");
        element.classList.add("wx-relation-editor");

        this._buildDom();
        this._attachEventHandlers();

        this.mount();

        if (this.state.items.length === 0) {
            this._load();
        }
    }

    /**
     * Builds the static scaffold: the caption with the two counts, the define
     * affordance and the table the types are rendered into.
     */
    _buildDom() {
        this._toolbar = document.createElement("div");
        this._toolbar.className = "wx-relation-editor-toolbar";

        this._caption = document.createElement("span");
        this._caption.className = "wx-relation-editor-caption";
        this._caption.textContent = this._class
            ? this._i18n("webexpress.webapp:relation.type.title.class", "Link types of class {0}").replace("{0}", this._class)
            : this._i18n("webexpress.webapp:relation.type.title", "Link types");

        this._counts = document.createElement("span");
        this._counts.className = "wx-relation-editor-counts";

        this._newButton = document.createElement("button");
        this._newButton.type = "button";
        this._newButton.className = "btn btn-primary wx-relation-editor-new";
        this._newButton.appendChild(webexpress.webui.Icon.create(this._iconClass("plus")));
        this._newButton.appendChild(document.createTextNode(this._i18n("webexpress.webapp:relation.type.new", "New type")));

        this._toolbar.appendChild(this._caption);
        this._toolbar.appendChild(this._counts);

        if (!this._readonly) {
            this._toolbar.appendChild(this._newButton);
        }

        this._table = document.createElement("div");
        this._table.className = "wx-relation-editor-table";
        this._table.setAttribute("role", "table");
        this._table.appendChild(this._buildHead());

        this._rows = document.createElement("div");
        this._rows.className = "wx-relation-editor-rows";
        this._table.appendChild(this._rows);

        this._element.appendChild(this._toolbar);
        this._element.appendChild(this._table);
    }

    /**
     * Builds the column headings of the table.
     * @returns {HTMLElement} The heading row.
     */
    _buildHead() {
        const head = document.createElement("div");
        head.className = "wx-relation-editor-head";
        head.setAttribute("role", "row");

        const columns = [
            ["grip", ""],
            ["pair", this._i18n("webexpress.webapp:relation.type.column.relation", "Relation")],
            ["classes", this._i18n("webexpress.webapp:relation.type.column.target", "Target type")],
            ["cardinality", this._i18n("webexpress.webapp:relation.type.column.cardinality", "Cardinality")],
            ["effect", this._i18n("webexpress.webapp:relation.type.column.effect", "Effect")],
            ["usage", this._i18n("webexpress.webapp:relation.type.column.usage", "Usage")],
            ["active", this._i18n("webexpress.webapp:relation.type.column.active", "Active")],
            ["menu", ""]
        ];

        for (const [name, label] of columns) {
            const cell = document.createElement("span");
            cell.className = `wx-relation-editor-cell wx-relation-editor-${name}`;
            cell.setAttribute("role", "columnheader");
            cell.textContent = label;
            head.appendChild(cell);
        }

        return head;
    }

    /**
     * Wires the toolbar and the delegated listeners of the table. The rows are
     * rebuilt on every state change, so they carry no listeners of their own.
     */
    _attachEventHandlers() {
        this._newButton.addEventListener("click", () => this._edit(null));

        this._rows.addEventListener("click", (e) => this._onRowClick(e));
        this._rows.addEventListener("change", (e) => this._onRowChange(e));
        this._rows.addEventListener("dragstart", (e) => this._onDragStart(e));
        this._rows.addEventListener("dragover", (e) => this._onDragOver(e));
        this._rows.addEventListener("dragleave", (e) => this._onDragLeave(e));
        this._rows.addEventListener("dragend", () => this._clearDropMarks());
        this._rows.addEventListener("drop", (e) => this._onDrop(e));
    }

    /**
     * Renders the table on the first paint.
     */
    onMount() {
        this._render();
    }

    /**
     * Renders the table whenever the state changes.
     */
    onUpdate() {
        this._render();
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
     * Renders the counts and the rows.
     */
    _render() {
        const state = this.state;

        this._counts.textContent = this._i18n("webexpress.webapp:relation.type.counts", "{0} active, {1} defined")
            .replace("{0}", String(state.active || 0))
            .replace("{1}", String(state.total || 0));

        this._rows.replaceChildren();

        const fragment = document.createDocumentFragment();

        for (const item of state.items) {
            fragment.appendChild(this._buildRow(item));
        }

        this._rows.appendChild(fragment);
    }

    /**
     * Builds one row of the table.
     * @param {object} item - The normalised type.
     * @returns {HTMLElement} The row.
     */
    _buildRow(item) {
        const row = document.createElement("div");
        row.className = "wx-relation-editor-row";
        row.setAttribute("role", "row");
        row.dataset.type = item.id;

        if (!item.active) {
            row.classList.add("wx-relation-editor-inactive");
        }

        if (!this._readonly) {
            row.draggable = true;
        }

        row.appendChild(this._buildGrip());
        row.appendChild(this._buildPair(item));
        row.appendChild(this._buildClasses(item));
        row.appendChild(this._buildCell("cardinality", item.cardinality));
        row.appendChild(this._buildCell("effect", webexpress.webapp.relationEditorModel.effectLabel(item.effect, (key, fallback) => this._i18n(key, fallback))));
        row.appendChild(this._buildCell("usage", String(item.usage)));
        row.appendChild(this._buildToggle(item));
        row.appendChild(this._buildMenu(item));

        return row;
    }

    /**
     * Builds the drag handle of a row.
     * @returns {HTMLElement} The cell.
     */
    _buildGrip() {
        const cell = document.createElement("span");
        cell.className = "wx-relation-editor-cell wx-relation-editor-grip";
        cell.setAttribute("role", "cell");

        if (!this._readonly) {
            cell.appendChild(webexpress.webui.Icon.create(this._iconClass("grip-vertical")));
        }

        return cell;
    }

    /**
     * Builds the type pair cell: the relation as it reads from this object above
     * the way it reads from the other one, which is the one thing an
     * administrator has to see at a glance.
     * @param {object} item - The normalised type.
     * @returns {HTMLElement} The cell.
     */
    _buildPair(item) {
        const cell = document.createElement("span");
        cell.className = "wx-relation-editor-cell wx-relation-editor-pair";
        cell.setAttribute("role", "cell");
        cell.setAttribute("data-command", "edit");

        const forward = document.createElement("span");
        forward.className = "wx-relation-editor-forward";
        forward.textContent = "→ " + item.label;

        const backward = document.createElement("span");
        backward.className = "wx-relation-editor-backward";
        backward.textContent = "← " + (item.inverse || "—");

        cell.appendChild(forward);
        cell.appendChild(backward);

        if (item.symmetric) {
            const badge = document.createElement("span");
            badge.className = "wx-relation-editor-symmetric";
            badge.textContent = this._i18n("webexpress.webapp:relation.type.symmetric", "symmetric");
            cell.appendChild(badge);
        }

        return cell;
    }

    /**
     * Builds the target class cell, as chips or as the "all classes" marker.
     * @param {object} item - The normalised type.
     * @returns {HTMLElement} The cell.
     */
    _buildClasses(item) {
        const cell = document.createElement("span");
        cell.className = "wx-relation-editor-cell wx-relation-editor-classes";
        cell.setAttribute("role", "cell");

        if (item.allClasses) {
            const chip = document.createElement("span");
            chip.className = "wx-relation-editor-chip wx-relation-editor-chip-all";
            chip.textContent = this._i18n("webexpress.webapp:relation.type.all.classes", "all classes");
            cell.appendChild(chip);

            return cell;
        }

        for (const name of item.targetClasses) {
            const chip = document.createElement("span");
            chip.className = "wx-relation-editor-chip";
            chip.textContent = name;
            cell.appendChild(chip);
        }

        return cell;
    }

    /**
     * Builds a plain text cell.
     * @param {string} name - The column name.
     * @param {string} text - The content.
     * @returns {HTMLElement} The cell.
     */
    _buildCell(name, text) {
        const cell = document.createElement("span");
        cell.className = `wx-relation-editor-cell wx-relation-editor-${name}`;
        cell.setAttribute("role", "cell");
        cell.textContent = text;

        return cell;
    }

    /**
     * Builds the activation toggle of a row.
     * @param {object} item - The normalised type.
     * @returns {HTMLElement} The cell.
     */
    _buildToggle(item) {
        const cell = document.createElement("span");
        cell.className = "wx-relation-editor-cell wx-relation-editor-active";
        cell.setAttribute("role", "cell");

        const toggle = document.createElement("input");
        toggle.type = "checkbox";
        toggle.className = "form-check-input wx-relation-editor-switch";
        toggle.checked = item.active;
        toggle.disabled = this._readonly;
        toggle.setAttribute("data-command", "toggle");
        toggle.setAttribute("aria-label", this._i18n("webexpress.webapp:relation.type.column.active", "Active"));
        cell.appendChild(toggle);

        return cell;
    }

    /**
     * Builds the options cell of a row. A type that is shipped by code or still
     * carries links offers no removal, because dropping it would strip the
     * meaning from the links that reference it.
     * @param {object} item - The normalised type.
     * @returns {HTMLElement} The cell.
     */
    _buildMenu(item) {
        const cell = document.createElement("span");
        cell.className = "wx-relation-editor-cell wx-relation-editor-menu";
        cell.setAttribute("role", "cell");

        if (this._readonly) {
            return cell;
        }

        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = "wx-relation-editor-option";
        edit.setAttribute("data-command", "edit");
        edit.title = this._i18n("webexpress.webapp:relation.type.edit", "Edit link type");
        edit.setAttribute("aria-label", edit.title);
        edit.appendChild(webexpress.webui.Icon.create(this._iconClass("pen")));
        cell.appendChild(edit);

        if (!item.builtin && item.usage === 0) {
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "wx-relation-editor-option wx-relation-editor-option-danger";
            remove.setAttribute("data-command", "remove");
            remove.title = this._i18n("webexpress.webapp:relation.type.remove", "Delete link type");
            remove.setAttribute("aria-label", remove.title);
            remove.appendChild(webexpress.webui.Icon.create(this._iconClass("trash")));
            cell.appendChild(remove);
        }

        return cell;
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
     * Remembers which row is being dragged and marks it, so the reader keeps
     * track of what they picked up.
     * @param {Event} e - The dragstart event.
     */
    _onDragStart(e) {
        const row = e.target.closest ? e.target.closest(".wx-relation-editor-row") : null;

        this._dragged = row ? row.dataset.type : null;

        if (row) {
            row.classList.add("wx-relation-editor-dragging");
        }
    }

    /**
     * Marks where the dragged relation would land: above the row the pointer is
     * in the upper half of, below it otherwise. The marks are the ones the other
     * reorderable controls use, so a drop reads the same everywhere.
     * @param {Event} e - The dragover event.
     */
    _onDragOver(e) {
        e.preventDefault();

        const row = e.target.closest ? e.target.closest(".wx-relation-editor-row") : null;

        if (!row || !this._dragged || row.dataset.type === this._dragged) {
            this._clearDropMarks();
            return;
        }

        const bounds = typeof row.getBoundingClientRect === "function" ? row.getBoundingClientRect() : null;
        const side = bounds && e.clientY > bounds.top + bounds.height / 2 ? "after" : "before";

        if (row.dataset.dropSide === side) {
            return;
        }

        this._clearDropMarks();
        row.dataset.dropSide = side;
        row.classList.add("wx-drop-target", side === "after" ? "wx-drop-after" : "wx-drop-before");
    }

    /**
     * Drops the mark once the pointer left the row it belonged to.
     * @param {Event} e - The dragleave event.
     */
    _onDragLeave(e) {
        const row = e.target.closest ? e.target.closest(".wx-relation-editor-row") : null;

        if (row) {
            this._unmark(row);
        }
    }

    /**
     * Applies a drop, moving the dragged relation to the marked place.
     * @param {Event} e - The drop event.
     */
    _onDrop(e) {
        e.preventDefault();

        const row = e.target.closest ? e.target.closest(".wx-relation-editor-row") : null;
        const side = row && row.dataset ? row.dataset.dropSide : null;
        const dragged = this._dragged;

        this._clearDropMarks();
        this._dragged = null;

        if (dragged && row) {
            this._move(dragged, this._insertBefore(row.dataset.type, side, dragged));
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
     * Removes the drop marks of every row.
     */
    _clearDropMarks() {
        for (const row of this._rows.childNodes) {
            this._unmark(row);
        }
    }

    /**
     * Removes the drop and drag marks of one row.
     * @param {HTMLElement} row - The row.
     */
    _unmark(row) {
        if (!row.classList) {
            return;
        }

        row.classList.remove("wx-drop-target", "wx-drop-before", "wx-drop-after", "wx-relation-editor-dragging");
        row.removeAttribute("data-drop-side");

        if (row.dataset) {
            delete row.dataset.dropSide;
        }
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
        const host = document.createElement("div");

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
