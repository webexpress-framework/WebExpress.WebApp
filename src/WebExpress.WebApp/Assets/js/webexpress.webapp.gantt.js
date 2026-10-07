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

    // grid pane width chosen through the splitter, surviving re-renders
    _gridWidth = null;

    // transient interaction state, deliberately outside the store because a
    // drag preview mutates the DOM directly and only commits on release
    _drag = null;
    _linkTarget = null;
    _pendingEditTaskId = null;
    _skipNextCanvasClick = false;

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
                sandbox: null
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
        element.addEventListener("keydown", (e) => this._onKeyDown(e));

        this._markerId = this._newId("gantt-arrow");
        this.mount();
        if (typeof ResizeObserver !== "undefined") {
            this._resizeObserver = new ResizeObserver(() => {
                if (this._gridEl && !this._gridCollapsed) {
                    this._updateColumnFit(this._gridEl.clientWidth || this._gridWidth || webexpress.webapp.GanttCtrl.DEFAULT_GRID_WIDTH);
                }
            });
            this._resizeObserver.observe(element);
        }

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
    // a sandbox being saved is frozen, an edit now would race the requests built from it
    get _readonly() { return this.state.readonly === true || this.state.sandbox === "saving"; }
    get _gridCollapsed() { return this.state.gridCollapsed === true; }

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
        // rollup mutates container tasks in place, so the entry state is kept as a copy
        const entry = this.value;
        this._sandbox = {
            tasks: entry.tasks,
            links: entry.links,
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
        model.rollup(tasks, this._calendar);

        this.setState({ tasks: tasks, selectedTask: task.id, selectedLink: null });
        this._persistTaskCreate(task);
        this._emit(webexpress.webapp.GanttCtrl.TASK_CREATE_EVENT, "onTaskCreate", { task: Object.assign({}, task) });

        return task;
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

        const tasks = this._tasks.map((t) => (t.id === id ? task : t));
        model.rollup(tasks, this._calendar);

        this.setState({ tasks: tasks });
        this._persistTaskUpdate(task);
        this._emit(webexpress.webapp.GanttCtrl.TASK_UPDATE_EVENT, "onTaskUpdate", {
            task: Object.assign({}, task),
            patch: Object.assign({}, patch)
        });

        return task;
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
        const tasks = this._tasks.filter((t) => !removed.has(t.id));
        const links = this._links.filter((link) => !removed.has(link.from) && !removed.has(link.to));
        webexpress.webapp.ganttModel.rollup(tasks);

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
        this._service.create(webexpress.webapp.ganttModel.taskToWire(task), { path: "/tasks" }).then((result) => {
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
        this._service.update(webexpress.webapp.ganttModel.taskToWire(task), { path: "/tasks/" + encodeURIComponent(task.id) })
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
        this._service.remove({ path: "/tasks/" + encodeURIComponent(id) }).then((result) => {
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
        this._service.create(webexpress.webapp.ganttModel.linkToWire(link), { path: "/links" }).then((result) => {
            if (!result.ok) {
                if (result.error.kind !== "abort") {
                    this.setState({
                        links: this._links.filter((l) => l.id !== link.id),
                        selectedLink: this.state.selectedLink === link.id ? null : this.state.selectedLink
                    });
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
        this._service.update(webexpress.webapp.ganttModel.linkToWire(link), { path: "/links/" + encodeURIComponent(link.id) }).then((result) => {
            if (!result.ok && result.error.kind !== "abort") {
                this.setState({ links: this._links.map((item) => item === link ? previous : item) });
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
        this._service.remove({ path: "/links/" + encodeURIComponent(id) }).then((result) => {
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
            selectedTask: this.state.selectedTask === oldId ? newId : this.state.selectedTask
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
     * Renders the toolbar, the grid pane and the timeline pane from the
     * current state. The render is imperative and rebuilds the host; the
     * scroll position of the timeline survives the rebuild.
     * @returns {void}
     */
    render() {
        // a running gesture previews on the live DOM; rebuilding now would
        // detach the dragged bar, so the commit on release renders instead
        if (this._drag) {
            return;
        }

        const ctor = webexpress.webapp.GanttCtrl;
        const model = webexpress.webapp.ganttModel;
        const state = this.state;
        const previous = this._renderedState;
        this._renderedState = state;
        if (previous && (previous.selectedTask !== state.selectedTask || previous.selectedLink !== state.selectedLink)
            && Object.keys(state).every((key) => ["selectedTask", "selectedLink"].includes(key) || state[key] === previous[key])) {
            this._renderSelection();
            return;
        }

        const scrollLeft = this._chartScroll ? this._chartScroll.scrollLeft : 0;
        const scrollTop = this._chartScroll ? this._chartScroll.scrollTop : 0;

        const rows = model.flatten(this._tasks);
        const range = model.projectRange(this._tasks);
        const pxDay = model.pxPerDay(state.scale, state.zoom);

        // the range is extended so the timeline always fills the pane,
        // otherwise the header and the row stripes would stop at the last task
        const hostWidth = this._element.clientWidth || 0;
        const gridWidth = this._gridCollapsed ? 0 : (this._gridWidth || ctor.DEFAULT_GRID_WIDTH);
        const available = hostWidth - gridWidth - ctor.SPLITTER_WIDTH;
        let totalDays = model.diffDays(range.start, range.end);
        const minDays = Math.ceil(Math.max(0, available) / pxDay);
        if (minDays > totalDays) {
            range.end = model.addDays(range.start, minDays);
            totalDays = minDays;
        }

        const view = {
            rows: rows,
            range: range,
            pxDay: pxDay,
            width: totalDays * pxDay,
            height: Math.max(1, rows.length) * ctor.ROW_HEIGHT
        };

        // the drag previews reroute connectors from the last rendered geometry
        this._view = view;
        this._rowIndexById = Object.create(null);
        for (let i = 0; i < rows.length; i++) {
            this._rowIndexById[rows[i].task.id] = i;
        }

        const body = document.createElement("div");
        body.className = "wx-gantt-body";
        body.appendChild(this._renderGrid(view));
        body.appendChild(this._renderSplitter());
        body.appendChild(state.error ? this._renderError() : this._renderChart(view));

        this._element.classList.toggle("wx-gantt--sandbox", state.sandbox !== null);
        if (state.sandbox !== null) {
            this._element.replaceChildren(this._renderToolbar(), this._renderSandbox(), body);
        } else {
            this._element.replaceChildren(this._renderToolbar(), body);
        }

        if (!this._gridCollapsed) {
            this._updateColumnFit(this._gridEl.clientWidth || gridWidth);
        }

        if (this._chartScroll) {
            this._chartScroll.scrollLeft = scrollLeft;
            this._chartScroll.scrollTop = scrollTop;
            this._syncVerticalScroll();
        }

        // a task created through the toolbar goes straight into label editing
        if (this._pendingEditTaskId) {
            const pending = this._labelCells && this._labelCells[this._pendingEditTaskId];
            this._pendingEditTaskId = null;
            if (pending) {
                this._beginCellEdit(pending.cell, pending.task, this._columns()[0]);
            }
        }
    }

    /**
     * Updates selection without detaching row cells between the two clicks of
     * a double-click gesture. This also preserves focus in the task grid.
     * @returns {void}
     */
    _renderSelection() {
        for (const name of ["wx-gantt-grid-row", "wx-gantt-row-stripe", "wx-gantt-bar", "wx-gantt-milestone"]) {
            for (const element of this._element.querySelectorAll("." + name)) {
                element.classList.toggle("is-selected", element.dataset.taskId === this.state.selectedTask);
            }
        }
        for (const entry of this._linkPaths ? this._linkPaths.values() : []) {
            entry.path.classList.toggle("is-selected", entry.link.id === this.state.selectedLink);
        }
        const toolbar = this._element.querySelector(".wx-gantt-toolbar");
        if (toolbar) {
            toolbar.parentNode.replaceChild(this._renderToolbar(), toolbar);
        }
    }

    /**
     * Builds the toolbar with the add action, the scale switch, the zoom
     * controls and the today shortcut.
     * @returns {HTMLElement} The toolbar element.
     */
    _renderToolbar() {
        const toolbar = document.createElement("div");
        toolbar.className = "wx-gantt-toolbar";

        if (!this._readonly) {
            const add = document.createElement("button");
            add.type = "button";
            add.className = "wx-gantt-btn wx-gantt-btn--primary wx-gantt-add";
            const icon = this._icon("wx-icon-light wx-icon-light-plus");
            if (icon) {
                add.appendChild(icon);
            }
            add.appendChild(document.createTextNode(" " + this._i18n("webexpress.webapp:gantt.new_task", "New task")));
            add.addEventListener("click", () => {
                const task = this.addTask();
                if (task) {
                    this._pendingEditTaskId = task.id;
                }
            });
            toolbar.appendChild(add);

            if (this._sandboxOffered && this.state.sandbox === null) {
                const label = this._i18n("webexpress.webapp:gantt.sandbox", "Sandbox");
                const enter = this._sandboxButton("enter", label, () => this.enterSandbox());
                const sandboxIcon = this._icon("wx-icon-light wx-icon-light-flask");
                if (sandboxIcon) {
                    // the icon replaces the text, so the name moves to the accessible label
                    enter.replaceChildren(sandboxIcon);
                    enter.setAttribute("aria-label", label);
                }
                enter.title = label + " - " + this._i18n("webexpress.webapp:gantt.sandbox.hint", "Try out changes without saving them");
                toolbar.appendChild(enter);
            }
        }

        const selectedLink = this._links.find((link) => link.id === this.state.selectedLink);
        if (selectedLink) {
            const label = document.createElement("label");
            label.className = "wx-gantt-link-editor";
            label.appendChild(document.createTextNode(this._i18n("webexpress.webapp:gantt.link_type", "Dependency") + " "));
            const select = document.createElement("select");
            select.className = "wx-gantt-btn wx-gantt-link-type";
            select.disabled = this._readonly;
            select.setAttribute("aria-label", this._i18n("webexpress.webapp:gantt.link_type", "Dependency"));
            for (const type of webexpress.webapp.ganttModel.LINK_TYPES) {
                const option = document.createElement("option");
                option.value = type;
                option.textContent = this._i18n("webexpress.webapp:gantt.link." + type, type);
                select.appendChild(option);
            }
            select.value = selectedLink.type;
            select.addEventListener("change", () => this.updateLink(selectedLink.id, { type: select.value }));
            label.appendChild(select);
            toolbar.appendChild(label);
            if (!this._readonly) {
                const remove = document.createElement("button");
                remove.type = "button";
                remove.className = "wx-gantt-btn wx-gantt-link-delete";
                remove.textContent = this._i18n("webexpress.webapp:gantt.delete_link", "Delete dependency");
                remove.addEventListener("click", () => this.removeLink(selectedLink.id));
                toolbar.appendChild(remove);
            }
        }

        const spacer = document.createElement("span");
        spacer.className = "wx-gantt-toolbar-spacer";
        toolbar.appendChild(spacer);

        const gridToggle = document.createElement("button");
        gridToggle.type = "button";
        gridToggle.className = "wx-gantt-btn wx-gantt-grid-toggle" + (this._gridCollapsed ? " is-active" : "");
        gridToggle.title = this._i18n("webexpress.webapp:gantt.toggle_grid", "Show or hide the task list");
        const gridIcon = this._icon("wx-icon-light wx-icon-light-columns");
        if (gridIcon) {
            gridToggle.appendChild(gridIcon);
        } else {
            gridToggle.textContent = "▤";
        }
        gridToggle.addEventListener("click", () => this.toggleGrid());
        toolbar.appendChild(gridToggle);

        if (this._allowedScales.length > 1) {
            const scales = document.createElement("div");
            scales.className = "wx-gantt-scales";
            for (const scale of this._allowedScales) {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "wx-gantt-btn wx-gantt-scale-btn" + (scale === this._scale ? " is-active" : "");
                btn.dataset.scale = scale;
                btn.textContent = this._i18n("webexpress.webapp:gantt.scale." + scale, scale);
                btn.addEventListener("click", () => this.setScale(scale));
                scales.appendChild(btn);
            }
            toolbar.appendChild(scales);
        }

        const zoom = document.createElement("div");
        zoom.className = "wx-gantt-zoom";

        const zoomOut = document.createElement("button");
        zoomOut.type = "button";
        zoomOut.className = "wx-gantt-btn wx-gantt-zoom-out";
        zoomOut.title = this._i18n("webexpress.webapp:gantt.zoom_out", "Zoom out");
        zoomOut.textContent = "−";
        zoomOut.addEventListener("click", () => this.zoomOut());
        zoom.appendChild(zoomOut);

        const zoomIn = document.createElement("button");
        zoomIn.type = "button";
        zoomIn.className = "wx-gantt-btn wx-gantt-zoom-in";
        zoomIn.title = this._i18n("webexpress.webapp:gantt.zoom_in", "Zoom in");
        zoomIn.textContent = "+";
        zoomIn.addEventListener("click", () => this.zoomIn());
        zoom.appendChild(zoomIn);

        const today = document.createElement("button");
        today.type = "button";
        today.className = "wx-gantt-btn wx-gantt-today-btn";
        today.textContent = this._i18n("webexpress.webapp:gantt.today", "Today");
        today.addEventListener("click", () => this.scrollToToday());
        zoom.appendChild(today);

        toolbar.appendChild(zoom);
        return toolbar;
    }

    /**
     * Builds the strip shown while the sandbox is open. It keeps the user aware
     * that nothing is stored yet, and it is where ending the sandbox asks
     * whether to save or discard the changes - inline rather than in a modal,
     * so the plan stays visible while the user decides.
     * @returns {HTMLElement} The sandbox strip.
     */
    _renderSandbox() {
        const phase = this.state.sandbox;
        const strip = document.createElement("div");
        strip.className = "wx-gantt-sandbox";
        strip.setAttribute("role", "status");

        const text = document.createElement("span");
        text.className = "wx-gantt-sandbox-text";
        strip.appendChild(text);

        if (phase === "saving") {
            text.textContent = this._i18n("webexpress.webapp:gantt.sandbox.saving", "Saving changes …");
            return strip;
        }

        text.textContent = phase === "deciding"
            ? this._i18n("webexpress.webapp:gantt.sandbox.decide", "End sandbox – what should happen to the changes?")
            : this._i18n("webexpress.webapp:gantt.sandbox.active", "Sandbox – changes are only saved when you end it.");

        const count = document.createElement("span");
        count.className = "wx-gantt-sandbox-count";
        count.textContent = this._i18n("webexpress.webapp:gantt.sandbox.changes", "Changes") + ": " + this.sandboxChangeCount();
        strip.appendChild(count);

        if (phase === "deciding") {
            strip.appendChild(this._sandboxButton("save", this._i18n("webexpress.webapp:gantt.sandbox.save", "Save all changes"), () => this.saveSandbox(), true));
            strip.appendChild(this._sandboxButton("discard", this._i18n("webexpress.webapp:gantt.sandbox.discard", "Discard changes"), () => this.discardSandbox()));
            strip.appendChild(this._sandboxButton("continue", this._i18n("webexpress.webapp:gantt.sandbox.continue", "Keep editing"), () => this.continueSandbox()));
        } else {
            strip.appendChild(this._sandboxButton("end", this._i18n("webexpress.webapp:gantt.sandbox.end", "End sandbox"), () => this.endSandbox()));
        }
        return strip;
    }

    /**
     * Builds one of the sandbox actions.
     * @param {string} name - The action name, completing the css class.
     * @param {string} label - The button text.
     * @param {function(): void} onClick - The action.
     * @param {boolean} [primary=false] - True for the emphasised action.
     * @returns {HTMLButtonElement} The button.
     */
    _sandboxButton(name, label, onClick, primary = false) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "wx-gantt-btn wx-gantt-sandbox-" + name + (primary ? " wx-gantt-btn--primary" : "");
        button.textContent = label;
        button.addEventListener("click", onClick);
        return button;
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
     * Builds the left grid pane with the column header and one row per visible
     * task. Cells are edited inline on double-click.
     * @param {object} view - The computed view geometry.
     * @returns {HTMLElement} The grid pane.
     */
    _renderGrid(view) {
        const ctor = webexpress.webapp.GanttCtrl;
        const grid = document.createElement("div");
        grid.className = "wx-gantt-grid";
        this._gridEl = grid;

        if (this._gridCollapsed) {
            grid.classList.add("wx-gantt-grid--collapsed");
        }

        if (this._gridWidth) {
            grid.style.flexBasis = this._gridWidth + "px";
            grid.style.maxWidth = "none";
        }

        const head = document.createElement("div");
        head.className = "wx-gantt-grid-head";
        head.style.height = ctor.HEAD_HEIGHT + "px";
        for (const column of this._columns()) {
            const cell = document.createElement("div");
            cell.className = "wx-gantt-grid-cell wx-gantt-grid-cell--" + column.cls;
            cell.classList.add("wx-gantt-grid-cell--key-" + column.key);
            cell.textContent = column.label;
            head.appendChild(cell);
        }
        grid.appendChild(head);

        const rowsHost = document.createElement("div");
        rowsHost.className = "wx-gantt-grid-rows";
        this._gridRows = rowsHost;
        this._labelCells = {};

        // the timeline pane owns the vertical scroll, the grid only follows;
        // a wheel over the grid is forwarded so both panes feel scrollable
        rowsHost.addEventListener("wheel", (e) => {
            if (this._chartScroll && e.deltaY) {
                this._chartScroll.scrollTop += e.deltaY;
                this._syncVerticalScroll();
                if (typeof e.preventDefault === "function") {
                    e.preventDefault();
                }
            }
        });

        if (view.rows.length === 0) {
            const empty = document.createElement("div");
            empty.className = "wx-gantt-empty";
            empty.textContent = this._i18n("webexpress.webapp:gantt.empty", "No tasks yet.");
            rowsHost.appendChild(empty);
        }

        for (const row of view.rows) {
            rowsHost.appendChild(this._renderGridRow(row));
        }

        grid.appendChild(rowsHost);
        return grid;
    }

    /**
     * Builds the draggable splitter between the grid pane and the timeline
     * pane. Dragging it resizes the grid; the chosen width survives re-renders.
     * @returns {HTMLElement} The splitter element.
     */
    _renderSplitter() {
        const splitter = document.createElement("div");
        splitter.className = "wx-gantt-splitter";
        splitter.addEventListener("mousedown", (e) => this._beginSplitDrag(e));
        splitter.addEventListener("dblclick", () => this.toggleGrid());
        return splitter;
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
            width: this._gridWidth || (this._gridEl && this._gridEl.offsetWidth) || ctor.DEFAULT_GRID_WIDTH
        };

        this._element.classList.add("wx-gantt--dragging");
        this._attachDragListeners();
    }

    /**
     * Applies a grid pane width, clamped so both panes stay usable, and
     * remembers it for the next render.
     * @param {number} width - The requested width in pixels.
     */
    _applySplit(width) {
        const ctor = webexpress.webapp.GanttCtrl;
        const hostWidth = this._element.clientWidth || 0;
        const max = hostWidth > 0 ? Math.max(ctor.MIN_GRID_WIDTH, hostWidth - 220) : Number.MAX_SAFE_INTEGER;
        const clamped = Math.min(max, Math.max(ctor.MIN_GRID_WIDTH, width));

        this._gridWidth = clamped;
        if (this._gridEl) {
            this._gridEl.style.flexBasis = clamped + "px";
            this._gridEl.style.maxWidth = "none";
        }
        this._updateColumnFit(clamped);
    }

    /**
     * Hides the grid columns that no longer fit the pane width, right to left,
     * so shrinking the pane trades detail columns for the name column instead
     * of crushing every cell. The cumulative claim keeps the hiding order
     * stable, and the name column never hides. The fit is applied through
     * classes on the grid element, so a running splitter drag updates it live
     * without a re-render.
     * @param {number} width - The grid pane width in pixels.
     */
    _updateColumnFit(width) {
        if (!this._gridEl) {
            return;
        }

        const minWidths = webexpress.webapp.GanttCtrl.COLUMN_MIN_WIDTHS;
        let claimed = minWidths.label;

        for (const key of this._visibleColumns) {
            if (key === "label") {
                continue;
            }
            claimed += minWidths[key] || 0;
            this._gridEl.classList.toggle("wx-gantt-grid--hide-" + key, claimed > width);
        }
    }

    /**
     * Builds one grid row: the indented name cell with the collapse caret, the
     * date, duration, progress and resources cells and the delete action.
     * @param {object} row - The flattened row { task, depth, hasChildren }.
     * @returns {HTMLElement} The row element.
     */
    _renderGridRow(row) {
        const ctor = webexpress.webapp.GanttCtrl;
        const task = row.task;
        const columns = this._columns();

        const rowEl = document.createElement("div");
        rowEl.className = "wx-gantt-grid-row"
            + (task.id === this.state.selectedTask ? " is-selected" : "")
            + (row.hasChildren ? " is-summary" : "");
        rowEl.dataset.taskId = task.id;
        rowEl.style.height = ctor.ROW_HEIGHT + "px";
        rowEl.addEventListener("click", () => this.select(task.id));

        for (const column of columns) {
            const cell = document.createElement("div");
            cell.className = "wx-gantt-grid-cell wx-gantt-grid-cell--" + column.cls;
            cell.classList.add("wx-gantt-grid-cell--key-" + column.key);

            if (column.key === "label") {
                cell.style.paddingLeft = (8 + row.depth * 16) + "px";

                if (row.hasChildren) {
                    const caret = document.createElement("button");
                    caret.type = "button";
                    caret.className = "wx-gantt-caret";
                    caret.setAttribute("aria-expanded", task.collapsed ? "false" : "true");
                    caret.setAttribute("aria-label", this._i18n("webexpress.webui:list.tree.toggle", "Expand or collapse"));
                    const drawing = webexpress.webui.Icon.create("angle-down");
                    drawing.style.transform = task.collapsed ? "rotate(-90deg)" : "none";
                    caret.appendChild(drawing);
                    caret.addEventListener("click", (e) => {
                        if (typeof e.stopPropagation === "function") {
                            e.stopPropagation();
                        }
                        this.toggleCollapse(task.id);
                    });
                    cell.appendChild(caret);
                }

                if (task.icon) {
                    const icon = this._icon(task.icon);
                    if (icon) {
                        icon.classList.add("wx-gantt-grid-icon");
                        cell.appendChild(icon);
                    }
                }

                const label = document.createElement("span");
                label.className = "wx-gantt-grid-label";
                label.textContent = task.label;
                cell.appendChild(label);

                this._labelCells[task.id] = { cell: cell, task: task };
            } else {
                cell.textContent = this._cellText(task, column.key);
            }

            // containers derive everything but their name from the subtree
            const editable = !this._readonly && (column.key === "label" || !row.hasChildren);
            if (editable) {
                cell.classList.add("is-editable");
                cell.addEventListener("dblclick", () => this._beginCellEdit(cell, task, column));
            }

            rowEl.appendChild(cell);
        }

        if (!this._readonly) {
            const del = document.createElement("button");
            del.type = "button";
            del.className = "wx-gantt-row-delete";
            del.title = this._i18n("webexpress.webapp:gantt.delete_task", "Delete task");
            const icon = this._icon("wx-icon-light wx-icon-light-trash");
            if (icon) {
                del.appendChild(icon);
            } else {
                del.textContent = "×";
            }
            del.addEventListener("click", (e) => {
                if (typeof e.stopPropagation === "function") {
                    e.stopPropagation();
                }
                this.removeTask(task.id);
            });
            rowEl.appendChild(del);
        }

        return rowEl;
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
     * Replaces a grid cell content with an inline editor and commits the value
     * on enter or blur. Escape cancels and restores the rendered cell.
     * @param {HTMLElement} cell - The cell element.
     * @param {object} task - The task behind the row.
     * @param {object} column - The column descriptor.
     * @returns {void}
     */
    _beginCellEdit(cell, task, column) {
        if (this._readonly) {
            return;
        }

        const model = webexpress.webapp.ganttModel;
        const input = document.createElement("input");
        input.className = "wx-gantt-cell-input";
        input.type = column.edit === "date" ? "date" : (column.edit === "number" ? "number" : "text");

        switch (column.key) {
            case "start": input.value = task.start || ""; break;
            case "end": input.value = task.end || ""; break;
            case "duration": input.value = String(task.duration); break;
            case "progress": input.value = String(task.progress); break;
            case "resources": input.value = task.resources.join(", "); break;
            default: input.value = task.label;
        }

        let done = false;
        const commit = () => {
            if (done) {
                return;
            }
            done = true;

            const value = input.value;
            let patch = null;

            switch (column.key) {
                case "label":
                    patch = { label: value };
                    break;
                case "start": {
                    const start = model.parseDate(value);
                    if (start) {
                        patch = { start: value };
                    }
                    break;
                }
                case "end": {
                    const end = model.parseDate(value);
                    const start = model.parseDate(task.start);
                    if (end && start && end > start) {
                        patch = { end: value };
                    }
                    break;
                }
                case "duration": {
                    const duration = Math.round(Number(value));
                    if (Number.isFinite(duration) && value !== "" && duration >= 0) {
                        patch = { duration: duration };
                    }
                    break;
                }
                case "progress": {
                    const progress = Math.round(Number(value));
                    if (!isNaN(progress)) {
                        patch = { progress: progress };
                    }
                    break;
                }
                case "resources":
                    patch = { resources: value };
                    break;
            }

            if (patch) {
                this.updateTask(task.id, patch);
            } else {
                this.render();
            }
        };

        input.addEventListener("blur", commit);
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                commit();
            } else if (e.key === "Escape") {
                done = true;
                this.render();
            }
        });

        cell.replaceChildren(input);
        input.focus({ preventScroll: true });
    }

    /**
     * Builds the scrollable timeline pane: the two tier scale header, the row
     * stripes, the weekend and today markers, the dependency layer and the
     * bars.
     * @param {object} view - The computed view geometry.
     * @returns {HTMLElement} The timeline pane.
     */
    _renderChart(view) {
        const ctor = webexpress.webapp.GanttCtrl;

        const chart = document.createElement("div");
        chart.className = "wx-gantt-chart";
        // the timeline scrolls sideways; it has to take the focus for the keyboard to scroll it
        chart.setAttribute("tabindex", "0");
        this._chartScroll = chart;
        chart.addEventListener("scroll", () => this._syncVerticalScroll());
        chart.addEventListener("wheel", (e) => {
            // ctrl+wheel zooms around the timeline like map interfaces do
            if (e.ctrlKey) {
                if (typeof e.preventDefault === "function") {
                    e.preventDefault();
                }
                if (e.deltaY < 0) { this.zoomIn(); } else { this.zoomOut(); }
            }
        });

        const inner = document.createElement("div");
        inner.className = "wx-gantt-chart-inner";
        inner.style.width = view.width + "px";

        inner.appendChild(this._renderScaleHead(view));
        inner.appendChild(this._renderCanvas(view));

        chart.appendChild(inner);
        return chart;
    }

    /**
     * Builds the two tier timeline header: coarse groups (months or years) on
     * top of the fine units (days, weeks or months).
     * @param {object} view - The computed view geometry.
     * @returns {HTMLElement} The header element.
     */
    _renderScaleHead(view) {
        const ctor = webexpress.webapp.GanttCtrl;
        const model = webexpress.webapp.ganttModel;
        const header = model.buildScale(this._scale, view.range.start, view.range.end, this._calendar);

        const head = document.createElement("div");
        head.className = "wx-gantt-chart-head";
        head.style.height = ctor.HEAD_HEIGHT + "px";

        const groups = document.createElement("div");
        groups.className = "wx-gantt-scale-groups";
        for (const group of header.groups) {
            const cell = document.createElement("div");
            cell.className = "wx-gantt-scale-cell";
            cell.style.width = (group.days * view.pxDay) + "px";
            cell.textContent = this._scale === "month"
                ? String(group.start.getUTCFullYear())
                : this._formatMonth(group.start);
            groups.appendChild(cell);
        }
        head.appendChild(groups);

        const units = document.createElement("div");
        units.className = "wx-gantt-scale-units";
        for (const unit of header.units) {
            const cell = document.createElement("div");
            cell.className = "wx-gantt-scale-cell" + (unit.nonWorking ? " is-weekend" : "") + (unit.holiday ? " is-holiday" : "");
            cell.style.width = (unit.days * view.pxDay) + "px";
            if (this._scale === "week") {
                cell.textContent = this._i18n("webexpress.webapp:gantt.week_short", "W") + unit.label;
            } else if (this._scale === "month") {
                cell.textContent = this._formatMonthShort(unit.start);
            } else {
                cell.textContent = unit.label;
            }
            units.appendChild(cell);
        }
        head.appendChild(units);

        return head;
    }

    /**
     * Builds the drawing surface below the header: row stripes, weekend
     * columns, the today marker, the SVG dependency layer and the bar layer.
     * A double-click on a free spot creates a task at that day and row.
     * @param {object} view - The computed view geometry.
     * @returns {HTMLElement} The canvas element.
     */
    _renderCanvas(view) {
        const ctor = webexpress.webapp.GanttCtrl;
        const model = webexpress.webapp.ganttModel;

        const canvas = document.createElement("div");
        canvas.className = "wx-gantt-canvas";
        canvas.style.height = view.height + "px";
        canvas.style.width = view.width + "px";
        this._canvas = canvas;

        canvas.addEventListener("dblclick", (e) => this._onCanvasDblClick(e, view));
        canvas.addEventListener("click", (e) => {
            // a pan that actually moved must not be mistaken for a click
            if (this._skipNextCanvasClick) {
                this._skipNextCanvasClick = false;
                return;
            }
            // a click on the empty surface clears the selection
            if (e.target === canvas) {
                this.select(null, null);
            }
        });

        // bars, handles and ports stop propagation, so a mousedown reaching
        // the canvas targets the free surface and pans the timeline
        canvas.addEventListener("mousedown", (e) => this._beginPan(e));

        // row stripes give the bars their lanes and carry the selection tint
        for (let i = 0; i < view.rows.length; i++) {
            const stripe = document.createElement("div");
            stripe.className = "wx-gantt-row-stripe"
                + (view.rows[i].task.id === this.state.selectedTask ? " is-selected" : "");
            stripe.dataset.taskId = view.rows[i].task.id;
            stripe.style.top = (i * ctor.ROW_HEIGHT) + "px";
            stripe.style.height = ctor.ROW_HEIGHT + "px";
            canvas.appendChild(stripe);
        }

        // weekend shading only reads well when a day has visible width
        if (this._scale === "day") {
            const header = model.buildScale("day", view.range.start, view.range.end, this._calendar);
            for (const unit of header.units) {
                if (!unit.nonWorking) {
                    continue;
                }
                const column = document.createElement("div");
                column.className = "wx-gantt-weekend" + (unit.holiday ? " wx-gantt-holiday" : "");
                column.style.left = model.dateToOffset(unit.start, view.range.start, view.pxDay) + "px";
                column.style.width = view.pxDay + "px";
                canvas.appendChild(column);
            }
        }

        const today = model.parseDate(new Date());
        const todayOffset = model.dateToOffset(today, view.range.start, view.pxDay);
        if (todayOffset >= 0 && todayOffset <= view.width) {
            const line = document.createElement("div");
            line.className = "wx-gantt-today";
            line.style.left = todayOffset + "px";
            canvas.appendChild(line);
        }

        canvas.appendChild(this._renderLinks(view));

        const bars = document.createElement("div");
        bars.className = "wx-gantt-bars";
        this._barsLayer = bars;
        for (let i = 0; i < view.rows.length; i++) {
            const bar = this._renderBar(view.rows[i], i, view);
            if (bar) {
                bars.appendChild(bar);
            }
        }
        canvas.appendChild(bars);

        return canvas;
    }

    /**
     * Builds the SVG dependency layer with one orthogonal connector per link.
     * Each connector carries an invisible wide twin that makes the thin line
     * clickable for selection and double-click deletion.
     * @param {object} view - The computed view geometry.
     * @returns {SVGElement} The SVG layer.
     */
    _renderLinks(view) {
        const svgNs = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNs, "svg");
        svg.classList.add("wx-gantt-links");
        svg.setAttribute("width", String(view.width));
        svg.setAttribute("height", String(view.height));
        this._svgLayer = svg;
        this._linkPaths = new Map();

        const markerId = this._markerId;
        const defs = document.createElementNS(svgNs, "defs");
        const marker = document.createElementNS(svgNs, "marker");
        marker.setAttribute("id", markerId);
        marker.setAttribute("viewBox", "0 0 10 10");
        marker.setAttribute("refX", "9");
        marker.setAttribute("refY", "5");
        marker.setAttribute("markerWidth", "6");
        marker.setAttribute("markerHeight", "6");
        marker.setAttribute("orient", "auto");
        const arrow = document.createElementNS(svgNs, "path");
        arrow.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
        marker.appendChild(arrow);
        defs.appendChild(marker);
        svg.appendChild(defs);

        const rowIndex = Object.create(null);
        for (let i = 0; i < view.rows.length; i++) {
            rowIndex[view.rows[i].task.id] = i;
        }

        for (const link of this._links) {
            const fromIdx = rowIndex[link.from];
            const toIdx = rowIndex[link.to];
            if (fromIdx === undefined || toIdx === undefined
                || !view.rows[fromIdx].task.start || !view.rows[toIdx].task.start) {
                // an endpoint inside a collapsed container has no visible row
                continue;
            }

            const fromSide = link.type === "SS" || link.type === "SF" ? "start" : "end";
            const toSide = link.type === "FF" || link.type === "SF" ? "end" : "start";
            const from = this._anchor(view.rows[fromIdx].task, fromIdx, fromSide, view);
            const to = this._anchor(view.rows[toIdx].task, toIdx, toSide, view);
            const d = this._linkPath(from, fromSide, to, toSide);

            const path = document.createElementNS(svgNs, "path");
            path.setAttribute("d", d);
            path.classList.add("wx-gantt-link");
            if (link.id === this.state.selectedLink) {
                path.classList.add("is-selected");
            }
            path.setAttribute("marker-end", "url(#" + markerId + ")");
            svg.appendChild(path);

            const hit = document.createElementNS(svgNs, "path");
            hit.setAttribute("d", d);
            hit.classList.add("wx-gantt-link-hit");
            const title = document.createElementNS(svgNs, "title");
            title.textContent = view.rows[fromIdx].task.label + " → " + view.rows[toIdx].task.label
                + ": " + this._i18n("webexpress.webapp:gantt.link." + link.type, link.type);
            hit.appendChild(title);
            hit.setAttribute("tabindex", "0");
            hit.setAttribute("role", "button");
            hit.setAttribute("aria-label", title.textContent);
            hit.addEventListener("mousedown", (event) => event.stopPropagation());
            hit.addEventListener("keydown", (event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    this.select(null, link.id);
                }
            });
            hit.addEventListener("click", () => this.select(null, link.id));
            hit.addEventListener("dblclick", () => this.removeLink(link.id));
            svg.appendChild(hit);

            this._linkPaths.set(link.id, { link: link, path: path, hit: hit });
        }

        return svg;
    }

    /**
     * Computes the connector anchor point of a task bar side.
     * @param {object} task - The task.
     * @param {number} rowIndex - The visible row index.
     * @param {string} side - The side: "start" or "end".
     * @param {object} view - The computed view geometry.
     * @returns {object} The point { x, y }.
     */
    _anchor(task, rowIndex, side, view) {
        const model = webexpress.webapp.ganttModel;
        const left = model.dateToOffset(model.parseDate(task.start), view.range.start, view.pxDay);
        const width = model.diffDays(model.parseDate(task.start), model.parseDate(task.end)) * view.pxDay;

        return this._anchorAt(left, width, rowIndex, side);
    }

    /**
     * Computes a connector anchor point from an explicit bar geometry, the
     * shared primitive of the rendered anchors and the drag previews.
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
     * Computes the rendered anchor point of a task by id, or null when the
     * task has no visible row.
     * @param {string} taskId - The task id.
     * @param {string} side - The side: "start" or "end".
     * @param {object} view - The computed view geometry.
     * @returns {object|null} The point { x, y }, or null.
     */
    _anchorFor(taskId, side, view) {
        const rowIndex = this._rowIndexById ? this._rowIndexById[taskId] : undefined;
        const task = this._tasks.find((t) => t.id === taskId);

        if (rowIndex === undefined || !task || !task.start) {
            return null;
        }

        return this._anchor(task, rowIndex, side, view);
    }

    /**
     * Reroutes the connectors that touch the dragged task from its previewed
     * geometry, so the dependencies follow the bar during the gesture instead
     * of snapping into place on release.
     * @param {string} taskId - The dragged task id.
     * @param {number} left - The previewed left offset in pixels.
     * @param {number} width - The previewed width in pixels.
     * @param {number} rowIndex - The visible row index of the dragged task.
     */
    _updateLinkPreviews(taskId, left, width, rowIndex) {
        if (!this._linkPaths || !this._view || rowIndex === undefined) {
            return;
        }

        for (const entry of this._linkPaths.values()) {
            const link = entry.link;
            if (link.from !== taskId && link.to !== taskId) {
                continue;
            }

            const fromSide = link.type === "SS" || link.type === "SF" ? "start" : "end";
            const toSide = link.type === "FF" || link.type === "SF" ? "end" : "start";

            const from = link.from === taskId
                ? this._anchorAt(left, width, rowIndex, fromSide)
                : this._anchorFor(link.from, fromSide, this._view);
            const to = link.to === taskId
                ? this._anchorAt(left, width, rowIndex, toSide)
                : this._anchorFor(link.to, toSide, this._view);

            if (!from || !to) {
                continue;
            }

            const d = this._linkPath(from, fromSide, to, toSide);
            entry.path.setAttribute("d", d);
            entry.hit.setAttribute("d", d);
        }
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
     * Builds the bar (or milestone diamond, or container bracket) of one row,
     * including the drag surfaces: resize handles, the progress handle and the
     * link ports.
     * @param {object} row - The flattened row { task, depth, hasChildren }.
     * @param {number} rowIndex - The visible row index.
     * @param {object} view - The computed view geometry.
     * @returns {HTMLElement|null} The bar element, or null without dates.
     */
    _renderBar(row, rowIndex, view) {
        const ctor = webexpress.webapp.GanttCtrl;
        const model = webexpress.webapp.ganttModel;
        const task = row.task;
        const start = model.parseDate(task.start);
        if (!start) {
            return null;
        }

        const left = model.dateToOffset(start, view.range.start, view.pxDay);
        const top = rowIndex * ctor.ROW_HEIGHT;
        const isSummary = row.hasChildren;
        const isMilestone = task.duration === 0;
        const selected = task.id === this.state.selectedTask;

        if (isMilestone) {
            const milestone = document.createElement("div");
            milestone.className = "wx-gantt-milestone" + (selected ? " is-selected" : "");
            milestone.dataset.taskId = task.id;
            milestone.style.left = left + "px";
            milestone.style.top = (top + ctor.ROW_HEIGHT / 2) + "px";
            milestone.title = task.label + " · " + this._formatDate(task.start);
            milestone.addEventListener("mousedown", (e) => this._beginDrag(e, task, "move", milestone, view));
            this._appendPorts(milestone, task, view);
            return milestone;
        }

        const width = Math.max(model.diffDays(model.parseDate(task.start), model.parseDate(task.end)) * view.pxDay, 2);

        const bar = document.createElement("div");
        bar.className = "wx-gantt-bar"
            + (isSummary ? " wx-gantt-bar--summary" : "")
            + (selected ? " is-selected" : "");
        bar.dataset.taskId = task.id;
        bar.style.left = left + "px";
        // container bars render as a flat bracket above the lane
        bar.style.top = (top + (isSummary ? 6 : 5)) + "px";
        bar.style.width = width + "px";
        bar.style.height = (isSummary ? 10 : ctor.ROW_HEIGHT - 10) + "px";
        if (task.color) {
            bar.style.background = task.color;
        }
        bar.title = task.label
            + " · " + this._formatDate(task.start) + " – " + this._formatDate(task.end)
            + " · " + task.progress + " %"
            + (task.resources.length > 0 ? " · " + task.resources.join(", ") : "");

        const progress = document.createElement("div");
        progress.className = "wx-gantt-bar-progress";
        progress.style.width = task.progress + "%";
        bar.appendChild(progress);

        const label = document.createElement("span");
        label.className = "wx-gantt-bar-label";
        if (task.icon) {
            const icon = this._icon(task.icon);
            if (icon) {
                icon.classList.add("wx-gantt-bar-icon");
                label.appendChild(icon);
            }
        }
        label.appendChild(document.createTextNode(task.label));
        bar.appendChild(label);

        if (task.resources.length > 0) {
            const resources = document.createElement("span");
            resources.className = "wx-gantt-bar-resources";
            resources.style.left = (width + 8) + "px";
            resources.textContent = task.resources.join(", ");
            bar.appendChild(resources);
        }

        // containers derive their dates from the subtree, so only leaf bars
        // are draggable and resizable
        if (!isSummary && !this._readonly) {
            bar.addEventListener("mousedown", (e) => this._beginDrag(e, task, "move", bar, view));

            for (const edge of ["start", "end"]) {
                const handle = document.createElement("div");
                handle.className = "wx-gantt-handle wx-gantt-handle--" + edge;
                handle.addEventListener("mousedown", (e) => this._beginDrag(e, task, "resize-" + edge, bar, view));
                bar.appendChild(handle);
            }

            const progressHandle = document.createElement("div");
            progressHandle.className = "wx-gantt-progress-handle";
            progressHandle.style.left = "calc(" + task.progress + "% - 4px)";
            progressHandle.addEventListener("mousedown", (e) => this._beginDrag(e, task, "progress", bar, view));
            bar.appendChild(progressHandle);
        } else {
            bar.addEventListener("mousedown", () => this.select(task.id));
        }

        this._appendPorts(bar, task, view);
        return bar;
    }

    /**
     * Appends the two link ports to a bar. Dragging a port starts a link
     * gesture; the entire target bar accepts the drop.
     * @param {HTMLElement} bar - The bar element.
     * @param {object} task - The task behind the bar.
     * @param {object} view - The computed view geometry.
     */
    _appendPorts(bar, task, view) {
        if (this._readonly) {
            return;
        }

        for (const side of ["start", "end"]) {
            const port = document.createElement("div");
            port.className = "wx-gantt-port wx-gantt-port--" + side;
            port.addEventListener("mousedown", (e) => this._beginLinkDrag(e, task, side, view));
            bar.appendChild(port);
        }
    }

    /**
     * Resolves a link drop anywhere inside a bar, including its label and
     * progress layer. Explicit ports select their boundary; otherwise the
     * pointer's nearest half selects the start or finish boundary.
     * @param {MouseEvent} event - The current pointer event.
     * @param {string} fromId - The predecessor being connected.
     * @returns {object|null} The valid target task, boundary and bar element.
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
                    return { task: task, side: side, element: element };
                }
            }
            element = element.parentNode;
        }
        return null;
    }

    /**
     * Highlights the accepted bar and boundary while removing stale feedback.
     * @param {object|null} target - The current resolved drop target.
     * @returns {void}
     */
    _setLinkTarget(target) {
        if (this._linkTarget) {
            this._linkTarget.element.classList.remove("is-link-target");
            delete this._linkTarget.element.dataset.linkTargetSide;
        }
        this._linkTarget = target;
        if (target) {
            target.element.classList.add("is-link-target");
            target.element.dataset.linkTargetSide = target.side;
        }
    }

    /**
     * Builds the inline error panel shown in place of the timeline when the
     * load failed, with a retry action when an endpoint is configured.
     * @returns {HTMLElement} The error element.
     */
    _renderError() {
        const wrap = document.createElement("div");
        wrap.className = "wx-gantt-error";

        const message = document.createElement("span");
        message.textContent = this._i18n("webexpress.webapp:gantt.load_failed", "Failed to load the plan.");
        wrap.appendChild(message);

        if (this._restUri !== "") {
            const retry = document.createElement("button");
            retry.type = "button";
            retry.className = "wx-gantt-btn";
            retry.textContent = this._i18n("webexpress.webapp:gantt.retry", "Retry");
            retry.addEventListener("click", () => this.refresh());
            wrap.appendChild(retry);
        }

        return wrap;
    }

    // --------------------------------------------------------- interactions

    /**
     * Starts a bar gesture (move, resize or progress). The gesture previews by
     * mutating the bar style directly and only commits a state change on
     * release, so the store is not flooded during the drag.
     * @param {MouseEvent} e - The mousedown event.
     * @param {object} task - The task behind the bar.
     * @param {string} type - The gesture: move, resize-start, resize-end or progress.
     * @param {HTMLElement} bar - The bar element.
     * @param {object} view - The computed view geometry.
     */
    _beginDrag(e, task, type, bar, view) {
        if (this._readonly || (e.button !== undefined && e.button !== 0)) {
            return;
        }
        if (typeof e.preventDefault === "function") {
            e.preventDefault();
        }
        if (typeof e.stopPropagation === "function") {
            e.stopPropagation();
        }

        this.select(task.id);

        const model = webexpress.webapp.ganttModel;
        const left = model.dateToOffset(model.parseDate(task.start), view.range.start, view.pxDay);
        const width = model.diffDays(model.parseDate(task.start), model.parseDate(task.end)) * view.pxDay;

        this._drag = {
            type: type,
            task: task,
            view: view,
            bar: bar,
            startX: e.clientX || 0,
            left: left,
            width: width,
            rowIndex: this._rowIndexById ? this._rowIndexById[task.id] : undefined,
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
     * Starts a link gesture from a port. A temporary connector follows the
     * pointer until it is released over another port.
     * @param {MouseEvent} e - The mousedown event.
     * @param {object} task - The source task.
     * @param {string} side - The source side: "start" or "end".
     * @param {object} view - The computed view geometry.
     */
    _beginLinkDrag(e, task, side, view) {
        if (this._readonly || (e.button !== undefined && e.button !== 0)) {
            return;
        }
        if (typeof e.preventDefault === "function") {
            e.preventDefault();
        }
        if (typeof e.stopPropagation === "function") {
            e.stopPropagation();
        }

        const rowIndex = webexpress.webapp.ganttModel.flatten(this._tasks).findIndex((row) => row.task.id === task.id);
        const from = this._anchor(task, Math.max(0, rowIndex), side, view);

        const temp = document.createElementNS("http://www.w3.org/2000/svg", "path");
        temp.classList.add("wx-gantt-link");
        temp.classList.add("wx-gantt-link--temp");
        if (this._svgLayer) {
            this._svgLayer.appendChild(temp);
        }

        this._drag = {
            type: "link",
            task: task,
            side: side,
            view: view,
            from: from,
            temp: temp,
            startX: e.clientX || 0,
            startY: e.clientY || 0
        };
        this._linkTarget = null;

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

        if (this._calendar && ["move", "resize-start", "resize-end"].includes(drag.type)) {
            const model = webexpress.webapp.ganttModel;
            const days = Math.round(dx / drag.view.pxDay);
            const patch = drag.type === "move"
                ? model.moveTask(drag.task, days, this._calendar)
                : model.resizeTask(drag.task, drag.type === "resize-start" ? "start" : "end", days, this._calendar);
            const preview = patch || drag.task;
            const start = model.parseDate(preview.start);
            const end = model.parseDate(preview.end);
            const left = model.dateToOffset(start, drag.view.range.start, drag.view.pxDay);
            const width = model.diffDays(start, end) * drag.view.pxDay;
            drag.bar.style.left = left + "px";
            if (drag.task.duration > 0) {
                drag.bar.style.width = Math.max(2, width) + "px";
            }
            this._updateLinkPreviews(drag.task.id, left, width, drag.rowIndex);
            return;
        }

        if (drag.type === "move") {
            const left = drag.left + dx;
            drag.bar.style.left = left + "px";
            this._updateLinkPreviews(drag.task.id, left, drag.width, drag.rowIndex);
        } else if (drag.type === "resize-end") {
            const width = Math.max(drag.view.pxDay, drag.width + dx);
            drag.bar.style.width = width + "px";
            this._updateLinkPreviews(drag.task.id, drag.left, width, drag.rowIndex);
        } else if (drag.type === "resize-start") {
            const width = Math.max(drag.view.pxDay, drag.width - dx);
            const left = drag.left + drag.width - width;
            drag.bar.style.left = left + "px";
            drag.bar.style.width = width + "px";
            this._updateLinkPreviews(drag.task.id, left, width, drag.rowIndex);
        } else if (drag.type === "progress") {
            const pct = this._progressFromDx(drag, dx);
            drag.bar.childNodes[0].style.width = pct + "%";
        } else if (drag.type === "link") {
            const target = this._resolveLinkTarget(e, drag.task.id);
            this._setLinkTarget(target);
            const x = drag.from.x + dx;
            const y = drag.from.y + dy;
            const anchor = target ? this._anchorFor(target.task.id, target.side, drag.view) : null;
            drag.temp.setAttribute("d", anchor
                ? this._linkPath(drag.from, drag.side, anchor, target.side)
                : "M " + drag.from.x + " " + drag.from.y + " L " + x + " " + y);
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
            // the filler days depend on the pane widths, so recompute them
            this.render();
            return;
        }

        if (drag.type === "pan") {
            // a pan that moved must not fall through to the click handler
            this._skipNextCanvasClick = drag.moved;
            return;
        }

        const deltaDays = Math.round(dx / drag.view.pxDay);

        if (drag.type === "link") {
            if (drag.temp && drag.temp.parentNode) {
                drag.temp.parentNode.removeChild(drag.temp);
            }
            const target = this._resolveLinkTarget(e, drag.task.id);
            this._setLinkTarget(null);
            if (target && target.task.id !== drag.task.id) {
                this.addLink(drag.task.id, target.task.id, this._linkTypeFor(drag.side, target.side));
            } else {
                // no valid drop target, the preview connector simply vanishes
                this.render();
            }
            return;
        }

        if (!drag.moved) {
            // a plain click selects, the render restores the pristine bar
            this.render();
            return;
        }

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
        } else {
            this.render();
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
     * position and the parent.
     * @param {MouseEvent} e - The dblclick event.
     * @param {object} view - The computed view geometry.
     */
    _onCanvasDblClick(e, view) {
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
        const rect = this._canvas.getBoundingClientRect();
        const x = (e.clientX || 0) - rect.left;
        const y = (e.clientY || 0) - rect.top;

        const start = model.offsetToDate(x, view.range.start, view.pxDay);
        const rowIndex = Math.floor(y / ctor.ROW_HEIGHT);
        const anchorRow = view.rows[rowIndex] || null;

        const task = this.addTask({
            start: model.formatIso(start),
            parentId: anchorRow ? anchorRow.task.parentId : null
        }, anchorRow ? { afterId: anchorRow.task.id } : {});

        if (task) {
            this._pendingEditTaskId = task.id;
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
            return date.toLocaleDateString(undefined, { timeZone: "UTC" });
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
            return date.toLocaleDateString(undefined, { month: "short", year: "numeric", timeZone: "UTC" });
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
            return date.toLocaleDateString(undefined, { month: "short", timeZone: "UTC" });
        } catch (_) {
            return date.toISOString().slice(5, 7);
        }
    }

    /**
     * Resolves an icon element through the shared icon factory, tolerating a
     * runtime without it.
     * @param {string} spec - The icon specification.
     * @returns {HTMLElement|null} The icon element or null.
     */
    _icon(spec) {
        return webexpress.webui.Icon && typeof webexpress.webui.Icon.create === "function"
            ? webexpress.webui.Icon.create(spec)
            : null;
    }

    /**
     * Tears down transient listeners so a running gesture does not leak when
     * the control is destroyed mid-drag.
     */
    destroy() {
        this._setLinkTarget(null);
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
        super.destroy();
    }
};

// register the class in the framework controller
webexpress.webui.Controller.registerClass("wx-webapp-gantt", webexpress.webapp.GanttCtrl);
