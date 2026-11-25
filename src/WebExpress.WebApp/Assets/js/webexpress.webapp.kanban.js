/**
 * A REST-enabled Kanban control.
 * Fetches the configuration (columns, swimlanes) and cards from a REST endpoint.
 * Automatically synchronizes card movements with the server.
 *
 * A move into a status for which the card names a dialog (moveDialogs) needs input the board
 * cannot ask for, such as the form of a workflow transition. The board stores no such move: it
 * leaves the card where it was and opens the dialog in the form dialog of the page, whose
 * submit moves the card, and loads the board again once the form reports success.
 *
 * While the board loads, a thin progress bar above it says so, as the table does. Its place is
 * kept while it is hidden, so showing it moves nothing.
 */
webexpress.webapp.KanbanCtrl = class extends webexpress.webui.KanbanCtrl {

    // configuration
    _restUri = "";
    _viewState = null;
    _statuses = null;
    _statusDialog = null;
    // the id the applications give the form dialog they place on every page
    _moveDialogModal = "modal-form";
    // detaches the listeners of the open move dialog; null while none is open
    _moveDialog = null;
    // the board payload the board was last rendered from
    _appliedData = null;

    /**
     * Initializes the REST Kanban control.
     * @param {HTMLElement} element The root element.
     */
     constructor(element) {
        // consume the islands before the base constructor reshapes the
        // children; later reads are served from the element cache
        webexpress.webapp.Data.readState(element);
        webexpress.webapp.ServiceRegistry.fromElement(element);

        super(element);

        if (element.dataset && element.dataset.moveDialogModal) {
            this._moveDialogModal = element.dataset.moveDialogModal;
        }
        element.removeAttribute?.("data-move-dialog-modal");

        // the resource a ViewState renders. when present, the board is a pure view of
        // a central resource the enclosing ViewState owns; when absent it owns its
        // state and loads itself (standalone).
        this._resource = (element.dataset && element.dataset.wxResource) || null;

        // canonical ui state: a single source of truth for the loading flag,
        // seeded from the optional wx-state island. in ViewState mode this is
        // replaced by the ViewState once it resolves.
        this._store = new webexpress.webapp.ViewState(element, { standalone: true, state: Object.assign({
            loading: false
        }, webexpress.webapp.Data.readState(element)) });

        // data service from the wx-service island. its query loads the board,
        // its update persists changes.
        const islandServices = webexpress.webapp.ServiceRegistry.fromElement(element);
        this._service = islandServices.data;
        this._restUri = this._service ? this._service.baseUri : "";

        this._initRestPersistence(element);

        if (this._resource) {
            // ViewState mode: the enclosing ViewState loads the resource centrally
            this._attachToViewState(element);
        } else if (this._restUri) {
            this._receiveData();

            // an external change of the service's domains re-queries and
            // flashes, so changes made by other users re-render standalone too
            const dataChanges = webexpress.webapp.DataChangeSubscription.attachReload(
                [this._service], () => this._receiveData(), element);
            if (dataChanges) {
                (element._wxCleanup = element._wxCleanup || []).push(() => dataChanges.detach());
            }
        }
    }

    /**
     * Attaches the board to the enclosing ViewState and renders its
     * resource slice. The ViewState owns the state, the service and the central
     * load, so the board re-renders whenever the ViewState re-queries the resource,
     * while card moves still persist through the ViewState's update service.
     * @param {HTMLElement} element The host element.
     */
    _attachToViewState(element) {
        const viewStateId = (element.dataset && element.dataset.wxViewstate) || null;

        webexpress.webapp.ViewStateRegistry.whenReady(element, viewStateId, (viewState) => {
            this._viewState = viewState;
            this._store = viewState;

            const service = viewState.serviceForResource(this._resource);
            if (service) {
                this._service = service;
                this._restUri = service.baseUri;
            }

            const unsubscribe = viewState.watch((state) => viewState.slice(this._resource, state), (slice) => this._applySlice(slice));
            (element._wxCleanup = element._wxCleanup || []).push(unsubscribe);

            this._applySlice(viewState.slice(this._resource));
        });
    }

    /**
     * Renders a resource slice the ViewState loaded centrally, normalising the raw
     * board payload exactly as the standalone load does.
     * @param {object} slice The resource slice { items, total, data, loading, error }.
     */
    _applySlice(slice) {
        slice = slice || {};

        // a reload first marks the slice loading and still carries the board it had; drawn
        // again, that board put a card just moved back into its old column until the answer
        // arrived. only a payload the board has not shown yet is rendered
        if (slice.data && slice.data !== this._appliedData) {
            this._appliedData = slice.data;
            this.updateData(slice.data);
        }

        // the slice is the record of the central load: it says whether a query is in
        // flight and whether the last one failed, and the board shows exactly that
        // rather than declaring the load over on every notification
        this._loading = !!slice.loading;

        if (slice.error) {
            console.error("kanban load failed:", webexpress.webapp.ServiceResult.describe({ error: slice.error }, { resource: this._resource }));
        }
    }

    // loading flag accessor backed by the store, so the single source of truth
    // is the store

    get _loading() { return this._store.getState().loading; }
    set _loading(value) {
        this._store.setState({ loading: value });
        this._showProgress(!!value);
    }

    /**
     * Fetches the board data including columns, swimlanes, and cards.
     */
    async _receiveData() {
        if (!this._restUri || !this._service) {
            return;
        }

        this._loading = true;

        // the board settings wql filter narrows the server query when set
        const result = await this._service.query(this._filter ? { wql: this._filter } : {});

        if (!result.ok) {
            // a superseded query arrives as an abort result and is ignored
            if (result.error.kind === "abort") {
                return;
            }
            // log error and reset state
            console.error("kanban load failed:", webexpress.webapp.ServiceResult.describe(result));
            this._loading = false;
            return;
        }

        this.updateData(result.data);

        this._loading = false;
    }

    /**
     * Renders the board and places the progress bar above it again, since the board rebuilds
     * the host on every render.
     */
    render() {
        super.render();
        this._placeProgress();
    }

    /**
     * Places the progress bar below the board menu, or first when the board has none.
     *
     * The bar is no declared field: the base constructor renders before the fields of this
     * class are initialised, and an initialiser would drop the bar that render created.
     */
    _placeProgress() {
        const host = this._element;
        if (!host) {
            return;
        }

        if (!this._progressBar) {
            const bar = document.createElement("div");
            bar.className = "progress wx-kanban-progress";
            bar.setAttribute("role", "status");
            bar.style.height = "0.25rem";
            bar.style.flex = "0 0 auto";
            const fill = document.createElement("div");
            fill.className = "progress-bar progress-bar-striped progress-bar-animated";
            fill.style.width = "100%";
            bar.appendChild(fill);
            this._progressBar = bar;
        }

        const first = host.children[0] || null;
        const anchor = first && first.classList && first.classList.contains("wx-kanban-toolbar") ? first.nextSibling : first;
        host.insertBefore(this._progressBar, anchor);

        this._showProgress(!!this._store?.getState().loading);
    }

    /**
     * Shows or hides the progress of a load. The bar keeps its place while hidden, so the
     * board does not move when a load starts or ends; the placeholders shimmer only while
     * there is no board to look at yet, since a board on screen pulsing on every reload
     * reads as flicker.
     * @param {boolean} show - true while a load is in flight.
     */
    _showProgress(show) {
        if (this._progressBar) {
            this._progressBar.style.visibility = show ? "visible" : "hidden";
            this._progressBar.setAttribute("aria-busy", show ? "true" : "false");
        }

        const empty = !(this._columns && this._columns.length) && !(this._cards && this._cards.length);
        this._element?.classList.toggle("placeholder-glow", show && empty);
    }
    
    /**
     * Updates the internal board state using the provided json data and rerenders the board.
     * @param {Object} data - The json payload containing columns, swimlanes, and items.
     */
    updateData(data) {
        this._statusDialog?.hide();
        const board = webexpress.webapp.kanbanModel.normalizeBoard(data);
        if (Object.prototype.hasOwnProperty.call(board, "statuses")) {
            this._statuses = board.statuses;
        }

        // the board echoes the persisted wql filter so the settings dialog seeds
        // its field with the current value
        if (board.filter !== undefined) {
            this._filter = board.filter;
        }
        if (board.columns) {
            this._columns = board.columns;
        }
        if (board.swimlanes) {
            this._swimlanes = board.swimlanes;
        }
        if (board.cards) {
            this._cards = board.cards;
        }

        // redraw the control with new data
        this.render();
    }

    /**
     * Adds status assignments to the editable column menu.
     * @param {HTMLElement} menu - The menu receiving the status command.
     * @param {HTMLElement} headerEl - The corresponding column header.
     * @param {number} index - The current column index.
     */
    _populateColumnMenuRoot(menu, headerEl, index) {
        super._populateColumnMenuRoot(menu, headerEl, index);
        if (this._editableColumn && this._statuses != null) {
            const entry = this._buildMenuEntry(this._iconClass("gear"),
                this._i18n("webexpress.webapp:kanban.status.column", "Column statuses"), null,
                () => this._openColumnStatuses(this._columns[index]));
            const divider = menu.querySelector(".dropdown-divider")?.parentElement;
            menu.insertBefore(entry, divider || null);
        }
    }

    /**
     * Edits a detached selection so closing the dialog never mutates the column.
     * @param {object} column - The column being configured.
     */
    _openColumnStatuses(column) {
        if (!column || !this._editableColumn || this._statuses == null) {
            return;
        }
        this._statusDialog ||= new webexpress.webapp.KanbanStatusDialog();
        this._statusDialog.open(this._i18n("webexpress.webapp:kanban.status.column", "Column statuses")
            + ": " + column.label, this._statuses, column.statusIds || [], true, (selected) => {
            if (!this._columns.includes(column)) {
                return;
            }
            column.statusIds = selected;
            this.render();
            this._dispatchColumnChange();
        });
    }

    /**
     * Shows the workflow status of a card as the leading footer chip. A column may hold
     * several statuses, so its position alone does not tell which one the card is in.
     * @param {object} card - The card data object.
     * @param {string} colId - The column id.
     * @param {string} swimlaneId - The swimlane id.
     * @returns {HTMLElement} The card element.
     */
    _buildCardElement(card, colId, swimlaneId) {
        const cardEl = super._buildCardElement(card, colId, swimlaneId);
        const status = card.statusId != null ? this._statuses?.find((item) => item.id === card.statusId) : null;
        if (!status) {
            return cardEl;
        }

        // the base renders the footer last and only when the card has footer chips
        let footer = cardEl.lastElementChild;
        if (!footer || !footer.classList.contains("card-footer")) {
            footer = document.createElement("div");
            footer.className = "card-footer";
            cardEl.appendChild(footer);
        }
        const chip = webexpress.webapp.KanbanStatusChip.create(status, "card-footer-chip wx-kanban-card-status");
        chip.title = this._i18n("webexpress.webapp:kanban.status.label", "Status");
        footer.prepend(chip);
        return cardEl;
    }

    /**
     * Resolves only statuses that both the column and the card currently allow.
     * @param {object} card - The card whose transitions restrict the selection.
     * @param {object} column - The destination column.
     * @returns {Array<object>} The available destination statuses.
     */
    _availableStatuses(card, column) {
        return (this._statuses || []).filter((status) => column.statusIds?.includes(status.id)
            && (card.allowedStatusIds == null || card.allowedStatusIds.includes(status.id)));
    }

    /**
     * Refuses a column in which the card has no status it may enter, so the board shows the
     * refusal while dragging instead of offering an empty choice after the drop.
     * @param {object} card - The dragged card.
     * @param {string} colId - The column under the pointer.
     * @returns {boolean} Whether the drop is accepted.
     */
    _canDrop(card, colId) {
        if (card.columnId === colId || this._statuses == null) {
            return true;
        }
        const column = this._columns.find((item) => item.id === colId);
        return column != null && this._availableStatuses(card, column).length > 0;
    }

    /**
     * Defers cross-column moves until a valid destination status has been chosen.
     * @param {object} card - The current card instance.
     * @param {string} colId - The destination column identifier.
     * @param {string|null} swimlaneId - The destination swimlane identifier.
     * @param {object|null} [targetCard=null] - The insertion anchor, or null to append.
     * @param {boolean} [before=true] - Whether to insert before the anchor.
     */
    _moveCard(card, colId, swimlaneId, targetCard = null, before = true) {
        this._statusDialog?.hide();
        if (card.columnId === colId || this._statuses == null) {
            super._moveCard(card, colId, swimlaneId, targetCard, before);
            return;
        }
        const column = this._columns.find((item) => item.id === colId);
        if (!column || !this._cards.includes(card)) {
            return;
        }
        const statuses = this._availableStatuses(card, column);
        const commit = (selected) => {
            // a reload or a changed transition invalidates a pending selection
            if (!this._cards.includes(card) || !this._columns.includes(column)
                || (targetCard && !this._cards.includes(targetCard))
                || !this._availableStatuses(card, column).some((status) => status.id === selected[0])) {
                return;
            }
            const dialog = selected[0] !== card.statusId ? card.moveDialogs?.[selected[0]] : null;
            if (dialog) {
                // the dialog's submit moves the card; until then the card stays where it was
                this._openMoveDialog(dialog);
                return;
            }
            card.statusId = selected[0];
            super._moveCard(card, colId, swimlaneId, targetCard, before);
        };
        if (statuses.length === 1) {
            commit([statuses[0].id]);
            return;
        }
        this._statusDialog ||= new webexpress.webapp.KanbanStatusDialog();
        this._statusDialog.open(this._i18n("webexpress.webapp:kanban.status.choose", "Choose destination status"),
            statuses, [], false, commit);
    }

    /**
     * Opens the dialog a move needs in the form dialog of the page.
     *
     * The dialog is told to leave the page as it is after its form succeeded: a form written for
     * a detail page reloads it, which would throw away the open tab, the selected card, the search
     * and the scroll position only to show one card in its new column. The board loads itself
     * instead. A page without a form dialog opens the dialog as a page of its own.
     * @param {string} uri - The address of the dialog.
     */
    _openMoveDialog(uri) {
        this._releaseMoveDialog();

        const host = this._moveDialogModal ? document.getElementById(this._moveDialogModal) : null;
        const modal = host ? webexpress.webui.Controller.getInstanceByElement(host) : null;

        // a dialog that cannot be told to keep the page would reload it, so it counts as none
        if (!modal || typeof modal.show !== "function" || !("successAction" in modal)) {
            this._navigateTo(uri);
            return;
        }

        const events = webexpress.webui.Event;
        const onSuccess = () => {
            this._releaseMoveDialog();
            modal.hide();

            // a board removed while the dialog was open has nothing left to show
            if (this._element?.isConnected) {
                this.update();
            }
        };
        const onHide = () => this._releaseMoveDialog();

        host.addEventListener(events.UPLOAD_SUCCESS_EVENT, onSuccess);
        host.addEventListener(events.MODAL_HIDE_EVENT, onHide);
        this._moveDialog = () => {
            host.removeEventListener(events.UPLOAD_SUCCESS_EVENT, onSuccess);
            host.removeEventListener(events.MODAL_HIDE_EVENT, onHide);
        };

        modal.uri = uri;
        modal.successAction = "none";
        modal.show();
    }

    /**
     * Stops listening to the move dialog, so a later form in the same page dialog does not
     * reload this board.
     */
    _releaseMoveDialog() {
        const detach = this._moveDialog;
        this._moveDialog = null;
        detach?.();
    }

    /**
     * Opens the dialog of a move as a page of its own. Only http addresses are followed, so
     * an address such as a javascript: url never runs.
     * @param {string} uri - The address of the dialog.
     */
    _navigateTo(uri) {
        let target;
        try {
            target = new URL(uri, window.location.href);
        } catch (_) {
            return;
        }
        if (target.protocol === "http:" || target.protocol === "https:") {
            window.location.assign(target.href);
        }
    }

    /**
     * Releases the separately owned status dialog and stops listening to an open move dialog,
     * so a board removed while the dialog was open does nothing when its form succeeds.
     */
    destroy() {
        this._releaseMoveDialog();
        this._statusDialog?.destroy();
        this._statusDialog = null;
        super.destroy();
    }

    /**
     * Initializes listeners for internal state changes to sync with the server.
     * @param {HTMLElement} element The host element.
     */
    _initRestPersistence(element) {
        const evRoot = webexpress?.webui?.Event;
        const eventName = (evRoot && evRoot.MOVE_EVENT) ? evRoot.MOVE_EVENT : "webexpress.webui.move";

        element.addEventListener(eventName, (e) => {
            if (e.detail && e.detail.id === this._element.id) {
                const payload = {
                    cardId: e.detail.cardId,
                    columnId: e.detail.columnId,
                    swimlaneId: e.detail.swimlaneId || null
                };
                if (e.detail.statusId != null) {
                    payload.statusId = e.detail.statusId;
                }
                this._sendStateToServer(payload);
            }
        });

        // structural changes (column rename / reorder / delete, swimlane add /
        // rename / delete and the board settings wql filter) each arrive as a
        // change-value event tagged with their action; forward the relevant
        // fields to the server so every kind of change round-trips
        const changeEvent = (evRoot && evRoot.CHANGE_VALUE_EVENT) ? evRoot.CHANGE_VALUE_EVENT : "webexpress.webui.change.value";
        element.addEventListener(changeEvent, (e) => {
            if (!e.detail || e.detail.id !== this._element.id) {
                return;
            }

            switch (e.detail.action) {
                case "columns":
                    this._sendStateToServer({ action: "columns", columns: e.detail.columns.map((column) => {
                        const model = this._columns.find((item) => item.id === column.id);
                        return Object.assign({}, column, { statusIds: model?.statusIds ?? (this._statuses ? [] : null) });
                    }) });
                    break;
                case "swimlanes":
                    this._sendStateToServer({ action: "swimlanes", swimlanes: e.detail.swimlanes });
                    break;
                case "settings":
                    this._filter = e.detail.filter || "";
                    this._sendStateToServer({ action: "settings", filter: this._filter });
                    break;
            }
        });
    }

    /**
     * Sends the state update to the server.
     * @param {Object} payload The data payload containing card position info.
     */
    _sendStateToServer(payload) {
        if (!this._restUri || !this._service) {
            return;
        }

        // a vetoed change is taken back the way a refused one is: the stored board is loaded
        this._saveAction(payload.action || "move", payload, (sent) => this._service.update(sent), () => this.update()).then((result) => {
            // a new filter is applied by reloading, but only once it is stored: a
            // load without wql falls back to the stored filter, so a reload that
            // overtook the write would bring the old one back
            const reload = payload.action === "settings"
                || (this._statuses != null && (!payload.action || payload.action === "columns"));

            if (!result.ok && result.error.kind !== "abort") {
                this._reject(payload.action || "move", result);
            } else if (result.ok && reload) {
                this.update();
            }
        });
    }

    /**
     * Takes back a change the server refused.
     *
     * The board applies a change the moment it is made - the card sits in its new column
     * before the request is out - so a refusal leaves the screen showing what is not
     * stored. The stored board is loaded back over it, which is the one state both sides
     * agree on, and the refusal is put in front of the user: a card that snaps back with
     * no word about why reads as a bug of the board rather than as a decision of the
     * server. When the application refused the change with a reason of its own, that
     * reason is what the user reads.
     * @param {string} action - The change that was refused.
     * @param {object} result - The failed service result.
     */
    _reject(action, result) {
        console.error(`kanban ${action} failed:`, webexpress.webapp.ServiceResult.describe(result, { action: action }));

        webexpress.webapp.ErrorChannel.present(result, {
            service: this._service.name,
            heading: this._i18n("webexpress.webapp:kanban.heading", "Board"),
            message: this._refusalReason(result)
                || this._i18n("webexpress.webapp:kanban.update.rejected", "The change was not saved and has been taken back.")
        });

        this._dispatch(webexpress.webui.Event.DATA_ERROR_EVENT, { action: action, error: result.error });
        this.update();
    }

    /**
     * Reads the reason a RestApiRefusal put into the body of a refused write.
     * @param {object} result - The failed service result.
     * @returns {string|null} The reason, escaped for the popup, or null when the server gave none.
     */
    _refusalReason(result) {
        const reason = result && result.data && result.data.message;

        if (typeof reason !== "string" || !reason.trim()) {
            return null;
        }

        // the popup renders its message as html, and a reason may quote a card title the user typed
        return reason.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c]);
    }

    /**
     * Forces an update of the control data.
     */
    update() {
        if (this._viewState) {
            this._viewState.reload(this._resource);
            return;
        }
        if (this._restUri) {
            if (this._isVisible && this._isVisible()) {
                this._receiveData();
            }
        }
    }
};

// register the class in the webapp controller namespace
webexpress.webui.Controller.registerClass("wx-webapp-kanban", webexpress.webapp.KanbanCtrl);