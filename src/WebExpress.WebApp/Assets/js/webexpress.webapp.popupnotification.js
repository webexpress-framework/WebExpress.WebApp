/**
 * Control for displaying popup notifications.
 * The following events are triggered:
 * - webexpress.webui.Event.HIDE_EVENT with parameter id.
 */
class PopupNotificationCtrl extends webexpress.webui.Ctrl {
    _interval = null;
    _restUri = null;
    _activeNotifications = new Map();

    /**
    * Constructor
    * @param {HTMLElement} element - The DOM element associated with the move control.
    */
    constructor(element) {
        super(element);

        // initialize structure and parse existing data
        this._interval = element.dataset.interval ? parseInt(element.dataset.interval) : 10000;
        this._restUri = element.dataset.uri || null;

        setInterval(() => {
            this.receiveData();
        }, this._interval);

        this.receiveData();

        // clean up the DOM
        element.innerHTML = '';
        element.removeAttribute('data-interval');
        element.removeAttribute('data-uri');
        element.classList.add('wx-popupnotification');
        this._element = element;
    }

    /**
     * Retrieve data from rest api.
     */
    receiveData() {
        let interval = null;

        function percents(created, durability) {
            let till = created.valueOf() + durability;
            let now = new Date().valueOf();
            let p = Math.round((till - now) * 100 / durability);
            p = Math.min(Math.max(p, 0), 100);
            return p;
        }

        const updateProgress = (progress, created, durability, data) => {
            if (progress >= 0 && progress < 100) {
                data.progressbar.style.width = progress + "%";
            } else if (durability > 0) {
                data.progressbar.style.width = percents(new Date(created), durability) + "%";
                interval = setInterval(() => {
                    let p = percents(new Date(created), durability);
                    data.progressbar.style.width = p + "%";
                    if (p <= 0) {
                        data.alert.dispatchEvent(new CustomEvent('close'));
                        this._activeNotifications.delete(data.id);
                        clearInterval(interval);
                        this._dispatch(webexpress.webui.Event.HIDE_EVENT, { message: data.id });
                    }
                }, 333);
            }
        };

        fetch(this._restUri, { method: "GET", headers: { 'Accept': 'application/json' } })
            .then(response => {
                // check if response is ok before parsing
                if (!response.ok) {
                    throw new Error(`http error: ${response.status}`);
                }

                // check if response has content
                if (response.headers.get('content-length') === '0') {
                    return null; // handle empty response
                }

                // attempt to parse json with error handling
                return response.json().catch(err => {
                    console.error('json parsing failed:', err);
                    throw new Error('invalid json response');
                });
            })
            .then(data => {
                // early return if data is null or not an array
                if (data === null || !Array.isArray(data)) {
                    return;
                }

                let newnotifications = data.filter(notification => !this._activeNotifications.has(notification.id));
                newnotifications.forEach(notification => {
                    let id = notification.id ?? "notification" + new Date().valueOf();
                    let created = notification.created ?? new Date().toString();
                    let durability = notification.durability ?? -1;
                    let progress = notification.progress ?? -1;
                    let type = notification.type ?? "alert-primary";

                    let heading = document.createElement("h5");
                    heading.textContent = notification.heading ?? "";
                    let icon;
                    if (notification.icon != null) {
                        icon = document.createElement("img");
                        icon.src = notification.icon;
                        icon.alt = notification.heading ?? "";
                    } else {
                        icon = document.createElement("div");
                    }
                    let message = document.createElement("div");
                    message.innerHTML = notification.message ?? "";

                    let progressbar = document.createElement("div");
                    progressbar.className = "progress-bar progress-bar-striped bg-info";
                    progressbar.role = "progressbar";
                    progressbar.setAttribute("aria-valuenow", "100");
                    progressbar.setAttribute("aria-valuemin", "0");
                    progressbar.setAttribute("aria-valuemax", "100");
                    progressbar.style.width = (progress >= 0 && progress < 100 ? 0 : percents(new Date(created), durability)) + "%";

                    let alert = document.createElement("div");
                    alert.className = `alert ${type} alert-dismissible fade show`;
                    alert.role = "alert";

                    let button = document.createElement("button");
                    button.type = "button";
                    button.className = "btn-close";
                    button.setAttribute("data-bs-dismiss", "alert");
                    button.setAttribute("aria-label", "Close");

                    let content = document.createElement("div");
                    content.className = "d-flex justify-content-start";
                    content.appendChild(icon);
                    content.appendChild(message);

                    button.addEventListener("click", () => {
                        this._activeNotifications.delete(id);
                        clearInterval(interval);
                        fetch(this._restUri + "/" + id, { method: "DELETE", headers: { 'Accept': 'application/json' } });
                        this._dispatch(webexpress.webui.Event.HIDE_EVENT, { message: id });
                    });

                    alert.appendChild(button);
                    alert.appendChild(heading);
                    alert.appendChild(content);
                    if (progress >= 0 || durability >= 0) {
                        let progressContainer = document.createElement("div");
                        progressContainer.className = "progress mt-2";
                        progressContainer.appendChild(progressbar);
                        alert.appendChild(progressContainer);
                    }

                    this._element.appendChild(alert);

                    if (!this._activeNotifications.has(id)) {
                        let dataObj = {
                            id: id,
                            type: type,
                            heading: heading,
                            icon: icon,
                            message: message,
                            progressbar: progressbar,
                            content: content,
                            alert: alert,
                            notification: notification
                        };

                        this._activeNotifications.set(id, dataObj);
                        updateProgress(progress, created, durability, dataObj);
                    }
                });

                let oldnotifications = data.filter(notification => this._activeNotifications.has(notification.id));
                oldnotifications.forEach(notification => {
                    let id = notification.id ?? "notification" + new Date().valueOf();
                    let dataObj = this._activeNotifications.get(id);

                    if ((notification.type ?? "alert-primary") !== (dataObj.notification.type ?? "alert-primary")) {
                        dataObj.alert.classList.remove(dataObj.notification.type ?? "alert-primary");
                        dataObj.alert.classList.add(notification.type ?? "alert-primary");
                    }
                    if (notification.heading !== dataObj.notification.heading) {
                        dataObj.heading.textContent = notification.heading ?? "";
                    }
                    if (notification.message !== dataObj.notification.message) {
                        dataObj.message.innerHTML = notification.message ?? "";
                    }
                    if (notification.progress !== dataObj.notification.progress) {
                        dataObj.progressbar.style.width = notification.progress + "%";
                        if (notification.progress >= 100) {
                            updateProgress(notification.progress ?? -1, notification.created ?? new Date().toString(), notification.durability ?? -1, dataObj);
                        }
                    }
                    if (notification.icon !== dataObj.notification.icon) {
                        if (dataObj.content.querySelector("img")) {
                            dataObj.content.removeChild(dataObj.content.querySelector("img"));
                        }
                        if (notification.icon != null) {
                            let newIcon = document.createElement("img");
                            newIcon.src = notification.icon;
                            newIcon.alt = notification.heading ?? "";
                            dataObj.icon = newIcon;
                        } else {
                            dataObj.icon = document.createElement("div");
                        }
                        dataObj.content.insertBefore(dataObj.icon, dataObj.content.firstChild);
                    }
                    dataObj.notification = notification;
                });
            });
    }
}

// Register the class in the controller
webexpress.webui.Controller.registerClass("wx-webapp-popupnotification", PopupNotificationCtrl);