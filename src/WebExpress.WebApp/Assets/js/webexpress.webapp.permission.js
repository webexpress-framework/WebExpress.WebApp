/**
 * A control managing the group-to-policy assignments of a protected resource
 * (see the identity model: Identity -> Group -> Policy -> Permission). It is
 * typically hosted inside a modal ("Manage permissions for ...").
 *
 * The surface is a single table, which is why the control derives from the REST
 * table rather than rendering a layout of its own: the first column names the
 * group, the second carries the policies of that group as chips that are edited
 * inline with the move control and the options menu of a row revokes it. Paging
 * is left to the pagination control the host binds through the paging bind, so
 * the surface itself stays a table.
 *
 * Further groups are assigned through the dialog the toolbar above the table
 * opens, not through a row of the table: picking groups together with the policy
 * set they receive needs more room than a table row offers, and a half-filled
 * row reads like an assignment that already exists. The table therefore shows
 * stored assignments only. One dialog can assign the same policy set to several
 * groups at once, which is how a resource is usually opened up.
 *
 * A row is a group with all of its policies, mirroring IIdentityGroup.Policies
 * in the identity model. The group id is therefore the row identity and the
 * policy set is the edited value, which keeps a group's chips together on one
 * page.
 *
 * Declarative configuration: the host carries a wx-service island named "data"
 * for the assignment endpoint plus two islands named "groups" and "policies"
 * that supply the directories - the groups the assign dialog offers and the
 * policies the chips are picked from.
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
 * the visible window is still kept out of the assign dialog.
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
        this._dialog = null;

        element.classList.add("wx-permission");

        // the inline editor and the options menu report through bubbling events,
        // so a single listener on the host covers every row of every page
        element.addEventListener(webexpress.webui.Event.SAVE_INLINE_EDIT_EVENT, (e) => this._onInlineSave(e));
        element.addEventListener(webexpress.webui.Event.CLICK_EVENT, (e) => this._onOptionClick(e));

        this._directories = this._loadDirectories();

        if (!this._readonly) {
            this._buildToolbar();
        }
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

        this._syncAssignButton();

        this._dispatch(webexpress.webui.Event.DATA_ARRIVED_EVENT, { id: this._element.id, page: this._page });
        this._toggleProgress(false);
    }

    /**
     * Loads the group and the policy directory once. A missing service yields
     * an empty directory, which degrades the assign dialog and the chip picker
     * to empty pickers rather than failing the surface.
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
            icon: this._iconClass("trash"),
            color: "text-danger"
        };
    }

    /**
     * Puts the assign affordance above the table, which is the one action of the
     * surface that does not belong to a stored assignment.
     */
    _buildToolbar() {
        this._toolbar = document.createElement("div");
        this._toolbar.className = "wx-permission-toolbar";

        this._assignButton = document.createElement("button");
        this._assignButton.type = "button";
        this._assignButton.className = "btn btn-primary wx-permission-assign";
        this._assignButton.appendChild(webexpress.webui.Icon.create(this._iconClass("plus"), "me-2"));
        this._assignButton.appendChild(document.createTextNode(this._i18n("webexpress.webapp:permission.assign.groups", "Assign groups")));
        this._assignButton.addEventListener("click", () => this._openAssignDialog());

        this._toolbar.appendChild(this._assignButton);

        // ahead of the progress bar the base put in front of the table, which
        // reports on the table rather than on the toolbar
        this._element.prepend(this._toolbar);
    }

    /**
     * Opens the assign dialog. It is built once and refilled on every open, so
     * a dialog opened after a reload offers the groups of the current state
     * rather than the ones the first open happened to see.
     */
    _openAssignDialog() {
        if (this._readonly) {
            return;
        }

        if (!this._dialog) {
            this._dialog = this._buildAssignDialog();
        }

        this._syncAssignDialog();
        this._dialog.show();
    }

    /**
     * Builds the host and the controller of the assign dialog: the groups to
     * assign, the policies they carry afterwards and the confirming action.
     * @returns {object} The modal controller of the dialog.
     */
    _buildAssignDialog() {
        const host = document.createElement("div");
        host.id = `${this._element.id}_assign`;
        host.className = "wx-permission-assign-modal";
        host.setAttribute("data-scrollable", "false");

        const header = document.createElement("span");
        header.className = "wx-modal-header";
        header.textContent = this._i18n("webexpress.webapp:permission.assign.groups", "Assign groups");

        const content = document.createElement("div");
        content.className = "wx-modal-content wx-permission-assign-form";

        const picker = document.createElement("div");
        picker.id = `${host.id}_groups`;
        picker.setAttribute("placeholder", this._i18n("webexpress.webapp:permission.select.placeholder", "Please select…"));

        // an assignment without a group has nothing to write, so the field is
        // marked as required and the confirming action stays disabled until one
        // is picked
        picker.setAttribute("aria-required", "true");
        picker.addEventListener(webexpress.webui.Event.CHANGE_VALUE_EVENT, () => this._syncConfirmButton());
        content.appendChild(this._buildField(this._i18n("webexpress.webapp:permission.groups", "Groups"), picker, true));

        const editor = document.createElement("div");
        editor.id = `${host.id}_policies`;
        content.appendChild(this._buildField(this._i18n("webexpress.webapp:permission.column.policies", "Permissions"), editor));

        const footer = document.createElement("div");
        footer.className = "wx-modal-footer";

        this._confirmButton = document.createElement("button");
        this._confirmButton.type = "button";
        this._confirmButton.className = "btn btn-primary wx-permission-assign-confirm";
        this._confirmButton.appendChild(webexpress.webui.Icon.create(this._iconClass("plus"), "me-2"));
        this._confirmButton.appendChild(document.createTextNode(this._i18n("webexpress.webapp:permission.assign", "Assign")));
        this._confirmButton.addEventListener("click", () => this._assign());
        footer.appendChild(this._confirmButton);

        host.appendChild(header);
        host.appendChild(content);
        host.appendChild(footer);
        document.body.appendChild(host);

        // the dialog lives outside the host, so it would outlive the surface it
        // belongs to unless it is torn down with it
        (this._element._wxCleanup = this._element._wxCleanup || []).push(() => host.remove());

        // the dialog moves the sections onto its own bars, so the pickers are
        // mounted afterwards - on the hosts where the section ended up
        const modal = new webexpress.webui.ModalCtrl(host);

        this._groupPicker = new webexpress.webui.InputSelectionCtrl(picker);

        // several groups usually receive the same policy set at once, so the
        // dialog assigns the picked set to every picked group rather than being
        // reopened per group
        this._groupPicker.multiSelect = true;

        this._policyEditor = new webexpress.webui.InputMoveCtrl(editor);

        return modal;
    }

    /**
     * Builds one labelled field of the assign dialog.
     * @param {string} label - The caption of the field.
     * @param {HTMLElement} control - The control the caption names.
     * @param {boolean} [required] - Whether the field has to be filled in.
     * @returns {HTMLElement} The field.
     */
    _buildField(label, control, required) {
        const field = document.createElement("div");
        field.className = "wx-permission-field";

        const caption = document.createElement("label");
        caption.className = "wx-permission-label";
        caption.textContent = label;

        if (required) {
            // the asterisk the framework forms mark a mandatory field with
            const marker = document.createElement("span");
            marker.className = "wx-form-required";
            marker.textContent = "*";
            caption.appendChild(marker);
        }

        field.appendChild(caption);
        field.appendChild(control);

        return field;
    }

    /**
     * Refills the dialog for a new assignment: the group picker offers the
     * groups that do not own a row yet and the chip picker starts empty. What a
     * discarded dialog held is not restored - it is opened to assign a group,
     * not to resume one. Both option lists are refreshed here rather than at
     * build time, because the dialog can be opened before the directories
     * arrive.
     */
    _syncAssignDialog() {
        const model = webexpress.webapp.permissionModel;

        this._groupPicker.options = model.groupOptions(
            model.availableGroups(this._groupRecords, this._assignedGroupIds));
        this._groupPicker.value = [];

        this._policyEditor.options = model.policyOptions(this._policyRecords);
        this._policyEditor.value = [];
        this._syncConfirmButton();
    }

    /**
     * Keeps the confirming action of the dialog in step with the picked groups,
     * which is what enforces the required field: an assignment without a group
     * has nothing to write.
     */
    _syncConfirmButton() {
        this._confirmButton.disabled = this._pickedGroupIds().length === 0;
    }

    /**
     * Returns the groups the dialog assigns to.
     * @returns {Array<string>} The picked group ids.
     */
    _pickedGroupIds() {
        return (this._groupPicker.value || []).map(String).filter((id) => id.length > 0);
    }

    /**
     * Keeps the assign affordance in step with the directory: once every group
     * owns a row, the dialog could only offer an empty select, so the button
     * states that instead of opening one.
     */
    _syncAssignButton() {
        if (!this._assignButton) {
            return;
        }

        const exhausted = webexpress.webapp.permissionModel
            .availableGroups(this._groupRecords, this._assignedGroupIds).length === 0;

        this._assignButton.disabled = exhausted;
        this._assignButton.title = exhausted
            ? this._i18n("webexpress.webapp:permission.assign.none", "Every group already carries policies.")
            : "";
    }

    /**
     * Assigns the picked policies to every picked group and reloads the page, so
     * paging and filtering stay authoritative on the server. The groups are
     * written one after another, because each one is an entry of its own on the
     * endpoint; the dialog closes only once all of them were written and keeps
     * the rejected ones picked, which is what a retry needs.
     * @returns {Promise<void>} Resolves when the assignment completed.
     */
    async _assign() {
        const groupIds = this._pickedGroupIds();
        if (groupIds.length === 0 || !this._service) {
            return;
        }

        const policyIds = webexpress.webapp.permissionModel.policyIds(this._policyEditor.value);
        const assigned = [];
        const rejected = [];

        for (const groupId of groupIds) {
            const result = await this._service.create({ groupId: groupId, policyIds: policyIds });

            if (result.ok) {
                assigned.push(groupId);
            } else {
                console.warn("PermissionCtrl: assign failed", webexpress.webapp.ServiceResult.describe(result));
                rejected.push(groupId);
            }
        }

        if (rejected.length === 0) {
            this._dialog.hide();
        } else {
            this._groupPicker.value = rejected;
        }

        if (assigned.length === 0) {
            return;
        }

        await this._load();

        // one event per group, because a listener reacts to the policy set a
        // group carries rather than to the batch it was assigned in
        for (const groupId of assigned) {
            this._dispatch(webexpress.webapp.Event.PERMISSION_ASSIGNED_EVENT, { groupId: groupId, policyIds: policyIds });
        }
    }

    /**
     * Applies an inline edit of the policy chips. The dialog reports nothing
     * here: it lives outside the host and keeps its picked value until it is
     * assigned, so only the rows of stored entries reach the endpoint.
     * @param {Event} e - The inline edit save event.
     */
    _onInlineSave(e) {
        const sender = e.detail && e.detail.sender;
        const row = sender && typeof sender.closest === "function" ? sender.closest(".wx-grid-row") : null;

        if (!row || !row._dataRowRef) {
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
