/**
 * Scrum backlog control.
 * Adds context menus, sprint editing/deletion, precise drag & drop ranking,
 * keyboard accessibility, sprint completion/start logic, smart duration selection,
 * configurable icons, bootstrap-based modals and item selection (single & multi).
 */
webexpress.webapp.ScrumBacklogCtrl = class extends webexpress.webapp.Data {

    _restUri = null;
    _viewState = null;
    _title = null;
    _sprints = [];
    _items = [];
    _itemIndex = new Map();
    _sprintIndex = new Map();
    _dragItemId = null;
    _dragItemIds = [];
    _icons = {};
    _selectable = true;
    _readonly = false;
    _selectedItemId = null;
    _selectedIds = new Set();
    _anchorId = null;

    _ctxMenuEl = null;

    /**
     * Initializes the backlog control.
     * @param {HTMLElement} element - The host element.
     */
    constructor(element) {
        // resolve the data service and seed the sprints and items from the
        // optional wx-state island before super, so the component owns the
        // store and the service map; the model builds the sprint and item
        // paths and the bodies
        const islandServices = webexpress.webapp.ServiceRegistry.fromElement(element);
        const services = islandServices;
        const initialState = Object.assign({ sprints: [], items: [] }, webexpress.webapp.Data.readState(element));

        super(element, { state: initialState, services: services });

        this._title = element.dataset.title || element.getAttribute("data-title") || this._i18n("webexpress.webapp:scrum.backlog", "Backlog");

        const selAttr = element.dataset.selectable || element.getAttribute("data-selectable");
        this._selectable = selAttr !== "false";
        this._readonly = element.dataset.readonly === "true";

        this._service = this.useService("data");
        this._restUri = this._service ? this._service.baseUri : null;

        // the resource a scope renders. when present, the backlog data is a
        // central resource the enclosing scope owns and loads; selection and
        // drag state stay local to this control.
        this._resource = (element.dataset && element.dataset.wxResource) || null;

        // optional users service backing the assignee picker
        this._users = this.useService("users");

        // the story-point scale offered in the assign/estimate dialog; falls back
        // to a rounded fibonacci sequence when the host carries no scale
        this._estimationScale = webexpress.webapp.scrumBacklogModel.estimationScale(element.dataset.estimationScale);

        // read configurable icons or use theme-resolved defaults; icons without
        // a light glyph stay on their font awesome class in both themes
        // item type icons are not configured here - they are delivered per item via item.icon from the rest api
        this._icons = {
            // sections and status
            active: element.dataset.iconActive || "fas fa-play-circle",
            planned: element.dataset.iconPlanned || this._iconClass("far fa-calendar-alt", "calendar"),
            backlog: element.dataset.iconBacklog || this._iconClass("fas fa-list", "list"),
            sprintMenu: element.dataset.iconSprintMenu || this._iconClass("fas fa-ellipsis", "more"),

            // context menu actions
            moveToBacklog: element.dataset.iconMoveToBacklog || this._iconClass("fas fa-inbox", "inbox"),
            moveToSprint: element.dataset.iconMoveToSprint || this._iconClass("fas fa-share", "share"),
            startSprint: element.dataset.iconStartSprint || this._iconClass("fas fa-play", "play"),
            completeSprint: element.dataset.iconCompleteSprint || "fas fa-check-double",
            editSprint: element.dataset.iconEditSprint || this._iconClass("fas fa-edit", "edit"),
            deleteSprint: element.dataset.iconDeleteSprint || this._iconClass("fas fa-trash-alt", "trash"),

            // item assignment and estimation
            assign: element.dataset.iconAssign || "fas fa-user-plus",
            estimate: element.dataset.iconEstimate || "fas fa-scale-balanced"
        };

        element.removeAttribute("data-rest-uri");
        element.removeAttribute("data-title");
        element.removeAttribute("data-selectable");
        element.removeAttribute("data-readonly");
        element.removeAttribute("data-estimation-scale");

        element.classList.add("wx-scrum-backlog");
        if (this._selectable) {
            element.classList.add("wx-scrum-selectable");
        }

        // global keyboard shortcuts (Ctrl+A, Escape)
        element.addEventListener("keydown", this._onRootKeyDown);

        // when the server seeded the backlog through the data-wx-state island,
        // render it without a round trip; otherwise load from the endpoint or
        // parse the inline static configuration
        const seeded = this.state;
        if (this._resource) {
            // scope mode: the enclosing scope loads the backlog resource centrally
            this._attachToScope(element);
        } else if ((Array.isArray(seeded.sprints) && seeded.sprints.length > 0)
            || (Array.isArray(seeded.items) && seeded.items.length > 0)) {
            this.data = { sprints: seeded.sprints || [], items: seeded.items || [] };
        } else if (this._restUri) {
            this._load();
        } else {
            this._parseStaticConfig();
            this.render();
        }

        // the backlog does not run the Data mount, so the live update wiring
        // happens here: an external change of the service's domains re-queries
        // and flashes, so changes made by other users re-render standalone too
        if (!this._resource) {
            this._dataChanges = webexpress.webapp.DataChangeSubscription.attachReload(
                [this._service], () => this._load(), element);
        }
    }

    /**
     * Attaches the backlog to the enclosing scope ViewState and renders its
     * resource slice. The scope owns the service and the central load, so the
     * backlog re-renders whenever the scope re-queries the resource, while its
     * sprint and item mutations still flow through the scope service.
     * @param {HTMLElement} element The host element.
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

            // the assignee picker's users service also comes from the scope in
            // scope mode, resolved by the type-safe users binding the control
            // emits, since the control owns no islands of its own
            const usersName = element.dataset && element.dataset.wxUsers;
            const usersService = usersName ? viewState.useService(usersName) : null;
            if (usersService) {
                this._users = usersService;
            }

            const unsubscribe = viewState.watch((state) => state[this._resource], (slice) => this._applySlice(slice));
            (element._wxCleanup = element._wxCleanup || []).push(unsubscribe);

            this._applySlice(viewState.getState()[this._resource]);
        });
    }

    /**
     * Renders a backlog resource slice the scope loaded centrally. The raw
     * sprints and items response flows through the data setter, which normalises
     * and renders it; the local selection and drag state are preserved.
     * @param {object} slice The resource slice { items, total, data, loading, error }.
     */
    _applySlice(slice) {
        slice = slice || {};
        if (slice.data) {
            this.data = slice.data;
        }
    }

    /**
     * Parses sprints and items from an inline json configuration script.
     * @returns {void}
     */
    _parseStaticConfig() {
        const cfgEl = this._element.querySelector(":scope > script[type='application/json']");
        if (!cfgEl) {
            return;
        }
        try {
            const parsed = JSON.parse(cfgEl.textContent);
            const norm = webexpress.webapp.scrumBacklogModel.normalizeData(parsed);
            this._sprints = norm.sprints;
            this._items = norm.items;
            this._rebuildIndexes();
            this._ensureRanking();
        } catch (e) {
            console.error("ScrumBacklogCtrl: failed to parse static config", e);
        }
    }

    /** @returns {Array<Object>} */
    get sprints() {
        return this._sprints.slice();
    }

    /** @returns {Array<Object>} */
    get items() {
        return this._items.slice();
    }

    /**
     * Returns the currently selected item ids.
     * @returns {Array<string>}
     */
    get selectedItemIds() {
        return Array.from(this._selectedIds);
    }

    /**
     * Sets the data and rerenders.
     * @param {Object} data - { sprints: [], items: [] }
     */
    set data(data) {
        const norm = webexpress.webapp.scrumBacklogModel.normalizeData(data);
        this._sprints = norm.sprints;
        this._items = norm.items;
        this._rebuildIndexes();
        this._ensureRanking();
        this._pruneSelection();
        this.render();
    }

    /**
     * Rebuilds id-based lookup maps for sprints and items.
     * @returns {void}
     */
    _rebuildIndexes() {
        this._itemIndex = new Map(this._items.map((i) => [i.id, i]));
        this._sprintIndex = new Map(this._sprints.map((s) => [s.id, s]));
    }

    /**
     * Removes ids from the selection that no longer exist.
     * @returns {void}
     */
    _pruneSelection() {
        for (const id of Array.from(this._selectedIds)) {
            if (!this._itemIndex.has(id)) {
                this._selectedIds.delete(id);
            }
        }
        if (this._selectedItemId && !this._itemIndex.has(this._selectedItemId)) {
            this._selectedItemId = null;
        }
        if (this._anchorId && !this._itemIndex.has(this._anchorId)) {
            this._anchorId = null;
        }
    }

    /**
     * Reloads the backlog. The public load surface of the component
     * contract, so intents and the data change subscription can trigger a
     * reload without knowing the internal loader.
     * @returns {void}
     */
    load() {
        return this._load();
    }

    /**
     * Loads sprints and items from the REST API.
     * @returns {void}
     */
    _load() {
        if (!this._restUri) {
            return;
        }

        this._dispatch(webexpress.webui.Event.DATA_REQUESTED_EVENT, { uri: this._restUri });

        this._service.query({})
            .then((r) => {
                if (!r.ok) {
                    throw new Error(r.error ? r.error.message : ("HTTP " + r.status));
                }
                const norm = webexpress.webapp.scrumBacklogModel.normalizeData(r.data);
                this._sprints = norm.sprints;
                this._items = norm.items;
                this._rebuildIndexes();
                this._ensureRanking();
                this._dispatch(webexpress.webui.Event.DATA_ARRIVED_EVENT, { uri: this._restUri });
                this.render();
            })
            .catch((err) => {
                console.error("ScrumBacklogCtrl: failed to load data", err);
                this.render();
            });
    }

    /**
     * Sends a sprint creation request to the REST API.
     * @param {Object} sprint
     * @returns {Promise<Object>}
     */
    _persistSprint(sprint) {
        if (!this._restUri) {
            return Promise.resolve(sprint);
        }
        return this._service.create(sprint)
            .then((r) => {
                if (!r.ok) {
                    throw new Error(r.error ? r.error.message : ("HTTP " + r.status));
                }
                return r.data;
            })
            .catch((err) => {
                console.error("ScrumBacklogCtrl: failed to create sprint", err);
                return sprint;
            });
    }

    /**
     * Sends a sprint update request to the REST API.
     * @param {Object} sprint
     * @returns {Promise<Object>}
     */
    _updateSprint(sprint) {
        if (!this._restUri) {
            return Promise.resolve(sprint);
        }
        return this._service.update(sprint, { path: webexpress.webapp.scrumBacklogModel.sprintPath(sprint.id) })
            .then((r) => {
                if (!r.ok) {
                    throw new Error(r.error ? r.error.message : ("HTTP " + r.status));
                }
                return r.data;
            })
            .catch((err) => {
                console.error("ScrumBacklogCtrl: failed to update sprint", err);
                return sprint;
            });
    }

    /**
     * Sends a sprint deletion request to the REST API.
     * @param {string} sprintId
     * @returns {Promise<void>}
     */
    _deleteSprintRemote(sprintId) {
        if (!this._restUri) {
            return Promise.resolve();
        }
        return this._service.remove({ path: webexpress.webapp.scrumBacklogModel.sprintPath(sprintId) })
            .then((r) => {
                if (!r.ok && r.status !== 204) {
                    throw new Error(r.error ? r.error.message : ("HTTP " + r.status));
                }
                return undefined;
            })
            .catch((err) => {
                console.error("ScrumBacklogCtrl: failed to delete sprint", err);
                return undefined;
            });
    }

    /**
     * Persists a rank change for an item.
     * @param {Object} item
     * @returns {Promise<Object>}
     */
    _persistItemRank(item) {
        if (!this._restUri) {
            return Promise.resolve(item);
        }
        return this._service.update(
            webexpress.webapp.scrumBacklogModel.itemRankBody(item),
            { path: webexpress.webapp.scrumBacklogModel.itemRankPath(item.id) }
        )
            .then((r) => {
                if (!r.ok) {
                    throw new Error(r.error ? r.error.message : ("HTTP " + r.status));
                }
                return r.data;
            })
            .catch((err) => {
                console.error("ScrumBacklogCtrl: failed to persist rank", err);
                return item;
            });
    }

    /**
     * Persists ranks for a list of items in a single batched call when possible.
     * Falls back to individual rank requests when no batch endpoint is configured.
     * @param {Array<Object>} items
     * @returns {void}
     */
    _persistItemRanksBatch(items) {
        if (!items || items.length === 0) {
            return;
        }
        if (!this._restUri) {
            return;
        }
        // single item: regular endpoint
        if (items.length === 1) {
            this._persistItemRank(items[0]);
            return;
        }
        // attempt a batch endpoint; fall back transparently on 404
        this._service.update(
            webexpress.webapp.scrumBacklogModel.rankBatchBody(items),
            { path: webexpress.webapp.scrumBacklogModel.rankBatchPath() }
        )
            .then((r) => {
                if (r.status === 404 || r.status === 405 || (r.error && r.error.kind === "network")) {
                    for (const it of items) {
                        this._persistItemRank(it);
                    }
                }
            })
            .catch(() => {
                for (const it of items) {
                    this._persistItemRank(it);
                }
            });
    }

    /**
     * Adds a sprint locally (and persists it if a rest endpoint is set).
     * @param {Object} sprint
     * @returns {void}
     */
    addSprint(sprint) {
        if (this._readonly) {
            return;
        }

        if (!sprint) {
            return;
        }
        const normalized = webexpress.webapp.scrumBacklogModel.normalizeSprint(sprint);
        this._sprints.push(normalized);
        this._sprintIndex.set(normalized.id, normalized);
        this.render();
        this._dispatch(webexpress.webui.Event.ADD_EVENT, { sprint: normalized });
        this._persistSprint(normalized);
    }

    /**
     * Updates a sprint locally (and persists it if a rest endpoint is set).
     * @param {Object} patch
     * @returns {void}
     */
    updateSprint(patch) {
        if (this._readonly) {
            return;
        }

        if (!patch || !patch.id) {
            return;
        }
        const sprint = this._sprintIndex.get(patch.id);
        if (!sprint) {
            return;
        }
        Object.assign(sprint, patch);
        this.render();
        this._dispatch(webexpress.webui.Event.UPDATED_EVENT, { sprint: sprint });
        this._updateSprint(sprint);
    }

    /**
     * Deletes a sprint locally and unassigns its items to backlog.
     * @param {string} sprintId
     * @returns {void}
     */
    deleteSprint(sprintId) {
        if (this._readonly) {
            return;
        }

        if (!sprintId) {
            return;
        }

        const idx = this._sprints.findIndex((s) => s.id === sprintId);
        if (idx < 0) {
            return;
        }

        for (const item of this._items) {
            if (item.sprintId === sprintId) {
                item.sprintId = null;
                item.status = "backlog";
                item.rank = undefined;
            }
        }

        const removed = this._sprints.splice(idx, 1)[0];
        this._sprintIndex.delete(sprintId);
        this._ensureRanking();
        this.render();

        this._dispatch(webexpress.webui.Event.UPDATED_EVENT, { deletedSprint: removed });
        this._deleteSprintRemote(sprintId);
    }

    /**
     * Completes a sprint by changing its status to closed.
     * @param {string} sprintId
     * @returns {void}
     */
    completeSprint(sprintId) {
        if (this._readonly) {
            return;
        }

        if (sprintId) {
            this.updateSprint({ id: sprintId, status: "closed" });
        }
    }

    /**
     * Starts a sprint by changing its status to active.
     * @param {string} sprintId
     * @returns {void}
     */
    startSprint(sprintId) {
        if (this._readonly) {
            return;
        }

        if (sprintId) {
            this.updateSprint({ id: sprintId, status: "active" });
        }
    }

    /**
     * Selects a single item programmatically by its id (clears other selection).
     * @param {string} itemId
     * @param {boolean} [dispatch=true]
     * @returns {void}
     */
    selectItem(itemId, dispatch = true) {
        const item = itemId ? this._itemIndex.get(itemId) : null;
        this._setSelection(item ? [item.id] : [], item ? item.id : null, null, dispatch);
    }

    /**
     * Sets the selection to the provided list of item ids.
     * @param {Array<string>} ids
     * @param {boolean} [dispatch=true]
     * @returns {void}
     */
    selectItems(ids, dispatch = true) {
        const valid = (ids || []).filter((id) => this._itemIndex.has(id));
        const primary = valid.length > 0 ? valid[valid.length - 1] : null;
        this._setSelection(valid, primary, null, dispatch);
    }

    /**
     * Clears the current selection.
     * @param {boolean} [dispatch=true]
     * @returns {void}
     */
    clearSelection(dispatch = true) {
        this._setSelection([], null, null, dispatch);
    }

    /**
     * Selects all visible items.
     * @returns {void}
     */
    selectAll() {
        if (!this._selectable) {
            return;
        }
        const all = this._visibleItemsInOrder();
        this._setSelection(all.map((i) => i.id), all.length > 0 ? all[all.length - 1].id : null, null, true);
    }

    /**
     * Returns all currently rendered items in display order (active sprint, planned sprints, backlog).
     * @returns {Array<Object>}
     */
    _visibleItemsInOrder() {
        const order = [];
        const active = this._sprints.find((s) => s.status === "active");
        if (active) {
            order.push(...this._itemsForSprintSorted(active.id));
        }
        for (const s of this._sprints) {
            if (s.status === "planned") {
                order.push(...this._itemsForSprintSorted(s.id));
            }
        }
        order.push(...this._itemsForSprintSorted(null));
        return order;
    }

    /**
     * Handles clicks on rows with single/ctrl/shift behavior.
     * @param {Object} item
     * @param {MouseEvent} e
     * @returns {void}
     */
    _handleRowClick(item, e) {
        if (!this._selectable) {
            return;
        }

        const additive = e && (e.ctrlKey || e.metaKey);
        const range = e && e.shiftKey;

        if (range && this._anchorId && this._anchorId !== item.id) {
            const ids = this._idsBetween(this._anchorId, item.id);
            const next = additive ? new Set([...this._selectedIds, ...ids]) : new Set(ids);
            this._setSelection(Array.from(next), item.id, this._anchorId, true, e);
            return;
        }

        if (additive) {
            const next = new Set(this._selectedIds);
            if (next.has(item.id)) {
                next.delete(item.id);
            } else {
                next.add(item.id);
            }
            const primary = next.has(item.id) ? item.id : (next.size > 0 ? Array.from(next).pop() : null);
            this._setSelection(Array.from(next), primary, item.id, true, e);
            return;
        }

        // plain click → single selection
        this._setSelection([item.id], item.id, item.id, true, e);
    }

    /**
     * Returns the ordered list of ids between two item ids (inclusive) based on display order.
     * @param {string} aId
     * @param {string} bId
     * @returns {Array<string>}
     */
    _idsBetween(aId, bId) {
        const order = this._visibleItemsInOrder().map((i) => i.id);
        const ai = order.indexOf(aId);
        const bi = order.indexOf(bId);
        if (ai < 0 || bi < 0) {
            return [bId];
        }
        const [from, to] = ai <= bi ? [ai, bi] : [bi, ai];
        return order.slice(from, to + 1);
    }

    /**
     * Updates internal selection state and patches the DOM directly (no rerender).
     * @param {Array<string>} ids
     * @param {string|null} primaryId
     * @param {string|null} anchorId
     * @param {boolean} dispatch
     * @param {Event} [originalEvent]
     * @returns {void}
     */
    _setSelection(ids, primaryId, anchorId, dispatch, originalEvent = null) {
        const nextSet = new Set(ids);
        const prevSet = this._selectedIds;

        // diff: remove no-longer-selected
        for (const id of prevSet) {
            if (!nextSet.has(id)) {
                this._applyRowSelectionClass(id, false);
            }
        }
        // diff: add newly selected
        for (const id of nextSet) {
            if (!prevSet.has(id)) {
                this._applyRowSelectionClass(id, true);
            }
        }

        const primaryChanged = this._selectedItemId !== primaryId;

        this._selectedIds = nextSet;
        this._selectedItemId = primaryId;
        if (anchorId !== null) {
            this._anchorId = anchorId;
        } else if (nextSet.size === 0) {
            this._anchorId = null;
        }

        if (!dispatch) {
            return;
        }

        // single-select event (back-compat) - only when primary changes
        if (primaryChanged) {
            const singleEv = webexpress.webui.Event.SELECT_ITEM_EVENT || "wx:select-item";
            this._dispatch(singleEv, {
                itemId: this._selectedItemId,
                originalEvent: originalEvent
            });
        }

        // multi-select event - always when called with dispatch=true
        const multiEv = webexpress.webui.Event.SELECT_ITEMS_EVENT || "wx:select-items";
        this._dispatch(multiEv, {
            itemIds: Array.from(this._selectedIds),
            primaryId: this._selectedItemId,
            originalEvent: originalEvent
        });
    }

    /**
     * Adds or removes the selection classes on a row.
     * @param {string} itemId
     * @param {boolean} selected
     * @returns {void}
     */
    _applyRowSelectionClass(itemId, selected) {
        const row = this._element.querySelector(`.wx-scrum-row[data-item-id="${CSS.escape(itemId)}"]`);
        if (!row) {
            return;
        }
        row.classList.toggle("active", selected);
        row.classList.toggle("wx-scrum-row-active", selected);
        if (selected) {
            row.setAttribute("aria-selected", "true");
        } else {
            row.removeAttribute("aria-selected");
        }
    }

    /**
     * Moves a backlog item into a sprint and assigns a rank at the end.
     * @param {string} itemId
     * @param {string|null} sprintId
     * @returns {void}
     */
    moveItemToSprint(itemId, sprintId) {
        this.moveItemsToSprint([itemId], sprintId);
    }

    /**
     * Moves multiple items into a sprint (or backlog) preserving their relative display order.
     * Asks for confirmation when the move enters or leaves the active sprint.
     * @param {Array<string>} itemIds
     * @param {string|null} sprintId
     * @returns {void}
     */
    moveItemsToSprint(itemIds, sprintId) {
        if (this._readonly) {
            return;
        }

        if (!itemIds || itemIds.length === 0) {
            return;
        }
        const targetSprintId = sprintId || null;
        const items = itemIds.map((id) => this._itemIndex.get(id)).filter(Boolean);
        if (items.length === 0) {
            return;
        }

        if (this._crossesActiveSprint(items, targetSprintId)) {
            this._confirmActiveSprintMove(items, targetSprintId, () => {
                this._doMoveItemsToSprint(itemIds, targetSprintId);
            });
            return;
        }

        this._doMoveItemsToSprint(itemIds, targetSprintId);
    }

    /**
     * Performs the actual move without any user confirmation.
     * @param {Array<string>} itemIds
     * @param {string|null} targetSprintId
     * @returns {void}
     */
    _doMoveItemsToSprint(itemIds, targetSprintId) {
        // resolve and order by current display order
        const order = this._visibleItemsInOrder().map((i) => i.id);
        const movedItems = itemIds
            .map((id) => this._itemIndex.get(id))
            .filter(Boolean)
            .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));

        if (movedItems.length === 0) {
            return;
        }

        const previousSprintIds = movedItems.map((i) => i.sprintId || null);

        for (const it of movedItems) {
            it.sprintId = targetSprintId;
            it.status = targetSprintId ? (it.status === "backlog" ? "todo" : it.status) : "backlog";
        }

        // place all moved items at the end of the target group, preserving their relative order
        const targetItems = this._itemsForSprintSorted(targetSprintId).filter((i) => !itemIds.includes(i.id));
        targetItems.push(...movedItems);
        this._rewriteRanks(targetSprintId, targetItems);

        this.render();

        this._dispatch(webexpress.webui.Event.MOVE_EVENT, {
            itemIds: movedItems.map((i) => i.id),
            previousSprintIds: previousSprintIds,
            sprintId: targetSprintId,
            // legacy single-item payload
            itemId: movedItems[0].id,
            previousSprintId: previousSprintIds[0]
        });

        this._persistItemRanksBatch(targetItems);
    }

    /**
     * Moves an item precisely before or after another target item.
     * @param {string} dragId
     * @param {string} targetId
     * @param {"before"|"after"} side
     * @returns {void}
     */
    insertItemRelative(dragId, targetId, side) {
        this.insertItemsRelative([dragId], targetId, side);
    }

    /**
     * Inserts multiple items before or after a target item, preserving their relative order.
     * Asks for confirmation when the move enters or leaves the active sprint.
     * @param {Array<string>} dragIds
     * @param {string} targetId
     * @param {"before"|"after"} side
     * @returns {void}
     */
    insertItemsRelative(dragIds, targetId, side) {
        if (this._readonly) {
            return;
        }

        if (!dragIds || dragIds.length === 0) {
            return;
        }
        const targetItem = this._itemIndex.get(targetId);
        if (!targetItem) {
            return;
        }
        const targetSprintId = targetItem.sprintId || null;
        const items = dragIds.map((id) => this._itemIndex.get(id)).filter((i) => i && i.id !== targetId);
        if (items.length === 0) {
            return;
        }

        // pure reorder within (or outside) the active sprint does not need confirmation
        if (this._crossesActiveSprint(items, targetSprintId)) {
            this._confirmActiveSprintMove(items, targetSprintId, () => {
                this._doInsertItemsRelative(dragIds, targetId, side);
            });
            return;
        }

        this._doInsertItemsRelative(dragIds, targetId, side);
    }

    /**
     * Performs the actual relative insert without any user confirmation.
     * @param {Array<string>} dragIds
     * @param {string} targetId
     * @param {"before"|"after"} side
     * @returns {void}
     */
    _doInsertItemsRelative(dragIds, targetId, side) {
        const targetItem = this._itemIndex.get(targetId);
        if (!targetItem) {
            return;
        }

        const order = this._visibleItemsInOrder().map((i) => i.id);
        const dragItems = dragIds
            .map((id) => this._itemIndex.get(id))
            .filter((i) => i && i.id !== targetId)
            .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));

        if (dragItems.length === 0) {
            return;
        }

        const targetSprintId = targetItem.sprintId || null;
        const previousSprintIds = dragItems.map((i) => i.sprintId || null);
        const dragIdSet = new Set(dragItems.map((i) => i.id));

        for (const it of dragItems) {
            it.sprintId = targetSprintId;
            it.status = targetSprintId ? (it.status === "backlog" ? "todo" : it.status) : "backlog";
        }

        const items = this._itemsForSprintSorted(targetSprintId).filter((i) => !dragIdSet.has(i.id));
        const targetIdx = items.findIndex((i) => i.id === targetId);

        if (targetIdx >= 0) {
            items.splice(side === "before" ? targetIdx : targetIdx + 1, 0, ...dragItems);
        } else {
            items.push(...dragItems);
        }

        this._rewriteRanks(targetSprintId, items);
        this.render();

        this._dispatch(webexpress.webui.Event.MOVE_EVENT, {
            itemIds: dragItems.map((i) => i.id),
            previousSprintIds: previousSprintIds,
            sprintId: targetSprintId,
            itemId: dragItems[0].id,
            previousSprintId: previousSprintIds[0]
        });

        this._persistItemRanksBatch(items);
    }

    /**
     * Moves an item within the same sprint by updating ranks.
     * @param {string} itemId
     * @param {number} delta
     * @returns {void}
     */
    moveItemRank(itemId, delta) {
        if (this._readonly) {
            return;
        }

        const item = this._itemIndex.get(itemId);
        if (!item) {
            return;
        }

        const sprintId = item.sprintId || null;
        const items = this._itemsForSprintSorted(sprintId);
        const fromIdx = items.findIndex((i) => i.id === itemId);
        if (fromIdx < 0) {
            return;
        }

        const toIdx = fromIdx + delta;
        if (toIdx < 0 || toIdx >= items.length) {
            return;
        }

        const moved = items.splice(fromIdx, 1)[0];
        items.splice(toIdx, 0, moved);

        this._rewriteRanks(sprintId, items);

        this.render();
        this._dispatch(webexpress.webui.Event.UPDATED_EVENT, { ranked: true, sprintId: sprintId, itemId: itemId });

        this._persistItemRanksBatch(items);
    }

    /**
     * Ensures each item has a numeric rank within its sprint group.
     * @returns {void}
     */
    _ensureRanking() {
        const sprintIds = new Set();
        sprintIds.add(null);
        for (const s of this._sprints) {
            sprintIds.add(s.id);
        }
        for (const sid of sprintIds) {
            this._rewriteRanks(sid, this._itemsForSprintSorted(sid));
        }
    }

    /**
     * Rewrites ranks sequentially for a sprint group.
     * @param {string|null} sprintId
     * @param {Array<Object>} orderedItems
     * @returns {void}
     */
    _rewriteRanks(sprintId, orderedItems) {
        webexpress.webapp.scrumBacklogModel.rewriteRanks(sprintId, orderedItems);
    }

    /**
     * Returns items for a sprint sorted by rank (fallback: stable by key/title).
     * @param {string|null} sprintId
     * @returns {Array<Object>}
     */
    _itemsForSprintSorted(sprintId) {
        return webexpress.webapp.scrumBacklogModel.itemsForSprintSorted(this._items, sprintId);
    }

    /**
     * Renders the backlog control.
     * @returns {void}
     */
    render() {
        this._rebuildIndexes();
        this._pruneSelection();

        const activeElId = document.activeElement ? document.activeElement.dataset?.itemId : null;

        const el = this._element;
        const frag = document.createDocumentFragment();

        frag.appendChild(this._renderToolbar());

        const active = this._sprints.find((s) => s.status === "active");
        if (active) {
            frag.appendChild(this._renderSection(active, this._itemsForSprintSorted(active.id), {
                empty: this._i18n("webexpress.webapp:scrum.empty.sprint", "No items in this sprint."),
                allowAddToSprint: false,
                allowSprintMenu: true
            }));
        }

        const planned = this._sprints.filter((s) => s.status === "planned");
        const firstPlanned = planned.length > 0 ? planned[0] : null;

        for (const sprint of planned) {
            frag.appendChild(this._renderSection(sprint, this._itemsForSprintSorted(sprint.id), {
                empty: this._i18n("webexpress.webapp:scrum.empty.planned", "No items planned for this sprint."),
                allowAddToSprint: false,
                allowSprintMenu: true
            }));
        }

        const backlogSection = {
            id: "backlog",
            name: this._i18n("webexpress.webapp:scrum.backlog", "Backlog"),
            status: "backlog",
            goal: ""
        };

        frag.appendChild(this._renderSection(backlogSection, this._itemsForSprintSorted(null), {
            empty: this._i18n("webexpress.webapp:scrum.empty.backlog", "Backlog is empty."),
            allowAddToSprint: !!firstPlanned,
            allowSprintMenu: false
        }, firstPlanned));

        el.replaceChildren(frag);

        if (activeElId) {
            const focused = el.querySelector(`.wx-scrum-row[data-item-id="${CSS.escape(activeElId)}"]`);
            if (focused) {
                focused.focus();
            }
        }

        this._dispatch(webexpress.webui.Event.UPDATED_EVENT, {});
    }

    /**
     * Builds the toolbar with the title and the "create sprint" button.
     * @returns {HTMLElement}
     */
    _renderToolbar() {
        const toolbar = document.createElement("div");
        toolbar.className = "wx-scrum-backlog-toolbar";

        const title = document.createElement("h3");
        title.className = "wx-scrum-title";
        title.textContent = this._title;
        toolbar.appendChild(title);

        if (!this._readonly) {
            const createBtn = document.createElement("button");
            createBtn.type = "button";
            createBtn.className = "btn btn-primary btn-sm wx-scrum-create-sprint";
            createBtn.append(
                webexpress.webui.Icon.create(this._iconClass("fas fa-plus", "plus")),
                " " + this._i18n("webexpress.webapp:scrum.create_sprint", "Create sprint")
            );
            createBtn.addEventListener("click", () => this.openSprintDialog());
            toolbar.appendChild(createBtn);
        }

        return toolbar;
    }

    /**
     * Builds a section for a sprint or the backlog.
     * @param {Object} sprint
     * @param {Array<Object>} items
     * @param {Object} opts
     * @param {Object} [targetSprint]
     * @returns {HTMLElement}
     */
    _renderSection(sprint, items, opts, targetSprint) {
        const section = document.createElement("div");
        section.className = "wx-scrum-section";
        section.dataset.sprintId = sprint.id;

        const head = document.createElement("div");
        head.className = "wx-scrum-section-head";

        const status = document.createElement("span");
        status.className = "wx-scrum-status " + (sprint.status || "");

        const statusKey = (sprint.status || "planned").toLowerCase();
        status.appendChild(webexpress.webui.Icon.create(this._icons[statusKey] || this._iconClass("fas fa-circle", "circle"), "wx-scrum-status-icon me-1"));
        status.appendChild(document.createTextNode(sprint.status || ""));
        head.appendChild(status);

        const name = document.createElement("span");
        name.className = "wx-scrum-section-name";
        name.textContent = sprint.name || "";
        head.appendChild(name);

        const meta = document.createElement("span");
        meta.className = "wx-scrum-section-meta";

        const points = items.reduce((sum, i) => sum + (i.points || 0), 0);
        meta.appendChild(this._buildMetaSpan(items.length + " " + this._i18n("webexpress.webapp:scrum.items", "items")));
        meta.appendChild(this._buildMetaSpan(points + " pts"));
        if (sprint.start && sprint.end) {
            meta.appendChild(this._buildMetaSpan(sprint.start + " → " + sprint.end));
        }
        head.appendChild(meta);

        if (opts.allowSprintMenu && !this._readonly) {
            const menuBtn = document.createElement("button");
            menuBtn.type = "button";
            menuBtn.className = "btn btn-sm btn-light wx-scrum-sprint-menu";
            menuBtn.appendChild(webexpress.webui.Icon.create(this._icons.sprintMenu || this._iconClass("fas fa-ellipsis", "more")));
            menuBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                this._openSprintMenu(e, sprint);
            });
            head.appendChild(menuBtn);
        }

        section.appendChild(head);

        // section-level drop handling for empty sections / append-to-end
        if (!this._readonly) {
            section.addEventListener("dragover", (e) => {
                if (sprint.status !== "active" && sprint.status !== "planned" && sprint.status !== "backlog") {
                    return;
                }
                e.preventDefault();
                section.classList.add("wx-scrum-drop-target");
            });

            section.addEventListener("dragleave", () => {
                section.classList.remove("wx-scrum-drop-target");
            });

            section.addEventListener("drop", (e) => {
                section.classList.remove("wx-scrum-drop-target");
                if (e.defaultPrevented) {
                    return;
                }
                const ids = this._readDragIds(e);
                if (ids.length === 0) {
                    return;
                }
                const targetId = sprint.id === "backlog" ? null : sprint.id;
                this.moveItemsToSprint(ids, targetId);
            });
        }

        if (items.length === 0) {
            const empty = document.createElement("div");
            empty.className = "wx-scrum-empty";
            empty.textContent = opts.empty;
            section.appendChild(empty);
        } else {
            for (const item of items) {
                section.appendChild(this._renderRow(item, opts.allowAddToSprint, targetSprint));
            }
        }

        return section;
    }

    /**
     * Builds a single backlog row including context menu, keyboard and dnd sorting.
     * @param {Object} item
     * @param {boolean} allowAddToSprint
     * @param {Object} [targetSprint]
     * @returns {HTMLElement}
     */
    _renderRow(item, allowAddToSprint, targetSprint) {
        const row = document.createElement("div");
        row.className = "wx-scrum-row";
        row.dataset.itemId = item.id;
        row.draggable = !this._readonly;
        row.tabIndex = 0;

        if (this._selectedIds.has(item.id)) {
            row.classList.add("active", "wx-scrum-row-active");
            row.setAttribute("aria-selected", "true");
        }

        row.addEventListener("click", (e) => {
            if (e.target.closest("button")) {
                return;
            }
            this._handleRowClick(item, e);
        });

        row.addEventListener("keydown", (e) => this._handleRowKeyDown(e, item));

        if (!this._readonly) {
            row.addEventListener("contextmenu", (e) => {
                e.preventDefault();
                // ensure the right-clicked item is part of the selection
                if (!this._selectedIds.has(item.id)) {
                    this._setSelection([item.id], item.id, item.id, true, e);
                }
                this._openItemMenu(e, item);
            });
        }

        const type = document.createElement("span");
        type.className = "wx-scrum-type " + (item.type || "");
        // the icon is supplied per item by the rest api (item.icon) as either a
        // css class or an image source; fall back to a neutral marker
        const iconSpec = (typeof item.icon === "string" && item.icon.trim()) ? item.icon.trim() : this._iconClass("fas fa-circle", "circle");
        type.appendChild(webexpress.webui.Icon.create(iconSpec));
        row.appendChild(type);

        const key = document.createElement("span");
        key.className = "wx-scrum-key";
        key.textContent = item.key || "";
        row.appendChild(key);

        const title = document.createElement("span");
        title.className = "wx-scrum-row-title";
        title.textContent = item.title || "";
        row.appendChild(title);

        const prio = document.createElement("span");
        prio.className = "wx-scrum-prio " + (item.priority || "P3");
        prio.textContent = item.priority || "P3";
        row.appendChild(prio);

        const points = document.createElement("span");
        points.className = "wx-scrum-points";
        points.textContent = String(item.points || 0);
        row.appendChild(points);

        let assignee;
        if (item.assigneeId && item.assigneeImage) {
            assignee = document.createElement("img");
            assignee.className = "wx-scrum-assignee";
            assignee.src = item.assigneeImage;
            assignee.alt = item.assigneeName || "";
            assignee.title = item.assigneeName || "";
        } else {
            assignee = document.createElement("span");
            assignee.className = "wx-scrum-assignee";
            if (item.assigneeId) {
                assignee.style.background = item.assigneeColor || "#6c757d";
                assignee.textContent = item.assigneeInitials || (item.assigneeName || "?").slice(0, 2).toUpperCase();
                assignee.title = item.assigneeName || "";
            } else {
                assignee.classList.add("wx-scrum-assignee-empty");
                assignee.title = this._i18n("webexpress.webapp:scrum.assignee.unassigned", "Unassigned");
            }
        }
        row.appendChild(assignee);

        if (!this._readonly && allowAddToSprint && targetSprint) {
            const add = document.createElement("button");
            add.type = "button";
            add.className = "wx-scrum-add-sprint";
            add.append(
                webexpress.webui.Icon.create(this._icons.moveToSprint),
                " " + (targetSprint.name || this._i18n("webexpress.webapp:scrum.sprint", "Sprint"))
            );
            add.addEventListener("click", (e) => {
                e.stopPropagation();
                // honor multiselect on the quick-add button
                if (this._selectedIds.size > 1 && this._selectedIds.has(item.id)) {
                    this.moveItemsToSprint(Array.from(this._selectedIds), targetSprint.id);
                } else {
                    this.moveItemToSprint(item.id, targetSprint.id);
                }
            });
            row.appendChild(add);
        } else {
            row.appendChild(document.createElement("span"));
        }

        // drag sorting logic
        if (!this._readonly) {
            row.addEventListener("dragstart", (e) => {
                // if dragging a row that's part of a multi-selection → drag the whole set
                const ids = this._selectedIds.has(item.id) && this._selectedIds.size > 1
                    ? Array.from(this._selectedIds)
                    : [item.id];

                this._dragItemId = item.id;
                this._dragItemIds = ids;
                row.classList.add("dragging");

                // visually mark all rows in the drag set
                if (ids.length > 1) {
                    for (const id of ids) {
                        if (id === item.id) continue;
                        const r = this._element.querySelector(`.wx-scrum-row[data-item-id="${CSS.escape(id)}"]`);
                        if (r) r.classList.add("dragging");
                    }
                }

                try {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", item.id);
                    e.dataTransfer.setData("application/x-wx-scrum-ids", JSON.stringify(ids));
                } catch (_) { /* ignore */ }
            });

            row.addEventListener("dragend", () => {
                for (const r of this._element.querySelectorAll(".wx-scrum-row.dragging")) {
                    r.classList.remove("dragging");
                }
                this._dragItemId = null;
                this._dragItemIds = [];
            });

            row.addEventListener("dragover", (e) => {
                if (!this._dragItemId || this._dragItemIds.includes(item.id)) {
                    return;
                }
                e.preventDefault();
                e.stopPropagation();

                const rect = row.getBoundingClientRect();
                const side = e.clientY < (rect.top + rect.height / 2) ? "before" : "after";

                if (row.dataset.dropSide !== side) {
                    row.dataset.dropSide = side;
                    row.classList.remove("wx-drop-before", "wx-drop-after");
                    row.classList.add(side === "before" ? "wx-drop-before" : "wx-drop-after");
                }
            });

            row.addEventListener("dragleave", (e) => {
                if (this._dragItemIds.includes(item.id)) {
                    return;
                }
                const rect = row.getBoundingClientRect();
                if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
                    row.classList.remove("wx-drop-before", "wx-drop-after");
                    row.removeAttribute("data-drop-side");
                }
            });

            row.addEventListener("drop", (e) => {
                e.preventDefault();
                e.stopPropagation();

                row.classList.remove("wx-drop-before", "wx-drop-after");
                row.removeAttribute("data-drop-side");

                const ids = this._readDragIds(e).filter((id) => id !== item.id);
                if (ids.length === 0) {
                    return;
                }

                const rect = row.getBoundingClientRect();
                const side = e.clientY < (rect.top + rect.height / 2) ? "before" : "after";
                this.insertItemsRelative(ids, item.id, side);
            });
        }

        return row;
    }

    /**
     * Reads the item ids from a drag event, supporting both single and multi payloads.
     * @param {DragEvent} e
     * @returns {Array<string>}
     */
    _readDragIds(e) {
        const ids = [];
        try {
            const json = e.dataTransfer.getData("application/x-wx-scrum-ids");
            if (json) {
                const arr = JSON.parse(json);
                if (Array.isArray(arr)) {
                    return arr;
                }
            }
        } catch (_) { /* ignore */ }

        const single = e.dataTransfer.getData("text/plain");
        if (single) {
            ids.push(single);
        }
        return ids;
    }

    /**
     * Handles keyboard interactions on a row.
     * @param {KeyboardEvent} e
     * @param {Object} item
     * @returns {void}
     */
    _handleRowKeyDown(e, item) {
        if (e.altKey && e.key === "ArrowUp") {
            e.preventDefault();
            this.moveItemRank(item.id, -1);
            return;
        }
        if (e.altKey && e.key === "ArrowDown") {
            e.preventDefault();
            this.moveItemRank(item.id, 1);
            return;
        }
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            this._moveFocus(item.id, e.key === "ArrowUp" ? -1 : 1, e);
            return;
        }
        if (e.key === "Home" || e.key === "End") {
            e.preventDefault();
            this._moveFocusEdge(e.key === "Home" ? "first" : "last", e);
            return;
        }
        if (e.key === "Enter" || e.key === " ") {
            if (this._selectable) {
                e.preventDefault();
                this._handleRowClick(item, e);
            }
        }
    }

    /**
     * Moves keyboard focus to the previous/next item, optionally extending the selection.
     * @param {string} fromId
     * @param {number} delta
     * @param {KeyboardEvent} e
     * @returns {void}
     */
    _moveFocus(fromId, delta, e) {
        const order = this._visibleItemsInOrder().map((i) => i.id);
        const idx = order.indexOf(fromId);
        if (idx < 0) return;
        const nextIdx = Math.max(0, Math.min(order.length - 1, idx + delta));
        const nextId = order[nextIdx];
        this._focusAndMaybeExtend(nextId, e);
    }

    /**
     * Moves keyboard focus to the first or last item.
     * @param {"first"|"last"} edge
     * @param {KeyboardEvent} e
     * @returns {void}
     */
    _moveFocusEdge(edge, e) {
        const order = this._visibleItemsInOrder().map((i) => i.id);
        if (order.length === 0) return;
        const id = edge === "first" ? order[0] : order[order.length - 1];
        this._focusAndMaybeExtend(id, e);
    }

    /**
     * Focuses a row by id and extends/sets the selection based on modifier keys.
     * @param {string} id
     * @param {KeyboardEvent} e
     * @returns {void}
     */
    _focusAndMaybeExtend(id, e) {
        const row = this._element.querySelector(`.wx-scrum-row[data-item-id="${CSS.escape(id)}"]`);
        if (row) {
            row.focus();
        }
        if (!this._selectable) {
            return;
        }
        if (e.shiftKey && this._anchorId) {
            const ids = this._idsBetween(this._anchorId, id);
            this._setSelection(ids, id, this._anchorId, true, e);
        } else if (!e.ctrlKey && !e.metaKey) {
            this._setSelection([id], id, id, true, e);
        }
    }

    /**
     * Root keyboard handler for shortcuts like Ctrl+A and Escape.
     * @param {KeyboardEvent} e
     * @returns {void}
     */
    _onRootKeyDown = (e) => {
        // ignore typing inside form fields
        const t = e.target;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) {
            return;
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === "a" || e.key === "A")) {
            e.preventDefault();
            this.selectAll();
            return;
        }
        if (e.key === "Escape" && this._selectedIds.size > 0 && !this._ctxMenuEl) {
            this.clearSelection(true);
        }
    };

    /**
     * Builds a small text span for the section meta line.
     * @param {string} text
     * @returns {HTMLElement}
     */
    _buildMetaSpan(text) {
        const span = document.createElement("span");
        span.textContent = text;
        return span;
    }

    /**
     * Opens a context menu for one or more backlog items.
     * @param {MouseEvent} e
     * @param {Object} item
     * @returns {void}
     */
    _openItemMenu(e, item) {
        if (this._readonly) {
            return;
        }

        const sprintTargets = this._sprints.filter((s) => s.status === "active" || s.status === "planned");

        // determine the active id set: either the multi-selection (if it includes the item) or just this item
        const activeIds = this._selectedIds.has(item.id) && this._selectedIds.size > 1
            ? Array.from(this._selectedIds)
            : [item.id];

        const isMulti = activeIds.length > 1;
        const activeItems = activeIds.map((id) => this._itemIndex.get(id)).filter(Boolean);
        const allInBacklog = activeItems.every((i) => !i.sprintId);
        const allInSprint = (sId) => activeItems.every((i) => (i.sprintId || null) === sId);

        const moveToBacklogLabel = isMulti
            ? this._i18n("webexpress.webapp:scrum.menu.move_n_to_backlog", "Move {n} to backlog").replace("{n}", activeIds.length)
            : this._i18n("webexpress.webapp:scrum.menu.move_to_backlog", "Move to backlog");

        const moveToLabelPrefix = isMulti
            ? this._i18n("webexpress.webapp:scrum.menu.move_n_to", "Move {n} to").replace("{n}", activeIds.length)
            : this._i18n("webexpress.webapp:scrum.menu.move_to", "Move to");

        const entries = [];

        // assignment and estimation operate on a single item
        if (!isMulti) {
            entries.push({
                label: this._i18n("webexpress.webapp:scrum.menu.assign", "Assign & estimate…"),
                icon: this._icons.assign,
                action: () => this._openItemEditDialog(item)
            });
            entries.push({ separator: true });
        }

        entries.push({
            label: moveToBacklogLabel,
            icon: this._icons.moveToBacklog,
            disabled: allInBacklog,
            action: () => this.moveItemsToSprint(activeIds, null)
        });

        if (sprintTargets.length > 0) {
            entries.push({ separator: true });
            for (const s of sprintTargets) {
                entries.push({
                    label: moveToLabelPrefix + ": " + (s.name || s.id),
                    icon: this._icons.moveToSprint,
                    disabled: allInSprint(s.id),
                    action: () => this.moveItemsToSprint(activeIds, s.id)
                });
            }
        }

        this._openContextMenu(e.clientX, e.clientY, entries);
    }

    /**
     * Opens a context menu for sprint actions.
     * @param {MouseEvent} e
     * @param {Object} sprint
     * @returns {void}
     */
    _openSprintMenu(e, sprint) {
        if (this._readonly) {
            return;
        }

        const entries = [];

        if (sprint.status === "active") {
            entries.push({
                label: this._i18n("webexpress.webapp:scrum.menu.complete_sprint", "Complete sprint"),
                icon: this._icons.completeSprint,
                action: () => this.completeSprint(sprint.id)
            });
            entries.push({ separator: true });
        } else if (sprint.status === "planned") {
            const hasActive = this._sprints.some((s) => s.status === "active");
            const plannedSprints = this._sprints.filter((s) => s.status === "planned");

            if (!hasActive && plannedSprints.length > 0 && plannedSprints[0].id === sprint.id) {
                entries.push({
                    label: this._i18n("webexpress.webapp:scrum.menu.start_sprint", "Start sprint"),
                    icon: this._icons.startSprint,
                    action: () => this.startSprint(sprint.id)
                });
                entries.push({ separator: true });
            }
        }

        entries.push({
            label: this._i18n("webexpress.webapp:scrum.menu.edit_sprint", "Edit sprint"),
            icon: this._icons.editSprint,
            action: () => this._openEditSprintDialog(sprint)
        });

        if (sprint.status !== "active") {
            entries.push({
                label: this._i18n("webexpress.webapp:scrum.menu.delete_sprint", "Delete sprint"),
                icon: this._icons.deleteSprint,
                action: () => this._confirmDeleteSprint(sprint)
            });
        }

        this._openContextMenu(e.clientX, e.clientY, entries);
    }

    /**
     * Returns the id of the currently active sprint or null.
     * @returns {string|null}
     */
    _activeSprintId() {
        const active = this._sprints.find((s) => s.status === "active");
        return active ? active.id : null;
    }

    /**
     * Determines whether a move would enter or leave the active sprint.
     * Pure reorder operations within (or completely outside) the active sprint return false.
     * @param {Array<Object>} items - The items being moved.
     * @param {string|null} targetSprintId - The destination sprint id, or null for backlog.
     * @returns {boolean}
     */
    _crossesActiveSprint(items, targetSprintId) {
        return webexpress.webapp.scrumBacklogModel.crossesActiveSprint(items, targetSprintId, this._activeSprintId());
    }

    /**
     * Opens a yes/no confirmation dialog for moves that affect the active sprint
     * and runs the supplied action when confirmed.
     * @param {Array<Object>} items - The items being moved.
     * @param {string|null} targetSprintId - The destination sprint id, or null for backlog.
     * @param {Function} onConfirm - Callback executed on confirmation.
     * @returns {void}
     */
    _confirmActiveSprintMove(items, targetSprintId, onConfirm) {
        const activeId = this._activeSprintId();
        const activeSprint = activeId ? this._sprintIndex.get(activeId) : null;
        const activeName = activeSprint && activeSprint.name
            ? activeSprint.name
            : this._i18n("webexpress.webapp:scrum.active_sprint", "active sprint");

        const movingOutOfActive = items.some((i) => (i.sprintId || null) === activeId);
        const count = items.length;

        const titleKey = movingOutOfActive
            ? "webexpress.webapp:scrum.confirm.remove_from_active.title"
            : "webexpress.webapp:scrum.confirm.add_to_active.title";
        const titleFallback = movingOutOfActive ? "Remove from active sprint?" : "Add to active sprint?";

        const promptKey = movingOutOfActive
            ? (count > 1
                ? "webexpress.webapp:scrum.confirm.remove_from_active.prompt_n"
                : "webexpress.webapp:scrum.confirm.remove_from_active.prompt")
            : (count > 1
                ? "webexpress.webapp:scrum.confirm.add_to_active.prompt_n"
                : "webexpress.webapp:scrum.confirm.add_to_active.prompt");
        const promptFallback = movingOutOfActive
            ? (count > 1
                ? "Are you sure you want to remove {n} items from the active sprint \"{sprint}\"?"
                : "Are you sure you want to remove this item from the active sprint \"{sprint}\"?")
            : (count > 1
                ? "Are you sure you want to add {n} items to the active sprint \"{sprint}\"?"
                : "Are you sure you want to add this item to the active sprint \"{sprint}\"?");

        const promptText = this._i18n(promptKey, promptFallback)
            .replace("{n}", count)
            .replace("{sprint}", activeName);

        const host = document.createElement("div");

        const header = document.createElement("span");
        header.className = "wx-modal-header";
        header.textContent = this._i18n(titleKey, titleFallback);
        host.appendChild(header);

        const content = document.createElement("div");
        content.className = "wx-modal-content px-3 py-4";

        const p = document.createElement("p");
        p.className = "mb-0";
        p.textContent = promptText;
        content.appendChild(p);

        host.appendChild(content);

        const footer = document.createElement("div");
        footer.className = "wx-modal-footer";

        const confirmBtn = document.createElement("button");
        confirmBtn.type = "button";
        confirmBtn.className = movingOutOfActive ? "btn btn-warning" : "btn btn-primary";
        confirmBtn.textContent = this._i18n("webexpress.webapp:scrum.confirm.yes", "Yes");
        footer.appendChild(confirmBtn);

        host.appendChild(footer);
        document.body.appendChild(host);

        const modal = new webexpress.webui.ModalCtrl(host);

        confirmBtn.addEventListener("click", () => {
            modal.hide();
            // run after the modal close has settled so the caller's render isn't fighting the modal teardown
            setTimeout(() => onConfirm(), 0);
        });

        host.addEventListener(webexpress.webui.Event.MODAL_HIDE_EVENT, () => host.remove());

        modal.show();
        // focus the confirmation button so Enter/Space confirms quickly
        setTimeout(() => confirmBtn.focus(), 100);
    }

    /**
     * Opens a confirmation dialog for deleting a sprint.
     * @param {Object} sprint
     * @returns {void}
     */
    _confirmDeleteSprint(sprint) {
        if (this._readonly) {
            return;
        }

        const host = document.createElement("div");

        const header = document.createElement("span");
        header.className = "wx-modal-header";
        header.textContent = this._i18n("webexpress.webapp:scrum.menu.delete_sprint", "Delete sprint");
        host.appendChild(header);

        const content = document.createElement("div");
        content.className = "wx-modal-content px-3 py-4";

        const promptText = this._i18n("webexpress.webapp:scrum.delete.prompt", "Are you sure you want to delete this sprint? Assigned items will be moved to the backlog.");
        const p = document.createElement("p");
        p.className = "mb-0";
        p.textContent = promptText;
        content.appendChild(p);

        if (sprint.name) {
            const nameEl = document.createElement("strong");
            nameEl.className = "d-block mt-2";
            nameEl.textContent = sprint.name;
            content.appendChild(nameEl);
        }

        host.appendChild(content);

        const footer = document.createElement("div");
        footer.className = "wx-modal-footer";

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "btn btn-danger";
        deleteBtn.append(
            webexpress.webui.Icon.create(this._icons.deleteSprint, "me-2"),
            this._i18n("webexpress.webui:delete", "Delete")
        );
        footer.appendChild(deleteBtn);

        host.appendChild(footer);
        document.body.appendChild(host);

        const modal = new webexpress.webui.ModalCtrl(host);

        deleteBtn.addEventListener("click", () => {
            this.deleteSprint(sprint.id);
            modal.hide();
        });

        host.addEventListener(webexpress.webui.Event.MODAL_HIDE_EVENT, () => host.remove());

        modal.show();
    }

    /**
     * Opens a lightweight context menu overlay.
     * @param {number} x
     * @param {number} y
     * @param {Array<Object>} entries
     * @returns {void}
     */
    _openContextMenu(x, y, entries) {
        this._closeContextMenu();

        const scrim = document.createElement("div");
        scrim.className = "wx-scrum-dialog-scrim";
        scrim.style.background = "transparent";

        const menu = document.createElement("div");
        menu.className = "wx-scrum-ctx";
        Object.assign(menu.style, {
            position: "fixed",
            left: x + "px",
            top: y + "px",
            zIndex: "1060",
            minWidth: "220px",
            background: "var(--bs-body-bg, #fff)",
            border: "1px solid var(--bs-border-color, #dee2e6)",
            borderRadius: "0.375rem",
            boxShadow: "0 12px 36px rgba(0, 0, 0, 0.18)",
            padding: "0.25rem"
        });

        for (const entry of entries) {
            if (entry.separator) {
                const hr = document.createElement("div");
                Object.assign(hr.style, {
                    height: "1px",
                    margin: "0.25rem 0",
                    background: "var(--bs-border-color, #dee2e6)"
                });
                menu.appendChild(hr);
                continue;
            }

            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "btn btn-sm btn-light wx-scrum-ctx-item";
            Object.assign(btn.style, {
                width: "100%",
                display: "flex",
                justifyContent: "flex-start",
                alignItems: "center",
                gap: "0.5rem",
                border: "none",
                background: "transparent",
                padding: "0.4rem 0.5rem",
                borderRadius: "0.25rem"
            });
            btn.disabled = !!entry.disabled;

            const iconNode = webexpress.webui.Icon.create(entry.icon, "fa-fw");
            if (iconNode) {
                btn.appendChild(iconNode);
            }

            const labelNode = document.createElement("span");
            labelNode.textContent = entry.label;
            btn.appendChild(labelNode);

            btn.addEventListener("click", () => {
                this._closeContextMenu();
                if (typeof entry.action === "function") {
                    entry.action();
                }
            });

            btn.addEventListener("mouseenter", () => {
                if (!btn.disabled) {
                    btn.style.background = "var(--bs-tertiary-bg, #f8f9fa)";
                }
            });
            btn.addEventListener("mouseleave", () => {
                btn.style.background = "transparent";
            });

            menu.appendChild(btn);
        }

        scrim.appendChild(menu);
        document.body.appendChild(scrim);

        scrim.addEventListener("click", (ev) => {
            if (ev.target === scrim) {
                this._closeContextMenu();
            }
        });

        document.addEventListener("keydown", this._onCtxKeyDown);

        this._ctxMenuEl = scrim;

        this._repositionContextMenu(menu);
    }

    /**
     * Repositions the context menu if it would overflow the viewport.
     * @param {HTMLElement} menu
     * @returns {void}
     */
    _repositionContextMenu(menu) {
        const rect = menu.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        let left = rect.left;
        let top = rect.top;

        if (rect.right > vw - 8) {
            left = Math.max(8, vw - rect.width - 8);
        }
        if (rect.bottom > vh - 8) {
            top = Math.max(8, vh - rect.height - 8);
        }

        menu.style.left = left + "px";
        menu.style.top = top + "px";
    }

    _onCtxKeyDown = (e) => {
        if (e.key === "Escape") {
            e.stopPropagation();
            this._closeContextMenu();
        }
    };

    _closeContextMenu() {
        if (this._ctxMenuEl) {
            this._ctxMenuEl.remove();
            this._ctxMenuEl = null;
            document.removeEventListener("keydown", this._onCtxKeyDown);
        }
    }

    /**
     * Calculates the duration in weeks if possible.
     * @param {string} startStr
     * @param {string} endStr
     * @returns {string}
     */
    _calculateInitialDuration(startStr, endStr) {
        if (!startStr || !endStr) {
            return "custom";
        }
        const d1 = new Date(startStr);
        const d2 = new Date(endStr);
        if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
            const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
            const map = { 7: "1", 14: "2", 21: "3", 28: "4" };
            if (map[diff]) {
                return map[diff];
            }
        }
        return "custom";
    }

    /**
     * Builds a complete sprint form (used by both create and edit dialogs).
     * @param {Object} sprint - The sprint to prefill (or {} for create).
     * @returns {{content: HTMLElement, read: Function, focus: Function, validate: Function}}
     */
    _buildSprintForm(sprint) {
        const content = document.createElement("div");
        content.className = "wx-modal-content px-3 py-2";

        // name
        const nameField = this._buildField(this._i18n("webexpress.webapp:scrum.field.name", "Sprint name"));
        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.className = "form-control";
        nameInput.value = sprint.name || "";
        nameInput.placeholder = this._i18n("webexpress.webapp:scrum.field.name.placeholder", "Sprint 27");
        nameField.field.appendChild(nameInput);
        content.appendChild(nameField.wrapper);

        // goal
        const goalField = this._buildField(this._i18n("webexpress.webapp:scrum.field.goal", "Sprint goal"));
        const goalInput = document.createElement("textarea");
        goalInput.className = "form-control";
        goalInput.rows = 2;
        goalInput.value = sprint.goal || "";
        goalField.field.appendChild(goalInput);
        content.appendChild(goalField.wrapper);

        // duration
        const durField = this._buildField(this._i18n("webexpress.webapp:scrum.field.duration", "Duration"));
        const durSelect = document.createElement("select");
        durSelect.className = "form-select";
        const opts = [
            { v: "custom", l: "Custom" },
            { v: "1", l: "1 Week" },
            { v: "2", l: "2 Weeks" },
            { v: "3", l: "3 Weeks" },
            { v: "4", l: "4 Weeks" }
        ];
        for (const o of opts) {
            const opt = document.createElement("option");
            opt.value = o.v;
            opt.textContent = this._i18n("webexpress.webapp:scrum.duration." + o.v, o.l);
            durSelect.appendChild(opt);
        }
        // default duration is 1 week unless the existing sprint dates indicate otherwise
        durSelect.value = sprint.start && sprint.end
            ? this._calculateInitialDuration(sprint.start, sprint.end)
            : "1";
        durField.field.appendChild(durSelect);
        content.appendChild(durField.wrapper);

        // date field: in week mode it shows a single start date; in custom mode it switches to range
        const today = new Date();
        const todayIso = today.toISOString().split("T")[0];

        const initialStart = sprint.start || todayIso;
        const initialEnd = sprint.end || this._addDaysIso(initialStart, 7);

        const dateWrapper = document.createElement("div");
        dateWrapper.className = "mb-3";

        const dateLabel = document.createElement("label");
        dateLabel.className = "form-label fw-bold";
        dateWrapper.appendChild(dateLabel);

        // single-date input (visible when a fixed week duration is selected)
        const startInput = document.createElement("div");
        startInput.className = "wx-webui-input-date";
        startInput.setAttribute("name", "start");
        startInput.setAttribute("data-format", "yyyy-mm-dd");
        startInput.setAttribute("placeholder",
            this._i18n("webexpress.webapp:scrum.field.start.placeholder", "Pick a start date"));
        startInput.setAttribute("value", initialStart);
        dateWrapper.appendChild(startInput);

        // range input (visible only when "custom" is selected)
        const rangeInput = document.createElement("div");
        rangeInput.className = "wx-webui-input-date";
        rangeInput.setAttribute("name", "range");
        rangeInput.setAttribute("data-format", "yyyy-mm-dd");
        rangeInput.setAttribute("data-range", "true");
        rangeInput.setAttribute("placeholder",
            this._i18n("webexpress.webapp:scrum.field.range.placeholder", "Pick a date range"));
        rangeInput.setAttribute("value", initialStart + " - " + initialEnd);
        dateWrapper.appendChild(rangeInput);

        content.appendChild(dateWrapper);

        const applyDurationMode = () => {
            const isCustom = durSelect.value === "custom";

            // sync values across the two inputs so switching feels seamless
            if (isCustom) {
                // entering custom: seed range from current start + n*7 of last known mode (or 1 week)
                const startCtrl = webexpress.webui.Controller.getInstanceByElement(startInput, webexpress.webui.InputDateCtrl);
                const startVal = (startCtrl && startCtrl.value) ? this._toIso(startCtrl.value) : startInput.getAttribute("value");
                if (startVal) {
                    const endVal = this._addDaysIso(startVal, 7);
                    const newRangeVal = startVal + " - " + endVal;
                    const rangeCtrl = webexpress.webui.Controller.getInstanceByElement(rangeInput, webexpress.webui.InputDateCtrl);
                    if (rangeCtrl) {
                        rangeCtrl.value = newRangeVal;
                    }
                    rangeInput.setAttribute("value", newRangeVal);
                }
            } else {
                // leaving custom: copy the range start back to the single date field
                const range = this._readDateRange(rangeInput);
                if (range.start) {
                    const startCtrl = webexpress.webui.Controller.getInstanceByElement(startInput, webexpress.webui.InputDateCtrl);
                    if (startCtrl) {
                        startCtrl.value = range.start;
                    }
                    startInput.setAttribute("value", range.start);
                }
            }

            startInput.style.display = isCustom ? "none" : "";
            rangeInput.style.display = isCustom ? "" : "none";
            dateLabel.textContent = isCustom
                ? this._i18n("webexpress.webapp:scrum.field.range", "Sprint period")
                : this._i18n("webexpress.webapp:scrum.field.start", "Start");
        };

        // initial state - set without seeding since values are already correct
        startInput.style.display = durSelect.value === "custom" ? "none" : "";
        rangeInput.style.display = durSelect.value === "custom" ? "" : "none";
        dateLabel.textContent = durSelect.value === "custom"
            ? this._i18n("webexpress.webapp:scrum.field.range", "Sprint period")
            : this._i18n("webexpress.webapp:scrum.field.start", "Start");

        durSelect.addEventListener("change", applyDurationMode);

        // capacity
        const capField = this._buildField(this._i18n("webexpress.webapp:scrum.field.capacity", "Capacity (pts)"), "mb-0");
        const capInput = document.createElement("input");
        capInput.type = "number";
        capInput.min = "0";
        capInput.className = "form-control";
        capInput.value = String(typeof sprint.capacity === "number" ? sprint.capacity : 60);
        capField.field.appendChild(capInput);
        content.appendChild(capField.wrapper);

        return {
            content,
            read: () => {
                const dur = durSelect.value;
                let startIso;
                let endIso;

                if (dur === "custom") {
                    const range = this._readDateRange(rangeInput);
                    startIso = range.start;
                    endIso = range.end;
                } else {
                    const weeks = parseInt(dur, 10);
                    const startCtrl = webexpress.webui.Controller.getInstanceByElement(startInput, webexpress.webui.InputDateCtrl);
                    const rawStart = startCtrl && startCtrl.value != null ? startCtrl.value : startInput.getAttribute("value");
                    startIso = this._toIso(rawStart) || sprint.start || todayIso;
                    endIso = this._addDaysIso(startIso, weeks * 7);
                }

                return {
                    name: nameInput.value.trim(),
                    goal: goalInput.value.trim(),
                    start: this._formatIsoDate(startIso),
                    end: this._formatIsoDate(endIso),
                    capacity: parseInt(capInput.value, 10) || 0
                };
            },
            focus: () => {
                setTimeout(() => nameInput.focus(), 300);
            },
            validate: () => {
                if (!nameInput.value.trim()) {
                    nameInput.classList.add("is-invalid");
                    nameInput.focus();
                    return false;
                }
                nameInput.classList.remove("is-invalid");

                if (durSelect.value === "custom") {
                    const range = this._readDateRange(rangeInput);
                    if (!range.start || !range.end) {
                        rangeInput.classList.add("is-invalid");
                        return false;
                    }
                    rangeInput.classList.remove("is-invalid");
                } else {
                    const startCtrl = webexpress.webui.Controller.getInstanceByElement(startInput, webexpress.webui.InputDateCtrl);
                    const rawStart = startCtrl && startCtrl.value != null ? startCtrl.value : startInput.getAttribute("value");
                    if (!this._toIso(rawStart)) {
                        startInput.classList.add("is-invalid");
                        return false;
                    }
                    startInput.classList.remove("is-invalid");
                }
                return true;
            }
        };
    }

    /**
     * Builds a labeled field wrapper.
     * @param {string} labelText
     * @param {string} [marginClass='mb-3']
     * @returns {{wrapper: HTMLElement, field: HTMLElement}}
     */
    _buildField(labelText, marginClass = "mb-3") {
        const wrapper = document.createElement("div");
        wrapper.className = marginClass;
        const label = document.createElement("label");
        label.className = "form-label fw-bold";
        label.textContent = labelText;
        wrapper.appendChild(label);
        return { wrapper, field: wrapper };
    }

    /**
     * Adds a number of days to an ISO date string.
     * @param {string} iso - yyyy-mm-dd
     * @param {number} days
     * @returns {string} new yyyy-mm-dd or the input on parse failure
     */
    _addDaysIso(iso, days) {
        if (!iso) {
            return iso;
        }
        const d = new Date(iso);
        if (isNaN(d.getTime())) {
            return iso;
        }
        d.setDate(d.getDate() + days);
        return d.toISOString().split("T")[0];
    }

    /**
     * Normalizes a value coming from an InputDateCtrl into a yyyy-mm-dd string.
     * Accepts Date instances, ISO strings and {start} range objects (uses start).
     * @param {*} val
     * @returns {string|null}
     */
    _toIso(val) {
        if (!val) {
            return null;
        }
        if (val instanceof Date) {
            return isNaN(val.getTime()) ? null : val.toISOString().split("T")[0];
        }
        if (typeof val === "object") {
            if (val.start instanceof Date) {
                return val.start.toISOString().split("T")[0];
            }
            if (typeof val.start === "string") {
                return this._formatIsoDate(val.start);
            }
            return null;
        }
        return this._formatIsoDate(String(val));
    }

    /**
     * Reads start/end from a range-enabled InputDateCtrl element.
     * Falls back to parsing the element's value attribute when no controller is attached.
     * @param {HTMLElement} el
     * @returns {{start: string|null, end: string|null}}
     */
    _readDateRange(el) {
        const ctrl = webexpress.webui.Controller.getInstanceByElement(el, webexpress.webui.InputDateCtrl);
        let raw = ctrl && ctrl.value != null ? ctrl.value : el.getAttribute("value");

        if (!raw) {
            return { start: null, end: null };
        }

        // controllers may expose an object with start/end directly
        if (typeof raw === "object") {
            const s = raw.start instanceof Date ? raw.start.toISOString().split("T")[0] : (raw.start || null);
            const e = raw.end instanceof Date ? raw.end.toISOString().split("T")[0] : (raw.end || null);
            return { start: s, end: e };
        }

        const str = String(raw).trim();
        if (!str) {
            return { start: null, end: null };
        }

        // accept ";", " - ", " – " or " bis " as separators
        const sep = str.includes(";") ? ";"
            : str.includes(" - ") ? " - "
            : str.includes(" – ") ? " – "
            : str.includes(" bis ") ? " bis "
            : null;

        if (!sep) {
            return { start: this._formatIsoDate(str), end: this._formatIsoDate(str) };
        }

        const [a, b] = str.split(sep).map((x) => x.trim());
        return { start: this._formatIsoDate(a) || null, end: this._formatIsoDate(b) || null };
    }

    /**
     * Opens an edit dialog for a sprint.
     * @param {Object} sprint
     * @returns {void}
     */
    _openEditSprintDialog(sprint) {
        if (this._readonly) {
            return;
        }

        this._openSprintFormDialog({
            sprint: sprint,
            title: this._i18n("webexpress.webapp:scrum.edit_sprint", "Edit sprint"),
            actionLabel: this._i18n("webexpress.webapp:save", "Save"),
            onSubmit: (values) => this.updateSprint(Object.assign({ id: sprint.id }, values))
        });
    }

    /**
     * Opens the dialog for creating a new sprint.
     * @returns {void}
     */
    openSprintDialog() {
        if (this._readonly) {
            return;
        }

        this._openSprintFormDialog({
            sprint: {},
            title: this._i18n("webexpress.webapp:scrum.create_sprint", "Create sprint"),
            actionLabel: this._i18n("webexpress.webapp:scrum.dialog.create", "Create"),
            onSubmit: (values) => this.addSprint(Object.assign({ status: "planned" }, values))
        });
    }

    /**
     * Generic sprint form dialog used for both create and edit.
     * @param {Object} cfg
     * @returns {void}
     */
    _openSprintFormDialog(cfg) {
        const host = document.createElement("div");

        const header = document.createElement("span");
        header.className = "wx-modal-header";
        header.textContent = cfg.title;
        host.appendChild(header);

        const form = this._buildSprintForm(cfg.sprint || {});
        host.appendChild(form.content);

        const footer = document.createElement("div");
        footer.className = "wx-modal-footer";

        const submitBtn = document.createElement("button");
        submitBtn.type = "button";
        submitBtn.className = "btn btn-primary";
        submitBtn.textContent = cfg.actionLabel;
        footer.appendChild(submitBtn);

        host.appendChild(footer);
        document.body.appendChild(host);

        const modal = new webexpress.webui.ModalCtrl(host);

        submitBtn.addEventListener("click", () => {
            if (!form.validate()) {
                return;
            }
            cfg.onSubmit(form.read());
            modal.hide();
        });

        host.addEventListener(webexpress.webui.Event.MODAL_HIDE_EVENT, () => host.remove());

        modal.show();
        form.focus();
    }

    /**
     * Opens the assign/estimate dialog for a single backlog item. The assignee
     * is chosen from a searchable, avatar-driven picker fed by the optional users
     * service; the story-point estimate is picked from the configured scale.
     * @param {Object} item - The item to assign and estimate.
     * @returns {void}
     */
    _openItemEditDialog(item) {
        if (this._readonly) {
            return;
        }

        // the dialog edits a working copy of the assignment so the board only
        // changes when the dialog is saved
        let selectedUser = item.assigneeId
            ? { id: item.assigneeId, name: item.assigneeName, initials: item.assigneeInitials, color: item.assigneeColor, image: item.assigneeImage }
            : null;
        let candidates = [];

        const host = document.createElement("div");

        const header = document.createElement("span");
        header.className = "wx-modal-header";
        header.textContent = this._i18n("webexpress.webapp:scrum.dialog.assign_estimate", "Assign & estimate");
        host.appendChild(header);

        const content = document.createElement("div");
        content.className = "wx-modal-content px-3 py-2";

        const assigneeField = this._buildField(this._i18n("webexpress.webapp:scrum.field.assignee", "Assignee"));
        const picker = document.createElement("div");
        picker.className = "wx-scrum-assignee-picker";

        const selectedBox = document.createElement("div");
        selectedBox.className = "wx-scrum-assignee-selected";
        picker.appendChild(selectedBox);

        const search = document.createElement("input");
        search.type = "search";
        search.className = "form-control wx-scrum-assignee-search";
        search.placeholder = this._i18n("webexpress.webapp:scrum.assignee.search", "Search people…");
        picker.appendChild(search);

        const results = document.createElement("div");
        results.className = "wx-scrum-assignee-results";
        picker.appendChild(results);

        assigneeField.field.appendChild(picker);
        content.appendChild(assigneeField.wrapper);

        const pointsField = this._buildField(this._i18n("webexpress.webapp:scrum.field.points", "Story points"), "mb-0");
        const pointsHost = document.createElement("div");
        pointsHost.dataset.scale = this._estimationScale.join(",");
        if (Number.isFinite(item.points)) {
            pointsHost.dataset.value = String(item.points);
        }
        pointsField.field.appendChild(pointsHost);
        content.appendChild(pointsField.wrapper);

        // the estimate is edited through the reusable estimate input control
        const pointsCtrl = new webexpress.webui.InputEstimateCtrl(pointsHost);

        host.appendChild(content);

        const footer = document.createElement("div");
        footer.className = "wx-modal-footer";
        const submitBtn = document.createElement("button");
        submitBtn.type = "button";
        submitBtn.className = "btn btn-primary";
        submitBtn.textContent = this._i18n("webexpress.webapp:save", "Save");
        footer.appendChild(submitBtn);
        host.appendChild(footer);

        document.body.appendChild(host);

        const renderSelected = () => {
            selectedBox.replaceChildren();
            if (!selectedUser) {
                const empty = document.createElement("span");
                empty.className = "wx-scrum-assignee-selected-empty";
                empty.textContent = this._i18n("webexpress.webapp:scrum.assignee.unassigned", "Unassigned");
                selectedBox.appendChild(empty);
                return;
            }
            selectedBox.appendChild(this._buildAssigneeAvatar(selectedUser, "wx-scrum-assignee-selected-avatar"));
            const name = document.createElement("span");
            name.className = "wx-scrum-assignee-selected-name";
            name.textContent = selectedUser.name || selectedUser.id || "";
            selectedBox.appendChild(name);
            const clear = document.createElement("button");
            clear.type = "button";
            clear.className = "wx-scrum-assignee-clear";
            clear.title = this._i18n("webexpress.webapp:scrum.assignee.unassigned", "Unassigned");
            clear.appendChild(webexpress.webui.Icon.create(this._iconClass("fas fa-times", "xmark")));
            clear.addEventListener("click", () => {
                selectedUser = null;
                renderSelected();
                renderResults();
            });
            selectedBox.appendChild(clear);
        };

        const renderResults = () => {
            const q = search.value.trim().toLowerCase();
            results.replaceChildren();
            const matches = candidates.filter((u) => {
                if (selectedUser && u.id === selectedUser.id) {
                    return false;
                }
                if (!q) {
                    return true;
                }
                return (u.name || "").toLowerCase().includes(q) || (u.team || "").toLowerCase().includes(q);
            });
            for (const u of matches) {
                const row = document.createElement("button");
                row.type = "button";
                row.className = "wx-scrum-assignee-result";
                row.appendChild(this._buildAssigneeAvatar(u, "wx-scrum-assignee-result-avatar"));
                const body = document.createElement("span");
                body.className = "wx-scrum-assignee-result-body";
                const name = document.createElement("span");
                name.className = "wx-scrum-assignee-result-name";
                name.textContent = u.name || u.id || "";
                body.appendChild(name);
                if (u.team) {
                    const team = document.createElement("span");
                    team.className = "wx-scrum-assignee-result-team";
                    team.textContent = u.team;
                    body.appendChild(team);
                }
                row.appendChild(body);
                row.addEventListener("click", () => {
                    selectedUser = u;
                    search.value = "";
                    renderSelected();
                    renderResults();
                });
                results.appendChild(row);
            }
        };

        renderSelected();

        // load all candidates once and filter client-side, so typing in the
        // search box never hits the network again
        this._loadAssignees().then((users) => {
            candidates = users;
            // replace the lightweight selection seeded from the item with the
            // full record so any richer field (such as an avatar image) is shown
            if (selectedUser) {
                const full = users.find((u) => u.id === selectedUser.id);
                if (full) {
                    selectedUser = full;
                    renderSelected();
                }
            }
            renderResults();
        });

        search.addEventListener("input", () => renderResults());

        const modal = new webexpress.webui.ModalCtrl(host);

        submitBtn.addEventListener("click", () => {
            // an unset estimate keeps the item's current points
            const points = pointsCtrl.value != null ? pointsCtrl.value : item.points;
            this.updateItem(item.id, {
                assigneeId: selectedUser ? selectedUser.id : null,
                points: points,
                assignee: selectedUser
            });
            modal.hide();
        });

        host.addEventListener(webexpress.webui.Event.MODAL_HIDE_EVENT, () => host.remove());
        modal.show();
        setTimeout(() => search.focus(), 100);
    }

    /**
     * Builds an avatar element for a candidate user, preferring an image when
     * one is supplied and otherwise falling back to the initials on the person's
     * color, matching the avatars shown on the backlog rows.
     * @param {Object} user - The user record.
     * @param {string} className - An extra class identifying the avatar context.
     * @returns {HTMLElement} The avatar element.
     */
    _buildAssigneeAvatar(user, className) {
        if (user && user.image) {
            const img = document.createElement("img");
            img.className = "wx-scrum-assignee-avatar " + className;
            img.src = user.image;
            img.alt = user.name || "";
            return img;
        }

        const span = document.createElement("span");
        span.className = "wx-scrum-assignee-avatar " + className;
        span.style.background = (user && user.color) || "#6c757d";
        span.textContent = (user && user.initials) || ((user && user.name ? user.name : "?").slice(0, 2).toUpperCase());
        return span;
    }

    /**
     * Loads the candidate assignees from the optional users service.
     * @returns {Promise<Array<Object>>} The candidate users, or an empty list.
     */
    _loadAssignees() {
        if (!this._users) {
            return Promise.resolve([]);
        }
        return this._users.query({ search: "" })
            .then((r) => (r.ok && Array.isArray(r.data)) ? r.data : [])
            .catch((err) => {
                console.warn("ScrumBacklogCtrl: failed to load assignees", err);
                return [];
            });
    }

    /**
     * Updates the assignment and estimate of an item: applies the change
     * optimistically, persists it and reconciles with the server on failure.
     * @param {string} id - The item id.
     * @param {{assigneeId: (string|null), points: number, assignee: (Object|null)}} values
     * @returns {Promise<void>}
     */
    updateItem(id, values) {
        const item = this._itemIndex.get(id);
        if (!item) {
            return Promise.resolve();
        }

        const points = Math.trunc(Number(values.points));
        if (Number.isFinite(points) && points >= 0) {
            item.points = points;
        }

        const user = values.assignee || null;
        item.assigneeId = user ? user.id : null;
        item.assigneeName = user ? user.name : null;
        item.assigneeInitials = user ? user.initials : null;
        item.assigneeColor = user ? user.color : null;
        item.assigneeImage = user ? (user.image || null) : null;
        this.render();

        if (!this._service) {
            return Promise.resolve();
        }

        return this._service.update(
            webexpress.webapp.scrumBacklogModel.itemBody(values),
            { path: webexpress.webapp.scrumBacklogModel.itemPath(id) }
        )
            .then((r) => {
                if (!r.ok) {
                    throw new Error(r.error ? r.error.message : ("HTTP " + r.status));
                }
            })
            .catch((err) => {
                console.error("ScrumBacklogCtrl: failed to update item", err);
                this._load();
            });
    }

    /**
     * Returns a yyyy-mm-dd representation for the given Date object or string.
     * @param {Date|string|null} date
     * @returns {string|null}
     */
    _formatIsoDate(date) {
        if (!date) {
            return null;
        }
        const d = date instanceof Date ? date : new Date(date);
        if (isNaN(d.getTime())) {
            return null;
        }
        const yyyy = String(d.getFullYear());
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return yyyy + "-" + mm + "-" + dd;
    }
};

webexpress.webui.Controller.registerClass("wx-webapp-scrum-backlog", webexpress.webapp.ScrumBacklogCtrl);
