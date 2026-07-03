/**
 * Normalizes a server response into an array of plain tag value strings.
 * Accepts arrays of strings or of objects carrying value/tag/label/name.
 * @param {any} json - The raw server response.
 * @returns {string[]} The normalized tag values.
 */
webexpress.webapp._toTagValues = function (json) {
    if (!Array.isArray(json)) {
        return [];
    }

    return json
        .map((item) => {
            if (item == null) {
                return null;
            }
            if (typeof item === "string") {
                return item.trim();
            }
            const name = item.value || item.tag || item.label || item.name;
            return name ? String(name).trim() : null;
        })
        .filter((value) => value && value.length > 0);
};

/**
 * TagEditorCtrl is the editable tag surface shown inside the modal. It extends
 * the WebUI InputTagCtrl (add/remove engine) and backs every change with a REST
 * endpoint: tags are loaded on open, additions are POSTed, deletions are
 * DELETEd, and autocomplete suggestions are served by the same endpoint via the
 * "q" query parameter.
 *
 * This controller is instantiated directly by the outer TagCtrl (it is not
 * registered with the Controller, so it is not auto-initialized).
 *
 * The following events are triggered (in addition to the inherited
 * webexpress.webui.Event.ADD_EVENT / REMOVE_EVENT):
 * - webexpress.webapp.Event.TAG_ADDED_EVENT
 * - webexpress.webapp.Event.TAG_REMOVED_EVENT
 */
