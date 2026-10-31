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
 * Controls that share a document (the rich text editor, the graph editor, the WQL prompt - every
 * control implementing the collaboration methods, see webexpress.webui.EditorCtrl) are edited
 * concurrently through operational transformation when the container names a document scope
 * and carries the access token the server rendered for it (data-collaborative-document,
 * data-collaborative-token). Each such control gets a webexpress.webapp.CollaborativeDocument
 * session that exchanges operations instead of whole contents; the controls stay unaware of
 * this framework and are coupled only through their collaboration methods and events. Plain
 * input fields keep being synchronized by value.
 *
 * Dispatched custom events (CustomEvent on the host element, bubbles):
 * - webexpress.webapp.Event.COLLABORATIVE_USER_JOIN
 * - webexpress.webapp.Event.COLLABORATIVE_USER_LEAVE
 * - webexpress.webapp.Event.COLLABORATIVE_CURSOR
 * - webexpress.webapp.Event.COLLABORATIVE_INPUT
 * - webexpress.webapp.Event.COLLABORATIVE_CONFLICT
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
     * How long rich-text changes of one field are coalesced before the markup
     * is broadcast, in milliseconds. A text field sends one message per
     * keystroke because its value is a short string; a document is the whole
     * markup of the surface and would saturate the queue at that rate.
     * @type {number}
     */
    static RICH_INPUT_INTERVAL = 250;

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

        // shared documents: the scope and the token the server signed for it; without both the
        // controls inside keep the value synchronization
        this._documentScope = element.dataset.collaborativeDocument || "";
        this._documentToken = element.dataset.collaborativeToken || "";
        this._sessions = new Map();
        this._onQueueStatus = (e) => this._onConnectionStatus(e.detail?.status);
        document.addEventListener(webexpress.webapp.Event.CHANGE_STATUS_EVENT, this._onQueueStatus);

        // the rich-text updates waiting for the next coalescing interval, keyed by field
        this._pendingRichInput = new Map();
        this._richInputTimer = 0;

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

        // gracefully leave on tab close
        this._beforeUnload = () => {
            this._sendPresence("leave");
        };
        window.addEventListener("beforeunload", this._beforeUnload);

        // presence means "is looking at this", and a closed dialog is not looking. A container
        // inside one therefore joins when the dialog opens and leaves when it closes, so the
        // people shown are the ones who actually have the document in front of them rather than
        // everybody who happens to have loaded the page it can be opened from. Everywhere else
        // the container is the surface, and joining is immediate.
        //
        // The ancestor is matched on the element as well as on both class names, because the
        // controller registry initializes children before their parents: at this moment the
        // dialog still carries the class it was authored with - the framework's modal class, or
        // that of a controller derived from it, as the document editor's is - and only becomes
        // ".modal" when its own controller runs.
        this._dialog = element.closest("dialog, .modal, .wx-webui-modal");

        if (this._dialog) {
            this._onDialogShow = () => this._activate();
            this._onDialogHide = () => this._deactivate();

            this._dialog.addEventListener(webexpress.webui.Event.MODAL_SHOW_EVENT, this._onDialogShow);
            this._dialog.addEventListener(webexpress.webui.Event.MODAL_HIDE_EVENT, this._onDialogHide);
        } else {
            this._activate();
        }

        this.render();
    }

    /**
     * Joins the channel and starts telling the peers that this client is here.
     * @returns {void}
     */
    _activate() {
        if (this._active) {
            return;
        }

        this._active = true;
        this._sendPresence("join");
        this._attachDocuments();

        this._heartbeat = setInterval(() => {
            this._sendPresence("ping");
            this._reapStaleUsers();
        }, 5000);
    }

    /**
     * Leaves the channel and forgets the peers.
     *
     * What was known about them is dropped rather than kept, because it is only true while this
     * client is listening: a peer who leaves in the meantime would otherwise still be shown on
     * the next open, with no message coming to correct it.
     * @returns {void}
     */
    _deactivate() {
        if (!this._active) {
            return;
        }

        this._active = false;
        this._sendPresence("leave");
        this._detachDocuments();

        clearInterval(this._heartbeat);
        this._heartbeat = 0;

        this._remoteUsers.clear();
        this._remoteCursors.clear();
        this._remoteCarets.clear();

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
        this._deactivate();
        
        if (this._queue) {
            this._queue.unregister(this._messageHandler);
        }
        
        if (this._dialog) {
            this._dialog.removeEventListener(webexpress.webui.Event.MODAL_SHOW_EVENT, this._onDialogShow);
            this._dialog.removeEventListener(webexpress.webui.Event.MODAL_HIDE_EVENT, this._onDialogHide);
        }

        this._unbindLocalEvents();
        window.removeEventListener("beforeunload", this._beforeUnload);
        document.removeEventListener(webexpress.webapp.Event.CHANGE_STATUS_EVENT, this._onQueueStatus);
        this._conflict?.remove();
        clearInterval(this._heartbeat);
        
        if (this._cursorRafId) {
            cancelAnimationFrame(this._cursorRafId);
        }
        
        if (this._richInputTimer) {
            clearTimeout(this._richInputTimer);
            this._richInputTimer = 0;
        }

        this._pendingRichInput.clear();

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
     *
     * The cursors and carets are overlays of the shared area and can only live inside it, but who
     * is here is a fact about the whole surface rather than about the area they happen to point
     * at. A host that has a better place for it - a dialog footer bar, say - names that place
     * through data-collaborative-presence-host, and the bar is docked there instead: still built,
     * filled and torn down here, so nothing of the presence rendering is duplicated for it.
     */
    _initOverlayDOM() {
        this._presenceBar = document.createElement("div");
        this._presenceBar.className = "wx-collaborative-presence";

        this._cursorLayer = document.createElement("div");
        this._cursorLayer.className = "wx-collaborative-cursors";

        this._caretLayer = document.createElement("div");
        this._caretLayer.className = "wx-collaborative-carets";

        const hostId = this._element.dataset.collaborativePresenceHost;
        const host = hostId ? document.getElementById(hostId) : null;

        if (host) {
            // the docked bar is laid out by whatever it was docked into, so it drops the
            // absolute placement it has as an overlay of the shared area
            this._presenceBar.classList.add("wx-collaborative-presence-docked");
            host.appendChild(this._presenceBar);
        } else {
            this._element.appendChild(this._presenceBar);
        }

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

        const isFormField = target.tagName === "INPUT" || target.tagName === "TEXTAREA";
        const isEditable = target.isContentEditable === true;

        if (!isFormField && !isEditable) {
            return;
        }

        const fieldId = this._fieldIdentifier(target);
        if (!fieldId || this._sharedField(target)) {
            return;
        }

        if (this._suppressInput.has(fieldId)) {
            return;
        }

        if (isFormField) {
            const value = target.value != null ? target.value : "";
            const selectionStart = typeof target.selectionStart === "number" ? target.selectionStart : null;
            const selectionEnd = typeof target.selectionEnd === "number" ? target.selectionEnd : null;

            this._sendInput(fieldId, value, selectionStart, selectionEnd);

            return;
        }

        // a rich-text surface is broadcast as markup, and the caret offset that travels with it
        // is counted in plain text characters - the same unit selectionStart uses - so one
        // remote beam implementation serves both kinds of field
        const caret = this._localContentEditableCaret(target);

        // a document is orders of magnitude larger than a text field, and every keystroke
        // rewrites all of it; coalescing turns a burst of typing into one message per interval
        this._queueRichInput(fieldId, target, caret);
    }

    /**
     * Returns the local caret offset inside a contenteditable element, or null when the
     * selection is not in it.
     * @param {HTMLElement} target - The contenteditable element.
     * @returns {number|null} The plain text offset of the caret.
     */
    _localContentEditableCaret(target) {
        const selection = window.getSelection ? window.getSelection() : null;

        if (!selection || selection.rangeCount === 0) {
            return null;
        }

        const range = selection.getRangeAt(0);

        if (!target.contains(range.startContainer)) {
            return null;
        }

        return this._contentEditableOffset(target, range.startContainer, range.startOffset);
    }

    /**
     * Coalesces rich-text updates of one field and sends the latest state per interval.
     * @param {string} fieldId - The identifier of the field.
     * @param {HTMLElement} target - The contenteditable element to read on send.
     * @param {number|null} caret - The caret offset at the time of the change.
     * @returns {void}
     */
    _queueRichInput(fieldId, target, caret) {
        this._pendingRichInput.set(fieldId, { target, caret });

        if (this._richInputTimer) {
            return;
        }

        this._richInputTimer = setTimeout(() => {
            this._richInputTimer = 0;

            for (const [id, pending] of this._pendingRichInput) {
                // read the markup at send time rather than at queue time, so the message
                // carries the state the typing actually ended on
                this._sendInput(id, pending.target.innerHTML, pending.caret, pending.caret);
            }

            this._pendingRichInput.clear();
        }, webexpress.webapp.CollaborativeCtrl.RICH_INPUT_INTERVAL);
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

        if (!this._element.contains(target)) {
            return;
        }

        const shared = this._sharedField(target);
        if (shared) {
            this._sendModelCaret(shared);
            return;
        }

        const isInputField = target.tagName === "INPUT" || target.tagName === "TEXTAREA";
        const isEditable = target.isContentEditable;
        if (!isInputField && !isEditable) {
            return;
        }

        const fieldId = this._fieldIdentifier(target);
        if (!fieldId) {
            return;
        }

        let selectionStart = null;
        let selectionEnd = null;

        if (isInputField) {
            selectionStart = typeof target.selectionStart === "number"
                ? target.selectionStart
                : null;
            selectionEnd = typeof target.selectionEnd === "number"
                ? target.selectionEnd
                : selectionStart;
        } else {
            const selection = window.getSelection ? window.getSelection() : null;
            if (!selection || selection.rangeCount === 0) {
                return;
            }
            const range = selection.getRangeAt(0);
            if (!target.contains(range.startContainer)) {
                return;
            }
            selectionStart = this._contentEditableOffset(target, range.startContainer, range.startOffset);
            selectionEnd = this._contentEditableOffset(target, range.endContainer, range.endOffset);
        }

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

        const shared = this._sharedField(target);
        if (shared) {
            // focus moving within the shared control is no departure from it
            if (!shared.element.contains(document.activeElement) || document.activeElement === target) {
                this._sendCaret(shared.element.id, -1, -1);
            }
            return;
        }

        const isInputField = target.tagName === "INPUT" || target.tagName === "TEXTAREA";
        const isEditable = target.isContentEditable;
        if (!isInputField && !isEditable) {
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
     * For editable elements without an id of their own (typically the inner
     * <c>contenteditable</c> of a WebUI EditorCtrl), the nearest ancestor id
     * inside the collaborative container is used so peers can still address
     * the field consistently.
     * @param {HTMLElement} el - The element to identify.
     * @returns {string|null} The identifier string or null if not identifiable.
     */
    _fieldIdentifier(el) {
        if (!el) {
            return null;
        }
        if (el.id) {
            return el.id;
        }
        if (el.isContentEditable) {
            let p = el.parentElement;
            while (p && p !== this._element && !p.id) {
                p = p.parentElement;
            }
            if (p && p.id && this._element.contains(p)) {
                return p.id;
            }
        }
        return null;
    }

    /**
     * Resolves a fieldId back to the actual editable element. Inputs and
     * textareas are returned directly; for ids that belong to a wrapper
     * element (e.g. EditorCtrl's host), the contained
     * <c>[contenteditable="true"]</c> descendant is returned instead.
     * @param {string} fieldId - The field identifier.
     * @returns {HTMLElement|null} The editable element or null.
     */
    _resolveField(fieldId) {
        if (!fieldId) {
            return null;
        }
        const root = this._element.querySelector("#" + CSS.escape(fieldId));
        if (!root || !this._element.contains(root)) {
            return null;
        }
        if (root.tagName === "INPUT" || root.tagName === "TEXTAREA") {
            return root;
        }
        if (root.isContentEditable) {
            return root;
        }
        const editable = root.querySelector("[contenteditable=\"true\"]");
        if (editable && this._element.contains(editable)) {
            return editable;
        }
        return null;
    }

    /**
     * Writes markup a peer sent into a local rich-text surface.
     *
     * The write goes through the editor controller when the surface belongs to one, rather
     * than through the DOM: the controller re-frames the blocks its plugins own (tables,
     * add-ons), keeps the hidden form input the surface submits through in sync, and leaves
     * an undo history that still matches what is on screen. Writing innerHTML directly would
     * leave all three stale, and the surface would submit the value it had before the peer
     * wrote.
     *
     * @param {HTMLElement} field - The contenteditable element receiving the markup.
     * @param {string} markup - The markup to apply.
     * @returns {void}
     */
    _applyRemoteMarkup(field, markup) {
        const host = field.closest(".wx-editor");
        const controller = host && webexpress.webui.Controller
            ? webexpress.webui.Controller.getInstanceByElement(host)
            : null;

        if (controller && "value" in controller) {
            controller.value = markup;

            return;
        }

        // the markup comes from a peer, so it is parsed inert and cleaned before it goes live
        const template = document.createElement("template");
        template.innerHTML = markup;
        field.replaceChildren(webexpress.webui.EditorHtml.clean(template.content || template));
        field.dispatchEvent(new Event("input", { bubbles: true }));
    }

    /**
     * Returns the text offset of the given DOM position inside the
     * specified contenteditable element. Counts the plain text characters
     * that precede the caret, matching the offset semantics used by
     * <c>input.selectionStart</c>.
     * @param {HTMLElement} root - The contenteditable container.
     * @param {Node} node - The DOM node the caret currently resides in.
     * @param {number} offset - The offset within <paramref name="node"/>.
     * @returns {number} The plain text character offset.
     */
    _contentEditableOffset(root, node, offset) {
        const range = document.createRange();
        range.selectNodeContents(root);
        try {
            range.setEnd(node, offset);
        } catch (e) {
            return 0;
        }
        return range.toString().length;
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
     * @param {object} [model] - The selection of a shared control as model positions and the
     * version they refer to.
     */
    _sendCaret(fieldId, selectionStart, selectionEnd, model = undefined) {
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
            model: model,
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
        
        // operations of shared documents are addressed to a document, not to the container
        if (typeof payload.type === "string" && payload.type.startsWith(webexpress.webapp.CollaborativeDocument?.PREFIX ?? "\u0000")) {
            for (const shared of this._sessions.values()) {
                shared.session.receive(payload);
            }
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
                this._forgetSelections(msg.userId);
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

        if (this._sessions.has(msg.fieldId)) {
            return;
        }

        const field = this._resolveField(msg.fieldId);
        if (!field) {
            // field is no longer available locally - drop any stale caret state
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

        // a field the local user is typing in is never overwritten: their caret and their
        // last keystrokes would be lost to a message that was already in flight when they
        // started. The state converges when they leave the field, which is the last write.
        const isFormField = field.tagName === "INPUT" || field.tagName === "TEXTAREA";

        if (document.activeElement !== field) {
            this._suppressInput.add(msg.fieldId);

            try {
                if (isFormField) {
                    field.value = msg.value != null ? msg.value : "";
                    // emit native event to ensure frameworks or bindings can react
                    field.dispatchEvent(new Event("input", { bubbles: true }));
                } else if (field.isContentEditable) {
                    this._applyRemoteMarkup(field, msg.value != null ? msg.value : "");
                }
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

        const shared = this._sessions.get(msg.fieldId);
        if (shared) {
            for (const other of this._sessions.values()) {
                if (other !== shared) {
                    other.session.remoteSelection(msg.userId, null);
                }
            }
            const model = typeof msg.selectionStart === "number" && msg.selectionStart < 0 ? null : msg.model;
            if (model) {
                this._remoteCarets.set(msg.userId, {
                    fieldId: msg.fieldId,
                    model: true,
                    color: msg.userColor || this._pickAutoColor(msg.userId),
                    name: msg.userName || msg.userId
                });
            } else {
                this._remoteCarets.delete(msg.userId);
            }
            shared.session.remoteSelection(msg.userId, model ?? null);
            this._renderCarets();
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

        const field = this._resolveField(msg.fieldId);
        if (!field) {
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
     * Counts the shared sessions of this page; each gets a client id of its own.
     */
    static _sessionCount = 0;

    /**
     * Returns the identity of this page in shared documents: a client id, the secret that proves
     * it on reconnection, and the tag that keeps node ids this client creates unique.
     * @returns {{client: string, secret: string, tag: string}} The identity.
     */
    static identity() {
        if (!webexpress.webapp.CollaborativeCtrl._identity) {
            const random = (length) => {
                const values = typeof crypto !== "undefined" && crypto.getRandomValues
                    ? Array.from(crypto.getRandomValues(new Uint8Array(length)))
                    : Array.from({ length }, () => Math.floor(Math.random() * 256));
                return values.map((v) => (v % 36).toString(36)).join("");
            };
            webexpress.webapp.CollaborativeCtrl._identity = { client: "c" + random(16), secret: random(32), tag: random(6) };
        }
        return webexpress.webapp.CollaborativeCtrl._identity;
    }

    /**
     * Connects every shared control inside the container to its document. A control shares a
     * document when it implements the collaboration methods; it is addressed by the scope of
     * the container and its own element id.
     */
    _attachDocuments() {
        if (!this._documentScope || !this._documentToken || !webexpress.webapp.CollaborativeDocument || !webexpress.webui.Controller?.instanceMap) {
            return;
        }

        for (const [element, ctrl] of webexpress.webui.Controller.instanceMap) {
            if (element === this._element || !this._element.contains(element) || !element.id || this._sessions.has(element.id)) {
                continue;
            }
            if (typeof ctrl?.collaborationKind !== "string" || typeof ctrl.applyRemoteSteps !== "function" || typeof ctrl.beginCollaboration !== "function") {
                continue;
            }
            this._attachDocument(element, ctrl);
        }
    }

    /**
     * Connects one shared control.
     * @param {HTMLElement} element - The control's element.
     * @param {object} ctrl - The control.
     */
    _attachDocument(element, ctrl) {
        const identity = webexpress.webapp.CollaborativeCtrl.identity();
        const shared = { element, ctrl, session: null, listener: null };

        ctrl.beginCollaboration({ tag: identity.tag });

        // comment anchors travel with the document; their texts stay in the named comment control
        const comments = this._element.dataset.collaborativeComments;
        const commentCtrl = comments && webexpress.webui.Controller.getInstanceByElement(document.getElementById(comments));
        if (commentCtrl?.anchorStore && "commentStore" in ctrl) {
            ctrl.commentStore = commentCtrl.anchorStore;
            shared.commentStore = true;
        }

        shared.session = new webexpress.webapp.CollaborativeDocument({
            document: this._documentScope + "/" + element.id,
            token: this._documentToken,
            // one client per session: two shared controls of a page share the connection, not the sequence
            client: identity.client + "-" + (++webexpress.webapp.CollaborativeCtrl._sessionCount),
            secret: identity.secret,
            target: ctrl,
            send: (message) => this._queue && this._queue.send(message),
            onConflict: (conflict) => this._showConflict(shared, conflict),
            onSelections: () => this._renderCarets(),
            onStatus: (status) => this._onDocumentStatus(shared, status)
        });

        shared.listener = (e) => {
            if (e.detail?.sender !== element) {
                return;
            }
            if (e.detail.resync) {
                shared.session.resynchronize();
            } else {
                shared.session.local(e.detail.steps);
            }
            this._sendModelCaret(shared);
        };

        element.addEventListener(webexpress.webui.Event.COLLABORATION_STEPS_EVENT, shared.listener);
        this._sessions.set(element.id, shared);

        if (this._canSend()) {
            shared.session.connect();
        }
    }

    /**
     * Disconnects all shared controls; they continue as unshared controls.
     */
    _detachDocuments() {
        for (const shared of this._sessions.values()) {
            shared.element.removeEventListener(webexpress.webui.Event.COLLABORATION_STEPS_EVENT, shared.listener);
            shared.session.disconnect();
            shared.ctrl.endCollaboration?.();
            if (shared.commentStore) {
                shared.ctrl.commentStore = null;
            }
            shared.element.removeAttribute("data-wx-collaboration");
        }
        this._sessions.clear();
    }

    /**
     * Follows the connection: sessions pause while it is down and resume, catching up on what
     * they missed, once it is back.
     * @param {string} status - The status of the message queue.
     */
    _onConnectionStatus(status) {
        for (const shared of this._sessions.values()) {
            if (status === "online") {
                shared.session.connect();
            } else if (status === "offline" || status === "error") {
                shared.session.disconnect();
            }
        }
    }

    /**
     * Shows the synchronization state on the control and announces the selection once the
     * positions it refers to are confirmed.
     * @param {object} shared - The shared control.
     * @param {string} status - The session status.
     */
    _onDocumentStatus(shared, status) {
        shared.element.setAttribute("data-wx-collaboration", status);

        const label = ["pending", "offline", "error"].includes(status)
            ? webexpress.webui.I18N.translate("webexpress.webapp:collaborative.status." + status)
            : "";

        if (label) {
            shared.element.setAttribute("title", label);
        } else {
            shared.element.removeAttribute("title");
        }

        if (status === "synced") {
            this._sendModelCaret(shared);
        }
    }

    /**
     * Finds the shared control an element belongs to.
     * @param {Node} target - The element.
     * @returns {object|null} The shared control, or null.
     */
    _sharedField(target) {
        for (const shared of this._sessions.values()) {
            if (shared.element === target || shared.element.contains(target)) {
                return shared;
            }
        }
        return null;
    }

    /**
     * Sends the selection of a shared control while it has the focus.
     * @param {object} shared - The shared control.
     */
    _sendModelCaret(shared) {
        if (!this._inputEnabled || !shared.element.contains(document.activeElement)) {
            return;
        }

        const model = shared.session.selection();
        if (model) {
            this._sendCaret(shared.element.id, 0, 0, model);
        }
    }

    /**
     * Forgets the selections of a user who left.
     * @param {string} userId - The user.
     */
    _forgetSelections(userId) {
        for (const shared of this._sessions.values()) {
            shared.session.remoteSelection(userId, null);
        }
    }

    /**
     * Draws a remote caret and selection in a shared control. The positions were transformed
     * through every change since they were sent and are converted to coordinates only now.
     * @param {string} id - The user.
     * @param {object} caret - The caret state.
     */
    _renderModelCaret(id, caret) {
        const shared = this._sessions.get(caret.fieldId);
        const selection = shared?.session.selections.get(id);
        const rect = selection && shared.ctrl.getModelPositionRect?.(selection.focus);
        const layer = this._caretLayer.getBoundingClientRect();

        let node = this._caretLayer.querySelector(".wx-collaborative-caret[data-user-id=\"" + CSS.escape(id) + "\"]");

        if (!rect) {
            node?.remove();
            return;
        }

        if (!node) {
            node = document.createElement("div");
            node.className = "wx-collaborative-caret";
            node.setAttribute("data-user-id", id);
            const label = document.createElement("span");
            label.className = "wx-collaborative-caret-label";
            node.appendChild(label);
            this._caretLayer.appendChild(node);
        }

        node.style.left = (rect.left - layer.left) + "px";
        node.style.top = (rect.top - layer.top) + "px";
        node.style.height = (rect.height || 16) + "px";
        node.style.backgroundColor = caret.color;

        const label = node.querySelector(".wx-collaborative-caret-label");
        label.style.backgroundColor = caret.color;
        label.textContent = caret.name;

        for (const box of shared.ctrl.getModelRangeRects?.(selection.anchor, selection.focus) ?? []) {
            const mark = document.createElement("div");
            mark.className = "wx-collaborative-selection";
            mark.setAttribute("data-user-id", id);
            mark.style.left = (box.left - layer.left) + "px";
            mark.style.top = (box.top - layer.top) + "px";
            mark.style.width = box.width + "px";
            mark.style.height = box.height + "px";
            mark.style.backgroundColor = caret.color;
            this._caretLayer.appendChild(mark);
        }
    }

    /**
     * Offers local changes the merge could not keep, instead of dropping them silently. The
     * user either keeps the shared version or takes over the own one as a new change.
     * @param {object} shared - The shared control.
     * @param {object} conflict - The conflict with the local version as packed tokens.
     */
    _showConflict(shared, conflict) {
        this._conflict?.remove();

        const notice = document.createElement("div");
        notice.className = "wx-collaborative-conflict";
        notice.setAttribute("role", "alert");

        const text = document.createElement("span");
        text.textContent = webexpress.webui.I18N.translate("webexpress.webapp:collaborative.conflict.message");
        notice.appendChild(text);

        const restore = document.createElement("button");
        restore.type = "button";
        restore.className = "btn btn-sm btn-primary";
        restore.textContent = webexpress.webui.I18N.translate("webexpress.webapp:collaborative.conflict.restore");
        restore.addEventListener("click", () => {
            shared.session.adopt(conflict.local);
            notice.remove();
        });
        notice.appendChild(restore);

        const dismiss = document.createElement("button");
        dismiss.type = "button";
        dismiss.className = "btn btn-sm btn-outline-secondary";
        dismiss.textContent = webexpress.webui.I18N.translate("webexpress.webapp:collaborative.conflict.dismiss");
        dismiss.addEventListener("click", () => notice.remove());
        notice.appendChild(dismiss);

        this._element.appendChild(notice);
        this._conflict = notice;

        this._dispatch(webexpress.webapp.Event.COLLABORATIVE_CONFLICT, {
            fieldId: shared.element.id,
            document: conflict.document,
            local: conflict.local
        });
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
     * arrives - cursor updates can fire many times per second.
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

        for (const node of Array.from(this._caretLayer.querySelectorAll(".wx-collaborative-selection"))) {
            node.remove();
        }

        for (const [id, caret] of this._remoteCarets) {
            if (caret.model) {
                this._renderModelCaret(id, caret);
                continue;
            }

            const field = this._resolveField(caret.fieldId);
            if (!field) {
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

        if (field.isContentEditable) {
            return this._measureCaretInEditable(field, position);
        }

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
     * Measures the caret position inside a <c>contenteditable</c> element
     * such as the inner editable area of a WebUI EditorCtrl. Walks the text
     * nodes to translate the plain text offset into a DOM Range and reads
     * its bounding rectangle.
     * @param {HTMLElement} field - The contenteditable element.
     * @param {number} position - The plain text offset of the caret.
     * @returns {{left: number, top: number, height: number} | null}
     */
    _measureCaretInEditable(field, position) {
        const safePos = Math.max(0, position);
        const range = document.createRange();
        const walker = document.createTreeWalker(field, NodeFilter.SHOW_TEXT);

        let consumed = 0;
        let placed = false;
        let node = walker.nextNode();
        while (node) {
            const len = node.nodeValue ? node.nodeValue.length : 0;
            if (consumed + len >= safePos) {
                const localOffset = Math.max(0, Math.min(safePos - consumed, len));
                range.setStart(node, localOffset);
                range.setEnd(node, localOffset);
                placed = true;
                break;
            }
            consumed += len;
            node = walker.nextNode();
        }

        if (!placed) {
            // caret is past the end of the text content; collapse at the end
            range.selectNodeContents(field);
            range.collapse(false);
        }

        // a collapsed range can yield an empty client rect at the start or
        // end of a block. The bounding rect of the range is then zeroed -
        // prefer the rect of the closest text node line when that happens.
        let rect = null;
        const clientRects = range.getClientRects();
        if (clientRects.length > 0) {
            rect = clientRects[0];
        } else {
            rect = range.getBoundingClientRect();
        }

        if (!rect || (rect.width === 0 && rect.height === 0 && rect.left === 0 && rect.top === 0)) {
            // fall back to the field's bounding rect (e.g. empty editor)
            const fallback = field.getBoundingClientRect();
            const style = getComputedStyle(field);
            const padTop = parseFloat(style.paddingTop) || 0;
            const padLeft = parseFloat(style.paddingLeft) || 0;
            const lh = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2 || 16;
            const layerRect = this._caretLayer.getBoundingClientRect();
            return {
                left: fallback.left - layerRect.left + padLeft,
                top: fallback.top - layerRect.top + padTop,
                height: lh
            };
        }

        const layerRect = this._caretLayer.getBoundingClientRect();
        const style = getComputedStyle(field);
        const height = rect.height
            || parseFloat(style.lineHeight)
            || parseFloat(style.fontSize) * 1.2
            || 16;

        return {
            left: rect.left - layerRect.left,
            top: rect.top - layerRect.top,
            height: height
        };
    }

    /**
     * Identifies and removes users that haven't sent a heartbeat recently.
     */
    _reapStaleUsers() {
        const cutoff = Date.now() - 12000;
        let changed = false;
        
        for (const [id, user] of this._remoteUsers) {
            if (user.lastSeen < cutoff) {
                this._forgetSelections(id);
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