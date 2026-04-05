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

        // call base class initialization
        super._init();

        this._discoverPages();
        this._buildWizardLayout();
        
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

        // extract non-page elements to keep them in the form
        const staticElements = Array.from(this._element.children).filter((child) => {
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

        // progress indicator
        this._wizardProgressContainer = document.createElement("div");
        this._wizardProgressContainer.className = "wx-restwizard-progress d-flex justify-content-between mb-4";
        root.appendChild(this._wizardProgressContainer);

        // pages container
        this._pagesContainer = document.createElement("div");
        this._pagesContainer.className = "wx-restwizard-pages-container mb-4";
        
        for (let i = 0; i < this._pages.length; i++) {
            this._pagesContainer.appendChild(this._pages[i].element);
        }
        root.appendChild(this._pagesContainer);

        // action buttons
        const actionsContainer = document.createElement("div");
        actionsContainer.className = "wx-restwizard-actions d-flex gap-2 justify-content-between";

        const leftGroup = document.createElement("div");
        const rightGroup = document.createElement("div");
        rightGroup.className = "d-flex gap-2";

        this._btnPrev = document.createElement("button");
        this._btnPrev.type = "button";
        this._btnPrev.className = "btn btn-outline-secondary";
        this._btnPrev.textContent = this._i18n("webexpress.webapp:wizard.previous") || "Zurück";
        this._btnPrev.addEventListener("click", () => {
            this._navigate(-1);
        });

        this._btnNext = document.createElement("button");
        this._btnNext.type = "button";
        this._btnNext.className = "btn btn-primary";
        this._btnNext.textContent = this._i18n("webexpress.webapp:wizard.next") || "Weiter";
        this._btnNext.addEventListener("click", () => {
            this._navigate(1);
        });

        this._btnFinish = document.createElement("button");
        this._btnFinish.type = "submit";
        this._btnFinish.className = "btn btn-success";
        this._btnFinish.textContent = this._i18n("webexpress.webapp:wizard.finish") || "Abschließen";

        leftGroup.appendChild(this._btnPrev);
        rightGroup.appendChild(this._btnNext);
        rightGroup.appendChild(this._btnFinish);

        actionsContainer.appendChild(leftGroup);
        actionsContainer.appendChild(rightGroup);
        root.appendChild(actionsContainer);

        this._element.appendChild(root);
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
                if (page.isLoaded && page.payloadHash === payloadStr && !page.hasError) {
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

        try {
            const response = await fetch(page.uri, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json; charset=utf-8",
                    "Accept": "text/html"
                },
                body: payloadStr
            });

            if (response.status === 204) {
                this._setWizardLoading(false);
                return 204;
            }

            if (!response.ok) {
                throw new Error(this._i18n("webexpress.webapp:error.load_failed") || `Fehler beim Laden des Schritts (HTTP ${response.status})`);
            }

            const html = await response.text();
            this._injectHtml(page.element, html);
            page.isLoaded = true;
            this._setWizardLoading(false);
            
            return 200;

        } catch (error) {
            page.hasError = true;
            page.element.innerHTML = `<div class="alert alert-danger wx-restwizard-page-error my-3">${error.message}</div>`;
            this._setWizardLoading(false);
            return 500;
        }
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
     * Updates the user interface based on the current wizard state.
     */
    _renderState() {
        if (!this._wizardProgressContainer) {
            return;
        }
        this._wizardProgressContainer.innerHTML = "";

        // evaluate visibility of buttons and progress
        for (let i = 0; i < this._pages.length; i++) {
            const page = this._pages[i];
            
            // build progress step for active/non-skipped pages
            if (!page.skipped) {
                const stepEl = document.createElement("div");
                stepEl.className = "flex-fill text-center p-2 border-bottom";
                
                if (i === this._currentIndex) {
                    stepEl.classList.add("border-primary", "fw-bold", "text-primary");
                    stepEl.style.borderBottomWidth = "3px";
                } else if (i < this._currentIndex) {
                    stepEl.classList.add("text-success");
                } else {
                    stepEl.classList.add("text-muted");
                }
                
                stepEl.textContent = page.title;
                this._wizardProgressContainer.appendChild(stepEl);
            }

            // toggle page visibility
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
            this._btnPrev.style.display = this._currentIndex > 0 ? "block" : "none";
        }
        
        // determine if current page is the last non-skipped page
        let isLastPage = true;
        for (let j = this._currentIndex + 1; j < this._pages.length; j++) {
            if (!this._pages[j].skipped) {
                isLastPage = false;
                break;
            }
        }

        if (this._btnNext && this._btnFinish) {
            if (isLastPage) {
                this._btnNext.style.display = "none";
                this._btnFinish.style.display = "block";
            } else {
                this._btnNext.style.display = "block";
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