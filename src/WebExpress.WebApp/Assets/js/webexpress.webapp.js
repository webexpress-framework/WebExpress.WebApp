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
        this._reconnectDelayInitial = 1000; // start with 1s
        this._reconnectDelay = this._reconnectDelayInitial;
        this._reconnectMax = 15000;  // max 15s
        this._reconnectTimer = null;

        // remembered for automatic reconnect attempts
        this._wsUrl = null;
        this._domains = null;

        // domains subscribed at runtime (by ViewStates); re-announced
        // after every reconnect because the server keeps them per connection
        this._subscribedDomains = new Set();
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
        if (Array.isArray(domains)) {
            // first explicit call wins; reconnects reuse the stored domains
            this._domains = domains;
        }
        if (!this._wsUrl) {
            this._status = "offline";
            this._lastError = "No WebSocket URL specified";
            return;
        }

        // a manual connect cancels any pending reconnect timer
        if (this._reconnectTimer) {
            clearTimeout(this._reconnectTimer);
            this._reconnectTimer = null;
        }

        let finalUrl = this._wsUrl;

        if (Array.isArray(this._domains) && this._domains.length > 0) {
            const encoded = encodeURIComponent(this._domains.join(";"));

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
            // reset backoff so the next disconnect starts the staircase over
            this._reconnectDelay = this._reconnectDelayInitial;
            this._sendDomainSubscription();
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

            if (payload && typeof payload === "object" && payload.type === "webexpress.webapp.data.changed") {
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
        if (this._reconnectTimer) {
            clearTimeout(this._reconnectTimer);
            this._reconnectTimer = null;
        }
        if (this._ws) {
            this._ws.close();
            this._ws = null;
            this._setStatus("offline");
        }
    }

    /**
     * Schedules an automatic WebSocket reconnect attempt using an exponential
     * backoff strategy. The reconnect is only performed if automatic reconnects
     * are enabled via `_shouldReconnect`. Once a connection succeeds the
     * backoff resets to its initial value (see `open` handler).
     */
    _scheduleReconnect() {
        if (!this._shouldReconnect) {
            return;
        }

        // an already scheduled reconnect should not be queued twice
        if (this._reconnectTimer) {
            return;
        }

        const delay = this._reconnectDelay;

        this._reconnectTimer = setTimeout(() => {
            this._reconnectTimer = null;
            this.connect(this._wsUrl);
        }, delay);

        // exponential backoff, capped at _reconnectMax
        this._reconnectDelay = Math.min(this._reconnectDelay * 2, this._reconnectMax);
    }


    /**
     * Subscribes the connection to data change messages of the given domains.
     * A ViewState calls this with the domains its services declare, so
     * the server addresses it like a page that declared them up front. The
     * subscription is remembered and re-announced after every reconnect,
     * because the server keeps the domain set per connection.
     * @param {Array<string>} domains - The wire names of the domains.
     */
    subscribeDomains(domains) {
        if (!Array.isArray(domains)) {
            return;
        }

        let added = false;
        for (const domain of domains) {
            if (typeof domain === "string" && domain.length > 0 && !this._subscribedDomains.has(domain)) {
                this._subscribedDomains.add(domain);
                added = true;
            }
        }

        if (added) {
            this._sendDomainSubscription();
        }
    }

    /**
     * Announces the accumulated domain subscription to the server. Sent on
     * every new subscription and after every reconnect; the server merges the
     * domains, so repeating the full set is idempotent.
     */
    _sendDomainSubscription() {
        if (this._subscribedDomains.size === 0) {
            return;
        }

        this.send({
            type: "webexpress.webapp.data.subscribe",
            domains: Array.from(this._subscribedDomains)
        });
    }

    /**
     * Dispatches a synthesized payload to every registered listener
     * without putting it on the WebSocket. Useful for client-only events
     * (e.g. a "popup" action that wants to show a local notification
     * through the existing PopupNotificationCtrl pipeline) without
     * involving the server.
     * @param {Object} payload - The synthesized payload object.
     */
    dispatchLocal(payload) {
        if (!payload) {
            return;
        }
        for (let listener of this._listeners) {
            try {
                listener(payload);
            } catch (err) {
                // listener errors must not interrupt the dispatch loop
            }
        }
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
    // Event triggered when a tab is added dynamically.
    static TAB_ADDED_EVENT = "webexpress.webapp.tab.added";
    // Event triggered when a tab is closed dynamically.
    static TAB_CLOSED_EVENT = "webexpress.webapp.tab.closed";

    // Event triggered when the tab order changes via drag and drop
    static TAB_REORDERED_EVENT = "webexpress.webapp.tab.reordered";
    // Event triggered when the form editor finishes loading (or reloading) a form.
    static FORM_EDITOR_LOADED_EVENT = "webexpress.webapp.formeditor.loaded";
    // Event triggered when a node is added in the form editor.
    static FORM_EDITOR_NODE_ADDED_EVENT = "webexpress.webapp.formeditor.node.added";
    // Event triggered when a node is removed in the form editor.
    static FORM_EDITOR_NODE_REMOVED_EVENT = "webexpress.webapp.formeditor.node.removed";
    // Event triggered when a node is renamed in the form editor.
    static FORM_EDITOR_NODE_RENAMED_EVENT = "webexpress.webapp.formeditor.node.renamed";
    // Event triggered when a node is moved (drag-and-drop) in the form editor.
    static FORM_EDITOR_NODE_MOVED_EVENT = "webexpress.webapp.formeditor.node.moved";
    // Event triggered when a tab is added in the form editor.
    static FORM_EDITOR_TAB_ADDED_EVENT = "webexpress.webapp.formeditor.tab.added";
    // Event triggered when a tab is renamed in the form editor.
    static FORM_EDITOR_TAB_RENAMED_EVENT = "webexpress.webapp.formeditor.tab.renamed";
    // Event triggered when the form editor's layout (two-pane / tree-table / three-pane) changes.
    static FORM_EDITOR_LAYOUT_CHANGED_EVENT = "webexpress.webapp.formeditor.layout.changed";
    // Event triggered after a successful structure save.
    static FORM_EDITOR_SAVED_EVENT = "webexpress.webapp.formeditor.saved";
    // Event triggered when a structure save fails validation.
    static FORM_EDITOR_VALIDATION_FAILED_EVENT = "webexpress.webapp.formeditor.validation.failed";
    // Event triggered when a remote user joins a CollaborativeCtrl container.
    static COLLABORATIVE_USER_JOIN = "webexpress.webapp.collaborative.user.join";
    // Event triggered when a remote user leaves a CollaborativeCtrl container.
    static COLLABORATIVE_USER_LEAVE = "webexpress.webapp.collaborative.user.leave";
    // Event triggered when a remote cursor position update is received.
    static COLLABORATIVE_CURSOR = "webexpress.webapp.collaborative.cursor";
    // Event triggered when a remote input value update is received.
    static COLLABORATIVE_INPUT = "webexpress.webapp.collaborative.input";
    // Event triggered when a comment is added
    static COMMENT_ADDED_EVENT = "webexpress.webapp.comment.added";
    // Event triggered when a comment is updated
    static COMMENT_UPDATED_EVENT = "webexpress.webapp.comment.updated";
    // Event triggered when a comment is deleted
    static COMMENT_DELETED_EVENT = "webexpress.webapp.comment.deleted";
    // Event triggered when a reaction is added to a comment
    static COMMENT_REACTION_EVENT = "webexpress.webapp.comment.reaction";
    // Event triggered when a reply is added to a comment
    static COMMENT_REPLY_EVENT = "webexpress.webapp.comment.reply";
    // Event triggered when a watcher is added
    static WATCHER_ADDED_EVENT = "webexpress.webapp.watcher.added";
    // Event triggered when a watcher is removed
    static WATCHER_REMOVED_EVENT = "webexpress.webapp.watcher.removed";
    // Event triggered when a tag is added
    static TAG_ADDED_EVENT = "webexpress.webapp.tag.added";
    // Event triggered when a tag is removed
    static TAG_REMOVED_EVENT = "webexpress.webapp.tag.removed";
    // Event triggered when the policy set of a group is assigned or changed
    static PERMISSION_ASSIGNED_EVENT = "webexpress.webapp.permission.assigned";
    // Event triggered when every policy of a group is revoked
    static PERMISSION_REMOVED_EVENT = "webexpress.webapp.permission.removed";
    // Event triggered when a link was established
    static RELATION_ADDED_EVENT = "webexpress.webapp.relation.added";
    // Event triggered when the status or the note of a link changed
    static RELATION_UPDATED_EVENT = "webexpress.webapp.relation.updated";
    // Event triggered when a link was removed
    static RELATION_REMOVED_EVENT = "webexpress.webapp.relation.removed";
    // Event triggered when a link type was defined or changed
    static RELATION_TYPE_SAVED_EVENT = "webexpress.webapp.relation.editor.saved";
    // Event triggered when a link type was removed
    static RELATION_TYPE_REMOVED_EVENT = "webexpress.webapp.relation.editor.removed";
    // Event triggered when the link types were rearranged
    static RELATION_TYPE_REORDERED_EVENT = "webexpress.webapp.relation.editor.reordered";
}

/**
 * Reads the paging figures out of a data response.
 * @remarks
 * The REST results of the paged control families (table, list, tile) report
 * them in a "pagination" block - the wire shape of RestApiPaginationInfo, which
 * names them page, pageSize, total and totalPages - while a hand written
 * endpoint may put the same figures at the top level. Both are accepted, so the
 * three reducers read one shape and none of them has to know which endpoint
 * answered. A figure that is absent stays null rather than becoming a zero,
 * which the callers need in order to tell "the endpoint does not count its
 * result" from "the result is empty".
 * @param {object} response - The raw server response.
 * @returns {{total: number|null, page: number|null, pageSize: number|null}} The paging figures.
 */
webexpress.webapp.pagingOf = function (response) {
    const top = response || {};
    const block = top.pagination || {};

    const read = function (...names) {
        for (const name of names) {
            const value = top[name] ?? block[name];

            if (value === undefined || value === null) {
                continue;
            }

            const number = Number(value);

            if (Number.isFinite(number)) {
                return number;
            }
        }

        return null;
    };

    return {
        total: read("total", "totalCount", "count"),
        page: read("page", "pageNumber"),
        pageSize: read("pageSize")
    };
};

/**
 * Builds the caption of the paging info line the paged data controls (table,
 * list, tile) render below their content. It lives here rather than in each of
 * them so the wording and its translation stay in one place. The control is
 * passed in because the translation goes through its inherited _i18n, which
 * carries the fallback for a bundle that does not know the key.
 * @param {object} ctrl - The control that renders the line.
 * @param {number} page - The zero-based current page.
 * @param {number} pageCount - The number of pages.
 * @param {number} itemsOnPage - The number of items on the current page.
 * @param {number} total - The number of items in total.
 * @returns {string} The caption.
 */
webexpress.webapp.pagingInfo = function (ctrl, page, pageCount, itemsOnPage, total) {
    return ctrl._i18n("webexpress.webapp:paging.info", "Page {0} of {1} / {2} of {3} items")
        .replace("{0}", String(page + 1))
        .replace("{1}", String(pageCount))
        .replace("{2}", String(itemsOnPage))
        .replace("{3}", String(total));
};

/**
 * Builds the caption of the paging info line while the requested page is still
 * loading, so the line does not keep reporting the previous window.
 * @param {object} ctrl - The control that renders the line.
 * @param {number} page - The zero-based requested page.
 * @param {number} pageCount - The number of pages.
 * @returns {string} The caption.
 */
webexpress.webapp.pagingInfoLoading = function (ctrl, page, pageCount) {
    return ctrl._i18n("webexpress.webapp:paging.info.loading", "Page {0} of {1} - loading…")
        .replace("{0}", String(page + 1))
        .replace("{1}", String(pageCount));
};

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