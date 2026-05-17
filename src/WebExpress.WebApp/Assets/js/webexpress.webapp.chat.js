/**
 * Chat control for group conversations and 1:1 direct messages.
 *
 * Architecture mirrors webexpress.webapp.CollaborativeCtrl: every event is
 * exchanged through the shared webexpress.webapp.MessageQueue WebSocket so
 * no REST endpoint or polling is required. The server side
 * (WebExpress.WebApp.WebMessageQueue.ChatMessageHandler) authoritatively
 * assigns the message id, stores recent messages in a per-channel ring
 * buffer and replays them on demand. The client filters every incoming
 * message by channelId, dedupes by messageId (so live + replayed copies do
 * not produce duplicates) and renders a simple message list with an input
 * box.
 *
 * Manual usage example:
 *
 *   <div class="wx-webapp-chat"
 *        data-chat-channel-id="general"
 *        data-chat-user-id="alice"
 *        data-chat-user-name="Alice"
 *        data-chat-user-color="#3B82F6"
 *        data-chat-mode="group"
 *        data-chat-title="General"></div>
 */
webexpress.webapp.ChatCtrl = class extends webexpress.webui.Ctrl {

    /**
     * Wire-format message type for chat messages (broadcast + history
     * replay).
     */
    static MESSAGE_TYPE = "webexpress.webapp.chat.message";

    /**
     * Wire-format message type for the history request the client sends on
     * connect / reconnect.
     */
    static HISTORY_REQUEST_TYPE = "webexpress.webapp.chat.history.request";

    /**
     * Initializes the chat control and sets up the required environment.
     * @param {HTMLElement} element - The DOM element associated with this instance.
     */
    constructor(element) {
        super(element);

        this._channelId = element.dataset.chatChannelId || "";
        this._userId = element.dataset.chatUserId || this._generateUserId();
        this._userName = element.dataset.chatUserName || this._userId;
        this._userColor = element.dataset.chatUserColor || this._pickAutoColor(this._userId);
        this._mode = element.dataset.chatMode || "group";
        this._placeholder = element.dataset.chatPlaceholder || "Type a message…";
        this._title = element.dataset.chatTitle || "";

        // tracked message ids so live + replayed copies do not duplicate
        this._seenMessageIds = new Set();

        // outgoing pending messages that have not been ACKed yet
        this._pendingClientIds = new Map();

        this._buildDom(element);
        this._bindLocalEvents();

        // transport setup using the singleton message queue
        this._queue = (typeof webexpress !== "undefined" && webexpress.webapp)
            ? webexpress.webapp.MessageQueue
            : null;
        this._onMessage = (payload) => this._handleMessage(payload);
        this._onStatusChange = (event) => this._handleStatusChange(event);

        if (this._queue) {
            this._queue.register(this._onMessage);
        }
        document.addEventListener(webexpress.webapp.Event.CHANGE_STATUS_EVENT, this._onStatusChange);

        // request the recent backlog immediately; the server replies with
        // individual chat.message broadcasts that flow through the regular
        // pipeline
        this._requestHistory();
    }

    /**
     * Tears down listeners. Called by frameworks that re-render the host.
     */
    destroy() {
        if (this._queue && this._onMessage) {
            this._queue.unregister(this._onMessage);
        }
        document.removeEventListener(webexpress.webapp.Event.CHANGE_STATUS_EVENT, this._onStatusChange);
    }

    /**
     * Builds the static DOM skeleton (header, message list, input row).
     * The host element is wiped first so the control owns its layout.
     * @param {HTMLElement} element - The host element.
     */
    _buildDom(element) {
        element.innerHTML = "";
        element.classList.add("wx-chat");
        element.classList.add(this._mode === "direct" ? "wx-chat-direct" : "wx-chat-group");

        if (this._title) {
            this._header = document.createElement("div");
            this._header.className = "wx-chat-header";
            this._header.textContent = this._title;
            element.appendChild(this._header);
        }

        this._messages = document.createElement("div");
        this._messages.className = "wx-chat-messages";
        this._messages.setAttribute("role", "log");
        this._messages.setAttribute("aria-live", "polite");
        element.appendChild(this._messages);

        const form = document.createElement("form");
        form.className = "wx-chat-input";
        form.setAttribute("autocomplete", "off");

        this._input = document.createElement("textarea");
        this._input.className = "form-control wx-chat-input-field";
        this._input.placeholder = this._placeholder;
        this._input.rows = 1;
        form.appendChild(this._input);

        this._sendButton = document.createElement("button");
        this._sendButton.type = "submit";
        this._sendButton.className = "btn btn-primary wx-chat-send";
        this._sendButton.textContent = "Send";
        form.appendChild(this._sendButton);

        form.addEventListener("submit", (event) => {
            event.preventDefault();
            this._sendCurrentInput();
        });

        element.appendChild(form);
        this._form = form;
    }

    /**
     * Binds keyboard shortcuts on the input (Enter sends, Shift+Enter
     * inserts a newline).
     */
    _bindLocalEvents() {
        this._input.addEventListener("keydown", (event) => {
            if (event.key !== "Enter") {
                return;
            }
            if (event.shiftKey) {
                return; // newline
            }
            event.preventDefault();
            this._sendCurrentInput();
        });
    }

    /**
     * Reads the current input value and emits it as a chat message.
     */
    _sendCurrentInput() {
        const body = (this._input.value || "").trim();
        if (!body) {
            return;
        }
        this.send(body);
        this._input.value = "";
        this._input.focus();
    }

    /**
     * Sends a chat message into the configured channel. Public API for
     * programmatic usage (e.g. tutorials or tests).
     * @param {string} body - The message text.
     */
    send(body) {
        if (!this._queue || !this._channelId) {
            return;
        }
        if (typeof body !== "string" || body.length === 0) {
            return;
        }

        const clientId = "c-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
        this._pendingClientIds.set(clientId, body);

        this._queue.send({
            type: webexpress.webapp.ChatCtrl.MESSAGE_TYPE,
            channelId: this._channelId,
            userId: this._userId,
            userName: this._userName,
            userColor: this._userColor,
            mode: this._mode,
            clientId: clientId,
            body: body,
            ts: Date.now()
        });
    }

    /**
     * Requests the recent backlog for the configured channel. Called on
     * init and whenever the transport reconnects.
     */
    _requestHistory() {
        if (!this._queue || !this._channelId) {
            return;
        }
        this._queue.send({
            type: webexpress.webapp.ChatCtrl.HISTORY_REQUEST_TYPE,
            channelId: this._channelId,
            userId: this._userId
        });
    }

    /**
     * Filters and routes an incoming MessageQueue payload. Only chat
     * messages for the configured channel are applied.
     * @param {*} payload - The decoded message payload.
     */
    _handleMessage(payload) {
        if (!payload || typeof payload !== "object") {
            return;
        }
        if (payload.type !== webexpress.webapp.ChatCtrl.MESSAGE_TYPE) {
            return;
        }
        if (!payload.channelId || payload.channelId !== this._channelId) {
            return;
        }
        this._appendMessage(payload);
    }

    /**
     * Re-requests the channel history every time the WebSocket re-enters
     * the "online" state so messages received during the offline phase
     * become visible immediately. The dedupe by message id ensures the
     * already-rendered messages stay untouched.
     * @param {CustomEvent} event - The status change event.
     */
    _handleStatusChange(event) {
        const status = event && event.detail ? event.detail.status : null;
        if (status === "online") {
            this._requestHistory();
        }
    }

    /**
     * Appends a single message to the visible list, deduplicating by
     * messageId.
     * @param {Object} msg - The decoded chat message.
     */
    _appendMessage(msg) {
        const id = msg.messageId;
        if (!id || this._seenMessageIds.has(id)) {
            return;
        }
        this._seenMessageIds.add(id);

        // if this echo corresponds to one of our locally pending sends, drop
        // the pending-id mapping; the optimistic UI was never rendered, so
        // this is mostly bookkeeping for future enhancements.
        if (msg.clientId && this._pendingClientIds.has(msg.clientId)) {
            this._pendingClientIds.delete(msg.clientId);
        }

        const entry = document.createElement("div");
        entry.className = "wx-chat-message";
        entry.dataset.messageId = id;
        entry.dataset.userId = msg.userId || "";

        const isOwn = msg.userId && msg.userId === this._userId;
        if (isOwn) {
            entry.classList.add("wx-chat-message-own");
        }

        const avatar = document.createElement("span");
        avatar.className = "wx-chat-avatar";
        avatar.style.backgroundColor = msg.userColor || this._pickAutoColor(msg.userId || "");
        avatar.textContent = this._initials(msg.userName || msg.userId || "?");
        entry.appendChild(avatar);

        const bubble = document.createElement("div");
        bubble.className = "wx-chat-bubble";

        const meta = document.createElement("div");
        meta.className = "wx-chat-meta";
        const name = document.createElement("span");
        name.className = "wx-chat-name";
        name.textContent = msg.userName || msg.userId || "Anonymous";
        const time = document.createElement("span");
        time.className = "wx-chat-time";
        time.textContent = this._formatTimestamp(msg.ts || msg.timestamp);
        meta.appendChild(name);
        meta.appendChild(time);
        bubble.appendChild(meta);

        const body = document.createElement("div");
        body.className = "wx-chat-body";
        body.textContent = msg.body || "";
        bubble.appendChild(body);

        entry.appendChild(bubble);
        this._messages.appendChild(entry);

        // keep the latest message in view if we were already near the bottom
        this._messages.scrollTop = this._messages.scrollHeight;
    }

    /**
     * Formats an incoming timestamp (epoch ms or ISO string) as a short
     * local time label.
     */
    _formatTimestamp(ts) {
        if (!ts) {
            return "";
        }
        let date;
        if (typeof ts === "number") {
            date = new Date(ts);
        } else {
            date = new Date(ts);
            if (isNaN(date.valueOf())) {
                return String(ts);
            }
        }
        try {
            return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        } catch (e) {
            return date.toISOString();
        }
    }

    /**
     * Returns the initials of a user's name (max two characters).
     * @param {string} name - The user name.
     */
    _initials(name) {
        const parts = (name || "").trim().split(/\s+/).filter(p => p.length > 0);
        if (parts.length === 0) {
            return "?";
        }
        if (parts.length === 1) {
            return parts[0].slice(0, 2).toUpperCase();
        }
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    /**
     * Picks a deterministic HSL color from a seed string. Same algorithm
     * as CollaborativeCtrl so the same user gets the same color across
     * controls.
     * @param {string} seed - The seed string (typically the user id).
     */
    _pickAutoColor(seed) {
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
            hash = (hash * 31 + seed.charCodeAt(i)) | 0;
        }
        const hue = Math.abs(hash) % 360;
        return `hsl(${hue}, 65%, 45%)`;
    }

    /**
     * Generates a fallback user id when the host element does not provide
     * one.
     */
    _generateUserId() {
        if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
            return "u-" + crypto.randomUUID();
        }
        return "u-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    }
}

// register the class in the controller
webexpress.webui.Controller.registerClass("wx-webapp-chat", webexpress.webapp.ChatCtrl);
