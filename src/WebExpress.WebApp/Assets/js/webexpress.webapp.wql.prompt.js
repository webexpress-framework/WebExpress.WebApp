/**
 * Provides a WYSIWYG input field for WebExpress Query Language (WQL).
 * Features:
 * - Live syntax highlighting (WQL).
 * - Context-aware auto-completion (attributes, operators, values, logic).
 * - Debounced server-side parsing and validation.
 * - History navigation (shell-like).
 * - Smart formatting (auto-quoting, auto-parenthesis).
 * - Clear button and multi-line support (Ctrl+Enter).
 * - Unified hint/error display with styled keyboard shortcuts.
 * - Triggers webexpress.webui.Event.CHANGE_FILTER_EVENT when a query is sent, and
 *   webexpress.webui.Event.CHANGE_VALUE_EVENT whenever the text changes.
 *
 * The text and the selection belong to a webexpress.webapp.WqlPromptModel, and a
 * webexpress.webapp.WqlPromptView only displays them: this controller turns browser input into
 * model operations, and highlighting, suggestions and diagnostics are derived from the model,
 * never written back into it.
 */
webexpress.webapp.WqlPromptCtrl = class extends webexpress.webui.Ctrl {
    static _instances = 0;

    /**
     * Initializes the WQL Prompt Controller.
     * @param {HTMLElement} element - The DOM element to attach to.
     */
    constructor(element) {
        super(element);
        // api endpoint for back-end operations, authored through the wx-service island
        const islandServices = webexpress.webapp.ServiceRegistry.fromElement(element);
        this._service = islandServices.data || null;
        this._apiUri = this._service ? this._service.baseUri : null;

        // the form field of a named prompt, created in _initUi
        this._field = null;

        // the authoritative text and selection; the surface mirrors them
        this._model = new webexpress.webapp.WqlPromptModel();
        this._announcedText = this._model.text;
        this._undo = new webexpress.webapp.WqlPromptUndo();
        this._defaultValue = "";
        this._composing = false;
        this._dragRange = null;

        // internal history state
        this._history = [];
        this._historyIndex = 0;
        this._unsentInput = "";

        // asynchronous work owned by this control
        this._debounceMs = 200;
        this._debounceTimer = null;
        this._abortController = null;
        this._historyTimer = null;
        this._historyAbortController = null;
        this._validationAbortController = null;
        // analysis and validation are tied to the model's text revision; only the query history,
        // which no edit changes, keeps a counter of its own
        this._historyVersion = 0;
        this._destroyed = false;
        this._listeners = [];
        this._validationStatus = "unchecked";
        this._statusMessage = null;
        this._historyError = null;

        // suggestion and parsing context
        this._suggestions = [];
        this._currentContext = null;
        this._tabCycleIndex = 0;
        this._lastError = null;

        // ui initialization
        this._initUi();
        this._attachListeners();
        this._attachViewState(element);

        if (this._apiUri) {
            // load history asynchronously after initialization
            this._historyTimer = setTimeout(() => {
                this._historyTimer = null;
                this._loadHistoryFromApi();
            }, 200);
        } else {
            // standalone (no wx-service): the prompt is a syntax-highlighting WQL
            // editor only, with no server suggestions, history or validation. it
            // is used this way inside dialogs (e.g. the kanban filter settings).
            this._setHintHtml(this._i18n("webexpress.webapp:wql.status.ready", "Ready."));
        }
    }

    /**
     * Gets the current WQL text. Public accessor so hosts (e.g. a settings
     * dialog) can read the value without reaching into the internals.
     * @returns {string} The WQL text.
     */
    get value() {
        return this._model.text;
    }

    /**
     * Sets the WQL text and re-applies syntax highlighting. A programmatic value is also the
     * value an enclosing form returns to on reset, the way a form treats an input's default.
     * @param {string} text - The WQL text.
     */
    set value(text) {
        const value = text != null ? String(text) : "";
        this._defaultValue = webexpress.webapp.WqlPromptModel.normalize(value);
        this._setText(value);
    }

    /**
     * Mirrors the current text into the form field of a named prompt.
     *
     * The prompt writes in a content-editable surface, and no form collects one of those.
     * A prompt that was given a name therefore carries a hidden field of that name beside
     * it and keeps it in step, so an enclosing form treats the prompt like any other
     * input: on submit it reads the expression out of the field, and on load it finds the
     * field by name and assigns through to this controller, which owns the visible text.
     */
    _syncField() {
        if (this._field) {
            this._field.value = this._model.text;
        }
    }

    /**
     * Announces the text as the value of the prompt when it differs from the one announced
     * last. Every path that changes the text - typing, a program, a form reset, the edits of
     * another author - passes here, while a send only announces the filter.
     */
    _announceValue() {
        if (this._model.text === this._announcedText) {
            return;
        }
        this._announcedText = this._model.text;
        this._dispatch(webexpress.webui.Event.CHANGE_VALUE_EVENT, { value: this._model.text });
    }

    /**
     * Wires the prompt to an enclosing ViewState when it was authored standalone
     * with Resource<T>().Model(path). A submitted query then writes into the
     * shared state and re-queries the bound resource instead of coordinating
     * through the BindSearch wire. A prompt embedded in the advanced search
     * carries no resource binding of its own, so its changes flow through the
     * search host instead and this stays inert.
     * @param {HTMLElement} element - the host element carrying the binding.
     */
    _attachViewState(element) {
        this._viewState = null;
        this._viewStateResource = element.getAttribute("data-wx-model-query")
            || element.getAttribute("data-wx-resource")
            || null;

        if (!this._viewStateResource) {
            return;
        }

        this._wqlStateKey = element.getAttribute("data-wx-model") || "wql";

        const viewStateId = element.getAttribute("data-wx-viewstate") || null;
        this._cancelViewStateReady = webexpress.webapp.ViewStateRegistry.whenReady(element, viewStateId, (viewState) => {
            if (this._destroyed) {
                return;
            }
            this._viewState = viewState;
            const selector = (state) => this._wqlStateKey.split(".")
                .filter((key) => key.length > 0)
                .reduce((current, key) => current == null ? undefined : current[key], state);
            const apply = (value) => {
                if (this._destroyed || Object.is(value, this._lastStateValue)) {
                    return;
                }
                this._lastStateValue = value;
                this.value = value;
                this._historyIndex = this._history.length;
                this._unsentInput = this.value;
            };
            apply(selector(viewState.getState()));
            this._unsubscribeViewState = viewState.watch(selector, apply);
        });
    }

    /**
     * Writes a submitted WQL query into the bound ViewState and re-queries the
     * resource, resetting the page and clearing the basic search key so the two
     * search modes stay mutually exclusive in the shared state.
     * @param {string} text - the submitted WQL query.
     */
    _writeWqlToViewState(text) {
        if (!this._viewState) {
            return;
        }

        const keys = this._wqlStateKey.split(".").filter((key) => key.length > 0);
        const patch = { page: 0, search: null };
        let target = patch;
        let source = this._viewState.getState();
        for (const key of keys.slice(0, -1)) {
            source = source?.[key];
            target[key] = Object.assign({}, source);
            target = target[key];
        }
        target[keys[keys.length - 1]] = text;
        this._lastStateValue = text;
        this._viewState.dispatch("viewstate/query", { resource: this._viewStateResource, patch: patch });
    }

    /**
     * Builds the DOM structure for the WYSIWYG prompt input.
     */
    _initUi() {
        this._element.classList.add("wx-wql");
        this._element.style.position = "relative";

        const formGroup = document.createElement("div");
        formGroup.className = "form-group mb-0";

        const inputGroup = document.createElement("div");
        inputGroup.className = "input-group";

        // the ids are generated rather than derived from the host id, because a host id may
        // appear twice on a page (the tutorial stage renders every sample twice)
        const listId = "wx-wql-suggestions-" + (++webexpress.webapp.WqlPromptCtrl._instances);

        // contenteditable input field; it owns a list of completions, which makes it a
        // combobox to the reader (ARIA 1.2), and a combobox takes no aria-multiline
        this._input = document.createElement("div");
        this._input.className = "form-control wx-wql-input wx-code-line";
        this._input.setAttribute("role", "combobox");
        this._input.setAttribute("aria-label", this._i18n("webexpress.webapp:wql.input.label", "WQL query"));
        this._input.setAttribute("aria-autocomplete", "list");
        this._input.setAttribute("aria-haspopup", "listbox");
        this._input.setAttribute("aria-expanded", "false");
        this._input.setAttribute("aria-controls", listId);
        this._input.setAttribute("contenteditable", "true");
        this._input.setAttribute("spellcheck", "false");
        this._input.style.minHeight = "2em";
        this._input.style.fontFamily = "monospace";
        this._input.dataset.language = "wql";

        const placeholder = this._i18n("webexpress.webapp:wql.placeholder");
        this._input.dataset.placeholder = placeholder;

        inputGroup.appendChild(this._input);

        // clear button resets the prompt to a fresh input line; a themed xmark
        // icon blends with the field instead of a raw glyph in an outline box
        this._clearBtn = document.createElement("button");
        this._clearBtn.type = "button";
        this._clearBtn.className = "btn wx-wql-clear";
        this._clearBtn.title = this._i18n("webexpress.webapp:wql.clear", "Clear");
        this._clearBtn.setAttribute("aria-label", this._clearBtn.title);
        // resolve through the icon set when available; a lean runtime without the
        // helper falls back to the class pair the set would have produced
        const clearIcon = (typeof this._iconClass === "function")
            ? this._iconClass("xmark")
            : "wx-icon-light wx-icon-light-xmark";
        this._clearBtn.innerHTML = `<i class="${clearIcon}"></i>`;
        inputGroup.appendChild(this._clearBtn);

        formGroup.appendChild(inputGroup);

        // the suggestions stay visible in the hint line; the list carries them for assistive
        // technology, which follows the highlighted one through aria-activedescendant
        this._listbox = document.createElement("ul");
        this._listbox.id = listId;
        this._listbox.className = "visually-hidden wx-wql-suggestions";
        this._listbox.setAttribute("role", "listbox");
        this._listbox.setAttribute("aria-label", this._i18n("webexpress.webapp:wql.suggestions.label", "WQL suggestions"));
        formGroup.appendChild(this._listbox);
        this._view = new webexpress.webapp.WqlPromptView(this._input, this._listbox);

        // unified hint/error area
        this._hint = document.createElement("small");
        this._hint.className = "form-text text-muted wx-wql-hint mt-1";

        const initMsg = this._i18n("webexpress.webapp:wql.status.initializing");
        this._setHintHtml(initMsg);

        formGroup.appendChild(this._hint);
        this._element.appendChild(formGroup);

        // a named prompt is a form field: the hidden input carries the expression into
        // the form data, and the name is taken off the host so it is not collected twice
        const name = this._element.getAttribute("name");

        if (name) {
            this._element.removeAttribute("name");
            this._field = document.createElement("input");
            this._field.type = "hidden";
            this._field.name = name;
            this._element.appendChild(this._field);
        }
    }

    /**
     * Attaches necessary event listeners to contenteditable input and buttons.
     */
    _attachListeners() {
        this._listen(this._clearBtn, "click", () => this._onClearInput());
        this._listen(this._input, "beforeinput", (e) => this._onBeforeInput(e));
        this._listen(this._input, "input", (e) => this._onInput(e));
        this._listen(this._input, "compositionstart", () => this._onCompositionStart());
        this._listen(this._input, "compositionend", () => this._onCompositionEnd());
        this._listen(this._input, "paste", (e) => this._onPaste(e));
        this._listen(this._input, "copy", (e) => this._onCopy(e, false));
        this._listen(this._input, "cut", (e) => this._onCopy(e, true));
        this._listen(this._input, "dragstart", (e) => this._onDragStart(e));
        this._listen(this._input, "dragend", () => { this._dragRange = null; });
        this._listen(this._input, "drop", (e) => this._onDrop(e));
        this._listen(this._input, "keydown", (e) => this._onKeyDown(e));
        this._listen(document, "selectionchange", () => this._onSelectionChange());
        // reset bubbles from the form, which may only become the prompt's ancestor after construction
        this._listen(document, "reset", (e) => {
            if (e.target && typeof e.target.contains === "function" && e.target.contains(this._element)) {
                this._onFormReset();
            }
        });
    }

    /**
     * Tracks event handlers so removing the control also releases their closures.
     * @param {EventTarget} target - The event source.
     * @param {string} type - The event name.
     * @param {Function} handler - The callback owned by this control.
     */
    _listen(target, type, handler) {
        target.addEventListener(type, handler);
        this._listeners.push(() => target.removeEventListener(type, handler));
    }

    /**
     * Clears the input field and resets state.
     */
    _onClearInput() {
        this._edit("clear", () => this._model.setText(""), false);
        this._input.focus({ preventScroll: true });
        this._renderSelection(true);
        this._historyIndex = this._history.length;
        this._unsentInput = "";
        this._suggestions = [];
        this._currentContext = null;
        this._submitInput();
    }

    /**
     * Returns the prompt to its programmatic value when the enclosing form is reset; a hidden
     * field is not reset by the browser, so the prompt has to do it for its own text.
     */
    _onFormReset() {
        this._setText(this._defaultValue);
        this._historyIndex = this._history.length;
        this._unsentInput = this._model.text;
    }

    /**
     * Applies one editing operation to the model and derives everything else from the result:
     * a text change becomes an undoable transaction, invalidates pending work, updates the form
     * field and re-renders, while a pure selection change only moves the caret and invalidates
     * the suggestions.
     * @param {string|null} kind - The transaction kind for undo; null records nothing, as for
     * undo and redo themselves.
     * @param {Function} operation - Mutates this._model through its operations.
     * @param {number|boolean} [analyze=this._debounceMs] - Delay of the follow-up analysis; 0 runs
     * it at once, false skips it.
     * @param {object} [extra] - Caller state restored with the transaction, as { before, after }.
     */
    _edit(kind, operation, analyze = this._debounceMs, extra = undefined) {
        if (this._destroyed) {
            return;
        }
        const before = this._model.state;
        operation();
        const after = this._model.state;
        if (after.revision !== before.revision) {
            if (this._collab) {
                this._announceText(kind, Math.min(before.selection.anchor, before.selection.focus));
            } else if (kind) {
                this._undo.record(before, after, kind, extra);
            }
            this._invalidateInput();
            this._syncField();
            this._announceValue();
            if (this._historyIndex === this._history.length) {
                this._unsentInput = after.text;
            }
            this._render();
        } else if (after !== before) {
            this._undo.seal();
            this._collab?.history.seal();
            this._invalidateAnalysis();
            this._updateHint();
            this._renderSelection(true);
        } else {
            return;
        }
        if (analyze !== false) {
            this._scheduleAnalysis(analyze);
        }
    }

    /**
     * Replaces the text on behalf of a program (value, ViewState, form reset) rather than the user.
     * The program starts a new editing session, so nothing before it can be undone.
     * @param {string} value - The new value.
     */
    _setText(value) {
        if (this._destroyed) {
            return;
        }
        this._invalidateInput();
        this._undo.clear();
        this._model.setText(value);
        this._render();
        this._syncField();
        this._announceValue();
        // a program setting the value of a shared prompt changes it for everyone
        this._announceText(null);
    }

    /**
     * Turns the browser's intended edit into a model operation before the browser performs it, so
     * the surface never holds text the model does not know. Edits without a model equivalent are
     * left to the browser and taken over afterwards by _reconcile().
     * @param {InputEvent} e - The beforeinput event.
     */
    _onBeforeInput(e) {
        if (this._destroyed || this._composing || e.isComposing) {
            return;
        }
        const type = e.inputType || "";
        if (type === "historyUndo" || type === "historyRedo") {
            // the browser's own history would compete with the prompt's transactions
            e.preventDefault();
            this._step(type === "historyRedo");
            return;
        }
        const range = this._view.targetRange(e);
        const replace = (kind, text) => {
            e.preventDefault();
            this._syncSelectionFromDom();
            this._edit(kind, () => range
                ? this._model.replace(range[0], range[1], text)
                : this._model.insertText(text));
        };

        if (type === "insertText" || type === "insertLineBreak") {
            replace("type", type === "insertLineBreak" ? "\n" : e.data ?? "");
        } else if (["insertReplacementText", "insertFromYank"].includes(type)) {
            replace("input", e.data ?? e.dataTransfer?.getData("text/plain") ?? "");
        } else if (["insertFromPaste", "insertFromPasteAsQuotation"].includes(type)) {
            replace("paste", e.data ?? e.dataTransfer?.getData("text/plain") ?? "");
        } else if (type === "insertParagraph") {
            // a virtual keyboard may send Enter without a usable keydown; Enter submits
            e.preventDefault();
            this._submitInput();
        } else if (type.startsWith("delete")) {
            const unit = /Word/.test(type) ? "word" : /Line/.test(type) ? "line" : "grapheme";
            const direction = /Forward/.test(type) ? 1 : -1;
            e.preventDefault();
            this._syncSelectionFromDom();
            this._edit(type === "deleteByCut" ? "cut" : "delete", () => {
                if (range && range[0] !== range[1]) {
                    this._model.replace(range[0], range[1], "");
                } else if (/Backward|Forward/.test(type)) {
                    this._model.delete(direction, unit);
                } else {
                    const [start, end] = this._model.bounds();
                    this._model.replace(start, end, "");
                }
            });
        } else if (type.startsWith("format") || type === "insertFromDrop") {
            // a query has no rich formatting, and drops are taken over in _onDrop
            e.preventDefault();
        }
    }

    /**
     * Takes over an edit the browser performed on its own.
     * @param {InputEvent} e - The input event.
     */
    _onInput(e) {
        if (this._destroyed || this._composing || e?.isComposing) {
            return;
        }
        this._reconcile("input");
    }

    /**
     * Reads the surface back and records its difference to the model as one range replacement,
     * located by the common prefix and suffix of both texts.
     * @param {string} kind - The transaction kind of the edit taken over.
     */
    _reconcile(kind) {
        const map = this._view.map();
        const selection = this._view.readSelection(map);
        const change = webexpress.webapp.WqlPromptModel.diff(this._model.text, map.text, selection?.focus);
        if (!change) {
            return;
        }
        this._edit(kind, () => this._model.replace(change.from, change.to, change.text, selection || undefined));
    }

    /**
     * Hands the surface to the input method editor: while a composition runs the surface leads,
     * so nothing re-renders, completes or asks the server until it ends.
     */
    _onCompositionStart() {
        this._syncSelectionFromDom();
        this._composing = true;
        this._invalidateAnalysis();
        this._updateHint();
    }

    /**
     * Takes the composed text over into the model as one edit, which is typing to the undo stack.
     */
    _onCompositionEnd() {
        this._composing = false;
        this._reconcile("type");
    }

    /**
     * Inserts only the plain text of a clipboard, whatever markup it carries.
     * @param {ClipboardEvent} e - The paste event.
     */
    _onPaste(e) {
        e.preventDefault();
        const text = e.clipboardData?.getData("text/plain") ?? "";
        this._syncSelectionFromDom();
        this._edit("paste", () => this._model.insertText(text));
    }

    /**
     * Copies the model's text of the selection, which holds no caret placeholders.
     * @param {ClipboardEvent} e - The copy or cut event.
     * @param {boolean} cut - Whether the selection is removed afterwards.
     */
    _onCopy(e, cut) {
        this._syncSelectionFromDom();
        const [start, end] = this._model.bounds();
        if (start === end || !e.clipboardData) {
            return;
        }
        e.preventDefault();
        e.clipboardData.setData("text/plain", this._model.text.slice(start, end));
        if (cut) {
            this._edit("cut", () => this._model.replace(start, end, ""));
        }
    }

    /**
     * Remembers the dragged range, so a drop inside the prompt can move it.
     * @param {DragEvent} e - The dragstart event.
     */
    _onDragStart(e) {
        this._syncSelectionFromDom();
        const [start, end] = this._model.bounds();
        this._dragRange = start === end ? null : [start, end];
        if (this._dragRange && e.dataTransfer) {
            e.dataTransfer.setData("text/plain", this._model.text.slice(start, end));
        }
    }

    /**
     * Inserts the plain text of a drop at the drop point; a drag out of this prompt moves its
     * text unless a copy modifier is held.
     * @param {DragEvent} e - The drop event.
     */
    _onDrop(e) {
        e.preventDefault();
        const text = e.dataTransfer?.getData("text/plain") ?? "";
        const source = this._dragRange;
        this._dragRange = null;
        let target = this._view.offsetFromPoint(e.clientX, e.clientY) ?? this._model.cursor;
        if (!text) {
            return;
        }
        this._edit("drop", () => {
            if (source && !e.ctrlKey && !e.altKey) {
                if (target >= source[0] && target <= source[1]) {
                    return;
                }
                this._model.replace(source[0], source[1], "");
                target = target > source[1] ? target - (source[1] - source[0]) : target;
            }
            this._model.replace(target, target, text, { anchor: target, focus: target + webexpress.webapp.WqlPromptModel.normalize(text).length });
        });
    }

    /**
     * Follows the user's caret; the model ignores a selection it already holds, so restoring the
     * selection after a render does not start the same analysis again.
     */
    _onSelectionChange() {
        if (this._destroyed || this._composing) {
            return;
        }
        if (this._syncSelectionFromDom()) {
            this._onCursorMove();
        }
    }

    /**
     * Undoes or redoes one editing transaction, restoring text and selection together.
     * @param {boolean} redo - True to redo, false to undo.
     */
    _step(redo) {
        if (this._destroyed || this._composing) {
            return;
        }
        if (this._collab) {
            this._collabStep(redo);
            return;
        }
        const step = redo ? this._undo.redo() : this._undo.undo();
        if (!step) {
            return;
        }
        // a loaded history entry brings its place in the query history back with it
        if (step.extra !== undefined) {
            this._historyIndex = step.extra;
        }
        this._edit(null, () => this._model.setText(step.state.text, step.state.selection));
    }

    /**
     * Takes the surface's selection into the model when it lies inside the prompt.
     * @returns {boolean} True when the model selection changed.
     */
    _syncSelectionFromDom() {
        const selection = this._view.readSelection();
        return !!selection && this._model.select(selection.anchor, selection.focus);
    }

    /**
     * Moves the selection on behalf of the user, in the model and on the surface.
     * @param {number} anchor - The fixed end.
     * @param {number} [focus=anchor] - The moving end.
     */
    _select(anchor, focus = anchor) {
        this._model.select(anchor, focus);
        this._renderSelection(true);
    }

    /**
     * Prevents analysis responses from repopulating suggestions during debounce.
     */
    _invalidateAnalysis() {
        clearTimeout(this._debounceTimer);
        this._debounceTimer = null;
        this._abortController?.abort();
        this._abortController = null;
        this._suggestions = [];
        this._currentContext = null;
        this._tabCycleIndex = 0;
    }

    /**
     * Invalidates pending submissions whenever the user replaces their draft.
     */
    _invalidateInput() {
        this._validationAbortController?.abort();
        this._validationAbortController = null;
        this._invalidateAnalysis();
        this._validationStatus = "unchecked";
        this._statusMessage = null;
        this._setValidState();
    }

    /**
     * Starts the analysis of the current text after a pause in typing.
     * @param {number} delay - The debounce delay; 0 starts at once.
     */
    _scheduleAnalysis(delay) {
        clearTimeout(this._debounceTimer);
        this._debounceTimer = null;
        if (delay === 0) {
            this._refreshContextAndSuggestions();
            return;
        }
        this._debounceTimer = setTimeout(() => {
            this._debounceTimer = null;
            this._refreshContextAndSuggestions();
        }, delay);
    }

    /**
     * Shows the model state on the surface; an input method composition owns the surface until it ends.
     */
    _render() {
        if (this._destroyed || this._composing) {
            return;
        }
        this._view.render(this._model.state);
    }

    /**
     * Shows the model selection on the surface.
     * @param {boolean} [force=false] - Writes the selection even when the surface does not own it.
     */
    _renderSelection(force = false) {
        if (!this._composing) {
            this._view.showSelection(this._model.selection, force);
        }
    }

    /**
     * Merges server history with local submissions without changing a browsed draft.
     * @param {number} [retryCount=0] - The current retry attempt.
     * @returns {Promise<void>} Completion of this load attempt.
     */
    async _loadHistoryFromApi(retryCount = 0) {
        if (this._destroyed || !this._service) {
            return;
        }
        clearTimeout(this._historyTimer);
        this._historyTimer = null;
        this._historyAbortController?.abort();
        const controller = new AbortController();
        this._historyAbortController = controller;
        const version = ++this._historyVersion;
        let response;
        try {
            response = await this._service.request(this._endpointUrl("history"), { signal: controller.signal });
        } catch (error) {
            // local history remains usable when the service cannot be reached
        }
        if (this._destroyed || version !== this._historyVersion || controller.signal.aborted) {
            return;
        }
        this._historyAbortController = null;
        if (response?.ok && Array.isArray(response.data?.history)) {
            const atDraft = this._historyIndex === this._history.length;
            const selected = this._history[this._historyIndex];
            const local = this._history;
            const server = response.data.history.filter((entry) => typeof entry === "string" && entry.trim());
            this._history = Array.from(new Set([...server.filter((entry) => !local.includes(entry)), ...local]));
            this._historyIndex = atDraft ? this._history.length : this._history.indexOf(selected);
            this._historyError = null;
            this._updateHint();
            return;
        }
        if (retryCount < 10) {
            this._historyTimer = setTimeout(() => {
                this._historyTimer = null;
                this._loadHistoryFromApi(retryCount + 1);
            }, 500);
        } else {
            this._historyError = this._i18n("webexpress.webapp:wql.error.history.unavailable", "History unavailable.");
            this._updateHint();
        }
    }

    /**
     * Invalidates suggestions immediately when the completion position changes.
     */
    _onCursorMove() {
        if (this._destroyed) {
            return;
        }
        // typing elsewhere is a new transaction, even when it follows at once
        this._undo.seal();
        this._invalidateAnalysis();
        this._updateHint();
        this._scheduleAnalysis(100);
    }

    /**
     * Refreshes the parsing context and fetches suggestions from the server.
     * Uses AbortController to cancel stale requests.
     */
    async _refreshContextAndSuggestions() {
        // standalone prompts (no service) offer no server-driven suggestions, and an input
        // method composition owns the surface until it ends
        if (this._destroyed || !this._service || this._composing) {
            return;
        }

        // cancel previous pending request
        if (this._abortController) {
            this._abortController.abort();
        }

        this._abortController = new AbortController();
        const controller = this._abortController;

        // the request belongs to one text revision and one cursor; a newer request aborts this
        // one, and a moved cursor makes its suggestions stale even for unchanged text
        const revision = this._model.revision;
        const text = this._model.text;
        const cursorPos = this._model.cursor;
        const fetchUrl = this._analyzeUrl(text, cursorPos);

        try {
            const analyzeResp = await this._service.request(fetchUrl, { signal: controller.signal });
            if (this._destroyed || controller.signal.aborted
                || revision !== this._model.revision || cursorPos !== this._model.cursor) {
                return;
            }

            if (analyzeResp.ok && analyzeResp.data) {
                const analyzeData = analyzeResp.data;

                // while typing the prompt only offers the next tokens; the
                // syntax check itself runs when the query is submitted
                if (analyzeData.isValidSoFar) {
                    this._setValidState();
                }

                const prefix = analyzeData.prefix || "";
                let tokenStart = cursorPos;

                if (prefix.length > 0) {
                    const candidateStart = Math.max(0, cursorPos - prefix.length);
                    const actualPrefix = text.slice(candidateStart, cursorPos);

                    if (actualPrefix === prefix) {
                        tokenStart = candidateStart;
                    }
                }

                let tokenEnd = this._getTokenBoundaries(text, cursorPos).end;
                const quote = text[tokenStart - 1];
                if (analyzeData.quoted && (quote === '"' || quote === "'")) {
                    // retain the existing quotes while replacing the entire literal suffix; the
                    // service escapes a quote inside a literal by doubling it, as in 'O''Brien'
                    tokenEnd = cursorPos;
                    while (tokenEnd < text.length && (text[tokenEnd] !== quote || text[tokenEnd + 1] === quote)) {
                        tokenEnd += text[tokenEnd] === quote ? 2 : 1;
                    }
                }

                this._currentContext = {
                    type: (analyzeData.currentExpressionType || "").toLowerCase(),
                    prefix: prefix,
                    tokenStart: tokenStart,
                    tokenEnd: tokenEnd,
                    attribute: analyzeData.attribute,
                    quoted: analyzeData.quoted || false,
                    quote: analyzeData.quoted ? quote : null,
                    revision: revision,
                    cursorPos: cursorPos
                };

                this._suggestions = Array.isArray(analyzeData.suggestions) ? analyzeData.suggestions : [];
                this._tabCycleIndex = 0;
                this._updateHint();
            }
        } catch (e) {
            if (!this._destroyed && !controller.signal.aborted && e.name !== "AbortError") {
                console.error("[WQL] Context refresh error:", e);
            }
        } finally {
            if (this._abortController === controller) {
                this._abortController = null;
            }
        }
    }

    /**
     * Appends an endpoint to the URL path while preserving its query parameters.
     * @param {string} endpoint - The service operation path segment.
     * @returns {string} The endpoint URL.
     */
    _endpointUrl(endpoint) {
        const url = new URL(this._apiUri, document.baseURI || window.location.origin);
        url.pathname = url.pathname.replace(/\/+$/, "") + "/" + endpoint;
        url.hash = "";
        return url.href;
    }

    /**
     * Builds an analysis request without appending path segments to query values.
     * @param {string} text - The WQL text.
     * @param {number} cursorPos - The normalized cursor position.
     * @returns {string} The analysis URL.
     */
    _analyzeUrl(text, cursorPos) {
        const url = new URL(this._endpointUrl("analyze"));
        url.searchParams.set("wql", text);
        url.searchParams.set("c", String(cursorPos));
        return url.href;
    }

    /**
     * Handles key events: undo and redo, Tab, Enter, Arrows, PageUp/Down.
     * @param {KeyboardEvent} e - The keyboard event.
     */
    _onKeyDown(e) {
        // keys confirm or steer an input method composition, never the prompt
        if (e.isComposing || e.keyCode === 229) {
            return;
        }

        // a caret moved since the last analysis makes its suggestions stale before Tab can apply one
        if (this._syncSelectionFromDom()) {
            this._onCursorMove();
        }

        // Ctrl+Z, Ctrl+Y and Ctrl+Shift+Z (Cmd on macOS); AltGr arrives as Ctrl+Alt and types characters
        const key = (e.key || "").toLowerCase();
        if ((e.ctrlKey || e.metaKey) && !e.altKey && (key === "z" || key === "y")) {
            e.preventDefault();
            this._step(key === "y" || e.shiftKey);
            return;
        }

        if (e.key === "Tab") {
            if (!e.shiftKey && this._suggestions.length > 0 && this._currentContext) {
                e.preventDefault();
                this._handleTab();
            }
            return;
        }

        if (e.key === "Enter") {
            if (e.ctrlKey) {
                e.preventDefault();
                this._insertLineBreakAtCursor();
                return;
            } else {
                e.preventDefault();
                this._submitInput();
                return;
            }
        }

        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            if (this._suggestions.length > 0) {
                e.preventDefault();
                const dir = e.key === "ArrowDown" ? 1 : -1;
                this._cycleSuggestions(dir);
                return;
            }
        }

        if (e.key === "PageUp" || e.key === "PageDown") {
            e.preventDefault();
            const dir = e.key === "PageDown" ? 1 : -1;
            this._navigateHistory(dir);
            return;
        }
    }

    /**
     * Replaces the selection with one newline without retaining split line wrappers.
     */
    _insertLineBreakAtCursor() {
        this._syncSelectionFromDom();
        this._edit("type", () => this._model.insertLineBreak());
        this._view.scrollToEnd();
    }

    /**
     * Applies the currently selected suggestion.
     */
    _handleTab() {
        if (!this._suggestions || this._suggestions.length === 0) {
            return;
        }

        const suggestion = this._suggestions[this._tabCycleIndex];
        this._applySuggestion(suggestion);
    }

    /**
     * Cycles through the suggestion list.
     * @param {number} dir - The direction: 1 for down, -1 for up.
     */
    _cycleSuggestions(dir) {
        if (this._suggestions.length === 0) {
            return;
        }

        this._tabCycleIndex = (this._tabCycleIndex + dir + this._suggestions.length) % this._suggestions.length;
        this._updateHint();
    }

    /**
     * Gets the token boundaries around the cursor for replacement.
     * @param {string} text - The full input text.
     * @param {number} cursorPos - The current cursor position.
     * @returns {{start: number, end: number}} The token boundaries.
     */
    _getTokenBoundaries(text, cursorPos) {
        const before = text.slice(0, cursorPos).match(/[\p{L}\p{M}\p{N}_.-]+$/u)?.[0] || "";
        const after = text.slice(cursorPos).match(/^[\p{L}\p{M}\p{N}_.-]+/u)?.[0] || "";
        return { start: cursorPos - before.length, end: cursorPos + after.length };
    }

    /**
     * Inserts the suggestion into the input field, replacing partial input.
     * @param {string} value - The suggestion value.
     */
    _applySuggestion(value) {
        if (!this._currentContext) {
            return;
        }

        const text = this._model.text;
        const cursorPos = this._model.cursor;
        if (this._currentContext.revision !== undefined && (this._currentContext.revision !== this._model.revision
            || this._currentContext.cursorPos !== cursorPos)) {
            this._invalidateAnalysis();
            this._updateHint();
            return;
        }
        const type = this._currentContext.type;
        let tokenStart = this._currentContext.tokenStart;
        let tokenEnd = this._currentContext.tokenEnd;
        let insertion = value;

        // smart formatting logic per wql type; the type names are the
        // lower-cased WqlExpressionType enum names of the analyze endpoint.
        // punctuation is recognised by its value, as it is offered alongside
        // other types (a closing parenthesis next to a separator, an opening
        // one next to attributes)
        if (value === "(" || value === ")" || value === ",") {
            // the blank a chosen value leaves behind is taken back, so a list
            // reads ("a", "b") rather than ("a" , "b" )
            const blank = value === "(" ? "" : text.slice(0, cursorPos).match(/[ \t]*$/)[0];
            insertion = value === "," ? ", " : value;
            tokenStart = cursorPos - blank.length;
            tokenEnd = cursorPos;
        } else if (type === "openparenthesis") {
            insertion = `("${this._escapeLiteral(value, '"')}"`;
            tokenStart = cursorPos;
            tokenEnd = cursorPos;
        } else if (type === "parameter" || type === "quotation") {
            insertion = this._currentContext.quoted
                ? this._escapeLiteral(value, this._currentContext.quote)
                : `"${this._escapeLiteral(value, '"')}"`;
        }

        if (!this._currentContext.quoted && !insertion.endsWith(" ") && value !== "("
            && !/^\s/.test(text.slice(tokenEnd))) {
            insertion += " ";
        }

        this._insertReplacementAt(tokenStart, tokenEnd, insertion);
    }

    /**
     * Escapes a value for a string literal the way the WQL service reads it: a quote inside a
     * literal is written twice.
     * @param {string} value - The literal content.
     * @param {string|null} quote - The quote character delimiting the literal.
     * @returns {string} The escaped content.
     */
    _escapeLiteral(value, quote) {
        return quote ? String(value).split(quote).join(quote + quote) : String(value);
    }

    /**
     * Replaces character range in the input field.
     * @param {number} start - Start index.
     * @param {number} end - End index.
     * @param {string} text - Replacement text.
     */
    _insertReplacementAt(start, end, text) {
        // the follow-up analysis runs at once, so the next suggestion is ready for the next Tab
        this._edit("completion", () => this._model.replace(start, end, text), 0);
    }

    /**
     * Updates hint text below the input field.
     */
    _updateHint() {
        this._view.renderSuggestions(this._currentContext ? this._suggestions : [], this._tabCycleIndex);

        if (this._lastError) {
            this._hint.classList.remove("text-muted");
            this._hint.classList.add("text-danger");
            const errLabel = this._i18n("webexpress.webapp:wql.error.label", "Error");
            this._setHintHtml(`<b>${errLabel}:</b> ${this._escapeHtml(this._lastError)}`);
            return;
        }

        this._hint.classList.remove("text-danger");
        this._hint.classList.add("text-muted");
        this._input.dataset.validation = this._validationStatus;
        this._input.setAttribute("aria-invalid", "false");
        if (this._statusMessage) {
            this._setHintHtml(this._statusMessage);
            return;
        }

        // keys are the lower-cased WqlExpressionType enum names as serialized
        // by the analyze endpoint
        const typeKeys = {
            attribute: "webexpress.webapp:wql.type.attribute",
            operator: "webexpress.webapp:wql.type.operator",
            parameter: "webexpress.webapp:wql.type.parameter",
            quotation: "webexpress.webapp:wql.type.parameter",
            openparenthesis: "webexpress.webapp:wql.type.parenthesis.open",
            separator: "webexpress.webapp:wql.type.set.next",
            closeparenthesis: "webexpress.webapp:wql.type.after.parameter",
            logicaloperator: "webexpress.webapp:wql.type.logical.operator",
            partitioning: "webexpress.webapp:wql.type.number",
            partitioningoperator: "webexpress.webapp:wql.type.logical.operator"
        };

        const type = this._currentContext?.type;

        if (type) {
            let label = this._i18n(typeKeys[type]);

            if (!label) {
                label = type || this._i18n("webexpress.webapp:wql.type.input", "Input");
            }

            if (this._suggestions.length === 0) {
                const noSuggestions = this._i18n("webexpress.webapp:wql.no.suggestions", "No suggestions.");
                this._setHintHtml(`${label}: ${noSuggestions}`);
                return;
            }

            // show current and next suggestions
            const selected = this._suggestions[this._tabCycleIndex];
            const others = this._suggestions.filter((_, i) => i !== this._tabCycleIndex).slice(0, 9);

            let html = `${label}: ${this._i18n("webexpress.webapp:wql.tab.label").replace("{0}", this._escapeHtml(selected))}`;

            if (others.length > 0) {
                const otherList = others.map((o) => `<b>${this._escapeHtml(o)}</b>`).join(", ");
                html += ` ${this._i18n("webexpress.webapp:wql.cursor.label").replace("{0}", otherList)}`;
            }

            this._setHintHtml(html);
        } else {
            this._setHintHtml(this._historyError || this._i18n("webexpress.webapp:wql.status.ready"));
        }
    }

    /**
     * Sets HTML content for the hint element.
     * @param {string} html - The HTML to set.
     */
    _setHintHtml(html) {
        this._hint.innerHTML = html;
    }

    /**
     * Escapes HTML characters.
     * @param {string} str - String to escape.
     * @returns {string} Escaped string.
     */
    _escapeHtml(str) {
        if (!str) {
            return "";
        }

        return str.toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /**
     * Distinguishes a syntax verdict from an unavailable validation service.
     * @param {string} text - The submitted WQL text.
     * @param {AbortSignal} signal - Cancellation owned by this submission.
     * @returns {Promise<object>} The validation status and optional error message.
     */
    async _validateInput(text, signal) {
        if (!this._service) {
            return { status: "unchecked" };
        }
        try {
            const response = await this._service.request(this._analyzeUrl(text, text.length), { signal: signal });
            if (response.ok && response.data?.isValidSoFar === false) {
                return {
                    status: "invalid",
                    error: response.data.errorMessage || this._i18n("webexpress.webapp:wql.error.label")
                };
            }
            if (response.ok && response.data?.isValidSoFar === true) {
                return { status: "valid" };
            }
        } catch (error) {
            // a validation outage must not block execution by the search service
        }
        return { status: "unchecked" };
    }

    /**
     * Applies only the latest submission and treats empty input as a filter reset.
     * @returns {Promise<void>} Completion of validation and application.
     */
    async _submitInput() {
        if (this._destroyed) {
            return;
        }
        const text = this._model.text.trim();
        // the revision tells whether the draft changed while it was validated; a newer
        // submission aborts this one, so both cases are covered without a counter of their own
        const revision = this._model.revision;
        this._undo.seal();
        this._validationAbortController?.abort();
        this._invalidateAnalysis();
        this._validationStatus = "unchecked";
        this._statusMessage = null;
        this._setValidState();
        const controller = new AbortController();
        this._validationAbortController = controller;
        const result = text ? await this._validateInput(text, controller.signal) : { status: "unchecked" };
        if (this._destroyed || controller.signal.aborted || revision !== this._model.revision) {
            return;
        }
        this._validationAbortController = null;
        this._invalidateAnalysis();
        this._validationStatus = result.status;
        if (result.status === "invalid") {
            this._setInvalidState(result.error);
            return;
        }
        if (text && this._history[this._history.length - 1] !== text) {
            this._history.push(text);
        }
        this._historyIndex = this._history.length;
        this._unsentInput = "";
        const key = !text ? "cleared" : result.status === "valid" ? "sent" : "unchecked";
        this._statusMessage = this._i18n("webexpress.webapp:wql.status." + key);
        this._setValidState();
        this._writeWqlToViewState(text);
        this._dispatch(webexpress.webui.Event.CHANGE_FILTER_EVENT, { value: text });
    }

    /**
     * Navigates through history.
     * @param {number} dir - Direction: 1 for forward, -1 for backward.
     */
    _navigateHistory(dir) {
        // guard clause if no history
        if (!this._history.length) {
            return;
        }

        const newIndex = Math.max(0, Math.min(this._history.length, this._historyIndex + dir));

        // save current input before moving away from "new" line
        if (this._historyIndex === this._history.length && dir < 0) {
            this._unsentInput = this._model.text;
        }

        // the index moves first, so the edit is not mistaken for typing on the unsent draft
        const previousIndex = this._historyIndex;
        this._historyIndex = newIndex;
        const entry = newIndex === this._history.length ? this._unsentInput : this._history[newIndex];

        // loading an entry is an undoable transaction; the caret goes to its end
        this._edit("history", () => this._model.setText(entry), 0, { before: previousIndex, after: newIndex });
    }

    /**
     * Clears error state and resets styling.
     */
    _setValidState() {
        this._lastError = null;
        if (this._validationStatus === "invalid") {
            this._validationStatus = "unchecked";
        }
        this._input.classList.remove("is-invalid");
        this._updateHint();
    }

    /**
     * Sets error state and updates hint area.
     * @param {string} msg - Error message.
     */
    _setInvalidState(msg) {
        this._validationStatus = "invalid";
        this._lastError = msg;
        this._input.dataset.validation = "invalid";
        this._input.setAttribute("aria-invalid", "true");
        this._input.classList.add("is-invalid");
        this._updateHint();
    }

    /**
     * Names the document kind this control shares: unformatted text (see
     * webexpress.webui.OtSchema.checkText).
     * @returns {string} The kind.
     */
    get collaborationKind() {
        return "text";
    }

    /**
     * Starts sharing the query text. Every edit is announced as steps on characters, so two
     * users typing at different places never overwrite each other, and undo inverts only the
     * user's own edits.
     */
    beginCollaboration() {
        this._collab = { history: new webexpress.webui.OtHistory(), tokens: this._textTokens(this._model.text) };
    }

    /**
     * Stops sharing the query text; the prompt's own undo starts afresh.
     */
    endCollaboration() {
        this._collab = null;
        this._undo.clear();
    }

    /**
     * Returns the text as packed tokens, as it was last announced.
     * @returns {Array<object>} The packed tokens.
     */
    getCollaborationTokens() {
        return webexpress.webui.Ot.compact(this._collab?.tokens ?? this._textTokens(this._model.text));
    }

    /**
     * Replaces the text with the shared state.
     * @param {Array<object>} tokens - The packed tokens.
     * @returns {boolean} True if they form valid text.
     */
    loadCollaborationTokens(tokens) {
        let expanded;
        try {
            expanded = webexpress.webui.Ot.expand(tokens);
        } catch {
            return false;
        }
        if (!webexpress.webui.OtSchema.checkText(expanded)) {
            return false;
        }
        const selection = this._model.selection;
        const clamp = (n) => Math.min(n, expanded.length);
        this._showShared(expanded, { anchor: clamp(selection.anchor), focus: clamp(selection.focus) });
        this._collab?.history.reset();
        return true;
    }

    /**
     * Checks packed tokens against the plain text schema.
     * @param {Array<object>} tokens - The tokens.
     * @returns {boolean} True if valid.
     */
    checkCollaborationTokens(tokens) {
        try {
            return webexpress.webui.OtSchema.checkText(webexpress.webui.Ot.expand(tokens));
        } catch {
            return false;
        }
    }

    /**
     * Repairs text by dropping everything that is not an unformatted character.
     * @param {Array<object>} tokens - The broken tokens.
     * @returns {Array<object>|null} The repaired packed tokens.
     */
    repairCollaborationTokens(tokens) {
        try {
            return webexpress.webui.Ot.compact(webexpress.webui.OtSchema.repairText(webexpress.webui.Ot.expand(tokens)));
        } catch {
            return null;
        }
    }

    /**
     * Applies steps another user made, moving the local selection along with the text.
     * @param {Array<object>} steps - The steps.
     * @returns {boolean} True if they applied to valid text.
     */
    applyRemoteSteps(steps) {
        if (!this._collab || this._destroyed) {
            return false;
        }
        let result;
        try {
            result = webexpress.webui.Ot.apply(this._collab.tokens, steps);
        } catch {
            return false;
        }
        if (!webexpress.webui.OtSchema.checkText(result.tokens)) {
            return false;
        }
        const selection = webexpress.webui.Ot.mapSelection(this._model.selection, result.steps, 1);
        this._showShared(result.tokens, selection);
        this._collab.history.remote(result.steps);
        return true;
    }

    /**
     * Gets the selection as model positions; in plain text they are the character offsets.
     * @returns {{anchor: number, focus: number}} The selection.
     */
    getModelSelection() {
        const selection = this._model.selection;
        return { anchor: selection.anchor, focus: selection.focus };
    }

    /**
     * Measures where a text position is shown, for another user's caret.
     * @param {number} pos - The position.
     * @returns {{left: number, top: number, height: number}|null} The viewport rectangle, or null.
     */
    getModelPositionRect(pos) {
        const range = this._rangeOf(pos, pos);
        const rect = range?.getClientRects?.()[0] ?? range?.getBoundingClientRect?.();
        return rect ? { left: rect.left, top: rect.top, height: rect.height || 16 } : null;
    }

    /**
     * Measures the lines a text range covers, for another user's selection.
     * @param {number} from - One end.
     * @param {number} to - The other end.
     * @returns {Array<object>} The viewport rectangles.
     */
    getModelRangeRects(from, to) {
        const range = from === to ? null : this._rangeOf(Math.min(from, to), Math.max(from, to));
        return Array.from(range?.getClientRects?.() ?? []).filter((r) => r.width > 0)
            .map((r) => ({ left: r.left, top: r.top, width: r.width, height: r.height }));
    }

    /**
     * Builds a DOM range between two text positions of the surface.
     * @param {number} from - The start.
     * @param {number} to - The end.
     * @returns {Range|null} The range, or null when the surface cannot map the positions.
     */
    _rangeOf(from, to) {
        if (this._destroyed || !this._view) {
            return null;
        }
        const map = this._view.map();
        const last = map.positions.length - 1;
        const start = map.positions[Math.min(from, last)], end = map.positions[Math.min(to, last)];
        if (!start || !end) {
            return null;
        }
        const range = document.createRange();
        try {
            range.setStart(start.node, start.offset);
            range.setEnd(end.node, end.offset);
        } catch {
            return null;
        }
        return range;
    }

    /**
     * Converts text to character tokens.
     * @param {string} text - The text.
     * @returns {Array<object>} The tokens.
     */
    _textTokens(text) {
        return text ? webexpress.webui.Ot.expand([{ t: "s", v: text, m: {} }]) : [];
    }

    /**
     * Shows shared text without announcing it again and without an undo step.
     * @param {Array<object>} tokens - The tokens.
     * @param {{anchor: number, focus: number}} selection - The selection to keep.
     */
    _showShared(tokens, selection) {
        if (this._collab) {
            this._collab.tokens = tokens;
        }
        const text = tokens.map((t) => t.v).join("");
        this._remote = true;
        try {
            this._edit(null, () => this._model.setText(text, selection));
        } finally {
            this._remote = false;
        }
    }

    /**
     * Announces what changed since the last announcement as steps. Typing and deleting merge
     * into word-sized undo steps; a programmatic change is shared but not undoable.
     * @param {string|null} kind - The edit kind of _edit, or null for a programmatic change.
     * @param {number} [hint] - Where the edit began, which places an insertion between equal
     * characters at the caret.
     */
    _announceText(kind, hint) {
        if (!this._collab || this._remote) {
            return;
        }
        const before = this._collab.tokens;
        const after = this._textTokens(this._model.text);
        const steps = webexpress.webui.Ot.diff(before, after, hint);
        if (!steps.length) {
            return;
        }
        const applied = webexpress.webui.Ot.apply(before, steps).steps;
        this._collab.tokens = after;
        if (kind) {
            const inserted = applied.map((step) => (step.slice ?? []).map((t) => t.v ?? "").join("")).join("");
            this._collab.history.record(applied, { kind: kind === "type" ? "typing" : kind === "delete" ? "delete" : null, text: inserted });
        } else {
            this._collab.history.remote(applied);
        }
        this._dispatch(webexpress.webui.Event.COLLABORATION_STEPS_EVENT, { steps: applied });
    }

    /**
     * Undoes or redoes an own edit while the text is shared.
     * @param {boolean} redo - True to redo.
     */
    _collabStep(redo) {
        let applied = null;
        const apply = (steps) => {
            let result;
            try {
                result = webexpress.webui.Ot.apply(this._collab.tokens, steps);
            } catch {
                return null;
            }
            if (!webexpress.webui.OtSchema.checkText(result.tokens) || webexpress.webui.Ot.equal(result.tokens, this._collab.tokens)) {
                return null;
            }
            // the caret goes to the end of what the step changed
            const last = [...result.steps].reverse().find((step) => step.type === "replace");
            const caret = last ? webexpress.webui.Ot.map(last.from + webexpress.webui.Ot.size(last.slice), result.steps.slice(result.steps.indexOf(last) + 1)) : this._model.selection.focus;
            this._showShared(result.tokens, { anchor: caret, focus: caret });
            applied = result.steps;
            return applied;
        };
        const history = this._collab.history;
        if (redo ? history.redo(apply) : history.undo(apply)) {
            this._dispatch(webexpress.webui.Event.COLLABORATION_STEPS_EVENT, { steps: applied });
        }
    }

    /**
     * Releases timers, requests, event handlers and pending state subscriptions.
     */
    destroy() {
        if (this._destroyed) {
            return;
        }
        this._destroyed = true;
        this._historyVersion++;
        this._invalidateAnalysis();
        clearTimeout(this._historyTimer);
        this._historyTimer = null;
        this._historyAbortController?.abort();
        this._validationAbortController?.abort();
        this._historyAbortController = null;
        this._validationAbortController = null;
        this._cancelViewStateReady?.();
        this._unsubscribeViewState?.();
        this._cancelViewStateReady = null;
        this._unsubscribeViewState = null;
        this._viewState = null;
        this._listeners.forEach((remove) => remove());
        this._listeners = [];
        super.destroy();
    }
};

// registers the class in the controller registry
webexpress.webui.Controller.registerClass("wx-webapp-wql-prompt", webexpress.webapp.WqlPromptCtrl);
