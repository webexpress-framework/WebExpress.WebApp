/**
 * Control for real-time collaborative interactions inside a container element.
 * Renders presence chips, remote cursor overlays, and synchronizes text input
 * across all connected clients using the global webexpress.webapp.MessageQueue.
 *
 * The control follows the structure of webexpress.webapp.MessageQueueStatusCtrl:
 * it reuses the existing WebSocket infrastructure (WebExpress.WebCore.WebSocket.*
 * on the server, webexpress.webapp.MessageQueue on the client) and requires no
 * additional backend logic.
 *
 * Dispatched custom events (CustomEvent on the host element, bubbles):
 * - webexpress.webapp.Event.COLLABORATIVE_USER_JOIN
 * - webexpress.webapp.Event.COLLABORATIVE_USER_LEAVE
 * - webexpress.webapp.Event.COLLABORATIVE_CURSOR
 * - webexpress.webapp.Event.COLLABORATIVE_INPUT
 *
 * Usage:
 * <div id="collaborative1"
 *      class="wx-webapp-collaborative"
 *      data-collaborative-presence="true"
 *      data-collaborative-cursor="true"
 *      data-collaborative-input="true"
 *      data-collaborative-user-id="alice"
 *      data-collaborative-user-name="Alice"
 *      data-collaborative-color="#3B82F6">
 * </div>
 */
