var webexpress = webexpress || {}
webexpress.webapp = webexpress.webapp || {}

/**
 * Owns the text and the selection of a WQL prompt without depending on a browser or DOM, so the
 * text a user typed survives highlighting, completion and analysis unchanged — including
 * incomplete or invalid statements, which are ordinary editing states.
 *
 * Positions count UTF-16 code units, the unit of both JavaScript strings and the C# offsets the
 * WQL service reports. Line breaks are normalized to "\n" only where text enters the model
 * (setting, inserting, importing), so every offset sent to the server refers to the normalized text.
 *
 * The live state is a plain object; JSON is produced only for export or storage. Callers receive
 * frozen snapshots, so a stored state cannot change behind the model's back.
 */
webexpress.webapp.WqlPromptModel = class {
    static VERSION = 1;

    /**
     * Converts every line break form to "\n" at an input boundary.
     * @param {*} text - The incoming text; null and undefined read as empty.
     * @returns {string} The normalized text.
     */
    static normalize(text) {
        return String(text ?? "").replace(/\r\n?/g, "\n");
    }

    /**
     * Clamps a position to the text and keeps it out of a surrogate pair, so neither a caret nor
     * an edit can split a character outside the basic multilingual plane.
     * @param {string} text - The text the position refers to.
     * @param {number} offset - The requested position.
     * @param {number} [bias=-1] - -1 moves a position inside a pair to its start, 1 to its end.
     * @returns {number} A valid position.
     */
    static boundary(text, offset, bias = -1) {
        const value = Number.isFinite(offset) ? Math.max(0, Math.min(text.length, Math.trunc(offset))) : 0;
        return this._insidePair(text, value) ? value + (bias > 0 ? 1 : -1) : value;
    }

    /**
     * Finds the single range replacement that turns one text into another. A browser edit the
     * model could not see in advance is taken over this way; the caret disambiguates repeated
     * characters, so typing "a" in front of "a" is recorded at the caret and not behind it.
     * @param {string} before - The model text.
     * @param {string} after - The text found in the surface.
     * @param {number} [cursor] - The caret position in the new text, when known.
     * @returns {object|null} { from, to, text } in model coordinates, or null when both are equal.
     */
    static diff(before, after, cursor) {
        if (before === after) {
            return null;
        }
        const shortest = Math.min(before.length, after.length);
        let prefix = 0;
        while (prefix < shortest && before.charCodeAt(prefix) === after.charCodeAt(prefix)) {
            prefix++;
        }
        if (Number.isFinite(cursor)) {
            // an insertion ends at the caret, so the common prefix may not reach past its start
            prefix = Math.max(0, Math.min(prefix, cursor - Math.max(0, after.length - before.length)));
        }
        let suffix = 0;
        while (suffix < shortest - prefix
            && before.charCodeAt(before.length - 1 - suffix) === after.charCodeAt(after.length - 1 - suffix)) {
            suffix++;
        }
        if (prefix > 0 && this._insidePair(after, prefix)) {
            prefix--;
        }
        if (suffix > 0 && this._insidePair(after, after.length - suffix)) {
            suffix--;
        }
        return { from: prefix, to: before.length - suffix, text: after.slice(prefix, after.length - suffix) };
    }

    /**
     * Validates an imported or stored state once, before it can replace live text.
     * @param {object|string} input - A state object or its JSON form.
     * @returns {object} A plain state with normalized text and valid positions.
     * @throws {TypeError} When the input is not a state of the supported schema version.
     */
    static parse(input) {
        const raw = typeof input === "string" ? JSON.parse(input) : input;
        if (!raw || raw.version !== this.VERSION || typeof raw.text !== "string") {
            throw new TypeError("Invalid WQL prompt state or unsupported version.");
        }
        const text = this.normalize(raw.text);
        // the offsets of a non-normalized text move by the line breaks that collapse before them
        const map = (offset) => {
            const value = Number.isFinite(offset) ? Math.max(0, Math.min(raw.text.length, Math.trunc(offset))) : raw.text.length;
            return this.boundary(text, this.normalize(raw.text.slice(0, value)).length);
        };
        return {
            version: this.VERSION,
            text: text,
            selection: { anchor: map(raw.selection?.anchor), focus: map(raw.selection?.focus) },
            revision: Number.isSafeInteger(raw.revision) && raw.revision >= 0 ? raw.revision : 0
        };
    }

    /**
     * Tells whether a position falls between the two halves of a surrogate pair.
     * @param {string} text - The text.
     * @param {number} offset - The position.
     * @returns {boolean} True when the position would split a character.
     */
    static _insidePair(text, offset) {
        if (offset <= 0 || offset >= text.length) {
            return false;
        }
        const high = text.charCodeAt(offset - 1);
        const low = text.charCodeAt(offset);
        return high >= 0xD800 && high <= 0xDBFF && low >= 0xDC00 && low <= 0xDFFF;
    }

    /**
     * Creates a model from a text or from a state previously produced by parse() or toJSON().
     * A restored state keeps its revision, as no work can be pending for a model that just began.
     * @param {string|object} [initial=""] - The initial text or state.
     */
    constructor(initial = "") {
        if (initial !== null && typeof initial === "object") {
            const state = this.constructor.parse(initial);
            this._text = state.text;
            this._anchor = state.selection.anchor;
            this._focus = state.selection.focus;
            this._revision = state.revision;
        } else {
            this._text = this.constructor.normalize(initial);
            this._anchor = this._text.length;
            this._focus = this._text.length;
            this._revision = 0;
        }
        this._snapshot = null;
    }

    /**
     * Gets the normalized WQL text.
     * @returns {string} The text.
     */
    get text() {
        return this._text;
    }

    /**
     * Gets the revision, which counts actual text changes. Work started for a text, such as an
     * analysis request, compares it to decide whether its result still applies.
     * @returns {number} The text revision.
     */
    get revision() {
        return this._revision;
    }

    /**
     * Gets the selection; focus is the end the user moves, and the cursor the server analyses.
     * @returns {object} The frozen { anchor, focus } pair.
     */
    get selection() {
        return this.state.selection;
    }

    /**
     * Gets the cursor position reported to the WQL service.
     * @returns {number} The focus of the selection.
     */
    get cursor() {
        return this._focus;
    }

    /**
     * Gets an immutable snapshot of the complete state. Snapshots are shared until the next
     * change, so reading the state on every event costs no allocation.
     * @returns {object} The frozen { version, text, selection, revision } state.
     */
    get state() {
        if (!this._snapshot) {
            this._snapshot = Object.freeze({
                version: this.constructor.VERSION,
                text: this._text,
                selection: Object.freeze({ anchor: this._anchor, focus: this._focus }),
                revision: this._revision
            });
        }
        return this._snapshot;
    }

    /**
     * Gets the selection as an ordered range regardless of its direction.
     * @returns {number[]} [start, end] with start <= end.
     */
    bounds() {
        return [Math.min(this._anchor, this._focus), Math.max(this._anchor, this._focus)];
    }

    /**
     * Replaces a text range; every other editing operation is built on it, so text and selection
     * always change together. The range is widened rather than split at a surrogate pair.
     * @param {number} from - The start of the replaced range.
     * @param {number} to - The end of the replaced range.
     * @param {string} text - The inserted text; line breaks are normalized.
     * @param {object} [selection] - The resulting selection in new-text positions; a caret behind
     * the inserted text by default.
     * @returns {object|null} The frozen change { from, to, text, removed, before, after }, or null
     * when the text stays the same (the selection is applied either way).
     */
    replace(from, to, text, selection) {
        const model = this.constructor;
        const start = model.boundary(this._text, Math.min(from, to), -1);
        const end = model.boundary(this._text, Math.max(from, to), 1);
        const inserted = model.normalize(text);
        const next = this._text.slice(0, start) + inserted + this._text.slice(end);
        const caret = start + inserted.length;
        const anchor = selection ? selection.anchor : caret;
        const focus = selection ? (selection.focus ?? selection.anchor) : caret;
        if (next === this._text) {
            this.select(anchor, focus);
            return null;
        }
        const before = this.state;
        const removed = this._text.slice(start, end);
        this._text = next;
        this._anchor = model.boundary(next, anchor);
        this._focus = model.boundary(next, focus);
        this._revision++;
        this._snapshot = null;
        return Object.freeze({ from: start, to: end, text: inserted, removed: removed, before: before, after: this.state });
    }

    /**
     * Replaces the selection with typed or pasted text.
     * @param {string} text - The text to insert.
     * @returns {object|null} The change, or null when nothing changed.
     */
    insertText(text) {
        const [start, end] = this.bounds();
        return this.replace(start, end, text);
    }

    /**
     * Replaces the selection with a single line break.
     * @returns {object|null} The change.
     */
    insertLineBreak() {
        return this.insertText("\n");
    }

    /**
     * Deletes the selection, or one unit next to the caret when the selection is collapsed. A
     * unit never splits a surrogate pair; graphemes also keep combining marks and emoji sequences.
     * @param {number} [direction=-1] - -1 deletes backward, 1 forward.
     * @param {string} [unit="grapheme"] - "character" (code point), "grapheme", "word" or "line".
     * @returns {object|null} The change, or null at the edge of the text.
     */
    delete(direction = -1, unit = "grapheme") {
        const [start, end] = this.bounds();
        if (start !== end) {
            return this.replace(start, end, "");
        }
        const edge = this._edge(start, direction < 0 ? -1 : 1, unit);
        return edge === start ? null : this.replace(Math.min(edge, start), Math.max(edge, start), "");
    }

    /**
     * Moves the selection without touching the text; this never creates a revision.
     * @param {number} anchor - The fixed end of the selection.
     * @param {number} [focus=anchor] - The moving end of the selection.
     * @returns {boolean} True when the selection changed.
     */
    select(anchor, focus = anchor) {
        const nextAnchor = this.constructor.boundary(this._text, anchor);
        const nextFocus = this.constructor.boundary(this._text, focus);
        if (nextAnchor === this._anchor && nextFocus === this._focus) {
            return false;
        }
        this._anchor = nextAnchor;
        this._focus = nextFocus;
        this._snapshot = null;
        return true;
    }

    /**
     * Replaces the whole text, as a programmatic value or a loaded query does.
     * @param {string} text - The new text.
     * @param {object} [selection] - The resulting selection; a caret at the end by default.
     * @returns {object|null} The change, or null when the text stays the same.
     */
    setText(text, selection) {
        const normalized = this.constructor.normalize(text);
        return this.replace(0, this._text.length, normalized, selection ?? { anchor: normalized.length, focus: normalized.length });
    }

    /**
     * Takes over an exported state as one replacement. The imported revision is not adopted: work
     * may still be pending for this model, and its revision must only ever grow.
     * @param {object|string} input - A state object or its JSON form.
     * @returns {object|null} The change, or null when the text stays the same.
     * @throws {TypeError} When the input is not a valid state; the model is left untouched.
     */
    import(input) {
        const state = this.constructor.parse(input);
        return this.setText(state.text, state.selection);
    }

    /**
     * Serializes the state for storage or transfer.
     * @returns {string} The JSON form of the current state.
     */
    export() {
        return JSON.stringify(this);
    }

    /**
     * Supplies the plain state JSON.stringify serializes.
     * @returns {object} A detached copy of the state.
     */
    toJSON() {
        return {
            version: this.constructor.VERSION,
            text: this._text,
            selection: { anchor: this._anchor, focus: this._focus },
            revision: this._revision
        };
    }

    /**
     * Finds the far end of one deletion unit next to a collapsed caret.
     * @param {number} offset - The caret.
     * @param {number} direction - -1 backward, 1 forward.
     * @param {string} unit - The deletion unit.
     * @returns {number} The other end of the deleted range.
     */
    _edge(offset, direction, unit) {
        const text = this._text;
        if (direction < 0 ? offset === 0 : offset === text.length) {
            return offset;
        }
        // a line break is its own unit, so a deletion at a line edge joins the two lines
        if (text[direction < 0 ? offset - 1 : offset] === "\n") {
            return offset + direction;
        }
        const lineStart = text.lastIndexOf("\n", offset - 1) + 1;
        const lineEnd = text.indexOf("\n", offset) < 0 ? text.length : text.indexOf("\n", offset);
        if (unit === "line") {
            return direction < 0 ? lineStart : lineEnd;
        }
        if (unit === "character" || typeof Intl === "undefined" || typeof Intl.Segmenter !== "function") {
            const width = direction < 0
                ? (this.constructor._insidePair(text, offset - 1) ? 2 : 1)
                : (text.codePointAt(offset) > 0xFFFF ? 2 : 1);
            return offset + direction * width;
        }
        // only the caret's line is segmented; queries are short, but the line bounds every unit anyway
        const line = text.slice(lineStart, lineEnd);
        const local = offset - lineStart;
        const segments = Array.from(new Intl.Segmenter(undefined, { granularity: unit === "word" ? "word" : "grapheme" }).segment(line));
        let index;
        if (direction < 0) {
            const before = segments.filter((segment) => segment.index < local);
            index = before.pop()?.index ?? 0;
            // a word deletion takes the blank before the caret together with the word before it
            if (unit === "word" && /^\s*$/.test(line.slice(index, local))) {
                index = before.pop()?.index ?? index;
            }
        } else {
            const after = segments.filter((segment) => segment.index + segment.segment.length > local);
            let next = after.shift();
            index = next ? next.index + next.segment.length : line.length;
            if (unit === "word" && /^\s*$/.test(line.slice(local, index))) {
                next = after.shift();
                if (next) {
                    index = next.index + next.segment.length;
                }
            }
        }
        return lineStart + index;
    }
};

