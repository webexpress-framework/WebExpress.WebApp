/**
 * Control for displaying popup notifications.
 *
 * Notifications are delivered as regular MessageQueue messages from the
 * server (see WebExpress.WebApp.WebMessageQueue.PopupNotificationDispatcher).
 * This replaces the previous REST polling against
 * WebExpress.WebApp.WWW.Api._1.PopupNotification: there is no HTTP roundtrip
 * to ask for new notifications anymore - the server pushes them over the
 * existing WebSocket and replays every still-valid notification when the
 * client (re)connects.
 *
 * The control keeps each received notification visible until the user
 * dismisses it or the configured durability elapses. Dismissals are
 * forwarded to the server through the same WebSocket channel as a
 * "webexpress.webapp.popup.dismiss" message so they are not replayed on
 * subsequent reconnects.
 *
 * Dispatched custom events:
 * - webexpress.webui.Event.HIDE_EVENT with the notification id when the
 *   alert is closed or expires.
 */
class PopupNotificationCtrl extends webexpress.webui.Ctrl {
    static SHOW_TYPE = "webexpress.webapp.popup.show";
    static DISMISS_TYPE = "webexpress.webapp.popup.dismiss";

    _activeNotifications = new Map();

    /**
     * Constructor.
     * @param {HTMLElement} element - The DOM element associated with the control.
     */
    constructor(element) {
        super(element);

        // clean up the host element so it can host the alert stack
        element.innerHTML = "";
        element.removeAttribute("data-interval");
        element.removeAttribute("data-uri");
        element.classList.add("wx-popupnotification");
        this._element = element;

        // wire up to the singleton MessageQueue
        this._queue = (typeof webexpress !== "undefined" && webexpress.webapp)
            ? webexpress.webapp.MessageQueue
            : null;

        this._onMessage = (payload) => this._handleMessage(payload);

        if (this._queue) {
            this._queue.register(this._onMessage);
        }
    }

    /**
     * Tears down the listener so the control no longer reacts to incoming
     * messages. Called by frameworks that re-render the host element.
     */
    destroy() {
        if (this._queue && this._onMessage) {
            this._queue.unregister(this._onMessage);
        }
        // clear any pending expiry timers
        for (const data of this._activeNotifications.values()) {
            if (data.expiryTimer) {
                clearInterval(data.expiryTimer);
            }
        }
        this._activeNotifications.clear();
    }

    /**
     * Routes incoming MessageQueue payloads to the popup handlers. Anything
     * that does not look like a popup message is ignored.
     * @param {*} payload - The raw message payload received from the queue.
     */
    _handleMessage(payload) {
        if (!payload || typeof payload !== "object") {
            return;
        }

        if (payload.type === PopupNotificationCtrl.SHOW_TYPE && payload.notification) {
            this._showNotification(payload.notification);
        }
    }