webexpress.webapp.TagEditorCtrl = class extends webexpress.webui.InputTagCtrl {
    /**
     * Constructor: initializes the editor, wires the autocomplete dropdown and
     * loads the existing tags from the REST endpoint.
     * @param {HTMLElement} element - Host element for the editor.
     */
    constructor(element) {
        // consume the island before the base constructor parses the children
        // as chips; the read caches on the element
        const islandServices = webexpress.webapp.ServiceRegistry.fromElement(element);

        super(element);

        // styling hook (the base added wx-tag / form-control)
        element.classList.add("wx-webapp-tag-editor");

        // the endpoint is configured through the wx-service island
        this._service = islandServices.data || null;
        this._apiEndpoint = this._service ? this._service.baseUri : null;
        this._suggestDebounceMs = 200;
        this._suggestTimer = null;
        this._suggestions = [];
        this._activeIndex = -1;

        // suggestion dropdown container
        this._suggestionBox = document.createElement("ul");
        this._suggestionBox.className = "wx-tag-suggestions";
        this._suggestionBox.style.display = "none";
        element.appendChild(this._suggestionBox);

        // wire autocomplete behavior
        this._input.addEventListener("input", () => this._onInput());
        this._input.addEventListener("keydown", (event) => this._onSuggestKeyDown(event));

        // hide the dropdown when clicking outside the editor
        this._outsideClickHandler = (event) => {
            if (!element.contains(event.target)) {
                this._hideSuggestions();
            }
        };
        document.addEventListener("click", this._outsideClickHandler);

        // no initial GET here: the outer TagCtrl seeds the editor with the
        // current tags via the data-value attribute, so re-fetching the same
        // list on every modal open would be a redundant round-trip. additions
        // and deletions are still persisted through POST / DELETE below.
    }

    /**
     * Adds a tag, persisting it via POST before adding it locally.
     * @param {string} tag - The tag to add.
     * @returns {Promise<boolean>} True when the tag was added.
     */
    async _addTag(tag) {
        const value = (tag || "").trim();
        if (!value || this._tags.includes(value)) {
            return false;
        }

        if (this._apiEndpoint) {
            try {
                const res = await webexpress.webapp.ServiceRegistry.request(this._apiEndpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Accept": "application/json" },
                    body: JSON.stringify({ value: value })
                });

                if (!res.ok) {
                    throw new Error("http " + res.status);
                }
            } catch (err) {
                console.error("failed to add tag:", err);
                return false;
            }
        }

        const added = super._addTag(value);
        if (added) {
            this._dispatch(webexpress.webapp.Event.TAG_ADDED_EVENT, { value: value });
        }

        return added;
    }

    /**
     * Removes a tag, persisting the deletion via DELETE before removing it
     * locally.
     * @param {string} tag - The tag to remove.
     * @returns {Promise<void>} Resolves when the tag is removed.
     */
    async _removeTag(tag) {
        if (!this._tags.includes(tag)) {
            return;
        }

        if (this._apiEndpoint) {
            try {
                const res = await webexpress.webapp.ServiceRegistry.request(this._apiEndpoint + "/" + encodeURIComponent(tag), {
                    method: "DELETE"
                });

                if (!res.ok && res.status !== 204) {
                    throw new Error("http " + res.status);
                }
            } catch (err) {
                console.error("failed to delete tag:", err);
                return;
            }
        }

        super._removeTag(tag);
        this._dispatch(webexpress.webapp.Event.TAG_REMOVED_EVENT, { value: tag });
    }

    /**
     * Handles input changes by debouncing a suggestion request.
     */
    _onInput() {
        const term = this._input.value.trim();

        if (this._suggestTimer) {
            clearTimeout(this._suggestTimer);
        }

        if (!term || !this._apiEndpoint) {
            this._hideSuggestions();
            return;
        }

        this._suggestTimer = setTimeout(() => this._fetchSuggestions(term), this._suggestDebounceMs);
    }

    /**
     * Fetches autocomplete suggestions for the given term and renders the
     * dropdown.
     * @param {string} term - The search term.
     * @returns {Promise<void>} Resolves when the suggestions are rendered.
     */
    async _fetchSuggestions(term) {
        try {
            const separator = this._apiEndpoint.includes("?") ? "&" : "?";
            const url = this._apiEndpoint + separator + "q=" + encodeURIComponent(term);
            const res = await webexpress.webapp.ServiceRegistry.request(url, {
                method: "GET",
                headers: { "Accept": "application/json" }
            });

            if (!res.ok) {
                throw new Error("http " + res.status);
            }

            const json = res.data;
            // drop suggestions that are already selected
            this._suggestions = webexpress.webapp._toTagValues(json).filter((v) => !this._tags.includes(v));
            this._activeIndex = -1;
            this._renderSuggestions();
        } catch (err) {
            console.error("failed to fetch suggestions:", err);
            this._hideSuggestions();
        }
    }

    /**
     * Renders the suggestion dropdown.
     */
    _renderSuggestions() {
        this._suggestionBox.innerHTML = "";

        if (!this._suggestions.length) {
            this._hideSuggestions();
            return;
        }

        const fragment = document.createDocumentFragment();

        this._suggestions.forEach((suggestion, index) => {
            const li = document.createElement("li");
            li.className = "wx-tag-suggestion";
            li.textContent = suggestion;

            if (index === this._activeIndex) {
                li.classList.add("active");
            }

            // mousedown fires before the input loses focus, keeping selection reliable
            li.addEventListener("mousedown", (event) => {
                event.preventDefault();
                this._applySuggestion(suggestion);
            });

            fragment.appendChild(li);
        });

        this._suggestionBox.appendChild(fragment);
        this._suggestionBox.style.display = "";
    }

    /**
     * Applies the selected suggestion: adds it as a tag and resets the input.
     * @param {string} value - The suggestion value.
     */
    _applySuggestion(value) {
        this._addTag(value);
        this._input.value = "";
        this._hideSuggestions();
        this._input.focus();
    }

    /**
     * Hides and clears the suggestion dropdown.
     */
    _hideSuggestions() {
        this._suggestions = [];
        this._activeIndex = -1;
        this._suggestionBox.style.display = "none";
        this._suggestionBox.innerHTML = "";
    }

    /**
     * Handles keyboard navigation within the suggestion dropdown.
     * @param {KeyboardEvent} event - The keydown event.
     */
    _onSuggestKeyDown(event) {
        if (this._suggestionBox.style.display === "none" || !this._suggestions.length) {
            return;
        }

        const count = this._suggestions.length;

        if (event.key === "ArrowDown") {
            event.preventDefault();
            this._activeIndex = (this._activeIndex + 1) % count;
            this._renderSuggestions();
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            this._activeIndex = (this._activeIndex - 1 + count) % count;
            this._renderSuggestions();
        } else if (event.key === "Enter") {
            if (this._activeIndex >= 0) {
                event.preventDefault();
                this._applySuggestion(this._suggestions[this._activeIndex]);
            }
        } else if (event.key === "Escape") {
            this._hideSuggestions();
        }
    }

    /**
     * Removes the outside-click listener when the editor is destroyed.
     */
    destroy() {
        if (this._outsideClickHandler) {
            document.removeEventListener("click", this._outsideClickHandler);
            this._outsideClickHandler = null;
        }
        super.destroy();
    }
};

/**
 * TagCtrl is the read-only tag (label) surface for a domain object. It extends
 * the WebUI read-only TagCtrl (renders the chips without remove buttons) and
 * adds a "+" button that opens a modal in which tags are added or deleted via a
 * TagEditorCtrl. On close, the read-only chips reflect the edits.
 *
 * Setting data-readonly="true" suppresses the "+" button, leaving a pure
 * read-only display.
 */
