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
     * Configuration is read strictly from data-attributes on the form element.
     * Attributes are removed from the DOM after initialization.
     * @param {HTMLFormElement} element The form element to enhance.
     */
    constructor(element) {
        super(element);
       
        const ds = this._element.dataset;
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
            beforeSend: null,
            onSuccess: null,
            onError: null,
            onLoadSuccess: null
        };
        if (ds.mode) {
            const m = ds.mode.toLowerCase();
            const allowed = new Set(["new", "edit", "delete"]);
            this.mode = allowed.has(m) ? m : "new";
        } else {
            this.mode = this.options.id ? "edit" : "new";
        }
        this._element.removeAttribute("data-api");
        this._element.removeAttribute("data-method");
        this._element.removeAttribute("data-json");
        this._element.removeAttribute("data-validate-on-submit");
        this._element.removeAttribute("data-show-inline-errors");
        this._element.removeAttribute("data-mode");
        if (this.options.json) {
            if (!Object.keys(this.options.headers).some((k) => {
                return k.toLowerCase() === "content-type";
            })) {
                this.options.headers["Content-Type"] = "application/json; charset=utf-8";
            }
        }
        this._submitting = false;
        this._loading = false;
        this._fieldErrorMap = new Map();
        this._confirmHtml = null;
        this._confirmContainer = null;
        this._confirmTimer = null;
        this._onSubmitBound = this._onSubmit.bind(this);
        this._init();
    }

    /**
     * Initialize control: attach event listeners and trigger data loading if configured.
     */
    _init() {
        this._element.addEventListener("submit", this._onSubmitBound, true);
        this._initConfirm();
        this._ensureFormPrologContainer();
        this._ensureFormConfirmContainer();
        this._ensureFormErrorContainer();
        const headerEl = this._element.querySelector(".modal-body");
        const main = headerEl ? headerEl.querySelector("main") : null;
        if (main) {
            if (this.mode === "delete") {
                main.style.display = "none";
            } else {
                main.style.display = "block";
            }
        }
        this.load();
    }

    /**
     * If a <confirm> element is present inside the form its innerHTML will be used as the default success message.
     */
    _initConfirm() {
        const el = this._element.querySelector("confirm");
        if (el) {
            this._confirmHtml = String(el.innerHTML);
            this._element.removeChild(el);
        }
    }

    /**
     * Ensure a container element exists for non-field form errors.
     * Creates an element .restform-error-container and places it in the form header when possible.
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
     * Ensures that a container element for the prolog exists inside the form.
     * The prolog is placed in the modal body if available, otherwise at the form start.
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
                    prologCont.parentNode.removeChild(prologCont);
                }
                headerEl.insertBefore(prologCont, headerEl.firstChild);
            }
        } else {
            if (prologCont.parentNode !== this._element) {
                if (prologCont.parentNode) {
                    prologCont.parentNode.removeChild(prologCont);
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
        if (!this._confirmContainer) {
            this._confirmContainer = document.createElement("div");
            this._confirmContainer.className = "restform-confirm alert alert-success";
            this._confirmContainer.style.display = "none";
        }
        const headerEl = this._element.querySelector(".modal-body");
        if (headerEl) {
            if (this._confirmContainer.parentNode !== headerEl) {
                if (this._confirmContainer.parentNode) {
                    this._confirmContainer.parentNode.removeChild(this._confirmContainer);
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
     * Any existing hide-timer is cleared before showing the confirmation container.
     * @param {string|null} message Optional override message.
     */
    _showConfirm(message) {
        const html = typeof message === "string" && message ? message : this._confirmHtml;
        if (!html || !this._confirmContainer) {
            return;
        }
        if (this._confirmTimer !== null) {
            window.clearTimeout(this._confirmTimer);
            this._confirmTimer = null;
        }
        this._confirmContainer.innerHTML = String(html);
        this._confirmContainer.style.display = "block";
    }

    /**
     * Closes the modal that contains this form, if any.
     */
    _closeEnclosingModal() {
        if (!this._element) {
            return;
        }
        const modal = this._element.classList && this._element.classList.contains("modal")
            ? this._element
            : (this._element.closest ? this._element.closest(".modal") : null);
        if (!modal) {
            return;
        }
        try {
            if (window.bootstrap && typeof window.bootstrap.Modal === "function") {
                let inst = null;
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
     * Displays a prolog HTML string inside the form.
     * @param {string|null} prologHtml The HTML string to display as prolog or null/empty for none.
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
     * Loads data (including prolog/title/confirm) from the backend depending on the current mode.
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
            if ((this.options.id || this.mode === "delete") && (this.mode === "edit" || this.mode === "delete")) {
                url = url + (url.includes("?") ? "&" : "?") + "id=" + encodeURIComponent(String(this.options.id || ""));
            }
            url = url + (url.includes("?") ? "&" : "?") + "mode=" + encodeURIComponent(this.mode);
            const resp = await fetch(url, {
                method: "GET",
                headers: { "Accept": "application/json" },
                credentials: this.options.credentials || "same-origin"
            });
            if (resp.ok) {
                const json = await resp.json();
                const formData = json && typeof json === "object" && "data" in json ? json.data : json;
                const prolog = json && typeof json === "object" && typeof json.prolog === "string" ? json.prolog : null;
                const title = json && typeof json === "object" && typeof json.title === "string" ? json.title : null;
                const confirmItem = this.mode === "delete" && json && typeof json === "object" && "confirmItem" in json ? json.confirmItem : null;
                this._setHeaderTitle(title);
                if (this.mode === "delete") {
                    this._displayDeletePromt(confirmItem);
                } else {
                    this._displayProlog(prolog);
                }
                if ((this.mode === "new" || this.mode === "edit") && formData && typeof formData === "object" && Object.keys(formData).length > 0) {
                    this._populate(formData);
                }
                if (typeof this.options.onLoadSuccess === "function") {
                    try {
                        this.options.onLoadSuccess(json, resp);
                    } catch (e) {
                    }
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
     * Uses _findFieldByName for robust name matching.
     * @param {Object} data Key-value pairs used to populate the form.
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
                if (ctrl && typeof ctrl.value !== "undefined") {
                    ctrl.value = value;
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
     * Handles the form's submit event.
     * Prevents default submission, validates if enabled, then triggers submit().
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
     * Validates the form using native HTML5 validity and extra rules.
     * @returns {boolean} True if valid, false otherwise.
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
     * @returns {Object} Payload object.
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
                const vals = Array.from(el.options).filter((o) => {
                    return o.selected;
                }).map((o) => {
                    return o.value;
                });
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
     * @returns {Promise<void>} Promise resolving when done.
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
                if (!Object.keys(init.headers).some((k) => {
                    return k.toLowerCase() === "content-type";
                })) {
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
                if (!Object.keys(init.headers).some((k) => {
                    return k.toLowerCase() === "content-type";
                })) {
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
            const contentType = resp && resp.headers && typeof resp.headers.get === "function" ? resp.headers.get("content-type") || "" : "";
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
                    }
                }
                this._dispatch(webexpress.webui.Event.UPLOAD_SUCCESS_EVENT, { response: json, status: resp.status, form: this._element });
                this._dispatch(webexpress.webui.Event.DATA_ARRIVED_EVENT, { type: "submit", data: json });
                const confirmHtmlFromServer = json && (json.confirmHtml || (json.data && json.data.confirmHtml)) ? (json.confirmHtml || json.data.confirmHtml) : null;
                const serverMsg = json && (json.confirmMessage || json.message || (json.data && json.data.message)) ? (json.confirmMessage || json.message || json.data.message) : null;
                try {
                    if (json && (!json.message || json.hideForm === true)) {
                        this._closeEnclosingModal();
                    } else {
                        if (confirmHtmlFromServer) {
                            this._showConfirm(String(confirmHtmlFromServer));
                        } else if (serverMsg) {
                            this._showConfirm(String(serverMsg));
                        } else if (this._confirmHtml) {
                            this._showConfirm(null);
                        }
                    }
                } catch (e) {
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
                    }
                }
                this._dispatchError(err);
            }
        } catch (error) {
            if (typeof this.options.onError === "function") {
                try {
                    this.options.onError(error);
                } catch (e) {
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
     * @param {boolean} state True to activate submitting mode; false to restore interactivity.
     */
    _setSubmitting(state) {
        this._submitting = !!state;
        const elements = Array.from(this._element.elements);
        const submitBtn = this._element.querySelector('[type="submit"], button[name="submit"]');
        for (const el of elements) {
            if (state) {
                el.setAttribute("disabled", "disabled");
            } else {
                if (el === submitBtn && this.mode === "delete" && this._confirmItem) {
                } else {
                    el.removeAttribute("disabled");
                }
            }
        }
        if (state) {
            this._element.classList.add("restform-submitting");
        } else {
            this._element.classList.remove("restform-submitting");
        }
    }

    /**
     * Applies server-side field errors provided as a key-value map.
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
     * Applies server-side validation errors provided as an array of objects.
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
        }
        this._displayAggregatedErrors(messages);
    }

    /**
     * Attempts to locate a form field by name or id using several fallback strategies.
     * @param {string} raw The raw field name provided by the server.
     * @returns {HTMLElement|null} The matching form control, or null if none is found.
     */
    _findFieldByName(raw) {
        if (!raw) {
            return null;
        }
        try {
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
            const idEl = this._element.querySelector(`#${CSS.escape(raw)}`);
            if (idEl) {
                return idEl;
            }
            const alt = String(raw).replace(/^\w/, (c) => {
                return c.toLowerCase();
            });
            const altEl = this._element.querySelector(`[name="${CSS.escape(alt)}"]`);
            if (altEl) {
                return altEl;
            }
            const normalized = String(raw).replace(/\[(.*?)\]/g, "$1");
            const normTarget = normalized.toLowerCase();
            const normCandidates = Array.from(this._element.querySelectorAll("[name]")).filter((e) => {
                return (e.getAttribute("name") || "").toLowerCase() === normTarget;
            });
            if (normCandidates.length > 0) {
                return normCandidates[0];
            }
        } catch (e) {
        }
        return null;
    }

    /**
     * Displays a visual error marker for a specific form field.
     * @param {HTMLElement} field The form field to mark as invalid.
     * @param {string} message The error message associated with the field.
     */
    _showFieldError(field, message) {
        if (!field || !(field instanceof HTMLElement)) {
            return;
        }
        if (this._fieldErrorMap.has(field)) {
            const info = this._fieldErrorMap.get(field);
            info.message = message;
            return;
        }
        const marker = document.createElement("div");
        marker.className = "restform-field-marker";
        const wrapper = document.createElement("div");
        wrapper.className = "restform-field-wrapper";
        field.setAttribute("aria-invalid", "true");
        const parent = field.parentNode;
        if (parent) {
            parent.insertBefore(wrapper, field);
            wrapper.appendChild(marker);
            wrapper.appendChild(field);
            this._fieldErrorMap.set(field, { marker: marker, wrapper: wrapper, message: message });
        } else {
            field.style.boxSizing = "border-box";
            field.style.borderLeft = "4px solid #dc3545";
            this._fieldErrorMap.set(field, { marker: null, wrapper: null, message: message });
        }
    }

    /**
     * Renders aggregated error messages in the form-level error container.
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
        const unique = Array.from(new Set(messages.filter((m) => {
            return m;
        })));
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
                if (info.wrapper && info.wrapper.parentNode) {
                    try {
                        const wrapperParent = info.wrapper.parentNode;
                        wrapperParent.insertBefore(field, info.wrapper);
                        wrapperParent.removeChild(info.wrapper);
                    } catch (e) {
                    }
                } else if (info.marker && info.marker.parentNode) {
                    try {
                        info.marker.parentNode.removeChild(info.marker);
                    } catch (e) {
                    }
                } else if (field) {
                    try {
                        field.style.borderLeft = "";
                    } catch (e) {
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
     * Handles an error by displaying a message and dispatching an error event.
     * @param {Error} error The error that occurred.
     */
    _dispatchError(error) {
        try {
            const msg = error && error.message ? error.message : this._i18n("webexpress.webapp:error.generic");
            this._displayAggregatedErrors([msg]);
        } catch (e) {
        }
        this._dispatch(webexpress.webui.Event.UPLOAD_ERROR_EVENT, { error: error, form: this._element });
    }

    /**
     * Displays a delete confirmation prompt within the modal body right after the prolog.
     * The submit button remains disabled until the correct confirmItem is entered.
     * @param {string|null} confirmItem The required text for enabling submit.
     */
    _displayDeletePromt(confirmItem) {
        if (this.mode === "delete" && confirmItem) {
            let confirmDiv = this._element.querySelector(".restform-delete-confirm");
            if (!confirmDiv) {
                confirmDiv = document.createElement("div");
                confirmDiv.className = "restform-delete-confirm";
            } else {
                confirmDiv.innerHTML = "";
            }
            const prompt = document.createElement("div");
            prompt.setAttribute("role", "status");
            prompt.innerHTML = this._i18n("webexpress.webapp:delete.confirmation.prompt")
                .replace("{item}", `<strong>${this._escapeHtml(confirmItem)}</strong>`);
            const input = document.createElement("input");
            input.type = "text";
            input.className = "form-control";
            input.placeholder = confirmItem;
            input.setAttribute("autocomplete", "off");
            input.setAttribute("aria-label", this._i18n("webexpress.webapp:delete.confirmation.input.aria-label", { item: confirmItem }));
            const errorDiv = document.createElement("div");
            errorDiv.className = "text-danger";
            errorDiv.style.display = "none";
            const submitBtn = this._element.querySelector('[type="submit"]:not([data-noconfirm]), button[name="submit"]:not([data-noconfirm])');
            if (submitBtn) {
                submitBtn.disabled = true;
            }
            input.addEventListener("input", () => {
                const v = input.value.trim();
                if (v === confirmItem) {
                    errorDiv.style.display = "none";
                    if (submitBtn) {
                        submitBtn.disabled = false;
                    }
                } else {
                    if (v.length > 0) {
                        errorDiv.textContent = this._i18n("webexpress.webapp:delete.confirmation.mismatch");
                        errorDiv.style.display = "";
                    } else {
                        errorDiv.style.display = "none";
                    }
                    if (submitBtn) {
                        submitBtn.disabled = true;
                    }
                }
            });
            confirmDiv.appendChild(prompt);
            confirmDiv.appendChild(input);
            confirmDiv.appendChild(errorDiv);
            const headerEl = this._element.querySelector(".modal-body");
            if (headerEl && this._formPrologContainer.parentNode === headerEl) {
                if (this._formPrologContainer.nextSibling) {
                    headerEl.insertBefore(confirmDiv, this._formPrologContainer.nextSibling);
                } else {
                    headerEl.appendChild(confirmDiv);
                }
            } else {
                this._element.appendChild(confirmDiv);
            }
            if (submitBtn) {
                submitBtn.disabled = true;
            }
        } else {
            const submitBtn = this._element.querySelector('[type="submit"], button[name="submit"]');
            if (submitBtn) {
                submitBtn.disabled = false;
            }
        }
    }

    /**
     * Sets the title of the form in the modal header.
     * @param {string|null} title The title to display, or null/empty string to clear it.
     */
    _setHeaderTitle(title) {
        const headerEl = this._element.querySelector(".modal-header");
        if (!headerEl) {
            return;
        }
        let titleEl = this._element.querySelector(".modal-title");
        if (!titleEl) {
            titleEl = document.createElement("h5");
            titleEl.className = "modal-title";
            if (headerEl.firstChild) {
                headerEl.insertBefore(titleEl, headerEl.firstChild);
            } else {
                headerEl.appendChild(titleEl);
            }
        }
        if (title && title.length) {
            titleEl.textContent = title;
            titleEl.style.display = "";
        } else {
            titleEl.textContent = "";
            titleEl.style.display = "none";
        }
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
        }
    }

    /**
     * Escapes a string so it can be safely inserted into innerHTML.
     * @param {string} str The raw string to escape.
     * @returns {string} The escaped, HTML-safe string.
     */
    _escapeHtml(str) {
        return str.replace(/[&<>"']/g, function (m) {
            switch (m) {
                case "&":
                    return "&amp;";
                case "<":
                    return "&lt;";
                case ">":
                    return "&gt;";
                case "\"":
                    return "&quot;";
                case "'":
                    return "&#39;";
                default:
                    return m;
            }
        });
    }
};

webexpress.webui.Controller.registerClass("wx-webapp-restform", webexpress.webapp.RestFormCtrl);