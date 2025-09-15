/**
 * Progress bar of a task (WebTask).
 * The following events are triggered:
 * - webexpress.webui.Event.TASK_UPDATE_EVENT
 * - webexpress.webui.Event.TASK_FINISH_EVENT
 * - webexpress.webui.Event.HIDE_EVENT
 * - webexpress.webui.Event.SHOW_EVENT
 */
webexpress.webapp.ProgressTaskCtrl = class extends webexpress.webui.Ctrl {

    /**
     * Constructor
     * @param {HTMLElement} element - The DOM element associated with the modal control.
     */
    constructor(element) {
        super(element);

        this._element = element;
        this._intervalTime = parseInt(element.dataset.interval) || 2500;
        this._restUri = element.dataset.uri || "";
        this._taskId = element.dataset.task || "";
        this._size = element.dataset.size || null;
        this._showOnStart = element.dataset.showOnStart === "true";
        this._hideOnFinish = element.dataset.hideOnFinish === "true";
        this._interval = null;

        // create progress bar
        this._progressBar = document.createElement("div");
        this._progressBar.className = "progress";
        this._progressInner = document.createElement("div");
        this._progressInner.setAttribute("role", "progressbar");
        this._progressInner.style.width = "0%";
        this._progressInner.setAttribute("aria-valuenow", "0");
        this._progressInner.setAttribute("aria-valuemin", "0");
        this._progressInner.setAttribute("aria-valuemax", "100");
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

        // start polling
        this._interval = setInterval(() => this.receiveData(), this._intervalTime);
        this.receiveData();
    }

    /**
     * Retrieve data from rest api.
     */
    receiveData() {
        const uri = this._restUri.endsWith("/")
            ? this._restUri + this._taskId
            : this._restUri + "/" + this._taskId;

        fetch(uri)
            .then(response => {
                if (response.status === 200) {
                    return response.json();
                }

                // 404: Task not found, hide element
                if (response.status === 404) {
                    if (this._hideOnFinish) {
                        this._element.style.display = "none";
                        this._dispatch(webexpress.webui.Event.HIDE_EVENT, { taskid: this._taskId });
                    }
                    return null;
                }

                // other unexpected status codes
                this._message.innerHTML = `
                    <p class="text-danger">
                        Unexpected status code: ${response.status}
                    </p>
                `;

                return null;
            })
            .then(data => {
                if (!data) return; // not 200

                const progress = Math.min(Math.max(data.progress ?? 0, 0), 100);
                const type = data.tpe ?? "bg-primary";
                const message = data.message ?? "";

                this._progressInner.style.width = `${progress}%`;
                this._progressInner.className = `progress-bar progress-bar-striped progress-bar-animated ${type}`;
                if (this._size) {
                    this._progressInner.classList.add(this._size);
                }

                this._message.innerHTML = message;

                // show element when progress > 0
                if (progress > 0 && this._showOnStart) {
                    this._element.style.display = "";
                    this._element.classList.remove("d-none");
                    this._dispatch(webexpress.webui.Event.SHOW_EVENT, { taskid: this._taskId });
                }

                // hide element when task is finished
                if (data.state === 3 && this._hideOnFinish) {
                    this._element.style.display = "none";
                    this._dispatch(webexpress.webui.Event.HIDE_EVENT, { taskid: this._taskId });
                }

                if (data.state === 3) {
                    clearInterval(this._interval);
                    this._dispatch(webexpress.webui.Event.TASK_FINISH_EVENT, { taskid: this._taskId });
                } else {
                    this._dispatch(webexpress.webui.Event.TASK_UPDATE_EVENT, { taskid: this._taskId });
                }
            })
            .catch(error => {
                console.error("The request could not be completed successfully:", error);
            });
    }
}

// Register the class in the controller
webexpress.webui.Controller.registerClass("wx-webapp-progress-task", webexpress.webapp.ProgressTaskCtrl);