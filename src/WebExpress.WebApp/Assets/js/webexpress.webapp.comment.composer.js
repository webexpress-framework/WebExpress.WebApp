/**
 * A minimalist composer control for authoring new top-level comments.
 * Starts collapsed as a single-line trigger ("Write a comment…") and
 * expands on focus / click into a full form (category select, WYSIWYG
 * editor, labels input, send / cancel). On submit the new comment is
 * POSTed to the configured REST endpoint and a COMMENT_ADDED_EVENT is
 * dispatched on the document so that sibling webexpress.webapp.CommentCtrl
 * instances can append the new comment without an extra roundtrip.
 *
 * Declarative configuration: the host carries wx-service islands named
 * "data" (comments endpoint), "users" (mention resolution) and "upload"
 * (inline image upload), plus the data-current-user, data-default-category
 * and data-placeholder attributes.
 *
 * The markup is a pure function of the state (render), patched into the host by the keyed
 * reconciler of the Data base. The WYSIWYG editor is a nested control: its host is rendered with
 * the keep flag, so the reconciler never touches what the editor builds inside it.
 *
 * REST contract (against the data service):
 *   POST   {uri}                body { body, category, labels }     → Comment
 *
 * Events dispatched on document (bubbling from host):
 *   webexpress.webapp.Event.COMMENT_ADDED_EVENT
 *     detail: { comment, uri }
 */
