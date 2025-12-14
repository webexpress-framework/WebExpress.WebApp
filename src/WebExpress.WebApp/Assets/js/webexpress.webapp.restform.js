/**
 * REST form controller
 *
 * Replaces a traditional form POST with a JSON REST request, performs client-side validation,
 * shows field markers (vertical bar left of control) inside a flex container and aggregates messages
 * in the form error area. Provides hooks and events for success / error states and supports loading
 * initial data.
 *
 * Dispatched Events:
 * - webexpress.webui.Event.DATA_REQUESTED_EVENT
 * - webexpress.webui.Event.TASK_START_EVENT
 * - webexpress.webui.Event.TASK_FINISH_EVENT
 * - webexpress.webui.Event.DATA_ARRIVED_EVENT
 * - webexpress.webui.Event.CHANGE_VALUE_EVENT
 * - webexpress.webui.Event.UPLOAD_SUCCESS_EVENT
 * - webexpress.webui.Event.UPLOAD_ERROR_EVENT
 */
webexpress.webapp.RestFormCtrl = class extends webexpress.webui.Ctrl {
    /**
     * Create a new RestFormCtrl instance.
     * configuration is read strictly from data-attributes on the form element.
     * attributes are removed from the dom after initialization.
     * @param {HTMLFormElement} element The form element to enhance.
     */
    constructor(element) {
        super(element);

        if (!(element instanceof HTMLFormElement)) {
            throw new TypeError(this._i18n("webexpress.webapp:error.no_endpoint"));
        }

        // read configuration from data attributes
        const ds = this._element.dataset;

        // helper to parse boolean from dataset string
        const parseBool = (val, defaultVal) => {
            if (val === "true") {
                return true;
            }
            if (val === "false") {
                return false;
            }
            return defaultVal;
        };

        this.options = {
            id: ds.id || null,
            api: ds.uri || ds.url || ds.api || null,
            method: (ds.method || this._element.method || "POST").toUpperCase(),
            headers: {},
            json: parseBool(ds.json, true),
            validateOnSubmit: parseBool(ds.validateOnSubmit, true),
            showInlineErrors: parseBool(ds.showInlineErrors, true),
            // hooks cannot be passed via data attributes, initialized as null
            beforeSend: null,
            onSuccess: null,
            onError: null,
            onLoadSuccess: null
        };

        // explicit mode via data-mode can override auto-detection
        if (ds.mode) {
            this.mode = ds.mode.toLowerCase() === "edit" ? "edit" : "new";
        } else {
            this.mode = this.options.id ? "edit" : "new";
        }

        // remove used data attributes
        this._element.removeAttribute("data-api");
        this._element.removeAttribute("data-method");
        this._element.removeAttribute("data-json");
        this._element.removeAttribute("data-validate-on-submit");
        this._element.removeAttribute("data-show-inline-errors");
        this._element.removeAttribute("data-mode");

        // set content-type for json if not present
        if (this.options.json) {
            if (!Object.keys(this.options.headers).some((k) => { return k.toLowerCase() === "content-type"; })) {
                this.options.headers["Content-Type"] = "application/json; charset=utf-8";
            }
        }

        // internal state
        this._submitting = false;
        this._loading = false;
        // map field element -> { marker, wrapper, message }
        this._fieldErrorMap = new Map();

        // bind handlers
        this._onSubmitBound = this._onSubmit.bind(this);

        // init ui
        this._init();
    }

    /**
     * Initialize control: attach event listeners and trigger data loading if configured.
     */
    _init() {
        // attach submit listener in capture phase to intercept submit before other handlers
        this._element.addEventListener("submit", this._onSubmitBound, true);

        // create container for global form errors
        this._ensureFormErrorContainer();

        // auto-load data if endpoint is configured and mode is edit
        if (this.options.api && this.mode === "edit") {
            this.load();
        }
    }

    /**
     * Ensure a container element exists for non-field form errors.
     * creates an element .restform-error-container and places it in the form header when possible.
     */
    _ensureFormErrorContainer() {
        let cont = this._element.querySelector(".restform-error-container");
        if (!cont) {
            cont = document.createElement("div");
            cont.className = "restform-error-container";
        }

        const headerEl = this._element.querySelector(".modal-body");
        if (headerEl) {
            if (cont.parentNode !== headerEl) {
                if (cont.parentNode) {
                    cont.parentNode.removeChild(cont);
                }
                headerEl.insertBefore(cont, headerEl.firstChild);
            }
        } else {
            if (cont.parentNode !== this._element) {
                if (cont.parentNode) {
                    cont.parentNode.removeChild(cont);
                }
                if (this._element.firstChild) {
                    this._element.insertBefore(cont, this._element.firstChild);
                } else {
                    this._element.appendChild(cont);
                }
            }
        }

        this._formErrorContainer = cont;
    }

    /**
     * Load data from configured endpoint and populate the form.
     * @returns {Promise<void>}
     */
    async load() {
        if (this._loading || !this.options.api) {
            return;
        }

        this._loading = true;
        this._setSubmitting(true);

        this._dispatch(webexpress.webui.Event.DATA_REQUESTED_EVENT, { type: "load", url: this.options.api });
        this._dispatch(webexpress.webui.Event.TASK_START_EVENT, { name: "loading" });

        try {
            let url = this.options.api;
            if (this.options.id) {
                url = url + (url.includes("?") ? "&" : "?") + "id=" + encodeURIComponent(String(this.options.id));
            }

            const resp = await fetch(url, {
                method: "GET",
                headers: { "Accept": "application/json" },
                credentials: this.options.credentials || "same-origin"
            });

            if (resp.ok) {
                const data = await resp.json();
                this._populate(data);

                if (typeof this.options.onLoadSuccess === "function") {
                    try {
                        this.options.onLoadSuccess(data, resp);
                    } catch (e) {
                        // swallow hook errors
                    }
                }

                this._dispatch(webexpress.webui.Event.DATA_ARRIVED_EVENT, { data: data, status: resp.status });
                this._dispatch(webexpress.webui.Event.CHANGE_VALUE_EVENT, { source: "load", data: data });
            } else {
                const msg = this._i18n("webexpress.webapp:error.load_failed", { status: resp.status });
                throw new Error(msg);
            }
        } catch (error) {
            this._dispatchError(error);
        } finally {
            this._loading = false;
            this._setSubmitting(false);
            this._dispatch(webexpress.webui.Event.TASK_FINISH_EVENT, { name: "loading" });
        }
    }

    /**
     * Populate form fields with data object.
     * keys in data object must match name attributes of fields.
     * @param {Object} data Key-value pairs to set.
     */
    _populate(data) {
        if (!data || typeof data !== "object") {
            return;
        }

        for (const [name, value] of Object.entries(data)) {
            const fieldOrList = this._element.elements.namedItem(name);
            if (!fieldOrList) {
                continue;
            }

            if (fieldOrList instanceof RadioNodeList) {
                const first = fieldOrList[0];
                if (first.type === "radio") {
                    fieldOrList.value = String(value);
                } else if (first.type === "checkbox") {
                    const values = Array.isArray(value) ? value.map(String) : [String(value)];
                    for (let i = 0; i < fieldOrList.length; i++) {
                        const el = fieldOrList[i];
                        el.checked = values.includes(el.value);
                    }
                }
            } else if (fieldOrList instanceof HTMLElement) {
                const ctrl = webexpress.webui.Controller.getInstanceByElement(fieldOrList);
                if (ctrl) {
                    if (typeof ctrl.value !== "undefined") {
                        ctrl.value = value;
                    }
                    continue;
                }

                const el = fieldOrList;
                if (el.type === "checkbox") {
                    el.checked = !!value;
                } else if (el instanceof HTMLSelectElement && el.multiple) {
                    const values = Array.isArray(value) ? value.map(String) : [String(value)];
                    for (const opt of Array.from(el.options)) {
                        opt.selected = values.includes(opt.value);
                    }
                } else if (el.type === "file") {
                    continue;
                } else {
                    el.value = value === null || value === undefined ? "" : String(value);
                }
            }
        }
    }

    /**
     * Submit event handler: validate and send.
     * @param {Event} ev submit event
     */
    _onSubmit(ev) {
        ev.preventDefault();
        ev.stopImmediatePropagation();

        if (this._submitting) {
            return;
        }

        if (this.options.validateOnSubmit) {
            const valid = this.validate();
            if (!valid) {
                const firstInvalid = this._element.querySelector("[aria-invalid='true']");
                if (firstInvalid && typeof firstInvalid.focus === "function") {
                    firstInvalid.focus();
                }
                return;
            }
        }

        this.submit();
    }

    /**
     * Validate the form using HTML5 validity and additional rules.
     * markers are shown as a vertical bar left of the control; messages are aggregated.
     * @returns {boolean}
     */
    validate() {
        this.clearErrors();

        let formIsValid = true;
        const messages = [];
        const elements = Array.from(this._element.elements).filter((el) => {
            return el.name && !el.disabled && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement);
        });

        for (const el of elements) {
            if (!el.validity.valid) {
                formIsValid = false;
                const msg = el.validationMessage || this._i18n("webexpress.webapp:validation.invalid");
                this._showFieldError(el, msg);
                messages.push(msg);
                continue;
            }

            if (el.type === "email" && el.value) {
                const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!re.test(el.value)) {
                    formIsValid = false;
                    const msg = this._i18n("webexpress.webapp:validation.email.invalid");
                    this._showFieldError(el, msg);
                    messages.push(msg);
                    continue;
                }
            }

            if (el.getAttribute && el.getAttribute("pattern")) {
                const pattern = el.getAttribute("pattern");
                let rx = null;
                try {
                    rx = new RegExp(`^(?:${pattern})$`);
                } catch (e) {
                    rx = null;
                }
                if (rx && el.value && !rx.test(el.value)) {
                    formIsValid = false;
                    const msg = el.getAttribute("data-error-message") || this._i18n("webexpress.webapp:validation.format.invalid");
                    this._showFieldError(el, msg);
                    messages.push(msg);
                    continue;
                }
            }

            if (el.type === "number" && el.value) {
                const v = parseFloat(el.value);
                const min = el.getAttribute("min");
                const max = el.getAttribute("max");
                if (min != null && min !== "" && v < parseFloat(min)) {
                    formIsValid = false;
                    const tpl = this._i18n("webexpress.webapp:validation.number.range");
                    const msg = this._applyParams(tpl, { min: min, max: max });
                    this._showFieldError(el, msg);
                    messages.push(msg);
                    continue;
                }
            }

            const minlength = el.getAttribute("minlength");
            const maxlength = el.getAttribute("maxlength");
            if (minlength && el.value.length < parseInt(minlength, 10)) {
                formIsValid = false;
                const tpl = this._i18n("webexpress.webapp:validation.minlength");
                const msg = this._applyParams(tpl, { minlength: minlength });
                this._showFieldError(el, msg);
                messages.push(msg);
                continue;
            }
            if (maxlength && el.value.length > parseInt(maxlength, 10)) {
                formIsValid = false;
                const tpl = this._i18n("webexpress.webapp:validation.maxlength");
                const msg = this._applyParams(tpl, { maxlength: maxlength });
                this._showFieldError(el, msg);
                messages.push(msg);
                continue;
            }
        }

        if (!formIsValid) {
            this._displayAggregatedErrors(messages);
        }

        return formIsValid;
    }

    /**
     * Build payload from form fields.
     * @returns {Object}
     */
    _buildPayload() {
        const data = {};
        const elements = Array.from(this._element.elements).filter((el) => {
            return el.name && !el.disabled && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement);
        });

        for (const el of elements) {
            const name = el.name;

            const ctrl = webexpress.webui.Controller.getInstanceByElement(el);
            if (ctrl && typeof ctrl.value !== "undefined") {
                data[name] = ctrl.value;
                continue;
            }

            if (el.type === "checkbox") {
                if (!Object.prototype.hasOwnProperty.call(data, name)) {
                    data[name] = el.checked ? el.value || true : false;
                } else {
                    if (!Array.isArray(data[name])) {
                        data[name] = [data[name]];
                    }
                    if (el.checked) {
                        data[name].push(el.value || true);
                    }
                }
                continue;
            }
            if (el.type === "radio") {
                if (el.checked) {
                    data[name] = el.value;
                }
                continue;
            }

            if (el instanceof HTMLSelectElement && el.multiple) {
                const vals = Array.from(el.options).filter((o) => { return o.selected; }).map((o) => { return o.value; });
                data[name] = vals;
                continue;
            }

            if (el.type === "file") {
                continue;
            }

            data[name] = el.value;
        }

        return data;
    }

    /**
     * Submit the form payload to the configured REST API.
     * @returns {Promise<void>}
     */
    async submit() {
        if (this._submitting) {
            return;
        }

        const endpoint = this.options.api || this._element.action;
        if (!endpoint) {
            throw new Error(this._i18n("webexpress.webapp:error.no_endpoint"));
        }

        let payload = this._buildPayload();

        if (typeof this.options.beforeSend === "function") {
            try {
                const res = this.options.beforeSend(payload, this._element);
                if (res === false) {
                    return;
                }
                if (res && typeof res === "object") {
                    payload = res;
                }
            } catch (e) {
                this._dispatchError(e);
                return;
            }
        }

        let method = (this.mode === "edit") ? "PUT" : "POST";

        const init = {
            method: method,
            headers: Object.assign({}, this.options.headers || {}),
            credentials: this.options.credentials || "same-origin"
        };

        let requestUrl = endpoint;

        if (method === "GET" || method === "HEAD") {
            try {
                const urlObj = new URL(endpoint, window.location.origin);
                for (const k of Object.keys(payload)) {
                    const v = payload[k];
                    if (Array.isArray(v)) {
                        for (const vv of v) {
                            urlObj.searchParams.append(k, vv == null ? "" : String(vv));
                        }
                    } else {
                        urlObj.searchParams.append(k, v == null ? "" : String(v));
                    }
                }
                requestUrl = urlObj.toString();
            } catch (e) {
                const params = new URLSearchParams();
                for (const k of Object.keys(payload)) {
                    const v = payload[k];
                    if (Array.isArray(v)) {
                        for (const vv of v) {
                            params.append(k, vv == null ? "" : String(vv));
                        }
                    } else {
                        params.append(k, v == null ? "" : String(v));
                    }
                }
                requestUrl = endpoint + (endpoint.includes("?") ? "&" : "?") + params.toString();
            }
            if (init.headers) {
                for (const h of Object.keys(init.headers)) {
                    if (h.toLowerCase() === "content-type") {
                        delete init.headers[h];
                    }
                }
            }
        } else if (method === "DELETE") {
            const idParam = this.options.id || payload.id || payload.Id || null;
            if (idParam) {
                try {
                    const urlObj = new URL(endpoint, window.location.origin);
                    urlObj.searchParams.append("id", String(idParam));
                    requestUrl = urlObj.toString();
                } catch (e) {
                    requestUrl = endpoint + (endpoint.includes("?") ? "&" : "?") + "id=" + encodeURIComponent(String(idParam));
                }
            }
            if (init.headers) {
                for (const h of Object.keys(init.headers)) {
                    if (h.toLowerCase() === "content-type") {
                        delete init.headers[h];
                    }
                }
            }
        } else {
            if (this.options.json) {
                init.body = JSON.stringify(payload);
                if (!Object.keys(init.headers).some((k) => { return k.toLowerCase() === "content-type"; })) {
                    init.headers["Content-Type"] = "application/json; charset=utf-8";
                }
            } else {
                const params = new URLSearchParams();
                for (const k of Object.keys(payload)) {
                    const v = payload[k];
                    if (Array.isArray(v)) {
                        for (const vv of v) {
                            params.append(k, vv == null ? "" : String(vv));
                        }
                    } else {
                        params.append(k, v == null ? "" : String(v));
                    }
                }
                init.body = params.toString();
                if (!Object.keys(init.headers).some((k) => { return k.toLowerCase() === "content-type"; })) {
                    init.headers["Content-Type"] = "application/x-www-form-urlencoded; charset=utf-8";
                }
            }

            if ((method === "PUT" || method === "PATCH") && this.mode === "edit" && this.options.id) {
                try {
                    const urlObj = new URL(endpoint, window.location.origin);
                    if (!urlObj.searchParams.has("id")) {
                        urlObj.searchParams.append("id", String(this.options.id));
                    }
                    requestUrl = urlObj.toString();
                } catch (e) {
                    requestUrl = endpoint + (endpoint.includes("?") ? "&" : "?") + "id=" + encodeURIComponent(String(this.options.id));
                }
            }
        }

        this._setSubmitting(true);
        this._dispatch(webexpress.webui.Event.TASK_START_EVENT, { name: "submitting" });
        this._dispatch(webexpress.webui.Event.DATA_REQUESTED_EVENT, { type: "submit", url: requestUrl });

        try {
            const resp = await fetch(requestUrl, init);

            let json = null;
            const contentType = resp.headers.get("content-type") || "";
            if (contentType.indexOf("application/json") !== -1) {
                try {
                    json = await resp.json();
                } catch (e) {
                    json = null;
                }
            } else {
                try {
                    const txt = await resp.text();
                    json = { text: txt };
                } catch (e) {
                    json = null;
                }
            }

            if (resp.ok) {
                this.clearErrors();
                if (typeof this.options.onSuccess === "function") {
                    try {
                        this.options.onSuccess(json, resp);
                    } catch (e) {
                        // swallow hook errors
                    }
                }
                this._dispatch(webexpress.webui.Event.UPLOAD_SUCCESS_EVENT, { response: json, status: resp.status, form: this._element });
                this._dispatch(webexpress.webui.Event.DATA_ARRIVED_EVENT, { type: "submit", data: json });
            } else if (resp.status === 400) {
                if (Array.isArray(json)) {
                    this._applyServerArrayErrors(json);
                } else if (json && typeof json === "object" && json.errors) {
                    this._applyServerFieldErrors(json.errors);
                } else if (json && typeof json === "object") {
                    const singleMsg = json.message || json.error || JSON.stringify(json);
                    this._displayAggregatedErrors([singleMsg]);
                } else {
                    this._displayAggregatedErrors([this._i18n("webexpress.webapp:validation.failed")]);
                }

                if (typeof this.options.onError === "function") {
                    try {
                        this.options.onError(json, resp);
                    } catch (e) {
                        // swallow
                    }
                }
                this._dispatch(webexpress.webui.Event.UPLOAD_ERROR_EVENT, { type: "validation", response: json, status: resp.status, form: this._element });
            } else {
                const errMsg = this._i18n("webexpress.webapp:error.request_failed", { status: resp.status });
                const err = new Error(errMsg);
                err.response = resp;
                err.payload = json;
                if (typeof this.options.onError === "function") {
                    try {
                        this.options.onError(err);
                    } catch (e) {
                        // swallow
                    }
                }
                this._dispatchError(err);
            }
        } catch (error) {
            if (typeof this.options.onError === "function") {
                try {
                    this.options.onError(error);
                } catch (e) {
                    // swallow
                }
            }
            this._dispatchError(error);
        } finally {
            this._setSubmitting(false);
            this._dispatch(webexpress.webui.Event.TASK_FINISH_EVENT, { name: "submitting" });
        }
    }

    /**
     * Set form submitting state: disable controls and mark class.
     * @param {boolean} state
     */
    _setSubmitting(state) {
        this._submitting = !!state;
        const elements = Array.from(this._element.elements);
        for (const el of elements) {
            if (state) {
                el.setAttribute("disabled", "disabled");
            } else {
                el.removeAttribute("disabled");
            }
        }
        if (state) {
            this._element.classList.add("restform-submitting");
        } else {
            this._element.classList.remove("restform-submitting");
        }
    }

    /**
     * Apply server-side field errors (errors map).
     * messages are aggregated; matching fields receive a marker.
     * @param {Object} errors map of fieldName -> message
     */
    _applyServerFieldErrors(errors) {
        this.clearErrors();
        if (!errors || typeof errors !== "object") {
            return;
        }
        const messages = [];
        for (const name of Object.keys(errors)) {
            const msg = errors[name];
            const field = this._findFieldByName(name);
            if (field) {
                this._showFieldError(field, msg);
            }
            messages.push(msg);
        }
        this._displayAggregatedErrors(messages);
    }

    /**
     * Apply server validation errors represented as an array.
     * expected: [{ code, message, field }, ...]
     * @param {Array} errorsArray
     */
    _applyServerArrayErrors(errorsArray) {
        this.clearErrors();
        if (!Array.isArray(errorsArray)) {
            return;
        }
        const messages = [];
        for (const err of errorsArray) {
            if (!err) {
                continue;
            }
            const msg = err.message || err.msg || err.Message || JSON.stringify(err);
            const fieldRaw = err.field || err.Field || null;
            let matched = false;
            if (fieldRaw) {
                const fieldEl = this._findFieldByName(fieldRaw);
                if (fieldEl) {
                    this._showFieldError(fieldEl, msg);
                    matched = true;
                }
            }
            messages.push(msg);
            if (!matched) {
                // fallback: aggregated display only
            }
        }
        this._displayAggregatedErrors(messages);
    }

    /**
     * Find field by name or id with case-insensitive matching and simple normalizations.
     * @param {string} raw field name from server
     * @returns {HTMLElement|null}
     */
    _findFieldByName(raw) {
        if (!raw) {
            return null;
        }
        try {
            // exact name
            let el = this._element.querySelector(`[name="${CSS.escape(raw)}"]`);
            if (el) {
                return el;
            }
            const target = String(raw).toLowerCase();
            const candidates = Array.from(this._element.querySelectorAll("[name]")).filter((e) => {
                return (e.getAttribute("name") || "").toLowerCase() === target;
            });
            if (candidates.length > 0) {
                return candidates[0];
            }
            // id match
            const idEl = this._element.querySelector(`#${CSS.escape(raw)}`);
            if (idEl) {
                return idEl;
            }
            // lowercase-first-letter
            const alt = String(raw).replace(/^\w/, (c) => { return c.toLowerCase(); });
            const altEl = this._element.querySelector(`[name="${CSS.escape(alt)}"]`);
            if (altEl) {
                return altEl;
            }
            // strip brackets and compare
            const normalized = String(raw).replace(/\[(.*?)\]/g, "$1");
            const normTarget = normalized.toLowerCase();
            const normCandidates = Array.from(this._element.querySelectorAll("[name]")).filter((e) => {
                return (e.getAttribute("name") || "").toLowerCase() === normTarget;
            });
            if (normCandidates.length > 0) {
                return normCandidates[0];
            }
        } catch (e) {
            // ignore selector errors
        }
        return null;
    }

    /**
     * Show a field marker (vertical bar left of element) inside a flex wrapper and store it for clearing later.
     * does not create per-field helper text; messages shown aggregated.
     * @param {HTMLElement} field
     * @param {string} message
     */
    _showFieldError(field, message) {
        if (!field || !(field instanceof HTMLElement)) {
            return;
        }
        // avoid duplicate marker
        if (this._fieldErrorMap.has(field)) {
            // update stored message
            const info = this._fieldErrorMap.get(field);
            info.message = message;
            return;
        }

        // create marker element
        const marker = document.createElement("div");
        marker.className = "restform-field-marker";

        // create wrapper flex container so marker and field sit in one flex row
        const wrapper = document.createElement("div");
        wrapper.className = "restform-field-wrapper";

        // mark accessibility state
        field.setAttribute("aria-invalid", "true");

        // insert wrapper at the field position and move field into it, then prepend marker
        const parent = field.parentNode;
        if (parent) {
            // insert wrapper before field
            parent.insertBefore(wrapper, field);
            // move field into wrapper
            wrapper.appendChild(marker);
            wrapper.appendChild(field);
            // remember wrapper and marker for clearing later
            this._fieldErrorMap.set(field, { marker: marker, wrapper: wrapper, message: message });
        } else {
            // fallback: add border-left if parent absent
            field.style.boxSizing = "border-box";
            field.style.borderLeft = "4px solid #dc3545";
            this._fieldErrorMap.set(field, { marker: null, wrapper: null, message: message });
        }
    }

    /**
     * Display aggregated messages in the form-level error container with intro text.
     * @param {Array<string>} messages
     */
    _displayAggregatedErrors(messages) {
        if (!Array.isArray(messages) || messages.length === 0) {
            return;
        }
        if (!this._formErrorContainer) {
            this._ensureFormErrorContainer();
        }
        let el = this._formErrorContainer.querySelector(".restform-error");
        if (!el) {
            el = document.createElement("div");
            el.className = "restform-error alert alert-danger";
            this._formErrorContainer.appendChild(el);
        }
        const unique = Array.from(new Set(messages.filter((m) => { return m; })));
        const intro = this._i18n("webexpress.webapp:form.validation.errors");
        let html = "<p>" + this._escapeHtml(String(intro)) + "</p>";
        html += "<ul>";
        for (const m of unique) {
            html += "<li>" + this._escapeHtml(String(m)) + "</li>";
        }
        html += "</ul>";
        el.innerHTML = html;
    }

    /**
     * Programmatically set a field error (marker + aggregated message).
     * @param {string} fieldName
     * @param {string} message
     */
    setFieldError(fieldName, message) {
        const field = this._element.querySelector(`[name="${CSS.escape(fieldName)}"]`);
        if (field) {
            this._showFieldError(field, message);
            this._displayAggregatedErrors([message]);
        } else {
            this._displayAggregatedErrors([message]);
        }
    }

    /**
     * Clear all markers, unwrap fields and remove form-level messages.
     */
    clearErrors() {
        for (const [field, info] of Array.from(this._fieldErrorMap.entries())) {
            if (field) {
                field.removeAttribute("aria-invalid");
            }
            if (info) {
                // if wrapper exists, unwrap field and remove wrapper
                if (info.wrapper && info.wrapper.parentNode) {
                    try {
                        // move field back to wrapper.parent before wrapper and remove wrapper
                        const wrapperParent = info.wrapper.parentNode;
                        wrapperParent.insertBefore(field, info.wrapper);
                        wrapperParent.removeChild(info.wrapper);
                    } catch (e) {
                        // ignore unwrap errors
                    }
                } else if (info.marker && info.marker.parentNode) {
                    // fallback: remove marker only
                    try {
                        info.marker.parentNode.removeChild(info.marker);
                    } catch (e) {
                        // ignore
                    }
                } else if (field) {
                    // fallback cleanup for border style
                    try {
                        field.style.borderLeft = "";
                    } catch (e) {
                        // ignore
                    }
                }
            }
            this._fieldErrorMap.delete(field);
        }
        if (this._formErrorContainer) {
            const el = this._formErrorContainer.querySelector(".restform-error");
            if (el && el.parentNode) {
                el.parentNode.removeChild(el);
            }
        }
    }

    /**
     * Dispatch a custom DOM event from the form root.
     * @param {string} name
     * @param {Object} detail
     */
    _dispatch(name, detail) {
        const ev = new CustomEvent(name, { detail: detail || {}, bubbles: true, cancelable: false });
        this._element.dispatchEvent(ev);
    }

    /**
     * Dispatch an error event and show a generic message in the form area.
     * @param {Error} error
     */
    _dispatchError(error) {
        try {
            const msg = (error && error.message) ? error.message : this._i18n("webexpress.webapp:error.generic");
            this._displayAggregatedErrors([msg]);
        } catch (e) {
            // ignore ui errors
        }
        this._dispatch(webexpress.webui.Event.UPLOAD_ERROR_EVENT, { error: error, form: this._element });
    }

    /**
     * Programmatically clear errors.
     */
    clear() {
        this.clearErrors();
    }

    /**
     * Dispose the control and remove listeners.
     */
    dispose() {
        try {
            this._element.removeEventListener("submit", this._onSubmitBound, true);
        } catch (e) {
            // ignore
        }
    }

    /**
     * Escape string for safe insertion into innerHTML.
     * @param {string} str
     * @returns {string}
     */
    _escapeHtml(str) {
        return str.replace(/[&<>"']/g, function (m) {
            switch (m) {
                case "&": return "&amp;";
                case "<": return "&lt;";
                case ">": return "&gt;";
                case "\"": return "&quot;";
                case "'": return "&#39;";
                default: return m;
            }
        });
    }
};

// register control class
webexpress.webui.Controller.registerClass("wx-webapp-restform", webexpress.webapp.RestFormCtrl);