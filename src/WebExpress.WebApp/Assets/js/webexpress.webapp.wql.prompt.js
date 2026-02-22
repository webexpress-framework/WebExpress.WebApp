/**
 * Provides a terminal-like input field for WebExpress Query Language (WQL).
 * Features:
 * - Context-aware auto-completion (Attributes, Operators, Values, Logic).
 * - Debounced server-side parsing and validation.
 * - History navigation (Shell-like).
 * - Syntax highlighting (via suggestion hints).
 * - Smart formatting (auto-quoting, auto-parenthesis).
 * - Clear button and Multi-line support (Ctrl+Enter).
 * - Unified Hint/Error display with styled keyboard shortcuts.
 * The following events are triggered:
 * - webexpress.webui.Event.CHANGE_FILTER_EVENT
 */
webexpress.webapp.WqlPromptCtrl = class extends webexpress.webui.Ctrl {
    
    /**
     * Initializes the WQL Prompt Controller.
     * @param {HTMLElement} element - The DOM element to attach to.
     */
    constructor(element) {
        super(element);

        // api configuration
        this._apiUri = this._element.dataset.uri || null;
        
        // history state
        this._history = [];
        this._historyIndex = 0;
        this._unsentInput = "";
        
        // cache & timing
        this._suggestionCache = new Map();
        this._cacheTtl = 5 * 60 * 1000; // 5 minutes
        this._debounceMs = 200;
        this._debounceTimer = null;
        
        // suggestion state
        this._suggestions = [];
        this._currentContext = null;
        this._tabCycleIndex = 0;
        this._lastError = null; // stores the current validation error if any

        // ui initialization
        this._initUi();
        this._attachListeners();

        // load history asynchronously
        setTimeout(() => this._loadHistoryFromApi(), 200);
    }

    /**
     * Builds the DOM structure for the prompt.
     * Uses Bootstrap classes for layout.
     */
    _initUi() {
        this._element.classList.add("wx-wql");
        this._element.style.position = "relative";

        const formGroup = document.createElement("div");
        formGroup.className = "form-group mb-0";

        const inputGroup = document.createElement("div");
        inputGroup.className = "input-group";

        // textarea Input
        this._input = document.createElement("textarea");
        this._input.className = "form-control wx-wql-input";      
        this._input.setAttribute("aria-label", "WQL Input");
        
        this._input.spellcheck = false;
        this._input.style.resize = "vertical";
        this._input.rows = 1;
        this._input.style.fontFamily = "monospace";
        
        const placeholder = this._i18n("webexpress.webapp:wql.placeholder");
        this._input.placeholder = placeholder;

        // assemble
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
     * Attaches necessary event listeners to input and buttons.
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
        this._input.value = "";
        this._input.focus(); 
        
        this._historyIndex = this._history.length;
        this._unsentInput = "";
        
        this._suggestions = [];
        this._currentContext = null;
        this._setValidState();
        
        this._refreshContextAndSuggestions();
    }

    /**
     * Loads the query history from the backend with a retry mechanism.
     * @param {number} retryCount - Current attempt number.
     */
    async _loadHistoryFromApi(retryCount = 0) {
        try {
            const resp = await fetch(this._apiUri + "/history");
            if (resp.ok) {
                const data = await resp.json();
                this._history = Array.isArray(data.history) ? data.history : [];
                this._historyIndex = this._history.length;
                
                const readyMsg = this._i18n("webexpress.webapp:wql.status.ready") || "Ready.";
                this._setHintHtml(`${readyMsg}`);
                return;
            }
        } catch (e) {
            console.warn(`[WQL] History load failed (Attempt ${retryCount + 1})`);
        }

        if (retryCount < 10) {
            setTimeout(() => this._loadHistoryFromApi(retryCount + 1), 500);
        } else {
            const errorMsg = this._i18n("webexpress.webapp:wql.error.history.unavailable") || "History unavailable.";
            this._setHintHtml(errorMsg);
            this._history = [];
            this._historyIndex = 0;
        }
    }

    /**
     * Handles input events (typing).
     */
    _onInput() {
        this._setValidState();
        
        if (this._historyIndex === this._history.length) {
            this._unsentInput = this._input.value;
        }

        if (this._debounceTimer) clearTimeout(this._debounceTimer);
        this._debounceTimer = setTimeout(() => {
            this._refreshContextAndSuggestions();
        }, this._debounceMs);
    }

    /**
     * Handles cursor movement to refresh context-aware suggestions.
     */
    _onCursorMove() {
        if (this._debounceTimer) clearTimeout(this._debounceTimer);
        this._debounceTimer = setTimeout(() => {
            this._refreshContextAndSuggestions();
        }, 100);
    }

    /**
     * Refreshes the parsing context and fetches suggestions from the server.
     */
    async _refreshContextAndSuggestions() {
        const text = this._input.value;
        const cursorPos = this._input.selectionStart;

        // build request url with fallback for relative uris
        const base = window.location.origin;
        let urlObj;
        try {
            urlObj = new URL(this._apiUri + "/analyze", base);
        } catch (e) {
            urlObj = new URL(this._apiUri + "/analyze", document.baseURI);
        }

        // set query parameters
        urlObj.searchParams.set("wql", text);
        urlObj.searchParams.set("c", cursorPos);

        const fetchUrl = this._apiUri.startsWith("http") ? urlObj.href : (urlObj.pathname + urlObj.search);

        try {
            const analyzeResp = await fetch(fetchUrl);

            if (analyzeResp.ok) {
                const analyzeData = await analyzeResp.json();
                this._currentContext = analyzeData.context; 
            
                await this._fetchSuggestions(this._currentContext);
                this._updateHint();
            }
        } catch (e) {
            console.error("[WQL] Context refresh error:", e);
        }
    }

    /**
     * Fetches suggestions based on the current context.
     * @param {Object} context - The context object from the parser.
     */
    async _fetchSuggestions(context) {
        if (!context) {
            this._suggestions = [];
            return;
        }

        const { type, prefix, attribute } = context;
        const key = `${type}:${attribute || ''}:${(prefix || '').toLowerCase()}`;
        
        if (this._suggestionCache.has(key)) {
            const entry = this._suggestionCache.get(key);
            if (Date.now() - entry.ts < this._cacheTtl) {
                this._suggestions = entry.items;
                this._tabCycleIndex = 0;
                return;
            }
        }

        const params = new URLSearchParams();
        if (type) params.append("type", type);
        if (prefix) params.append("prefix", prefix);
        if (attribute) params.append("attribute", attribute);

        try {
            const resp = await fetch(`${this._apiUri}/suggestions?${params}`);
            if (resp.ok) {
                const data = await resp.json();
                this._suggestions = Array.isArray(data.items) ? data.items : [];
                
                this._suggestionCache.set(key, { items: this._suggestions, ts: Date.now() });
                this._tabCycleIndex = 0;
            } else {
                this._suggestions = [];
            }
        } catch (e) {
            console.error("[WQL] Suggestion fetch error:", e);
            this._suggestions = [];
        }
    }

    /**
     * Handles special key events (Tab, Enter, Arrows, PageUp/Down).
     * @param {KeyboardEvent} e 
     */
    _onKeyDown(e) {
        if (e.key === "Tab") {
            e.preventDefault();
            this._handleTab();
            return;
        }

        if (e.key === "Enter") {
            if (e.ctrlKey) {
                this._historyIndex = this._history.length;
            } else {
                e.preventDefault();
                this._submitInput();
            }
            return;
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
        if (!this._suggestions || this._suggestions.length === 0) return;
        const suggestion = this._suggestions[this._tabCycleIndex];
        this._applySuggestion(suggestion);
    }

    /**
     * Cycles through the suggestion list.
     * @param {number} dir - Direction.
     */
    _cycleSuggestions(dir) {
        if (this._suggestions.length === 0) return;
        this._tabCycleIndex = (this._tabCycleIndex + dir + this._suggestions.length) % this._suggestions.length;
        this._updateHint();
    }

    /**
     * Inserts the suggestion into the input field, applying smart formatting.
     * @param {string} value - The suggestion value.
     */
    _applySuggestion(value) {
        if (!this._currentContext) return;
        const { tokenStart, tokenEnd, type } = this._currentContext;
        let insertion = value;

        // smart formatting
        if (type === 'parenthesis_open') {
             insertion = `("${value}"`; 
        } else if (type === 'set_parameter' || type === 'parameter') {
            if (!this._currentContext.quoted) {
                insertion = `"${value}"`;
            } else {
                insertion = value;
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
     * Replaces text range in the input field.
     */
    _insertReplacementAt(start, end, text) {
        const val = this._input.value;
        const before = val.slice(0, start);
        const after = val.slice(end);
        
        this._input.value = before + text + after;
        
        const newPos = before.length + text.length;
        this._input.setSelectionRange(newPos, newPos);
        
        this._refreshContextAndSuggestions();
    }

    /**
     * Updates the hint text below the input field.
     */
    _updateHint() {
        if (this._lastError) {
            this._hint.classList.remove("text-muted");
            this._hint.classList.add("text-danger");
            const errLabel = this._i18n("webexpress.webapp:wql.error.label") || "Error";
            this._setHintHtml(`<b>${errLabel}:</b> ${this._escapeHtml(this._lastError)}`);
            return;
        }

        // normal suggestion mode
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
            if (!label) label = type || this._i18n("webexpress.webapp:wql.type.input") || "Input";

            if (this._suggestions.length === 0) { 
                const noSuggestions = this._i18n("webexpress.webapp:wql.no.suggestions") || "No suggestions.";
                this._setHintHtml(`${label}: ${noSuggestions}`);
                return;
            }

            const selected = this._suggestions[this._tabCycleIndex];
            const others = this._suggestions.filter((_, i) => i !== this._tabCycleIndex).slice(0, 9);
        
            // suggestion display with key hint
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
     */
    _setHintHtml(html) {
        this._hint.innerHTML = html;
    }

    /**
     * Escapes HTML characters.
     */
    _escapeHtml(str) {
        if (!str) return "";
        return str.toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /**
     * Submits the input for validation.
     */
    async _submitInput() {
        const text = this._input.value.trim();
        if (!text) return;

        try {
            const resp = await fetch(this._apiUri + "/validate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: text })
            });
            
            const res = await resp.json();
            
            if (res.valid) {
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

                // trigger event for external listeners
                this._dispatch(webexpress.webui.Event.CHANGE_FILTER_EVENT, { value: text });
            } else {
                const unknownError = this._i18n("webexpress.webapp:wql.error.unknown") || "Unknown error";
                this._setInvalidState(res.error || unknownError);
            }
        } catch (e) {
            console.error("[WQL] Validation error:", e);
            const netError = this._i18n("webexpress.webapp:wql.error.network") || "Network error during validation.";
            this._setInvalidState(netError);
        }
    }

    /**
     * Navigates through history.
     */
    _navigateHistory(dir) {
        if (!this._history.length) return;

        let newIndex = this._historyIndex + dir;

        if (newIndex < 0) newIndex = 0;
        if (newIndex > this._history.length) newIndex = this._history.length;
        
        if (this._historyIndex === this._history.length && dir < 0) {
            this._unsentInput = this._input.value;
        }

        if (newIndex === this._history.length) {
            this._input.value = this._unsentInput;
        } else {
            this._input.value = this._history[newIndex];
        }
        
        this._historyIndex = newIndex;
        
        const len = this._input.value.length;
        this._input.setSelectionRange(len, len);
        
        this._refreshContextAndSuggestions();
    }

    /**
     * Clears error state and resets styling.
     */
    _setValidState() {
        this._lastError = null;
        this._input.classList.remove("is-invalid");
        // force hint update to show suggestions again
        this._updateHint(); 
    }

    /**
     * Sets error state and updates hint area.
     * @param {string} msg - Error message.
     */
    _setInvalidState(msg) {
        this._lastError = msg;
        this._input.classList.add("is-invalid");
        // force hint update to show error
        this._updateHint();
    }
};

// register the class in the controller
webexpress.webui.Controller.registerClass("wx-webapp-wql-prompt", webexpress.webapp.WqlPromptCtrl);