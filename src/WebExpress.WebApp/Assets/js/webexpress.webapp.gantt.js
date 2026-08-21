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
 * ports at the bar edges onto a port of another bar creates a typed dependency
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
 */
webexpress.webapp.GanttCtrl = class extends webexpress.webapp.Data {

    static ROW_HEIGHT = 32;
    static HEAD_HEIGHT = 44;
    static ZOOM_STEP = 1.25;
    static SCALES = ["day", "week", "month"];
    static COLUMNS = ["label", "start", "end", "duration", "progress", "resources"];

    // pane width each column claims before the next one may show; the sums
    // mark the thresholds at which shrinking hides the columns right to left,
    // and they add up to the default grid width so every column shows there
    static COLUMN_MIN_WIDTHS = { label: 130, start: 70, end: 70, duration: 50, progress: 50, resources: 50 };

    static DEFAULT_GRID_WIDTH = 420;
    static MIN_GRID_WIDTH = 160;
    static SPLITTER_WIDTH = 6;

    static TASK_CREATE_EVENT = "webexpress.webapp.gantt.task.create";
    static TASK_UPDATE_EVENT = "webexpress.webapp.gantt.task.update";
    static TASK_DELETE_EVENT = "webexpress.webapp.gantt.task.delete";
    static LINK_CREATE_EVENT = "webexpress.webapp.gantt.link.create";
    static LINK_DELETE_EVENT = "webexpress.webapp.gantt.link.delete";
    static SELECT_EVENT = "webexpress.webapp.gantt.select";

    // assignable mutation callbacks, the imperative twin of the DOM events
    onTaskCreate = null;
    onTaskUpdate = null;
    onTaskDelete = null;
    onLinkCreate = null;
    onLinkDelete = null;

    // configuration
    _restUri = "";
    _resource = null;
    _viewState = null;
    _allowedScales = null;
    _visibleColumns = null;

    // grid pane width chosen through the splitter, surviving re-renders
    _gridWidth = null;

    // transient interaction state, deliberately outside the store because a
    // drag preview mutates the DOM directly and only commits on release
    _drag = null;
    _dragOverPort = null;
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
        const project = model.normalizeProject({ tasks: island.tasks, links: island.links });
        model.rollup(project.tasks);

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
                tasks: project.tasks,
                links: project.links,
                selectedTask: null,
                selectedLink: null
            }
        });

        this._allowedScales = scales;
        this._visibleColumns = columns;
        this._service = this.useService("data");
        this._restUri = this._service ? this._service.baseUri : "";
        this._resource = dataset.wxResource || null;

        // the registered selector class must never be re-added (the controller
        // strips it on instantiation), so the control marks itself distinctly
        element.classList.add("wx-gantt");
        element.tabIndex = 0;
        element.addEventListener("keydown", (e) => this._onKeyDown(e));

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

    get _tasks() { return this.state.tasks || []; }
    get _links() { return this.state.links || []; }
    get _scale() { return this.state.scale; }
    get _zoom() { return this.state.zoom; }
    get _readonly() { return this.state.readonly === true; }
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
            links: this._links.map((link) => Object.assign({}, link))
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

        const task = model.normalizeTask(raw);
        if (!task) {
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
        model.rollup(tasks);

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

        const raw = Object.assign({}, current, patch);
        if (patch.duration !== undefined && patch.end === undefined) {
            // the end is derived again, otherwise the stale end would win
            delete raw.end;
        }

        const task = model.normalizeTask(raw);
        if (!task) {
            return null;
        }

        const tasks = this._tasks.map((t) => (t.id === id ? task : t));
        model.rollup(tasks);

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

        this.setState({ tasks: tasks, links: links, selectedTask: null });

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
        if (this._readonly || !model.canLink(this._tasks, this._links, fromId, toId).ok) {
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
        const project = model.normalizeProject(data);
        model.rollup(project.tasks);
        this.setState(Object.assign({ tasks: project.tasks, links: project.links }, extra));
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

            const unsubscribe = viewState.watch((state) => state[this._resource], (slice) => this._applySlice(slice));
            (element._wxCleanup = element._wxCleanup || []).push(unsubscribe);

            this._applySlice(viewState.getState()[this._resource]);
        });
    }

    /**
     * Renders a resource slice the ViewState loaded centrally.
     * @param {object} slice - The resource slice { data, loading, error }.
     */
    _applySlice(slice) {
        slice = slice || {};
        if (slice.data) {
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
        if (!this._service) {
            return;
        }
        this._service.create(webexpress.webapp.ganttModel.taskToWire(task), { path: "/tasks" }).then((result) => {
            if (!result.ok) {
                if (result.error.kind !== "abort") {
                    console.error("gantt create task failed:", webexpress.webapp.ServiceResult.describe(result));
                }
                return;
            }
            const serverId = result.data && result.data.id !== undefined && result.data.id !== null
                ? String(result.data.id)
                : null;
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
        if (!this._service) {
            return;
        }
        this._service.update(webexpress.webapp.ganttModel.taskToWire(task), { path: "/tasks/" + encodeURIComponent(task.id) })
            .then((result) => {
                if (!result.ok && result.error.kind !== "abort") {
                    console.error("gantt update task failed:", webexpress.webapp.ServiceResult.describe(result));
                }
            });
    }

    /**
     * Persists a task deletion with DELETE.
     * @param {string} id - The task id.
     */
    _persistTaskDelete(id) {
        if (!this._service) {
            return;
        }
        this._service.remove({ path: "/tasks/" + encodeURIComponent(id) }).then((result) => {
            if (!result.ok && result.error.kind !== "abort") {
                console.error("gantt delete task failed:", webexpress.webapp.ServiceResult.describe(result));
            }
        });
    }

    /**
     * Persists a created link with POST, adopting a server assigned id.
     * @param {object} link - The created link.
     */
    _persistLinkCreate(link) {
        if (!this._service) {
            return;
        }
        this._service.create(webexpress.webapp.ganttModel.linkToWire(link), { path: "/links" }).then((result) => {
            if (!result.ok) {
                if (result.error.kind !== "abort") {
                    console.error("gantt create link failed:", webexpress.webapp.ServiceResult.describe(result));
                }
                return;
            }
            const serverId = result.data && result.data.id !== undefined && result.data.id !== null
                ? String(result.data.id)
                : null;
            if (serverId && serverId !== link.id) {
                this.setState({
                    links: this._links.map((l) => (l.id === link.id ? Object.assign({}, l, { id: serverId }) : l))
                });
            }
        });
    }

    /**
     * Persists a link deletion with DELETE.
     * @param {string} id - The link id.
     */
    _persistLinkDelete(id) {
        if (!this._service) {
            return;
        }
        this._service.remove({ path: "/links/" + encodeURIComponent(id) }).then((result) => {
            if (!result.ok && result.error.kind !== "abort") {
                console.error("gantt delete link failed:", webexpress.webapp.ServiceResult.describe(result));
            }
        });
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
        this._rowIndexById = {};
        for (let i = 0; i < rows.length; i++) {
            this._rowIndexById[rows[i].task.id] = i;
        }

        const body = document.createElement("div");
        body.className = "wx-gantt-body";
        body.appendChild(this._renderGrid(view));
        body.appendChild(this._renderSplitter());
        body.appendChild(state.error ? this._renderError() : this._renderChart(view));

        this._element.replaceChildren(this._renderToolbar(), body);

        if (!this._gridCollapsed) {
            this._updateColumnFit(gridWidth);
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
                    caret.textContent = task.collapsed ? "▸" : "▾";
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
                        const end = model.parseDate(task.end);
                        // a start moved beyond the end shifts the bar instead of
                        // collapsing it into a milestone
                        patch = end && start > end
                            ? { start: value, end: model.formatIso(model.addDays(start, task.duration)) }
                            : { start: value };
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
                    if (!isNaN(duration) && duration >= 1) {
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
        input.focus();
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
        const header = model.buildScale(this._scale, view.range.start, view.range.end);

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
            cell.className = "wx-gantt-scale-cell" + (unit.weekend ? " is-weekend" : "");
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
            stripe.style.top = (i * ctor.ROW_HEIGHT) + "px";
            stripe.style.height = ctor.ROW_HEIGHT + "px";
            canvas.appendChild(stripe);
        }

        // weekend shading only reads well when a day has visible width
        if (this._scale === "day") {
            const header = model.buildScale("day", view.range.start, view.range.end);
            for (const unit of header.units) {
                if (!unit.weekend) {
                    continue;
                }
                const column = document.createElement("div");
                column.className = "wx-gantt-weekend";
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

        const markerId = (this._element.id || "wx-gantt") + "-arrow";
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

        const rowIndex = {};
        for (let i = 0; i < view.rows.length; i++) {
            rowIndex[view.rows[i].task.id] = i;
        }

        for (const link of this._links) {
            const fromIdx = rowIndex[link.from];
            const toIdx = rowIndex[link.to];
            if (fromIdx === undefined || toIdx === undefined) {
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
        const width = task.duration * view.pxDay;

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

        if (rowIndex === undefined || !task) {
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

        const width = Math.max(task.duration * view.pxDay, 2);

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
     * gesture; hovering a port while a gesture runs marks it as the drop
     * target.
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
            port.addEventListener("mouseenter", () => {
                if (this._drag && this._drag.type === "link") {
                    this._dragOverPort = { task: task, side: side };
                    port.classList.add("is-target");
                }
            });
            port.addEventListener("mouseleave", () => {
                if (this._dragOverPort && this._dragOverPort.task.id === task.id && this._dragOverPort.side === side) {
                    this._dragOverPort = null;
                }
                port.classList.remove("is-target");
            });
            bar.appendChild(port);
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
        const width = task.duration * view.pxDay;

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
        this._dragOverPort = null;

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
            const x = drag.from.x + dx;
            const y = drag.from.y + dy;
            drag.temp.setAttribute("d", "M " + drag.from.x + " " + drag.from.y + " L " + x + " " + y);
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
     * snapped to whole days, a link gesture connects to the hovered port with
     * the type the two sides imply.
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
            const target = this._dragOverPort;
            this._dragOverPort = null;
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
            patch = model.moveTask(drag.task, deltaDays);
        } else if (drag.type === "resize-start") {
            // the model speaks "edge moved right", exactly the pointer distance
            patch = model.resizeTask(drag.task, "start", deltaDays);
        } else if (drag.type === "resize-end") {
            patch = model.resizeTask(drag.task, "end", deltaDays);
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
        if (e.key === "Delete" || e.key === "Backspace") {
            if (this._readonly) {
                return;
            }
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
     * callback twin when present.
     * @param {string} name - The event name.
     * @param {string|null} callback - The callback property name, or null.
     * @param {object} detail - The event detail.
     */
    _emit(name, callback, detail) {
        this._dispatch(name, Object.assign({ id: this._element.id }, detail));
        if (callback && typeof this[callback] === "function") {
            this[callback](detail);
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
        if (this._onDragMove) {
            document.removeEventListener("mousemove", this._onDragMove);
            document.removeEventListener("mouseup", this._onDragUp);
        }
        super.destroy();
    }
};

// register the class in the framework controller
webexpress.webui.Controller.registerClass("wx-webapp-gantt", webexpress.webapp.GanttCtrl);
