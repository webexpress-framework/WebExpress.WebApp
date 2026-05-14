/**
 * Progress bar of a task (WebTask).
 *
 * Receives live updates over the MessageQueue WebSocket
 * (see WebExpress.WebApp.WebMessageQueue.ProgressTaskDispatcher) instead of
 * polling the REST endpoint. The server pushes start, progress, message and
 * finish events through the same channel that already serves popups and
 * collaboration messages, and replays the current state of every active
 * task whenever a client (re)connects — so progress is preserved across
 * page navigation, transient disconnects and full reconnects.
 *
 * Dispatched events (unchanged for backwards compatibility):
 * - webexpress.webui.Event.TASK_UPDATE_EVENT
 * - webexpress.webui.Event.TASK_FINISH_EVENT
 * - webexpress.webui.Event.HIDE_EVENT
 * - webexpress.webui.Event.SHOW_EVENT
 */
webexpress.webapp.ProgressTaskCtrl = class extends webexpress.webui.Ctrl {
    static UPDATE_TYPE = "webexpress.webapp.progresstask.update";

    // mirrors WebExpress.WebCore.WebTask.TaskState
    static STATE_CREATED = 0;
    static STATE_RUN = 1;
    static STATE_CANCELED = 2;
    static STATE_FINISH = 3;

    /**
     * Constructor.
     * @param {HTMLElement} element - The DOM element associated with the control.
     */
    constructor(element) {
        super(element);

        this._element = element;
        this._taskId = (element.dataset.task || "").toLowerCase();
        this._size = element.dataset.size || null;
        this._showOnStart = element.dataset.showOnStart === "true";
        this._hideOnFinish = element.dataset.hideOnFinish === "true";
        this._finished = false;

        // create progress bar
        this._progressBar = document.createElement("div");
        this._progressBar.className = "progress";

        this._progressInner = document.createElement("div");
        this._progressInner.setAttribute("role", "progressbar");
        this._progressInner.style.width = "0%";
        this._progressInner.setAttribute("aria-valuenow", "0");
        this._progressInner.setAttribute("aria-valuemin", "0");
        this._progressInner.setAttribute("aria-valuemax", "100");
        this._progressInner.className = "progress-bar progress-bar-striped progress-bar-animated bg-primary";
        if (this._size) {
            this._progressInner.classList.add(this._size);
        }
        this._progressBar.appendChild(this._progressInner);

        // create message element
        this._message = document.createElement("div");
        this._message.className = "text-secondary";

        // cleanup and setup DOM
        element.innerHTML = "";
        element.removeAttribute("data-interval");
        element.removeAttribute("data-uri");
        element.removeAttribute("data-size");
        element.removeAttribute("data-show-on-start");
        element.removeAttribute("data-hide-on-finish");
        element.classList.add("wx-taskprogressbar");
        element.appendChild(this._progressBar);
        element.appendChild(this._message);

        // hide until the first server update for this task arrives if the
        // host opted into showOnStart
        if (this._showOnStart) {
            this._element.style.display = "none";
        }

        // wire up to the singleton MessageQueue — there is no REST polling
        // anymore, every update arrives through the existing WebSocket
        this._queue = (typeof webexpress !== "undefined" && webexpress.webapp)
            ? webexpress.webapp.MessageQueue
            : null;

        this._onMessage = (payload) => this._handleMessage(payload);

        if (this._queue) {
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
     * Filters and dispatches an incoming MessageQueue payload. Only updates
     * carrying the matching task id are applied; everything else is
     * ignored so this listener can safely coexist with every other
     * MessageQueue consumer on the page.
     * @param {*} payload - The raw payload from the queue.
     */
    _handleMessage(payload) {
        if (!payload || typeof payload !== "object") {
            return;
        }
        if (payload.type !== webexpress.webapp.ProgressTaskCtrl.UPDATE_TYPE) {
            return;
        }

        const taskId = (payload.taskId || "").toLowerCase();
        if (!taskId || taskId !== this._taskId) {
            return;
        }

        this._applyUpdate(payload);
    }

    /**
     * Applies a progress update to the visible UI and dispatches the
     * matching custom DOM events.
     * @param {{taskId:string,state:number,progress:number,message:string}} update
     */
    _applyUpdate(update) {
        const progress = Math.min(Math.max(update.progress ?? 0, 0), 100);
        const state = typeof update.state === "number" ? update.state : webexpress.webapp.ProgressTaskCtrl.STATE_CREATED;
        const message = update.message ?? "";

        this._progressInner.style.width = progress + "%";
        this._progressInner.setAttribute("aria-valuenow", String(progress));
        this._message.innerHTML = message;

        // show element on first signal of activity
        if (progress > 0 && this._showOnStart) {
            this._element.style.display = "";
            this._element.classList.remove("d-none");
            this._dispatch(webexpress.webui.Event.SHOW_EVENT, { taskid: this._taskId });
        }

        if (state === webexpress.webapp.ProgressTaskCtrl.STATE_FINISH
            || state === webexpress.webapp.ProgressTaskCtrl.STATE_CANCELED) {
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
}

// register the class in the controller
webexpress.webui.Controller.registerClass("wx-webapp-progress-task", webexpress.webapp.ProgressTaskCtrl);
