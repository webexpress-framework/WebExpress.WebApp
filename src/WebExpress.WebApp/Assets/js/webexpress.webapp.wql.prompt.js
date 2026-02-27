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
        // suggestion and parsing context
        this._suggestions = [];
        this._currentContext = null;
        this._tabCycleIndex = 0;
        this._lastError = null;
        // ui initialization
        this._initUi();
        this._attachListeners();
        // load history asynchronously after initialization
        setTimeout(() => { this._loadHistoryFromApi(); }, 200);
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
        this._input.addEventListener("input", this._onInput.bind(this));
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
        // traverse and join, treating <br> as '\n'
        let result = '';
        this._input.childNodes.forEach(node => {
            if (node.nodeType === 3) { // Text
                result += node.data;
            } else if (node.nodeName === "BR") {
                result += "\n";
            } else if (node.nodeType === 1) {
                result += node.textContent;
            }
        });
        return result;
    }

    /**
     * Sets the input field's content and applies syntax highlighting.
     * @param {string} value - The new value.
     */
    _setInputText(value) {
        this._input.innerHTML = "";
        const lines = value.split('\n');
        lines.forEach((line, idx) => {
            if (line.length > 0) {
                this._input.appendChild(document.createTextNode(line));
            }
            if (idx < lines.length - 1) {
                this._input.appendChild(document.createElement("br"));
            }
        });
        this._highlightSyntax();
    }

    /**
     * Handles input events (typing into the prompt).
     */
    _onInput() {
        this._setValidState();
        if (this._historyIndex === this._history.length) {
            this._unsentInput = this._getInputText();
        }
        if (this._debounceTimer) { clearTimeout(this._debounceTimer); }
        this._debounceTimer = setTimeout(() => {
            this._highlightSyntax();
            this._refreshContextAndSuggestions();
        }, this._debounceMs);
    }

    /**
     * Applies syntax highlighting for WQL using a language-specific function if available.
     * Preserves the cursor after re-highlighting contenteditable.
     * @param {string} [code] - Optional code to highlight.
     */
    _highlightSyntax(code) {
        code = code !== undefined ? code : this._getInputText();
        const syntaxFunction = webexpress.webui.Syntax?.get?.("wql");
        // preserve cursor position
        const selection = window.getSelection();
        let cursorOffset = 0;
        if (selection && this._input.contains(selection.anchorNode)) {
            const range = selection.getRangeAt(0);
            const preCaretRange = range.cloneRange();
            preCaretRange.selectNodeContents(this._input);
            preCaretRange.setEnd(range.endContainer, range.endOffset);
            cursorOffset = preCaretRange.toString().length;
        }
        this._input.innerHTML = "";
        if (typeof syntaxFunction === "function") {
            this._input.innerHTML = syntaxFunction(code);
        } else {
            this._input.textContent = code;
        }
        this._restoreCursor(cursorOffset);
    }

    /**
     * Restores caret/cursor position in the input field after syntactic changes.
     * @param {number} offset - The desired character offset.
     */
    _restoreCursor(offset) {
        let node = this._input;
        let charsLeft = offset;
        function setCursor(node) {
            for (let child of node.childNodes) {
                if (child.nodeType === 3) {
                    if (child.length >= charsLeft) {
                        const range = document.createRange();
                        const sel = window.getSelection();
                        range.setStart(child, charsLeft);
                        range.collapse(true);
                        sel.removeAllRanges();
                        sel.addRange(range);
                        return true;
                    } else {
                        charsLeft -= child.length;
                    }
                } else {
                    if (setCursor(child)) { return true; }
                }
            }
            return false;
        }
        setCursor(node);
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
            setTimeout(() => { this._loadHistoryFromApi(retryCount + 1); }, 500);
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
        if (this._debounceTimer) { clearTimeout(this._debounceTimer); }
        this._debounceTimer = setTimeout(() => {
            this._refreshContextAndSuggestions();
        }, 100);
    }

    /**
     * Refreshes the parsing context and fetches suggestions from the server.
     */
    async _refreshContextAndSuggestions() {
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
        urlObj.searchParams.set("c", cursorPos);
        const fetchUrl = this._apiUri.startsWith("http") ? urlObj.href : (urlObj.pathname + urlObj.search);
        try {
            const analyzeResp = await fetch(fetchUrl);
            if (analyzeResp.ok) {
                const analyzeData = await analyzeResp.json();
                if (analyzeData.isValidSoFar) {
                    this._setValidState();
                }
                this._currentContext = {
                    type: (analyzeData.currentExpressionType || "").toLowerCase(),
                    prefix: analyzeData.prefix || "",
                    tokenStart: cursorPos,
                    tokenEnd: cursorPos,
                    attribute: analyzeData.attribute
                };
                this._suggestions = Array.isArray(analyzeData.suggestions)
                    ? analyzeData.suggestions
                    : [];
                this._tabCycleIndex = 0;
                this._updateHint();
            }
        } catch (e) {
            console.error("[WQL] Context refresh error:", e);
        }
    }

    /**
     * Gets the cursor offset (character position) in the input field.
     * @returns {number} Cursor position.
     */
    _getCursorOffset() {
        const selection = window.getSelection();
        if (!selection || !this._input.contains(selection.anchorNode)) {
            return this._getInputText().length;
        }
        const range = selection.getRangeAt(0);
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(this._input);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        return preCaretRange.toString().length;
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
                // insert line break at cursor position in contenteditable
                e.preventDefault();
                document.execCommand("insertLineBreak");
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
            }
            return;
        }
        if (e.key === "PageUp" || e.key === "PageDown") {
            e.preventDefault();
            const dir = e.key === "PageDown" ? 1 : -1;
            this._navigateHistory(dir);
            return;
        }
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
     * Inserts the suggestion into the input field, applying smart formatting.
     * @param {string} value - The suggestion value.
     */
    _applySuggestion(value) {
        if (!this._currentContext) {
            return;
        }
        const { tokenStart, tokenEnd, type } = this._currentContext;
        let insertion = value;
        // Smart formatting logic per WQL type
        if (type === 'parenthesis_open') {
            insertion = `("${value}"`;
        } else if (type === 'set_parameter' || type === 'parameter') {
            if (!this._currentContext.quoted) {
                insertion = `"${value}"`;
            }
        } else if (type === 'set_next' && value === ',') {
            insertion = ", ";
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
        const before = val.slice(0, start);
        const after = val.slice(end);
        const newValue = before + text + after;
        this._setInputText(newValue);
        const newPos = before.length + text.length;
        this._restoreCursor(newPos);
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
            if (!label) { label = type || this._i18n("webexpress.webapp:wql.type.input") || "Input"; }
            if (this._suggestions.length === 0) {
                const noSuggestions = this._i18n("webexpress.webapp:wql.no.suggestions") || "No suggestions.";
                this._setHintHtml(`${label}: ${noSuggestions}`);
                return;
            }
            const selected = this._suggestions[this._tabCycleIndex];
            const others = this._suggestions.filter((_, i) => i !== this._tabCycleIndex).slice(0, 9);
            let html = `${label}: ${this._i18n("webexpress.webapp:wql.tab.label").replace("{0}", this._escapeHtml(selected))}`;
            if (others.length > 0) {
                html += ` ${this._i18n("webexpress.webapp:wql.cursor.label").replace("{0}", others.map(
                    o => `<b>${this._escapeHtml(o)}</b>`).join(", "))}`;
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
        if (!str) { return ""; }
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
        if (!text) { return; }
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
        if (!this._history.length) { return; }
        let newIndex = this._historyIndex + dir;
        if (newIndex < 0) { newIndex = 0; }
        if (newIndex > this._history.length) { newIndex = this._history.length; }
        if (this._historyIndex === this._history.length && dir < 0) {
            this._unsentInput = this._getInputText();
        }
        if (newIndex === this._history.length) {
            this._setInputText(this._unsentInput);
        } else {
            this._setInputText(this._history[newIndex]);
        }
        this._historyIndex = newIndex;
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
};

// registers the class in the controller registry
webexpress.webui.Controller.registerClass("wx-webapp-wql-prompt", webexpress.webapp.WqlPromptCtrl);