webexpress.webapp.CollaborativeCtrl = class extends webexpress.webui.Ctrl {
    
    /**
     * Wire-format message type for presence updates.
     * @type {string}
     */
    static PRESENCE_TYPE = "webexpress.webapp.collaborative.presence";

    /**
     * Wire-format message type for cursor position updates. Distinct from
     * webexpress.webapp.Event.COLLABORATIVE_CURSOR which names the DOM event
     * dispatched after an update has been applied locally.
     * @type {string}
     */
    static CURSOR_TYPE = "webexpress.webapp.collaborative.cursor";

    /**
     * Wire-format message type for synchronized text input updates. Distinct
     * from webexpress.webapp.Event.COLLABORATIVE_INPUT which names the DOM
     * event dispatched after an update has been applied locally.
     * @type {string}
     */
    static INPUT_TYPE = "webexpress.webapp.collaborative.input";

    /**
     * Wire-format message type for caret-only movements (selection change,
     * cursor moved by arrow keys, click into another position, focus
     * change). The payload carries the selection range but no field value
     * so the message stays lightweight even when fired frequently.
     * @type {string}
     */
    static CARET_TYPE = "webexpress.webapp.collaborative.caret";

    /**
     * Initializes the collaborative control and sets up the required environment.
     * @param {HTMLElement} element - The DOM element associated with this instance.
     */
    constructor(element) {
        super(element);

        // feature toggles (default: enabled unless explicitly "false")
        this._presenceEnabled = element.dataset.collaborativePresence !== "false";
        this._cursorEnabled = element.dataset.collaborativeCursor !== "false";
        this._inputEnabled = element.dataset.collaborativeInput !== "false";
        this._colorMode = element.dataset.collaborativeColorMode || "auto";

        // local user identity (read from dataset, fall back to generated values)
        this._userId = element.dataset.collaborativeUserId || this._generateUserId();
        this._userName = element.dataset.collaborativeUserName || this._userId;
        this._userColor = element.dataset.collaborativeColor || this._pickAutoColor(this._userId);

        // container identifier used as routing channel
        if (!element.id) {
            element.id = "wx-collab-" + Math.random().toString(36).slice(2, 10);
        }
        this._containerId = element.id;

        // remote state setup
        this._remoteUsers = new Map();
        this._remoteCursors = new Map();
        this._remoteCarets = new Map();
        this._suppressInput = new Set();

        // throttling state setup
        this._pendingCursor = null;
        this._cursorRafId = 0;

        // base css and required positioning
        element.classList.add("wx-collaborative");
        const computedPosition = getComputedStyle(element).position;
        if (!computedPosition || computedPosition === "static") {
            element.style.position = "relative";
        }

        this._initOverlayDOM();

        // transport setup using the message queue singleton
        this._queue = (typeof webexpress !== "undefined" && webexpress.webapp)
            ? webexpress.webapp.MessageQueue
            : null;
        this._messageHandler = (payload) => this._onMessage(payload);
        
        if (this._queue) {
            this._queue.register(this._messageHandler);
        }

        this._bindLocalEvents();

        // announce presence and keep peers informed periodically
        this._sendPresence("join");
        this._heartbeat = setInterval(() => {
            this._sendPresence("ping");
            this._reapStaleUsers();
        }, 5000);

        // gracefully leave on tab close
        this._beforeUnload = () => {
            this._sendPresence("leave");
        };
        window.addEventListener("beforeunload", this._beforeUnload);

        this.render();
    }

    /**
     * Re-renders presence chips and remote cursors. 
     * The host element's user content is never touched, only the overlay sub-containers are updated.
     */
    render() {
        this._renderPresence();
        this._renderCursors();
        this._renderCarets();
    }

    /**
     * Updates the UI components to reflect the latest state.
     */
    update() {
        this.render();
    }

    /**
     * Cleans up the instance by announcing departure, removing listeners, and stopping timers.
     */
    destroy() {
        this._sendPresence("leave");
        
        if (this._queue) {
            this._queue.unregister(this._messageHandler);
        }
        
        this._unbindLocalEvents();
        window.removeEventListener("beforeunload", this._beforeUnload);
        clearInterval(this._heartbeat);
        
        if (this._cursorRafId) {
            cancelAnimationFrame(this._cursorRafId);
        }
        
        if (this._presenceBar && this._presenceBar.parentNode) {
            this._presenceBar.parentNode.removeChild(this._presenceBar);
        }
        
        if (this._cursorLayer && this._cursorLayer.parentNode) {
            this._cursorLayer.parentNode.removeChild(this._cursorLayer);
        }

        if (this._caretLayer && this._caretLayer.parentNode) {
            this._caretLayer.parentNode.removeChild(this._caretLayer);
        }

        this._element.classList.remove("wx-collaborative");
    }

    /**
     * Retrieves the currently active remote users.
     * @returns {Array<{id: string, name: string, color: string, lastSeen: number}>} An array of active user objects.
     */
    get users() {
        return Array.from(this._remoteUsers.entries()).map(([id, u]) => {
            return { id, ...u };
        });
    }

    /**
     * Enables or disables the presence chip display.
     * @param {boolean} value - Indicates whether presence should be shown.
     */
    enablePresence(value) {
        this._presenceEnabled = !!value;
        this._renderPresence();
    }

    /**
     * Enables or disables remote cursor visualization.
     * @param {boolean} value - Indicates whether remote cursors should be rendered.
     */
    enableCursor(value) {
        this._cursorEnabled = !!value;
        if (!this._cursorEnabled) {
            this._remoteCursors.clear();
        }
        this._renderCursors();
    }

    /**
     * Enables or disables text input synchronization.
     * @param {boolean} value - Indicates whether input synchronization should be active.
     */
    enableInput(value) {
        this._inputEnabled = !!value;
        if (!this._inputEnabled) {
            this._remoteCarets.clear();
        }
        this._renderCarets();
    }

    /**
     * Builds the presence bar and cursor overlay sub-containers and appends them to the host element.
     */
    _initOverlayDOM() {
        this._presenceBar = document.createElement("div");
        this._presenceBar.className = "wx-collaborative-presence";

        this._cursorLayer = document.createElement("div");
        this._cursorLayer.className = "wx-collaborative-cursors";

        this._caretLayer = document.createElement("div");
        this._caretLayer.className = "wx-collaborative-carets";

        this._element.appendChild(this._presenceBar);
        this._element.appendChild(this._cursorLayer);
        this._element.appendChild(this._caretLayer);
    }

    /**
     * Binds local dom events for interaction tracking.
     */
    _bindLocalEvents() {
        this._onMouseMove = (e) => {
            this._scheduleCursorSend(e);
        };
        this._onMouseLeave = () => {
            this._sendCursor(-1, -1);
        };
        this._onInputEvent = (e) => {
            this._handleLocalInput(e);
        };
        this._onFocusIn = (e) => {
            this._handleLocalCaret(e.target);
        };
        this._onFocusOut = (e) => {
            this._handleLocalCaretClear(e.target);
        };
        this._onSelectionChange = () => {
            this._handleLocalCaret(document.activeElement);
        };

        this._element.addEventListener("mousemove", this._onMouseMove);
        this._element.addEventListener("mouseleave", this._onMouseLeave);
        this._element.addEventListener("input", this._onInputEvent, true);
        this._element.addEventListener("focusin", this._onFocusIn, true);
        this._element.addEventListener("focusout", this._onFocusOut, true);
        document.addEventListener("selectionchange", this._onSelectionChange);
    }

    /**
     * Unbinds local dom events.
     */
    _unbindLocalEvents() {
        this._element.removeEventListener("mousemove", this._onMouseMove);
        this._element.removeEventListener("mouseleave", this._onMouseLeave);
        this._element.removeEventListener("input", this._onInputEvent, true);
        this._element.removeEventListener("focusin", this._onFocusIn, true);
        this._element.removeEventListener("focusout", this._onFocusOut, true);
        document.removeEventListener("selectionchange", this._onSelectionChange);
    }

    /**
     * Throttles cursor send events to one per animation frame to optimize performance.
     * @param {MouseEvent} e - The native mouse event.
     */
    _scheduleCursorSend(e) {
        if (!this._cursorEnabled) {
            return;
        }
        
        const rect = this._element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            return;
        }
        
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        this._pendingCursor = { x, y };
        
        if (this._cursorRafId) {
            return;
        }
        
        this._cursorRafId = requestAnimationFrame(() => {
            this._cursorRafId = 0;
            if (this._pendingCursor) {
                this._sendCursor(this._pendingCursor.x, this._pendingCursor.y);
                this._pendingCursor = null;
            }
        });
    }

    /**
     * Handles local input events on contained fields and broadcasts the value.
     * @param {Event} e - The native input event.
     */
    _handleLocalInput(e) {
        if (!this._inputEnabled) {
            return;
        }
        
        const target = e.target;
        if (!target) {
            return;
        }

        const fieldId = this._fieldIdentifier(target);
        if (!fieldId) {
            return;
        }
        
        if (this._suppressInput.has(fieldId)) {
            return;
        }

        const value = "value" in target ? target.value : target.textContent || "";
        const selectionStart = typeof target.selectionStart === "number" ? target.selectionStart : null;
        const selectionEnd = typeof target.selectionEnd === "number" ? target.selectionEnd : null;

        this._sendInput(fieldId, value, selectionStart, selectionEnd);
    }

    /**
     * Reports the local caret position of the given field to all peers so
     * the remote beam follows arrow keys, mouse clicks into another position
     * and focus changes without requiring a value change.
     * @param {EventTarget|null} target - The active element, if any.
     */
    _handleLocalCaret(target) {
        if (!this._inputEnabled) {
            return;
        }

        if (!target || !(target instanceof HTMLElement)) {
            return;
        }

        if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
            return;
        }

        if (!this._element.contains(target)) {
            return;
        }

        const fieldId = this._fieldIdentifier(target);
        if (!fieldId) {
            return;
        }

        const selectionStart = typeof target.selectionStart === "number"
            ? target.selectionStart
            : null;
        const selectionEnd = typeof target.selectionEnd === "number"
            ? target.selectionEnd
            : selectionStart;

        if (selectionStart === null) {
            return;
        }

        this._sendCaret(fieldId, selectionStart, selectionEnd);
    }

    /**
     * Signals peers that the local user no longer has a caret in the given
     * field. The peer side hides the corresponding remote beam.
     * @param {EventTarget|null} target - The element losing focus.
     */
    _handleLocalCaretClear(target) {
        if (!this._inputEnabled) {
            return;
        }

        if (!target || !(target instanceof HTMLElement)) {
            return;
        }

        if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
            return;
        }

        const fieldId = this._fieldIdentifier(target);
        if (!fieldId) {
            return;
        }

        this._sendCaret(fieldId, -1, -1);
    }

    /**
     * Returns a stable identifier for a field, primarily utilizing its ID.
     * @param {HTMLElement} el - The element to identify.
     * @returns {string|null} The identifier string or null if not identifiable.
     */
    _fieldIdentifier(el) {
        if (el.id) {
            return el.id;
        }
        return null;
    }

    /**
     * Checks whether outgoing messages can currently be transmitted.
     * @returns {boolean} True if the transport queue is ready.
     */
    _canSend() {
        return this._queue && this._queue.status === "online";
    }

    /**
     * Broadcasts the user's presence state.
     * @param {string} status - The status to broadcast (e.g., 'join', 'ping', 'leave').
     */
    _sendPresence(status) {
        if (!this._presenceEnabled && status !== "leave") {
            return;
        }
        
        if (!this._canSend()) {
            return;
        }
        
        this._queue.send({
            type: webexpress.webapp.CollaborativeCtrl.PRESENCE_TYPE,
            containerId: this._containerId,
            userId: this._userId,
            userName: this._userName,
            userColor: this._userColor,
            status: status,
            ts: Date.now()
        });
    }

    /**
     * Broadcasts the user's current local cursor position.
     * @param {number} x - The normalized horizontal coordinate.
     * @param {number} y - The normalized vertical coordinate.
     */
    _sendCursor(x, y) {
        if (!this._cursorEnabled) {
            return;
        }
        
        if (!this._canSend()) {
            return;
        }
        
        this._queue.send({
            type: webexpress.webapp.CollaborativeCtrl.CURSOR_TYPE,
            containerId: this._containerId,
            userId: this._userId,
            userName: this._userName,
            userColor: this._userColor,
            x: x,
            y: y,
            ts: Date.now()
        });
    }

    /**
     * Broadcasts the latest input state of a synchronized field.
     * @param {string} fieldId - The identifier of the input field.
     * @param {string} value - The current value of the field.
     * @param {number|null} selectionStart - The start of the text selection.
     * @param {number|null} selectionEnd - The end of the text selection.
     */
    _sendInput(fieldId, value, selectionStart, selectionEnd) {
        if (!this._canSend()) {
            return;
        }

        this._queue.send({
            type: webexpress.webapp.CollaborativeCtrl.INPUT_TYPE,
            containerId: this._containerId,
            userId: this._userId,
            userName: this._userName,
            userColor: this._userColor,
            fieldId: fieldId,
            value: value,
            selectionStart: selectionStart,
            selectionEnd: selectionEnd,
            ts: Date.now()
        });
    }

    /**
     * Broadcasts the local caret position for a focused input/textarea.
     * Carries no value so it stays cheap to fire on every selection change.
     * @param {string} fieldId - The id of the focused field.
     * @param {number} selectionStart - The caret start, or -1 to clear.
     * @param {number} selectionEnd - The caret end.
     */
    _sendCaret(fieldId, selectionStart, selectionEnd) {
        if (!this._inputEnabled) {
            return;
        }

        if (!this._canSend()) {
            return;
        }

        this._queue.send({
            type: webexpress.webapp.CollaborativeCtrl.CARET_TYPE,
            containerId: this._containerId,
            userId: this._userId,
            userName: this._userName,
            userColor: this._userColor,
            fieldId: fieldId,
            selectionStart: selectionStart,
            selectionEnd: selectionEnd,
            ts: Date.now()
        });
    }

    /**
     * Filters and dispatches an incoming message payload based on its type.
     * @param {any} payload - The message payload received from the queue.
     */
    _onMessage(payload) {
        if (!payload || typeof payload !== "object") {
            return;
        }
        
        if (payload.containerId !== this._containerId) {
            return;
        }
        
        if (payload.userId === this._userId) {
            return;
        }

        switch (payload.type) {
            case webexpress.webapp.CollaborativeCtrl.PRESENCE_TYPE:
                this._onPresence(payload);
                break;
            case webexpress.webapp.CollaborativeCtrl.CURSOR_TYPE:
                this._onCursor(payload);
                break;
            case webexpress.webapp.CollaborativeCtrl.INPUT_TYPE:
                this._onInput(payload);
                break;
            case webexpress.webapp.CollaborativeCtrl.CARET_TYPE:
                this._onCaret(payload);
                break;
        }
    }

    /**
     * Handles incoming presence messages and updates the remote user state.
     * @param {Object} msg - The decoded presence message.
     */
    _onPresence(msg) {
        if (msg.status === "leave") {
            if (this._remoteUsers.has(msg.userId)) {
                this._remoteUsers.delete(msg.userId);
                this._remoteCursors.delete(msg.userId);
                this._remoteCarets.delete(msg.userId);

                this._dispatch(webexpress.webapp.Event.COLLABORATIVE_USER_LEAVE, {
                    userId: msg.userId,
                    userName: msg.userName,
                    userColor: msg.userColor
                });

                this._renderPresence();
                this._renderCursors();
                this._renderCarets();
            }
            return;
        }

        const isNew = !this._remoteUsers.has(msg.userId);
        this._remoteUsers.set(msg.userId, {
            name: msg.userName || msg.userId,
            color: msg.userColor || this._pickAutoColor(msg.userId),
            lastSeen: Date.now()
        });

        if (isNew) {
            // ping back so the new peer learns about the local user immediately
            this._sendPresence("ping");
            this._dispatch(webexpress.webapp.Event.COLLABORATIVE_USER_JOIN, {
                userId: msg.userId,
                userName: msg.userName,
                userColor: msg.userColor
            });
            this._renderPresence();
        }
    }

    /**
     * Handles incoming cursor messages and updates remote cursor positions.
     * @param {Object} msg - The decoded cursor message.
     */
    _onCursor(msg) {
        if (!this._cursorEnabled) {
            return;
        }

        // mark the sender as alive since a cursor update implies presence
        if (!this._remoteUsers.has(msg.userId)) {
            this._remoteUsers.set(msg.userId, {
                name: msg.userName || msg.userId,
                color: msg.userColor || this._pickAutoColor(msg.userId),
                lastSeen: Date.now()
            });
            this._renderPresence();
        } else {
            this._remoteUsers.get(msg.userId).lastSeen = Date.now();
        }

        if (msg.x < 0 || msg.y < 0) {
            this._remoteCursors.delete(msg.userId);
        } else {
            this._remoteCursors.set(msg.userId, {
                x: msg.x,
                y: msg.y,
                color: msg.userColor || this._pickAutoColor(msg.userId),
                name: msg.userName || msg.userId
            });
        }

        this._dispatch(webexpress.webapp.Event.COLLABORATIVE_CURSOR, {
            userId: msg.userId,
            userName: msg.userName,
            userColor: msg.userColor,
            x: msg.x,
            y: msg.y
        });
        
        this._renderCursors();
    }

    /**
     * Handles incoming input messages and updates the corresponding local fields.
     * @param {Object} msg - The decoded input message.
     */
    _onInput(msg) {
        if (!this._inputEnabled) {
            return;
        }

        if (!msg.fieldId) {
            return;
        }

        const field = this._element.querySelector("#" + CSS.escape(msg.fieldId));
        if (!field || !this._element.contains(field)) {
            // field is no longer available locally — drop any stale caret state
            if (this._remoteCarets.delete(msg.userId)) {
                this._renderCarets();
            }
            return;
        }

        // remember the remote caret position before changing the value so the
        // beam can be drawn even while the local user keeps the field focused
        if (typeof msg.selectionStart === "number" && msg.selectionStart >= 0) {
            this._remoteCarets.set(msg.userId, {
                fieldId: msg.fieldId,
                position: msg.selectionStart,
                color: msg.userColor || this._pickAutoColor(msg.userId),
                name: msg.userName || msg.userId
            });
        } else {
            this._remoteCarets.delete(msg.userId);
        }

        // do not overwrite a field that the local user is actively editing
        if (document.activeElement !== field) {
            this._suppressInput.add(msg.fieldId);

            try {
                if ("value" in field) {
                    field.value = msg.value != null ? msg.value : "";
                } else {
                    field.textContent = msg.value != null ? msg.value : "";
                }
                // emit native event to ensure frameworks or bindings can react
                field.dispatchEvent(new Event("input", { bubbles: true }));
            } finally {
                this._suppressInput.delete(msg.fieldId);
            }
        }

        this._renderCarets();

        this._dispatch(webexpress.webapp.Event.COLLABORATIVE_INPUT, {
            userId: msg.userId,
            userName: msg.userName,
            userColor: msg.userColor,
            fieldId: msg.fieldId,
            value: msg.value,
            selectionStart: msg.selectionStart,
            selectionEnd: msg.selectionEnd
        });
    }

    /**
     * Handles a lightweight caret-only update from a remote user. The peer
     * sends this whenever the local caret moves without changing the field
     * value (arrow keys, click into another position, focus change). The
     * receiver updates the remote beam without touching the field value.
     * @param {Object} msg - The decoded caret message.
     */
    _onCaret(msg) {
        if (!this._inputEnabled) {
            return;
        }

        if (!msg.fieldId) {
            return;
        }

        // a negative selection means the remote user no longer has a caret
        // in this field (lost focus, switched fields)
        if (typeof msg.selectionStart !== "number" || msg.selectionStart < 0) {
            if (this._remoteCarets.delete(msg.userId)) {
                this._renderCarets();
            }
            return;
        }

        const field = this._element.querySelector("#" + CSS.escape(msg.fieldId));
        if (!field || !this._element.contains(field)) {
            if (this._remoteCarets.delete(msg.userId)) {
                this._renderCarets();
            }
            return;
        }

        this._remoteCarets.set(msg.userId, {
            fieldId: msg.fieldId,
            position: msg.selectionStart,
            color: msg.userColor || this._pickAutoColor(msg.userId),
            name: msg.userName || msg.userId
        });

        this._renderCarets();
    }

    /**
     * Renders the presence chips indicating active remote users.
     */
    _renderPresence() {
        if (!this._presenceBar) {
            return;
        }
        
        this._presenceBar.innerHTML = "";

        if (!this._presenceEnabled) {
            this._presenceBar.style.display = "none";
            return;
        }
        
        this._presenceBar.style.display = "";

        for (const [id, user] of this._remoteUsers) {
            const chip = document.createElement("span");
            chip.className = "wx-collaborative-chip";
            chip.style.backgroundColor = user.color;
            chip.title = user.name;
            chip.dataset.userId = id;
            chip.textContent = this._initials(user.name);
            this._presenceBar.appendChild(chip);
        }
    }

    /**
     * Renders the remote user cursors based on their last known coordinates.
     * Existing cursor nodes are reused so the CSS transition on left/top can
     * animate the movement instead of flashing every time a new message
     * arrives — cursor updates can fire many times per second.
     */
    _renderCursors() {
        if (!this._cursorLayer) {
            return;
        }

        if (!this._cursorEnabled) {
            this._cursorLayer.style.display = "none";
            this._cursorLayer.innerHTML = "";
            return;
        }

        this._cursorLayer.style.display = "";

        // remove cursors for users that are no longer present
        const present = this._remoteCursors;
        for (const node of Array.from(this._cursorLayer.children)) {
            const id = node.dataset.userId;
            if (!id || !present.has(id)) {
                node.remove();
            }
        }

        // upsert a cursor node per active user
        for (const [id, c] of present) {
            let cur = this._cursorLayer.querySelector(
                ".wx-collaborative-cursor[data-user-id=\"" + CSS.escape(id) + "\"]"
            );

            if (!cur) {
                cur = document.createElement("div");
                cur.className = "wx-collaborative-cursor";
                cur.dataset.userId = id;
                cur.innerHTML =
                    "<svg viewBox=\"0 0 16 16\" width=\"16\" height=\"16\" aria-hidden=\"true\">" +
                    "<path d=\"M2 1 L14 8 L8 9 L11 14 L9 15 L6 10 L2 13 Z\" fill=\"currentColor\" stroke=\"white\" stroke-width=\"1\"></path>" +
                    "</svg>";

                const label = document.createElement("span");
                label.className = "wx-collaborative-cursor-label";
                cur.appendChild(label);

                this._cursorLayer.appendChild(cur);
            }

            cur.style.left = (c.x * 100) + "%";
            cur.style.top = (c.y * 100) + "%";
            cur.style.color = c.color;

            const label = cur.querySelector(".wx-collaborative-cursor-label");
            if (label) {
                label.style.backgroundColor = c.color;
                label.textContent = c.name;
            }
        }
    }

    /**
     * Renders the remote text carets (beams) of users currently editing one
     * of the contained input or textarea fields. Caret nodes are reused per
     * user so the CSS blink animation does not restart on every update.
     */
    _renderCarets() {
        if (!this._caretLayer) {
            return;
        }

        if (!this._inputEnabled) {
            this._caretLayer.style.display = "none";
            this._caretLayer.innerHTML = "";
            return;
        }

        this._caretLayer.style.display = "";

        // remove caret nodes for users no longer present
        for (const node of Array.from(this._caretLayer.children)) {
            const id = node.dataset.userId;
            if (!id || !this._remoteCarets.has(id)) {
                node.remove();
            }
        }

        for (const [id, caret] of this._remoteCarets) {
            const field = this._element.querySelector("#" + CSS.escape(caret.fieldId));
            if (!field || !this._element.contains(field)) {
                continue;
            }

            const coords = this._measureCaret(field, caret.position);
            if (!coords) {
                continue;
            }

            let node = this._caretLayer.querySelector(
                ".wx-collaborative-caret[data-user-id=\"" + CSS.escape(id) + "\"]"
            );
            if (!node) {
                node = document.createElement("div");
                node.className = "wx-collaborative-caret";
                node.dataset.userId = id;

                const label = document.createElement("span");
                label.className = "wx-collaborative-caret-label";
                node.appendChild(label);

                this._caretLayer.appendChild(node);
            }

            node.style.left = coords.left + "px";
            node.style.top = coords.top + "px";
            node.style.height = coords.height + "px";
            node.style.backgroundColor = caret.color;

            const label = node.querySelector(".wx-collaborative-caret-label");
            if (label) {
                label.style.backgroundColor = caret.color;
                label.textContent = caret.name;
            }
        }
    }

    /**
     * Computes the pixel coordinates of a caret position inside the given
     * input or textarea field, expressed in the caret layer's coordinate
     * system. Uses a temporary mirror element with the same typographical
     * properties as the field to obtain the offset of the caret marker.
     * @param {HTMLElement} field - The input or textarea to measure against.
     * @param {number} position - The caret offset (index into field.value).
     * @returns {{left: number, top: number, height: number} | null}
     *          The coordinates, or null if the field type is not supported.
     */
    _measureCaret(field, position) {
        const tag = field.tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA") {
            return null;
        }

        const style = getComputedStyle(field);
        const mirror = document.createElement("div");

        const props = [
            "boxSizing", "width", "height",
            "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
            "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
            "fontFamily", "fontSize", "fontWeight", "fontStyle",
            "letterSpacing", "wordSpacing", "lineHeight", "textTransform", "tabSize"
        ];
        for (const p of props) {
            mirror.style[p] = style[p];
        }

        mirror.style.position = "absolute";
        mirror.style.left = "-9999px";
        mirror.style.top = "0";
        mirror.style.visibility = "hidden";
        mirror.style.whiteSpace = tag === "TEXTAREA" ? "pre-wrap" : "pre";
        mirror.style.wordWrap = "break-word";
        mirror.style.overflow = "hidden";

        const text = ("value" in field) ? (field.value || "") : (field.textContent || "");
        const safePos = Math.max(0, Math.min(position, text.length));

        const marker = document.createElement("span");
        marker.textContent = "​";

        mirror.appendChild(document.createTextNode(text.slice(0, safePos)));
        mirror.appendChild(marker);
        // appended trailing text helps the mirror reflow as the original would
        mirror.appendChild(document.createTextNode(text.slice(safePos) || " "));

        document.body.appendChild(mirror);

        const fieldRect = field.getBoundingClientRect();
        const layerRect = this._caretLayer.getBoundingClientRect();
        const markerRect = marker.getBoundingClientRect();
        const mirrorRect = mirror.getBoundingClientRect();

        const offsetX = markerRect.left - mirrorRect.left;
        const offsetY = markerRect.top - mirrorRect.top;
        const height = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2 || 16;

        document.body.removeChild(mirror);

        const left = fieldRect.left - layerRect.left + offsetX - (field.scrollLeft || 0);
        const top = fieldRect.top - layerRect.top + offsetY - (field.scrollTop || 0);

        return { left, top, height };
    }

    /**
     * Identifies and removes users that haven't sent a heartbeat recently.
     */
    _reapStaleUsers() {
        const cutoff = Date.now() - 12000;
        let changed = false;
        
        for (const [id, user] of this._remoteUsers) {
            if (user.lastSeen < cutoff) {
                this._remoteUsers.delete(id);
                this._remoteCursors.delete(id);
                this._remoteCarets.delete(id);

                this._dispatch(webexpress.webapp.Event.COLLABORATIVE_USER_LEAVE, {
                    userId: id,
                    userName: user.name,
                    userColor: user.color
                });

                changed = true;
            }
        }

        if (changed) {
            this._renderPresence();
            this._renderCursors();
            this._renderCarets();
        }
    }

    /**
     * Generates a unique identifier string for the local user.
     * @returns {string} The generated user id.
     */
    _generateUserId() {
        if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
            return "u-" + crypto.randomUUID();
        }
        return "u-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    }

    /**
     * Deterministically picks an HSL color from a seed string.
     * Used when color mode is auto and no explicit color is provided.
     * @param {string} seed - The input string to hash.
     * @returns {string} A valid HSL color string.
     */
    _pickAutoColor(seed) {
        let hash = 0;
        
        for (let i = 0; i < seed.length; i++) {
            hash = (hash * 31 + seed.charCodeAt(i)) | 0;
        }
        
        const hue = Math.abs(hash) % 360;
        return "hsl(" + hue + ", 70%, 50%)";
    }

    /**
     * Derives initials from a given name string.
     * @param {string} name - The full name of the user.
     * @returns {string} Up to two uppercase characters representing the initials.
     */
    _initials(name) {
        if (!name) {
            return "?";
        }
        
        const parts = name.trim().split(/\s+/);
        
        if (parts.length === 1) {
            return parts[0].charAt(0).toUpperCase();
        }
        
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
};

// register the control with the controller for auto-instantiation
webexpress.webui.Controller.registerClass("wx-webapp-collaborative", webexpress.webapp.CollaborativeCtrl);