/**
 * A REST-enabled schedule. It extends the WebUI schedule with the data path:
 * the items of the shown period and the holidays of the years it touches are
 * loaded from REST endpoints, the matching range is reloaded whenever the view
 * or the period changes, and the item mutations are persisted.
 *
 * The views, the calendar cultures, the navigation and the interaction are
 * entirely those of the base control - the two share one visual and functional
 * concept and differ only in where the data comes from.
 *
 * Declarative configuration: the host carries a wx-service island named "data"
 * for the items and an optional one named "holidays", plus the base control's
 * attributes and the data attributes documented in
 * WebExpress.WebApp/docs/js/schedule.md.
 *
 * REST contract:
 *   GET    {data}?from=&to=      → { items: [...], holidays: [...] }
 *   POST   {data}                → { success, item }
 *   PUT    {data}                → { success, item }
 *   DELETE {data}?id=            → { success, id }
 *   GET    {holidays}?year=&region= → [...] or { holidays: [...] }
 *
 * It is ViewState-capable: when the host carries a data-wx-resource binding the
 * period is a slice of an enclosing ViewState, so the control subscribes to that
 * slice and the ViewState owns the central load; without a binding it owns its
 * wx-service islands and loads itself (standalone).
 *
 * In addition to the base control's events it dispatches:
 *   webexpress.webui.Event.DATA_REQUESTED_EVENT
 *   webexpress.webui.Event.DATA_ARRIVED_EVENT
 *   webexpress.webui.Event.DATA_ERROR_EVENT   a load or a write failed
 *   webexpress.webui.Event.CHANGE_VALUE_EVENT an item was created, updated or deleted
 */
