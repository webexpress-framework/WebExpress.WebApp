/**
 * A control managing the group-to-policy assignments of a protected resource
 * (see the identity model: Identity -> Group -> Policy -> Permission). It is
 * typically hosted inside a modal ("Manage permissions for ...").
 *
 * The surface is a single table, which is why the control derives from the REST
 * table rather than rendering a layout of its own: the first column names the
 * group, the second carries the policies of that group as chips that are edited
 * inline with the move control, the first row assigns a further group and the
 * options menu of a row revokes it. Paging is left to the pagination control the
 * host binds through the paging bind, so the surface itself stays a table.
 *
 * A row is a group with all of its policies, mirroring IIdentityGroup.Policies
 * in the identity model. The group id is therefore the row identity and the
 * policy set is the edited value, which keeps a group's chips together on one
 * page.
 *
 * Declarative configuration: the host carries a wx-service island named "data"
 * for the assignment endpoint plus two islands named "groups" and "policies"
 * that supply the directories - the groups the add row offers and the policies
 * the chips are picked from.
 *
 * REST contract:
 *   GET    {data}?q=…&p=…&l=…                    → { items: [{ groupId, groupName, policyIds }], total, assignedGroupIds }
 *   POST   {data}   body { groupId, policyIds }  → the created entry
 *   PUT    {data}/{groupId} body { policyIds }   → the updated entry
 *   DELETE {data}/{groupId}                      → 204
 *   GET    {groups}?q=…                          → [{ id, name }]
 *   GET    {policies}?q=…                        → [{ id, name, description }]
 *
 * assignedGroupIds spans all pages, so a group that already owns a row beyond
 * the visible window is still kept out of the add row.
 *
 * Events dispatched on the host element:
 *   webexpress.webapp.Event.PERMISSION_ASSIGNED_EVENT detail: { groupId, policyIds }
 *   webexpress.webapp.Event.PERMISSION_REMOVED_EVENT  detail: { groupId }
 */
