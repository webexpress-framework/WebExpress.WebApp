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
webexpress.webapp.RestFormCtrl = class extends webexpress.webapp.Data {
    /**
     * Create a new RestFormCtrl instance.
     * Configuration is read strictly from data-attributes on the form element.
     * Attributes are removed from the DOM after initialization.
     * @param {HTMLFormElement} element The form element to enhance.
     */
    constructor(element) {
        const ds = element.dataset;

        // data service used for the load and the submit; the form shapes its own
        // requests (see restFormModel) and routes them through the service. the
        // endpoint is authored in C# through the wx-service island, and the Data
        // base aborts the service on teardown.
        const services = webexpress.webapp.ServiceRegistry.fromElement(element);

        // canonical ui state: a single source of truth for the transient flags,
        // exposed through the accessors below. seeded from the optional
        // wx-state island.
        const initialState = Object.assign({
            loading: false,
            submitting: false,
            mode: "new"
        }, webexpress.webapp.Data.readState(element));

        super(element, { state: initialState, services });

        this._service = this.useService("data");

        this._attachViewState(element);

        const parseBool = (val, defaultVal) => {
            return val === "true" ? true : (val === "false" ? false : defaultVal);
        };

        this.options = {
            id: ds.id || null,
            api: this._service ? this._service.baseUri : null,
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

        const mode = (ds.mode || "").toLowerCase();
        this.mode = ["new", "edit", "delete"].includes(mode) ? mode : (this.options.id ? "edit" : "new");

        // cleanup attributes
        ["data-method", "data-json", "data-validate-on-submit", "data-show-inline-errors", "data-mode"]
            .forEach((attr) => {
                this._element.removeAttribute(attr);
            });

        if (this.options.json) {
            const hasContentType = Object.keys(this.options.headers).some((k) => {
                return k.toLowerCase() === "content-type";
            });
            if (!hasContentType) {
                this.options.headers["Content-Type"] = "application/json; charset=utf-8";
            }
        }
        
        this._element.classList.add("wx-restform");

        this._fieldErrorMap = new Map();
        this._confirmHtml = null;

        // structural references
        this._formErrorContainer = null;
        this._confirmContainer = null;
        this._formPrologContainer = null;
        this._deleteConfirmContainer = null;

        // confirmation state
        this._confirmItem = null;
        this._confirmInput = null;

        this._confirmTimer = null;
        this._onSubmitBound = this._onSubmit.bind(this);

        this._init();
    }

    /**
     * Wires the form to an enclosing ViewState when it was authored with
     * Resource<T>(). A successful submit then re-queries the bound resource so a
     * ViewState-bound list or table re-renders with the created or edited record,
     * rather than relying only on the upload success and data arrived events. A
     * form without a resource binding stays standalone.
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

        const viewStateId = element.getAttribute("data-wx-viewstate") || null;
        webexpress.webapp.ViewStateRegistry.whenReady(element, viewStateId, (viewState) => {
            this._viewState = viewState;
        });
    }

    // transient ui state accessors backed by the store, so the single source of
    // truth is the store while the existing logic keeps reading fields

    get _loading() { return this._store.getState().loading; }
    set _loading(value) { this._store.setState({ loading: value }); }

    get _submitting() { return this._store.getState().submitting; }
    set _submitting(value) { this._store.setState({ submitting: value }); }

    get mode() { return this._store.getState().mode; }
    set mode(value) { this._store.setState({ mode: value }); }

    /**
     * Initialize control: attach event listeners and trigger data loading if configured.
     * Ensures the correct DOM order of structural elements.
     */
    _init() {
        this._element.addEventListener("submit", this._onSubmitBound, true);
        this._initConfirm();

        // ensure strict order: error -> confirm -> prolog.
        this._ensureContainer("wx-restform-error-container", "_formErrorContainer");
        this._ensureContainer("wx-restform-confirm", "_confirmContainer", ["alert", "alert-success"], this._formErrorContainer);
        this._ensureContainer("wx-restform-prolog-container", "_formPrologContainer", [], this._confirmContainer);

        const headerEl = this._element.querySelector(".modal-body");
        const main = headerEl ? headerEl.querySelector("main") : null;
        if (main) {
            main.style.display = this.mode === "delete" ? "none" : "block";
        }
        this.load();
    }

    /**
     * Helper to create or get a container and place it correctly in the DOM sequence.
     * @param {string} className CSS class for the container.
     * @param {string} propertyName Name of the property on 'this' to store the reference.
     * @param {string[]} additionalClasses Optional additional CSS classes.
     * @param {HTMLElement} previousSiblingRef The element after which this container should be placed.
     */
    _ensureContainer(className, propertyName, additionalClasses = [], previousSiblingRef = null) {
        let el = this._element.querySelector(`.${className}`);
        if (!el) {
            el = document.createElement("div");
            el.className = className;
            if (additionalClasses.length) {
                el.classList.add(...additionalClasses);
            }
            if (className.includes("confirm") || className.includes("prolog")) {
                el.style.display = "none";
            }
        }

        const container = this._element.querySelector(".modal-body") || this._element;

        // logic to ensure correct position
        const needsMove = el.parentNode !== container ||
            (previousSiblingRef && el.previousElementSibling !== previousSiblingRef) ||
            (!previousSiblingRef && container.firstChild !== el);

        if (needsMove) {
            if (el.parentNode) {
                el.parentNode.removeChild(el);
            }
            this._insertAfter(container, el, previousSiblingRef);
        }

        this[propertyName] = el;
    }

    /**
     * Helper to insert an element after a reference element.
     * @param {HTMLElement} parent The container element.
     * @param {HTMLElement} newNode The new node to insert.
     * @param {HTMLElement} referenceNode The node to insert after. If null, inserts at start.
     */
    _insertAfter(parent, newNode, referenceNode) {
        if (!parent || !newNode) {
            return;
        }

        if (referenceNode && referenceNode.parentNode === parent) {
            if (referenceNode.nextSibling) {
                parent.insertBefore(newNode, referenceNode.nextSibling);
            } else {
                parent.appendChild(newNode);
            }
        } else {
            if (parent.firstChild) {
                parent.insertBefore(newNode, parent.firstChild);
            } else {
                parent.appendChild(newNode);
            }
        }
    }

    /**
     * If a <confirm> element is present inside the form its innerHTML will be used as the default success message.
     */
    _initConfirm() {
        const el = this._element.querySelector("confirm");
        if (el) {
            this._confirmHtml = el.innerHTML;
            el.remove();
        }
    }

    /**
     * Displays the confirmation message inside the form.
     * @param {string|null} message The message to display. If null, uses the default confirm HTML.
     */
    _showConfirm(message) {
        const html = (typeof message === "string" && message) ? message : this._confirmHtml;
        if (!html || !this._confirmContainer) {
            return;
        }

        if (this._confirmTimer) {
            clearTimeout(this._confirmTimer);
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
        const modal = this._element.closest(".modal");
        if (!modal || !window.bootstrap) {
            return;
        }

        try {
            const Modal = window.bootstrap.Modal;
            let inst = null;
            if (typeof Modal.getInstance === "function") {
                inst = Modal.getInstance(modal);
            }
            if (!inst) {
                inst = new Modal(modal);
            }
            if (inst) {
                inst.hide();
            }
        } catch (e) {
            // ignore bootstrap errors
        }
    }

    /**
     * Displays a prolog HTML string inside the form.
     * @param {string|null} prologHtml The HTML content to display.
     */
    _displayProlog(prologHtml) {
        if (!this._formPrologContainer) {
            return;
        }
        this._formPrologContainer.innerHTML = prologHtml ? String(prologHtml) : "";
        this._formPrologContainer.style.display = prologHtml ? "" : "none";
    }

    /**
     * Loads data (including prolog/confirm) from the backend depending on the current mode.
     * @returns {Promise<void>} Promise resolving when loading is complete.
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
            const url = webexpress.webapp.restFormModel.buildLoadUrl(
                this.options.api, this.options.id, this.mode, window.location.origin);

            const result = await this._service.request(url, {
                method: "GET",
                headers: { "Accept": "application/json" },
                credentials: this.options.credentials || "same-origin"
            });

            if (!result.ok) {
                throw new Error(this._i18n("webexpress.webapp:error.load_failed", { status: result.status }));
            }

            const json = result.data;
            const dataObj = (json && typeof json === "object") ? json : {};
            const formData = dataObj.data || (Object.keys(dataObj).length ? dataObj : null);

            // priority to confirmitem if present (works for delete or critical edits)
            if (dataObj.confirmItem) {
                this._displayDeletePrompt(dataObj.confirmItem);
            } else {
                this._displayProlog(dataObj.prolog);
            }

            if (formData && typeof formData === "object") {
                this._populate(formData);
            }

            if (typeof this.options.onLoadSuccess === "function") {
                this.options.onLoadSuccess(json, result.response);
            }

            this._dispatch(webexpress.webui.Event.DATA_ARRIVED_EVENT, { data: json, status: result.status });
            this._dispatch(webexpress.webui.Event.CHANGE_VALUE_EVENT, { source: "load", data: json });

        } catch (error) {
            this._dispatchError(error);
        } finally {
            this._loading = false;
            // setSubmitting(false) must not override the disabled state if confirmItem is pending
            this._setSubmitting(false);
            this._dispatch(webexpress.webui.Event.TASK_FINISH_EVENT, { name: "loading" });
        }
    }

    /**
     * Populates form fields using values from a data object.
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

            // handle nodelist (radio/checkbox groups)
            if (fieldOrList instanceof RadioNodeList) {
                const first = fieldOrList[0];
                if (first.type === "radio") {
                    fieldOrList.value = String(value);
                } else if (first.type === "checkbox") {
                    const values = (Array.isArray(value) ? value : [value]).map(String);
                    fieldOrList.forEach((el) => {
                        el.checked = values.includes(el.value);
                    });
                }
                continue;
            }

            // handle elements
            const el = fieldOrList;
            const ctrl = webexpress.webui.Controller.getClosestInstance(el);

            // ensure the controller is not the form itself and supports value assignment
            if (ctrl && ctrl !== this && typeof ctrl.value !== "undefined") {
                ctrl.value = value;
                continue;
            }

            if (el.type === "checkbox") {
                el.checked = !!value;
            } else if (el.type === "hidden") {
                el.value = value != null
                    ? (Array.isArray(value) ? value.join(";") : String(value))
                    : "";
                el.dispatchEvent(new Event("change", { bubbles: true }));
            } else if (el instanceof HTMLSelectElement && el.multiple) {
                const values = (Array.isArray(value) ? value : [value]).map(String);
                Array.from(el.options).forEach((opt) => {
                    opt.selected = values.includes(opt.value);
                });
            } else if (el.type !== "file") {
                el.value = (value === null || value === undefined) ? "" : String(value);
            }
        }
    }

    /**
     * Handles the form's submit event.
     * @param {Event} ev The submit event.
     */
    _onSubmit(ev) {
        ev.preventDefault();
        ev.stopImmediatePropagation();

        if (this._submitting) {
            return;
        }

        if (this.options.validateOnSubmit && !this.validate()) {
            const firstInvalid = this._element.querySelector("[aria-invalid='true']");
            if (firstInvalid) {
                firstInvalid.focus();
            }
            return;
        }
        this.submit();
    }

    /**
     * Validates a single form field element.
     * Can be overridden by subclasses or used by them.
     * @param {HTMLElement} el The element to validate.
     * @returns {string|null} The error message or null if valid.
     */
    _validateField(el) {
        if (!el || el.disabled) {
            return null;
        }

        let msg = null;

        if (!el.validity.valid) {
            msg = el.validationMessage || this._i18n("webexpress.webapp:validation.invalid");
        } else if (el.type === "email" && el.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value)) {
            msg = this._i18n("webexpress.webapp:validation.email.invalid");
        } else if (el.hasAttribute("pattern") && el.value) {
            try {
                // cache regexp if possible, but for generic forms new RegExp is safer
                const rx = new RegExp(`^(?:${el.getAttribute("pattern")})$`);
                if (!rx.test(el.value)) {
                    msg = el.getAttribute("data-error-message") || this._i18n("webexpress.webapp:validation.format.invalid");
                }
            } catch (e) {
                // ignore invalid regex definition in html
            }
        } else if (el.type === "number" && el.value) {
            const val = parseFloat(el.value);
            const min = parseFloat(el.getAttribute("min"));
            const max = parseFloat(el.getAttribute("max"));

            if (!isNaN(min) && val < min) {
                msg = this._applyParams(this._i18n("webexpress.webapp:validation.number.range"), { min, max });
            } else if (!isNaN(max) && val > max) {
                msg = this._applyParams(this._i18n("webexpress.webapp:validation.number.range"), { min, max });
            }
        } else {
            const len = el.value.length;
            const minLen = parseInt(el.getAttribute("minlength"), 10);
            const maxLen = parseInt(el.getAttribute("maxlength"), 10);

            if (!isNaN(minLen) && len < minLen) {
                msg = this._applyParams(this._i18n("webexpress.webapp:validation.minlength"), { minlength: minLen });
            } else if (!isNaN(maxLen) && len > maxLen) {
                msg = this._applyParams(this._i18n("webexpress.webapp:validation.maxlength"), { maxlength: maxLen });
            }
        }

        return msg;
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
            return el.name && !el.disabled && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
        });

        for (const el of elements) {
            const msg = this._validateField(el);

            if (msg) {
                formIsValid = false;
                this._showFieldError(el, msg);
                messages.push(msg);
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
            return el.name && !el.disabled && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) && el.type !== "file";
        });

        for (const el of elements) {
            const name = el.name;
            const ctrl = webexpress.webui.Controller.getInstanceByElement(el);
            let value = (ctrl && typeof ctrl.value !== "undefined") ? ctrl.value : el.value;

            if (el.type === "checkbox") {
                const val = el.checked ? (value || true) : false;
                if (!Object.prototype.hasOwnProperty.call(data, name)) {
                    data[name] = val;
                } else {
                    if (!Array.isArray(data[name])) {
                        data[name] = [data[name]];
                    }
                    if (el.checked) {
                        data[name].push(val);
                    }
                }
                continue;
            }
            if (el.type === "radio") {
                if (el.checked) {
                    data[name] = value;
                }
                continue;
            }
            if (el instanceof HTMLSelectElement && el.multiple) {
                data[name] = Array.from(el.selectedOptions).map((o) => {
                    return o.value;
                });
                continue;
            }

            data[name] = value;
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

        // run beforeSend hook
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

        const { url, init } = webexpress.webapp.restFormModel.buildRequest(
            endpoint, this.options, payload, window.location.origin);

        this._setSubmitting(true);
        this._dispatch(webexpress.webui.Event.TASK_START_EVENT, { name: "submitting" });
        this._dispatch(webexpress.webui.Event.DATA_REQUESTED_EVENT, { type: "submit", url: url });

        try {
            const result = await this._service.request(url, init);
            this._handleResult(result);
        } catch (error) {
            if (typeof this.options.onError === "function") {
                this.options.onError(error);
            }
            this._dispatchError(error);
        } finally {
            this._setSubmitting(false);
            this._dispatch(webexpress.webui.Event.TASK_FINISH_EVENT, { name: "submitting" });
        }
    }

    /**
     * Prepares URL and Fetch options based on method and payload.
     * @param {string} endpoint The target URL.
     * @param {Object} payload The data to send.
     * @returns {{url: string, init: Object}} Request configuration.
     */
    _prepareRequest(endpoint, payload) {
        return webexpress.webapp.restFormModel.buildRequest(endpoint, this.options, payload, window.location.origin);
    }

    /**
     * Handles a normalised service result by classifying it into a success, a
     * validation or a system error outcome and updating the UI accordingly. The
     * classification and the server error normalisation are pure and live in
     * restFormModel; the DOM updates stay here. A system error is thrown so the
     * submit caller reports it through its catch.
     * @param {object} result - The normalised service result.
     */
    _handleResult(result) {
        const json = result.data;
        const classification = webexpress.webapp.restFormModel.classifyResponse(result.ok, result.status, json);

        if (classification.kind === "success") {
            this.clearErrors();
            if (typeof this.options.onSuccess === "function") {
                this.options.onSuccess(json, result.response);
            }

            this._dispatch(webexpress.webui.Event.UPLOAD_SUCCESS_EVENT, { response: json, status: result.status, form: this._element });
            this._dispatch(webexpress.webui.Event.DATA_ARRIVED_EVENT, { type: "submit", data: json });

            // when bound to a ViewState, re-query the resource so a ViewState-bound
            // list or table re-renders with the created or edited record
            if (this._viewState) {
                this._viewState.dispatch("viewstate/reload", { resource: this._viewStateResource });
            }

            if (classification.closeModal) {
                this._closeEnclosingModal();
            } else if (classification.confirmHtml) {
                this._showConfirm(String(classification.confirmHtml));
            } else if (classification.message) {
                this._showConfirm(String(classification.message));
            } else if (this._confirmHtml) {
                this._showConfirm(null);
            }
        } else if (classification.kind === "validation") {
            this.clearErrors();

            const messages = [];
            for (const e of (classification.errors || [])) {
                if (e.field) {
                    const field = this._findFieldByName(e.field);
                    if (field) {
                        this._showFieldError(field, e.message);
                    }
                }
                messages.push(e.message);
            }

            if (messages.length === 0) {
                const fallback = classification.message || this._i18n("webexpress.webapp:validation.failed");
                messages.push(typeof fallback === "object" ? JSON.stringify(fallback) : fallback);
            }

            this._displayAggregatedErrors(messages);

            if (typeof this.options.onError === "function") {
                this.options.onError(json, result.response);
            }
            this._dispatch(webexpress.webui.Event.UPLOAD_ERROR_EVENT, { type: "validation", response: json, status: result.status, form: this._element });
        } else {
            // handle system errors
            const message = this._i18n("webexpress.webapp:error.request_failed")
                .replace("{status}", result.status);
            const err = new Error(message);
            err.status = result.status;
            err.response = result.response;
            err.payload = json;
            throw err;
        }
    }

    /**
     * Sets the submitting state of the form.
     * Prevents re-enabling the submit button if a delete confirmation is pending.
     * @param {boolean} state True to activate submitting mode; false to restore interactivity.
     */
    _setSubmitting(state) {
        this._submitting = !!state;
        const submitBtn = this._element.querySelector('[type="submit"], button[name="submit"]');

        Array.from(this._element.elements).forEach((el) => {
            if (state) {
                el.setAttribute("disabled", "disabled");
            } else {
                // check if we have a pending confirmation that requires the button to stay disabled
                const isConfirmPending = this._confirmItem && this._confirmInput && this._confirmInput.value !== this._confirmItem;

                if (el === submitBtn && isConfirmPending) {
                    // keep disabled until confirm matches
                } else {
                    el.removeAttribute("disabled");
                }
            }
        });

        if (state) {
            this._element.classList.add("wx-restform-submitting");
        } else {
            this._element.classList.remove("wx-restform-submitting");
        }
    }

    /**
     * Attempts to locate a form field by name or id.
     * @param {string} raw The raw field name provided by the server.
     * @returns {HTMLElement|null} The matching form control, or null if none is found.
     */
    _findFieldByName(raw) {
        if (!raw) {
            return null;
        }

        // exact match
        const escapeName = CSS.escape(raw);
        let el = this._element.querySelector(`[name="${escapeName}"]`);
        if (el) {
            return el;
        }

        // id match
        const idEl = this._element.querySelector(`#${escapeName}`);
        if (idEl) {
            return idEl;
        }

        // case-insensitive / normalized search
        const target = String(raw).toLowerCase();
        const normalize = (s) => {
            return (s || "").toLowerCase();
        };

        const candidates = Array.from(this._element.querySelectorAll("[name]"));

        // try strict lowercase match
        let match = candidates.find((e) => {
            return normalize(e.name) === target;
        });
        if (match) {
            return match;
        }

        // try normalized match (remove array brackets)
        const normTarget = target.replace(/\[(.*?)\]/g, "$1");
        match = candidates.find((e) => {
            return normalize(e.name) === normTarget;
        });
        if (match) {
            return match;
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
            this._fieldErrorMap.get(field).message = message;
            return;
        }

        const marker = document.createElement("div");
        marker.className = "wx-restform-field-marker";
        const wrapper = document.createElement("div");
        wrapper.className = "wx-restform-field-wrapper";

        field.setAttribute("aria-invalid", "true");

        if (field.parentNode) {
            field.parentNode.insertBefore(wrapper, field);
            wrapper.appendChild(marker);
            wrapper.appendChild(field);
            this._fieldErrorMap.set(field, { marker: marker, wrapper: wrapper, message: message });
        } else {
            // fallback for detached elements
            field.style.boxSizing = "border-box";
            field.style.borderLeft = "4px solid #dc3545";
            this._fieldErrorMap.set(field, { marker: null, wrapper: null, message: message });
        }
    }

    /**
     * Renders aggregated error messages.
     * @param {Array<string>} messages The error messages to display.
     */
    _displayAggregatedErrors(messages) {
        if (!Array.isArray(messages) || messages.length === 0) {
            return;
        }

        if (!this._formErrorContainer) {
            this._ensureContainer("wx-restform-error-container", "_formErrorContainer");
        }

        let el = this._formErrorContainer.querySelector(".wx-restform-error");
        if (!el) {
            el = document.createElement("div");
            el.className = "wx-restform-error alert alert-danger";
            this._formErrorContainer.appendChild(el);
        }

        const unique = Array.from(new Set(messages.filter(Boolean)));
        const listItems = unique.map((m) => {
            return `<li>${this._escapeHtml(String(m))}</li>`;
        }).join("");
        const intro = this._escapeHtml(this._i18n("webexpress.webapp:form.validation.errors"));

        el.innerHTML = `<p>${intro}</p><ul>${listItems}</ul>`;
    }

    /**
     * Clear all markers, unwrap fields and remove form-level messages.
     */
    clearErrors() {
        for (const [field, info] of this._fieldErrorMap.entries()) {
            if (field) {
                field.removeAttribute("aria-invalid");
            }

            if (info) {
                if (info.wrapper && info.wrapper.parentNode) {
                    const parent = info.wrapper.parentNode;
                    parent.insertBefore(field, info.wrapper);
                    parent.removeChild(info.wrapper);
                } else if (info.marker) {
                    info.marker.remove();
                } else if (field) {
                    field.style.borderLeft = "";
                }
            }
        }
        this._fieldErrorMap.clear();

        if (this._formErrorContainer) {
            const el = this._formErrorContainer.querySelector(".wx-restform-error");
            if (el) {
                el.remove();
            }
        }
    }

    /**
     * Handles an error by displaying a message and dispatching an error event.
     * @param {Error} error The error that occurred.
     */
    _dispatchError(error) {
        const msg = (error && error.message) ? error.message : this._i18n("webexpress.webapp:error.generic");
        this._displayAggregatedErrors([msg]);
        this._dispatch(webexpress.webui.Event.UPLOAD_ERROR_EVENT, { error: error, form: this._element });
    }

    /**
     * Displays a delete confirmation prompt.
     * Position: 4th (after prolog).
     * @param {string|null} confirmItem The required text for enabling submit.
     */
    _displayDeletePrompt(confirmItem) {
        // store state for _setSubmitting logic
        this._confirmItem = confirmItem;
        this._confirmInput = null;

        if (!confirmItem) {
            const btn = this._element.querySelector('[type="submit"], button[name="submit"]');
            if (btn) {
                btn.disabled = false;
            }
            return;
        }

        let confirmDiv = this._element.querySelector(".wx-restform-delete-confirm");
        if (!confirmDiv) {
            confirmDiv = document.createElement("div");
            confirmDiv.className = "wx-restform-delete-confirm";
        }
        confirmDiv.innerHTML = "";

        // template construction
        const prompt = document.createElement("div");
        prompt.setAttribute("role", "status");
        prompt.innerHTML = this._i18n("webexpress.webapp:delete.confirmation.prompt")
            .replace("{item}", `<strong>${this._escapeHtml(confirmItem)}</strong>`);

        const input = document.createElement("input");
        Object.assign(input, {
            type: "text", className: "form-control", placeholder: confirmItem, autocomplete: "off"
        });
        input.setAttribute("aria-label", this._i18n("webexpress.webapp:delete.confirmation.input.aria-label", "Type {item} to confirm deletion.")
            .replace("{item}", confirmItem));

        // store input ref
        this._confirmInput = input;

        const errorDiv = document.createElement("div");
        errorDiv.className = "text-danger";
        errorDiv.style.display = "none";

        confirmDiv.append(prompt, input, errorDiv);

        // positioning logic
        const container = this._element.querySelector(".modal-body") || this._element;
        // insert after prolog, or confirm, or error, or at start
        const ref = this._formPrologContainer || this._confirmContainer || this._formErrorContainer;

        if (confirmDiv.parentNode !== container || (ref && confirmDiv.previousElementSibling !== ref)) {
            if (confirmDiv.parentNode) {
                confirmDiv.parentNode.removeChild(confirmDiv);
            }
            this._insertAfter(container, confirmDiv, ref);
        }
        this._deleteConfirmContainer = confirmDiv;

        // interaction logic
        const submitBtn = this._element.querySelector('[type="submit"]:not([data-noconfirm]), button[name="submit"]:not([data-noconfirm])');
        if (submitBtn) {
            submitBtn.disabled = true;
        }

        input.addEventListener("input", () => {
            const v = input.value.trim();
            const match = v === confirmItem;
            errorDiv.style.display = (!match && v.length > 0) ? "" : "none";
            if (!match && v.length > 0) {
                errorDiv.textContent = this._i18n("webexpress.webapp:delete.confirmation.mismatch");
            }
            if (submitBtn) {
                submitBtn.disabled = !match;
            }
        });
    }

    /**
     * Sets the title of the form in the modal header.
     * @param {string|null} title The title to display, or null/empty string to clear it.
     */
    _setHeaderTitle(title) {
        if (title === null) {
            return;
        }

        const headerEl = this._element.querySelector(".modal-header");
        if (!headerEl) {
            return;
        }

        let titleEl = headerEl.querySelector(".modal-title");
        if (!titleEl) {
            titleEl = document.createElement("h5");
            titleEl.className = "modal-title";
            headerEl.prepend(titleEl);
        }

        titleEl.textContent = title || "";
        titleEl.style.display = title ? "" : "none";
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
        this._element.removeEventListener("submit", this._onSubmitBound, true);
        this._fieldErrorMap.clear();
    }

    /**
     * Escapes a string so it can be safely inserted into innerHTML.
     * @param {string} str The raw string to escape.
     * @returns {string} The escaped, HTML-safe string.
     */
    _escapeHtml(str) {
        return String(str).replace(/[&<>"']/g, (m) => {
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

// register the class in the controller
webexpress.webui.Controller.registerClass("wx-webapp-restform", webexpress.webapp.RestFormCtrl);