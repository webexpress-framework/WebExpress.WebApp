/**
 * Unique input control that validates a text value against a remote API for uniqueness.
 * The initial value is not validated until it changes. An optional debounce can be 
 * configured via data-debounce (milliseconds).
 * The control updates visual state based on the server response and dispatches the 
 * following events on the host element:
 * - webexpress.webui.Event.DATA_REQUESTED_EVENT
 * - webexpress.webui.Event.DATA_ARRIVED_EVENT
 */
webexpress.webapp.InputUniqueCtrl = class extends webexpress.webui.Ctrl {
    /**
     * Creates a new unique input control instance.
     * @param {HTMLElement} element - The host element for the control.
     */
    constructor(element) {
        super(element);

        // read configuration from attributes
        const el = this._element;
        this._fieldName = el.getAttribute("name") || "unique";
        this._initialValue = el.getAttribute("data-value") || null;
        this._url = el.getAttribute("data-uri") || el.getAttribute("data-url") || "";
        this._method = (el.getAttribute("data-method") || "GET").toUpperCase();
        this._param = el.getAttribute("data-param") || "v";
        this._responseField = el.getAttribute("data-response-field") || "available";
        this._minlength = parseInt(el.getAttribute("data-minlength") || "1", 10);
        this._placeholderText = el.getAttribute("placeholder") || "";
        this._cssAvailable = el.getAttribute("data-css-available") || "is-valid";
        this._cssUnavailable = el.getAttribute("data-css-unavailable") || "is-invalid";
        this._cssChecking = el.getAttribute("data-css-checking") || "is-checking";
        this._messageAvailable = el.getAttribute("data-message-available") || this._i18n("webexpress.webapp:input.unique.available");
        this._messageUnavailable = el.getAttribute("data-message-unavailable") || this._i18n("webexpress.webapp:input.unique.unavailable");
        this._messageChecking = el.getAttribute("data-message-checking") || this._i18n("webexpress.webapp:input.unique.checking");
        this._messageError = el.getAttribute("data-message-error") || this._i18n("webexpress.webapp:input.unique.error");
        this._headers = this._parseHeaders(el.getAttribute("data-headers"));
        this._debounceMs = parseInt(el.getAttribute("data-debounce") || "0", 10);

        // internal state initialization
        this._currentValue = this._initialValue ?? "";
        this._abortController = null;
        this._pendingTimer = null;
        this._destroyed = false;
        this._iconI = null;

        // prepare host element
        el.classList.add("wx-unique");
        el.innerHTML = "";
        // remove config-bearing attributes from the host as they are now internal
        [
            "name",
            "placeholder",
            "data-value",
            "data-url",
            "data-uri",
            "data-method",
            "data-param",
            "data-response-field",
            "data-minlength",
            "data-css-available",
            "data-css-unavailable",
            "data-css-checking",
            "data-message-available",
            "data-message-unavailable",
            "data-message-checking",
            "data-message-error",
            "data-headers",
            "data-debounce"
        ].forEach((attr) => {
            el.removeAttribute(attr);
        });

        // build dom
        this._buildDom();

        // set initial state to idle, never auto-check initial value
        this._setState("idle", "");
    }

    /**
     * Builds the DOM subtree for the control and wires event listeners.
     */
    _buildDom() {
        // visible input
        this._input = document.createElement("input");
        this._input.type = "text";
        this._input.className = "input form-control";
        this._input.value = this._currentValue;
        if (this._placeholderText) {
            // set placeholder if provided
            this._input.setAttribute("placeholder", this._placeholderText);
        }
        this._input.setAttribute("autocomplete", "off");
        this._input.setAttribute("autocapitalize", "none");
        this._input.setAttribute("spellcheck", "false");
        this._input.name = this._fieldName;

        // status container
        this._container = document.createElement("span");
        this._container.className = "m-2";
        this._container.style.display = "none";

        // spinner/icon container
        this._icon = document.createElement("span");
        this._icon.className = "me-1";
        this._icon.setAttribute("aria-hidden", "true");
        this._icon.style.display = "none";

        // status text (aria live)
        this._status = document.createElement("small");
        this._status.className = "";
        this._status.setAttribute("role", "status");
        this._status.setAttribute("aria-live", "polite");
        this._status.textContent = "";

        // assemble
        this._container.appendChild(this._icon);
        this._container.appendChild(this._status);
        this._element.appendChild(this._input);
        this._element.appendChild(this._container);

        // input listeners
        this._onInputListener = () => {
            this._currentValue = this._input.value;
            // schedule check (debounced if configured)
            this._scheduleCheck(false);
        };
        this._onBlurListener = () => {
            // force check on blur (ignores debounce)
            this._scheduleCheck(true);
        };

        this._input.addEventListener("input", this._onInputListener);
        this._input.addEventListener("blur", this._onBlurListener);
    }

    /**
     * Schedules a uniqueness check respecting the debounce configuration.
     * @param {boolean} force - When true, bypasses debounce and runs immediately.
     */
    _scheduleCheck(force = false) {
        // ignore if already destroyed
        if (this._destroyed) {
            return;
        }
        // run immediately if forced or no debounce configured
        if (force === true || this._debounceMs <= 0) {
            this._triggerImmediateCheck();
            return;
        }
        // clear pending timer before re-scheduling
        if (this._pendingTimer) {
            clearTimeout(this._pendingTimer);
            this._pendingTimer = null;
        }
        // schedule debounced check
        this._pendingTimer = setTimeout(() => {
            this._pendingTimer = null;
            this._triggerImmediateCheck();
        }, this._debounceMs);
    }

    /**
     * Parses a JSON string of headers into a plain object.
     * @param {string|null} headersJson - A JSON string representing headers.
     * @returns {Record<string, string>} A map of header names to values.
     */
    _parseHeaders(headersJson) {
        // return empty set if not provided
        if (!headersJson) {
            return {};
        }
        // attempt to parse a plain object of string-to-string pairs
        try {
            const obj = JSON.parse(headersJson);
            if (obj && typeof obj === "object" && !Array.isArray(obj)) {
                const out = {};
                for (const [k, v] of Object.entries(obj)) {
                    // only accept string keys with string values
                    if (typeof k === "string" && typeof v === "string") {
                        out[k] = v;
                    }
                }
                return out;
            }
        } catch (e) {
            // ignore invalid json
        }
        return {};
    }

    /**
     * Triggers an immediate uniqueness check (no debounce).
     * Skips checks for the initial value and when constraints are not satisfied.
     */
    _triggerImmediateCheck() {
        // stay idle when endpoint is not configured
        if (!this._url) {
            this._setState("idle", "");
            return;
        }

        // stay idle when minlength is not satisfied
        if (!this._currentValue || this._currentValue.length < this._minlength) {
            this._cancelInFlight("idle");
            return;
        }

        // skip check when value equals the initial value
        if (this._currentValue === this._initialValue) {
            this._cancelInFlight("idle");
            return;
        }

        // abort any in-flight request
        if (this._abortController) {
            this._abortController.abort();
            this._abortController = null;
        }

        // enter checking state
        this._setState("checking", this._messageChecking);

        // notify listeners that a request has been initiated
        this._dispatch(webexpress.webui.Event.DATA_REQUESTED_EVENT, {
            detail: { value: this._currentValue }
        });

        // perform async request
        this._checkUnique(this._currentValue);
    }

    /**
     * Cancels any in-flight request and updates the visual state.
     * @param {"idle"|"checking"|"available"|"unavailable"|"error"} state - The target state after cancellation.
     */
    _cancelInFlight(state) {
        // abort active request if present
        if (this._abortController) {
            this._abortController.abort();
            this._abortController = null;
        }
        // keep current message for non-idle states, clear for idle
        const msg = state === "idle" ? "" : (this._status ? this._status.textContent : "");
        this._setState(state, msg);
    }

    /**
     * Executes the remote uniqueness check and updates the UI based on the response.
     * @param {string} value - The value to be validated.
     */
    async _checkUnique(value) {
        // create dedicated abort controller for this request
        this._abortController = new AbortController();
        const controller = this._abortController;

        try {
            // prepare request options
            let reqUrl = this._url;
            const headers = { ...this._headers };
            const opts = {
                method: this._method,
                headers: headers,
                credentials: "same-origin",
                signal: controller.signal
            };

            if (this._method === "GET") {
                // append query parameter for get requests
                const urlObj = new URL(reqUrl, window.location.href);
                if (this._element.id) { 
                    urlObj.searchParams.set("id", this._element.id);
                } else if (this._element.id) {
                    urlObj.searchParams.set("name", this._fieldName);
                }
                urlObj.searchParams.set(this._param, value);
                reqUrl = urlObj.toString();
            } else {
                // ensure json body for non-get requests
                if (!headers["Content-Type"]) {
                    headers["Content-Type"] = "application/json";
                }
                opts.body = JSON.stringify({ [this._param]: value });
            }

            // perform request
            const response = await fetch(reqUrl, opts);

            // handle non-2xx responses as errors
            if (!response.ok) {
                if (value === this._currentValue) {
                    this._setState("error", this._messageError);
                    this._dispatch(webexpress.webui.Event.DATA_ARRIVED_EVENT, {
                        detail: { value, state: "error", status: response.status }
                    });
                }
                return;
            }

            // parse json response
            let data = null;
            try {
                data = await response.json();
            } catch (_parseErr) {
                if (value === this._currentValue) {
                    this._setState("error", this._messageError);
                    this._dispatch(webexpress.webui.Event.DATA_ARRIVED_EVENT, {
                        detail: { value, state: "error", reason: "parse" }
                    });
                }
                return;
            }

            // ignore stale responses that do not match current input
            if (value !== this._currentValue) {
                return;
            }

            // interpret response payload
            const availability = this._extractAvailability(data);

            if (availability === true) {
                this._setState("available", this._messageAvailable.replace("{value}", value));
                this._dispatch(webexpress.webui.Event.DATA_ARRIVED_EVENT, {
                    detail: { value, state: "available" }
                });
            } else if (availability === false) {
                this._setState("unavailable", this._messageUnavailable.replace("{value}", value));
                this._dispatch(webexpress.webui.Event.DATA_ARRIVED_EVENT, {
                    detail: { value, state: "unavailable" }
                });
            } else {
                this._setState("error", this._messageError);
                this._dispatch(webexpress.webui.Event.DATA_ARRIVED_EVENT, {
                    detail: { value, state: "error", reason: "invalid_response" }
                });
            }
        } catch (err) {
            // ignore abort errors
            if (err && err.name === "AbortError") {
                return;
            }
            // report other errors if still current
            if (value === this._currentValue) {
                this._setState("error", this._messageError);
                this._dispatch(webexpress.webui.Event.DATA_ARRIVED_EVENT, {
                    detail: { value, state: "error", reason: "exception" }
                });
            }
        } finally {
            // clear controller if it is still the active one
            if (this._abortController === controller) {
                this._abortController = null;
            }
        }
    }

    /**
     * Extracts the availability flag from the API response using configured rules and fallbacks.
     * @param {any} data - The parsed API response.
     * @returns {boolean|null} True if available, false if not, null if undecidable.
     */
    _extractAvailability(data) {
        // prefer configured field if present
        if (data && Object.prototype.hasOwnProperty.call(data, this._responseField)) {
            const raw = data[this._responseField];
            if (typeof raw === "boolean") {
                return raw;
            }
            if (typeof raw === "string") {
                const s = raw.trim().toLowerCase();
                if (s === "true") {
                    return true;
                }
                if (s === "false") {
                    return false;
                }
            }
            if (typeof raw === "number") {
                if (raw === 1) {
                    return true;
                }
                if (raw === 0) {
                    return false;
                }
            }
        }

        // heuristics for common shapes
        if (data && typeof data === "object") {
            if (typeof data.status === "string") {
                const st = data.status.toLowerCase();
                if (st === "free" || st === "available") {
                    return true;
                }
                if (st === "taken" || st === "unavailable" || st === "exists" || st === "in_use") {
                    return false;
                }
            }
            if (typeof data.code === "string") {
                const cd = data.code.toLowerCase();
                if (cd === "available") {
                    return true;
                }
                if (cd === "unavailable") {
                    return false;
                }
            }
        }

        return null;
    }

    /**
     * Updates the visual state (classes, messages, and spinner visibility).
     * @param {"idle"|"checking"|"available"|"unavailable"|"error"} state - The new visual state.
     * @param {string} message - The status message to display.
     */
    _setState(state, message) {
        // guard against early calls
        if (!this._input) {
            return;
        }

        // remove previous visual classes
        this._input.classList.remove(this._cssAvailable, this._cssUnavailable, this._cssChecking);

        // update status text
        if (this._status) {
            this._status.className = "";
            this._status.textContent = message || "";
        }

        // show or hide the container depending on state
        const showContainer = state !== "idle";
        this._container.style.display = showContainer ? "inline-block" : "none";

        // lazily create spinner once when needed
        if (!this._iconI) {
            this._iconI = document.createElement("i");
            this._iconI.className = "spinner-border spinner-border-sm text-muted";
            this._iconI.setAttribute("role", "status");
            this._iconI.setAttribute("aria-hidden", "true");
            this._icon.appendChild(this._iconI);
        }

        // apply state-specific visuals
        if (state === "checking") {
            this._input.classList.add(this._cssChecking);
            this._icon.style.display = "inline-block";
        } else if (state === "available") {
            this._input.classList.add(this._cssAvailable);
            this._status.className = "text-success";
            this._icon.style.display = "none";
        } else if (state === "unavailable") {
            this._input.classList.add(this._cssUnavailable);
            this._status.className = "text-danger";
            this._icon.style.display = "none";
        } else if (state === "error") {
            this._status.className = "text-danger";
            this._icon.style.display = "inline-block";
        } else {
            // idle
            this._icon.style.display = "none";
        }

        // reflect state on host element
        this._element.setAttribute("data-state", state);
    }

    /**
     * Gets the current visible input value.
     * @returns {string} The current input value.
     */
    get value() {
        return this._input ? this._input.value : "";
    }

    /**
     * Sets a new value and triggers a check if distinct from the initial value.
     * @param {string} v - The new value to set.
     */
    set value(v) {
        if (!this._input) {
            return;
        }
        const newVal = typeof v === "string" ? v : "";

        // if unchanged → do nothing
        if (newVal === this._currentValue) {
            return;
        }

        if (!this._initialValue) {
            this._initialValue = newVal;
        }
        
        this._input.value = newVal;
        this._currentValue = newVal;

        if (this._currentValue !== this._initialValue) {
            // force scheduling to respect debounce logic
            this._scheduleCheck(true);
        }
    }

    /**
     * Resets the control back to the initial value without triggering a check.
     */
    resetToInitial() {
        if (!this._input) {
            return;
        }
        // restore initial value
        this._input.value = this._initialValue;
        this._currentValue = this._initialValue;

        // cancel pending timers and requests
        if (this._pendingTimer) {
            clearTimeout(this._pendingTimer);
            this._pendingTimer = null;
        }
        if (this._abortController) {
            this._abortController.abort();
            this._abortController = null;
        }

        // return to idle state
        this._setState("idle", "");
    }

    /**
     * Destroys the control by removing listeners and aborting in-flight requests.
     */
    destroy() {
        if (this._destroyed) {
            return;
        }
        this._destroyed = true;

        // cancel timers and requests
        if (this._pendingTimer) {
            clearTimeout(this._pendingTimer);
            this._pendingTimer = null;
        }
        if (this._abortController) {
            this._abortController.abort();
            this._abortController = null;
        }

        // detach listeners
        if (this._input) {
            this._input.removeEventListener("input", this._onInputListener);
            this._input.removeEventListener("blur", this._onBlurListener);
        }

        // set to idle for consistency
        this._setState("idle", "");
    }
};

// controller registration
webexpress.webui.Controller.registerClass("wx-webapp-input-unique", webexpress.webapp.InputUniqueCtrl);