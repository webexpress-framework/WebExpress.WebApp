/**
 * REST-enabled interactive gantt chart control.
 *
 * Layout
 * ------
 * The host is split into a toolbar, a task grid pane (left), a draggable
 * splitter and a scrollable timeline pane (right). Both panes render the same
 * flattened row order, so a shared row height keeps them aligned; the timeline
 * pane owns the vertical scroll position and mirrors it into the grid pane.
 * The timeline offers a day, week and month scale with a zoom factor on top,
 * pans by dragging its free surface, and always fills the pane width. The
 * scales, the initial scale, the zoom and the visible grid columns are
 * configurable through the wx-state island or data attributes.
 *
 * Interaction
 * -----------
 * Bars are dragged to reschedule (whole-day snapping), their edges resize the
 * duration and a small handle adjusts the progress. Dragging one of the link
 * ports at the bar edges onto another bar creates a typed dependency
 * (start/end port combinations map to FS, SS, FF and SF), drawn as orthogonal
 * SVG connectors with arrowheads. New tasks are created through the toolbar
 * button or a double-click on a free spot in the timeline; the grid cells are
 * edited inline. Containers are tasks with children: their dates and progress
 * are derived from the subtree and they collapse in the grid.
 *
 * Data and REST integration
 * -------------------------
 * The model is a pure JSON structure of tasks and links (see
 * webexpress.webapp.ganttModel), loaded with a single GET on the data service.
 * Discrete mutations persist REST-fully against the same base:
 * POST /tasks, PUT /tasks/{id}, DELETE /tasks/{id} and POST /links,
 * DELETE /links/{id}. Every mutation raises a DOM event on the host and calls
 * the matching assignable callback (onTaskCreate, onTaskUpdate, onTaskDelete,
 * onLinkCreate, onLinkDelete).
 *
 * Rendering
 * ---------
 * The chart is a pure function of the state: render(state) describes the
 * toolbar, the grid and the timeline, and the keyed reconciler patches the
 * host. What a running gesture shows is state as well - the previewed
 * geometry of a dragged bar, the connector a link gesture draws, the grid
 * width chosen through the splitter, an open cell editor - so the connectors
 * follow a dragged bar through the same render that draws it. Only the widths
 * the layout decides are measured, and they enter the state like any change.
 * The project is never changed in place: every mutation sets new task and
 * link lists.
 *
 * Sandbox
 * -------
 * Inside the sandbox the mutations stay local: the persistence hooks record
 * which tasks and links were touched instead of sending requests. Ending the
 * sandbox lets the user save the net result of all changes - one request per
 * touched resource, compared against the state on entry - or discard them by
 * restoring that state.
 */
