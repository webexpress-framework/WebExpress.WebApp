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

        super(element, { services });

        this._service = this.useService("data");
        this._uri = this._service ? this._service.baseUri : null;

        const usersService = this.useService("users");
        this._usersUri = usersService ? usersService.baseUri : null;

        const uploadService = this.useService("upload");
        this._imageUploadUri = uploadService ? uploadService.baseUri : null;

        this._currentUser = element.dataset.currentUser || null;
        this._defaultCategory = element.dataset.defaultCategory || "general";
        this._placeholder = element.dataset.placeholder
            || this._i18n("webexpress.webapp:comment.composer.trigger", "Write a comment…");

        this._categoriesPreset = false;
        this._categories = {};
        if (element.dataset.categories) {
            try {
                this._categories = this._normalizeCategories(JSON.parse(element.dataset.categories));
                this._categoriesPreset = true;
            } catch (_) {
                this._categoriesPreset = false;
            }
        }

        this._editorRef = null;
        this._expanded = false;

        // clean host
        element.textContent = "";
        element.removeAttribute("data-current-user");
        element.removeAttribute("data-default-category");
        element.removeAttribute("data-placeholder");
        element.removeAttribute("data-categories");
        element.classList.add("wx-comment-composer");
        element.classList.add("wx-comment-composer-collapsed");

        this._buildDom();
        this._attachEventHandlers();
        if (!this._categoriesPreset) {
            void this._loadCategories();
        }
    }

    /**
     * Loads the categories from the REST API and refreshes the picker.
     * Failures fall back to whatever categories were already known (often
     * none) so that the composer remains usable.
     */
    async _loadCategories() {
        if (!this._uri) {
            return;
        }
        try {
            const url = webexpress.webapp.commentComposerModel.categoriesUrl(this._uri);
            const res = await webexpress.webapp.ServiceRegistry.request(url, { headers: { "Accept": "application/json" } });
            if (!res.ok) throw new Error(res.error ? res.error.message : String(res.status));
            this._categories = this._normalizeCategories(res.data);
            this._rebuildCategoryOptions();
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
     * Repopulates the category select after categories have loaded.
     */
    _rebuildCategoryOptions() {
        if (!this._catSelect) {
            return;
        }
        const previous = this._catSelect.value;
        this._catSelect.replaceChildren();
        for (const cat of Object.values(this._categories)) {
            const opt = document.createElement("option");
            opt.value = cat.id;
            opt.textContent = this._i18n(cat.i18n, cat.id);
            this._catSelect.appendChild(opt);
        }
        if (previous && this._categories[previous]) {
            this._catSelect.value = previous;
        } else if (this._categories[this._defaultCategory]) {
            this._catSelect.value = this._defaultCategory;
        }
    }

    /**
     * Builds the collapsed trigger and the (initially hidden) full form.
     */
    _buildDom() {
        // collapsed trigger
        this._trigger = document.createElement("button");
        this._trigger.type = "button";
        this._trigger.className = "wx-comment-composer-trigger";
        this._trigger.textContent = this._placeholder;
        this._element.appendChild(this._trigger);

        // expanded form
        this._form = document.createElement("div");
        this._form.className = "wx-comment-composer-form";

        const head = document.createElement("div");
        head.className = "wx-comment-composer-head";

        const title = document.createElement("strong");
        title.className = "wx-comment-composer-title";
        title.textContent = this._i18n("webexpress.webapp:comment.compose.head", "Write a new comment");

        this._catSelect = document.createElement("select");
        this._catSelect.className = "wx-comment-composer-cat";
        for (const cat of Object.values(this._categories)) {
            const opt = document.createElement("option");
            opt.value = cat.id;
            opt.textContent = this._i18n(cat.i18n, cat.id);
            this._catSelect.appendChild(opt);
        }
        if (this._categories[this._defaultCategory]) {
            this._catSelect.value = this._defaultCategory;
        }

        head.appendChild(title);
        head.appendChild(this._catSelect);

        // editor host — intentionally without the auto-registered
        // "wx-webui-editor" class so that only our explicit
        // _ensureEditor() instantiates an EditorCtrl. Adding the class
        // would let the controller registry create a second editor on
        // insertion, nesting it inside the composer.
        this._editorHost = document.createElement("div");
        this._editorHost.className = "wx-comment-composer-editor";
        this._editorHost.dataset.placeholder = this._i18n("webexpress.webapp:comment.compose.placeholder", "Write a comment…");
        if (this._imageUploadUri) {
            this._editorHost.dataset.imageUploadUri = this._imageUploadUri;
        }
        if (this._usersUri) {
            this._editorHost.dataset.mentionUri = this._usersUri;
        }

        // footer
        const foot = document.createElement("div");
        foot.className = "wx-comment-composer-foot";

        this._labelsInput = document.createElement("input");
        this._labelsInput.type = "text";
        this._labelsInput.className = "wx-comment-composer-labels";
        this._labelsInput.placeholder = this._i18n("webexpress.webapp:comment.labels.placeholder", "Labels (comma-separated)");

        const hint = document.createElement("span");
        hint.className = "wx-comment-composer-hint";
        hint.textContent = this._i18n("webexpress.webapp:comment.compose.hint", "Ctrl + Enter to send");

        this._submitBtn = document.createElement("button");
        this._submitBtn.type = "button";
        this._submitBtn.className = "wx-comment-composer-submit btn btn-primary btn-sm";
        this._submitBtn.textContent = this._i18n("webexpress.webapp:comment.compose.submit", "Send");

        this._cancelBtn = document.createElement("button");
        this._cancelBtn.type = "button";
        this._cancelBtn.className = "wx-comment-composer-cancel btn btn-secondary btn-sm";
        this._cancelBtn.textContent = this._i18n("webexpress.webui:cancel", "Cancel");

        

        foot.appendChild(this._labelsInput);
        foot.appendChild(hint);
        foot.appendChild(this._submitBtn);
        foot.appendChild(this._cancelBtn);
        
        this._form.appendChild(head);
        this._form.appendChild(this._editorHost);
        this._form.appendChild(foot);

        this._element.appendChild(this._form);
    }

    /**
     * Wires UI event handlers for collapse / expand / submit.
     */
    _attachEventHandlers() {
        this._trigger.addEventListener("click", () => this._expand());
        this._trigger.addEventListener("focus", () => this._expand());

        this._submitBtn.addEventListener("click", () => this._submit());
        this._cancelBtn.addEventListener("click", () => this._collapse());

        this._editorHost.addEventListener("keydown", (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                this._submit();
            } else if (e.key === "Escape") {
                if (!this._hasContent()) {
                    this._collapse();
                }
            }
        });
    }

    /**
     * Expands the composer: hides the trigger, shows the full form,
     * lazily instantiates the EditorCtrl and focuses it.
     */
    _expand() {
        if (this._expanded) {
            return;
        }
        this._expanded = true;
        this._element.classList.remove("wx-comment-composer-collapsed");
        this._element.classList.add("wx-comment-composer-expanded");
        this._ensureEditor();
        // focus the editor on the next frame so the EditorCtrl has wired up
        queueMicrotask(() => {
            try {
                this._editorRef?.focus?.();
            } catch (_) {
                this._editorHost.focus?.();
            }
        });
    }

    /**
     * Collapses the composer back to the trigger state. Resets the form
     * fields so the next expansion starts fresh.
     */
    _collapse() {
        this._expanded = false;
        this._element.classList.remove("wx-comment-composer-expanded");
        this._element.classList.add("wx-comment-composer-collapsed");
        this._resetForm();
    }

    /**
     * Instantiates the EditorCtrl if it has not been created yet.
     */
    _ensureEditor() {
        if (this._editorRef) {
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
        const html = this._editorRef ? this._editorRef.value : this._editorHost.innerHTML;
        const trimmed = (html || "").trim();
        return trimmed.length > 0 && trimmed !== "<p><br></p>";
    }

    /**
     * Clears the editor, labels and category back to defaults.
     */
    _resetForm() {
        if (this._editorRef) {
            this._editorRef.value = "";
        } else if (this._editorHost) {
            this._editorHost.innerHTML = "";
        }
        if (this._labelsInput) {
            this._labelsInput.value = "";
        }
        if (this._catSelect && this._categories[this._defaultCategory]) {
            this._catSelect.value = this._defaultCategory;
        }
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
        const body = this._editorRef ? this._editorRef.value : this._editorHost.innerHTML;
        const category = this._catSelect.value;
        const labels = webexpress.webapp.commentComposerModel.parseLabels(this._labelsInput.value);

        this._submitBtn.disabled = true;
        try {
            const res = await this._service.create({ body, category, labels });
            if (!res.ok) throw new Error(res.error ? res.error.message : String(res.status));
            const created = res.data;
            this._dispatch(webexpress.webapp.Event.COMMENT_ADDED_EVENT, { comment: created, uri: this._uri });
            this._collapse();
        } catch (e) {
            console.warn("CommentComposerCtrl: submit failed", e);
        } finally {
            this._submitBtn.disabled = false;
        }
    }
};

// register for declarative auto-init
webexpress.webui.Controller.registerClass("wx-webapp-comment-composer", webexpress.webapp.CommentComposerCtrl);