/**
 * Keeps the editing transactions of a WQL prompt for undo and redo. Each transaction holds the
 * model snapshots before and after it, so text and selection come back together.
 *
 * The stacks are strictly separate from the history of submitted queries: they record how the
 * draft was edited, not what was sent. Typing and deleting at a continuous position coalesce into
 * one transaction until the kind of edit changes, the selection moves, the user pauses or a blank
 * or line break is typed; every other kind of edit is a transaction of its own.
 */
webexpress.webapp.WqlPromptUndo = class {
    static LIMIT = 200;
    static GROUP_DELAY = 1000;
    static GROUPED = new Set(["type", "delete"]);

    /**
     * Creates empty stacks.
     * @param {Function} [now=Date.now] - The clock that measures typing pauses.
     */
    constructor(now = () => Date.now()) {
        this._now = now;
        this._undo = [];
        this._redo = [];
    }

    /**
     * Tells whether a transaction can be undone.
     * @returns {boolean} True when the undo stack holds a transaction.
     */
    get canUndo() {
        return this._undo.length > 0;
    }

    /**
     * Tells whether an undone transaction can be restored.
     * @returns {boolean} True when the redo stack holds a transaction.
     */
    get canRedo() {
        return this._redo.length > 0;
    }

    /**
     * Records a text change, extending the open group when it continues it.
     * @param {object} before - The model snapshot before the change.
     * @param {object} after - The model snapshot after the change.
     * @param {string} kind - The kind of edit, such as "type", "delete", "paste" or "completion".
     * @param {object} [extra] - Caller state restored with the transaction, as { before, after }.
     */
    record(before, after, kind, extra) {
        const last = this._undo[this._undo.length - 1];
        const now = this._now();
        const inserted = webexpress.webapp.WqlPromptModel.diff(before.text, after.text, after.selection.focus)?.text ?? "";
        const continues = last && last.open && last.kind === kind
            && now - last.time <= this.constructor.GROUP_DELAY
            && last.after.text === before.text
            && last.after.selection.anchor === before.selection.anchor
            && last.after.selection.focus === before.selection.focus;
        this._redo = [];
        if (continues) {
            last.after = after;
            last.time = now;
            last.extra = extra ? { before: last.extra?.before, after: extra.after } : last.extra;
        } else {
            this._undo.push({ kind: kind, before: before, after: after, time: now, extra: extra, open: this.constructor.GROUPED.has(kind) });
            if (this._undo.length > this.constructor.LIMIT) {
                this._undo.shift();
            }
        }
        // a blank or line break completes a word, and the word with its blank is one step
        if (kind === "type" && /\s/.test(inserted)) {
            this.seal();
        }
    }

    /**
     * Ends the open group, so the next edit starts a transaction of its own.
     */
    seal() {
        const last = this._undo[this._undo.length - 1];
        if (last) {
            last.open = false;
        }
    }

    /**
     * Takes the latest transaction back.
     * @returns {object|null} { state, extra } to restore, or null when there is nothing to undo.
     */
    undo() {
        const entry = this._undo.pop();
        if (!entry) {
            return null;
        }
        entry.open = false;
        this._redo.push(entry);
        return { state: entry.before, extra: entry.extra?.before };
    }

    /**
     * Applies the latest undone transaction again.
     * @returns {object|null} { state, extra } to restore, or null when there is nothing to redo.
     */
    redo() {
        const entry = this._redo.pop();
        if (!entry) {
            return null;
        }
        this._undo.push(entry);
        return { state: entry.after, extra: entry.extra?.after };
    }

    /**
     * Forgets every transaction, as a value set by a program starts a new editing session.
     */
    clear() {
        this._undo = [];
        this._redo = [];
    }
};