webexpress.webapp.GanttCtrl = class extends webexpress.webapp.Data {

    static ROW_HEIGHT = 32;
    static HEAD_HEIGHT = 44;
    static ZOOM_STEP = 1.25;
    static SCALES = ["day", "week", "month"];
    static COLUMNS = ["label", "start", "end", "duration", "progress", "resources"];

    // pane width each column claims before the next one may show; the sums
    // mark the thresholds at which shrinking hides the columns right to left,
    // matching the CSS column bases keeps the task name from being squeezed out
    static COLUMN_MIN_WIDTHS = { label: 130, start: 84, end: 84, duration: 60, progress: 60, resources: 110 };

    static DEFAULT_GRID_WIDTH = 420;
    static MIN_GRID_WIDTH = 160;
    static SPLITTER_WIDTH = 6;

    static TASK_CREATE_EVENT = "webexpress.webapp.gantt.task.create";
    static TASK_UPDATE_EVENT = "webexpress.webapp.gantt.task.update";
    static TASK_DELETE_EVENT = "webexpress.webapp.gantt.task.delete";
    static LINK_UPDATE_EVENT = "webexpress.webapp.gantt.link.update";
    static LINK_CREATE_EVENT = "webexpress.webapp.gantt.link.create";
    static LINK_DELETE_EVENT = "webexpress.webapp.gantt.link.delete";
    static SELECT_EVENT = "webexpress.webapp.gantt.select";
    static SANDBOX_ENTER_EVENT = "webexpress.webapp.gantt.sandbox.enter";
    static SANDBOX_LEAVE_EVENT = "webexpress.webapp.gantt.sandbox.leave";

    // assignable mutation callbacks, the imperative twin of the DOM events
    onTaskCreate = null;
    onTaskUpdate = null;
    onTaskDelete = null;
    onLinkCreate = null;
    onLinkUpdate = null;
    onLinkDelete = null;

    // configuration
    _restUri = "";
    _resource = null;
    _viewState = null;
    _allowedScales = null;
    _visibleColumns = null;
    _sandboxOffered = false;

    // the entry state and the touched ids of an open sandbox; outside the store
    // because only the persistence hooks and the save read them
    _sandbox = null;

    // a navigation cannot wait for the user to decide about the sandbox, so the
    // browser asks instead; registered only while a sandbox is open
    _onBeforeUnload = (e) => {
        if (this.sandboxChangeCount() === 0) {
            return undefined;
        }
        e.preventDefault();
        // chromium still shows the prompt only when returnValue is set
        e.returnValue = "";
        return "";
    };

    // the bookkeeping of a running gesture (where it started, the task as it
    // was); what the gesture shows is state, so the render draws it
    _drag = null;
    _skipNextCanvasClick = false;

    _onHostKeyDown = (e) => this._onKeyDown(e);
    _onSplitterDown = (e) => this._beginSplitDrag(e);
    _onSplitterDblClick = () => this.toggleGrid();
    _onChartScroll = () => this._syncVerticalScroll();
    _onCanvasMouseDown = (e) => this._beginPan(e);
    _onCanvasDblClickHandler = (e) => this._onCanvasDblClick(e);

    _onAdd = () => {
        const task = this.addTask();
        if (task) {
            this._beginCellEdit(task.id, "label");
        }
    };

    _onChartWheel = (e) => {
        // ctrl+wheel zooms around the timeline like map interfaces do
        if (e.ctrlKey) {
            if (typeof e.preventDefault === "function") {
                e.preventDefault();
            }
            if (e.deltaY < 0) { this.zoomIn(); } else { this.zoomOut(); }
        }
    };

    // the timeline pane owns the vertical scroll, the grid only follows; a
    // wheel over the grid is forwarded so both panes feel scrollable
    _onGridWheel = (e) => {
        if (this._chartScroll && e.deltaY) {
            this._chartScroll.scrollTop += e.deltaY;
            this._syncVerticalScroll();
            if (typeof e.preventDefault === "function") {
                e.preventDefault();
            }
        }
    };

    _onCanvasClick = (e) => {
        // a pan that actually moved must not be mistaken for a click
        if (this._skipNextCanvasClick) {
            this._skipNextCanvasClick = false;
            return;
        }
        // a click on the empty surface clears the selection
        if (e.target === this._canvas) {
            this.select(null, null);
        }
    };

    _onEditInput = () => {
        const editing = this.state.editing;
        if (editing && this._editInput) {
            this.setState({ editing: Object.assign({}, editing, { draft: this._editInput.value }) });
        }
    };

    _onEditKeyDown = (e) => {
        if (e.key === "Enter") {
            this._commitEdit();
        } else if (e.key === "Escape") {
            this.setState({ editing: null });
        }
    };

    // a blur from an editor the render has already replaced (a server id
    // renamed the row) must not end the edit that lives on in its successor
    _onEditBlur = (e) => {
        if (e && e.target && e.target !== this._editInput) {
            return;
        }
        this._commitEdit();
    };

    /**
     * Initializes the gantt control on the host element.
     * @param {HTMLElement} element - The host element with the wx-webapp-gantt class.
     */
    constructor(element) {
        // consume the islands before the base constructor caches them, so the
        // seeded project and the services survive the dom rebuild
        const island = webexpress.webapp.Data.readState(element);
        webexpress.webapp.ServiceRegistry.fromElement(element);

        const model = webexpress.webapp.ganttModel;
        let calendar = island.calendar;
        if (calendar === undefined && element.dataset.calendar) {
            try {
                calendar = JSON.parse(element.dataset.calendar);
            } catch {
                calendar = null;
            }
        }
        const project = model.normalizeProject({ tasks: island.tasks, links: island.links, calendar: calendar });
        model.rollup(project.tasks, project.calendar);

        const dataset = element.dataset || {};
        const scales = webexpress.webapp.GanttCtrl._parseScales(island.scales !== undefined ? island.scales : dataset.scales);
        const scale = scales.includes(island.scale || dataset.scale) ? (island.scale || dataset.scale) : scales[0];
        const columns = webexpress.webapp.GanttCtrl._parseColumns(island.columns !== undefined ? island.columns : dataset.columns);

        super(element, {
            state: {
                loading: false,
                error: null,
                scale: scale,
                zoom: Number(island.zoom !== undefined ? island.zoom : dataset.zoom) || 1,
                readonly: island.readonly === true || dataset.readonly === "true",
                gridCollapsed: island.gridCollapsed === true || dataset.gridCollapsed === "true",
                calendar: project.calendar,
                tasks: project.tasks,
                links: project.links,
                selectedTask: null,
                selectedLink: null,
                // null outside the sandbox, otherwise "active", "deciding" or "saving"
                sandbox: null,
                // the widths the layout decided, measured: the host width sets the
                // filler days of the timeline, the grid pane width the visible columns
                hostWidth: element.clientWidth || 0,
                fitWidth: null,
                // the grid pane width chosen through the splitter
                gridWidth: null,
                // the open cell editor { taskId, key, draft }
                editing: null,
                // the bar a gesture moves { taskId, left, width, progress }
                preview: null,
                // the connector a link gesture draws { from, fromSide, pointer, target }
                linkDraft: null
            }
        });

        this._allowedScales = scales;
        this._visibleColumns = columns;
        this._sandboxOffered = island.sandbox === true || dataset.sandbox === "true";
        this._service = this.useService("data");
        this._restUri = this._service ? this._service.baseUri : "";
        this._resource = dataset.wxResource || null;

        // the registered selector class must never be re-added (the controller
        // strips it on instantiation), so the control marks itself distinctly
        element.classList.add("wx-gantt");
        element.tabIndex = 0;

        this._markerId = this._newId("gantt-arrow");
        this.mount();

        if (this._resource) {
            this._attachToViewState(element);
        } else if (this._restUri !== "" && project.tasks.length === 0) {
            this._load();
        }
    }

    /**
     * Restricts the offered scales to a configured subset, falling back to all
     * three when the configuration is absent or names no valid scale.
     * @param {*} value - The raw configuration (csv string or array).
     * @returns {Array<string>} The allowed scales in canonical order.
     */
    static _parseScales(value) {
        let names = value;
        if (typeof names === "string") {
            names = names.split(",");
        }
        if (!Array.isArray(names)) {
            return webexpress.webapp.GanttCtrl.SCALES.slice();
        }
        const allowed = webexpress.webapp.GanttCtrl.SCALES.filter((s) => names.map((n) => String(n).trim()).includes(s));
        return allowed.length > 0 ? allowed : webexpress.webapp.GanttCtrl.SCALES.slice();
    }

    /**
     * Restricts the grid columns to a configured subset, falling back to all
     * columns when the configuration is absent or names no valid column. The
     * name column always stays, because a row without its label is unusable.
     * @param {*} value - The raw configuration (csv string or array).
     * @returns {Array<string>} The visible column keys in canonical order.
     */
    static _parseColumns(value) {
        let names = value;
        if (typeof names === "string") {
            names = names.split(",");
        }
        if (!Array.isArray(names)) {
            return webexpress.webapp.GanttCtrl.COLUMNS.slice();
        }

        // "name" is the natural authoring alias of the label column
        names = names.map((n) => {
            const trimmed = String(n).trim();
            return trimmed === "name" ? "label" : trimmed;
        });

        const allowed = webexpress.webapp.GanttCtrl.COLUMNS.filter((c) => names.includes(c));
        if (allowed.length === 0) {
            return webexpress.webapp.GanttCtrl.COLUMNS.slice();
        }
        if (!allowed.includes("label")) {
            allowed.unshift("label");
        }
        return allowed;
    }

    // the project, the view configuration and the selection are backed by the
    // component store, so every mutation re-renders through the subscription
    // that mount established

    get _calendar() { return this.state.calendar; }
    get _tasks() { return this.state.tasks || []; }
    get _links() { return this.state.links || []; }
    get _scale() { return this.state.scale; }
    get _zoom() { return this.state.zoom; }
    get _readonly() { return this._readonlyOf(this.state); }
    get _gridCollapsed() { return this.state.gridCollapsed === true; }

    /**
     * Tells whether a state forbids edits. A sandbox being saved is frozen, an
     * edit now would race the requests built from it.
     * @param {object} state - The state.
     * @returns {boolean} True when the plan cannot be edited.
     */
    _readonlyOf(state) {
        return state.readonly === true || state.sandbox === "saving";
    }

    /**
     * Derives the containers of a task list from their subtrees. The rollup
     * writes into the tasks it is given, so it works on copies: the tasks of
     * the current state belong to a render that has already happened.
     * @param {Array<object>} tasks - The tasks.
     * @returns {Array<object>} New tasks with the derived container fields.
     */
    _rolledUp(tasks) {
        return webexpress.webapp.ganttModel.rollup(tasks.map((task) => Object.assign({}, task)), this._calendar);
    }

    /**
     * Collapses or expands the task grid pane, leaving the full width to the
     * timeline while collapsed. The toolbar toggle and a double-click on the
     * splitter call this, and it is part of the public view API.
     * @returns {void}
     */
    toggleGrid() {
        this.setState({ gridCollapsed: !this._gridCollapsed });
    }

    /**
     * Returns a copy of the current project.
     * @returns {object} The project { tasks, links }.
     */
    get value() {
        return {
            tasks: this._tasks.map((task) => Object.assign({}, task, { resources: task.resources.slice() })),
            links: this._links.map((link) => Object.assign({}, link)),
            calendar: webexpress.webapp.ganttModel.normalizeCalendar(this._calendar)
        };
    }

    /**
     * Replaces the current project and rerenders.
     * @param {object} data - The raw project { tasks, links }.
     */
    set value(data) {
        this._applyProject(data);
    }

    /**
     * Reloads the project from the configured REST endpoint, or through the
     * enclosing ViewState when the control is a resource view.
     * @returns {void}
     */
    refresh() {
        if (this._viewState) {
            this._viewState.reload(this._resource);
            return;
        }
        if (this._restUri !== "") {
            this._load();
        }
    }

    /**
     * Forces an update of the control data, the framework refresh contract.
     * @returns {void}
     */
    update() {
        this.refresh();
    }

    /**
     * Switches the timeline scale.
     * @param {string} scale - The scale: day, week or month.
     * @returns {void}
     */
    setScale(scale) {
        if (this._allowedScales.includes(scale) && scale !== this._scale) {
            this.setState({ scale: scale });
        }
    }

    /**
     * Sets the zoom factor, clamped to the model bounds.
     * @param {number} zoom - The zoom factor.
     * @returns {void}
     */
    setZoom(zoom) {
        const model = webexpress.webapp.ganttModel;
        const clamped = Math.min(model.MAX_ZOOM, Math.max(model.MIN_ZOOM, Number(zoom) || 1));
        if (clamped !== this._zoom) {
            this.setState({ zoom: clamped });
        }
    }

    /**
     * Zooms the timeline in by one step.
     * @returns {void}
     */
    zoomIn() {
        this.setZoom(this._zoom * webexpress.webapp.GanttCtrl.ZOOM_STEP);
    }

    /**
     * Zooms the timeline out by one step.
     * @returns {void}
     */
    zoomOut() {
        this.setZoom(this._zoom / webexpress.webapp.GanttCtrl.ZOOM_STEP);
    }

    /**
     * Scrolls the timeline so the current day sits in the visible third.
     * @returns {void}
     */
    scrollToToday() {
        if (!this._chartScroll) {
            return;
        }
        const model = webexpress.webapp.ganttModel;
        const range = model.projectRange(this._tasks);
        const offset = model.dateToOffset(model.parseDate(new Date()), range.start, model.pxPerDay(this._scale, this._zoom));
        this._chartScroll.scrollLeft = Math.max(0, offset - (this._chartScroll.clientWidth || 0) / 3);
    }

    // -------------------------------------------------------------- sandbox

    /**
     * Gets a value indicating whether the sandbox is open, in which changes
     * stay local until they are saved or discarded.
     * @returns {boolean} True while the sandbox is open.
     */
    get inSandbox() {
        return this._sandbox !== null;
    }

    /**
     * Opens the sandbox. From now on mutations are only recorded, so a planner
     * can try out a rescheduling without the server - and everyone else looking
     * at the plan - seeing the intermediate steps.
     * @returns {boolean} True when opened, false when already open or read-only.
     */
    enterSandbox() {
        if (this._sandbox || this._readonly) {
            return false;
        }

        const model = webexpress.webapp.ganttModel;
        // no mutation changes a task or link list in place, so the lists of the
        // entry state stay as they are and discarding can return to them
        this._sandbox = {
            tasks: this._tasks,
            links: this._links,
            storedTasks: new Map(this._tasks.map((t) => [t.id, JSON.stringify(model.taskToWire(t))])),
            storedLinks: new Map(this._links.map((l) => [l.id, JSON.stringify(model.linkToWire(l))])),
            touchedTasks: new Set(),
            touchedLinks: new Set(),
            // a reload held back while open, or a save that got partway, leaves
            // the entry state behind the server
            stale: false,
            wrote: false
        };

        window.addEventListener("beforeunload", this._onBeforeUnload);

        this.setState({ sandbox: "active" });
        this._emit(webexpress.webapp.GanttCtrl.SANDBOX_ENTER_EVENT, null, {});
        return true;
    }

    /**
     * Counts the requests saving the sandbox would send. Touched resources
     * that ended where they started, or were created and deleted again, do
     * not count, so the number is what the user really changed.
     * @returns {number} The pending creates, changes and deletions.
     */
    sandboxChangeCount() {
        if (!this._sandbox) {
            return 0;
        }
        const plan = this._sandboxPlan();
        return [plan.tasks, plan.links].reduce((sum, diff) => sum + diff.create.length + diff.update.length + diff.remove.length, 0);
    }

    /**
     * Ends the sandbox the way the toolbar does: without changes it closes at
     * once, otherwise it asks whether to save or discard them.
     * @returns {void}
     */
    endSandbox() {
        if (this.state.sandbox !== "active") {
            return;
        }
        if (this.sandboxChangeCount() === 0) {
            this.discardSandbox();
            return;
        }
        this.setState({ sandbox: "deciding" });
    }

    /**
     * Returns from the end decision to editing inside the sandbox.
     * @returns {void}
     */
    continueSandbox() {
        if (this.state.sandbox === "deciding") {
            this.setState({ sandbox: "active" });
        }
    }

    /**
     * Saves the net result of the sandbox and closes it. The requests go out
     * one by one, because a created task needs its server id before a child or
     * a link can refer to it. A refusal stops the save and keeps the sandbox
     * open with exactly the changes that were not stored yet, so the user can
     * correct them and save again, or discard them.
     * @returns {Promise<boolean>} True when everything was stored and the sandbox closed.
     */
    async saveSandbox() {
        if (!this._sandbox || this.state.sandbox === "saving") {
            return false;
        }
        if (!this._service) {
            this._closeSandbox(true);
            return true;
        }

        const model = webexpress.webapp.ganttModel;
        const plan = this._sandboxPlan();

        // a vetoed save keeps the sandbox open as it is, so nothing has to be taken back
        const before = this._dispatch(webexpress.webui.Event.BEFORE_SAVE_EVENT,
            { action: "sandbox", payload: plan }, { cancelable: true });
        if (before && before.defaultPrevented) {
            return false;
        }

        const task = (id) => this._tasks.find((t) => t.id === id);
        const link = (id) => this._links.find((l) => l.id === id);
        const steps = [
            ...plan.tasks.create.map((id) => ({ kind: "tasks", op: "create", id: id,
                send: () => this._service.create(model.taskToWire(task(id)), { path: "/tasks" }) })),
            ...plan.tasks.update.map((id) => ({ kind: "tasks", op: "update", id: id,
                send: () => this._service.update(model.taskToWire(task(id)), { path: "/tasks/" + encodeURIComponent(id) }) })),
            // removals come first, so a dependency moved onto a pair another one
            // has just left is not refused as a duplicate
            ...plan.links.remove.map((id) => ({ kind: "links", op: "remove", id: id,
                send: () => this._service.remove({ path: "/links/" + encodeURIComponent(id) }) })),
            ...plan.links.update.map((id) => ({ kind: "links", op: "update", id: id,
                send: () => this._service.update(model.linkToWire(link(id)), { path: "/links/" + encodeURIComponent(id) }) })),
            ...plan.links.create.map((id) => ({ kind: "links", op: "create", id: id,
                send: () => this._service.create(model.linkToWire(link(id)), { path: "/links" }) })),
            ...plan.tasks.remove.map((id) => ({ kind: "tasks", op: "remove", id: id,
                send: () => this._service.remove({ path: "/tasks/" + encodeURIComponent(id) }) }))
        ];

        this.setState({ sandbox: "saving" });

        for (const step of steps) {
            const result = await step.send();
            if (!result.ok && !(step.op === "remove" && webexpress.webapp.GanttCtrl._alreadyGone(result))) {
                if (result.error.kind !== "abort") {
                    this._rejectWrite(step.op + " " + step.kind.slice(0, -1), result,
                        this._i18n("webexpress.webapp:gantt.sandbox.save_failed", "Not all changes could be saved. The sandbox stays open."));
                }
                this.setState({ sandbox: "active" });
                return false;
            }
            this._settleSandboxStep(step, result);
        }

        this._closeSandbox(true);
        this._dispatch(webexpress.webui.Event.SAVED_EVENT, { action: "sandbox" });
        return true;
    }

    /**
     * Discards every change of the sandbox by restoring the state on entry,
     * and closes it.
     * @returns {boolean} True when the sandbox was open and is now closed.
     */
    discardSandbox() {
        if (!this._sandbox || this.state.sandbox === "saving") {
            return false;
        }
        this._closeSandbox(false);
        return true;
    }

    // ------------------------------------------------------------ mutations

    /**
     * Creates a task, persists it with POST and raises the create event. The
     * defaults produce a one day task starting today, so the caller only names
     * what differs.
     * @param {object} [partial={}] - The task fields to apply over the defaults.
     * @param {object} [options={}] - Options: afterId inserts behind a sibling.
     * @returns {object|null} The created task, or null when read-only.
     */
    addTask(partial = {}, options = {}) {
        if (this._readonly) {
            return null;
        }

        const model = webexpress.webapp.ganttModel;
        const raw = Object.assign({
            id: this._newId("t"),
            label: this._i18n("webexpress.webapp:gantt.new_task", "New task"),
            start: model.formatIso(model.parseDate(new Date())),
            duration: 1,
            progress: 0
        }, partial);

        const task = model.normalizeTask(raw, this._calendar);
        if (!task || this._tasks.some((existing) => existing.id === task.id)
            || !model.canParent(this._tasks, task.id, task.parentId)) {
            return null;
        }

        const tasks = this._tasks.slice();
        let index = tasks.length;
        if (options.afterId) {
            const anchor = tasks.findIndex((t) => t.id === options.afterId);
            if (anchor !== -1) {
                index = anchor + 1;
            }
        }
        tasks.splice(index, 0, task);
        const rolled = this._rolledUp(tasks);
        const created = rolled[index];

        this.setState({ tasks: rolled, selectedTask: created.id, selectedLink: null });
        this._persistTaskCreate(created);
        this._emit(webexpress.webapp.GanttCtrl.TASK_CREATE_EVENT, "onTaskCreate", { task: Object.assign({}, created) });

        return created;
    }

    /**
     * Applies a partial patch to a task, persists it with PUT and raises the
     * update event. Dates and duration are re-derived from the patched fields:
     * a patched duration recomputes the end, a patched start/end pair
     * recomputes the duration.
     * @param {string} id - The task id.
     * @param {object} patch - The fields to change.
     * @returns {object|null} The updated task, or null when unknown.
     */
    updateTask(id, patch) {
        const model = webexpress.webapp.ganttModel;
        const current = this._tasks.find((t) => t.id === id);
        if (!current || this._readonly) {
            return null;
        }

        const raw = Object.assign({}, current, patch, { id: current.id });
        if (patch.duration !== undefined && patch.type === undefined) {
            delete raw.type;
        }
        if (patch.start !== undefined && patch.end === undefined) {
            delete raw.end;
        }
        if (patch.duration !== undefined && patch.end === undefined) {
            // the end is derived again, otherwise the stale end would win
            delete raw.end;
        }

        const task = model.normalizeTask(raw, this._calendar);
        if (!task || !model.canParent(this._tasks, task.id, task.parentId)) {
            return null;
        }

        const tasks = this._rolledUp(this._tasks.map((t) => (t.id === id ? task : t)));
        const updated = tasks.find((t) => t.id === id);

        this.setState({ tasks: tasks });
        this._persistTaskUpdate(updated);
        this._emit(webexpress.webapp.GanttCtrl.TASK_UPDATE_EVENT, "onTaskUpdate", {
            task: Object.assign({}, updated),
            patch: Object.assign({}, patch)
        });

        return updated;
    }

    /**
     * Deletes a task including its subtree and every link that touches a
     * removed task, persists the deletions and raises the delete events.
     * @param {string} id - The task id.
     * @returns {boolean} True when the task existed and was removed.
     */
    removeTask(id) {
        const task = this._tasks.find((t) => t.id === id);
        if (!task || this._readonly) {
            return false;
        }

        // the subtree falls with its container, ids are collected up front
        const removed = new Set([id]);
        let grown = true;
        while (grown) {
            grown = false;
            for (const t of this._tasks) {
                if (t.parentId !== null && removed.has(t.parentId) && !removed.has(t.id)) {
                    removed.add(t.id);
                    grown = true;
                }
            }
        }

        const removedLinks = this._links.filter((link) => removed.has(link.from) || removed.has(link.to));
        const tasks = this._rolledUp(this._tasks.filter((t) => !removed.has(t.id)));
        const links = this._links.filter((link) => !removed.has(link.from) && !removed.has(link.to));

        this.setState({ tasks: tasks, links: links, selectedTask: null, selectedLink: null });

        for (const removedId of removed) {
            this._persistTaskDelete(removedId);
        }
        for (const link of removedLinks) {
            this._persistLinkDelete(link.id);
            this._emit(webexpress.webapp.GanttCtrl.LINK_DELETE_EVENT, "onLinkDelete", { link: Object.assign({}, link) });
        }
        this._emit(webexpress.webapp.GanttCtrl.TASK_DELETE_EVENT, "onTaskDelete", {
            task: Object.assign({}, task),
            removedIds: Array.from(removed)
        });

        return true;
    }

    /**
     * Creates a typed dependency between two tasks, persists it with POST and
     * raises the create event. The link is refused when it would duplicate an
     * existing pair, reference itself or close a cycle.
     * @param {string} fromId - The predecessor task id.
     * @param {string} toId - The successor task id.
     * @param {string} [type="FS"] - The link type: FS, SS, FF or SF.
     * @returns {object|null} The created link, or null when refused.
     */
    addLink(fromId, toId, type = "FS") {
        const model = webexpress.webapp.ganttModel;
        if (!model.LINK_TYPES.includes(String(type).toUpperCase()) || this._readonly || !model.canLink(this._tasks, this._links, fromId, toId).ok) {
            return null;
        }

        const link = model.normalizeLink({ id: this._newId("l"), from: fromId, to: toId, type: type });
        const links = this._links.concat([link]);

        this.setState({ links: links, selectedLink: link.id, selectedTask: null });
        this._persistLinkCreate(link);
        this._emit(webexpress.webapp.GanttCtrl.LINK_CREATE_EVENT, "onLinkCreate", { link: Object.assign({}, link) });

        return link;
    }

    /**
     * Changes an existing dependency without replacing its identity. Validation
     * excludes the current link so changing its type does not appear duplicate.
     * @param {string} id - The dependency id.
     * @param {object} patch - The endpoint or relationship type changes.
     * @returns {object|null} The changed link, or null when invalid or read-only.
     */
    updateLink(id, patch) {
        const model = webexpress.webapp.ganttModel;
        const current = this._links.find((link) => link.id === id);
        if (!current || this._readonly) {
            return null;
        }
        const raw = Object.assign({}, current, patch, { id: id });
        if (!model.LINK_TYPES.includes(String(raw.type).toUpperCase())) {
            return null;
        }
        const link = model.normalizeLink(raw);
        if (!link || !model.canLink(this._tasks, this._links.filter((item) => item.id !== id), link.from, link.to).ok) {
            return null;
        }
        this.setState({ links: this._links.map((item) => item.id === id ? link : item) });
        this._persistLinkUpdate(link, current);
        this._emit(webexpress.webapp.GanttCtrl.LINK_UPDATE_EVENT, "onLinkUpdate", { link: Object.assign({}, link) });
        return link;
    }

    /**
     * Deletes a dependency, persists the deletion and raises the delete event.
     * @param {string} id - The link id.
     * @returns {boolean} True when the link existed and was removed.
     */
    removeLink(id) {
        const link = this._links.find((l) => l.id === id);
        if (!link || this._readonly) {
            return false;
        }

        this.setState({ links: this._links.filter((l) => l.id !== id), selectedLink: null });
        this._persistLinkDelete(id);
        this._emit(webexpress.webapp.GanttCtrl.LINK_DELETE_EVENT, "onLinkDelete", { link: Object.assign({}, link) });

        return true;
    }

    /**
     * Toggles the collapse state of a container row. Collapsing is a pure
     * presentation concern, so it neither persists nor raises events.
     * @param {string} id - The container task id.
     * @returns {void}
     */
    toggleCollapse(id) {
        this.setState({
            tasks: this._tasks.map((t) => (t.id === id ? Object.assign({}, t, { collapsed: !t.collapsed }) : t))
        });
    }

    /**
     * Selects a task or a link (or clears the selection with nulls) and raises
     * the select event.
     * @param {string|null} taskId - The task id or null.
     * @param {string|null} [linkId=null] - The link id or null.
     * @returns {void}
     */
    select(taskId, linkId = null) {
        if (taskId === this.state.selectedTask && linkId === this.state.selectedLink) {
            return;
        }
        this.setState({ selectedTask: taskId, selectedLink: linkId });
        this._emit(webexpress.webapp.GanttCtrl.SELECT_EVENT, null, { taskId: taskId, linkId: linkId });
    }

    // ----------------------------------------------------------------- REST

    /**
     * Reloads the project. The public load surface of the component
     * contract, so intents and the data change subscription can trigger a
     * reload without knowing the internal loader.
     * @returns {Promise<void>} Resolves when the load settled.
     */
    load() {
        return this._load();
    }

    /**
     * Loads the project from the data service.
     * @returns {Promise<void>} Resolves when the load settled.
     */
    async _load() {
        if (!this._service) {
            return;
        }
        if (this._sandbox) {
            // a reload would wipe the sandbox; it is caught up once the sandbox closes
            this._sandbox.stale = true;
            return;
        }

        this.setState({ loading: true, error: null });
        this._element.classList.add("placeholder-glow");

        const result = await this._service.query({});

        this._element.classList.remove("placeholder-glow");

        if (!result.ok) {
            // a superseded query arrives as an abort result and is ignored
            if (result.error.kind === "abort") {
                return;
            }
            console.error("gantt load failed:", webexpress.webapp.ServiceResult.describe(result));
            this.setState({ loading: false, error: result.error.message || "load failed" });
            return;
        }

        this._applyProject(result.data, { loading: false, error: null });
    }

    /**
     * Normalises a raw project payload and replaces the store slice.
     * @param {object} data - The raw project { tasks, links }.
     * @param {object} [extra={}] - Additional state keys to set alongside.
     */
    _applyProject(data, extra = {}) {
        const model = webexpress.webapp.ganttModel;
        const project = model.normalizeProject(Object.assign({ calendar: this._calendar }, data));
        model.rollup(project.tasks, project.calendar);
        this.setState(Object.assign({ tasks: project.tasks, links: project.links, calendar: project.calendar,
            selectedTask: null, selectedLink: null }, extra));
    }

    /**
     * Attaches the control to the enclosing ViewState and renders its
     * resource slice. The ViewState owns the state, the service and the central
     * load, while mutations still persist through the ViewState's data service.
     * @param {HTMLElement} element - The host element.
     */
    _attachToViewState(element) {
        if (!webexpress.webapp.ViewStateRegistry) {
            return;
        }

        const viewStateId = (element.dataset && element.dataset.wxViewstate) || null;

        webexpress.webapp.ViewStateRegistry.whenReady(element, viewStateId, (viewState) => {
            this._viewState = viewState;

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
     * Renders a resource slice the ViewState loaded centrally.
     * @param {object} slice - The resource slice { data, loading, error }.
     */
    _applySlice(slice) {
        slice = slice || {};
        if (slice.data && this._sandbox) {
            // a reload would wipe the sandbox; it is caught up once the sandbox closes
            this._sandbox.stale = true;
        } else if (slice.data) {
            this._applyProject(slice.data);
        }
        this._element.classList.remove("placeholder-glow");
    }

    /**
     * Persists a created task with POST. A server assigned id replaces the
     * client id in tasks and links, so follow-up mutations address the
     * canonical resource.
     * @param {object} task - The created task.
     */
    _persistTaskCreate(task) {
        if (this._recordInSandbox("tasks", task.id) || !this._service) {
            return;
        }
        this._saveAction("create task", webexpress.webapp.ganttModel.taskToWire(task),
            (sent) => this._service.create(sent, { path: "/tasks" }), () => this.refresh()).then((result) => {
            if (!result.ok) {
                if (result.error.kind !== "abort") {
                    this._rejectWrite("create task", result);
                    this.refresh();
                }
                return;
            }
            const serverId = this._serverId(result);
            if (serverId && serverId !== task.id) {
                this._remapTaskId(task.id, serverId);
            }
        });
    }

    /**
     * Persists a task change with PUT.
     * @param {object} task - The updated task.
     */
    _persistTaskUpdate(task) {
        if (this._recordInSandbox("tasks", task.id) || !this._service) {
            return;
        }
        this._saveAction("update task", webexpress.webapp.ganttModel.taskToWire(task),
            (sent) => this._service.update(sent, { path: "/tasks/" + encodeURIComponent(task.id) }), () => this.refresh())
            .then((result) => {
                if (!result.ok && result.error.kind !== "abort") {
                    this._rejectWrite("update task", result);
                    this.refresh();
                }
            });
    }

    /**
     * Persists a task deletion with DELETE.
     * @param {string} id - The task id.
     */
    _persistTaskDelete(id) {
        if (this._recordInSandbox("tasks", id) || !this._service) {
            return;
        }
        this._saveAction("delete task", { id: id },
            () => this._service.remove({ path: "/tasks/" + encodeURIComponent(id) }), () => this.refresh()).then((result) => {
            if (!result.ok && result.error.kind !== "abort" && !webexpress.webapp.GanttCtrl._alreadyGone(result)) {
                this._rejectWrite("delete task", result);
                this.refresh();
            }
        });
    }

    /**
     * Persists a created link with POST, adopting a server assigned id. A
     * refused link is withdrawn again, because the chart would otherwise show a
     * dependency the server never stored until the next reload.
     * @param {object} link - The created link.
     */
    _persistLinkCreate(link) {
        if (this._recordInSandbox("links", link.id) || !this._service) {
            return;
        }
        const withdraw = () => this.setState({
            links: this._links.filter((l) => l.id !== link.id),
            selectedLink: this.state.selectedLink === link.id ? null : this.state.selectedLink
        });
        this._saveAction("create link", webexpress.webapp.ganttModel.linkToWire(link),
            (sent) => this._service.create(sent, { path: "/links" }), withdraw).then((result) => {
            if (!result.ok) {
                if (result.error.kind !== "abort") {
                    withdraw();
                    this._rejectWrite("create link", result);
                }
                return;
            }
            const serverId = this._serverId(result);
            if (serverId && serverId !== link.id) {
                this._remapLinkId(link.id, serverId);
            }
        });
    }

    /**
     * Persists a link change with PUT. A refused change restores the previous
     * link, unless a later edit of the same link has replaced it meanwhile -
     * that edit is still in flight and owns the outcome.
     * @param {object} link - The changed link.
     * @param {object} previous - The link before the change.
     */
    _persistLinkUpdate(link, previous) {
        if (this._recordInSandbox("links", link.id) || !this._service) {
            return;
        }
        const restore = () => this.setState({ links: this._links.map((item) => item === link ? previous : item) });
        this._saveAction("update link", webexpress.webapp.ganttModel.linkToWire(link),
            (sent) => this._service.update(sent, { path: "/links/" + encodeURIComponent(link.id) }), restore).then((result) => {
            if (!result.ok && result.error.kind !== "abort") {
                restore();
                this._rejectWrite("update link", result);
            }
        });
    }

    /**
     * Persists a link deletion with DELETE.
     * @param {string} id - The link id.
     */
    _persistLinkDelete(id) {
        if (this._recordInSandbox("links", id) || !this._service) {
            return;
        }
        this._saveAction("delete link", { id: id },
            () => this._service.remove({ path: "/links/" + encodeURIComponent(id) }), () => this.refresh()).then((result) => {
            if (!result.ok && result.error.kind !== "abort" && !webexpress.webapp.GanttCtrl._alreadyGone(result)) {
                this._rejectWrite("delete link", result);
                this.refresh();
            }
        });
    }

    /**
     * Puts a refused write in front of the user without hiding the chart.
     *
     * Every mutation is applied before its request is out, so a refusal leaves
     * the chart showing what is not stored. The caller takes the change back;
     * this says why, because a bar or a connector that snaps back with no word
     * reads as a bug of the chart rather than as a decision of the server. The
     * inline error panel is reserved for a failed load, since it replaces the
     * whole timeline.
     * @param {string} action - The refused change, for the log and the event.
     * @param {object} result - The failed service result.
     * @param {string} [fallback] - The message when the server gave no reason.
     */
    _rejectWrite(action, result, fallback) {
        console.error(`gantt ${action} failed:`, webexpress.webapp.ServiceResult.describe(result, { action: action }));

        webexpress.webapp.ErrorChannel.present(result, {
            service: this._service.name,
            heading: this._i18n("webexpress.webapp:gantt.heading", "Plan"),
            message: this._refusalReason(result)
                || fallback
                || this._i18n("webexpress.webapp:gantt.write_rejected", "The change was not saved and has been taken back.")
        });

        this._dispatch(webexpress.webui.Event.DATA_ERROR_EVENT, { action: action, error: result.error });
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

        // the popup renders its message as html, and a reason may quote a task name the user typed
        return reason.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c]);
    }

    /**
     * Records a mutation of the open sandbox in place of persisting it. Only
     * the id is kept: the save compares the final state of each touched
     * resource with its state on entry, so a task dragged ten times costs one
     * request.
     * @param {string} kind - Either "tasks" or "links".
     * @param {string} id - The touched id.
     * @returns {boolean} True when recorded, so the caller must not send it.
     */
    _recordInSandbox(kind, id) {
        if (!this._sandbox) {
            return false;
        }
        (kind === "tasks" ? this._sandbox.touchedTasks : this._sandbox.touchedLinks).add(id);
        return true;
    }

    /**
     * Derives the requests saving the sandbox needs from the touched ids.
     * @returns {object} The { tasks, links } diffs, each { create, update, remove } id lists.
     */
    _sandboxPlan() {
        const model = webexpress.webapp.ganttModel;
        const sandbox = this._sandbox;
        const tasks = this._diffSandbox(this._tasks, sandbox.storedTasks, sandbox.touchedTasks, (t) => model.taskToWire(t));
        const links = this._diffSandbox(this._links, sandbox.storedLinks, sandbox.touchedLinks, (l) => model.linkToWire(l));

        // parents are created before and deleted after their children, which
        // holds whether or not the server cascades a deletion
        const depthNow = webexpress.webapp.GanttCtrl._depths(this._tasks);
        const depthOnEntry = webexpress.webapp.GanttCtrl._depths(sandbox.tasks);
        tasks.create.sort((a, b) => depthNow(a) - depthNow(b));
        tasks.remove.sort((a, b) => depthOnEntry(b) - depthOnEntry(a));

        return { tasks: tasks, links: links };
    }

    /**
     * Compares the touched resources with their stored state.
     * @param {Array<object>} items - The current tasks or links.
     * @param {Map<string, string>} stored - The stored wire form by id.
     * @param {Set<string>} touched - The ids the sandbox touched.
     * @param {function(object): object} toWire - The wire mapping.
     * @returns {object} The { create, update, remove } id lists.
     */
    _diffSandbox(items, stored, touched, toWire) {
        const byId = new Map(items.map((item) => [item.id, item]));
        const diff = { create: [], update: [], remove: [] };
        for (const id of touched) {
            const item = byId.get(id);
            const before = stored.get(id);
            if (item && before === undefined) {
                diff.create.push(id);
            } else if (!item && before !== undefined) {
                diff.remove.push(id);
            } else if (item && JSON.stringify(toWire(item)) !== before) {
                diff.update.push(id);
            }
        }
        return diff;
    }

    /**
     * Builds a depth lookup over a task hierarchy.
     * @param {Array<object>} tasks - The tasks.
     * @returns {function(string): number} The nesting depth of a task id, 0 for a root.
     */
    static _depths(tasks) {
        const parents = new Map(tasks.map((t) => [t.id, t.parentId]));
        return (id) => {
            let depth = 0;
            for (let parent = parents.get(id); parent !== null && parent !== undefined && depth < parents.size; parent = parents.get(parent)) {
                depth++;
            }
            return depth;
        };
    }

    /**
     * Moves a stored step out of the pending set, so a save that is refused
     * later on and then retried does not send it again.
     * @param {object} step - The step { kind, op, id }.
     * @param {object} result - The successful service result.
     */
    _settleSandboxStep(step, result) {
        const model = webexpress.webapp.ganttModel;
        const sandbox = this._sandbox;
        const isTask = step.kind === "tasks";
        const stored = isTask ? sandbox.storedTasks : sandbox.storedLinks;

        sandbox.wrote = true;
        (isTask ? sandbox.touchedTasks : sandbox.touchedLinks).delete(step.id);

        if (step.op === "remove") {
            stored.delete(step.id);
            return;
        }

        let id = step.id;
        const serverId = step.op === "create" ? this._serverId(result) : null;
        if (serverId && serverId !== id) {
            // children and links still waiting to be sent must refer to the canonical id
            if (isTask) {
                this._remapTaskId(id, serverId);
            } else {
                this._remapLinkId(id, serverId);
            }
            id = serverId;
        }
        const item = (isTask ? this._tasks : this._links).find((x) => x.id === id);
        stored.set(id, JSON.stringify(isTask ? model.taskToWire(item) : model.linkToWire(item)));
    }

    /**
     * Closes the sandbox, restoring the entry state when it is discarded.
     * @param {boolean} saved - True when the changes were stored.
     */
    _closeSandbox(saved) {
        const sandbox = this._sandbox;
        this._sandbox = null;
        window.removeEventListener("beforeunload", this._onBeforeUnload);

        this.setState(saved
            ? { sandbox: null }
            : { sandbox: null, tasks: sandbox.tasks, links: sandbox.links, selectedTask: null, selectedLink: null });
        this._emit(webexpress.webapp.GanttCtrl.SANDBOX_LEAVE_EVENT, null, { saved: saved });

        // the entry state is behind the server once a reload was held back or a
        // save stored part of the changes before it was refused
        if (sandbox.stale || (!saved && sandbox.wrote)) {
            this.refresh();
        }
    }

    /**
     * Tells whether a refused DELETE found nothing to delete. That is the state
     * the deletion asked for: a server that cascades a container deletion over
     * its subtree and links answers the deletions of the children and links
     * that follow with 404, and reporting those as refusals would take back a
     * deletion that succeeded.
     * @param {object} result - The failed service result of a DELETE.
     * @returns {boolean} True when the resource was already gone.
     */
    static _alreadyGone(result) {
        return result.error.kind === "http" && result.error.status === 404;
    }

    /**
     * Reads the id a server assigned to a created resource.
     * @param {object} result - The successful service result.
     * @returns {string|null} The server id, or null when the server kept the client id.
     */
    _serverId(result) {
        return result.data && result.data.id !== undefined && result.data.id !== null
            ? String(result.data.id)
            : null;
    }

    /**
     * Replaces a client generated task id with the server assigned one in the
     * tasks, the hierarchy and the links.
     * @param {string} oldId - The client id.
     * @param {string} newId - The server id.
     */
    _remapTaskId(oldId, newId) {
        this.setState({
            tasks: this._tasks.map((t) => Object.assign({}, t, {
                id: t.id === oldId ? newId : t.id,
                parentId: t.parentId === oldId ? newId : t.parentId
            })),
            links: this._links.map((l) => Object.assign({}, l, {
                from: l.from === oldId ? newId : l.from,
                to: l.to === oldId ? newId : l.to
            })),
            selectedTask: this.state.selectedTask === oldId ? newId : this.state.selectedTask,
            // a task named right after its creation keeps its editor under the server id
            editing: this.state.editing && this.state.editing.taskId === oldId
                ? Object.assign({}, this.state.editing, { taskId: newId })
                : this.state.editing
        });
    }

    /**
     * Replaces a client generated link id with the server assigned one.
     * @param {string} oldId - The client id.
     * @param {string} newId - The server id.
     */
    _remapLinkId(oldId, newId) {
        this.setState({
            links: this._links.map((l) => (l.id === oldId ? Object.assign({}, l, { id: newId }) : l)),
            selectedLink: this.state.selectedLink === oldId ? newId : this.state.selectedLink
        });
    }

    // --------------------------------------------------------------- render

    /**
     * Describes the chart for a state: the toolbar, the sandbox strip while the
     * sandbox is open, and the body with the grid pane, the splitter and the
     * timeline pane. The keyed reconciler patches the host, so rows, bars and
     * the scroll position of the timeline survive every render - which is what
     * keeps a grid row alive between the two clicks of a double-click.
     * @param {object} state - The current state.
     * @returns {Array<object>} The virtual node tree of the host.
     */
    render(state) {
        const h = webexpress.webui.h;
        const view = this._geometry(state);

        return [
            this._renderToolbar(state),
            state.sandbox !== null && this._renderSandbox(state),
            h("div", { key: "body", class: "wx-gantt-body" },
                this._renderGrid(state, view),
                this._renderSplitter(),
                state.error ? this._renderError() : this._renderChart(state, view))
        ];
    }

    /**
     * Wires what lives outside the rendered tree: the keyboard of the host and
     * the observer that feeds the widths the layout decided into the state.
     * @param {object} state - The state of the first render.
     */
    onMount(state) {
        this._element.addEventListener("keydown", this._onHostKeyDown);
        if (typeof ResizeObserver !== "undefined") {
            this._resizeObserver = new ResizeObserver(() => this._measure());
            this._resizeObserver.observe(this._element);
            if (this._gridEl) {
                this._resizeObserver.observe(this._gridEl);
            }
        }
        this._syncHost(state);
        this._announceValue(state);
    }

    /**
     * Follows a render with what the DOM has to do itself: the host marker of
     * the sandbox, the scroll mirror of the grid pane and the focus of a cell
     * editor that has just opened.
     * @param {object} state - The rendered state.
     */
    onUpdate(state) {
        this._syncHost(state);
        this._syncVerticalScroll();
        this._announceValue(state);

        const edit = state.editing ? state.editing.taskId + "/" + state.editing.key : null;
        if (edit !== this._focusedEdit) {
            this._focusedEdit = edit;
            if (edit && this._editInput && this._editInput.isConnected !== false) {
                this._editInput.focus({ preventScroll: true });
            }
        }
    }

    /**
     * Announces the project as the value of the chart when a render shows another one than
     * the last announced - an edit of the user, a load or a write in code alike. The parts of
     * the state are replaced, never changed, so only a replaced part is compared by content;
     * a project written back unchanged is not announced.
     * @param {object} state - The rendered state.
     */
    _announceValue(state) {
        const last = this._announced;
        if (last && last.tasks === state.tasks && last.links === state.links && last.calendar === state.calendar) {
            return;
        }
        const key = JSON.stringify(this.value);
        this._announced = { tasks: state.tasks, links: state.links, calendar: state.calendar, key: key };
        if (last && last.key !== key) {
            this._dispatch(webexpress.webui.Event.CHANGE_VALUE_EVENT, { value: this.value });
        }
    }

    /**
     * Releases the host listener, the observer, a running gesture and the
     * unload guard of an open sandbox.
     */
    onUnmount() {
        this._element.removeEventListener("keydown", this._onHostKeyDown);
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
        }
        if (this._onDragMove) {
            document.removeEventListener("mousemove", this._onDragMove);
            document.removeEventListener("mouseup", this._onDragUp);
        }
        if (this._sandbox) {
            window.removeEventListener("beforeunload", this._onBeforeUnload);
        }
    }

    /**
     * Marks the host while the sandbox is open; the host itself is not part of
     * the rendered tree.
     * @param {object} state - The rendered state.
     */
    _syncHost(state) {
        this._element.classList.toggle("wx-gantt--sandbox", state.sandbox !== null);
    }

    /**
     * Feeds the widths the layout decided into the state: the host width
     * decides how many filler days the timeline needs, the grid pane width
     * which columns fit.
     */
    _measure() {
        const patch = {};
        const hostWidth = this._element.clientWidth || 0;
        if (hostWidth !== this.state.hostWidth) {
            patch.hostWidth = hostWidth;
        }
        // a collapsed pane measures nothing worth fitting columns to
        const fitWidth = this._gridEl && !this._gridCollapsed ? this._gridEl.clientWidth || 0 : 0;
        if (fitWidth > 0 && fitWidth !== this.state.fitWidth) {
            patch.fitWidth = fitWidth;
        }
        if (Object.keys(patch).length > 0) {
            this.setState(patch);
        }
    }

    /**
     * Computes the geometry the grid, the timeline and the gestures share. The
     * range is extended so the timeline always fills its pane, otherwise the
     * header and the row stripes would stop at the last task. The result is
     * kept until one of its inputs changes, because a gesture renders on every
     * pointer move.
     * @param {object} state - The state.
     * @returns {object} The view { rows, rowIndex, range, pxDay, width, height }.
     */
    _geometry(state) {
        const inputs = [state.tasks, state.scale, state.zoom, state.hostWidth, state.gridWidth, state.gridCollapsed];
        if (this._geometryInputs && inputs.every((value, i) => value === this._geometryInputs[i])) {
            return this._geometryView;
        }

        const ctor = webexpress.webapp.GanttCtrl;
        const model = webexpress.webapp.ganttModel;
        const tasks = state.tasks || [];
        const rows = model.flatten(tasks);
        const range = model.projectRange(tasks);
        const pxDay = model.pxPerDay(state.scale, state.zoom);

        const gridWidth = state.gridCollapsed === true ? 0 : (state.gridWidth || ctor.DEFAULT_GRID_WIDTH);
        const available = (state.hostWidth || 0) - gridWidth - ctor.SPLITTER_WIDTH;
        let totalDays = model.diffDays(range.start, range.end);
        const minDays = Math.ceil(Math.max(0, available) / pxDay);
        if (minDays > totalDays) {
            range.end = model.addDays(range.start, minDays);
            totalDays = minDays;
        }

        const rowIndex = Object.create(null);
        for (let i = 0; i < rows.length; i++) {
            rowIndex[rows[i].task.id] = i;
        }

        this._geometryInputs = inputs;
        this._geometryView = {
            rows: rows,
            rowIndex: rowIndex,
            range: range,
            pxDay: pxDay,
            width: totalDays * pxDay,
            height: Math.max(1, rows.length) * ctor.ROW_HEIGHT
        };
        return this._geometryView;
    }

    /**
     * Gets the geometry of the current state, which the gestures and the
     * double-click measure against.
     * @returns {object} The view.
     */
    get _view() {
        return this._geometry(this.state);
    }

    /**
     * Describes the toolbar with the add action, the sandbox entry, the editor
     * of a selected dependency, the grid toggle, the scale switch, the zoom
     * controls and the today shortcut.
     * @param {object} state - The current state.
     * @returns {object} The toolbar virtual node.
     */
    _renderToolbar(state) {
        const h = webexpress.webui.h;
        const readonly = this._readonlyOf(state);
        const link = (state.links || []).find((l) => l.id === state.selectedLink) || null;
        const sandboxLabel = this._i18n("webexpress.webapp:gantt.sandbox", "Sandbox");
        const linkLabel = this._i18n("webexpress.webapp:gantt.link_type", "Dependency");

        return h("div", { key: "toolbar", class: "wx-gantt-toolbar" },
            !readonly && h("button", {
                key: "add",
                type: "button",
                class: "wx-gantt-btn wx-gantt-btn--primary wx-gantt-add",
                on: { click: this._onAdd }
            }, this._icon("wx-icon-light wx-icon-light-plus"), " " + this._i18n("webexpress.webapp:gantt.new_task", "New task")),
            // the icon replaces the text, so the name moves to the accessible label
            !readonly && this._sandboxOffered && state.sandbox === null && h("button", {
                key: "sandbox",
                type: "button",
                class: "wx-gantt-btn wx-gantt-sandbox-enter",
                "aria-label": sandboxLabel,
                title: sandboxLabel + " - " + this._i18n("webexpress.webapp:gantt.sandbox.hint", "Try out changes without saving them"),
                on: { click: () => this.enterSandbox() }
            }, this._icon("wx-icon-light wx-icon-light-flask")),
            link && h("label", { key: "link", class: "wx-gantt-link-editor" },
                linkLabel + " ",
                h("select", {
                    class: "wx-gantt-btn wx-gantt-link-type",
                    disabled: readonly,
                    "aria-label": linkLabel,
                    value: link.type,
                    ref: (el) => { this._linkType = el; },
                    on: { change: () => this.updateLink(link.id, { type: this._linkType.value }) }
                }, webexpress.webapp.ganttModel.LINK_TYPES.map((type) =>
                    h("option", { key: type, value: type }, this._i18n("webexpress.webapp:gantt.link." + type, type))))),
            link && !readonly && h("button", {
                key: "link-delete",
                type: "button",
                class: "wx-gantt-btn wx-gantt-link-delete",
                on: { click: () => this.removeLink(link.id) }
            }, this._i18n("webexpress.webapp:gantt.delete_link", "Delete dependency")),
            h("span", { key: "spacer", class: "wx-gantt-toolbar-spacer" }),
            h("button", {
                key: "grid",
                type: "button",
                class: ["wx-gantt-btn wx-gantt-grid-toggle", state.gridCollapsed === true && "is-active"],
                title: this._i18n("webexpress.webapp:gantt.toggle_grid", "Show or hide the task list"),
                on: { click: () => this.toggleGrid() }
            }, this._icon("wx-icon-light wx-icon-light-columns")),
            this._allowedScales.length > 1 && h("div", { key: "scales", class: "wx-gantt-scales" },
                this._allowedScales.map((scale) => h("button", {
                    key: scale,
                    type: "button",
                    class: ["wx-gantt-btn wx-gantt-scale-btn", scale === state.scale && "is-active"],
                    dataset: { scale: scale },
                    on: { click: () => this.setScale(scale) }
                }, this._i18n("webexpress.webapp:gantt.scale." + scale, scale)))),
            h("div", { key: "zoom", class: "wx-gantt-zoom" },
                h("button", {
                    type: "button",
                    class: "wx-gantt-btn wx-gantt-zoom-out",
                    title: this._i18n("webexpress.webapp:gantt.zoom_out", "Zoom out"),
                    on: { click: () => this.zoomOut() }
                }, "−"),
                h("button", {
                    type: "button",
                    class: "wx-gantt-btn wx-gantt-zoom-in",
                    title: this._i18n("webexpress.webapp:gantt.zoom_in", "Zoom in"),
                    on: { click: () => this.zoomIn() }
                }, "+"),
                h("button", {
                    type: "button",
                    class: "wx-gantt-btn wx-gantt-today-btn",
                    on: { click: () => this.scrollToToday() }
                }, this._i18n("webexpress.webapp:gantt.today", "Today"))));
    }

    /**
     * Describes the strip shown while the sandbox is open. It keeps the user
     * aware that nothing is stored yet, and it is where ending the sandbox asks
     * whether to save or discard the changes - inline rather than in a modal,
     * so the plan stays visible while the user decides.
     * @param {object} state - The current state.
     * @returns {object} The sandbox strip virtual node.
     */
    _renderSandbox(state) {
        const h = webexpress.webui.h;
        const phase = state.sandbox;
        let text = this._i18n("webexpress.webapp:gantt.sandbox.active", "Sandbox – changes are only saved when you end it.");
        if (phase === "saving") {
            text = this._i18n("webexpress.webapp:gantt.sandbox.saving", "Saving changes …");
        } else if (phase === "deciding") {
            text = this._i18n("webexpress.webapp:gantt.sandbox.decide", "End sandbox – what should happen to the changes?");
        }

        return h("div", { key: "sandbox", class: "wx-gantt-sandbox", role: "status" },
            h("span", { key: "text", class: "wx-gantt-sandbox-text" }, text),
            phase !== "saving" && h("span", { key: "count", class: "wx-gantt-sandbox-count" },
                this._i18n("webexpress.webapp:gantt.sandbox.changes", "Changes") + ": " + this.sandboxChangeCount()),
            phase === "deciding" && [
                this._sandboxButton("save", this._i18n("webexpress.webapp:gantt.sandbox.save", "Save all changes"), () => this.saveSandbox(), true),
                this._sandboxButton("discard", this._i18n("webexpress.webapp:gantt.sandbox.discard", "Discard changes"), () => this.discardSandbox()),
                this._sandboxButton("continue", this._i18n("webexpress.webapp:gantt.sandbox.continue", "Keep editing"), () => this.continueSandbox())
            ],
            phase === "active" && this._sandboxButton("end", this._i18n("webexpress.webapp:gantt.sandbox.end", "End sandbox"), () => this.endSandbox()));
    }

    /**
     * Describes one of the sandbox actions.
     * @param {string} name - The action name, completing the css class.
     * @param {string} label - The button text.
     * @param {function(): void} onClick - The action.
     * @param {boolean} [primary=false] - True for the emphasised action.
     * @returns {object} The button virtual node.
     */
    _sandboxButton(name, label, onClick, primary = false) {
        return webexpress.webui.h("button", {
            key: name,
            type: "button",
            class: ["wx-gantt-btn wx-gantt-sandbox-" + name, primary && "wx-gantt-btn--primary"],
            on: { click: onClick }
        }, label);
    }

    /**
     * Describes the grid columns once, shared by the header, the cells and the
     * inline editors.
     * @returns {Array<object>} The column descriptors { key, label, cls, edit }.
     */
    _columns() {
        const all = [
            { key: "label", label: this._i18n("webexpress.webapp:gantt.col.name", "Task"), cls: "name", edit: "text" },
            { key: "start", label: this._i18n("webexpress.webapp:gantt.col.start", "Start"), cls: "date", edit: "date" },
            { key: "end", label: this._i18n("webexpress.webapp:gantt.col.end", "End"), cls: "date", edit: "date" },
            { key: "duration", label: this._i18n("webexpress.webapp:gantt.col.duration", "Duration"), cls: "num", edit: "number" },
            { key: "progress", label: this._i18n("webexpress.webapp:gantt.col.progress", "Progress"), cls: "num", edit: "number" },
            { key: "resources", label: this._i18n("webexpress.webapp:gantt.col.resources", "Resources"), cls: "res", edit: "text" }
        ];

        return all.filter((column) => this._visibleColumns.includes(column.key));
    }

    /**
     * Describes the left grid pane with the column header and one row per
     * visible task. The pane hides the columns its width cannot hold.
     * @param {object} state - The current state.
     * @param {object} view - The computed view geometry.
     * @returns {object} The grid pane virtual node.
     */
    _renderGrid(state, view) {
        const h = webexpress.webui.h;
        const ctor = webexpress.webapp.GanttCtrl;
        const collapsed = state.gridCollapsed === true;
        const columns = this._columns();
        const hidden = collapsed ? [] : this._hiddenColumns(state.fitWidth || state.gridWidth || ctor.DEFAULT_GRID_WIDTH);

        return h("div", {
            key: "grid",
            class: ["wx-gantt-grid", collapsed && "wx-gantt-grid--collapsed"].concat(hidden.map((key) => "wx-gantt-grid--hide-" + key)),
            style: state.gridWidth ? { flexBasis: state.gridWidth + "px", maxWidth: "none" } : {},
            ref: (el) => { this._gridEl = el; }
        },
            h("div", { key: "head", class: "wx-gantt-grid-head", style: { height: ctor.HEAD_HEIGHT + "px" } },
                columns.map((column) => h("div", {
                    key: column.key,
                    class: "wx-gantt-grid-cell wx-gantt-grid-cell--" + column.cls + " wx-gantt-grid-cell--key-" + column.key
                }, column.label))),
            h("div", {
                key: "rows",
                class: "wx-gantt-grid-rows",
                ref: (el) => { this._gridRows = el; },
                on: { wheel: this._onGridWheel }
            },
                view.rows.length === 0 && h("div", { key: "empty", class: "wx-gantt-empty" }, this._i18n("webexpress.webapp:gantt.empty", "No tasks yet.")),
                view.rows.map((row) => this._renderGridRow(state, row, columns))));
    }

    /**
     * Picks the grid columns that no longer fit the pane width, right to left,
     * so shrinking the pane trades detail columns for the name column instead
     * of crushing every cell. The cumulative claim keeps the hiding order
     * stable, and the name column never hides.
     * @param {number} width - The grid pane width in pixels.
     * @returns {Array<string>} The keys of the hidden columns.
     */
    _hiddenColumns(width) {
        const minWidths = webexpress.webapp.GanttCtrl.COLUMN_MIN_WIDTHS;
        const hidden = [];
        let claimed = minWidths.label;

        for (const key of this._visibleColumns) {
            if (key === "label") {
                continue;
            }
            claimed += minWidths[key] || 0;
            if (claimed > width) {
                hidden.push(key);
            }
        }
        return hidden;
    }

    /**
     * Describes the draggable splitter between the grid pane and the timeline
     * pane. Dragging it resizes the grid, a double-click collapses it.
     * @returns {object} The splitter virtual node.
     */
    _renderSplitter() {
        return webexpress.webui.h("div", {
            key: "splitter",
            class: "wx-gantt-splitter",
            on: { mousedown: this._onSplitterDown, dblclick: this._onSplitterDblClick }
        });
    }

    /**
     * Starts the splitter gesture that resizes the grid pane.
     * @param {MouseEvent} e - The mousedown event.
     */
    _beginSplitDrag(e) {
        if (e.button !== undefined && e.button !== 0) {
            return;
        }

        // grabbing the splitter of a collapsed grid simply brings it back
        if (this._gridCollapsed) {
            this.toggleGrid();
            return;
        }
        if (typeof e.preventDefault === "function") {
            e.preventDefault();
        }

        const ctor = webexpress.webapp.GanttCtrl;

        this._drag = {
            type: "split",
            startX: e.clientX || 0,
            width: this.state.gridWidth || (this._gridEl && this._gridEl.offsetWidth) || ctor.DEFAULT_GRID_WIDTH
        };

        this._element.classList.add("wx-gantt--dragging");
        this._attachDragListeners();
    }

    /**
     * Applies a grid pane width, clamped so both panes stay usable.
     * @param {number} width - The requested width in pixels.
     */
    _applySplit(width) {
        const ctor = webexpress.webapp.GanttCtrl;
        const hostWidth = this._element.clientWidth || this.state.hostWidth || 0;
        const max = hostWidth > 0 ? Math.max(ctor.MIN_GRID_WIDTH, hostWidth - 220) : Number.MAX_SAFE_INTEGER;
        const clamped = Math.min(max, Math.max(ctor.MIN_GRID_WIDTH, width));

        // the pane takes the width at once, so the column fit follows a running
        // drag without waiting for the observer to measure it
        this.setState({ gridWidth: clamped, fitWidth: clamped });
    }

    /**
     * Describes one grid row: the cells and the delete action.
     * @param {object} state - The current state.
     * @param {object} row - The flattened row { task, depth, hasChildren }.
     * @param {Array<object>} columns - The visible column descriptors.
     * @returns {object} The row virtual node.
     */
    _renderGridRow(state, row, columns) {
        const h = webexpress.webui.h;
        const ctor = webexpress.webapp.GanttCtrl;
        const id = row.task.id;
        const readonly = this._readonlyOf(state);

        return h("div", {
            key: id,
            class: ["wx-gantt-grid-row", id === state.selectedTask && "is-selected", row.hasChildren && "is-summary"],
            dataset: { taskId: id },
            style: { height: ctor.ROW_HEIGHT + "px" },
            on: { click: this._handler("select", id, () => () => this.select(id)) }
        },
            columns.map((column) => this._renderGridCell(state, row, column, readonly)),
            !readonly && h("button", {
                key: "delete",
                type: "button",
                class: "wx-gantt-row-delete",
                title: this._i18n("webexpress.webapp:gantt.delete_task", "Delete task"),
                on: {
                    click: this._handler("delete", id, () => (e) => {
                        if (typeof e.stopPropagation === "function") {
                            e.stopPropagation();
                        }
                        this.removeTask(id);
                    })
                }
            }, this._icon("wx-icon-light wx-icon-light-trash")));
    }

    /**
     * Describes one grid cell, or its inline editor while the cell is edited.
     * The name cell carries the indentation, the collapse caret and the icon.
     * @param {object} state - The current state.
     * @param {object} row - The flattened row { task, depth, hasChildren }.
     * @param {object} column - The column descriptor.
     * @param {boolean} readonly - True when the plan cannot be edited.
     * @returns {object} The cell virtual node.
     */
    _renderGridCell(state, row, column, readonly) {
        const h = webexpress.webui.h;
        const task = row.task;
        const id = task.id;
        // containers derive everything but their name from the subtree
        const editable = !readonly && (column.key === "label" || !row.hasChildren);
        const editing = editable && state.editing && state.editing.taskId === id && state.editing.key === column.key
            ? state.editing
            : null;
        const props = {
            key: column.key,
            class: ["wx-gantt-grid-cell wx-gantt-grid-cell--" + column.cls + " wx-gantt-grid-cell--key-" + column.key, editable && "is-editable"],
            style: column.key === "label" ? { paddingLeft: (8 + row.depth * 16) + "px" } : {},
            on: editable ? { dblclick: this._handler("edit-" + column.key, id, () => () => this._beginCellEdit(id, column.key)) } : {}
        };

        if (editing) {
            return h("div", props, h("input", {
                key: "editor",
                class: "wx-gantt-cell-input",
                type: column.edit === "date" ? "date" : (column.edit === "number" ? "number" : "text"),
                value: editing.draft,
                ref: (el) => { this._editInput = el; },
                on: { input: this._onEditInput, keydown: this._onEditKeyDown, blur: this._onEditBlur }
            }));
        }
        if (column.key !== "label") {
            return h("div", props, this._cellText(task, column.key));
        }

        return h("div", props,
            row.hasChildren && h("button", {
                key: "caret",
                type: "button",
                class: "wx-gantt-caret",
                "aria-expanded": task.collapsed ? "false" : "true",
                "aria-label": this._i18n("webexpress.webui:list.tree.toggle", "Expand or collapse"),
                on: {
                    click: this._handler("collapse", id, () => (e) => {
                        if (typeof e.stopPropagation === "function") {
                            e.stopPropagation();
                        }
                        this.toggleCollapse(id);
                    })
                }
            }, this._icon("angle-down", null, { style: { transform: task.collapsed ? "rotate(-90deg)" : "none" } })),
            this._icon(task.icon, "wx-gantt-grid-icon", { key: "icon" }),
            h("span", { key: "label", class: "wx-gantt-grid-label" }, task.label));
    }

    /**
     * Formats a grid cell value for display.
     * @param {object} task - The task.
     * @param {string} key - The column key.
     * @returns {string} The display text.
     */
    _cellText(task, key) {
        switch (key) {
            case "start":
                return this._formatDate(task.start);
            case "end":
                return this._formatDate(task.end);
            case "duration":
                return task.duration + " " + this._i18n("webexpress.webapp:gantt.days_short", "d");
            case "progress":
                return task.progress + " %";
            case "resources":
                return task.resources.join(", ");
            default:
                return task[key] != null ? String(task[key]) : "";
        }
    }

    /**
     * Opens the inline editor of a grid cell. The edit is state, so the editor
     * survives the renders that happen meanwhile - a server id arriving for a
     * task just created moves it to the renamed row instead of losing it.
     * @param {string} taskId - The task id.
     * @param {string} key - The column key.
     * @returns {void}
     */
    _beginCellEdit(taskId, key) {
        const task = this._tasks.find((t) => t.id === taskId);
        if (this._readonly || !task || !this._visibleColumns.includes(key)) {
            return;
        }
        this.setState({ editing: { taskId: taskId, key: key, draft: this._editValue(task, key) } });
    }

    /**
     * Gets the value a cell editor starts with.
     * @param {object} task - The task.
     * @param {string} key - The column key.
     * @returns {string} The editor value.
     */
    _editValue(task, key) {
        switch (key) {
            case "start": return task.start || "";
            case "end": return task.end || "";
            case "duration": return String(task.duration);
            case "progress": return String(task.progress);
            case "resources": return task.resources.join(", ");
            default: return task.label;
        }
    }

    /**
     * Ends the cell edit and applies the edited value. A value the column
     * cannot take, such as an end before the start, ends the edit unchanged.
     * @returns {void}
     */
    _commitEdit() {
        const editing = this.state.editing;
        if (!editing) {
            return;
        }
        const task = this._tasks.find((t) => t.id === editing.taskId);
        const patch = task ? this._editPatch(task, editing.key, editing.draft) : null;

        this.setState({ editing: null });
        if (patch) {
            this.updateTask(task.id, patch);
        }
    }

    /**
     * Turns an edited cell value into a task patch.
     * @param {object} task - The task behind the row.
     * @param {string} key - The column key.
     * @param {string} value - The edited value.
     * @returns {object|null} The patch, or null when the value is not acceptable.
     */
    _editPatch(task, key, value) {
        const model = webexpress.webapp.ganttModel;

        switch (key) {
            case "label":
                return { label: value };
            case "start":
                return model.parseDate(value) ? { start: value } : null;
            case "end": {
                const end = model.parseDate(value);
                const start = model.parseDate(task.start);
                return end && start && end > start ? { end: value } : null;
            }
            case "duration": {
                const duration = Math.round(Number(value));
                return Number.isFinite(duration) && value !== "" && duration >= 0 ? { duration: duration } : null;
            }
            case "progress": {
                const progress = Math.round(Number(value));
                return !isNaN(progress) ? { progress: progress } : null;
            }
            case "resources":
                return { resources: value };
            default:
                return null;
        }
    }

    /**
     * Describes the scrollable timeline pane: the two tier scale header and
     * the drawing surface.
     * @param {object} state - The current state.
     * @param {object} view - The computed view geometry.
     * @returns {object} The timeline pane virtual node.
     */
    _renderChart(state, view) {
        const h = webexpress.webui.h;

        return h("div", {
            key: "chart",
            class: "wx-gantt-chart",
            // the timeline scrolls sideways; it has to take the focus for the keyboard to scroll it
            tabindex: "0",
            ref: (el) => { this._chartScroll = el; },
            on: { scroll: this._onChartScroll, wheel: this._onChartWheel }
        },
            h("div", { class: "wx-gantt-chart-inner", style: { width: view.width + "px" } },
                this._renderScaleHead(state, view),
                this._renderCanvas(state, view)));
    }

    /**
     * Describes the two tier timeline header: coarse groups (months or years)
     * on top of the fine units (days, weeks or months).
     * @param {object} state - The current state.
     * @param {object} view - The computed view geometry.
     * @returns {object} The header virtual node.
     */
    _renderScaleHead(state, view) {
        const h = webexpress.webui.h;
        const ctor = webexpress.webapp.GanttCtrl;
        const header = webexpress.webapp.ganttModel.buildScale(state.scale, view.range.start, view.range.end, state.calendar);

        const unitLabel = (unit) => {
            if (state.scale === "week") {
                return this._i18n("webexpress.webapp:gantt.week_short", "W") + unit.label;
            }
            return state.scale === "month" ? this._formatMonthShort(unit.start) : unit.label;
        };

        return h("div", { class: "wx-gantt-chart-head", style: { height: ctor.HEAD_HEIGHT + "px" } },
            h("div", { class: "wx-gantt-scale-groups" }, header.groups.map((group) => h("div", {
                class: "wx-gantt-scale-cell",
                style: { width: (group.days * view.pxDay) + "px" }
            }, state.scale === "month" ? String(group.start.getUTCFullYear()) : this._formatMonth(group.start)))),
            h("div", { class: "wx-gantt-scale-units" }, header.units.map((unit) => h("div", {
                class: ["wx-gantt-scale-cell", unit.nonWorking && "is-weekend", unit.holiday && "is-holiday"],
                style: { width: (unit.days * view.pxDay) + "px" }
            }, unitLabel(unit)))));
    }

    /**
     * Describes the drawing surface below the header: row stripes, weekend
     * columns, the today marker, the dependency layer and the bar layer. A
     * double-click on a free spot creates a task at that day and row.
     * @param {object} state - The current state.
     * @param {object} view - The computed view geometry.
     * @returns {object} The canvas virtual node.
     */
    _renderCanvas(state, view) {
        const h = webexpress.webui.h;
        const ctor = webexpress.webapp.GanttCtrl;
        const model = webexpress.webapp.ganttModel;

        // weekend shading only reads well when a day has visible width
        const weekends = state.scale !== "day" ? [] : model.buildScale("day", view.range.start, view.range.end, state.calendar).units
            .filter((unit) => unit.nonWorking)
            .map((unit) => {
                const left = model.dateToOffset(unit.start, view.range.start, view.pxDay);
                return h("div", {
                    key: "weekend-" + left,
                    class: ["wx-gantt-weekend", unit.holiday && "wx-gantt-holiday"],
                    style: { left: left + "px", width: view.pxDay + "px" }
                });
            });

        const todayOffset = model.dateToOffset(model.parseDate(new Date()), view.range.start, view.pxDay);

        return h("div", {
            class: "wx-gantt-canvas",
            style: { height: view.height + "px", width: view.width + "px" },
            ref: (el) => { this._canvas = el; },
            on: { dblclick: this._onCanvasDblClickHandler, click: this._onCanvasClick, mousedown: this._onCanvasMouseDown }
        },
            // row stripes give the bars their lanes and carry the selection tint
            view.rows.map((row, i) => h("div", {
                key: "stripe-" + row.task.id,
                class: ["wx-gantt-row-stripe", row.task.id === state.selectedTask && "is-selected"],
                dataset: { taskId: row.task.id },
                style: { top: (i * ctor.ROW_HEIGHT) + "px", height: ctor.ROW_HEIGHT + "px" }
            })),
            weekends,
            todayOffset >= 0 && todayOffset <= view.width && h("div", { key: "today", class: "wx-gantt-today", style: { left: todayOffset + "px" } }),
            this._renderLinks(state, view),
            h("div", { key: "bars", class: "wx-gantt-bars" }, view.rows.map((row, i) => this._renderBar(state, view, row, i))));
    }

    /**
     * Describes the SVG dependency layer with one orthogonal connector per
     * link, and the connector a link gesture is drawing. Each connector
     * carries an invisible wide twin that makes the thin line clickable for
     * selection and double-click deletion. A previewed bar moves the ends of
     * its connectors with it, because the anchors come from the bar geometry
     * the render draws.
     * @param {object} state - The current state.
     * @param {object} view - The computed view geometry.
     * @returns {object} The SVG layer virtual node.
     */
    _renderLinks(state, view) {
        const h = webexpress.webui.h;
        const markerId = this._markerId;
        const connectors = [];

        for (const link of state.links || []) {
            const fromIdx = view.rowIndex[link.from];
            const toIdx = view.rowIndex[link.to];
            if (fromIdx === undefined || toIdx === undefined
                || !view.rows[fromIdx].task.start || !view.rows[toIdx].task.start) {
                // an endpoint inside a collapsed container has no visible row
                continue;
            }

            const fromSide = link.type === "SS" || link.type === "SF" ? "start" : "end";
            const toSide = link.type === "FF" || link.type === "SF" ? "end" : "start";
            const from = this._barAnchor(state, view, fromIdx, fromSide);
            const to = this._barAnchor(state, view, toIdx, toSide);
            const d = this._linkPath(from, fromSide, to, toSide);
            const title = view.rows[fromIdx].task.label + " → " + view.rows[toIdx].task.label
                + ": " + this._i18n("webexpress.webapp:gantt.link." + link.type, link.type);

            connectors.push(
                h("path", {
                    key: "link-" + link.id,
                    class: ["wx-gantt-link", link.id === state.selectedLink && "is-selected"],
                    d: d,
                    "marker-end": "url(#" + markerId + ")"
                }),
                h("path", {
                    key: "hit-" + link.id,
                    class: "wx-gantt-link-hit",
                    d: d,
                    tabindex: "0",
                    role: "button",
                    "aria-label": title,
                    on: this._linkHandlers(link.id)
                }, h("title", null, title)));
        }

        const draft = state.linkDraft;

        return h("svg", { key: "links", class: "wx-gantt-links", width: String(view.width), height: String(view.height) },
            h("defs", { key: "defs" },
                h("marker", { id: markerId, viewBox: "0 0 10 10", refX: "9", refY: "5", markerWidth: "6", markerHeight: "6", orient: "auto" },
                    h("path", { d: "M 0 0 L 10 5 L 0 10 z" }))),
            connectors,
            draft && h("path", { key: "draft", class: "wx-gantt-link wx-gantt-link--temp", d: this._draftPath(draft, view) }));
    }

    /**
     * Returns the listeners of a connector: it selects on click and on the
     * keyboard, deletes on double-click and keeps its mousedown from panning.
     * @param {string} linkId - The link id.
     * @returns {object} The listener map.
     */
    _linkHandlers(linkId) {
        return this._handler("link", linkId, () => ({
            mousedown: (e) => e.stopPropagation(),
            keydown: (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    this.select(null, linkId);
                }
            },
            click: () => this.select(null, linkId),
            dblclick: () => this.removeLink(linkId)
        }));
    }

    /**
     * Routes the connector of a running link gesture: to the boundary of the
     * bar it would connect to, or straight to the pointer.
     * @param {object} draft - The gesture state { from, fromSide, pointer, target }.
     * @param {object} view - The computed view geometry.
     * @returns {string} The SVG path data.
     */
    _draftPath(draft, view) {
        const anchor = draft.target ? this._anchorFor(draft.target.taskId, draft.target.side, view) : null;
        return anchor
            ? this._linkPath(draft.from, draft.fromSide, anchor, draft.target.side)
            : "M " + draft.from.x + " " + draft.from.y + " L " + draft.pointer.x + " " + draft.pointer.y;
    }

    /**
     * Computes the geometry a bar spans by its dates.
     * @param {object} task - The task.
     * @param {object} view - The computed view geometry.
     * @returns {object} The geometry { left, width } in pixels.
     */
    _dateGeometry(task, view) {
        const model = webexpress.webapp.ganttModel;
        const start = model.parseDate(task.start);

        return {
            left: model.dateToOffset(start, view.range.start, view.pxDay),
            width: model.diffDays(start, model.parseDate(task.end)) * view.pxDay
        };
    }

    /**
     * Computes the geometry a bar is drawn with: the preview of a running
     * gesture, or the span of its dates.
     * @param {object} state - The current state.
     * @param {object} task - The task.
     * @param {object} view - The computed view geometry.
     * @returns {object} The geometry { left, width } in pixels.
     */
    _barGeometry(state, task, view) {
        const preview = state.preview;
        return preview && preview.taskId === task.id
            ? { left: preview.left, width: preview.width }
            : this._dateGeometry(task, view);
    }

    /**
     * Computes the connector anchor point of a drawn bar side.
     * @param {object} state - The current state.
     * @param {object} view - The computed view geometry.
     * @param {number} rowIndex - The visible row index.
     * @param {string} side - The side: "start" or "end".
     * @returns {object} The point { x, y }.
     */
    _barAnchor(state, view, rowIndex, side) {
        const geometry = this._barGeometry(state, view.rows[rowIndex].task, view);
        return this._anchorAt(geometry.left, geometry.width, rowIndex, side);
    }

    /**
     * Computes the connector anchor point of a task bar side from its dates.
     * @param {object} task - The task.
     * @param {number} rowIndex - The visible row index.
     * @param {string} side - The side: "start" or "end".
     * @param {object} view - The computed view geometry.
     * @returns {object} The point { x, y }.
     */
    _anchor(task, rowIndex, side, view) {
        const geometry = this._dateGeometry(task, view);
        return this._anchorAt(geometry.left, geometry.width, rowIndex, side);
    }

    /**
     * Computes a connector anchor point from an explicit bar geometry, the
     * shared primitive of the rendered anchors and the gestures.
     * @param {number} left - The bar's left offset in pixels.
     * @param {number} width - The bar's width in pixels.
     * @param {number} rowIndex - The visible row index.
     * @param {string} side - The side: "start" or "end".
     * @returns {object} The point { x, y }.
     */
    _anchorAt(left, width, rowIndex, side) {
        const ctor = webexpress.webapp.GanttCtrl;

        return {
            x: side === "start" ? left : left + Math.max(width, 1),
            y: rowIndex * ctor.ROW_HEIGHT + ctor.ROW_HEIGHT / 2
        };
    }

    /**
     * Computes the anchor point of a visible task by id, or null when the task
     * has no visible row or no dates.
     * @param {string} taskId - The task id.
     * @param {string} side - The side: "start" or "end".
     * @param {object} view - The computed view geometry.
     * @returns {object|null} The point { x, y }, or null.
     */
    _anchorFor(taskId, side, view) {
        const rowIndex = view.rowIndex[taskId];
        const task = rowIndex !== undefined ? view.rows[rowIndex].task : null;

        return task && task.start ? this._anchor(task, rowIndex, side, view) : null;
    }

    /**
     * Routes an orthogonal connector between two anchor points. The connector
     * leaves and approaches horizontally through short stubs; when the direct
     * elbow would run backwards through a bar, it detours through the gap
     * between the rows.
     * @param {object} from - The source point { x, y }.
     * @param {string} fromSide - The source side: "start" or "end".
     * @param {object} to - The target point { x, y }.
     * @param {string} toSide - The target side: "start" or "end".
     * @returns {string} The SVG path data.
     */
    _linkPath(from, fromSide, to, toSide) {
        const ctor = webexpress.webapp.GanttCtrl;
        const stub = 12;
        const dirOut = fromSide === "end" ? 1 : -1;
        const dirIn = toSide === "start" ? -1 : 1;
        const a = from.x + stub * dirOut;
        const b = to.x + stub * dirIn;

        if (dirOut === dirIn) {
            const outer = dirOut === 1 ? Math.max(a, b) : Math.min(a, b);
            return "M " + from.x + " " + from.y
                + " L " + outer + " " + from.y
                + " L " + outer + " " + to.y
                + " L " + to.x + " " + to.y;
        }

        if ((dirOut === 1 && b >= a) || (dirOut === -1 && b <= a)) {
            return "M " + from.x + " " + from.y
                + " L " + a + " " + from.y
                + " L " + a + " " + to.y
                + " L " + to.x + " " + to.y;
        }

        const mid = from.y + (to.y >= from.y ? 1 : -1) * (ctor.ROW_HEIGHT / 2);
        return "M " + from.x + " " + from.y
            + " L " + a + " " + from.y
            + " L " + a + " " + mid
            + " L " + b + " " + mid
            + " L " + b + " " + to.y
            + " L " + to.x + " " + to.y;
    }

    /**
     * Describes the bar (or milestone diamond, or container bracket) of one
     * row, including the drag surfaces: resize handles, the progress handle
     * and the link ports. A running gesture draws the bar where it previews
     * it, and a link gesture marks the bar it would connect to.
     * @param {object} state - The current state.
     * @param {object} view - The computed view geometry.
     * @param {object} row - The flattened row { task, depth, hasChildren }.
     * @param {number} rowIndex - The visible row index.
     * @returns {object|null} The bar virtual node, or null without dates.
     */
    _renderBar(state, view, row, rowIndex) {
        const h = webexpress.webui.h;
        const ctor = webexpress.webapp.GanttCtrl;
        const task = row.task;
        const id = task.id;
        if (!webexpress.webapp.ganttModel.parseDate(task.start)) {
            return null;
        }

        const readonly = this._readonlyOf(state);
        const geometry = this._barGeometry(state, task, view);
        const top = rowIndex * ctor.ROW_HEIGHT;
        const isSummary = row.hasChildren;
        const selected = id === state.selectedTask;
        const target = state.linkDraft && state.linkDraft.target && state.linkDraft.target.taskId === id
            ? state.linkDraft.target
            : null;
        const dataset = target ? { taskId: id, linkTargetSide: target.side } : { taskId: id };
        const ports = !readonly && ["start", "end"].map((side) => h("div", {
            key: "port-" + side,
            class: "wx-gantt-port wx-gantt-port--" + side,
            on: { mousedown: this._handler("port-" + side, id, () => (e) => this._beginLinkDrag(e, this._tasks.find((t) => t.id === id), side, this._view)) }
        }));

        if (task.duration === 0) {
            return h("div", {
                key: id,
                class: ["wx-gantt-milestone", selected && "is-selected", target && "is-link-target"],
                dataset: dataset,
                style: { left: geometry.left + "px", top: (top + ctor.ROW_HEIGHT / 2) + "px" },
                title: task.label + " · " + this._formatDate(task.start),
                on: { mousedown: this._handler("move", id, () => (e) => this._beginDrag(e, id, "move")) }
            }, ports);
        }

        const width = Math.max(geometry.width, 2);
        const progress = state.preview && state.preview.taskId === id && state.preview.progress !== null
            ? state.preview.progress
            : task.progress;
        // containers derive their dates from the subtree, so only leaf bars
        // are draggable and resizable
        const draggable = !isSummary && !readonly;

        return h("div", {
            key: id,
            class: ["wx-gantt-bar", isSummary && "wx-gantt-bar--summary", selected && "is-selected", target && "is-link-target"],
            dataset: dataset,
            style: {
                left: geometry.left + "px",
                // container bars render as a flat bracket above the lane
                top: (top + (isSummary ? 6 : 5)) + "px",
                width: width + "px",
                height: (isSummary ? 10 : ctor.ROW_HEIGHT - 10) + "px",
                background: task.color || ""
            },
            title: task.label
                + " · " + this._formatDate(task.start) + " – " + this._formatDate(task.end)
                + " · " + task.progress + " %"
                + (task.resources.length > 0 ? " · " + task.resources.join(", ") : ""),
            on: {
                mousedown: draggable
                    ? this._handler("move", id, () => (e) => this._beginDrag(e, id, "move"))
                    : this._handler("pick", id, () => () => this.select(id))
            }
        },
            h("div", { key: "progress", class: "wx-gantt-bar-progress", style: { width: progress + "%" } }),
            h("span", { key: "label", class: "wx-gantt-bar-label" }, this._icon(task.icon, "wx-gantt-bar-icon"), task.label),
            task.resources.length > 0 && h("span", {
                key: "resources",
                class: "wx-gantt-bar-resources",
                style: { left: (width + 8) + "px" }
            }, task.resources.join(", ")),
            draggable && ["start", "end"].map((edge) => h("div", {
                key: "handle-" + edge,
                class: "wx-gantt-handle wx-gantt-handle--" + edge,
                on: { mousedown: this._handler("resize-" + edge, id, () => (e) => this._beginDrag(e, id, "resize-" + edge)) }
            })),
            draggable && h("div", {
                key: "progress-handle",
                class: "wx-gantt-progress-handle",
                style: { left: "calc(" + progress + "% - 4px)" },
                on: { mousedown: this._handler("progress", id, () => (e) => this._beginDrag(e, id, "progress")) }
            }),
            ports);
    }

    /**
     * Resolves a link drop anywhere inside a bar, including its label and
     * progress layer. Explicit ports select their boundary; otherwise the
     * pointer's nearest half selects the start or finish boundary.
     * @param {MouseEvent} event - The current pointer event.
     * @param {string} fromId - The predecessor being connected.
     * @returns {object|null} The valid target task and boundary { task, side }.
     */
    _resolveLinkTarget(event, fromId) {
        let element = event.target;
        let side = null;
        while (element && element !== this._element) {
            if (element.classList) {
                if (element.classList.contains("wx-gantt-port--start")) { side = "start"; }
                if (element.classList.contains("wx-gantt-port--end")) { side = "end"; }
                if (element.classList.contains("wx-gantt-bar") || element.classList.contains("wx-gantt-milestone")) {
                    const task = this._tasks.find((item) => item.id === element.dataset.taskId);
                    if (!this._element.contains(element) || !task
                        || !webexpress.webapp.ganttModel.canLink(this._tasks, this._links, fromId, task.id).ok) {
                        return null;
                    }
                    const rect = element.getBoundingClientRect();
                    side = side || (event.clientX < rect.left + rect.width / 2 ? "start" : "end");
                    return { task: task, side: side };
                }
            }
            element = element.parentNode;
        }
        return null;
    }

    /**
     * Describes the inline error panel shown in place of the timeline when the
     * load failed, with a retry action when an endpoint is configured.
     * @returns {object} The error virtual node.
     */
    _renderError() {
        const h = webexpress.webui.h;

        return h("div", { key: "error", class: "wx-gantt-error" },
            h("span", null, this._i18n("webexpress.webapp:gantt.load_failed", "Failed to load the plan.")),
            this._restUri !== "" && h("button", {
                type: "button",
                class: "wx-gantt-btn",
                on: { click: () => this.refresh() }
            }, this._i18n("webexpress.webapp:gantt.retry", "Retry")));
    }

    /**
     * Describes an icon the way webexpress.webui.Icon.create builds one: an
     * image for a spec that points at one, otherwise an i element with the
     * resolved icon classes.
     * @param {string} spec - The icon specification.
     * @param {string} [extraClass] - Extra css classes.
     * @param {object} [props] - Further props, such as a key or a style.
     * @returns {object|null} The icon virtual node, or null without a spec.
     */
    _icon(spec, extraClass, props) {
        const h = webexpress.webui.h;
        const value = (spec || "").trim();
        if (!value) {
            return null;
        }
        const extra = (extraClass || "").trim();
        if (webexpress.webui.Icon._isImage(value)) {
            return h("img", Object.assign({ class: ("wx-icon-img " + extra).trim(), src: value, alt: "" }, props));
        }
        return h("i", Object.assign({ class: (webexpress.webui.IconSet.resolve(value) + " " + extra).trim() }, props));
    }

    // --------------------------------------------------------- interactions

    /**
     * Starts a bar gesture (move, resize or progress). The gesture keeps its
     * starting point here and puts what it shows - the previewed geometry -
     * into the state, so the bar and its connectors move in the same render.
     * @param {MouseEvent} e - The mousedown event.
     * @param {string} taskId - The task behind the bar.
     * @param {string} type - The gesture: move, resize-start, resize-end or progress.
     */
    _beginDrag(e, taskId, type) {
        const task = this._tasks.find((t) => t.id === taskId);
        if (!task || this._readonly || (e.button !== undefined && e.button !== 0)) {
            return;
        }
        if (typeof e.preventDefault === "function") {
            e.preventDefault();
        }
        if (typeof e.stopPropagation === "function") {
            e.stopPropagation();
        }

        this.select(task.id);

        const view = this._view;
        const geometry = this._dateGeometry(task, view);

        this._drag = {
            type: type,
            task: task,
            view: view,
            startX: e.clientX || 0,
            left: geometry.left,
            width: geometry.width,
            moved: false
        };

        this._element.classList.add("wx-gantt--dragging");
        this._attachDragListeners();
    }

    /**
     * Starts the pan gesture that scrolls the timeline by dragging its free
     * surface. Bars, handles and ports stop propagation, so panning never
     * competes with the bar gestures.
     * @param {MouseEvent} e - The mousedown event.
     */
    _beginPan(e) {
        if (e.button !== undefined && e.button !== 0) {
            return;
        }
        if (typeof e.preventDefault === "function") {
            e.preventDefault();
        }

        this._drag = {
            type: "pan",
            startX: e.clientX || 0,
            startY: e.clientY || 0,
            scrollLeft: this._chartScroll ? this._chartScroll.scrollLeft : 0,
            scrollTop: this._chartScroll ? this._chartScroll.scrollTop : 0,
            moved: false
        };

        this._element.classList.add("wx-gantt--panning");
        this._attachDragListeners();
    }

    /**
     * Starts a link gesture from a port. A connector follows the pointer until
     * it is released over another bar.
     * @param {MouseEvent} e - The mousedown event.
     * @param {object} task - The source task.
     * @param {string} side - The source side: "start" or "end".
     * @param {object} view - The computed view geometry.
     */
    _beginLinkDrag(e, task, side, view) {
        if (!task || this._readonly || (e.button !== undefined && e.button !== 0)) {
            return;
        }
        if (typeof e.preventDefault === "function") {
            e.preventDefault();
        }
        if (typeof e.stopPropagation === "function") {
            e.stopPropagation();
        }

        const rowIndex = view.rowIndex[task.id];
        const from = this._anchor(task, rowIndex === undefined ? 0 : rowIndex, side, view);

        this._drag = {
            type: "link",
            task: task,
            side: side,
            view: view,
            from: from,
            startX: e.clientX || 0,
            startY: e.clientY || 0
        };
        this.setState({ linkDraft: { from: from, fromSide: side, pointer: from, target: null } });

        this._element.classList.add("wx-gantt--linking");
        this._attachDragListeners();
    }

    /**
     * Attaches the transient document listeners that carry a running gesture.
     */
    _attachDragListeners() {
        this._onDragMove = (e) => this._handleDragMove(e);
        this._onDragUp = (e) => this._handleDragUp(e);
        document.addEventListener("mousemove", this._onDragMove);
        document.addEventListener("mouseup", this._onDragUp);
    }

    /**
     * Previews the running gesture on pointer movement.
     * @param {MouseEvent} e - The mousemove event.
     */
    _handleDragMove(e) {
        const drag = this._drag;
        if (!drag) {
            return;
        }

        const dx = (e.clientX || 0) - drag.startX;
        const dy = (e.clientY || 0) - (drag.startY || 0);
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
            drag.moved = true;
        }

        if (["move", "resize-start", "resize-end"].includes(drag.type)) {
            this.setState({ preview: Object.assign({ taskId: drag.task.id, progress: null }, this._previewGeometry(drag, dx)) });
        } else if (drag.type === "progress") {
            this.setState({ preview: { taskId: drag.task.id, left: drag.left, width: drag.width, progress: this._progressFromDx(drag, dx) } });
        } else if (drag.type === "link") {
            const target = this._resolveLinkTarget(e, drag.task.id);
            this.setState({
                linkDraft: {
                    from: drag.from,
                    fromSide: drag.side,
                    pointer: { x: drag.from.x + dx, y: drag.from.y + dy },
                    target: target ? { taskId: target.task.id, side: target.side } : null
                }
            });
        } else if (drag.type === "split") {
            this._applySplit(drag.width + dx);
        } else if (drag.type === "pan") {
            if (this._chartScroll) {
                this._chartScroll.scrollLeft = drag.scrollLeft - dx;
                this._chartScroll.scrollTop = drag.scrollTop - dy;
                this._syncVerticalScroll();
            }
        }
    }

    /**
     * Computes where a move or resize gesture draws its bar.
     * @param {object} drag - The gesture context.
     * @param {number} dx - The horizontal pointer distance.
     * @returns {object} The previewed geometry { left, width } in pixels.
     */
    _previewGeometry(drag, dx) {
        const model = webexpress.webapp.ganttModel;

        if (this._calendar) {
            // a calendar skips non-working days, so the preview snaps to the
            // dates the release will commit instead of following the pointer
            const days = Math.round(dx / drag.view.pxDay);
            const patch = drag.type === "move"
                ? model.moveTask(drag.task, days, this._calendar)
                : model.resizeTask(drag.task, drag.type === "resize-start" ? "start" : "end", days, this._calendar);
            return this._dateGeometry(patch || drag.task, drag.view);
        }

        if (drag.type === "move") {
            return { left: drag.left + dx, width: drag.width };
        }
        const width = Math.max(drag.view.pxDay, drag.type === "resize-end" ? drag.width + dx : drag.width - dx);
        return { left: drag.type === "resize-end" ? drag.left : drag.left + drag.width - width, width: width };
    }

    /**
     * Commits or discards the running gesture on release. A move or resize is
     * snapped to whole days, a link gesture connects to the target bar boundary
     * selected by its explicit port or the nearest half of the bar.
     * @param {MouseEvent} e - The mouseup event.
     */
    _handleDragUp(e) {
        const drag = this._drag;
        this._drag = null;

        document.removeEventListener("mousemove", this._onDragMove);
        document.removeEventListener("mouseup", this._onDragUp);
        this._element.classList.remove("wx-gantt--dragging");
        this._element.classList.remove("wx-gantt--linking");
        this._element.classList.remove("wx-gantt--panning");

        if (!drag) {
            return;
        }

        const model = webexpress.webapp.ganttModel;
        const dx = (e.clientX || 0) - drag.startX;

        if (drag.type === "split") {
            this._applySplit(drag.width + dx);
            return;
        }

        if (drag.type === "pan") {
            // a pan that moved must not fall through to the click handler
            this._skipNextCanvasClick = drag.moved;
            return;
        }

        if (drag.type === "link") {
            const target = this._resolveLinkTarget(e, drag.task.id);
            this.setState({ linkDraft: null });
            if (target && target.task.id !== drag.task.id) {
                this.addLink(drag.task.id, target.task.id, this._linkTypeFor(drag.side, target.side));
            }
            return;
        }

        this.setState({ preview: null });
        // a plain click only selects, which its mousedown already did
        if (!drag.moved) {
            return;
        }

        const deltaDays = Math.round(dx / drag.view.pxDay);
        let patch = null;
        if (drag.type === "move") {
            patch = model.moveTask(drag.task, deltaDays, this._calendar);
        } else if (drag.type === "resize-start") {
            // the model speaks "edge moved right", exactly the pointer distance
            patch = model.resizeTask(drag.task, "start", deltaDays, this._calendar);
        } else if (drag.type === "resize-end") {
            patch = model.resizeTask(drag.task, "end", deltaDays, this._calendar);
        } else if (drag.type === "progress") {
            const pct = this._progressFromDx(drag, dx);
            patch = pct !== drag.task.progress ? { progress: pct } : null;
        }

        if (patch) {
            this.updateTask(drag.task.id, patch);
        }
    }

    /**
     * Computes the previewed progress percentage of a progress gesture.
     * @param {object} drag - The gesture context.
     * @param {number} dx - The horizontal pointer distance.
     * @returns {number} The clamped percentage.
     */
    _progressFromDx(drag, dx) {
        const width = Math.max(1, drag.width);
        const px = (drag.task.progress / 100) * width + dx;
        return Math.min(100, Math.max(0, Math.round((px / width) * 100)));
    }

    /**
     * Maps the two port sides of a link gesture onto the dependency type: the
     * predecessor side first, so end→start is FS, start→start SS, end→end FF
     * and start→end SF.
     * @param {string} fromSide - The source port side.
     * @param {string} toSide - The target port side.
     * @returns {string} The link type.
     */
    _linkTypeFor(fromSide, toSide) {
        if (fromSide === "end") {
            return toSide === "start" ? "FS" : "FF";
        }
        return toSide === "start" ? "SS" : "SF";
    }

    /**
     * Creates a task on a double-clicked free spot: the day under the pointer
     * becomes the start, the row under the pointer determines the insertion
     * position and the parent. The new task opens for naming when the grid is
     * there to name it in.
     * @param {MouseEvent} e - The dblclick event.
     */
    _onCanvasDblClick(e) {
        if (this._readonly || !this._canvas || typeof this._canvas.getBoundingClientRect !== "function") {
            return;
        }

        // a double-click on a bar, a milestone or a connector is not a free spot
        const target = e.target;
        if (target && target !== this._canvas && typeof target.closest === "function"
            && target.closest(".wx-gantt-bar, .wx-gantt-milestone, .wx-gantt-links")) {
            return;
        }

        const ctor = webexpress.webapp.GanttCtrl;
        const model = webexpress.webapp.ganttModel;
        const view = this._view;
        const rect = this._canvas.getBoundingClientRect();
        const x = (e.clientX || 0) - rect.left;
        const y = (e.clientY || 0) - rect.top;

        const start = model.offsetToDate(x, view.range.start, view.pxDay);
        const anchorRow = view.rows[Math.floor(y / ctor.ROW_HEIGHT)] || null;

        const task = this.addTask({
            start: model.formatIso(start),
            parentId: anchorRow ? anchorRow.task.parentId : null
        }, anchorRow ? { afterId: anchorRow.task.id } : {});

        if (task && !this._gridCollapsed) {
            this._beginCellEdit(task.id, "label");
        }
    }

    /**
     * Handles the keyboard: delete removes the selection, escape clears it.
     * @param {KeyboardEvent} e - The keydown event.
     */
    _onKeyDown(e) {
        const target = e.target;
        if (target && (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable)) {
            return;
        }
        if (e.key === "Delete" || e.key === "Backspace") {
            if (this._readonly) {
                return;
            }
            e.preventDefault();
            if (this.state.selectedLink) {
                this.removeLink(this.state.selectedLink);
            } else if (this.state.selectedTask) {
                this.removeTask(this.state.selectedTask);
            }
        } else if (e.key === "Escape") {
            this.select(null, null);
        }
    }

    // -------------------------------------------------------------- helpers

    /**
     * Mirrors the timeline's vertical scroll position into the grid pane, so
     * both panes always show the same rows.
     */
    _syncVerticalScroll() {
        if (this._gridRows && this._chartScroll) {
            this._gridRows.scrollTop = this._chartScroll.scrollTop;
        }
    }

    /**
     * Dispatches a control event on the host element and calls the assignable
     * callback twin when present. Every detail says whether the sandbox is
     * open, because a listener that mirrors the stored plan has to tell a
     * change that only exists on screen from one the server received.
     * @param {string} name - The event name.
     * @param {string|null} callback - The callback property name, or null.
     * @param {object} detail - The event detail.
     */
    _emit(name, callback, detail) {
        const full = Object.assign({ sandbox: this._sandbox !== null }, detail);
        this._dispatch(name, Object.assign({ id: this._element.id }, full));
        if (callback && typeof this[callback] === "function") {
            this[callback](full);
        }
    }

    /**
     * Generates a client side id with a prefix, unique enough until the server
     * assigns the canonical one.
     * @param {string} prefix - The id prefix.
     * @returns {string} The id.
     */
    _newId(prefix) {
        return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }

    /**
     * Formats an ISO date for display in the user's locale. The UTC time zone
     * keeps the printed day identical to the modelled day.
     * @param {string|null} iso - The ISO date string.
     * @returns {string} The localised date, or an empty string.
     */
    _formatDate(iso) {
        const date = webexpress.webapp.ganttModel.parseDate(iso);
        if (!date) {
            return "";
        }
        try {
            return date.toLocaleDateString(webexpress.webui.I18N.language, { timeZone: "UTC" });
        } catch (_) {
            return iso;
        }
    }

    /**
     * Formats a month group label in the user's locale.
     * @param {Date} date - Any day of the month.
     * @returns {string} The localised month and year.
     */
    _formatMonth(date) {
        try {
            return date.toLocaleDateString(webexpress.webui.I18N.language, { month: "short", year: "numeric", timeZone: "UTC" });
        } catch (_) {
            return date.toISOString().slice(0, 7);
        }
    }

    /**
     * Formats a month unit label in the user's locale.
     * @param {Date} date - Any day of the month.
     * @returns {string} The localised short month name.
     */
    _formatMonthShort(date) {
        try {
            return date.toLocaleDateString(webexpress.webui.I18N.language, { month: "short", timeZone: "UTC" });
        } catch (_) {
            return date.toISOString().slice(5, 7);
        }
    }
};

// register the class in the framework controller
webexpress.webui.Controller.registerClass("wx-webapp-gantt", webexpress.webapp.GanttCtrl);
