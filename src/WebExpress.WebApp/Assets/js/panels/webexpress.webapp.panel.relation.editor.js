/**
 * The editor page of a relation type. It asks for the one thing a relation
 * really is: a fact told from two sides. Both labels therefore sit next to each
 * other, and the preview at the bottom reads the relation back from either end,
 * so the person defining it sees the sentence their colleagues will read before
 * they save it.
 *
 * Like the pages of the add dialog it is a page of the framework sidebar modal
 * (webexpress.webui.ModalSidebarPanelCtrl), registered through
 * webexpress.webui.DialogPanels. A single page puts that modal into its single
 * pane mode, so the editor is the plain framework dialog with the framework
 * submit button and the framework validation, and the administration surface
 * only supplies the page and a back reference to itself under `_linkTypeCtrl`.
 *
 * The scaffold is built once when the page is added; the values arrive in
 * onShow, because the type being edited changes with every opening.
 */
webexpress.webui.DialogPanels.register(webexpress.webapp.relationEditorModel.PANELS_KEY, {
    id: "webexpress.webapp.relation.editor",
    title: webexpress.webui.I18N.translate("webexpress.webapp:relation.type.dialog.title"),
    iconClass: webexpress.webui.IconSet.resolve("link"),

    /**
     * Builds the fields of the page.
     * @param {HTMLElement} pane - The page pane the fields go into.
     * @param {object} modal - The dialog the page belongs to.
     */
    render: function (pane, modal) {
        const state = webexpress.webapp.relationEditorModel.panelState(modal);

        pane.classList.add("wx-relation-editor-dialog");

        const pair = document.createElement("div");
        pair.className = "wx-relation-editor-dialog-pair";

        state.labelInput = this._text(
            pair,
            this._caption(modal, "relation.type.dialog.label", "Name - as read from this item"),
            this._caption(modal, "relation.type.dialog.label.hint", "This is how the type appears on the item the link is created from."));

        state.inverseInput = this._text(
            pair,
            this._caption(modal, "relation.type.dialog.inverse", "Counterpart - as read from the target"),
            null);

        pane.appendChild(pair);

        state.symmetricInput = this._check(
            pane,
            this._caption(modal, "relation.type.dialog.symmetric", "Symmetric - both sides named alike"));

        pane.appendChild(this._label(this._caption(modal, "relation.type.dialog.classes", "Accepted target classes")));

        state.classesHost = document.createElement("div");
        state.classesHost.className = "wx-relation-editor-dialog-classes";
        state.classesHost.addEventListener("change", () => this._readClasses(modal));
        pane.appendChild(state.classesHost);

        const options = document.createElement("div");
        options.className = "wx-relation-editor-dialog-options";

        state.cardinalitySelect = this._select(
            options,
            this._caption(modal, "relation.type.dialog.cardinality", "Cardinality"),
            webexpress.webapp.relationEditorModel.CARDINALITIES.map((token) => ({ value: token, label: token })),
            modal);

        state.effectSelect = this._select(
            options,
            this._caption(modal, "relation.type.dialog.effect", "Effect in the workflow"),
            webexpress.webapp.relationEditorModel.EFFECTS.map((token) => ({
                value: token,
                label: webexpress.webapp.relationEditorModel.effectLabel(token, (key, fallback) => this._i18n(modal, key, fallback))
            })),
            modal);

        pane.appendChild(options);

        pane.appendChild(this._label(this._caption(modal, "relation.type.dialog.description", "Description for users")));

        state.descriptionInput = document.createElement("textarea");
        state.descriptionInput.className = "form-control wx-relation-editor-dialog-description";
        state.descriptionInput.rows = 3;
        pane.appendChild(state.descriptionInput);

        pane.appendChild(this._label(this._caption(modal, "relation.type.dialog.preview", "Preview in the item view")));

        state.preview = document.createElement("div");
        state.preview.className = "wx-relation-editor-dialog-preview";
        pane.appendChild(state.preview);

        state.impact = document.createElement("div");
        state.impact.className = "wx-relation-editor-dialog-impact";
        pane.appendChild(state.impact);

        for (const input of [state.labelInput, state.inverseInput, state.symmetricInput]) {
            input.addEventListener("input", () => this._read(modal));
            input.addEventListener("change", () => this._read(modal));
        }
    },

    /**
     * Writes the type the surface handed over into the fields.
     * @param {object} modal - The dialog the page belongs to.
     */
    onShow: function (modal) {
        const model = webexpress.webapp.relationEditorModel;
        const state = model.panelState(modal);

        state.draft = model.normalizeItem(modal._linkTypeDraft);

        this._renderClasses(modal);
        this._apply(modal);
    },

    /**
     * Returns what is still missing, or null when the definition is complete.
     * The framework reads a returned string as the validation message and keeps
     * the dialog open.
     * @param {object} modal - The dialog the page belongs to.
     * @returns {string|null} The message.
     */
    validate: function (modal) {
        const model = webexpress.webapp.relationEditorModel;

        this._read(modal);
        this._readClasses(modal);

        return model.validate(model.panelState(modal).draft, (key, fallback) => this._i18n(modal, key, fallback));
    },

    /**
     * Hands the edited definition to the administration surface.
     * @param {object} modal - The dialog the page belongs to.
     */
    onSubmit: function (modal) {
        modal._linkTypeCtrl.saveType(webexpress.webapp.relationEditorModel.panelState(modal).draft);
    },

    /**
     * Renders the target class picker: the "all classes" option in front of one
     * checkbox per class the surface offers.
     * @param {object} modal - The dialog the page belongs to.
     */
    _renderClasses: function (modal) {
        const state = webexpress.webapp.relationEditorModel.panelState(modal);

        state.classesHost.replaceChildren();
        state.classChecks = [];
        state.allClassesInput = this._classCheck(state.classesHost, "", this._caption(modal, "relation.type.all.classes", "all classes"));

        for (const entry of modal._linkTypeClasses || []) {
            state.classChecks.push(this._classCheck(state.classesHost, entry.id, entry.label || entry.id));
        }
    },

    /**
     * Writes the draft into the fields.
     * @param {object} modal - The dialog the page belongs to.
     */
    _apply: function (modal) {
        const state = webexpress.webapp.relationEditorModel.panelState(modal);
        const draft = state.draft;

        state.labelInput.value = draft.label;
        state.inverseInput.value = draft.symmetric ? draft.label : draft.inverse;
        state.inverseInput.disabled = draft.symmetric;
        state.symmetricInput.checked = draft.symmetric;
        state.cardinalitySelect.value = draft.cardinality;
        state.effectSelect.value = draft.effect;
        state.descriptionInput.value = draft.description;
        state.allClassesInput.checked = draft.allClasses;

        for (const check of state.classChecks) {
            check.checked = !draft.allClasses && draft.targetClasses.indexOf(check.value) >= 0;
            check.disabled = draft.allClasses;
        }

        this._renderPreview(modal);
        this._renderImpact(modal);
    },

    /**
     * Reads the fields back into the draft and refreshes the preview.
     * @param {object} modal - The dialog the page belongs to.
     */
    _read: function (modal) {
        const state = webexpress.webapp.relationEditorModel.panelState(modal);
        const draft = state.draft;

        if (!draft) {
            return;
        }

        draft.label = state.labelInput.value;
        draft.symmetric = state.symmetricInput.checked;
        draft.inverse = draft.symmetric ? draft.label : state.inverseInput.value;
        draft.cardinality = state.cardinalitySelect.value;
        draft.effect = state.effectSelect.value;
        draft.description = state.descriptionInput.value;

        // a symmetric relation reads alike from both ends, so its counterpart is
        // not an independent value and the field only mirrors the label
        state.inverseInput.disabled = draft.symmetric;
        if (draft.symmetric) {
            state.inverseInput.value = draft.label;
        }

        this._renderPreview(modal);
    },

    /**
     * Reads the target class picker back into the draft. Ticking "all classes"
     * clears the individual picks, because the two statements cannot both hold.
     * @param {object} modal - The dialog the page belongs to.
     */
    _readClasses: function (modal) {
        const state = webexpress.webapp.relationEditorModel.panelState(modal);
        const draft = state.draft;

        if (!draft) {
            return;
        }

        draft.allClasses = state.allClassesInput.checked;
        draft.targetClasses = draft.allClasses
            ? []
            : state.classChecks.filter((check) => check.checked).map((check) => check.value);

        for (const check of state.classChecks) {
            check.disabled = draft.allClasses;

            if (draft.allClasses) {
                check.checked = false;
            }
        }
    },

    /**
     * Renders the two readings of the relation.
     * @param {object} modal - The dialog the page belongs to.
     */
    _renderPreview: function (modal) {
        const model = webexpress.webapp.relationEditorModel;
        const state = model.panelState(modal);
        const placeholder = this._caption(modal, "relation.type.dialog.any", "any item");
        const readings = model.preview(state.draft, modal._linkTypeSample || "", placeholder);

        state.preview.replaceChildren();

        for (const reading of readings) {
            const row = document.createElement("div");
            row.className = "wx-relation-editor-dialog-preview-row";
            row.appendChild(this._previewChip(reading.left, reading.subject === "left"));

            const relation = document.createElement("span");
            relation.className = "wx-relation-editor-dialog-preview-relation";
            relation.textContent = reading.relation;
            row.appendChild(relation);

            row.appendChild(this._previewChip(reading.right, reading.subject === "right"));
            state.preview.appendChild(row);
        }
    },

    /**
     * Renders how many stored links the change affects, because narrowing a
     * relation that is already in use is a different decision from defining a
     * fresh one.
     * @param {object} modal - The dialog the page belongs to.
     */
    _renderImpact: function (modal) {
        const state = webexpress.webapp.relationEditorModel.panelState(modal);

        state.impact.textContent = this._caption(modal, "relation.type.dialog.impact", "{0} existing links affected")
            .replace("{0}", String(state.draft.usage || 0));
    },

    /**
     * Builds one chip of the preview.
     * @param {string} text - The caption.
     * @param {boolean} subject - Whether the chip is the item being edited.
     * @returns {HTMLElement} The chip.
     */
    _previewChip: function (text, subject) {
        const chip = document.createElement("span");
        chip.className = "wx-relation-editor-dialog-preview-chip";
        chip.textContent = text;

        if (subject) {
            chip.classList.add("wx-relation-editor-dialog-preview-subject");
        }

        return chip;
    },

    /**
     * Builds a labelled text field.
     * @param {HTMLElement} host - The container.
     * @param {string} label - The caption.
     * @param {string|null} hint - The explanation below the field.
     * @returns {HTMLElement} The input.
     */
    _text: function (host, label, hint) {
        const field = document.createElement("div");
        field.className = "wx-relation-editor-dialog-field";
        field.appendChild(this._label(label));

        const input = document.createElement("input");
        input.type = "text";
        input.className = "form-control";
        field.appendChild(input);

        if (hint) {
            const note = document.createElement("small");
            note.className = "wx-relation-editor-dialog-hint";
            note.textContent = hint;
            field.appendChild(note);
        }

        host.appendChild(field);

        return input;
    },

    /**
     * Builds a labelled checkbox.
     * @param {HTMLElement} host - The container.
     * @param {string} label - The caption.
     * @returns {HTMLElement} The input.
     */
    _check: function (host, label) {
        const field = document.createElement("label");
        field.className = "wx-relation-editor-dialog-check";

        const input = document.createElement("input");
        input.type = "checkbox";
        input.className = "form-check-input";

        const caption = document.createElement("span");
        caption.textContent = label;

        field.appendChild(input);
        field.appendChild(caption);
        host.appendChild(field);

        return input;
    },

    /**
     * Builds one entry of the target class picker.
     * @param {HTMLElement} host - The container.
     * @param {string} id - The class id, empty for the "all classes" entry.
     * @param {string} label - The caption.
     * @returns {HTMLElement} The input.
     */
    _classCheck: function (host, id, label) {
        const field = document.createElement("label");
        field.className = "wx-relation-editor-dialog-class";

        const input = document.createElement("input");
        input.type = "checkbox";
        input.className = "form-check-input";
        input.value = id;

        const caption = document.createElement("span");
        caption.textContent = label;

        field.appendChild(input);
        field.appendChild(caption);
        host.appendChild(field);

        return input;
    },

    /**
     * Builds a labelled select.
     * @param {HTMLElement} host - The container.
     * @param {string} label - The caption.
     * @param {Array<object>} options - The options as { value, label }.
     * @param {object} modal - The dialog the page belongs to.
     * @returns {HTMLElement} The select.
     */
    _select: function (host, label, options, modal) {
        const field = document.createElement("div");
        field.className = "wx-relation-editor-dialog-field";
        field.appendChild(this._label(label));

        const select = document.createElement("select");
        select.className = "form-select";

        for (const option of options) {
            const entry = document.createElement("option");
            entry.value = option.value;
            entry.textContent = option.label;
            select.appendChild(entry);
        }

        select.addEventListener("change", () => this._read(modal));
        field.appendChild(select);
        host.appendChild(field);

        return select;
    },

    /**
     * Builds a field label.
     * @param {string} text - The caption.
     * @returns {HTMLElement} The label.
     */
    _label: function (text) {
        const label = document.createElement("label");
        label.className = "wx-relation-editor-dialog-label";
        label.textContent = text;

        return label;
    },

    /**
     * Translates a caption through the surface the dialog was opened from.
     * @param {object} modal - The dialog the page belongs to.
     * @param {string} key - The i18n key below the webexpress.webapp bundle.
     * @param {string} fallback - The fallback text.
     * @returns {string} The caption.
     */
    _caption: function (modal, key, fallback) {
        return this._i18n(modal, "webexpress.webapp:" + key, fallback);
    },

    /**
     * Translates a fully qualified key through the surface.
     * @param {object} modal - The dialog the page belongs to.
     * @param {string} key - The qualified i18n key.
     * @param {string} fallback - The fallback text.
     * @returns {string} The caption.
     */
    _i18n: function (modal, key, fallback) {
        return modal._linkTypeCtrl ? modal._linkTypeCtrl._i18n(key, fallback) : fallback;
    }
});