webexpress.webapp.CommentComposerCtrl = class extends webexpress.webapp.Data {

    /**
     * Construct a new CommentComposerCtrl.
     * @param {HTMLElement} element - host element.
     */
    constructor(element) {
        // categories are sourced from the REST API ({uri}/categories) unless
        // a static override is supplied via the data-categories attribute.
        // the categories load uses the shared request against the categories
        // url; the new comment is posted through the configured data service,
        // and the Data base aborts the service on teardown.
        const services = webexpress.webapp.ServiceRegistry.fromElement(element);
        const defaultCategory = element.dataset.defaultCategory || "general";

        let categories = {};
        let categoriesPreset = false;
        if (element.dataset.categories) {
            try {
                categories = webexpress.webapp.commentComposerModel.normalizeCategories(JSON.parse(element.dataset.categories));
                categoriesPreset = true;
            } catch (_) {
                categoriesPreset = false;
            }
        }

        super(element, {
            services,
            state: { expanded: false, categories: categories, category: defaultCategory, labels: "", submitting: false }
        });

        this._service = this.useService("data");
        this._uri = this._service ? this._service.baseUri : null;

        const usersService = this.useService("users");
        this._usersUri = usersService ? usersService.baseUri : null;

        const uploadService = this.useService("upload");
        this._imageUploadUri = uploadService ? uploadService.baseUri : null;

        const imagesService = this.useService("images");
        this._imageLibraryUri = imagesService ? imagesService.baseUri : null;

        const linksService = this.useService("links");
        this._linkLibraryUri = linksService ? linksService.baseUri : null;

        this._currentUser = element.dataset.currentUser || null;
        this._defaultCategory = defaultCategory;
        this._placeholder = element.dataset.placeholder
            || this._i18n("webexpress.webapp:comment.composer.trigger", "Write a comment…");

        this._editorRef = null;
        // the editor host, captured from the render; the editor itself is created on expansion
        this._editorHost = null;
        this._wasExpanded = false;

        // stable handlers, so a render does not swap the listeners of unchanged nodes
        this._onExpand = () => this._expand();
        this._onSubmit = () => this._submit();
        this._onCancel = () => this._collapse();
        this._onCategory = (e) => this.setState({ category: e.target.value });
        this._onLabels = (e) => this.setState({ labels: e.target.value });
        this._onEditorKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                this._submit();
            } else if (e.key === "Escape") {
                if (!this._hasContent()) {
                    this._collapse();
                }
            }
        };

        // clean host
        element.textContent = "";
        element.removeAttribute("data-current-user");
        element.removeAttribute("data-default-category");
        element.removeAttribute("data-placeholder");
        element.removeAttribute("data-categories");
        element.classList.add("wx-comment-composer");

        this.mount();
        this._attachViewState(element);
        if (!categoriesPreset) {
            void this._loadCategories();
        }
    }

    /**
     * Wires the composer to an enclosing ViewState when it was authored with
     * Resource<T>(). A posted comment then re-queries the comments resource so a
     * ViewState-bound comment list re-renders from the canonical server state,
     * rather than relying only on the comment added event. A composer without a
     * resource binding stays standalone.
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

    /**
     * Loads the categories from the REST API into the state. Failures fall back to whatever
     * categories were already known (often none) so that the composer remains usable.
     */
    async _loadCategories() {
        if (!this._uri) {
            return;
        }
        try {
            const url = webexpress.webapp.commentComposerModel.categoriesUrl(this._uri);
            const res = await webexpress.webapp.ServiceRegistry.request(url, { headers: { "Accept": "application/json" } });
            if (!res.ok) throw new Error(res.error ? res.error.message : String(res.status));
            this.setState({ categories: this._normalizeCategories(res.data) });
        } catch (e) {
            console.warn("CommentComposerCtrl: categories load failed", e);
        }
    }

    /**
     * Accepts either an array or an object keyed by category id and returns
     * the canonical object form keyed by id.
     * @param {Array|Object} input
     * @returns {Object<string, Object>}
     */
    _normalizeCategories(input) {
        return webexpress.webapp.commentComposerModel.normalizeCategories(input);
    }

    /**
     * Gets the category the picker shows: the chosen one while it exists, else the first
     * category, as a select falls back to its first option.
     * @param {object} state - The state.
     * @returns {string} The category id, or "" without categories.
     */
    _selectedCategory(state) {
        if (state.categories[state.category]) {
            return state.category;
        }
        return Object.keys(state.categories)[0] || "";
    }

    /**
     * Renders the collapsed trigger and the full form; which of the two shows is a matter of
     * the host classes and the stylesheet.
     * @param {object} state - The current state.
     * @returns {Array<object>} The virtual node tree of the host.
     */
    render(state) {
        const h = webexpress.webui.h;
        const editorData = { placeholder: this._i18n("webexpress.webapp:comment.compose.placeholder", "Write a comment…") };
        if (this._imageUploadUri) {
            editorData.imageUploadUri = this._imageUploadUri;
        }
        if (this._imageLibraryUri) {
            editorData.imageLibraryUri = this._imageLibraryUri;
        }
        if (this._linkLibraryUri) {
            editorData.linkLibraryUri = this._linkLibraryUri;
        }
        if (this._usersUri) {
            editorData.mentionUri = this._usersUri;
        }

        return [
            h("button", {
                key: "trigger",
                type: "button",
                class: "wx-comment-composer-trigger",
                on: { click: this._onExpand, focus: this._onExpand }
            }, this._placeholder),
            h("div", { key: "form", class: "wx-comment-composer-form" },
                h("div", { class: "wx-comment-composer-head" },
                    h("strong", { class: "wx-comment-composer-title" },
                        this._i18n("webexpress.webapp:comment.compose.head", "Write a new comment")),
                    h("select", {
                        class: "wx-comment-composer-cat",
                        value: this._selectedCategory(state),
                        on: { change: this._onCategory }
                    }, Object.values(state.categories).map((cat) =>
                        h("option", { key: cat.id, value: cat.id }, this._i18n(cat.i18n, cat.id))))),
                // without the auto-registered "wx-webui-editor" class, so that only _ensureEditor()
                // instantiates an EditorCtrl; the class would let the controller registry create a
                // second editor on insertion, nested inside the composer
                h("div", {
                    key: "editor",
                    class: "wx-comment-composer-editor",
                    keep: true,
                    dataset: editorData,
                    on: { keydown: this._onEditorKeyDown },
                    ref: (el) => { this._editorHost = el; }
                }),
                h("div", { class: "wx-comment-composer-foot" },
                    h("input", {
                        type: "text",
                        class: "wx-comment-composer-labels",
                        placeholder: this._i18n("webexpress.webapp:comment.labels.placeholder", "Labels (comma-separated)"),
                        value: state.labels,
                        on: { input: this._onLabels }
                    }),
                    h("span", { class: "wx-comment-composer-hint" },
                        this._i18n("webexpress.webapp:comment.compose.hint", "Ctrl + Enter to send")),
                    h("button", {
                        type: "button",
                        class: "wx-comment-composer-submit btn btn-primary btn-sm",
                        disabled: state.submitting,
                        on: { click: this._onSubmit }
                    }, this._i18n("webexpress.webapp:comment.compose.submit", "Send")),
                    h("button", {
                        type: "button",
                        class: "wx-comment-composer-cancel btn btn-secondary btn-sm",
                        on: { click: this._onCancel }
                    }, this._i18n("webexpress.webui:cancel", "Cancel"))))
        ];
    }

    /**
     * Applies the collapsed or expanded marker to the host, which lies outside the rendered tree.
     * @param {object} state - The rendered state.
     */
    onMount(state) {
        this._syncHost(state);
    }

    /**
     * Applies the host marker and, on expansion, creates and focuses the editor once the form
     * is shown.
     * @param {object} state - The rendered state.
     */
    onUpdate(state) {
        this._syncHost(state);
        if (state.expanded && !this._wasExpanded) {
            this._ensureEditor();
            // focus the editor on the next frame so the EditorCtrl has wired up
            queueMicrotask(() => {
                try {
                    this._editorRef?.focus?.();
                } catch (_) {
                    this._editorHost?.focus?.();
                }
            });
        }
        this._wasExpanded = state.expanded;
    }

    /**
     * Mirrors the expansion onto the host classes the stylesheet switches on.
     * @param {object} state - The rendered state.
     */
    _syncHost(state) {
        this._element.classList.toggle("wx-comment-composer-expanded", state.expanded);
        this._element.classList.toggle("wx-comment-composer-collapsed", !state.expanded);
    }

    /**
     * Expands the composer: hides the trigger and shows the full form.
     */
    _expand() {
        if (!this.state.expanded) {
            this.setState({ expanded: true });
        }
    }

    /**
     * Collapses the composer back to the trigger state and resets the form, so the next
     * expansion starts fresh.
     */
    _collapse() {
        if (this._editorRef) {
            this._editorRef.value = "";
        } else if (this._editorHost) {
            this._editorHost.innerHTML = "";
        }
        this.setState({ expanded: false, labels: "", category: this._defaultCategory });
    }

    /**
     * Instantiates the EditorCtrl if it has not been created yet.
     */
    _ensureEditor() {
        if (this._editorRef || !this._editorHost) {
            return;
        }
        try {
            this._editorRef = new webexpress.webui.EditorCtrl(this._editorHost);
        } catch (e) {
            console.warn("CommentComposerCtrl: editor init failed", e);
        }
    }

    /**
     * Returns whether the editor currently holds any non-empty content.
     * @returns {boolean}
     */
    _hasContent() {
        const html = this._editorRef ? this._editorRef.exportHtml({ layout: false }) : this._editorHost?.innerHTML;
        const trimmed = (html || "").trim();
        return trimmed.length > 0 && trimmed !== "<p><br></p>";
    }

    /**
     * Submits the form: POSTs the new comment, dispatches the
     * COMMENT_ADDED_EVENT and collapses back to the trigger.
     */
    async _submit() {
        if (!this._uri) {
            return;
        }
        if (!this._hasContent()) {
            return;
        }
        const body = this._editorRef ? this._editorRef.exportHtml({ layout: false }) : this._editorHost.innerHTML;
        const category = this._selectedCategory(this.state);
        const labels = webexpress.webapp.commentComposerModel.parseLabels(this.state.labels);

        this.setState({ submitting: true });
        try {
            const res = await this._service.create({ body, category, labels });
            if (!res.ok) throw new Error(res.error ? res.error.message : String(res.status));
            const created = res.data;
            this._dispatch(webexpress.webapp.Event.COMMENT_ADDED_EVENT, { comment: created, uri: this._uri });
            // when bound to a ViewState, re-query the comments resource so a
            // ViewState-bound comment list re-renders from the canonical state
            if (this._viewState) {
                this._viewState.dispatch("viewstate/reload", { resource: this._viewStateResource });
            }
            this._collapse();
        } catch (e) {
            console.warn("CommentComposerCtrl: submit failed", e);
        } finally {
            this.setState({ submitting: false });
        }
    }
};

// register for declarative auto-init
webexpress.webui.Controller.registerClass("wx-webapp-comment-composer", webexpress.webapp.CommentComposerCtrl);