    /**
     * Renders a notification or, if the same id is already on screen,
     * updates the visible alert with the latest properties. The dedupe by
     * id makes server replays after reconnect/page navigation idempotent.
     * @param {Object} notification - The notification payload.
     */
    _showNotification(notification) {
        if (!notification || !notification.id) {
            return;
        }

        if (this._activeNotifications.has(notification.id)) {
            this._updateNotification(notification);
            return;
        }

        const id = notification.id;
        // anchor the visual countdown on the local arrival timestamp so the
        // countdown is independent of any server clock or timezone parsing.
        const arrivedAt = Date.now();
        const durability = typeof notification.durability === "number" ? notification.durability : -1;
        const progress = typeof notification.progress === "number" ? notification.progress : -1;
        const typeClass = notification.type || "alert-primary";

        const alert = document.createElement("div");
        // intentionally no "alert-dismissible" / "data-bs-dismiss" so Bootstrap
        // never gets a chance to remove the element on its own - every
        // lifecycle decision is owned by this control.
        alert.className = "alert wx-popup-alert " + typeClass + " fade show";
        alert.setAttribute("role", "alert");
        alert.dataset.notificationId = id;

        // close button — Font Awesome "times" icon, anchored top-right via
        // the wx-popup-close CSS class
        const closeButton = document.createElement("button");
        closeButton.type = "button";
        closeButton.className = "wx-popup-close";
        closeButton.setAttribute("aria-label", "Close");
        closeButton.setAttribute("title", "Close");
        closeButton.innerHTML = '<i class="fas fa-times" aria-hidden="true"></i>';
        closeButton.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            this._dismiss(id);
        });
        alert.appendChild(closeButton);

        const heading = document.createElement("h5");
        heading.className = "wx-popup-heading";
        heading.textContent = notification.heading || "";
        alert.appendChild(heading);

        const content = document.createElement("div");
        content.className = "wx-popup-content d-flex justify-content-start";

        let icon;
        if (notification.icon) {
            icon = document.createElement("img");
            icon.src = notification.icon;
            icon.alt = notification.heading || "";
            icon.className = "wx-popup-icon";
        } else {
            icon = document.createElement("div");
            icon.className = "wx-popup-icon wx-popup-icon-empty";
        }
        content.appendChild(icon);

        const message = document.createElement("div");
        message.className = "wx-popup-message";
        message.innerHTML = notification.message || "";
        content.appendChild(message);

        alert.appendChild(content);

        let progressbar = null;
        if (durability > 0 || (progress >= 0 && progress < 100)) {
            const progressContainer = document.createElement("div");
            progressContainer.className = "progress mt-2";

            progressbar = document.createElement("div");
            progressbar.className = "progress-bar progress-bar-striped bg-info";
            progressbar.setAttribute("role", "progressbar");
            progressbar.setAttribute("aria-valuemin", "0");
            progressbar.setAttribute("aria-valuemax", "100");
            progressbar.style.width = progress >= 0 && progress < 100
                ? progress + "%"
                : "100%";

            progressContainer.appendChild(progressbar);
            alert.appendChild(progressContainer);
        }

        this._element.appendChild(alert);

        const data = {
            id,
            typeClass,
            heading,
            icon,
            message,
            progressbar,
            content,
            alert,
            notification,
            durability,
            arrivedAt,
            expiryTimer: null
        };

        this._activeNotifications.set(id, data);

        this._startExpiryTimer(data, progress);
    }

    /**
     * Applies fresh values onto an alert that is already on screen. Used
     * when the server replays the notification (same id) with updated
     * progress or content.
     * @param {Object} notification - The fresh notification payload.
     */
    _updateNotification(notification) {
        const id = notification.id;
        const data = this._activeNotifications.get(id);
        if (!data) {
            return;
        }

        const previous = data.notification || {};
        const previousType = previous.type || "alert-primary";
        const nextType = notification.type || "alert-primary";

        if (nextType !== previousType) {
            data.alert.classList.remove(previousType);
            data.alert.classList.add(nextType);
            data.typeClass = nextType;
        }
        if (notification.heading !== previous.heading) {
            data.heading.textContent = notification.heading || "";
        }
        if (notification.message !== previous.message) {
            data.message.innerHTML = notification.message || "";
        }
        if (typeof notification.progress === "number"
            && notification.progress !== previous.progress
            && data.progressbar) {
            data.progressbar.style.width = notification.progress + "%";
        }

        data.notification = notification;
    }

    /**
     * Computes the remaining lifetime of a notification expressed as a
     * percentage from 0 to 100. The lifetime is anchored on the arrival
     * timestamp so it is independent of the server clock.
     */
    _percentRemaining(arrivedAtMs, durability) {
        if (durability <= 0) {
            return 100;
        }
        const till = arrivedAtMs + durability;
        const remaining = till - Date.now();
        const p = Math.round(remaining * 100 / durability);
        return Math.min(Math.max(p, 0), 100);
    }

    /**
     * Starts the visual expiry timer that shrinks the progress bar and
     * eventually removes the alert when its durability runs out.
     */
    _startExpiryTimer(data, progress) {
        if (progress >= 0 && progress < 100) {
            // server-driven progress; no automatic local expiry
            return;
        }
        if (!data.durability || data.durability <= 0) {
            // persistent notification - no timer at all
            return;
        }

        data.expiryTimer = setInterval(() => {
            const p = this._percentRemaining(data.arrivedAt, data.durability);
            if (data.progressbar) {
                data.progressbar.style.width = p + "%";
            }
            if (p <= 0) {
                this._expire(data.id);
            }
        }, 250);
    }

    /**
     * Removes a notification because its durability has elapsed locally.
     * The server expires its copy independently.
     */
    _expire(id) {
        const data = this._activeNotifications.get(id);
        if (!data) {
            return;
        }
        if (data.expiryTimer) {
            clearInterval(data.expiryTimer);
            data.expiryTimer = null;
        }

        this._animateOutAndRemove(data, () => {
            this._activeNotifications.delete(id);
            this._dispatch(webexpress.webui.Event.HIDE_EVENT, { message: id });
        });
    }

    /**
     * The user clicked the close button. Remove the alert locally and tell
     * the server to drop the notification so it is not replayed after a
     * reconnect or page navigation.
     */
    _dismiss(id) {
        const data = this._activeNotifications.get(id);
        if (!data) {
            return;
        }
        if (data.expiryTimer) {
            clearInterval(data.expiryTimer);
            data.expiryTimer = null;
        }

        if (this._queue) {
            this._queue.send({
                type: PopupNotificationCtrl.DISMISS_TYPE,
                notificationId: id
            });
        }

        this._animateOutAndRemove(data, () => {
            this._activeNotifications.delete(id);
            this._dispatch(webexpress.webui.Event.HIDE_EVENT, { message: id });
        });
    }

    /**
     * Adds the CSS hide-class to the alert, waits for the fade-out
     * animation to finish (or a safety timeout to elapse) and then
     * detaches the element from the DOM. The completion callback runs
     * after the element is removed so callers can finalize their state
     * (state-map cleanup, HIDE_EVENT, …).
     * @param {Object} data - The internal notification state.
     * @param {Function} done - Invoked after the node has been removed.
     */
    _animateOutAndRemove(data, done) {
        if (!data || !data.alert) {
            if (typeof done === "function") {
                done();
            }
            return;
        }

        const alert = data.alert;

        // already hiding — let the in-flight animation finish
        if (alert.classList.contains("wx-popup-hiding")) {
            return;
        }

        const finalize = () => {
            if (alert.parentNode) {
                alert.parentNode.removeChild(alert);
            }
            if (typeof done === "function") {
                done();
            }
        };

        // freeze the current height to allow max-height to animate down
        // smoothly even though "auto" is not animatable
        const measured = alert.getBoundingClientRect().height;
        if (measured > 0) {
            alert.style.maxHeight = measured + "px";
        }

        let removed = false;
        const onEnd = () => {
            if (removed) {
                return;
            }
            removed = true;
            alert.removeEventListener("animationend", onEnd);
            alert.removeEventListener("animationcancel", onEnd);
            finalize();
        };

        alert.addEventListener("animationend", onEnd);
        alert.addEventListener("animationcancel", onEnd);

        // fallback: detach unconditionally after a generous timeout so the
        // node never leaks if animationend fails to fire (e.g. the element
        // was hidden / display:none, prefers-reduced-motion skipped it, …)
        setTimeout(onEnd, 600);

        // trigger the keyframes
        alert.classList.add("wx-popup-hiding");
    }
}

// register the class in the controller
webexpress.webui.Controller.registerClass("wx-webapp-popupnotification", PopupNotificationCtrl);
