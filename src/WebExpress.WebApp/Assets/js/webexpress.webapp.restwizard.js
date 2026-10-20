/**
 * REST wizard controller based on RestFormCtrl.
 * Transforms a standard HTML form into a multi-step wizard.
 * Supports static and dynamically loaded steps via AJAX.
 * Handles validation, server-side skipping via 204 No Content, caching, and final submission.
 *
 * The steps are state: which one is shown, which were skipped, failed or loaded, and what
 * the user chose on each. The step indicator, the step counter and the navigation are
 * rendered from it; the pages keep the content the server rendered or delivered and are
 * only shown and hidden. In a dialog the navigation joins the footer the dialog already
 * has, ahead of its dismiss button.
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
     * Gets the steps, in their order.
     * @returns {Array<object>} The step models.
     */
    get _pages() {
        return this._store.getState().pages || [];
    }

    /**
     * Reads the wizard on top of the form: its pages, the content that stays above
     * them, and the footer a dialog gives it.
     * @returns {boolean} False when the form already carries a wizard.
     */
    _init() {
        // Guard against multiple initializations by the framework
        if (this._element.dataset.wxRestwizardInit === "true") {
            return false;
        }
        this._element.dataset.wxRestwizardInit = "true";

        this._finishLabel = this._element.dataset.finishLabel || null;
        this._finishIcon = this._element.dataset.finishIcon || null;

        // call base class initialization
        super._init();

        this._pageElements = Array.from(this._element.querySelectorAll(".wx-wizard-page"));

        // the content beside the pages stays above them
        this._staticElements = this._bodyChildren.filter((child) => !child.classList.contains("wx-wizard-page"));

        this._footer = this._hostChildren.find((child) => child !== this._body && child.classList.contains("modal-footer")) || null;
        this._footerChildren = this._footer
            ? Array.from(this._footer.childNodes).filter((child) => child.nodeType === 1)
            : [];

        this.setState({
            currentIndex: 0,
            wizardLoading: false,
            // the step whose dynamic content is being loaded, shown while it loads
            loadingIndex: null,
            pages: this._pageElements.map((el, i) => ({
                index: i,
                title: el.getAttribute("data-title") || `Step ${i + 1}`,
                subtitle: el.getAttribute("data-subtitle") || null,
                summarySource: el.getAttribute("data-summary-source") || null,
                uri: el.getAttribute("data-uri") || null,
                isLoaded: !el.hasAttribute("data-uri"),
                skipped: false,
                hasError: false,
                payloadHash: null
            })),
            // what the user chose on each step, read back for the step indicator
            summaries: this._pageElements.map(() => null)
        });

        // a step summary changes with the choice the user makes in it, so it is read
        // again whenever any control reports a new value
        this._element.addEventListener(webexpress.webui.Event.CHANGE_VALUE_EVENT, () => this._refreshSummaries());
        this._element.addEventListener("change", () => this._refreshSummaries());

        return true;
    }

    /**
     * Describes the wizard below the banners: the content that stays above the pages,
     * the step indicator, the pages and - outside a dialog - the navigation.
     * @param {object} state The current state.
     * @returns {object} The wizard virtual node.
     */
    _renderContent(state) {
        const h = webexpress.webui.h;
        const adopt = webexpress.webui.Renderer.adopt;
        const shown = state.loadingIndex !== null ? state.loadingIndex : state.currentIndex;

        return h("div", { key: "wizard", class: "wx-restwizard-root" },
            h("div", { key: "static", class: "wx-restwizard-static-container mb-3" },
                this._staticElements.map((el) => adopt(this._slotOf(el)))),
            this._renderProgress(state),
            h("div", { key: "pages", class: "wx-restwizard-pages-container" },
                this._pageElements.map((el, i) => adopt(el, {
                    style: { display: i === shown ? "block" : "none" },
                    "aria-hidden": i === shown ? "false" : "true"
                }))),
            this._footer === null && h("div", { key: "actions", class: "wx-restwizard-actions d-flex gap-2 justify-content-between" },
                this._renderNav(state),
                h("div", { class: "d-flex gap-2" }, this._renderNext(state), this._renderFinish(state))));
    }

    /**
     * Describes the footer of a dialog with the navigation added: back and the counter
     * lead it, the primary actions go ahead of the dismiss button - the order every other
     * dialog gets from ControlModalForm - and the form's own submit button is hidden.
     * @param {object} state The current state.
     * @param {HTMLElement} child The child of the form.
     * @returns {object} The adopting virtual node.
     */
    _renderHostChild(state, child) {
        if (child !== this._footer) {
            return super._renderHostChild(state, child);
        }

        const adopt = webexpress.webui.Renderer.adopt;
        const dismiss = this._footerChildren.find((el) => el.getAttribute("data-wx-dismiss") === "modal") || null;
        const submit = this._footerChildren.find((el) => el.matches('[type="submit"], button[name="submit"]')) || null;
        const children = [this._renderNav(state)];

        for (const el of this._footerChildren) {
            if (el === dismiss) {
                children.push(this._renderNext(state), this._renderFinish(state));
            }
            children.push(el === submit ? adopt(el, { style: { display: "none" } }) : adopt(el));
        }
        if (dismiss === null) {
            // a footer without a dismiss button receives the primary actions at its end
            children.push(this._renderNext(state), this._renderFinish(state));
        }

        return adopt(child, null, children);
    }

    /**
     * Describes back and the step counter.
     * @param {object} state The current state.
     * @returns {object} The navigation virtual node.
     */
    _renderNav(state) {
        const h = webexpress.webui.h;
        const position = webexpress.webapp.restWizardModel.describePosition(state.pages, state.currentIndex);

        return h("div", { key: "nav", class: "wx-restwizard-nav d-flex align-items-center gap-2 me-auto" },
            h("button", {
                key: "prev",
                type: "button",
                class: "btn btn-link wx-restwizard-prev",
                style: { display: state.currentIndex > 0 ? "" : "none" },
                disabled: this._busy(state),
                on: { click: this._handler("navigate", "back", () => () => this._navigate(-1)) }
            }, h("i", { class: this._iconClass("chevron-left") + " me-2" }), this._i18n("webexpress.webapp:wizard.previous") || "Previous"),
            // the position among the active steps, so the user knows how far the
            // dialog still goes
            h("span", { key: "counter", class: "wx-restwizard-counter" }, this._applyParams(
                this._i18n("webexpress.webapp:wizard.step") || "Step {0} of {1}",
                { 0: position.position, 1: position.total })));
    }

    /**
     * Describes the button to the next step, shown until the last active step.
     * @param {object} state The current state.
     * @returns {object} The button virtual node.
     */
    _renderNext(state) {
        const isLast = webexpress.webapp.restWizardModel.isLastPage(state.pages, state.currentIndex);

        return webexpress.webui.h("button", {
            key: "next",
            type: "button",
            class: "btn btn-primary wx-restwizard-next",
            style: { display: isLast ? "none" : "" },
            disabled: this._busy(state),
            on: { click: this._handler("navigate", "next", () => () => this._navigate(1)) }
        }, this._i18n("webexpress.webapp:wizard.next") || "Next", webexpress.webui.h("i", { class: this._iconClass("chevron-right") + " ms-2" }));
    }

    /**
     * Describes the button that submits the wizard, shown on the last active step.
     * @param {object} state The current state.
     * @returns {object} The button virtual node.
     */
    _renderFinish(state) {
        const isLast = webexpress.webapp.restWizardModel.isLastPage(state.pages, state.currentIndex);

        return webexpress.webui.h("button", {
            key: "finish",
            type: "submit",
            class: "btn btn-primary wx-restwizard-finish",
            style: { display: isLast ? "" : "none" },
            disabled: this._busy(state)
        }, this._finishIcon && webexpress.webui.h("i", { class: this._finishIcon + " me-2" }),
            this._finishLabel || this._i18n("webexpress.webapp:wizard.finish") || "Finish");
    }

    /**
     * Tells whether the wizard refuses to move: while it submits or loads a step.
     * @param {object} state The current state.
     * @returns {boolean} True while busy.
     */
    _busy(state) {
        return state.submitting === true || state.wizardLoading === true;
    }

    /**
     * Describes the step indicator, laid out as the shared step indicator so a wizard
     * header reads like every other stepper in the application. A step shows the choice
     * made on it in place of its subtitle, and a step already passed can be clicked to
     * return to it.
     * @param {object} state The current state.
     * @returns {object} The indicator virtual node.
     */
    _renderProgress(state) {
        const h = webexpress.webui.h;
        let number = 0;

        return h("div", { key: "progress", class: "wx-restwizard-progress wx-steps wx-steps-inline" },
            state.pages.map((page, i) => {
                if (page.skipped) {
                    return null;
                }
                number++;

                const step = webexpress.webapp.restWizardModel.stateOf(i, state.currentIndex);
                const completed = step === "completed";
                const description = state.summaries[i] || page.subtitle;

                return h("div", {
                    key: "step-" + i,
                    class: ["wx-steps-item", "wx-steps-item-" + step, completed && "wx-steps-item-clickable"],
                    role: completed ? "button" : null,
                    tabindex: completed ? "0" : null,
                    on: completed ? {
                        click: this._handler("goto", String(i), () => () => this._goTo(i)),
                        keyup: this._handler("goto-key", String(i), () => (e) => {
                            if (e.key === " " || e.key === "Enter") {
                                this._goTo(i);
                            }
                        })
                    } : {}
                },
                    h("span", { class: "wx-steps-marker" }, completed ? "✓" : String(number)),
                    h("div", { class: "wx-steps-text" },
                        h("span", { class: "wx-steps-label" }, page.title),
                        description && h("span", { class: "wx-steps-description", title: description }, description)));
            }));
    }

    /**
     * Changes fields of one step model.
     * @param {number} index - The step index.
     * @param {object} fields - The changed fields.
     */
    _patchPage(index, fields) {
        this.setState({ pages: this._pages.map((page, i) => i === index ? Object.assign({}, page, fields) : page) });
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
                this._focusFirstInvalid();
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

                const status = await this._loadDynamicPage(nextIndex, payloadStr);

                if (status === 204) {
                    // mark as skipped and continue moving in the same direction
                    this._patchPage(nextIndex, { skipped: true });
                    nextIndex += stepOffset;
                    continue;
                } else if (status === 200) {
                    this._patchPage(nextIndex, { skipped: false, payloadHash: payloadStr });
                    targetFound = true;
                    break;
                } else {
                    // loading failed, navigate to this step to show the error
                    this._patchPage(nextIndex, { skipped: false });
                    targetFound = true;
                    break;
                }
            } else {
                // static page
                if (stepOffset > 0) {
                    this._patchPage(nextIndex, { skipped: false });
                }
                targetFound = true;
                break;
            }
        }

        if (targetFound) {
            this._currentIndex = nextIndex;
            this._refreshSummaries();
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
    }

    /**
     * Asynchronously loads a dynamic step from the server. The step is shown with a
     * spinner while it loads.
     * @param {number} index - The index of the step to load.
     * @param {string} payloadStr - The serialized form payload to send.
     * @returns {Promise<number>} The HTTP status code.
     */
    async _loadDynamicPage(index, payloadStr) {
        const page = this._pages[index];
        const element = this._pageElements[index];

        this.setState({ wizardLoading: true, loadingIndex: index });
        this._patchPage(index, { hasError: false });

        // the content of a step belongs to the step, so its placeholder is written into it
        element.innerHTML = `
            <div class="d-flex justify-content-center py-4">
                <div class="spinner-border text-secondary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
            </div>
        `;

        const result = await this._transport().request(
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
            this._patchPage(index, { hasError: true });
            element.innerHTML = `<div class="alert alert-danger wx-restwizard-page-error my-3">${message}</div>`;
            this._setWizardLoading(false);
            return 500;
        }

        // the step content is delivered as html text (parsed by the service)
        const html = (result.data && typeof result.data.text === "string") ? result.data.text : "";
        this._injectHtml(element, html);
        this._patchPage(index, { isLoaded: true });
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
     * Reads back what the user chose on every step, so the step indicator shows the
     * answer in place of the question.
     */
    _refreshSummaries() {
        const summaries = this._pages.map((page, i) => this._resolveSummary(page, this._pageElements[i]));
        const current = this._store.getState().summaries || [];

        if (summaries.some((summary, i) => summary !== current[i])) {
            this.setState({ summaries: summaries });
        }
    }

    /**
     * Reads back what the user chose on a step. The value is resolved to the label of
     * the control that carries it — a tile, an option of a segmented choice or of a
     * select — and falls back to the raw value.
     * @param {Object} page - The step to summarise.
     * @param {HTMLElement} element - The page of the step.
     * @returns {string|null} The label of the choice, or null when the step is open.
     */
    _resolveSummary(page, element) {
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

        const card = element.querySelector(`[data-tile-id="${escaped}"]`);
        if (card) {
            const title = card.querySelector(".card-title");
            return (title ? title.textContent : card.textContent).trim();
        }

        const option = element.querySelector(`[data-value="${escaped}"]`);
        if (option) {
            return option.textContent.trim();
        }

        if (input.tagName === "SELECT" && input.selectedOptions.length) {
            return input.selectedOptions[0].textContent.trim();
        }

        return value;
    }

    /**
     * Collects the fields of a step that take part in the validation.
     * @param {number} index - The step index.
     * @returns {Array<HTMLElement>} The fields.
     */
    _fieldsOf(index) {
        return Array.from(this._pageElements[index].querySelectorAll("input, textarea, select")).filter((el) => {
            return el.name && !el.disabled;
        });
    }

    /**
     * Validates all input elements within the current page.
     * @returns {boolean} True if the page is valid.
     */
    validateCurrentPage() {
        if (this._pages[this._currentIndex].hasError) {
            this.clearErrors();
            return false;
        }

        // use inherited validation method from RestFormCtrl
        return this._validateFields(this._fieldsOf(this._currentIndex));
    }

    /**
     * Overrides the base validation to check the entire wizard form.
     * Validates all active (non-skipped) pages and forces navigation to the first invalid page.
     * @returns {boolean} True if valid.
     */
    validate() {
        let firstInvalidIndex = -1;
        const fields = [];

        for (let i = 0; i < this._pages.length; i++) {
            const page = this._pages[i];

            if (page.skipped) {
                continue;
            }

            if (page.hasError) {
                if (firstInvalidIndex === -1) {
                    firstInvalidIndex = i;
                }
                continue;
            }

            const pageFields = this._fieldsOf(i);
            if (firstInvalidIndex === -1 && pageFields.some((el) => this._validateField(el))) {
                firstInvalidIndex = i;
            }
            fields.push(...pageFields);
        }

        if (firstInvalidIndex !== -1 && firstInvalidIndex !== this._currentIndex) {
            this._currentIndex = firstInvalidIndex;
        }

        return this._validateFields(fields) && firstInvalidIndex === -1;
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

        // the save of the base validates the whole wizard through the validate override
        this.save();
    }

    /**
     * Disables interaction while dynamic steps are loading.
     * @param {boolean} state True when loading.
     */
    _setWizardLoading(state) {
        this.setState(state ? { wizardLoading: true } : { wizardLoading: false, loadingIndex: null });
    }
};

// register the class in the controller
webexpress.webui.Controller.registerClass("wx-webapp-restwizard", webexpress.webapp.RestWizardCtrl);
