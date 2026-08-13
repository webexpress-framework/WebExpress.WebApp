/**
 * REST wizard controller based on RestFormCtrl.
 * Transforms a standard HTML form into a multi-step wizard.
 * Supports static and dynamically loaded steps via AJAX.
 * Handles validation, server-side skipping via 204 No Content, caching, and final submission.
 */
webexpress.webapp.RestWizardCtrl = class extends webexpress.webapp.RestFormCtrl {

    /**
     * Create a new RestWizardCtrl instance.
     * @param {HTMLFormElement} element - The form element to enhance.
     */
    constructor(element) {
        super(element);
    }

    // wizard step state accessors backed by the store inherited from the form
    // control, so the single source of truth is the store

    get _currentIndex() { return this._store.getState().currentIndex || 0; }
    set _currentIndex(value) { this._store.setState({ currentIndex: value }); }

    get _wizardLoading() { return this._store.getState().wizardLoading || false; }
    set _wizardLoading(value) { this._store.setState({ wizardLoading: value }); }

    /**
     * Initialize the wizard, parse pages and build the layout.
     * Overrides the base _init method.
     */
    _init() {
        // Guard against multiple initializations by the framework
        if (this._element.dataset.wxRestwizardInit === "true") {
            return;
        }
        this._element.dataset.wxRestwizardInit = "true";

        this._pages = [];
        this._currentIndex = 0;
        this._wizardLoading = false;

        this._finishLabel = this._element.dataset.finishLabel || null;
        this._finishIcon = this._element.dataset.finishIcon || null;

        // call base class initialization
        super._init();

        this._discoverPages();
        this._buildWizardLayout();

        // a step summary changes with the choice the user makes in it, so the
        // chrome is re-rendered whenever any control reports a new value
        this._element.addEventListener(webexpress.webui.Event.CHANGE_VALUE_EVENT, () => this._renderChrome());
        this._element.addEventListener("change", () => this._renderChrome());

        // start wizard at the first step
        this._renderState();
    }

    /**
     * Parses the DOM for wizard pages and initializes the internal state array.
     */
    _discoverPages() {
        const pageElements = Array.from(this._element.querySelectorAll(".wx-wizard-page"));

        for (let i = 0; i < pageElements.length; i++) {
            const el = pageElements[i];
            this._pages.push({
                index: i,
                element: el,
                title: el.getAttribute("data-title") || `Step ${i + 1}`,
                subtitle: el.getAttribute("data-subtitle") || null,
                summarySource: el.getAttribute("data-summary-source") || null,
                uri: el.getAttribute("data-uri") || null,
                isLoaded: !el.hasAttribute("data-uri"),
                skipped: false,
                hasError: false,
                payloadHash: null
            });
        }
    }

    /**
     * Builds the surrounding UI layout for the wizard including progress bar and buttons.
     */
    _buildWizardLayout() {
        const root = document.createElement("div");
        root.className = "wx-restwizard-root";

        const container = this._element.querySelector(".modal-body") || this._element;

        // extract non-page elements to keep them in the form
        const staticElements = Array.from(container.children).filter((child) => {
            if (child === this._formErrorContainer || child === this._confirmContainer || child === this._formPrologContainer) {
                return false;
            }
            if (child.classList && child.classList.contains("wx-wizard-page")) {
                return false;
            }
            if (child.tagName === "CONFIRM") {
                return false;
            }
            // Prevent nesting if a root container somehow already exists
            if (child.classList && child.classList.contains("wx-restwizard-root")) {
                return false;
            }
            return true;
        });

        // create static container
        const staticContainer = document.createElement("div");
        staticContainer.className = "wx-restwizard-static-container mb-3";
        for (let i = 0; i < staticElements.length; i++) {
            staticContainer.appendChild(staticElements[i]);
        }
        root.appendChild(staticContainer);

        // progress indicator, laid out as the shared step indicator so a wizard
        // header reads like every other stepper in the application
        this._wizardProgressContainer = document.createElement("div");
        this._wizardProgressContainer.className = "wx-restwizard-progress wx-steps wx-steps-inline";
        root.appendChild(this._wizardProgressContainer);

        // pages container
        this._pagesContainer = document.createElement("div");
        this._pagesContainer.className = "wx-restwizard-pages-container";

        for (let i = 0; i < this._pages.length; i++) {
            this._pagesContainer.appendChild(this._pages[i].element);
        }
        root.appendChild(this._pagesContainer);

        const modalFooter = this._element.querySelector(".modal-footer");

        // action buttons
        this._btnPrev = document.createElement("button");
        this._btnPrev.type = "button";
        this._btnPrev.className = "btn btn-link wx-restwizard-prev";
        this._btnPrev.innerHTML =
            `<i class="${this._iconClass("fas fa-chevron-left", "wx-icon-light-chevron-left")} me-2"></i>` +
            this._escapeHtml(this._i18n("webexpress.webapp:wizard.previous") || "Previous");
        this._btnPrev.addEventListener("click", () => {
            this._navigate(-1);
        });

        // the position among the active steps, so the user knows how far the
        // dialog still goes
        this._stepCounter = document.createElement("span");
        this._stepCounter.className = "wx-restwizard-counter";

        this._btnNext = document.createElement("button");
        this._btnNext.type = "button";
        this._btnNext.className = "btn btn-primary wx-restwizard-next";
        this._btnNext.innerHTML =
            this._escapeHtml(this._i18n("webexpress.webapp:wizard.next") || "Next") +
            `<i class="${this._iconClass("fas fa-chevron-right", "wx-icon-light-chevron-right")} ms-2"></i>`;
        this._btnNext.addEventListener("click", () => {
            this._navigate(1);
        });

        this._btnFinish = document.createElement("button");
        this._btnFinish.type = "submit";
        this._btnFinish.className = "btn btn-primary wx-restwizard-finish";
        this._btnFinish.innerHTML =
            (this._finishIcon ? `<i class="${this._finishIcon} me-2"></i>` : "") +
            this._escapeHtml(this._finishLabel || this._i18n("webexpress.webapp:wizard.finish") || "Finish");

        const navGroup = document.createElement("div");
        navGroup.className = "wx-restwizard-nav d-flex align-items-center gap-2 me-auto";
        navGroup.appendChild(this._btnPrev);
        navGroup.appendChild(this._stepCounter);

        if (modalFooter) {
            // hide original submit button
            const existingSubmit = modalFooter.querySelector('[type="submit"], button[name="submit"]');
            if (existingSubmit) {
                existingSubmit.style.display = "none";
            }

            modalFooter.insertBefore(navGroup, modalFooter.firstChild);

            modalFooter.appendChild(this._btnNext);
            modalFooter.appendChild(this._btnFinish);
        } else {
            const actionsContainer = document.createElement("div");
            actionsContainer.className = "wx-restwizard-actions d-flex gap-2 justify-content-between";

            const rightGroup = document.createElement("div");
            rightGroup.className = "d-flex gap-2";

            rightGroup.appendChild(this._btnNext);
            rightGroup.appendChild(this._btnFinish);

            actionsContainer.appendChild(navGroup);
            actionsContainer.appendChild(rightGroup);
            root.appendChild(actionsContainer);
        }

        container.appendChild(root);
    }

    /**
     * Determines the next target step and initiates loading if necessary.
     * @param {number} stepOffset - The direction to move (1 for next, -1 for previous).
     */
    async _navigate(stepOffset) {
        if (this._wizardLoading || this._submitting) {
            return;
        }

        if (stepOffset > 0) {
            if (!this.validateCurrentPage()) {
                return;
            }
        }

        let nextIndex = this._currentIndex + stepOffset;
        let targetFound = false;

        // search for the next active step by evaluating skips
        while (nextIndex >= 0 && nextIndex < this._pages.length) {
            const page = this._pages[nextIndex];

            // if we go backwards and a step was skipped, we continue going back
            if (stepOffset < 0 && page.skipped) {
                nextIndex += stepOffset;
                continue;
            }

            // check if dynamic page needs loading or validation
            if (page.uri) {
                const payloadStr = JSON.stringify(this._buildPayload());

                // check cache: if already loaded successfully and payload did not change
                if (webexpress.webapp.restWizardModel.shouldUseCache(page, payloadStr)) {
                    targetFound = true;
                    break;
                }

                const status = await this._loadDynamicPage(page, payloadStr);

                if (status === 204) {
                    // mark as skipped and continue moving in the same direction
                    page.skipped = true;
                    nextIndex += stepOffset;
                    continue;
                } else if (status === 200) {
                    page.skipped = false;
                    page.payloadHash = payloadStr;
                    targetFound = true;
                    break;
                } else {
                    // loading failed, navigate to this step to show the error
                    page.skipped = false;
                    targetFound = true;
                    break;
                }
            } else {
                // static page
                if (stepOffset > 0) {
                    page.skipped = false;
                }
                targetFound = true;
                break;
            }
        }

        if (targetFound) {
            this._currentIndex = nextIndex;
            this._renderState();
        }
    }

    /**
     * Moves directly to a step the user has already passed. Steps ahead of the
     * current one stay out of reach, because they may not have been validated yet.
     * @param {number} index - The index of the step to go to.
     */
    _goTo(index) {
        if (this._wizardLoading || this._submitting) {
            return;
        }
        if (index < 0 || index >= this._currentIndex || this._pages[index].skipped) {
            return;
        }

        this._currentIndex = index;
        this._renderState();
    }

    /**
     * Asynchronously loads a dynamic step from the server.
     * @param {Object} page - The page object to load.
     * @param {string} payloadStr - The serialized form payload to send.
     * @returns {Promise<number>} The HTTP status code.
     */
    async _loadDynamicPage(page, payloadStr) {
        this._setWizardLoading(true);
        page.hasError = false;

        // render a placeholder while loading
        page.element.innerHTML = `
            <div class="d-flex justify-content-center py-4">
                <div class="spinner-border text-secondary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
            </div>
        `;

        // temporarily show it if we are switching to it directly
        if (this._currentIndex !== page.index) {
            for (let i = 0; i < this._pages.length; i++) {
                this._pages[i].element.style.display = "none";
            }
        }
        page.element.style.display = "block";

        const result = await this._service.request(
            page.uri, webexpress.webapp.restWizardModel.buildStepRequestInit(payloadStr));

        // a 204 No Content signals that the step is skipped
        if (result.status === 204) {
            this._setWizardLoading(false);
            return 204;
        }

        // any failure (http or network) renders the step error and stops here
        if (!result.ok) {
            const message = this._i18n("webexpress.webapp:error.load_failed") ||
                (result.error && result.error.message) ||
                `Failed to load the step (HTTP ${result.status})`;
            page.hasError = true;
            page.element.innerHTML = `<div class="alert alert-danger wx-restwizard-page-error my-3">${message}</div>`;
            this._setWizardLoading(false);
            return 500;
        }

        // the step content is delivered as html text (parsed by the service)
        const html = (result.data && typeof result.data.text === "string") ? result.data.text : "";
        this._injectHtml(page.element, html);
        page.isLoaded = true;
        this._setWizardLoading(false);

        return 200;
    }

    /**
     * Injects HTML safely and executes embedded scripts.
     * @param {HTMLElement} container - The element to inject the HTML into.
     * @param {string} html - The raw HTML string.
     */
    _injectHtml(container, html) {
        container.innerHTML = "";

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const fragment = document.createDocumentFragment();
        const scripts = [];

        while (doc.body.firstChild) {
            const node = doc.body.firstChild;
            if (node.tagName === "SCRIPT") {
                scripts.push(node);
                doc.body.removeChild(node);
            } else {
                fragment.appendChild(node);
            }
        }

        container.appendChild(fragment);

        // execute extracted scripts
        for (let i = 0; i < scripts.length; i++) {
            const oldScript = scripts[i];
            const newScript = document.createElement("script");

            Array.from(oldScript.attributes).forEach((attr) => {
                newScript.setAttribute(attr.name, attr.value);
            });
            newScript.textContent = oldScript.textContent;
            container.appendChild(newScript);
        }
    }

    /**
     * Reads back what the user chose on a step, so the progress indicator can show
     * the answer in place of the question. The value is resolved to the label of the
     * control that carries it — a tile, an option of a segmented choice or of a
     * select — and falls back to the raw value.
     * @param {Object} page - The page to summarise.
     * @returns {string|null} The label of the choice, or null when the step is open.
     */
    _resolveSummary(page) {
        if (!page.summarySource) {
            return null;
        }

        const input = this._element.querySelector(`[name="${page.summarySource}"]`);
        if (!input) {
            return null;
        }

        // a control is registered against its root element, not against the hidden
        // input it submits through, so the lookup walks up from the input
        const ctrl = webexpress.webui.Controller.getClosestInstance(input);
        const value = ((ctrl && typeof ctrl.value !== "undefined") ? ctrl.value : input.value) || "";
        if (!value) {
            return null;
        }

        const escaped = (window.CSS && CSS.escape) ? CSS.escape(value) : value.replace(/"/g, '\\"');

        const card = page.element.querySelector(`[data-tile-id="${escaped}"]`);
        if (card) {
            const title = card.querySelector(".card-title");
            return (title ? title.textContent : card.textContent).trim();
        }

        const option = page.element.querySelector(`[data-value="${escaped}"]`);
        if (option) {
            return option.textContent.trim();
        }

        if (input.tagName === "SELECT" && input.selectedOptions.length) {
            return input.selectedOptions[0].textContent.trim();
        }

        return value;
    }

    /**
     * Rebuilds the progress indicator and the step counter. Called both on
     * navigation and whenever a control reports a new value, so the header follows
     * the choice as it is made rather than only when the step is left.
     */
    _renderChrome() {
        this._renderProgress();
        this._renderCounter();
    }

    /**
     * Rebuilds the step indicator in the header.
     */
    _renderProgress() {
        if (!this._wizardProgressContainer) {
            return;
        }

        this._wizardProgressContainer.innerHTML = "";

        let number = 0;

        for (let i = 0; i < this._pages.length; i++) {
            const page = this._pages[i];

            if (page.skipped) {
                continue;
            }

            number++;

            const state = webexpress.webapp.restWizardModel.stateOf(i, this._currentIndex);
            const summary = this._resolveSummary(page);
            const description = summary || page.subtitle;

            const item = document.createElement("div");
            item.className = `wx-steps-item wx-steps-item-${state}`;

            const marker = document.createElement("span");
            marker.className = "wx-steps-marker";
            marker.textContent = state === "completed" ? "✓" : String(number);
            item.appendChild(marker);

            const text = document.createElement("div");
            text.className = "wx-steps-text";

            const label = document.createElement("span");
            label.className = "wx-steps-label";
            label.textContent = page.title;
            text.appendChild(label);

            if (description) {
                const hint = document.createElement("span");
                hint.className = "wx-steps-description";
                hint.textContent = description;
                hint.title = description;
                text.appendChild(hint);
            }

            item.appendChild(text);

            // a step already passed can be returned to by clicking it
            if (state === "completed") {
                item.classList.add("wx-steps-item-clickable");
                item.setAttribute("role", "button");
                item.tabIndex = 0;
                item.addEventListener("click", () => this._goTo(i));
                item.addEventListener("keyup", (e) => {
                    if (e.key === " " || e.key === "Enter") {
                        this._goTo(i);
                    }
                });
            }

            this._wizardProgressContainer.appendChild(item);
        }
    }

    /**
     * Updates the step counter in the footer.
     */
    _renderCounter() {
        if (!this._stepCounter) {
            return;
        }

        const position = webexpress.webapp.restWizardModel.describePosition(this._pages, this._currentIndex);

        this._stepCounter.textContent = this._applyParams(
            this._i18n("webexpress.webapp:wizard.step") || "Step {0} of {1}",
            { 0: position.position, 1: position.total }
        );
    }

    /**
     * Updates the user interface based on the current wizard state.
     */
    _renderState() {
        this._renderChrome();

        // toggle page visibility
        for (let i = 0; i < this._pages.length; i++) {
            const page = this._pages[i];

            if (i === this._currentIndex) {
                page.element.style.display = "block";
                page.element.setAttribute("aria-hidden", "false");
            } else {
                page.element.style.display = "none";
                page.element.setAttribute("aria-hidden", "true");
            }
        }

        // prev button is visible if we are not on the first page
        if (this._btnPrev) {
            this._btnPrev.style.display = this._currentIndex > 0 ? "" : "none";
        }

        // determine if current page is the last non-skipped page
        const isLast = webexpress.webapp.restWizardModel.isLastPage(this._pages, this._currentIndex);

        if (this._btnNext && this._btnFinish) {
            if (isLast) {
                this._btnNext.style.display = "none";
                this._btnFinish.style.display = "";
            } else {
                this._btnNext.style.display = "";
                this._btnFinish.style.display = "none";
            }
        }
    }

    /**
     * Validates all input elements within the current page.
     * @returns {boolean} True if the page is valid.
     */
    validateCurrentPage() {
        this.clearErrors();

        const page = this._pages[this._currentIndex];

        if (page.hasError) {
            return false;
        }

        let pageIsValid = true;
        const messages = [];
        const elements = Array.from(page.element.querySelectorAll("input, textarea, select")).filter((el) => {
            return el.name && !el.disabled;
        });

        for (let i = 0; i < elements.length; i++) {
            const el = elements[i];
            // use inherited validation method from RestFormCtrl
            const msg = this._validateField(el);

            if (msg) {
                pageIsValid = false;
                this._showFieldError(el, msg);
                messages.push(msg);
            }
        }

        if (!pageIsValid) {
            this._displayAggregatedErrors(messages);
        }

        return pageIsValid;
    }

    /**
     * Overrides the base validation to check the entire wizard form.
     * Validates all active (non-skipped) pages and forces navigation to the first invalid page.
     * @returns {boolean} True if valid.
     */
    validate() {
        this.clearErrors();

        let formIsValid = true;
        let firstInvalidIndex = -1;
        const messages = [];

        for (let i = 0; i < this._pages.length; i++) {
            const page = this._pages[i];

            if (page.skipped) {
                continue;
            }

            if (page.hasError) {
                if (firstInvalidIndex === -1) {
                    firstInvalidIndex = i;
                }
                formIsValid = false;
                continue;
            }

            const elements = Array.from(page.element.querySelectorAll("input, textarea, select")).filter((el) => {
                return el.name && !el.disabled;
            });

            for (let j = 0; j < elements.length; j++) {
                const el = elements[j];
                const msg = this._validateField(el);

                if (msg) {
                    formIsValid = false;
                    this._showFieldError(el, msg);
                    messages.push(msg);

                    if (firstInvalidIndex === -1) {
                        firstInvalidIndex = i;
                    }
                }
            }
        }

        if (!formIsValid) {
            if (firstInvalidIndex !== -1 && firstInvalidIndex !== this._currentIndex) {
                this._currentIndex = firstInvalidIndex;
                this._renderState();
            }
            this._displayAggregatedErrors(messages);
        }

        return formIsValid;
    }

    /**
     * Handle the form submit event.
     * @param {Event} ev The submit event.
     */
    _onSubmit(ev) {
        ev.preventDefault();
        ev.stopImmediatePropagation();

        if (this._submitting || this._wizardLoading) {
            return;
        }

        if (this.options.validateOnSubmit && !this.validate()) {
            const firstInvalid = this._element.querySelector("[aria-invalid='true']");
            if (firstInvalid) {
                firstInvalid.focus();
            }
            return;
        }

        // delegate to base class submit method for final REST request
        this.submit();
    }

    /**
     * Overrides base class to also disable wizard-specific buttons.
     * @param {boolean} state True to activate submitting mode.
     */
    _setSubmitting(state) {
        super._setSubmitting(state);

        if (this._btnPrev) this._btnPrev.disabled = state;
        if (this._btnNext) this._btnNext.disabled = state;
        if (this._btnFinish) this._btnFinish.disabled = state;
    }

    /**
     * Disables interaction while dynamic steps are loading.
     * @param {boolean} state True when loading.
     */
    _setWizardLoading(state) {
        this._wizardLoading = !!state;

        if (this._btnPrev) this._btnPrev.disabled = state;
        if (this._btnNext) this._btnNext.disabled = state;
        if (this._btnFinish) this._btnFinish.disabled = state;
    }
};

// register the class in the controller
webexpress.webui.Controller.registerClass("wx-webapp-restwizard", webexpress.webapp.RestWizardCtrl);
