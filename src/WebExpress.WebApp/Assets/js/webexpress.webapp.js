webexpress.webapp = webexpress.webapp || {};

/**
 * MessageQueue class for inter-control eventing and single-WebSocket communication.
 * All messages are sent and received through one (active) WebSocket connection.
 */
webexpress.webapp.MessageQueue = new class {
    /**
     * Initializes the listener list, message queue, WebSocket instance, and state information.
     */
    constructor() {
        this._listeners = [];
        this._queue = [];
        this._ws = null;
        this._queueMax = 100;
        this._status = "offline";
        this._lastError = null;

        // reconnect state
        this._shouldReconnect = true;
        this._reconnectDelay = 1000; // start with 1s
        this._reconnectMax = 15000;  // max 15s
    }

    /**
     * Registers a callback to receive incoming messages.
     * @param {function(string|Object):void} listener - The callback invoked for each received message.
     */
    register(listener) {
        if (typeof listener === "function" && this._listeners.indexOf(listener) === -1) {
            this._listeners.push(listener);
        }
    }

    /**
     * Unregisters a previously registered message listener.
     * @param {function(string|Object):void} listener - The callback to remove.
     */
    unregister(listener) {
        const idx = this._listeners.indexOf(listener);
        if (idx >= 0) {
            this._listeners.splice(idx, 1);
        }
    }

    /**
     * Opens a single WebSocket connection to the specified URL.
     * If a connection already exists, it is closed before a new one is opened.
     * @param {string} url - The WebSocket URL to connect to.
     * @param {Array<string>} domains - Domains for connection (optional).
     */
    connect(url, domains) {
        if (this._ws) {
            this._ws.close();
            this._ws = null;
        }
        this._wsUrl = url || this._wsUrl;
        if (!this._wsUrl) {
            this._status = "offline";
            this._lastError = "No WebSocket URL specified";
            return;
        }

        let finalUrl = this._wsUrl;

        if (Array.isArray(domains) && domains.length > 0) {
            const encoded = encodeURIComponent(domains.join(";"));

            // check if URL already has query parameters
            finalUrl += (finalUrl.includes("?") ? "&" : "?") + "domains=" + encoded;
        }

        this._setStatus("connecting");
        this._lastError = null;

        try {
            this._ws = new WebSocket(finalUrl, "wxmsg");
        } catch (e) {
            this._setStatus("error");
            this._lastError = e && e.message ? e.message : "WebSocket connection error";
            this._scheduleReconnect();
            return;
        }

        // event handlers for WebSocket lifecycle
        this._ws.addEventListener("open", (evt) => {
            this._setStatus("online");
            this._lastError = null;
        });

        this._ws.addEventListener("message", (evt) => {
            this._enqueue(evt.data);
            // parse as object if possible, otherwise pass as string
            let payload = evt.data;
            try {
                payload = JSON.parse(evt.data);
            } catch (err) {
                // keep as string if not valid JSON
            }
            for (let listener of this._listeners) {
                try {
                    listener(payload);
                } catch (err) {
                    // exceptions in listeners are ignored for robust broadcasting
                }
            }

            if (payload && typeof payload === "object" && payload.type === "update") {
                const updateEvent = new CustomEvent(webexpress.webapp.Event.UPDATE_EVENT, {
                    detail: { payload }
                });
                document.dispatchEvent(updateEvent);
            }
        });

        this._ws.addEventListener("close", (evt) => {
            this._setStatus("offline");
            if (this._shouldReconnect) {
                this._scheduleReconnect();
            }

        });

        this._ws.addEventListener("error", (evt) => {
            this._setStatus("error");
            this._lastError = evt && evt.message ? evt.message : "WebSocket connection failed";
            if (this._shouldReconnect) {
                this._scheduleReconnect();
            }
        });
    }

    /**
     * Closes the WebSocket connection and updates its status.
     */
    disconnect() {
        this._shouldReconnect = false;
        if (this._ws) {
            this._ws.close();
            this._ws = null;
            this._setStatus("offline");
        }
    }

    /**
     * Schedules an automatic WebSocket reconnect attempt using an exponential
     * backoff strategy. The reconnect is only performed if automatic reconnects
     * are enabled via `_shouldReconnect`.
     */
    _scheduleReconnect() {
        if (!this._shouldReconnect) return;

        //const delay = this._reconnectDelay;
        //console.info(`WebSocket reconnect in ${delay}ms...`);

        //setTimeout(() => {
        //    this.connect();
        //}, delay);

        // exponential backoff
        //this._reconnectDelay = Math.min(this._reconnectDelay * 2, this._reconnectMax);
    }


    /**
     * Sends a message through the active WebSocket connection.
     * Objects are serialized to JSON automatically.
     * @param {string|Object} message - The message to send.
     */
    send(message) {
        if (this._ws && this._ws.readyState === WebSocket.OPEN) {
            if (typeof message === "object") {
                this._ws.send(JSON.stringify(message));
            } else {
                this._ws.send(message);
            }
        }
    }

    /**
     * Returns an array copy of recent messages held in the FIFO queue.
     * @returns {Array} Shallow copy of the current message queue.
     */
    getMessages() {
        return this._queue.slice();
    }

    /**
     * Removes all registered message listeners.
     */
    clearListeners() {
        this._listeners = [];
    }

    /**
     * Adds a message to the queue and removes the oldest entry if the maximum queue size is exceeded.
     * @param {string} msg - The message to enqueue.
     * @private
     */
    _enqueue(msg) {
        this._queue.push(msg);
        while (this._queue.length > this._queueMax) {
            this._queue.shift();
        }
    }

    /**
     * Returns the current connection status ("offline", "connecting", "online", "error").
     * @returns {string}
     */
    get status() {
        return this._status;
    }
    
    /**
     * Sets the status, compares with previous value, and dispatches an event on change.
     * @param {string} value - The new status value.
     * @private
     */
    _setStatus(value) {
        if (this._status !== value) {
            this._status = value;
            // dispatch a custom event with status and last error information
            const event = new CustomEvent(webexpress.webapp.Event.CHANGE_STATUS_EVENT, {
                detail: {
                    status: this._status,
                    lastError: this._lastError
                }
            });
            document.dispatchEvent(event);
        }
    }

    /**
     * Returns the last connection error message, if any.
     * @returns {string|null}
     */
    get lastError() {
        return this._lastError;
    }
};

/**
 * A utility class for defining and managing event names within the WebExpress UI framework.
 */
webexpress.webapp.Event = class {
    // Event triggered when the status of the MessageQueue changes
    static CHANGE_STATUS_EVENT = "webexpress.webapp.change.status";
    // Event triggered when UI components require a general update
    static UPDATE_EVENT = "webexpress.webapp.update";
}
    
// initialize the WebSocket connection after the DOM is fully loaded    
document.addEventListener("DOMContentLoaded", function () {  

    // get the URL from the data attribute
    const mqElement = document.getElementById("webepress-webapp-message-queue");
    const uri = mqElement ? mqElement.dataset.wxMessageQueueUrl : null;
    const raw = mqElement?.dataset.wxDomains ?? null;
    const domains = raw
        ? raw.split(";").map(x => x.trim()).filter(x => x.length > 0)
        : [];

    if (uri) {
        webexpress.webapp.MessageQueue.connect(uri, domains);
    }
});