webexpress.webapp.ScheduleCtrl = class extends webexpress.webui.ScheduleCtrl {

    /**
     * Initializes the REST schedule.
     * @param {HTMLElement} element - The host element.
     */
    constructor(element) {
        // consume the islands before the base constructor empties the host;
        // later reads are served from the element cache
        webexpress.webapp.Data.readState(element);
        webexpress.webapp.ServiceRegistry.fromElement(element);

        super(element);

        const data = element.dataset || {};

        // the client loads, reloads and caches unless it reads an explicit
        // "false", which is what the C# control emits for the opt-outs
        this._autoLoad = data.autoLoad !== "false";
        this._reloadOnNavigate = data.reloadOnNavigate !== "false";
        this._useCache = data.cache !== "false";
        this._holidayRegion = data.holidayRegion || "";
        this._creatable = data.creatable === "true";
        this._deletable = data.deletable === "true";

        const interval = parseInt(data.refreshInterval, 10);
        this._refreshInterval = Number.isFinite(interval) && interval > 0 ? interval : 0;

        // the resource a ViewState renders. when present, the schedule is a pure
        // view of a central resource the enclosing ViewState owns; when absent it
        // owns its state and loads itself (standalone).
        this._resource = (element.dataset && element.dataset.wxResource) || null;
        this._viewState = null;

        // the ranges and holiday years already loaded, so navigating back to a
        // month costs no request
        this._ranges = new Map();
        this._holidayYears = new Map();
        this._timer = null;

        // canonical ui state: a single source of truth for the loading flag,
        // seeded from the optional wx-state island
        this._store = new webexpress.webapp.ViewState(element, {
            standalone: true,
            state: Object.assign({ loading: false }, webexpress.webapp.Data.readState(element))
        });

        const services = webexpress.webapp.ServiceRegistry.fromElement(element);
        this._service = services.data || null;
        this._holidayService = services.holidays || null;

        // the items authored statically are the fallback the schedule keeps
        // showing while the endpoint is unreachable, so a failed load never
        // empties a calendar that had content. They are kept in the wire shape,
        // because the rendered model carries parsed dates that the model helpers
        // no longer recognise as a start.
        this._fallback = {
            items: this._wireItems(),
            holidays: this.model.holidays.map((holiday) => ({
                date: holiday.key,
                name: holiday.name,
                region: holiday.region,
                type: holiday.type
            }))
        };

        this._initPersistence(element);

        if (this._resource) {
            this._attachToViewState(element);
        } else if (this._service && this._autoLoad) {
            this._reload();

            // an external change of the service's domains re-queries and flashes,
            // so changes made by other users reach the calendar as well
            const dataChanges = webexpress.webapp.DataChangeSubscription.attachReload(
                [this._service], () => this._reload(true), element);
            if (dataChanges) {
                (element._wxCleanup = element._wxCleanup || []).push(() => dataChanges.detach());
            }
        }

        this._startRefreshTimer();
    }

    // -----------------------------------------------------------------------
    // wiring
    // -----------------------------------------------------------------------

    /**
     * Listens for the mutations the base control raises and persists them.
     * A move is the only mutation the base performs on its own; creating and
     * deleting go through the API of this control.
     * @param {HTMLElement} element - The host element.
     */
    _initPersistence(element) {
        element.addEventListener(webexpress.webui.Event.MOVE_EVENT, (e) => {
            if (!e.detail || e.detail.sender !== element || this._suppressPersist) {
                return;
            }

            this._persist("update", Object.assign({}, this._wireItem(e.detail.item), {
                start: e.detail.start,
                end: e.detail.end
            }));
        });
    }

    /**
     * Attaches the schedule to the enclosing ViewState and renders its resource
     * slice. The ViewState owns the state, the service and the central load.
     * @param {HTMLElement} element - The host element.
     */
    _attachToViewState(element) {
        const viewStateId = (element.dataset && element.dataset.wxViewstate) || null;

        webexpress.webapp.ViewStateRegistry.whenReady(element, viewStateId, (viewState) => {
            this._viewState = viewState;
            this._store = viewState;

            const service = viewState.serviceForResource(this._resource);
            if (service) {
                this._service = service;
            }

            const unsubscribe = viewState.watch((state) => state[this._resource], (slice) => this._applySlice(slice));
            (element._wxCleanup = element._wxCleanup || []).push(unsubscribe);

            this._applySlice(viewState.getState()[this._resource]);
        });
    }

    /**
     * Renders a resource slice the ViewState loaded centrally.
     * @param {object} slice - The resource slice { items, total, data, loading, error }.
     */
    _applySlice(slice) {
        slice = slice || {};

        if (slice.data) {
            const period = webexpress.webapp.scheduleModel.normalizePeriod(slice.data);
            this.model = period;
        }

        this._element.classList.remove("placeholder-glow");
        this._loading = false;
    }

    // loading flag accessor backed by the store, so the single source of truth
    // is the store

    get _loading() { return this._store.getState().loading; }
    set _loading(value) { this._store.setState({ loading: value }); }

    /**
     * Starts the periodic reload. It is for sources that cannot announce a
     * change; a schedule subscribed to the change domains of its service needs
     * no polling at all.
     */
    _startRefreshTimer() {
        if (this._refreshInterval <= 0 || this._resource) {
            return;
        }

        this._timer = setInterval(() => {
            if (this._isVisible()) {
                this._reload(true);
            }
        }, this._refreshInterval * 1000);
    }

    // -----------------------------------------------------------------------
    // loading
    // -----------------------------------------------------------------------

    /**
     * Announces the new period and loads it, which is what makes navigating and
     * switching the view fetch the matching items.
     */
    _dispatchNavigation() {
        super._dispatchNavigation();

        if (this._reloadOnNavigate) {
            this._reload();
        }
    }

    /**
     * Loads the shown period and the holidays of the years it touches.
     * @param {boolean} [force=false] - Whether to bypass the range cache.
     * @returns {Promise<void>} Resolves when the period has been applied.
     */
    async _reload(force = false) {
        if (this._viewState && this._resource) {
            this._viewState.reload(this._resource);
            return;
        }
        if (!this._service) {
            return;
        }

        const model = webexpress.webapp.scheduleModel;
        const range = this.range();
        const from = this._formatTimestamp(range.from, true);
        const to = this._formatTimestamp(range.to, true);
        const key = model.rangeKey(from, to);

        await this._loadHolidays(from, to, force);

        if (!force && this._useCache && this._ranges.has(key)) {
            return;
        }

        this._loading = true;
        this._element.classList.add("placeholder-glow");
        this._dispatch(webexpress.webui.Event.DATA_REQUESTED_EVENT, { from: from, to: to });

        const result = await this._service.query({ from: from, to: to });

        this._element.classList.remove("placeholder-glow");
        this._loading = false;

        if (!result.ok) {
            // a superseded query arrives as an abort result and is not a failure
            if (result.error.kind !== "abort") {
                this._fail("load", result.error, { from: from, to: to });
            }
            return;
        }

        const period = model.normalizePeriod(result.data);
        this._ranges.set(key, true);

        // a combined endpoint may answer with the holidays of the period; a
        // dedicated holiday service has already contributed its own
        const holidays = period.holidays.length > 0
            ? this._mergeHolidays(period.holidays)
            : this.model.holidays;

        this.model = {
            items: model.mergeRange(this._wireItems(), period.items, from, to),
            holidays: holidays
        };

        this._dispatch(webexpress.webui.Event.DATA_ARRIVED_EVENT, { from: from, to: to, count: period.items.length });
    }

    /**
     * Loads the holidays of every year the range touches, from the dedicated
     * holiday service. Holidays change once a year, so a year that has been
     * loaded is never requested again unless the reload is forced.
     * @param {string} from - The first day of the range.
     * @param {string} to - The day after the range.
     * @param {boolean} force - Whether to bypass the cache.
     * @returns {Promise<void>} Resolves when the holidays have been applied.
     */
    async _loadHolidays(from, to, force) {
        if (!this._holidayService) {
            return;
        }

        const model = webexpress.webapp.scheduleModel;
        const region = this._holidayRegion;
        const pending = model.yearsInRange(from, to)
            .filter((year) => force || !this._holidayYears.has(model.holidayKey(year, region)));

        for (const year of pending) {
            const result = await this._holidayService.query({ year: year, region: region });

            if (!result.ok) {
                if (result.error.kind !== "abort") {
                    this._fail("holidays", result.error, { year: year, region: region });
                }
                continue;
            }

            this._holidayYears.set(model.holidayKey(year, region), true);
            this.model = {
                items: this._wireItems(),
                holidays: this._mergeHolidays(model.normalizeHolidays(result.data))
            };
        }
    }

    /**
     * Merges freshly loaded holidays into the ones already held, keyed by day
     * and region so a reload replaces rather than duplicates them.
     * @param {Array<object>} loaded - The loaded holidays.
     * @returns {Array<object>} The merged holidays.
     */
    _mergeHolidays(loaded) {
        const merged = new Map();

        for (const holiday of this.model.holidays) {
            merged.set(`${holiday.key || holiday.date}@${holiday.region || ""}`, {
                date: holiday.key || holiday.date,
                name: holiday.name,
                region: holiday.region,
                type: holiday.type
            });
        }
        for (const holiday of loaded) {
            merged.set(`${holiday.date}@${holiday.region || ""}`, holiday);
        }

        return Array.from(merged.values());
    }

    /**
     * Returns the items in their wire shape, which is what the merge and the
     * writes operate on. The rendered model carries parsed dates, so it cannot
     * be handed back to the model helpers unchanged.
     * @returns {Array<object>} The items.
     */
    _wireItems() {
        return this.model.items.map((item) => this._wireItem(item));
    }

    /**
     * Converts a rendered item back into its wire shape.
     * @param {object} item - The rendered item.
     * @returns {object} The wire item.
     */
    _wireItem(item) {
        item = item || {};

        return {
            id: item.id,
            title: item.title,
            start: item.startDate ? this._formatTimestamp(item.startDate, item.allDay) : item.start,
            end: item.endDate ? this._formatTimestamp(item.endDate, item.allDay) : item.end,
            allDay: item.allDay === true,
            category: item.category,
            colorCss: item.colorCss,
            colorStyle: item.colorStyle,
            icon: item.icon,
            uri: item.uri,
            meta: item.meta
        };
    }

    // -----------------------------------------------------------------------
    // crud
    // -----------------------------------------------------------------------

    /**
     * Creates an item.
     * @param {object} item - The item, in the wire shape.
     * @returns {Promise<object|null>} The created item, or null when it was refused.
     */
    createItem(item) {
        if (!this._creatable) {
            return Promise.resolve(null);
        }

        return this._persist("create", item);
    }

    /**
     * Updates an item.
     * @param {object} item - The item, in the wire shape. It must carry an id.
     * @returns {Promise<object|null>} The updated item, or null when it was refused.
     */
    updateItem(item) {
        return this._persist("update", item);
    }

    /**
     * Deletes an item.
     * @param {string} id - The item id.
     * @returns {Promise<boolean>} True when the item was deleted.
     */
    async deleteItem(id) {
        if (!this._deletable || !this._service || !id) {
            return false;
        }

        const result = await this._service.remove({ params: { id: id } });

        if (!result.ok) {
            this._fail("delete", result.error, { id: id });
            return false;
        }

        this.model = {
            items: this._wireItems().filter((item) => item.id !== id),
            holidays: this.model.holidays
        };
        this._dispatch(webexpress.webui.Event.CHANGE_VALUE_EVENT, { action: "delete", id: id });

        return true;
    }

    /**
     * Persists a create or an update and folds the answer back into the model.
     * The server's version of the item wins, so an id it assigns or a value it
     * normalises is what the calendar goes on showing.
     * @param {string} action - "create" or "update".
     * @param {object} item - The item, in the wire shape.
     * @returns {Promise<object|null>} The persisted item, or null on failure.
     */
    async _persist(action, item) {
        if (!this._service) {
            return null;
        }

        const payload = webexpress.webapp.scheduleModel.toPayload(item);
        const result = action === "create"
            ? await this._service.create(payload)
            : await this._service.update(payload);

        if (!result.ok) {
            this._fail(action, result.error, { item: payload });
            // the optimistic move is rolled back by reloading the shown period,
            // so the calendar never keeps a change the server refused
            this._reload(true);
            return null;
        }

        const saved = webexpress.webapp.scheduleModel.normalizeItem(
            (result.data && result.data.item) || payload);
        const others = this._wireItems().filter((x) => x.id !== saved.id);

        // the model assignment re-renders and would otherwise be taken for a
        // fresh move by the persistence listener
        this._suppressPersist = true;
        this.model = { items: others.concat([saved]), holidays: this.model.holidays };
        this._suppressPersist = false;

        this._dispatch(webexpress.webui.Event.CHANGE_VALUE_EVENT, { action: action, id: saved.id, item: saved });

        return saved;
    }

    /**
     * Reports a failed load or write and leaves the last good model on screen.
     * An empty calendar would read as "there is nothing", which is exactly the
     * wrong conclusion when the endpoint is unreachable.
     * @param {string} action - The action that failed.
     * @param {object} error - The normalised service error.
     * @param {object} context - What was being attempted.
     */
    _fail(action, error, context) {
        const message = (error && error.message) || String(error);
        console.error(`schedule ${action} failed:`, message);

        this._dispatch(webexpress.webui.Event.DATA_ERROR_EVENT, Object.assign({
            action: action,
            error: error,
            message: message
        }, context));
    }

    // -----------------------------------------------------------------------
    // public surface and teardown
    // -----------------------------------------------------------------------

    /**
     * Restores the statically authored items, which is the fallback a page
     * switches to when it decides to stop talking to the endpoint.
     */
    restoreFallback() {
        this.model = { items: this._fallback.items.slice(), holidays: this._fallback.holidays.slice() };
    }

    /**
     * Reloads the shown period, bypassing the range cache.
     * @returns {Promise<void>} Resolves when the period has been applied.
     */
    refresh() {
        this._ranges.clear();
        this._holidayYears.clear();

        return this._reload(true);
    }

    /**
     * Forces an update of the control data, skipping the reload while the host
     * is not visible.
     */
    update() {
        if (this._viewState && this._resource) {
            this._viewState.reload(this._resource);
            return;
        }
        if (this._service && this._isVisible()) {
            this._reload(true);
        }
    }

    /**
     * Releases the refresh timer in addition to what the base control holds.
     */
    destroy() {
        if (this._timer !== null) {
            clearInterval(this._timer);
            this._timer = null;
        }

        super.destroy();
    }
};

// register the class in the webapp controller namespace
webexpress.webui.Controller.registerClass("wx-webapp-schedule", webexpress.webapp.ScheduleCtrl);
