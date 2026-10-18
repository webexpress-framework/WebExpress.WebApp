/**
 * REST form controller. Replaces a traditional form POST with a JSON REST request, performs
 * client-side validation.
 *
 * The form decorates the markup the server rendered: its fields, its header and its buttons
 * stay where they are. What the control adds is rendered from the state - the error list,
 * the confirmation, the prolog and the delete confirmation at the top of the form body - and
 * the server rendered children are placed around it unchanged. The marks of invalid fields
 * and the lock of the fields while a request is out are applied to that markup after every
 * render, since a tree of its own cannot describe them.
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

        // canonical ui state: a single source of truth for the transient flags and
        // for what the form shows above its fields, seeded from the optional
        // wx-state island.
        const initialState = Object.assign({
            loading: false,
            submitting: false,
            mode: "new",
            // the messages of the form-level error list
            errors: [],
            // the invalid fields { field, message }; a field is its element, or the
            // name the server reported
            fieldErrors: [],
            // the confirmation and the prolog, as html the server authored
            confirm: null,
            prolog: null,
            // the pending delete confirmation { item, value }
            deleteConfirm: null
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
            // read the method attribute rather than the idl property, which reports
            // the html default of "get" when the attribute is absent and would make
            // the post fallback unreachable
            method: (ds.method || element.getAttribute("method") || "POST").toUpperCase(),
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

        this._confirmHtml = null;

        // the marks applied to invalid fields, by field element
        this._markers = new Map();
        // the elements the lock disabled, which are the only ones it enables again
        this._locked = new Set();
        // the submit button a pending delete confirmation holds back
        this._gated = null;
        this._confirmInput = null;

        this._onSubmitBound = this._onSubmit.bind(this);

        if (this._init() !== false) {
            this.mount();
            this.load();
        }
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
     * A form holds what the user is typing, so a change made elsewhere does not reload
     * it; the user sees it on the next opening of the form.
     * @returns {boolean} Always false.
     */
    _reloadsOnDataChange() {
        return false;
    }

    /**
     * Reads the structure of the server rendered form: the body the banners lead (the
     * dialog body of a form in a dialog, the form itself otherwise) and the children
     * the view places unchanged. A subclass reads its own structure on top.
     * @returns {boolean} False when the form must not be set up, true otherwise.
     */
    _init() {
        this._element.addEventListener("submit", this._onSubmitBound, true);
        this._initConfirm();

        const elementChildren = (node) => Array.from(node.childNodes || []).filter((child) => child.nodeType === 1);

        this._hostChildren = elementChildren(this._element);
        this._body = this._hostChildren.find((child) => child.classList.contains("modal-body")) || this._element;
        this._bodyChildren = this._body === this._element ? this._hostChildren : elementChildren(this._body);

        const main = this._body !== this._element ? this._body.querySelector(".wx-form-main") : null;
        if (main) {
            if (this.mode === "delete") {
                main.style.display = "none";
            } else {
                // the inline value is cleared rather than set to "block", so how the fields are
                // laid out stays the stylesheet's decision - a form whose body is one filling
                // surface needs a flex column here, and an inline display outranks every rule
                // that could say so
                main.style.removeProperty("display");
            }
        }

        return true;
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
     * Describes the form: the banners at the top of its body, ahead of the server
     * rendered content, which keeps its nodes.
     * @param {object} state The current state.
     * @returns {Array<object>} The virtual node tree of the form.
     */
    render(state) {
        const body = [this._renderBanners(state), this._renderContent(state)];

        if (this._body === this._element) {
            return body;
        }

        return this._hostChildren.map((child) => child === this._body
            ? webexpress.webui.Renderer.adopt(child, null, body)
            : this._renderHostChild(state, child));
    }

    /**
     * Describes the banners in their order: error, confirmation, prolog and the delete
     * confirmation.
     * @param {object} state The current state.
     * @returns {Array<object>} The banner virtual nodes.
     */
    _renderBanners(state) {
        const h = webexpress.webui.h;
        const errors = Array.from(new Set(state.errors.filter(Boolean)));

        return [
            h("div", { key: "error", class: "wx-restform-error-container" },
                errors.length > 0 && h("div", { class: "wx-restform-error alert alert-danger" },
                    h("p", null, this._i18n("webexpress.webapp:form.validation.errors")),
                    h("ul", null, errors.map((message) => h("li", null, String(message)))))),
            h("div", {
                key: "confirm",
                class: "wx-restform-confirm alert alert-success",
                style: { display: state.confirm ? "block" : "none" },
                html: state.confirm || ""
            }),
            h("div", {
                key: "prolog",
                class: "wx-restform-prolog-container",
                style: { display: state.prolog ? "" : "none" },
                html: state.prolog || ""
            }),
            state.deleteConfirm !== null && this._renderDeleteConfirm(state.deleteConfirm)
        ];
    }

    /**
     * Describes the delete confirmation: the item to type and the field that holds back
     * the submit until it matches.
     * @param {object} confirm The pending confirmation { item, value }.
     * @returns {object} The confirmation virtual node.
     */
    _renderDeleteConfirm(confirm) {
        const h = webexpress.webui.h;
        const typed = confirm.value.trim();
        const mismatch = typed.length > 0 && typed !== confirm.item;

        return h("div", { key: "delete", class: "wx-restform-delete-confirm" },
            h("div", {
                role: "status",
                html: this._i18n("webexpress.webapp:delete.confirmation.prompt")
                    .replace("{item}", `<strong>${this._escapeHtml(confirm.item)}</strong>`)
            }),
            h("input", {
                type: "text",
                class: "form-control",
                placeholder: confirm.item,
                autocomplete: "off",
                "aria-label": this._i18n("webexpress.webapp:delete.confirmation.input.aria-label", "Type {item} to confirm deletion.")
                    .replace("{item}", confirm.item),
                value: confirm.value,
                ref: (el) => { this._confirmInput = el; },
                on: { input: this._onConfirmInput }
            }),
            h("div", { class: "text-danger", style: { display: mismatch ? "" : "none" } },
                mismatch ? this._i18n("webexpress.webapp:delete.confirmation.mismatch") : ""));
    }

    _onConfirmInput = () => {
        const confirm = this.state.deleteConfirm;
        if (confirm !== null && this._confirmInput) {
            this.setState({ deleteConfirm: Object.assign({}, confirm, { value: this._confirmInput.value }) });
        }
    };

    /**
     * Describes the server rendered content of the body, which keeps its nodes. A field
     * that carries an error mark sits in the wrapper of the mark.
     * @param {object} state The current state.
     * @returns {Array<object>} The adopting virtual nodes.
     */
    _renderContent(state) {
        return this._bodyChildren.map((child) => webexpress.webui.Renderer.adopt(this._slotOf(child)));
    }

    /**
     * Describes a child of a form in a dialog other than its body, such as the header or
     * the footer; it keeps its node and its content.
     * @param {object} state The current state.
     * @param {HTMLElement} child The child of the form.
     * @returns {object} The adopting virtual node.
     */
    _renderHostChild(state, child) {
        return webexpress.webui.Renderer.adopt(this._slotOf(child));
    }

    /**
     * Gets the node that stands in the place of a server rendered node: the node itself,
     * or the wrapper of the error mark it carries.
     * @param {HTMLElement} node The server rendered node.
     * @returns {HTMLElement} The node to place.
     */
    _slotOf(node) {
        const marker = this._markers.get(node);
        return marker && marker.wrapper ? marker.wrapper : node;
    }

    /**
     * Follows the first render as any other.
     * @param {object} state The rendered state.
     */
    onMount(state) {
        this.onUpdate(state);
    }

    /**
     * Applies to the server rendered markup what the state says about it: the lock of
     * the fields while a request is out, the submit a delete confirmation holds back,
     * and the marks of the invalid fields.
     * @param {object} state The rendered state.
     */
    onUpdate(state) {
        this._element.classList.toggle("wx-restform-submitting", state.submitting === true);
        this._syncLock(state);
        this._syncFieldMarks(state);
    }

    /**
     * Locks the fields and buttons while a request is out. Only the elements the lock
     * disabled are enabled again, so a field the server rendered disabled stays so.
     * @param {object} state The rendered state.
     */
    _syncLock(state) {
        const elements = Array.from(this._element.elements || []);

        if (state.submitting) {
            for (const el of elements) {
                if (!el.hasAttribute("disabled")) {
                    el.setAttribute("disabled", "disabled");
                    this._locked.add(el);
                }
            }
        } else {
            for (const el of this._locked) {
                el.removeAttribute("disabled");
            }
            this._locked.clear();
        }

        const confirm = state.deleteConfirm;
        const pending = confirm !== null && confirm.value.trim() !== confirm.item;
        const gate = Array.from(this._element.querySelectorAll('[type="submit"], button[name="submit"]'))
            .find((button) => !button.hasAttribute("data-noconfirm")) || null;

        if (gate && pending && !gate.hasAttribute("disabled")) {
            gate.setAttribute("disabled", "disabled");
            this._gated = gate;
        } else if (gate && !pending && this._gated === gate && !state.submitting) {
            gate.removeAttribute("disabled");
            this._gated = null;
        }
    }

    /**
     * Marks the invalid fields and unmarks the ones that became valid. A mark wraps
     * the field beside a bar, so it is placed into the markup rather than rendered.
     * @param {object} state The rendered state.
     */
    _syncFieldMarks(state) {
        const wanted = new Map();
        for (const error of state.fieldErrors) {
            const field = typeof error.field === "string" ? this._findFieldByName(error.field) : error.field;
            if (field && field.nodeType === 1 && !wanted.has(field)) {
                wanted.set(field, error.message);
            }
        }

        for (const [field, info] of Array.from(this._markers)) {
            if (wanted.has(field)) {
                info.message = wanted.get(field);
                continue;
            }
            field.removeAttribute("aria-invalid");
            if (info.wrapper && info.wrapper.parentNode) {
                const parent = info.wrapper.parentNode;
                parent.insertBefore(field, info.wrapper);
                parent.removeChild(info.wrapper);
            } else if (!info.wrapper) {
                field.style.borderLeft = "";
            }
            this._markers.delete(field);
        }

        for (const [field, message] of wanted) {
            if (this._markers.has(field)) {
                continue;
            }

            field.setAttribute("aria-invalid", "true");

            if (field.parentNode) {
                const marker = document.createElement("div");
                marker.className = "wx-restform-field-marker";
                const wrapper = document.createElement("div");
                wrapper.className = "wx-restform-field-wrapper";
                field.parentNode.insertBefore(wrapper, field);
                wrapper.appendChild(marker);
                wrapper.appendChild(field);
                this._markers.set(field, { marker: marker, wrapper: wrapper, message: message });
            } else {
                // fallback for detached elements
                field.style.boxSizing = "border-box";
                field.style.borderLeft = "4px solid #dc3545";
                this._markers.set(field, { marker: null, wrapper: null, message: message });
            }
        }
    }

    /**
     * Displays the confirmation message inside the form.
     * @param {string|null} message The message to display. If null, uses the default confirm HTML.
     */
    _showConfirm(message) {
        const html = (typeof message === "string" && message) ? message : this._confirmHtml;
        if (html) {
            this.setState({ confirm: String(html) });
        }
    }

    /**
     * Closes the modal that contains this form, if any.
     */
    _closeEnclosingModal() {
        if (!this._element) {
            return;
        }
        const modal = this._element.closest(".modal");
        if (modal?.open) {
            modal.close();
        }
    }

    /**
     * Displays a prolog HTML string inside the form.
     * @param {string|null} prologHtml The HTML content to display.
     */
    _displayProlog(prologHtml) {
        this.setState({ prolog: prologHtml ? String(prologHtml) : null });
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
            this._focusFirstInvalid();
            return;
        }
        this.submit();
    }

    /**
     * Moves the focus to the first field the validation marked.
     */
    _focusFirstInvalid() {
        const firstInvalid = this._element.querySelector("[aria-invalid='true']");
        if (firstInvalid) {
            firstInvalid.focus();
        }
    }

    /**
     * Substitutes the named and positional placeholders of a message with the
     * supplied values, so a translated message can carry the numbers it talks
     * about. A placeholder without a value is left untouched.
     * @param {string} message The message carrying {name} placeholders.
     * @param {Object} params The values, keyed by placeholder name.
     * @returns {string} The message with the placeholders replaced.
     */
    _applyParams(message, params) {
        if (!message || !params) {
            return message || "";
        }

        return String(message).replace(/\{(\w+)\}/g, (match, name) => {
            const value = params[name];
            return (value === undefined || value === null) ? match : String(value);
        });
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

        // a control that stores its value in a hidden input (a picker, a segmented
        // choice) is barred from native constraint validation, so it declares a
        // required value through data-wx-required instead
        if (el.dataset && el.dataset.wxRequired === "true" && !String(el.value || "").trim()) {
            return el.dataset.wxRequiredMessage || this._i18n("webexpress.webapp:validation.required");
        }

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
     * Validates a list of fields and shows the result: the marks of the invalid fields
     * and the error list, or nothing when all are valid. The result is rendered before
     * the method returns, so a caller can focus the first marked field.
     * @param {Array<HTMLElement>} elements The fields to validate.
     * @returns {boolean} True if all fields are valid.
     */
    _validateFields(elements) {
        const fieldErrors = [];

        for (const el of elements) {
            const msg = this._validateField(el);
            if (msg) {
                fieldErrors.push({ field: el, message: msg });
            }
        }

        this.setState({ fieldErrors: fieldErrors, errors: fieldErrors.map((error) => error.message) });
        this._store.flush();

        return fieldErrors.length === 0;
    }

    /**
     * Validates the form using native HTML5 validity and extra rules.
     * @returns {boolean} True if valid, false otherwise.
     */
    validate() {
        return this._validateFields(Array.from(this._element.elements || []).filter((el) => {
            return el.name && !el.disabled && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
        }));
    }

    /**
     * Returns what a submit would send, without sending it.
     *
     * A surface that writes the same fields somewhere else - the document form saves the
     * unpublished draft while the author types - has to send the shape the publish sends, or
     * the endpoint behind it reads two contracts instead of one. Reading the form a second time
     * would let the two drift apart on the next controlled input, so the payload is built here,
     * once, for both.
     * @returns {Object} The payload a submit would send.
     */
    serialize() {
        return this._buildPayload();
    }

    /**
     * Builds a plain JavaScript object representing the form payload.
     * @returns {Object} Payload object.
     */
    _buildPayload() {
        const data = {};
        const elements = Array.from(this._element.elements || []).filter((el) => {
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
            const result = await this._transport().request(url, init);
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
     * Gets what carries the requests of the form: its data service, or - for a form
     * authored without one, which posts to its action - the shared route of the service
     * layer for one-off requests.
     * @returns {object} An object with a request(url, init) method.
     */
    _transport() {
        return this._service || webexpress.webapp.ServiceRegistry;
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
     * restFormModel. A system error is thrown so the submit caller reports it
     * through its catch.
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

            // the endpoint travels with the event so a surface that reads the same
            // service can tell that its data changed and reload; without it a
            // listener cannot distinguish a write to its own service from any other
            this._dispatch(webexpress.webui.Event.UPLOAD_SUCCESS_EVENT, { response: json, status: result.status, form: this._element, endpoint: this.options.api });
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
            const fieldErrors = [];
            const messages = [];
            for (const e of (classification.errors || [])) {
                if (e.field) {
                    fieldErrors.push({ field: String(e.field), message: e.message });
                }
                messages.push(e.message);
            }

            if (messages.length === 0) {
                const fallback = classification.message || this._i18n("webexpress.webapp:validation.failed");
                messages.push(typeof fallback === "object" ? JSON.stringify(fallback) : fallback);
            }

            this.setState({ fieldErrors: fieldErrors, errors: messages });

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
     * Sets the submitting state of the form, which locks the fields while a request is
     * out.
     * @param {boolean} state True to activate submitting mode; false to restore interactivity.
     */
    _setSubmitting(state) {
        this._submitting = !!state;
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
     * Marks a field as invalid, next to the marks already shown.
     * @param {HTMLElement|string} field The form field, or the name the server reported.
     * @param {string} message The error message associated with the field.
     */
    _showFieldError(field, message) {
        if (!field) {
            return;
        }

        const others = this.state.fieldErrors.filter((error) => error.field !== field);
        this.setState({ fieldErrors: others.concat([{ field: field, message: message }]) });
    }

    /**
     * Shows the form-level error list.
     * @param {Array<string>} messages The error messages to display.
     */
    _displayAggregatedErrors(messages) {
        if (!Array.isArray(messages) || messages.length === 0) {
            return;
        }

        this.setState({ errors: messages.filter(Boolean).map(String) });
    }

    /**
     * Clear all markers and remove the form-level error list.
     */
    clearErrors() {
        this.setState({ errors: [], fieldErrors: [] });
        this._store.flush();
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
     * Asks for the name of the item before a deletion: the submit stays held back
     * until the typed text matches it.
     * @param {string|null} confirmItem The required text for enabling submit.
     */
    _displayDeletePrompt(confirmItem) {
        this.setState({ deleteConfirm: confirmItem ? { item: String(confirmItem), value: "" } : null });
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