webexpress.webapp.TagCtrl = class extends webexpress.webui.TagCtrl {
    /**
     * Constructor: initializes the read-only surface, adds the "+" button and
     * loads the attached tags.
     * @param {HTMLElement} element - Host element for the tag control.
     */
    constructor(element) {
        // consume the island before the base constructor parses the children
        // as chips; the read caches on the element
        const islandServices = webexpress.webapp.ServiceRegistry.fromElement(element);

        super(element);

        // styling hook: the registered "wx-webapp-tag" selector is consumed by
        // the controller on instantiation; re-adding it would make a later dom
        // scan construct a second instance, so a distinct class keys the css
        element.classList.add("wx-tag-surface");

        // the endpoint is authored in C# through the wx-service island
        this._service = islandServices.data || null;
        this._apiEndpoint = this._service ? this._service.baseUri : null;
        this._readonly = element.dataset.readonly === "true";
        this._placeholder = element.getAttribute("placeholder") || "";

        // add the "+" affordance unless the surface is read-only
        if (!this._readonly) {
            this._addButton = document.createElement("button");
            this._addButton.type = "button";
            this._addButton.className = "wx-tag-add";
            this._addButton.innerHTML = `<i class="${this._iconClass("fas fa-plus", "wx-icon-light-plus")}"></i>`;
            this._addButton.setAttribute("aria-label", this._i18n("webexpress.webapp:tag.edit", "Edit tags"));
            this._addButton.addEventListener("click", () => this._openEditor());
            element.appendChild(this._addButton);
        }

        // initial load of the attached tags
        if (this._apiEndpoint) {
            this._loadTags();
        }
    }

    /**
     * Loads the attached tags from the REST endpoint and renders the chips.
     * @returns {Promise<void>} Resolves when the tags are loaded.
     */
    async _loadTags() {
        try {
            const res = await webexpress.webapp.ServiceRegistry.request(this._apiEndpoint, {
                method: "GET",
                headers: { "Accept": "application/json" }
            });

            if (!res.ok) {
                throw new Error("http " + res.status);
            }

            const json = res.data;
            this.value = webexpress.webapp._toTagValues(json);
        } catch (err) {
            console.error("failed to load tags:", err);
        }
    }

    /**
     * Opens the modal hosting the editable tag surface. On close, the read-only
     * chips are updated to reflect the edits made in the editor.
     */
    _openEditor() {
        // build the modal host (see webexpress.webui.ModalCtrl)
        const host = document.createElement("div");

        const header = document.createElement("span");
        header.className = "wx-modal-header";
        header.textContent = this._i18n("webexpress.webapp:tag.title", "Tags");
        host.appendChild(header);

        const content = document.createElement("div");
        content.className = "wx-modal-content px-3 py-4";

        // editor host carries the current tags as a seed and the REST endpoint
        // as a client built wx-service island, matching the server emission
        const editorHost = document.createElement("div");
        editorHost.className = "wx-webapp-tag-editor";
        if (this._apiEndpoint) {
            editorHost.appendChild(webexpress.webapp.ServiceRegistry.islandElement({
                name: "data", kind: "rest", baseUri: this._apiEndpoint, method: "GET"
            }));
        }
        editorHost.setAttribute("data-value", this._tags.join(";"));
        if (this._placeholder) {
            editorHost.setAttribute("placeholder", this._placeholder);
        }
        if (this._colorCss) {
            editorHost.setAttribute("data-color-css", this._colorCss);
        }
        if (this._colorStyle) {
            editorHost.setAttribute("data-color-style", this._colorStyle);
        }
        content.appendChild(editorHost);
        host.appendChild(content);
        host.setAttribute("data-scrollable", "false");

        document.body.appendChild(host);

        // build the modal shell, then attach the editor to its (relocated) host
        const modal = new webexpress.webui.ModalCtrl(host);
        const editor = new webexpress.webapp.TagEditorCtrl(editorHost);

        host.addEventListener(webexpress.webui.Event.MODAL_HIDE_EVENT, () => {
            // reflect the edits in the read-only view, then tear the modal down
            this.value = editor.value;
            editor.destroy();
            host.remove();
        });

        modal.show();
    }
};

// register the read-only control (the editor is instantiated directly by it)
webexpress.webui.Controller.registerClass("wx-webapp-tag", webexpress.webapp.TagCtrl);
