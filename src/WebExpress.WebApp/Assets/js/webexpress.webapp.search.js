/// <summary>
/// Represents a combined search control that integrates a basic search input
/// and an advanced WQL prompt into a single, user-toggleable component. The
/// control listens for webexpress.webui.Event.CHANGE_FILTER_EVENT from the
/// basic search and webexpress.webapp.Event.WQL_FILTER_EVENT from the WQL
/// prompt, normalizes their payloads and re-emits a unified
/// webexpress.webui.Event.CHANGE_FILTER_EVENT.
/// </summary>
webexpress.webapp.SearchCtrl = class extends webexpress.webui.Ctrl {
    /**
     * Construct new SearchCtrl.
     * @param {HTMLElement} element - host element for the combined control.
     */
    constructor(element) {
        super(element);

        // configuration
        this._initialMode = "basic";
        if (element.dataset.initial && (element.dataset.initial === "wql" || element.dataset.initial === "basic")) {
            this._initialMode = element.dataset.initial;
        }

        this._uri = this._element.dataset.uri || null;

        // clean up the dom element and set base classes for styling
        element.textContent = "";
        element.removeAttribute("data-uri");
        element.removeAttribute("data-initial");

        // hosts and children
        this._basicHost = null;
        this._wqlHost = null;
        this._basicCtrl = null;
        this._wqlCtrl = null;

        // single toggle control as link with text
        this._toggleModeLink = null;

        // container for arbitrary extended content that was originally a child of the host
        this._extendedContent = null;

        // build UI and initialize
        this._buildDom();
        this._initChildren();
        this._attachEventHandlers();
        this._applyMode(this._initialMode);
    }

    /**
     * Build the control DOM (input area + extended content + single link toggle to the right).
     * Preserves any existing child elements of the host and places them in an
     * extended content container to the right of the input area.
     */
    _buildDom() {
        // capture original children so they can be reparented into extended content
        const originalChildren = Array.from(this._element.children);

        // create outer container row
        const row = document.createElement("div");
        row.className = "wx-search-advanced-wrapper";

        // input area (will hold basic and wql hosts stacked, only one visible)
        const inputArea = document.createElement("div");
        inputArea.className = "wx-search-advanced-input-area";
        
        // hosts for embedded controls
        this._basicHost = document.createElement("div");
        this._basicHost.className = "wx-search-advanced-basic";

        this._wqlHost = document.createElement("div");
        this._wqlHost.className = "wx-search-advanced-wql";

        inputArea.appendChild(this._basicHost);
        inputArea.appendChild(this._wqlHost);

        // extended content container: reparent original children here
        this._extendedContent = document.createElement("div");
        this._extendedContent.className = "wx-search-advanced-content";
        // reparent original children into extended content (keeps them as-is)
        for (const child of originalChildren) {
            this._extendedContent.appendChild(child);
        }

        // single link on the right (text-only)
        this._toggleModeLink = document.createElement("a");
        this._toggleModeLink.href = "#";
        this._toggleModeLink.className = "wx-link";
        this._toggleModeLink.setAttribute("role", "button");
        this._toggleModeLink.setAttribute("aria-label", "toggle search mode");

        // assemble into host: input area, extended content, toggle link
        this._element.innerHTML = "";
        this._element.className = "wx-search-advanced";
        row.appendChild(inputArea);
        row.appendChild(this._extendedContent);
        row.appendChild(this._toggleModeLink);
        this._element.appendChild(row);

        // accessibility: indicate searchable region
        this._element.setAttribute("role", "search");
    }

    /**
     * Instantiate existing SearchCtrl and WqlPromptCtrl inside hosts.
     */
    _initChildren() {
        // basic wrapper markup expected by SearchCtrl
        const basicWrapper = document.createElement("div");
        basicWrapper.className = "wx-webui-search-host";
        if (this._element.dataset.value) {
            basicWrapper.dataset.value = this._element.dataset.value;
        }
        // ensure basic wrapper fills width
        basicWrapper.style.width = "100%";
        this._basicHost.appendChild(basicWrapper);

        // instantiate basic search controller
        try {
            this._basicCtrl = new webexpress.webui.SearchCtrl(basicWrapper);
        } catch (err) {
            console.error("SearchAdvanced: failed to initialize basic search:", err);
            this._basicCtrl = null;
        }

        // wql wrapper and dataset uri
        const wqlWrapper = document.createElement("div");
        wqlWrapper.className = "wx-webapp-wql-host";
        if (this._uri) {
            wqlWrapper.dataset.uri = this._uri;
        }
        // ensure wql wrapper fills width
        wqlWrapper.style.width = "100%";
        this._wqlHost.appendChild(wqlWrapper);

        // instantiate WQL prompt controller
        try {
            this._wqlCtrl = new webexpress.webapp.WqlPromptCtrl(wqlWrapper);
        } catch (err) {
            console.error("SearchAdvanced: failed to initialize WQL prompt:", err);
            this._wqlCtrl = null;
        }

        // make hosts block-level and default visible state
        this._basicHost.style.display = "block";
        this._wqlHost.style.display = "none";
    }

    /**
     * Attach event handlers for child events and UI interaction.
     */
    _attachEventHandlers() {
        // click on toggle link switches mode
        this._toggleModeLink.addEventListener("click", (e) => {
            e.preventDefault();
            // toggle mode
            const newMode = (this._initialMode === "basic") ? "wql" : "basic";
            this._applyMode(newMode);
            // focus the newly visible control
            if (this._initialMode === "basic") {
                if (this._wqlCtrl && this._wqlCtrl._input) {
                    this._wqlCtrl._input.focus();
                }
            } else {
                if (this._basicCtrl && this._basicCtrl._searchInput) {
                    this._basicCtrl._searchInput.focus();
                }
            }
        });

        // listen for basic search change events
        this._basicHost.addEventListener(webexpress.webui.Event.CHANGE_FILTER_EVENT, (e) => {
            e.stopPropagation();

            // ignore events emitted by this wrapper itself
            if (e.detail && e.detail._fromAdvanced) {
                return;
            }
            // ensure event originates from basic child
            if (this._basicHost.contains(e.target)) {
                const val = (e.detail && e.detail.value) || "";
                this._dispatch(webexpress.webui.Event.CHANGE_FILTER_EVENT, {
                    value: val,
                    searchType: "basic"
                });
            }
        });

        // listen for wql search change events
        this._wqlHost.addEventListener(webexpress.webui.Event.CHANGE_FILTER_EVENT, (e) => {
            e.stopPropagation();

            // ignore events emitted by this wrapper itself
            if (e.detail && e.detail._fromAdvanced) {
                return;
            }
            // ensure event originates from wql child
            if (this._wqlHost.contains(e.target)) {
                const val = (e.detail && e.detail.value) || "";
                this._dispatch(webexpress.webui.Event.CHANGE_FILTER_EVENT, {
                    value: val,
                    searchType: "wql"
                });
            }
        });

        // also catch generic change events from children to maximize compatibility
        this._element.addEventListener("change", (e) => {
            // ignore events emitted by this wrapper itself
            if (e.detail && e.detail._fromAdvanced) {
                return;
            }
            if (this._basicHost.contains(e.target)) {
                const val = (e.detail && (e.detail.value || e.detail.query)) || "";
                this._dispatch(webexpress.webui.Event.CHANGE_FILTER_EVENT, {
                    value: val,
                    source: "basic",
                    _fromAdvanced: true 
                });
            }
        });
    }

    /**
     * Switch visible mode between "basic" and "wql".
     * Copies values between inputs to preserve user text.
     * @param {string} mode - either "basic" or "wql".
     */
    _applyMode(mode) {
        if (mode !== "basic" && mode !== "wql") {
            mode = "basic";
        }

        if (mode === "wql") {
            // copy current basic value into wql prompt
            if (this._basicCtrl && this._wqlCtrl) {
                try {
                    const basicVal = this._basicCtrl.value || (this._basicCtrl._searchInput ? this._basicCtrl._searchInput.value : "");
                    if (this._wqlCtrl._input) {
                        this._wqlCtrl._input.value = basicVal;
                        // refresh suggestions/context if available
                        if (typeof this._wqlCtrl._refreshContextAndSuggestions === "function") {
                            this._wqlCtrl._refreshContextAndSuggestions();
                        }
                    }
                } catch (err) {
                    // ignore copy errors
                }
            }
        } else {
            // mode === "basic"
            if (this._basicCtrl && this._wqlCtrl) {
                try {
                    const wqlVal = (this._wqlCtrl._input ? this._wqlCtrl._input.value : "") || "";
                    if (typeof this._basicCtrl.value !== "undefined") {
                        this._basicCtrl.value = wqlVal;
                    } else if (this._basicCtrl._searchInput) {
                        this._basicCtrl._searchInput.value = wqlVal;
                    }
                } catch (err) {
                    // ignore copy errors
                }
            }
        }

        // apply visibility and update link text/aria
        if (mode === "basic") {
            this._basicHost.style.display = "block";
            this._wqlHost.style.display = "none";
            // show link labeled "extended" to switch to advanced
            this._toggleModeLink.textContent = "advanced";
            this._toggleModeLink.setAttribute("aria-label", "switch to wql");
        } else {
            this._basicHost.style.display = "none";
            this._wqlHost.style.display = "block";
            // show link labeled "Basic" to switch to simple
            this._toggleModeLink.textContent = "basic";
            this._toggleModeLink.setAttribute("aria-label", "switch to basic");
        }

        // remember active mode
        this._initialMode = mode;
    }
};

// register the class in the controller
webexpress.webui.Controller.registerClass("wx-webapp-search", webexpress.webapp.SearchCtrl);