webexpress.webapp.PermissionCtrl = class extends webexpress.webapp.TableCtrl {
    /**
     * Construct a new PermissionCtrl.
     * @param {HTMLElement} element - host element.
     */
    constructor(element) {
        // the table base consumes the islands, seeds the store, wires the pager
        // and issues the first load; the directories are fetched alongside it
        super(element);

        const services = webexpress.webapp.ServiceRegistry.fromElement(element);
        this._groupsService = services.groups || null;
        this._policiesService = services.policies || null;

        this._groupRecords = [];
        this._policyRecords = [];
        this._assignedGroupIds = [];

        element.classList.add("wx-permission");

        // the inline editor and the options menu report through bubbling events,
        // so a single listener on the host covers every row of every page
        element.addEventListener(webexpress.webui.Event.SAVE_INLINE_EDIT_EVENT, (e) => this._onInlineSave(e));
        element.addEventListener(webexpress.webui.Event.CLICK_EVENT, (e) => this._onOptionClick(e));

        this._directories = this._loadDirectories();

        // guards the add row against the placeholder render the base performs
        // while this constructor is still running
        this._ready = true;
    }

    /**
     * Indicates whether the surface only reports the assignments. Read from the
     * host rather than cached, because the base renders once before this
     * constructor body runs.
     * @returns {boolean} True when the surface is read-only.
     */
    get _readonly() {
        return this._element.dataset.readonly === "true";
    }

    /**
     * Keeps the layout of the permission endpoint out of the column persistence
     * of the REST table: the surface has two fixed columns, so there is nothing
     * to persist and the endpoint carries no configure route.
     */
    _initPersistenceListeners() {
    }

    /**
     * Reserves the actions column even before the first group was assigned,
     * because the add row always carries the add affordance.
     */
    _recalculateHasOptions() {
        super._recalculateHasOptions();

        if (!this._readonly) {
            this._hasOptions = true;
        }
    }

    /**
     * Loads the requested page of entries and renders it as a table. When a
     * revocation empties the last page, the page is clamped and re-queried, so
     * the user never faces an empty window while entries remain.
     * @returns {Promise<void>} Resolves when the load completed.
     */
    async _load() {
        if (!this._restUri || !this._service) {
            return;
        }

        this._toggleProgress(true);

        const state = this._store.getState();
        const result = await this._service.query({
            search: state.search || "",
            page: state.page || 0,
            pageSize: state.pageSize
        });

        if (!result.ok) {
            // a superseded query arrives as an abort and is not an error
            if (result.error.kind === "abort") {
                return;
            }

            console.error("PermissionCtrl: load failed", webexpress.webapp.ServiceResult.describe(result, { uri: this._restUri }));
            this._store.setState({ error: result.error });
            this._toggleProgress(false);
            return;
        }

        // the chips resolve their labels through the policy directory, so the
        // first page waits for it rather than painting unlabeled chips
        await this._directories;

        const model = webexpress.webapp.permissionModel;
        const page = model.normalizeList(result.data);
        const clamped = model.clampPage(state.page || 0, model.pageCount(page.total, this._pageSize));

        if (clamped !== (state.page || 0) && page.items.length === 0 && page.total > 0) {
            this._store.setState({ page: clamped });
            return this._load();
        }

        this._assignedGroupIds = page.assignedGroupIds;
        this._store.setState({ total: page.total, page: clamped, error: null });

        // the directory may have arrived after an earlier page was built, so the
        // columns carrying the chip options are rebuilt with every page
        this._columns = null;
        this.updateData({
            columns: this._buildColumns(),
            rows: page.items.map((entry) => this._buildRow(entry))
        });

        this._dispatch(webexpress.webui.Event.DATA_ARRIVED_EVENT, { id: this._element.id, page: this._page });
        this._toggleProgress(false);
    }

    /**
     * Loads the group and the policy directory once. A missing service yields
     * an empty directory, which degrades the add row and the chip picker to
     * empty pickers rather than failing the surface.
     * @returns {Promise<void>} Resolves when both directories arrived.
     */
    async _loadDirectories() {
        const [groups, policies] = await Promise.all([
            this._queryDirectory(this._groupsService),
            this._queryDirectory(this._policiesService)
        ]);

        this._groupRecords = groups;
        this._policyRecords = policies;
    }

    /**
     * Queries a directory service and normalises its answer, tolerating both a
     * flat array and an items envelope.
     * @param {object} service - The directory service, may be null.
     * @returns {Promise<Array<object>>} The directory records.
     */
    async _queryDirectory(service) {
        if (!service) {
            return [];
        }

        const result = await service.query({});
        if (!result.ok) {
            console.warn("PermissionCtrl: directory load failed", webexpress.webapp.ServiceResult.describe(result));
            return [];
        }

        return Array.isArray(result.data) ? result.data : ((result.data && result.data.items) || []);
    }

    /**
     * Builds the two columns of the surface. The policy column declares the
     * move template, which renders the chips read-only and opens the move
     * control for the inline edit.
     * @returns {Array<object>} The column descriptors.
     */
    _buildColumns() {
        return [
            {
                id: "group",
                name: "group",
                label: this._i18n("webexpress.webapp:permission.column.group", "Group"),
                visible: true
            },
            {
                id: "policies",
                name: "policies",
                label: this._i18n("webexpress.webapp:permission.column.policies", "Permissions"),
                visible: true,
                template: {
                    type: "move",
                    options: {
                        editable: !this._readonly,
                        options: JSON.stringify(webexpress.webapp.permissionModel.policyOptions(this._policyRecords))
                    }
                }
            }
        ];
    }

    /**
     * Builds the row of one entry. The policy set travels as the semicolon
     * separated value the move control reads.
     * @param {object} entry - The entry record.
     * @returns {object} The row descriptor.
     */
    _buildRow(entry) {
        const policyIds = webexpress.webapp.permissionModel.policyIds(entry);

        return {
            id: entry.groupId,
            cells: [
                { content: entry.groupName || entry.groupId },
                { content: policyIds.join(";") }
            ],
            options: this._readonly ? null : [this._buildRevokeOption(entry)]
        };
    }

    /**
     * Builds the revoke entry of the options menu. The group id travels on the
     * item, so the click handler resolves the row without reading the DOM.
     * @param {object} entry - The entry record.
     * @returns {object} The dropdown item.
     */
    _buildRevokeOption(entry) {
        return {
            id: `${this._element.id}_revoke_${entry.groupId}`,
            type: "item",
            command: "revoke",
            groupId: entry.groupId,
            text: this._i18n("webexpress.webapp:permission.remove", "Revoke"),
            icon: this._iconClass("fas fa-trash", "wx-icon-light-trash"),
            color: "text-danger"
        };
    }

    /**
     * Renders the table and puts the add row in front of it. The base replaces
     * the whole body on every pass, so the add row is re-inserted rather than
     * rebuilt, which keeps the picked but not yet assigned values.
     */
    render() {
        super.render();

        if (!this._ready || this._readonly) {
            return;
        }

        if (!this._addRowElement) {
            this._addRowElement = this._buildAddRow();
        }

        this._syncAddRow();
        this._body.prepend(this._addRowElement);
    }

    /**
     * Builds the add row: a group select, the chip picker of the new entry and
     * the add affordance in the actions cell.
     * @returns {HTMLElement} The add row element.
     */
    _buildAddRow() {
        const row = document.createElement("div");
        row.className = "wx-grid-row wx-permission-add";
        row.setAttribute("role", "row");

        const groupCell = document.createElement("div");
        groupCell.className = "wx-grid-cell";
        this._groupSelect = document.createElement("select");
        this._groupSelect.className = "form-select wx-permission-group";
        groupCell.appendChild(this._groupSelect);

        const policyCell = document.createElement("div");
        policyCell.className = "wx-grid-cell";
        policyCell.appendChild(this._buildAddEditor());

        const actionCell = document.createElement("div");
        actionCell.className = "wx-grid-cell wx-table-actions";
        this._assignButton = document.createElement("button");
        this._assignButton.type = "button";
        this._assignButton.className = "wx-permission-assign-btn";
        this._assignButton.title = this._i18n("webexpress.webapp:permission.assign", "Assign");
        this._assignButton.setAttribute("aria-label", this._assignButton.title);
        this._assignButton.appendChild(webexpress.webui.Icon.create(this._iconClass("fas fa-plus", "wx-icon-light-plus")));
        this._assignButton.addEventListener("click", () => this._assign());
        actionCell.appendChild(this._assignButton);

        row.appendChild(groupCell);
        row.appendChild(policyCell);
        row.appendChild(actionCell);

        return row;
    }

    /**
     * Builds the chip picker of the add row. It is the same inline editor the
     * assigned rows use, so picking policies for a new group behaves exactly
     * like changing them for an existing one.
     * @returns {HTMLElement} The editor container.
     */
    _buildAddEditor() {
        const container = document.createElement("div");
        const editor = document.createElement("div");
        editor.id = `${this._element.id}_add_policies`;

        this._addEditorCtrl = new webexpress.webui.InputMoveCtrl(editor);
        this._addEditorCtrl.options = webexpress.webapp.permissionModel.policyOptions(this._policyRecords);
        editor._wx_controller = this._addEditorCtrl;
        container.appendChild(editor);

        this._addSmartEdit = new webexpress.webui.SmartEditCtrl(container);

        return container;
    }

    /**
     * Refreshes the group select of the add row, which offers the groups that
     * do not own a row yet. A still assignable selection survives the rebuild,
     * so a reload does not discard what the user picked. The chip picker needs
     * no refresh: the policy directory is loaded once, before the first row is
     * rendered.
     */
    _syncAddRow() {
        const model = webexpress.webapp.permissionModel;
        const available = model.availableGroups(this._groupRecords, this._assignedGroupIds);
        const current = this._groupSelect.value;

        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = this._i18n("webexpress.webapp:permission.select.placeholder", "Please select…");

        this._groupSelect.replaceChildren(placeholder);
        for (const group of available) {
            const option = document.createElement("option");
            option.value = group.id;
            option.textContent = group.name || group.id;
            this._groupSelect.appendChild(option);
        }
        this._groupSelect.value = available.some((group) => String(group.id) === current) ? current : "";
    }

    /**
     * Assigns the picked policies to the selected group and reloads the page,
     * so paging and filtering stay authoritative on the server.
     * @returns {Promise<void>} Resolves when the assignment completed.
     */
    async _assign() {
        const groupId = this._groupSelect.value;
        if (!groupId || !this._service) {
            return;
        }

        const policyIds = webexpress.webapp.permissionModel.policyIds(this._addSmartEdit.value);
        const result = await this._service.create({ groupId: groupId, policyIds: policyIds });

        if (!result.ok) {
            console.warn("PermissionCtrl: assign failed", webexpress.webapp.ServiceResult.describe(result));
            return;
        }

        this._groupSelect.value = "";
        this._addSmartEdit.value = [];

        await this._load();
        this._dispatch(webexpress.webapp.Event.PERMISSION_ASSIGNED_EVENT, { groupId: groupId, policyIds: policyIds });
    }

    /**
     * Applies an inline edit of the policy chips. The add row keeps its picked
     * value locally until it is assigned, so only the rows of stored entries
     * reach the endpoint.
     * @param {Event} e - The inline edit save event.
     */
    _onInlineSave(e) {
        const sender = e.detail && e.detail.sender;
        const row = sender && typeof sender.closest === "function" ? sender.closest(".wx-grid-row") : null;

        if (!row || row === this._addRowElement || !row._dataRowRef) {
            return;
        }

        this._setPolicies(row._dataRowRef.id, e.detail.value);
    }

    /**
     * Applies a click on an entry of an options menu.
     * @param {Event} e - The dropdown click event.
     */
    _onOptionClick(e) {
        const item = e.detail && e.detail.item;

        if (item && item.command === "revoke") {
            this._revoke(item.groupId);
        }
    }

    /**
     * Replaces the policy set of a group through PUT and reloads the page.
     * @param {string} groupId - The id of the group.
     * @param {Array<string>|string} value - The new policy set.
     * @returns {Promise<void>} Resolves when the update completed.
     */
    async _setPolicies(groupId, value) {
        if (!groupId || !this._service) {
            return;
        }

        const model = webexpress.webapp.permissionModel;
        const policyIds = model.policyIds(value);
        const result = await this._service.update({ policyIds: policyIds }, { path: model.entryPath(groupId) });

        if (!result.ok) {
            console.warn("PermissionCtrl: update failed", webexpress.webapp.ServiceResult.describe(result));
            return;
        }

        await this._load();
        this._dispatch(webexpress.webapp.Event.PERMISSION_ASSIGNED_EVENT, { groupId: groupId, policyIds: policyIds });
    }

    /**
     * Revokes every policy of a group through DELETE and reloads the page.
     * @param {string} groupId - The id of the group.
     * @returns {Promise<void>} Resolves when the revocation completed.
     */
    async _revoke(groupId) {
        if (!groupId || !this._service) {
            return;
        }

        const result = await this._service.remove({ path: webexpress.webapp.permissionModel.entryPath(groupId) });

        if (!result.ok && result.status !== 204) {
            console.warn("PermissionCtrl: revoke failed", webexpress.webapp.ServiceResult.describe(result));
            return;
        }

        await this._load();
        this._dispatch(webexpress.webapp.Event.PERMISSION_REMOVED_EVENT, { groupId: groupId });
    }

    /**
     * Gets the entries of the currently loaded page.
     * @returns {Array<object>} The entries as { groupId, policyIds }.
     */
    get value() {
        return this._rows.map((row) => ({
            groupId: row.id,
            policyIds: webexpress.webapp.permissionModel.policyIds(row.cells[1] && row.cells[1].content)
        }));
    }
};

// register for declarative auto-init
webexpress.webui.Controller.registerClass("wx-webapp-permission", webexpress.webapp.PermissionCtrl);
