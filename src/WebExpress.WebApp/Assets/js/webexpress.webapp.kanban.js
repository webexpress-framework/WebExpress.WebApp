/**
 * A REST-enabled Kanban control.
 * Fetches the configuration (columns, swimlanes) and cards from a REST endpoint.
 * Automatically synchronizes card movements with the server.
 */
webexpress.webapp.KanbanCtrl = class extends webexpress.webui.KanbanCtrl {

    // configuration
    _restUri = "";
    _viewState = null;

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

        if (slice.data) {
            this.updateData(slice.data);
        }

        // the slice is the record of the central load: it says whether a query is in
        // flight and whether the last one failed, and the board shows exactly that
        // rather than declaring the load over on every notification
        const loading = !!slice.loading;

        this._element.classList.toggle("placeholder-glow", loading);
        this._loading = loading;

        if (slice.error) {
            console.error("kanban load failed:", webexpress.webapp.ServiceResult.describe({ error: slice.error }, { resource: this._resource }));
        }
    }

    // loading flag accessor backed by the store, so the single source of truth
    // is the store

    get _loading() { return this._store.getState().loading; }
    set _loading(value) { this._store.setState({ loading: value }); }

    /**
     * Fetches the board data including columns, swimlanes, and cards.
     */
    async _receiveData() {
        if (!this._restUri || !this._service) {
            return;
        }

        this._loading = true;
        this._element.classList.add("placeholder-glow");

        // the board settings wql filter narrows the server query when set
        const result = await this._service.query(this._filter ? { wql: this._filter } : {});

        if (!result.ok) {
            // a superseded query arrives as an abort result and is ignored
            if (result.error.kind === "abort") {
                return;
            }
            // log error and reset state
            console.error("kanban load failed:", webexpress.webapp.ServiceResult.describe(result));
            this._element.classList.remove("placeholder-glow");
            this._loading = false;
            return;
        }

        this.updateData(result.data);

        this._element.classList.remove("placeholder-glow");
        this._loading = false;
    }
    
    /**
     * Updates the internal board state using the provided json data and rerenders the board.
     * @param {Object} data - The json payload containing columns, swimlanes, and items.
     */
    updateData(data) {
        const board = webexpress.webapp.kanbanModel.normalizeBoard(data);

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
                    this._sendStateToServer({ action: "columns", columns: e.detail.columns });
                    break;
                case "swimlanes":
                    this._sendStateToServer({ action: "swimlanes", swimlanes: e.detail.swimlanes });
                    break;
                case "settings":
                    this._filter = e.detail.filter || "";
                    this._sendStateToServer({ action: "settings", filter: this._filter });
                    // apply the new filter immediately by reloading the board
                    this.update();
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

        this._service.update(payload).then((result) => {
            if (!result.ok && result.error.kind !== "abort") {
                this._reject(payload.action || "move", result);
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
     * server.
     * @param {string} action - The change that was refused.
     * @param {object} result - The failed service result.
     */
    _reject(action, result) {
        console.error(`kanban ${action} failed:`, webexpress.webapp.ServiceResult.describe(result, { action: action }));

        webexpress.webapp.ErrorChannel.present(result, {
            service: this._service.name,
            heading: this._i18n("webexpress.webapp:kanban.heading", "Board"),
            message: this._i18n("webexpress.webapp:kanban.update.rejected", "The change was not saved and has been taken back.")
        });

        this._dispatch(webexpress.webui.Event.DATA_ERROR_EVENT, { action: action, error: result.error });
        this.update();
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