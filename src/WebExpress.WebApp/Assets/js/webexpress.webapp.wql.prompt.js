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
 * - Triggers webexpress.webui.Event.CHANGE_FILTER_EVENT.
 */
webexpress.webapp.WqlPromptCtrl = class extends webexpress.webui.Ctrl {
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
        this._analysisVersion = 0;
        this._submissionVersion = 0;
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
            this._setHintHtml(this._i18n("webexpress.webapp:wql.status.ready") || "Ready.");
        }
    }

    /**
     * Gets the current WQL text. Public accessor so hosts (e.g. a settings
     * dialog) can read the value without reaching into the internals.
     * @returns {string} The WQL text.
     */
    get value() {
        return this._getInputText();
    }

    /**
     * Sets the WQL text and re-applies syntax highlighting.
     * @param {string} text - The WQL text.
     */
    set value(text) {
        this._setInputText(text != null ? String(text) : "");
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
            this._field.value = this._getInputText();
        }
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

        // contenteditable input field
        this._input = document.createElement("div");
        this._input.className = "form-control wx-wql-input wx-code-line";
        // an editable box is a text field to the reader, and a label is only allowed on a role
        this._input.setAttribute("role", "textbox");
        this._input.setAttribute("aria-multiline", "true");
        this._input.setAttribute("aria-label", this._i18n("webexpress.webapp:wql.input.label", "WQL query"));
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
        this._clearBtn.title = this._i18n("webexpress.webapp:wql.clear") || "Clear";
        this._clearBtn.setAttribute("aria-label", this._clearBtn.title);
        // resolve through the icon set when available; a lean runtime without the
        // helper falls back to the class pair the set would have produced
        const clearIcon = (typeof this._iconClass === "function")
            ? this._iconClass("xmark")
            : "wx-icon-light wx-icon-light-xmark";
        this._clearBtn.innerHTML = `<i class="${clearIcon}"></i>`;
        inputGroup.appendChild(this._clearBtn);

        formGroup.appendChild(inputGroup);

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
        this._listen(this._input, "input", () => this._onInput());
        this._listen(this._input, "keydown", (e) => this._onKeyDown(e));
        this._listen(this._input, "click", () => this._onCursorMove());
        this._listen(this._input, "keyup", (e) => {
            if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
                this._onCursorMove();
            }
        });
        this._listen(document, "selectionchange", () => {
            const selection = this._getSelectionOffsets();
            if (selection && (selection.anchor !== this._lastSelection?.anchor
                || selection.focus !== this._lastSelection?.focus)) {
                this._lastSelection = selection;
                this._onCursorMove();
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
        this._setInputText("");
        this._input.focus({ preventScroll: true });
        this._historyIndex = this._history.length;
        this._unsentInput = "";
        this._suggestions = [];
        this._currentContext = null;
        this._submitInput();
    }

    /**
     * Maps visible WQL text and DOM boundaries through the same newline rules.
     * Inline syntax spans do not separate lines, while line wrappers and breaks do.
     * @returns {object} The text, DOM positions and normalized offsets per node.
     */
    _getTextMap() {
        let text = "";
        const positions = [{ node: this._input, offset: 0 }];
        const offsets = new Map();
        const isLine = (node) => node.nodeType === Node.ELEMENT_NODE
            && (node.classList.contains("wx-code-line") || ["DIV", "P"].includes(node.nodeName));

        /**
         * Records every DOM boundary, including invisible placeholder characters.
         * @param {Node} node - The subtree whose text contributes to the editor.
         */
        const visit = (node) => {
            const boundaries = [];
            offsets.set(node, boundaries);
            if (node.nodeType === Node.TEXT_NODE) {
                for (let i = 0; i <= node.data.length; i++) {
                    boundaries[i] = text.length;
                    positions[text.length] = { node: node, offset: i };
                    if (i < node.data.length && node.data[i] !== "\u200B") {
                        text += node.data[i];
                    }
                }
                return;
            }
            boundaries[0] = text.length;
            if (node.nodeName === "BR") {
                text += "\n";
                return;
            }
            const children = Array.from(node.childNodes);
            if (children.length === 0) {
                positions[text.length] = { node: node, offset: 0 };
            }
            children.forEach((child, index) => {
                const previous = children[index - 1];
                if (previous && previous.nodeName !== "BR" && (isLine(child) || isLine(previous))
                    && (!text.endsWith("\n") || isLine(previous))) {
                    text += "\n";
                    positions[text.length] = { node: node, offset: index };
                }
                boundaries[index] = text.length;
                visit(child);
                boundaries[index + 1] = text.length;
                if (!positions[text.length]) {
                    positions[text.length] = { node: node, offset: index + 1 };
                }
            });
        };
        visit(this._input);
        return { text: text, positions: positions, offsets: offsets };
    }

    /**
     * Reads the same normalized text used by selection and completion offsets.
     * @returns {string} The WQL text without editor placeholders.
     */
    _getInputText() {
        return this._getTextMap().text;
    }

    /**
     * Replaces the draft and invalidates work started for the previous text.
     * @param {string} value - The new value.
     */
    _setInputText(value) {
        if (this._destroyed) {
            return;
        }
        this._invalidateInput();
        this._input.textContent = value;
        this._highlightSyntax();
        this._syncField();
    }

    /**
     * Prevents analysis responses from repopulating suggestions during debounce.
     */
    _invalidateAnalysis() {
        this._analysisVersion++;
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
        this._submissionVersion++;
        this._validationAbortController?.abort();
        this._validationAbortController = null;
        this._invalidateAnalysis();
        this._validationStatus = "unchecked";
        this._statusMessage = null;
        this._setValidState();
    }

    /**
     * Keeps the form field current while delaying highlighting and analysis.
     */
    _onInput() {
        if (this._destroyed) {
            return;
        }
        this._invalidateInput();
        this._syncField();
        if (this._historyIndex === this._history.length) {
            this._unsentInput = this._getInputText();
        }
        this._debounceTimer = setTimeout(() => {
            this._debounceTimer = null;
            this._highlightSyntax();
            this._refreshContextAndSuggestions();
        }, this._debounceMs);
    }

    /**
     * Applies highlighting without losing either selection endpoint or direction.
     * @param {string} [code] - Optional code to highlight.
     */
    _highlightSyntax(code) {
        code = code !== undefined ? code : this._getInputText();
        const syntaxFunction = webexpress.webui.Syntax?.get?.("wql");
        const selection = this._getSelectionOffsets();
        if (typeof syntaxFunction === "function") {
            this._input.innerHTML = syntaxFunction(code);
            this._input.querySelectorAll(".wx-code-line").forEach((line) => {
                if (!line.firstChild) {
                    // empty lines need a caret target without contributing query text
                    line.textContent = "\u200B";
                }
            });
        } else {
            this._input.textContent = code;
        }
        if (selection) {
            this._restoreSelection(selection.anchor, selection.focus);
        }
    }

    /**
     * Captures selection direction in the normalized text coordinate system.
     * @returns {object|null} Anchor and focus offsets when both belong to this editor.
     */
    _getSelectionOffsets() {
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount || !this._input.contains(selection.anchorNode)
            || !this._input.contains(selection.focusNode)) {
            return null;
        }
        const map = this._getTextMap();
        return {
            anchor: map.offsets.get(selection.anchorNode)[selection.anchorOffset],
            focus: map.offsets.get(selection.focusNode)[selection.focusOffset]
        };
    }

    /**
     * Restores both selection endpoints through the same map used for extraction.
     * @param {number} anchor - The normalized anchor offset.
     * @param {number} focus - The normalized focus offset.
     */
    _restoreSelection(anchor, focus) {
        const selection = window.getSelection();
        if (!selection) {
            return;
        }
        const map = this._getTextMap();
        const start = Math.max(0, Math.min(anchor, map.text.length));
        const end = Math.max(0, Math.min(focus, map.text.length));
        const a = map.positions[start];
        const f = map.positions[end];
        this._lastSelection = { anchor: start, focus: end };
        selection.setBaseAndExtent(a.node, a.offset, f.node, f.offset);
    }

    /**
     * Places a caret at a normalized character offset after a deliberate insertion.
     * @param {number} offset - The desired character offset.
     */
    _restoreCursor(offset) {
        this._restoreSelection(offset, offset);
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
            this._historyError = this._i18n("webexpress.webapp:wql.error.history.unavailable") || "History unavailable.";
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
        this._invalidateAnalysis();
        this._updateHint();
        this._debounceTimer = setTimeout(() => {
            this._debounceTimer = null;
            this._highlightSyntax();
            this._refreshContextAndSuggestions();
        }, 100);
    }

    /**
     * Refreshes the parsing context and fetches suggestions from the server.
     * Uses AbortController to cancel stale requests.
     */
    async _refreshContextAndSuggestions() {
        // standalone prompts (no service) offer no server-driven suggestions
        if (this._destroyed || !this._service) {
            return;
        }

        // cancel previous pending request
        if (this._abortController) {
            this._abortController.abort();
        }

        this._abortController = new AbortController();
        const controller = this._abortController;
        const version = ++this._analysisVersion;

        const text = this._getInputText();
        const cursorPos = this._getCursorOffset();
        const fetchUrl = this._analyzeUrl(text, cursorPos);

        try {
            const analyzeResp = await this._service.request(fetchUrl, { signal: controller.signal });
            if (this._destroyed || controller.signal.aborted || version !== this._analysisVersion
                || text !== this._getInputText() || cursorPos !== this._getCursorOffset()) {
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
                    // retain the existing quotes while replacing the entire literal suffix
                    tokenEnd = cursorPos;
                    while (tokenEnd < text.length && text[tokenEnd] !== quote) {
                        tokenEnd += text[tokenEnd] === "\\" && tokenEnd + 1 < text.length ? 2 : 1;
                    }
                }

                this._currentContext = {
                    type: (analyzeData.currentExpressionType || "").toLowerCase(),
                    prefix: prefix,
                    tokenStart: tokenStart,
                    tokenEnd: tokenEnd,
                    attribute: analyzeData.attribute,
                    quoted: analyzeData.quoted || false,
                    text: text,
                    cursorPos: cursorPos
                };

                this._suggestions = Array.isArray(analyzeData.suggestions) ? analyzeData.suggestions : [];
                this._tabCycleIndex = 0;
                this._updateHint();
            }
        } catch (e) {
            if (!this._destroyed && !controller.signal.aborted && version === this._analysisVersion && e.name !== "AbortError") {
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
     * Reads the active selection endpoint in normalized text coordinates.
     * @returns {number} The cursor position or the end of an unfocused editor.
     */
    _getCursorOffset() {
        return this._getSelectionOffsets()?.focus ?? this._getInputText().length;
    }

    /**
     * Handles key events: Tab, Enter, Arrows, PageUp/Down.
     * @param {KeyboardEvent} e - The keyboard event.
     */
    _onKeyDown(e) {
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
        const selection = this._getSelectionOffsets();
        if (!selection) {
            return;
        }
        const text = this._getInputText();
        const start = Math.min(selection.anchor, selection.focus);
        const end = Math.max(selection.anchor, selection.focus);
        this._setInputText(text.slice(0, start) + "\n" + text.slice(end));
        this._restoreCursor(start + 1);
        if (this._input.scrollHeight > this._input.clientHeight) {
            this._input.scrollTop = this._input.scrollHeight;
        }
        this._onInput();
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

        const text = this._getInputText();
        const cursorPos = this._getCursorOffset();
        if (this._currentContext.text !== undefined && (this._currentContext.text !== text
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
        // lower-cased WqlExpressionType enum names of the analyze endpoint
        if (type === "openparenthesis") {
            insertion = `("${value}"`;
            tokenStart = cursorPos;
            tokenEnd = cursorPos;
        } else if (type === "parameter" || type === "quotation") {
            if (!this._currentContext.quoted) {
                insertion = `"${value}"`;
            }
        } else if (type === "separator" && value === ",") {
            insertion = ", ";
            tokenStart = cursorPos;
            tokenEnd = cursorPos;
        }

        if (!this._currentContext.quoted && !insertion.endsWith(" ") && value !== "("
            && !/^\s/.test(text.slice(tokenEnd))) {
            insertion += " ";
        }

        this._insertReplacementAt(tokenStart, tokenEnd, insertion);
    }

    /**
     * Replaces character range in the input field.
     * @param {number} start - Start index.
     * @param {number} end - End index.
     * @param {string} text - Replacement text.
     */
    _insertReplacementAt(start, end, text) {
        const val = this._getInputText();

        // safety check for bounds
        const safeStart = Math.max(0, start);
        const safeEnd = Math.min(val.length, end);

        const before = val.slice(0, safeStart);
        const after = val.slice(safeEnd);
        const newValue = before + text + after;

        this._setInputText(newValue);

        const newPos = before.length + text.length;
        this._restoreCursor(newPos);

        // immediately refresh to update context for next input
        this._refreshContextAndSuggestions();
    }

    /**
     * Updates hint text below the input field.
     */
    _updateHint() {
        if (this._lastError) {
            this._hint.classList.remove("text-muted");
            this._hint.classList.add("text-danger");
            const errLabel = this._i18n("webexpress.webapp:wql.error.label") || "Error";
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
                label = type || this._i18n("webexpress.webapp:wql.type.input") || "Input";
            }

            if (this._suggestions.length === 0) {
                const noSuggestions = this._i18n("webexpress.webapp:wql.no.suggestions") || "No suggestions.";
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
        const draft = this._getInputText();
        const text = draft.trim();
        const version = ++this._submissionVersion;
        this._validationAbortController?.abort();
        this._invalidateAnalysis();
        this._validationStatus = "unchecked";
        this._statusMessage = null;
        this._setValidState();
        const controller = new AbortController();
        this._validationAbortController = controller;
        const result = text ? await this._validateInput(text, controller.signal) : { status: "unchecked" };
        if (this._destroyed || version !== this._submissionVersion || controller.signal.aborted
            || this._getInputText() !== draft) {
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

        let newIndex = this._historyIndex + dir;

        // clamp index
        if (newIndex < 0) {
            newIndex = 0;
        }
        if (newIndex > this._history.length) {
            newIndex = this._history.length;
        }

        // save current input before moving away from "new" line
        if (this._historyIndex === this._history.length && dir < 0) {
            this._unsentInput = this._getInputText();
        }

        // restore appropriate text
        if (newIndex === this._history.length) {
            this._setInputText(this._unsentInput);
        } else {
            this._setInputText(this._history[newIndex]);
        }

        this._historyIndex = newIndex;

        // cursor to end after history switch
        this._restoreCursor(this._getInputText().length);
        this._refreshContextAndSuggestions();
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
     * Releases timers, requests, event handlers and pending state subscriptions.
     */
    destroy() {
        if (this._destroyed) {
            return;
        }
        this._destroyed = true;
        this._submissionVersion++;
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