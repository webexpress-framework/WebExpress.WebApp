var webexpress = webexpress || {}
webexpress.webapp = webexpress.webapp || {}

/**
 * Keeps one shared document of one control consistent with the server, which sequences all
 * changes. The document is held three times over: the confirmed state the server acknowledged,
 * the operation in transit and the local changes buffered behind it. What the control shows is
 * always the confirmed state with both applied, so local typing appears without any network
 * delay while convergence never depends on the transformation being perfect: once nothing is
 * pending, the control shows exactly the server's state.
 *
 * The server only sequences, validates and stores; it never transforms. An operation based on an
 * outdated version is rejected together with the operations the client missed, and the client
 * transforms its pending changes against them and sends again. All transformation logic thereby
 * exists exactly once, in webexpress.webui.Ot.
 *
 * The class is DOM-free. The control is reached through the collaboration methods every shared
 * control implements (see webexpress.webui.EditorCtrl), the network through a send callback.
 */
webexpress.webapp.CollaborativeDocument = class {
    /**
     * The protocol version. A server answering with another major version is not talked to.
     */
    static PROTOCOL = 1;

    /**
     * The wire prefix of all operation messages.
     */
    static PREFIX = "webexpress.webapp.collaborative.ot.";

    /**
     * How many sequenced operations stay available for mapping remote selections that refer to
     * an older version.
     */
    static RECENT = 200;

    /**
     * Initializes a new instance of the class.
     * @param {object} options - The options.
     * @param {string} options.document - The document id.
     * @param {string} options.token - The access token the page was rendered with.
     * @param {string} options.client - The id of this client, unique per page load.
     * @param {string} options.secret - Proves on reconnection that the client is the same.
     * @param {object} options.target - The shared control.
     * @param {Function} options.send - Sends a message object to the server.
     * @param {Function} [options.onConflict] - Receives local changes that could not be merged.
     * @param {Function} [options.onSelections] - Called when remote selections moved.
     * @param {Function} [options.onStatus] - Receives "joining", "synced", "pending", "offline" and "error".
     */
    constructor(options) {
        this.id = options.document;
        this._token = options.token;
        this.client = options.client;
        this._secret = options.secret;
        this._target = options.target;
        this._send = options.send;
        this._onConflict = options.onConflict ?? (() => {});
        this._onSelections = options.onSelections ?? (() => {});
        this._onStatus = options.onStatus ?? (() => {});
        this.version = -1;
        this._confirmed = null;
        this._seed = null;
        this._display = null;
        this._inflight = null;
        this._buffer = [];
        this._seq = 0;
        this._held = new Map();
        this._recent = [];
        this._selections = new Map();
        this._waiting = new Map();
        this._online = false;
        this._status = null;
    }

    /**
     * Gets the remote selections in positions of the shown document.
     * @returns {Map<string, {anchor: number, focus: number}>} The selections by user.
     */
    get selections() { return this._selections; }

    /**
     * Gets whether local changes wait for confirmation.
     * @returns {boolean} True if changes are in transit or buffered.
     */
    get pending() { return !!this._inflight || this._buffer.length > 0; }

    /**
     * Joins the document, or resumes it after the connection came back. A first join offers the
     * control's content, which the server takes only for a document it does not know yet.
     */
    connect() {
        this._online = true;
        if (this._confirmed === null) {
            // the seed contains every local change so far; whatever happens to it, nothing stays pending
            this._display = webexpress.webui.Ot.expand(this._target.getCollaborationTokens());
            this._seed = this._display;
            this._inflight = null;
            this._buffer = [];
            this._message("join", { kind: this._target.collaborationKind, state: webexpress.webui.Ot.compact(this._display) });
            this._setStatus("joining");
        } else {
            this._message("resume", { version: this.version });
            this._setStatus("joining");
        }
    }

    /**
     * Pauses all transmission while the connection is down; local changes keep collecting.
     */
    disconnect() {
        this._online = false;
        this._setStatus("offline");
    }

    /**
     * Records local steps the control announced and sends them when nothing is in transit.
     * @param {Array<object>} steps - The applied steps.
     */
    local(steps) {
        if (!steps?.length || this._display === null) return;
        try {
            this._display = webexpress.webui.Ot.apply(this._display, steps).tokens;
        } catch {
            // the control and this copy disagree; the control's content is the user's truth
            this._display = webexpress.webui.Ot.expand(this._target.getCollaborationTokens());
            this._buffer = webexpress.webui.Ot.diff(this._pendingBase(), this._display);
            this._flush();
            return;
        }
        this._buffer.push(...steps);
        this._mapSelections(steps, -1);
        this._flush();
    }

    /**
     * Takes the control's content as the truth after the control signalled that it could not
     * follow the shown document; whatever differs becomes a pending local change.
     */
    resynchronize() {
        if (this._display === null) return;
        const Ot = webexpress.webui.Ot;
        const shown = Ot.expand(this._target.getCollaborationTokens());
        const steps = Ot.diff(this._display, shown);
        if (steps.length) this.local(Ot.apply(this._display, steps).steps);
    }

    /**
     * Processes a message from the server.
     * @param {object} message - The decoded message.
     */
    receive(message) {
        if (!message || message.document !== this.id || typeof message.type !== "string") return;
        // several sessions of one page share the connection; a reply names the one it is meant for
        if (message.to !== undefined && message.to !== this.client) return;
        if (Math.floor(Number(message.protocol) || 1) !== this.constructor.PROTOCOL) { this._setStatus("error"); return; }
        switch (message.type.slice(this.constructor.PREFIX.length)) {
            case "state": this._onState(message); break;
            case "operations": this._onOperations(message.operations ?? [], message.resumed === true); break;
            case "ack": this._onAck(message); break;
            case "reject": this._onReject(message); break;
        }
    }

    /**
     * Describes the local selection for the presence messages. Positions only mean something
     * together with a version, so a selection is offered only while no local change is pending;
     * the positions are then in the confirmed state every peer can reach.
     * @returns {{version: number, anchor: number, focus: number}|null} The selection, or null.
     */
    selection() {
        if (this.pending || this.version < 0) return null;
        const selection = this._target.getModelSelection?.();
        return selection ? { version: this.version, anchor: selection.anchor, focus: selection.focus } : null;
    }

    /**
     * Takes a peer's selection into the positions of the shown document.
     * @param {string} user - The peer.
     * @param {{version: number, anchor: number, focus: number}|null} selection - The peer's
     * selection, or null when the peer left the document.
     */
    remoteSelection(user, selection) {
        if (!selection || !Number.isInteger(selection.version)) {
            this._waiting.delete(user);
            if (this._selections.delete(user)) this._onSelections();
            return;
        }
        if (selection.version > this.version) { this._waiting.set(user, selection); return; }
        const Ot = webexpress.webui.Ot;
        const older = this._recent.filter(entry => entry.version > selection.version);
        if (older.length < this.version - selection.version) return;
        const steps = older.flatMap(entry => entry.steps).concat(this._pendingSteps());
        this._selections.set(user, Ot.mapSelection({ anchor: selection.anchor, focus: selection.focus }, steps, -1));
        this._waiting.delete(user);
        this._onSelections();
    }

    /**
     * Gives up the local changes that could not be merged and loads the server's state, or
     * the opposite: takes over the local version as a new change. Called by the user's choice
     * after onConflict.
     * @param {Array<object>} tokens - The packed tokens of the local version to take over.
     */
    adopt(tokens) {
        const Ot = webexpress.webui.Ot;
        const steps = Ot.diff(this._display, Ot.expand(tokens));
        if (!steps.length) return;
        if (!this._target.applyRemoteSteps(steps)) this._target.loadCollaborationTokens(tokens);
        this.local(Ot.apply(this._display, steps).steps);
    }

    /**
     * Sends a message with the routing fields every operation message carries.
     * @param {string} type - The message type without prefix.
     * @param {object} payload - The fields.
     */
    _message(type, payload) {
        if (!this._online) return;
        this._send({
            type: this.constructor.PREFIX + type, protocol: this.constructor.PROTOCOL,
            document: this.id, token: this._token, client: this.client, secret: this._secret, ...payload
        });
    }

    /**
     * Reports a status change once.
     * @param {string} status - The status.
     */
    _setStatus(status) {
        if (this._status === status) return;
        this._status = status;
        this._onStatus(status);
    }

    /**
     * Sends the buffered steps as the next operation when nothing is in transit.
     */
    _flush() {
        if (this._inflight || !this._buffer.length || !this._online || this._confirmed === null) {
            this._setStatus(this._online ? this.pending ? "pending" : "synced" : "offline");
            return;
        }
        this._inflight = { id: this.client + ":" + (this._seq + 1), client: this.client, seq: ++this._seq, base: this.version, steps: this._buffer };
        this._buffer = [];
        this._submit();
    }

    /**
     * Sends the operation in transit.
     */
    _submit() {
        this._inflight.base = this.version;
        this._message("submit", { operations: [webexpress.webui.Ot.clone(this._inflight)] });
        this._setStatus("pending");
    }

    /**
     * Returns the document the buffered steps are based on.
     * @returns {Array<object>} The confirmed state with the operation in transit applied.
     */
    _pendingBase() {
        return this._inflight ? webexpress.webui.Ot.apply(this._confirmed, this._inflight.steps).tokens : this._confirmed;
    }

    /**
     * Returns all steps not yet confirmed, in order.
     * @returns {Array<object>} The steps.
     */
    _pendingSteps() { return (this._inflight?.steps ?? []).concat(this._buffer); }

    /**
     * Takes over a complete state: the answer to a first join, or a forced resynchronization
     * when the server no longer holds the history a resume needs. Pending local changes are
     * merged onto the new state as far as possible; what cannot be merged is offered back.
     * @param {object} message - The state message.
     */
    _onState(message) {
        const Ot = webexpress.webui.Ot;
        let theirs;
        try { theirs = Ot.expand(message.state); } catch { this._setStatus("error"); return; }
        const first = this._seed !== null;
        // a duplicated or late state must never take the document back to an older version
        if (!first && (!Number.isInteger(message.version) || message.version <= this.version)) {
            // the state is no news, but it answered a request whose operation in transit has an unknown fate
            if (this._inflight && Number.isInteger(message.version)) this._submit();
            return;
        }
        const before = this._display;
        let base = first ? this._seed : this._confirmed;
        let pending = first ? this._buffer : this._pendingSteps();
        this._seed = null;
        // the server tells how far each client got, so an operation it already applied is not merged twice
        const applied = message.clients?.[this.client];
        if (!first && this._inflight && Number.isInteger(applied) && applied >= this._inflight.seq) {
            base = Ot.apply(base, this._inflight.steps).tokens;
            pending = this._buffer;
        }
        if (!first && Number.isInteger(applied)) this._seq = Math.max(this._seq, applied);
        this._confirmed = theirs;
        this.version = message.version;
        this._inflight = null;
        this._buffer = [];
        this._recent = [];
        this._held.clear();
        let merged = theirs, lost = null;
        if (pending.length && Ot.equal(theirs, before)) pending = [];
        if (pending.length) {
            const [rebased] = Ot.transform(pending, Ot.diff(base, theirs), true);
            let raw = null;
            try { raw = Ot.apply(theirs, rebased).tokens; } catch { raw = null; }
            const repaired = raw && this._repair(raw);
            if (!repaired) { merged = theirs; lost = before; }
            else { merged = repaired; this._buffer = repaired === raw ? rebased : rebased.concat(Ot.diff(raw, repaired)); }
        }
        this._show(before, merged);
        this._selections.clear();
        this._onSelections();
        if (lost) this._onConflict({ document: this.id, local: Ot.compact(lost) });
        this._flush();
    }

    /**
     * Returns a document unchanged when it is valid and repaired otherwise.
     * @param {Array<object>} tokens - The document.
     * @returns {Array<object>|null} The same array when valid, a repaired one, or null.
     */
    _repair(tokens) {
        const Ot = webexpress.webui.Ot;
        if (this._target.checkCollaborationTokens(Ot.compact(tokens))) return tokens;
        const repaired = this._target.repairCollaborationTokens(Ot.compact(tokens));
        return repaired && this._target.checkCollaborationTokens(repaired) ? Ot.expand(repaired) : null;
    }

    /**
     * Brings the control from the shown document to a new one, with the smallest steps the
     * diff finds, and falls back to a complete load when the control refuses them.
     * @param {Array<object>} before - The shown document.
     * @param {Array<object>} after - The new document.
     * @param {Array<object>} [steps] - Steps known to lead from before to after.
     */
    _show(before, after, steps = null) {
        const Ot = webexpress.webui.Ot;
        const delta = steps ?? Ot.diff(before, after);
        this._display = after;
        if (!delta.length) return;
        if (!this._target.applyRemoteSteps(delta)) this._target.loadCollaborationTokens(Ot.compact(after));
        this._mapSelections(delta, -1);
    }

    /**
     * Processes sequenced operations in version order. A gap means messages overtook each other
     * or got lost; later operations wait while the missing ones are requested.
     * @param {Array<object>} operations - The operations.
     * @param {boolean} resumed - Whether this answers a resume, after which the operation in
     * transit is sent again because its fate is unknown.
     */
    _onOperations(operations, resumed) {
        for (const op of operations) if (Number.isInteger(op?.version) && op.version > this.version) this._held.set(op.version, op);
        let gap = false;
        while (this._held.size) {
            const op = this._held.get(this.version + 1);
            if (!op) { gap = true; break; }
            this._held.delete(op.version);
            this._sequenced(op);
        }
        if (gap) { this._message("resume", { version: this.version }); return; }
        if (resumed && this._inflight) this._submit();
        for (const [user, selection] of [...this._waiting]) this.remoteSelection(user, selection);
        this._flush();
    }

    /**
     * Applies one operation in sequence: the own operation in transit counts as acknowledged,
     * any other is a remote change.
     * @param {object} op - The operation with its version.
     */
    _sequenced(op) {
        if (op.client === this.client && this._inflight && op.seq === this._inflight.seq) { this._acknowledge(op.version); return; }
        if (op.client === this.client && op.seq <= this._seq) {
            // an own operation from before a reload of this page state; it is already contained
            this._confirmed = webexpress.webui.Ot.apply(this._confirmed, op.steps).tokens;
            this.version = op.version;
            this._remember(op.version, op.steps);
            return;
        }
        this._remote(op);
    }

    /**
     * Rebases the pending changes onto a remote operation and shows the result.
     * @param {object} op - The remote operation.
     */
    _remote(op) {
        const Ot = webexpress.webui.Ot;
        let confirmed;
        try { confirmed = Ot.apply(this._confirmed, op.steps).tokens; } catch { this._message("resume", { version: -1 }); return; }
        this._confirmed = confirmed;
        this.version = op.version;
        this._remember(op.version, op.steps);
        // the fixed order: the client id sorting first wins ties on every client alike
        const localFirst = this.client < op.client;
        let incoming = op.steps;
        const before = this._display;
        if (this._inflight) {
            const [inflight, rest] = Ot.transform(this._inflight.steps, incoming, localFirst);
            this._inflight.steps = inflight; incoming = rest;
        }
        if (this._buffer.length) {
            const [buffer, rest] = Ot.transform(this._buffer, incoming, localFirst);
            this._buffer = buffer; incoming = rest;
        }
        // the transformed steps are kept as they are: a diff of the result would describe the same
        // document, but with repeated characters it may place an insertion inside another user's
        // text, which misleads undo and cursor mapping afterwards; only a repair is appended
        let expected = null, shown = null;
        try {
            const raw = Ot.apply(this._confirmed, this._inflight?.steps ?? []).tokens;
            expected = this._repair(raw);
            if (expected && expected !== raw) {
                const fix = Ot.diff(raw, expected);
                if (this._inflight) this._inflight.steps = this._inflight.steps.concat(fix);
                // the buffered steps behind a repaired base are rebased over the repair
                this._buffer = Ot.transform(this._buffer, fix, true)[0];
            }
            if (expected) {
                const rawShown = Ot.apply(expected, this._buffer).tokens;
                shown = this._repair(rawShown);
                if (shown && shown !== rawShown) this._buffer = this._buffer.concat(Ot.diff(rawShown, shown));
            }
        } catch { expected = null; shown = null; }
        let target;
        if (!shown) {
            // nothing valid remains of the pending changes; they are offered back, not dropped silently
            this._onConflict({ document: this.id, local: Ot.compact(before) });
            this._inflight = null; this._buffer = [];
            target = this._confirmed;
        } else {
            // the server sequenced the remote operation on the base ours was sent with, so ours was
            // certainly rejected; an operation that became empty need not be sent again
            if (this._inflight && !this._inflight.steps.length) this._inflight = null;
            target = shown;
        }
        let fits = false;
        try { fits = Ot.equal(Ot.apply(before, incoming).tokens, target); } catch { fits = false; }
        this._show(before, target, fits ? incoming : null);
    }

    /**
     * Confirms the operation in transit.
     * @param {number} version - The version the server assigned.
     */
    _acknowledge(version) {
        if (!this._inflight) return;
        this._confirmed = webexpress.webui.Ot.apply(this._confirmed, this._inflight.steps).tokens;
        this.version = version;
        this._remember(version, this._inflight.steps);
        this._inflight = null;
    }

    /**
     * Keeps the steps of a sequenced version for mapping late remote selections.
     * @param {number} version - The version.
     * @param {Array<object>} steps - Its steps.
     */
    _remember(version, steps) {
        this._recent.push({ version, steps });
        if (this._recent.length > this.constructor.RECENT) this._recent.shift();
    }

    /**
     * Processes the acknowledgement of the operation in transit.
     * @param {object} message - The ack message.
     */
    _onAck(message) {
        for (const entry of message.operations ?? []) {
            if (!this._inflight || entry.seq !== this._inflight.seq) continue;
            if (entry.version === this.version + 1) this._acknowledge(entry.version);
            // operations sequenced before ours are still on their way; ours waits in line
            else if (entry.version > this.version + 1) this._held.set(entry.version, { ...this._inflight, version: entry.version });
        }
        this._onOperations([], false);
    }

    /**
     * Processes a rejection. An outdated base is answered by catching up and sending again; an
     * operation the server found invalid can never succeed and is withdrawn, with the local
     * version offered to the user instead of being dropped silently.
     * @param {object} message - The reject message.
     */
    _onReject(message) {
        if (message.reason === "version") {
            // the server no longer holds the history behind an old base and sends its state instead
            if (message.state && message.version > this.version) { this._onState(message); return; }
            this._onOperations(message.operations ?? [], false);
            // a rejection of an earlier submission of an operation that has since been confirmed or withdrawn needs no answer
            if (this._inflight && message.seq === this._inflight.seq && !this._held.size) this._submit();
            return;
        }
        if (message.reason === "unknown") {
            // the server lost the document; the shown version seeds it again, and should another
            // instance know it after all, the pending changes merge from the last confirmed base
            const base = this._confirmed, pending = this._pendingSteps();
            this._confirmed = null;
            this.connect();
            if (base) { this._seed = base; this._buffer = pending; }
            return;
        }
        if (message.reason !== "forbidden" && (!this._inflight || message.seq !== this._inflight.seq)) return;
        const before = this._display;
        this._inflight = null;
        this._buffer = [];
        this._show(before, this._confirmed);
        this._setStatus(message.reason === "forbidden" ? "error" : "synced");
        if (message.reason !== "forbidden") this._onConflict({ document: this.id, local: webexpress.webui.Ot.compact(before) });
    }

    /**
     * Moves the known remote selections along a change of the shown document.
     * @param {Array<object>} steps - The steps applied to the shown document.
     * @param {number} assoc - The side the selections stick to.
     */
    _mapSelections(steps, assoc) {
        if (!this._selections.size) return;
        for (const [user, selection] of this._selections) this._selections.set(user, webexpress.webui.Ot.mapSelection(selection, steps, assoc));
        this._onSelections();
    }
};
