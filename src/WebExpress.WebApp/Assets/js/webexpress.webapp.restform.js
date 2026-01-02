/**
 * REST form controller. Replaces a traditional form POST with a JSON REST request, performs 
 * client-side validation.
 *
 * The following events are triggered:
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
            const m = ds.mode.toLowerCase();
            const allowed = new Set(["new", "edit", "delete"]);
            this.mode = allowed.has(m) ? m : "new";
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

        // confirmation html (extracted from <confirm> element inside form)
        this._confirmHtml = null;
        this._confirmContainer = null;
        this._confirmTimer = null;

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

        // init confirm element if provided inside the form
        this._initConfirm();
        
        // create container for form prolog and confirm message 
        this._ensureFormPrologContainer();
        this._ensureFormConfirmContainer();

        // create container for form errors
        this._ensureFormErrorContainer();

        const headerEl = this._element.querySelector(".modal-body");
        const main = headerEl.querySelector("main");
        if (this.mode == "delete") {
            main.style.display = "none";
        } else {
            main.style.display = "block";
        }

        this.load();
    }

    /**
     * If a <confirm> element is present inside the form its innerHTML will be used as the default success message.
     */
    _initConfirm() {
        // find a <confirm> element inside the form
        const el = this._element.querySelector("confirm");
        if (el) {
            // extract html and remove the original element from dom
            this._confirmHtml = String(el.innerHTML);
            this._element.removeChild(el);
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
     * Ensures that a container element for the prolog (HTML block above the form fields)
     * exists inside the form. The prolog is typically inserted directly after the
     * form error container, or at the beginning of the form if the error container does not exist.
     * This method assigns the container to this._formPrologContainer.
     */
    _ensureFormPrologContainer() {
        let prologCont = this._element.querySelector(".restform-prolog-container");
        if (!prologCont) {
            prologCont = document.createElement("div");
            prologCont.className = "restform-prolog-container";
            prologCont.style.display = "none";
        }
        const headerEl = this._element.querySelector(".modal-body");
        if (headerEl) {
            if (prologCont.parentNode !== headerEl) {
                if (prologCont.parentNode) {
                    prologCont.parentNode.removeChild(cont);
                }
                headerEl.insertBefore(prologCont, headerEl.firstChild);
            }
        } else {
            if (prologCont.parentNode !== this._element) {
                if (prologCont.parentNode) {
                    prologCont.parentNode.removeChild(cont);
                }
                if (this._element.firstChild) {
                    this._element.insertBefore(prologCont, this._element.firstChild);
                } else {
                    this._element.appendChild(prologCont);
                }
            }
        }
        this._formPrologContainer = prologCont;
    }
    
    /**
     * Initialize confirmation element.
     */
    _ensureFormConfirmContainer() {
        // create a hidden container for showing confirmations
        this._confirmContainer = document.createElement("div");
        this._confirmContainer.className = "restform-confirm alert alert-success";
        this._confirmContainer.style.display = "none";

        const headerEl = this._element.querySelector(".modal-body");
        if (headerEl) {
            if (this._confirmContainer.parentNode !== headerEl) {
                if (this._confirmContainer.parentNode) {
                    this._confirmContainer.parentNode.removeChild(cont);
                }
                headerEl.insertBefore(this._confirmContainer, headerEl.firstChild);
            }
        } else {
            if (this._confirmContainer.parentNode !== this._element) {
                if (this._confirmContainer.parentNode) {
                    this._confirmContainer.parentNode.removeChild(this._confirmContainer);
                }
                if (this._element.firstChild) {
                    this._element.insertBefore(this._confirmContainer, this._element.firstChild);
                } else {
                    this._element.appendChild(this._confirmContainer);
                }
            }
        }
    }

    /**
     * Displays the confirmation message inside the form.
     * If a custom message is provided, it overrides the stored confirmation HTML.
     * Any existing hide‑timer is cleared before showing the confirmation container.
     *
     * @param {string|null} message Optional override message. If omitted, the stored confirmation HTML is used.
     * @returns {void} This method updates the confirmation container in place.
     */
    _showConfirm(message) {
        // determine message html
        const html = (typeof message === "string" && message) ? message : this._confirmHtml;
        if (!html || !this._confirmContainer) {
            return;
        }

        // clear existing timer if any
        if (this._confirmTimer !== null) {
            window.clearTimeout(this._confirmTimer);
            this._confirmTimer = null;
        }

        // set html and display container
        this._confirmContainer.innerHTML = String(html);
        this._confirmContainer.style.display = "block";
    }

    /**
     * Closes the modal that contains this form, if any.
     * Detects the nearest ancestor with the `modal` class and attempts to
     * close it using the Bootstrap Modal API.
     */
    _closeEnclosingModal() {
        if (!this._element) {
            return;
        }

        // find modal element (closest ancestor with class 'modal')
        var modal = (this._element.classList && this._element.classList.contains("modal")) 
            ? this._element : (this._element.closest ? this._element.closest(".modal") : null);
        if (!modal) {
            return;
        }

        // try bootstrap API
        try {
            if (window.bootstrap && typeof window.bootstrap.Modal === "function") {
                var inst = null;
                if (typeof window.bootstrap.Modal.getInstance === "function") {
                    inst = window.bootstrap.Modal.getInstance(modal);
                }
                if (!inst) {
                    inst = new window.bootstrap.Modal(modal);
                }
                if (inst && typeof inst.hide === "function") {
                    inst.hide();
                    return;
                }
            }
        } catch (e) {
        }
    }

    /**
     * Displays a prolog HTML string inside the form, above the input fields.
     * If prologHtml is falsy, the container is hidden or cleared.
     * The content is inserted as HTML and is expected to be trusted (provided by the server).
     * 
     * @param {string|null} prologHtml The HTML string to display as prolog or null/empty for no display.
     */
    _displayProlog(prologHtml) {
        this._formPrologContainer.innerHTML = prologHtml ? String(prologHtml) : "";
        if (prologHtml) {
            this._formPrologContainer.style.display = "";
        } else {
            this._formPrologContainer.style.display = "none";
        }
    }

    /**
     * Loads form data and the prolog string from the backend API depending on the current mode.
     * For mode "edit", loads and populates the form and optionally a prolog message.
     * For mode "new", loads possible default values for the form and optionally a prolog message.
     * For mode "delete", loads only a prolog confirmation message; all form fields are hidden after load.
     * Dispatches lifecycle events for request start, data arrival, and task
     * completion. If an `id` option is provided, it is appended as a query
     * parameter. Successful responses populate the form and trigger optional
     * success hooks.
     * Errors during the request or population phase are caught and forwarded
     * to the form's error handler.
     * @returns {Promise<void>} A Promise that resolves once the load operation has completed, regardless of success or failure. The Promise rejects only if an unexpected exception escapes the internal error handling.
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
            // append id for edit and delete modes
            if ((this.options.id || this.mode === "delete") && (this.mode === "edit" || this.mode === "delete")) {
                url = url + (url.includes("?") ? "&" : "?") + "id=" + encodeURIComponent(String(this.options.id || ""));
            }
            // always append mode for backend clarity
            url = url + (url.includes("?") ? "&" : "?") + "mode=" + encodeURIComponent(this.mode);

            const resp = await fetch(url, {
                method: "GET",
                headers: { "Accept": "application/json" },
                credentials: this.options.credentials || "same-origin"
            });

            if (resp.ok) {
                // accept JSON: {data:..., prolog: "..."} or field values directly
                const json = await resp.json();
                // compatible extraction of form data and prolog:
                let formData = (json && typeof json === "object" && "data" in json) ? json.data : json;
                let prolog = (json && typeof json === "object" && "prolog" in json && typeof json.prolog === "string")
                    ? json.prolog : null;

                // display prolog (trusted HTML from server)
                this._displayProlog(prolog);

                if (this.mode === "new" || this.mode === "edit") {
                    // only populate if there is meaningful data
                    if (formData && typeof formData === "object" && Object.keys(formData).length > 0) {
                        this._populate(formData);
                    }
                }

                if (typeof this.options.onLoadSuccess === "function") {
                    try { this.options.onLoadSuccess(json, resp); } catch (e) { }
                }

                this._dispatch(webexpress.webui.Event.DATA_ARRIVED_EVENT, { data: json, status: resp.status });
                this._dispatch(webexpress.webui.Event.CHANGE_VALUE_EVENT, { source: "load", data: json });
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
     * Populates form fields using values from a data object.
     * Each key in the data object must match the `name` attribute of one or
     * more form controls. Supports radios, checkboxes, multi‑selects, and
     * custom controller widgets.
     * Fields that cannot be populated (e.g., file inputs or missing fields)
     * are silently skipped.
     * @param {Object} data Key‑value pairs used to populate the form.
     * @returns {void} This method does not return a value; it updates the form in place.
     */
    _populate(data) {
        if (!data || typeof data !== "object") {
            return;
        }

        for (const [name, value] of Object.entries(data)) {
            const fieldOrList = this._findFieldByName(name);
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
                } else if (el.type === "hidden") {
                    el.value = value != null ? String(value) : "";
                    el.dispatchEvent(new Event("change", { bubbles: true }));
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
     * Handles the form's submit event by preventing the browser's default
     * submission, optionally validating the form, and triggering the
     * asynchronous submit workflow.
     * If validation is enabled and fails, the first invalid field is focused
     * and the submission is aborted.
     * @param {Event} ev The submit event dispatched by the browser.
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
     * Validates the form using native HTML5 validity checks and additional
     * custom rules (email format, pattern attributes, numeric ranges,
     * minlength/maxlength constraints).
     * @returns {boolean} True if all fields pass validation; false if any validation rule fails. When false, field markers and aggregated messages are displayed to guide the user.
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
     * Builds a plain JavaScript object representing the form payload.
     * Each enabled form control contributes a key/value pair based on its
     * name and current value. Special handling is applied for checkboxes,
     * radio groups, multi-select fields, and custom controller widgets.
     * @returns {Object} A payload object where each property corresponds to a form field name and its normalized value. File inputs are skipped.
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
     * Submits the form payload to the configured REST API.
     * If the server responds with `hideForm: true`, the form is hidden and a
     * confirmation view is shown. If no confirmation content is available 
     * at all, the form remains visible and any enclosing modal (if present) 
     * is closed.
     * @returns {Promise<void>} A Promise that resolves when the submission process has completed. The Promise rejects if the request fails or an unexpected error occurs.
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

        const method = this.options.method;

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
            const contentType = (resp && resp.headers && typeof resp.headers.get === "function") ? (resp.headers.get("content-type") || "") : "";
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

                // determine possible server-provided confirmation content
                // check for explicit confirmHtml (full html) first, then confirmMessage/message
                const confirmHtmlFromServer = json && (json.confirmHtml || (json.data && json.data.confirmHtml)) ? (json.confirmHtml || json.data.confirmHtml) : null;
                const serverMsg = json && (json.confirmMessage || json.message || (json.data && json.data.message)) ? (json.confirmMessage || json.message || json.data.message) : null;

                try {
                    // if server asks to hide the form, prefer confirmHtmlFromServer, then the form's <confirm>, then serverMsg
                    if (json && (!json.message || json.hideForm === true)) {
                        this._closeEnclosingModal();
                    } else {
                        // non-hideForm: prefer server confirmHtml, then serverMsg, then form's confirm block
                        if (confirmHtmlFromServer) {
                            this._showConfirm(String(confirmHtmlFromServer));
                        } else if (serverMsg) {
                            this._showConfirm(String(serverMsg));
                        } else if (this._confirmHtml) {
                            this._showConfirm(null);
                        }
                    }
                } catch (e) {
                    // ignore confirm display errors
                }
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
     * Sets the submitting state of the form.
     * When enabled, all form controls are disabled and a CSS class is applied
     * to indicate that the form is currently being submitted.
     * @param {boolean} state True to activate submitting mode; false to restore interactivity.
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
     * Applies server‑side field errors provided as a key‑value map.
     * Each entry maps a field name to its error message. Matching fields
     * receive a visual error marker, while all messages are added to the
     * aggregated form‑level error display.
     * @param {Object} errors A map of fieldName → message returned by the server.
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
     * Applies server‑side validation errors provided as an array of objects.
     * Each error may contain a message and an optional field identifier.
     * @param {Array} errorsArray The array of validation error objects returned by the server.
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
     * Attempts to locate a form field by name or id using several
     * fallback strategies, including case‑insensitive comparison
     * and simple name normalizations.
     * This is used to match server‑side field identifiers to actual
     * form controls, even when naming conventions differ slightly.
     * @param {string} raw The raw field name provided by the server.
     * @returns {HTMLElement|null} The matching form control, or null if none is found.
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
     * Displays a visual error marker for a specific form field.
     * Wraps the field in a flex container, inserts a vertical marker,
     * and stores all created elements so the error state can be cleared later.
     * @param {HTMLElement} field The form field to mark as invalid.
     * @param {string} message The error message associated with the field.
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
     * Renders a list of aggregated error messages in the form‑level
     * error container, including a localized introductory text.
     * Ensures the container exists, removes duplicate messages,
     * and escapes all content before inserting it into the DOM.
     * @param {Array<string>} messages The error messages to display.
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
     * Sets an error state for a specific form field.
     * Displays the field‑level error marker and adds the message
     * to the aggregated error list shown in the form.
     * @param {string} fieldName The name attribute of the field to mark as invalid.
     * @param {string} message The error message to display.
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
     * Handles an error by displaying a message in the form area
     * and dispatching an error event for external listeners.
     * If the error has no message, a generic localized fallback is used.
     * @param {Error} error The error that occurred during form processing.
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
     * Escapes a string so it can be safely inserted into innerHTML.
     * Converts special characters to their corresponding HTML entities
     * to prevent HTML injection.
     * @param {string} str The raw string to escape.
     * @returns {string} The escaped, HTML‑safe string.
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