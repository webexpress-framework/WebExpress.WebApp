/**
 * Control to display the current WebSocket connection status.
 * Shows the status of webexpress.webapp.MessageQueue visually as an LED and text.
 * The status indicator updates immediately when the state of the
 * connection changes (offline, connecting, online, error) by listening for status events.
 *
 * Usage:
 * <div class="wx-webapp-message-queue-status"></div>
 *
 * Requires: webexpress.webapp.MessageQueue (automatically referenced)
 */
webexpress.webapp.MessageQueueStatusCtrl = class extends webexpress.webui.Ctrl {
    /**
     * Constructor
     * @param {HTMLElement} element - The associated DOM element.
     */
    constructor(element) {
        super(element);

        // reference to global MessageQueue instance
        this._queue = webexpress.webapp.MessageQueue;
        this._element = element;
        this._lastStatus = null;

        // add base CSS classes for indicator
        this._element.classList.add("wx-message-queue-status");

        // initial render
        this.update();

        // listen for status events from MessageQueue and update immediately
        document.addEventListener(webexpress.webapp.Event.CHANGE_STATUS_EVENT, (e) => {
            const { status, lastError } = e.detail;
            this.update(status, lastError);
        });
    }

    /**
     * Updates the control's UI.
     * If a status change is detected, the display is updated.
     * @param {string} [status]
     * @param {string|null} [lastError]
     */
    update(status, lastError) {
        // get status and lastError from arguments or fall back to queue
        status = status || this._queue.status;
        lastError = lastError !== undefined ? lastError : this._queue.lastError;
        if (status === this._lastStatus && !lastError) {
            return;
        }
        this._lastStatus = status;

        // clear DOM
        this._element.innerHTML = "";

        // create LED style status indicator
        const statusLight = document.createElement("span");
                
        let color, label;
        switch (status) {
            case "online": {
                color = "bg-success";
                label = this._i18n("webexpress.webapp:status.online", "Online");
                break;
            }
            case "connecting": {
                color = "bg-warning";
                label = this._i18n("webexpress.webapp:status.connecting", "Connecting");
                break;
            }
            case "error": {
                color = "bg-danger";
                label = this._i18n("webexpress.webapp:status.error", "Error");
                break;
            }
            default: {
                color = "bg-secondary";
                label = this._i18n("webexpress.webapp:status.offline", "Offline");
                break;
            }
        }
        
        statusLight.className = `status-light ${color}`;

        // status text output
        const statusText = document.createElement("span");
        statusText.className = "status-text";
        statusText.style.fontWeight = status === "error" ? "bold" : "";
        statusText.textContent = (status === "error" && lastError) ? `Error: ${lastError}` : label;

        // append elements
        this._element.appendChild(statusLight);
        this._element.appendChild(statusText);
    }

    /**
     * Cleanup when removing the control.
     */
    disconnect() {
        // nothing to clean up since no periodic timer is used anymore
    }
};

// register the control with the controller
webexpress.webui.Controller.registerClass("wx-webapp-message-queue-status", webexpress.webapp.MessageQueueStatusCtrl);