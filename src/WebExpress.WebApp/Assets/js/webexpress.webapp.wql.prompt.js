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
        // api uri for back-end operations
        this._apiUri = this._element.dataset.uri || null;

        // internal history state
        this._history = [];
        this._historyIndex = 0;
        this._unsentInput = "";

        // suggestion cache and timing
        this._suggestionCache = new Map();
        this._cacheTtl = 5 * 60 * 1000;
        this._debounceMs = 200;
        this._debounceTimer = null;
        this._abortController = null;

        // suggestion and parsing context
        this._suggestions = [];
        this._currentContext = null;
        this._tabCycleIndex = 0;
        this._lastError = null;
        this._value = "";

        // ui initialization
        this._initUi();
        this._attachListeners();

        // load history asynchronously after initialization
        setTimeout(() => {
            this._loadHistoryFromApi();
        }, 200);
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
        this._input.setAttribute("aria-label", "WQL Input");
        this._input.setAttribute("contenteditable", "true");
        this._input.setAttribute("spellcheck", "false");
        this._input.style.minHeight = "2em";
        this._input.style.fontFamily = "monospace";
        this._input.dataset.language = "wql";
        // prevents adding divs on enter in some browsers, ensures br
        this._input.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                // let custom handler manage it
            }
        });

        const placeholder = this._i18n("webexpress.webapp:wql.placeholder");
        this._input.dataset.placeholder = placeholder;

        inputGroup.appendChild(this._input);
        formGroup.appendChild(inputGroup);

        // unified hint/error area
        this._hint = document.createElement("small");
        this._hint.className = "form-text text-muted wx-wql-hint mt-1";

        const initMsg = this._i18n("webexpress.webapp:wql.status.initializing");
        this._setHintHtml(initMsg);

        formGroup.appendChild(this._hint);
        this._element.appendChild(formGroup);
    }

    /**
     * Attaches necessary event listeners to contenteditable input and buttons.
     */
    _attachListeners() {
        this._input.addEventListener("beforeinput", this._onBeforeInput.bind(this));
        this._input.addEventListener("input", this._onInput.bind(this));
        this._input.addEventListener("paste", this._onPaste.bind(this));
        this._input.addEventListener("keydown", this._onKeyDown.bind(this));
        this._input.addEventListener("click", this._onCursorMove.bind(this));
        this._input.addEventListener("keyup", (e) => {
            if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
                this._onCursorMove();
            }
        });
    }

    /**
     * Clears the input field and resets state.
     */
    _onClearInput() {
        this._setInputText("");
        this._input.focus();
        this._historyIndex = this._history.length;
        this._unsentInput = "";
        this._suggestions = [];
        this._currentContext = null;
        this._setValidState();
        this._refreshContextAndSuggestions();
    }

    /**
     * Gets plain text from the contenteditable input field.
     * @returns {string} The text content.
     */
    _getInputText() {
        return this._value;
    }

    /**
     * Sets the input field's content and applies syntax highlighting.
     * @param {string} value - The new value.
     */
    _setInputText(value) {
        this._value = this._normalizeInputText(value);
        this._highlightSyntax(this._value);
    }

    /**
     * Handles input events (typing into the prompt).
     */
    _onInput() {
        this._value = this._readInputTextFromDom();
        this._setValidState();

        if (this._historyIndex === this._history.length) {
            this._unsentInput = this._value;
        }

        this._scheduleRefresh();
    }

    /**
     * Handles editor mutations before the browser changes the highlighted DOM.
     * @param {InputEvent} e - The beforeinput event.
     */
    _onBeforeInput(e) {
        if (e.isComposing) {
            return;
        }

        const inputType = e.inputType || "";

        if (inputType === "insertFromDrop") {
            e.preventDefault();
            const dataTransfer = e.dataTransfer || e.clipboardData;
            const text = dataTransfer?.getData("text/plain") || e.data || "";
            this._replaceSelection(text);
            return;
        }

        if (inputType === "insertText" || inputType === "insertReplacementText") {
            e.preventDefault();
            this._replaceSelection(e.data || "");
            return;
        }

        if (inputType === "insertParagraph" || inputType === "insertLineBreak") {
            e.preventDefault();
            this._replaceSelection("\n");
            return;
        }

        if (inputType.startsWith("delete")) {
            e.preventDefault();
            this._deleteByInputType(inputType);
        }
    }

    /**
     * Handles paste and forces plain-text insertion.
     * @param {ClipboardEvent} e - The paste event.
     */
    _onPaste(e) {
        e.preventDefault();
        const text = e.clipboardData?.getData("text/plain") || "";
        this._replaceSelection(text);
    }

    /**
     * Applies syntax highlighting for WQL using a language-specific function if available.
     * Preserves the cursor after re-highlighting contenteditable.
     * @param {string} [code] - Optional code to highlight.
     */
    _highlightSyntax(code) {
        code = this._normalizeInputText(code !== undefined ? code : this._getInputText());
        const syntaxFunction = webexpress.webui.Syntax?.get?.("wql");

        // preserve cursor position
        const selection = this._getSelectionOffsets();

        // clear current content
        this._input.innerHTML = "";

        if (typeof syntaxFunction === "function") {
            // render highlighted html
            this._input.innerHTML = syntaxFunction(code);
        } else {
            // fallback to plain text
            this._input.textContent = code;
        }

        this._restoreSelection(selection.start, selection.end);
    }

    /**
     * Restores caret/cursor position in the input field after syntactic changes.
     * @param {number} offset - The desired character offset.
     */
    _restoreCursor(offset) {
        this._restoreSelection(offset, offset);
    }

    /**
     * Restores the text selection inside the input field.
     * @param {number} start - The desired selection start.
     * @param {number} [end] - The desired selection end.
     */
    _restoreSelection(start, end = start) {
        const range = document.createRange();
        const sel = window.getSelection();
        const startPos = this._resolveDomPosition(start);
        const endPos = this._resolveDomPosition(end);

        if (!sel) {
            return;
        }

        range.setStart(startPos.node, startPos.offset);
        range.setEnd(endPos.node, endPos.offset);
        sel.removeAllRanges();
        sel.addRange(range);
    }

    /**
     * Loads query history from the backend with retry.
     * @param {number} retryCount - The current retry attempt.
     */
    async _loadHistoryFromApi(retryCount = 0) {
        try {
            const resp = await fetch(this._apiUri + "/history");

            if (resp.ok) {
                const data = await resp.json();
                this._history = Array.isArray(data.history) ? data.history : [];
                this._historyIndex = this._history.length;

                const readyMsg = this._i18n("webexpress.webapp:wql.status.ready") || "Ready.";
                this._setHintHtml(readyMsg);
                return;
            }
        } catch (e) {
            console.warn(`[WQL] History load failed (Attempt ${retryCount + 1})`);
        }

        if (retryCount < 10) {
            setTimeout(() => {
                this._loadHistoryFromApi(retryCount + 1);
            }, 500);
        } else {
            const errorMsg = this._i18n("webexpress.webapp:wql.error.history.unavailable") || "History unavailable.";
            this._setHintHtml(errorMsg);
            this._history = [];
            this._historyIndex = 0;
        }
    }

    /**
     * Handles cursor movement and triggers context refresh.
     */
    _onCursorMove() {
        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
        }

        this._debounceTimer = setTimeout(() => {
            this._refreshContextAndSuggestions();
        }, 100);
    }

    /**
     * Refreshes the parsing context and fetches suggestions from the server.
     * Uses AbortController to cancel stale requests.
     */
    async _refreshContextAndSuggestions() {
        // cancel previous pending request
        if (this._abortController) {
            this._abortController.abort();
        }

        this._abortController = new AbortController();

        const text = this._getInputText();
        const cursorPos = this._getCursorOffset();
        const base = window.location.origin;
        let urlObj;

        try {
            urlObj = new URL(this._apiUri + "/analyze", base);
        } catch (e) {
            urlObj = new URL(this._apiUri + "/analyze", document.baseURI);
        }

        urlObj.searchParams.set("wql", text);
        urlObj.searchParams.set("c", cursorPos.toString());

        const fetchUrl = this._apiUri.startsWith("http") ? urlObj.href : (urlObj.pathname + urlObj.search);

        try {
            const analyzeResp = await fetch(fetchUrl, { signal: this._abortController.signal });

            if (analyzeResp.ok) {
                const analyzeData = await analyzeResp.json();

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

                this._currentContext = {
                    type: (analyzeData.currentExpressionType || "").toLowerCase(),
                    prefix: prefix,
                    tokenStart: tokenStart,
                    tokenEnd: cursorPos,
                    attribute: analyzeData.attribute,
                    quoted: analyzeData.quoted || false
                };

                this._suggestions = Array.isArray(analyzeData.suggestions) ? analyzeData.suggestions : [];
                this._tabCycleIndex = 0;
                this._updateHint();
            }
        } catch (e) {
            if (e.name !== "AbortError") {
                console.error("[WQL] Context refresh error:", e);
            }
        }
    }

    /**
     * Gets the cursor offset (character position) in the input field.
     * @returns {number} Cursor position.
     */
    _getCursorOffset() {
        return this._getSelectionOffsets().end;
    }

    /**
     * Handles key events: Tab, Enter, Arrows, PageUp/Down.
     * @param {KeyboardEvent} e - The keyboard event.
     */
    _onKeyDown(e) {
        if (e.key === "Tab") {
            e.preventDefault();
            this._handleTab();
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
     * Inserts a newline character at the current cursor position.
     * Manually manipulates DOM nodes to ensure correct behavior in contenteditable.
     */
    _insertLineBreakAtCursor() {
        this._replaceSelection("\n");
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
        let start = cursorPos;
        let end = cursorPos;

        while (start > 0) {
            const char = text.charAt(start - 1);

            if (/[a-zA-Z0-9_.-]/.test(char)) {
                start--;
            } else {
                break;
            }
        }

        while (end < text.length) {
            const char = text.charAt(end);

            if (/[a-zA-Z0-9_.-]/.test(char)) {
                end++;
            } else {
                break;
            }
        }

        return { start: start, end: end };
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
        const type = this._currentContext.type;
        const boundaries = this._getTokenBoundaries(text, cursorPos);

        let tokenStart = boundaries.start;
        let tokenEnd = boundaries.end;
        let insertion = value;

        // smart formatting logic per wql type
        if (type === "parenthesis_open") {
            insertion = `("${value}"`;
            tokenStart = cursorPos;
            tokenEnd = cursorPos;
        } else if (type === "set_parameter" || type === "parameter") {
            if (!this._currentContext.quoted) {
                insertion = `"${value}"`;
            }
        } else if (type === "set_next" && value === ",") {
            insertion = ", ";
            tokenStart = cursorPos;
            tokenEnd = cursorPos;
        }

        if (!insertion.endsWith(" ") && value !== "(") {
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
        this._restoreSelection(newPos, newPos);

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

        const typeKeys = {
            attribute: "webexpress.webapp:wql.type.attribute",
            operator: "webexpress.webapp:wql.type.operator",
            parameter: "webexpress.webapp:wql.type.parameter",
            set_parameter: "webexpress.webapp:wql.type.set.parameter",
            parenthesis_open: "webexpress.webapp:wql.type.parenthesis.open",
            set_next: "webexpress.webapp:wql.type.set.next",
            after_parameter: "webexpress.webapp:wql.type.after.parameter",
            logical_operator: "webexpress.webapp:wql.type.logical.operator",
            number: "webexpress.webapp:wql.type.number"
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
     * Submits the input for validation and history management.
     */
    async _submitInput() {
        const text = this._getInputText().trim();

        if (!text) {
            return;
        }

        // update history only if it differs from last entry
        if (this._history.length === 0 || this._history[this._history.length - 1] !== text) {
            this._history.push(text);
        }

        this._historyIndex = this._history.length;
        this._unsentInput = "";
        this._suggestions = [];
        this._currentContext = null;

        const sentMsg = this._i18n("webexpress.webapp:wql.status.sent") || "Valid query sent.";
        this._setHintHtml(sentMsg);

        this._setValidState();
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
        this._input.classList.remove("is-invalid");
        this._updateHint();
    }

    /**
     * Sets error state and updates hint area.
     * @param {string} msg - Error message.
     */
    _setInvalidState(msg) {
        this._lastError = msg;
        this._input.classList.add("is-invalid");
        this._updateHint();
    }

    /**
     * Normalizes editor text to the internal representation.
     * @param {string} value - The value to normalize.
     * @returns {string} The normalized text.
     */
    _normalizeInputText(value) {
        return (value || "")
            .replace(/\r\n?/g, "\n")
            .replace(/\u00A0/g, " ")
            .replace(/\u200B/g, "");
    }

    /**
     * Reads the plain-text editor content from the DOM.
     * @returns {string} The normalized text content.
     */
    _readInputTextFromDom() {
        return this._normalizeInputText(this._input.innerText || this._input.textContent || "");
    }

    /**
     * Returns the current selection offsets within the plain-text content.
     * @returns {{start: number, end: number}} The selection bounds.
     */
    _getSelectionOffsets() {
        const selection = window.getSelection();

        if (!selection
            || selection.rangeCount === 0
            || !selection.anchorNode
            || !selection.focusNode
            || !this._input.contains(selection.anchorNode)
            || !this._input.contains(selection.focusNode)) {
            const length = this._getInputText().length;
            return { start: length, end: length };
        }

        const range = selection.getRangeAt(0);
        const start = this._getOffsetFromPosition(range.startContainer, range.startOffset);
        const end = this._getOffsetFromPosition(range.endContainer, range.endOffset);

        return {
            start: Math.min(start, end),
            end: Math.max(start, end)
        };
    }

    /**
     * Calculates the plain-text offset for a DOM position.
     * @param {Node} node - The DOM node.
     * @param {number} offset - The DOM offset.
     * @returns {number} The plain-text offset.
     */
    _getOffsetFromPosition(node, offset) {
        const range = document.createRange();

        try {
            range.selectNodeContents(this._input);
            range.setEnd(node, offset);
        } catch (e) {
            return this._getInputText().length;
        }

        return this._normalizeInputText(range.toString()).length;
    }

    /**
     * Resolves a plain-text offset back to a DOM position.
     * @param {number} offset - The plain-text offset.
     * @returns {{node: Node, offset: number}} The DOM position.
     */
    _resolveDomPosition(offset) {
        const node = this._input;
        let charsLeft = Math.max(0, Math.min(offset, this._getInputText().length));

        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
        let current = walker.nextNode();

        while (current) {
            const normalizedText = current.data.replace(/\u200B/g, "");
            const normalizedLength = normalizedText.length;

            if (normalizedLength >= charsLeft) {
                let realOffset = 0;
                let visibleChars = 0;

                while (realOffset < current.data.length && visibleChars < charsLeft) {
                    if (current.data.charAt(realOffset) !== "\u200B") {
                        visibleChars++;
                    }
                    realOffset++;
                }

                return { node: current, offset: realOffset };
            }

            charsLeft -= normalizedLength;
            current = walker.nextNode();
        }

        return { node: this._input, offset: this._input.childNodes.length };
    }

    /**
     * Replaces the current selection with the provided text.
     * @param {string} text - The replacement text.
     */
    _replaceSelection(text) {
        const selection = this._getSelectionOffsets();
        const value = this._getInputText();
        const insertion = this._normalizeInputText(text);
        const next = value.slice(0, selection.start) + insertion + value.slice(selection.end);
        const nextPos = selection.start + insertion.length;

        this._setInputText(next);
        this._restoreSelection(nextPos, nextPos);

        if (this._historyIndex === this._history.length) {
            this._unsentInput = this._getInputText();
        }

        this._setValidState();
        this._scheduleRefresh();
        this._scrollInputToCaret();
    }

    /**
     * Applies the requested deletion behavior to the current selection.
     * @param {string} inputType - The delete input type.
     */
    _deleteByInputType(inputType) {
        const selection = this._getSelectionOffsets();
        const value = this._getInputText();

        // cut/drag deletions are selection-based; a collapsed range is a no-op
        if ((inputType === "deleteByCut" || inputType === "deleteByDrag") && selection.start === selection.end) {
            return;
        }

        if (selection.start !== selection.end) {
            this._replaceSelection("");
            return;
        }

        let start = selection.start;
        let end = selection.end;

        switch (inputType) {
            case "deleteContentBackward":
                start = Math.max(0, start - 1);
                break;
            case "deleteContentForward":
                end = Math.min(value.length, end + 1);
                break;
            case "deleteWordBackward":
                start = this._findPreviousWordBoundary(value, start);
                break;
            case "deleteWordForward":
                end = this._findNextWordBoundary(value, end);
                break;
            case "deleteSoftLineBackward":
            case "deleteHardLineBackward":
                start = this._findLineStart(value, start);
                break;
            case "deleteSoftLineForward":
            case "deleteHardLineForward":
                end = this._findLineEnd(value, end);
                break;
            default:
                console.warn(`[WQL] Unhandled delete input type: ${inputType}`);
                return;
        }

        if (start === end) {
            return;
        }

        const next = value.slice(0, start) + value.slice(end);
        this._setInputText(next);
        this._restoreSelection(start, start);

        if (this._historyIndex === this._history.length) {
            this._unsentInput = this._getInputText();
        }

        this._setValidState();
        this._scheduleRefresh();
        this._scrollInputToCaret();
    }

    /**
     * Finds the previous word boundary from a cursor position.
     * @param {string} text - The text to inspect.
     * @param {number} position - The cursor position.
     * @returns {number} The word boundary.
     */
    _findPreviousWordBoundary(text, position) {
        let index = Math.max(0, position);

        while (index > 0 && /\s/.test(text.charAt(index - 1))) {
            index--;
        }

        while (index > 0 && !/\s/.test(text.charAt(index - 1))) {
            index--;
        }

        return index;
    }

    /**
     * Finds the next word boundary from a cursor position.
     * @param {string} text - The text to inspect.
     * @param {number} position - The cursor position.
     * @returns {number} The word boundary.
     */
    _findNextWordBoundary(text, position) {
        let index = Math.max(0, position);

        while (index < text.length && /\s/.test(text.charAt(index))) {
            index++;
        }

        while (index < text.length && !/\s/.test(text.charAt(index))) {
            index++;
        }

        return index;
    }

    /**
     * Finds the start of the current line.
     * @param {string} text - The text to inspect.
     * @param {number} position - The cursor position.
     * @returns {number} The start index.
     */
    _findLineStart(text, position) {
        let index = Math.max(0, position);

        while (index > 0 && text.charAt(index - 1) !== "\n") {
            index--;
        }

        return index;
    }

    /**
     * Finds the end of the current line.
     * @param {string} text - The text to inspect.
     * @param {number} position - The cursor position.
     * @returns {number} The end index.
     */
    _findLineEnd(text, position) {
        let index = Math.max(0, position);

        while (index < text.length && text.charAt(index) !== "\n") {
            index++;
        }

        return index;
    }

    /**
     * Schedules syntax highlighting and suggestion refresh.
     */
    _scheduleRefresh() {
        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
        }

        this._debounceTimer = setTimeout(() => {
            this._highlightSyntax(this._getInputText());
            this._refreshContextAndSuggestions();
        }, this._debounceMs);
    }

    /**
     * Keeps the caret visible after local text mutations.
     */
    _scrollInputToCaret() {
        if (this._input.scrollHeight > this._input.clientHeight) {
            this._input.scrollTop = this._input.scrollHeight;
        }
    }
};

// registers the class in the controller registry
webexpress.webui.Controller.registerClass("wx-webapp-wql-prompt", webexpress.webapp.WqlPromptCtrl);
