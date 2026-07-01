/**
 * Status dot of a task (WebTask).
 *
 * It consumes the very same live task pipeline as
 * webexpress.webapp.ProgressTaskCtrl - the server pushes start, progress,
 * message and finish events over the MessageQueue WebSocket
 * (WebExpress.WebApp.WebMessageQueue.ProgressTaskDispatcher) and replays the
 * current state on (re)connect - but instead of a progress bar it condenses the
 * state into a single colored dot: gray pending, blue running, green done, red
 * error. Warning (yellow) is not part of the task lifecycle, so it is only
 * reachable through a static data-status.
 *
 * Left without a data-task the control is a static status dot driven by
 * data-status, the way a dense surface shows a status that is not backed by a
 * running task.
 *
 * Dispatched events (shared with the progress bar so existing listeners keep
 * working):
 * - webexpress.webui.Event.TASK_UPDATE_EVENT
 * - webexpress.webui.Event.TASK_FINISH_EVENT
 * - webexpress.webui.Event.HIDE_EVENT
 * - webexpress.webui.Event.SHOW_EVENT
 */
webexpress.webapp.StatusTaskCtrl = class extends webexpress.webui.Ctrl {
    // the wire type the ProgressTaskDispatcher sends; shared so one server
    // pipeline drives both the bar and the dot
    static UPDATE_TYPE = "webexpress.webapp.progresstask.update";

    // mirrors WebExpress.WebCore.WebTask.TaskState
    static STATE_CREATED = 0;
    static STATE_RUN = 1;
    static STATE_CANCELED = 2;
    static STATE_FINISH = 3;

    // the statuses a dot can show, matching TypeStatusTask.ToValue on the server
    static STATUSES = ["none", "pending", "running", "warning", "error", "done"];

    /**
     * Maps a numeric task state to a dot status. Warning is intentionally absent:
     * the task lifecycle never emits it, so it stays reachable only through a
     * static data-status.
     * @param {number} state - The WebTask.TaskState value.
     * @returns {string} The dot status token.
     */
    static statusForState(state) {
        switch (state) {
            case webexpress.webapp.StatusTaskCtrl.STATE_RUN:
                return "running";
            case webexpress.webapp.StatusTaskCtrl.STATE_FINISH:
                return "done";
            case webexpress.webapp.StatusTaskCtrl.STATE_CANCELED:
                return "error";
            default:
                return "pending";
        }
    }

    /**
     * Constructor.
     * @param {HTMLElement} element - The DOM element associated with the control.
     */
    constructor(element) {
        super(element);

        this._element = element;
        this._taskId = (element.dataset.task || "").toLowerCase();
        this._status = this._normalizeStatus(element.dataset.status);
        this._label = element.dataset.label || null;
        this._tooltip = null;
        this._showOnStart = element.dataset.showOnStart === "true";
        this._hideOnFinish = element.dataset.hideOnFinish === "true";
        this._finished = false;

        // build the dot and its optional caption; the styling hook class is NOT
        // the registered selector, so a later DOM scan never re-instantiates the
        // control on the same host (see the traffic light regression)
        this._dot = document.createElement("span");
        this._dot.className = "wx-status-dot";
        this._dot.setAttribute("role", "img");

        this._caption = document.createElement("span");
        this._caption.className = "wx-status-task-label";

        element.innerHTML = "";
        element.removeAttribute("data-status");
        element.removeAttribute("data-label");
        element.removeAttribute("data-show-on-start");
        element.removeAttribute("data-hide-on-finish");
        element.classList.add("wx-status-task");
        element.appendChild(this._dot);
        element.appendChild(this._caption);

        this._render();

        // hide until the first server update for this task arrives when the host
        // opted into showOnStart
        if (this._taskId && this._showOnStart) {
            this._element.style.display = "none";
        }

        // subscribe to the same MessageQueue the progress bar uses; a static dot
        // (no task) needs no subscription
        this._queue = (typeof webexpress !== "undefined" && webexpress.webapp)
            ? webexpress.webapp.MessageQueue
            : null;
        this._onMessage = (payload) => this._handleMessage(payload);

        if (this._taskId && this._queue) {
            this._queue.register(this._onMessage);
        }
    }

    /**
     * Releases listeners. Called by frameworks that re-render the host.
     */
    destroy() {
        if (this._queue && this._onMessage) {
            this._queue.unregister(this._onMessage);
        }
    }

    /**
     * Gets the current status token.
     * @returns {string} One of the STATUSES tokens.
     */
    get value() {
        return this._status;
    }

    /**
     * Sets the status token and repaints the dot.
     * @param {string} status - The new status token.
     */
    set value(status) {
        this._status = this._normalizeStatus(status);
        this._render();
    }

    /**
     * Normalizes an incoming status to a known token.
     * @param {string} status - Raw status.
     * @returns {string} A known status token; unknown falls back to "none".
     */
    _normalizeStatus(status) {
        const token = (status == null ? "" : String(status)).trim().toLowerCase();
        return webexpress.webapp.StatusTaskCtrl.STATUSES.includes(token) ? token : "none";
    }

    /**
     * Paints the dot for the current status and syncs the caption and the
     * accessible name. The tooltip prefers an explicit server message over the
     * static caption, and falls back to the translated status name.
     */
    _render() {
        for (const status of webexpress.webapp.StatusTaskCtrl.STATUSES) {
            this._dot.classList.toggle("wx-status-dot-" + status, status === this._status);
        }

        const name = this._tooltip
            || this._label
            || this._i18n("webexpress.webapp:statustask." + this._status, this._status);

        this._caption.textContent = this._label || "";
        this._dot.setAttribute("aria-label", name);
        this._element.setAttribute("title", name);
    }

    /**
     * Filters and dispatches an incoming MessageQueue payload. Only updates
     * carrying the matching task id are applied, so this listener safely coexists
     * with every other MessageQueue consumer on the page.
     * @param {*} payload - The raw payload from the queue.
     */
    _handleMessage(payload) {
        if (!payload || typeof payload !== "object") {
            return;
        }
        if (payload.type !== webexpress.webapp.StatusTaskCtrl.UPDATE_TYPE) {
            return;
        }

        const taskId = (payload.taskId || "").toLowerCase();
        if (!taskId || taskId !== this._taskId) {
            return;
        }

        this._applyUpdate(payload);
    }

    /**
     * Applies a task update to the dot and dispatches the matching DOM events.
     * @param {{taskId:string,state:number,progress:number,message:string}} update
     */
    _applyUpdate(update) {
        const state = typeof update.state === "number"
            ? update.state
            : webexpress.webapp.StatusTaskCtrl.STATE_CREATED;

        // a server message wins over the translated status name as the tooltip,
        // but never becomes the visible caption of the compact dot
        this._tooltip = update.message || null;
        this.value = webexpress.webapp.StatusTaskCtrl.statusForState(state);

        // reveal on the first signal of activity when the host opted in
        if (this._showOnStart && this._element.style.display === "none") {
            this._element.style.display = "";
            this._element.classList.remove("d-none");
            this._dispatch(webexpress.webui.Event.SHOW_EVENT, { taskid: this._taskId });
        }

        if (state === webexpress.webapp.StatusTaskCtrl.STATE_FINISH
            || state === webexpress.webapp.StatusTaskCtrl.STATE_CANCELED) {
            if (this._hideOnFinish) {
                this._element.style.display = "none";
                this._dispatch(webexpress.webui.Event.HIDE_EVENT, { taskid: this._taskId });
            }
            if (!this._finished) {
                this._finished = true;
                this._dispatch(webexpress.webui.Event.TASK_FINISH_EVENT, { taskid: this._taskId });
            }
        } else {
            this._finished = false;
            this._dispatch(webexpress.webui.Event.TASK_UPDATE_EVENT, { taskid: this._taskId });
        }
    }
};

// register the class in the controller
webexpress.webui.Controller.registerClass("wx-webapp-status-task", webexpress.webapp.StatusTaskCtrl);
