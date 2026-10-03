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
 * With a "starter" wx-service island (a POST endpoint) the dot becomes a task
 * starter: it posts to the endpoint, the server starts the task and answers
 * with its id, and the dot then follows that id live. The start is triggered by
 * a click on the dot, or on load with data-auto-start. With data-repeat the dot
 * restarts the task through the same endpoint once it finishes successfully; a
 * cancel or an error ends the loop.
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

    // the name of the wx-service island that starts the task; a POST endpoint
    // that answers with the started task id
    static STARTER_SERVICE = "starter";

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
        this._autoStart = element.dataset.autoStart === "true";
        this._repeat = element.dataset.repeat === "true";
        this._finished = false;
        this._starting = false;

        // resolve the optional starter service before the host is cleared,
        // because fromElement consumes the wx-service island children and the
        // innerHTML reset below would otherwise drop them unread
        this._starter = (typeof webexpress !== "undefined" && webexpress.webapp && webexpress.webapp.ServiceRegistry)
            ? (webexpress.webapp.ServiceRegistry.fromElement(element)[webexpress.webapp.StatusTaskCtrl.STARTER_SERVICE] || null)
            : null;

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
        element.removeAttribute("data-auto-start");
        element.removeAttribute("data-repeat");
        element.classList.add("wx-status-task");
        element.appendChild(this._dot);
        element.appendChild(this._caption);

        // a starter dot is an actionable trigger: it starts the task on click or
        // on keyboard activation, so it reads and behaves as a button
        if (this._starter) {
            element.classList.add("wx-status-task-starter");
            element.setAttribute("role", "button");
            element.setAttribute("tabindex", "0");
            this._onClick = () => this.start();
            this._onKeydown = (e) => this._handleKeydown(e);
            element.addEventListener("click", this._onClick);
            element.addEventListener("keydown", this._onKeydown);
        }

        this._render();

        // hide until the first server update for this task arrives when the host
        // opted into showOnStart
        if (this._taskId && this._showOnStart) {
            this._element.style.display = "none";
        }

        // subscribe to the same MessageQueue the progress bar uses; a starter
        // subscribes too, because it will adopt a task id from the start response
        this._queue = (typeof webexpress !== "undefined" && webexpress.webapp)
            ? webexpress.webapp.MessageQueue
            : null;
        this._onMessage = (payload) => this._handleMessage(payload);

        if ((this._taskId || this._starter) && this._queue) {
            this._queue.register(this._onMessage);
        }

        // a starter that opted into auto start posts on load rather than on click
        if (this._starter && this._autoStart) {
            this.start();
        }
    }

    /**
     * Releases listeners. Called by frameworks that re-render the host.
     */
    destroy() {
        if (this._queue && this._onMessage) {
            this._queue.unregister(this._onMessage);
        }
        if (this._onClick) {
            this._element.removeEventListener("click", this._onClick);
        }
        if (this._onKeydown) {
            this._element.removeEventListener("keydown", this._onKeydown);
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
     * Starts the task through the starter service, then follows the started task.
     * A start posts to the endpoint, adopts the task id from the response so the
     * dot filters the live updates by it, and reflects the trigger immediately by
     * going pending. Overlapping starts are ignored, and a start without a
     * configured starter service is a no-op.
     * @returns {Promise<boolean>} Resolves true when the task was started.
     */
    start() {
        if (!this._starter || this._starting) {
            return Promise.resolve(false);
        }

        this._starting = true;
        this._finished = false;
        this._tooltip = null;
        // optimistic feedback: the dot goes pending the moment a start is
        // triggered, before the server pushes the first running update
        this.value = "pending";

        return this._starter.create().then((result) => {
            this._starting = false;

            if (!result || !result.ok) {
                this.value = "error";
                return false;
            }

            const taskId = this._taskIdFromResult(result.data);
            if (taskId) {
                this._taskId = String(taskId).toLowerCase();
            }

            return true;
        });
    }

    /**
     * Extracts the started task id from the start response. The endpoint may
     * answer with the plain id string or with an object carrying it under taskId
     * or id.
     * @param {*} data - The parsed start response.
     * @returns {string|null} The task id, or null when the response carries none.
     */
    _taskIdFromResult(data) {
        if (typeof data === "string") {
            return data;
        }
        if (data && typeof data === "object") {
            return data.taskId || data.id || null;
        }
        return null;
    }

    /**
     * Starts the task on Enter or Space, so the starter dot is operable by
     * keyboard as a button is.
     * @param {KeyboardEvent} e - The keydown event.
     */
    _handleKeydown(e) {
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
            e.preventDefault();
            this.start();
        }
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
     * accessible name. The caption is the live server message, so it follows the
     * current step the server reports; the tooltip falls back to the label and
     * then to the translated status name.
     */
    _render() {
        for (const status of webexpress.webapp.StatusTaskCtrl.STATUSES) {
            this._dot.classList.toggle("wx-status-dot-" + status, status === this._status);
        }

        // the caption is the server message; a task driven or starter dot shows
        // nothing until the server sends one, while a static dot (no task, no
        // starter) shows its configured label
        const caption = this._tooltip
            || ((this._taskId || this._starter) ? "" : (this._label || ""));

        // the tooltip and accessible name stay meaningful even without a caption:
        // the server message, else the label, else the translated status name
        const name = this._tooltip
            || this._label
            || this._i18n("webexpress.webapp:statustask." + this._status, this._status);

        this._caption.textContent = caption;
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

        // the server message drives both the caption and the tooltip of the dot,
        // so the visible label follows the current step the server reports
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

            // a successful finish restarts the task when repeat is on; a cancel
            // or an error ends the loop so a failing task never restarts forever
            if (state === webexpress.webapp.StatusTaskCtrl.STATE_FINISH && this._repeat && this._starter) {
                this.start();
            }
        } else {
            this._finished = false;
            this._dispatch(webexpress.webui.Event.TASK_UPDATE_EVENT, { taskid: this._taskId });
        }
    }
};

// register the class in the controller
webexpress.webui.Controller.registerClass("wx-webapp-status-task", webexpress.webapp.StatusTaskCtrl);
