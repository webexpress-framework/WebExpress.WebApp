/**
 * The panel of the native web link system: an address outside the application,
 * the title it is shown under and a note. It is the second half of the natively
 * supported pair - the same generic link entity, addressed by a uri instead of
 * by an object key.
 *
 * Like its object counterpart it is a page of the framework sidebar dialog
 * (webexpress.webui.ModalSidebarPanelCtrl), registered the way the editor
 * registers its own dialog pages, and it declares itself generic for the
 * external category, so a link system a plugin contributes for an outside
 * address is rendered by it as well.
 */
webexpress.webui.DialogPanels.register(webexpress.webapp.relationViewModel.PANELS_KEY, {
    id: "webexpress.webapp.relation.web",
    kind: "external",
    generic: true,
    title: webexpress.webui.I18N.translate("webexpress.webapp:relation.system.web"),
    iconClass: webexpress.webui.IconSet.resolve("arrow-up-right-from-square"),

    /**
     * Builds the fields of the page.
     * @param {HTMLElement} pane - The page pane the fields go into.
     * @param {object} modal - The dialog the page belongs to.
     * @param {string} [systemId] - The system the page renders, for a page the control added.
     */
    render: function (pane, modal, systemId) {
        const id = systemId || this.id;
        const model = webexpress.webapp.relationViewModel;
        const state = model.panelState(modal, id);
        const system = model.systemOf(modal._linkSystems, id) || { id: id, types: [], label: id };

        state.system = id;
        state.type = (system.types[0] || {}).id || "";
        state.address = "";
        state.title = "";
        state.comment = "";

        pane.appendChild(this._hint(system.description));

        // a system with a single relation says nothing by asking for it, so the
        // picker only appears once there is something to pick
        if (system.types.length > 1) {
            pane.appendChild(this._label(this._text(modal, "relation.dialog.type", "Link type")));

            state.typeSelect = document.createElement("select");
            state.typeSelect.className = "form-select wx-relation-view-dialog-type";
            for (const type of system.types) {
                const option = document.createElement("option");
                option.value = type.id;
                option.textContent = type.label || type.id;
                state.typeSelect.appendChild(option);
            }
            state.typeSelect.value = state.type;
            state.typeSelect.addEventListener("change", () => {
                state.type = state.typeSelect.value;
            });
            pane.appendChild(state.typeSelect);
        }

        pane.appendChild(this._label(this._text(modal, "relation.dialog.address", "Address")));

        state.addressInput = document.createElement("input");
        state.addressInput.type = "url";
        state.addressInput.className = "form-control wx-relation-view-dialog-address";
        state.addressInput.placeholder = "https://";
        state.addressInput.addEventListener("input", () => {
            state.address = state.addressInput.value.trim();
        });
        pane.appendChild(state.addressInput);

        pane.appendChild(this._label(this._text(modal, "relation.dialog.address.title", "Title")));

        state.titleInput = document.createElement("input");
        state.titleInput.type = "text";
        state.titleInput.className = "form-control wx-relation-view-dialog-title";
        state.titleInput.placeholder = this._text(modal, "relation.dialog.address.title.placeholder", "How should the address be shown?");
        state.titleInput.addEventListener("input", () => {
            state.title = state.titleInput.value;
        });
        pane.appendChild(state.titleInput);

        pane.appendChild(this._label(this._text(modal, "relation.dialog.note", "Note on the link"), true));

        state.commentInput = document.createElement("textarea");
        state.commentInput.className = "form-control wx-relation-view-dialog-note";
        state.commentInput.rows = 3;
        state.commentInput.placeholder = this._text(modal, "relation.dialog.note.placeholder", "Why do the two belong together?");
        state.commentInput.addEventListener("input", () => {
            state.comment = state.commentInput.value;
        });
        pane.appendChild(state.commentInput);
    },

    /**
     * Returns what is still missing, or null when the draft is complete.
     * @param {object} modal - The dialog the page belongs to.
     * @param {string} [systemId] - The system the page renders.
     * @returns {string|null} The message.
     */
    validate: function (modal, systemId) {
        const state = webexpress.webapp.relationViewModel.panelState(modal, systemId || this.id);

        if (!webexpress.webapp.relationViewModel.isValidAddress(state.address)) {
            return this._text(modal, "relation.dialog.address.invalid", "Please enter an address starting with http:// or https://.");
        }

        return null;
    },

    /**
     * Establishes the link the page describes. The address doubles as the title
     * when none was given, so a link is never rendered as an empty row.
     * @param {object} modal - The dialog the page belongs to.
     * @param {string} [systemId] - The system the page renders.
     */
    onSubmit: function (modal, systemId) {
        const id = systemId || this.id;
        const state = webexpress.webapp.relationViewModel.panelState(modal, id);

        modal._linkCtrl.createLink({
            system: id,
            type: state.type,
            address: state.address,
            title: state.title || state.address,
            comment: state.comment
        });

        this._reset(state);
    },

    /**
     * Clears the fields after a link was established.
     * @param {object} state - The scratch state of the page.
     */
    _reset: function (state) {
        state.address = "";
        state.title = "";
        state.comment = "";

        for (const input of [state.addressInput, state.titleInput, state.commentInput]) {
            if (input) {
                input.value = "";
            }
        }
    },

    /**
     * Builds the sentence that explains what a link in this system connects.
     * @param {string} description - The explanation, may be empty.
     * @returns {HTMLElement} The hint.
     */
    _hint: function (description) {
        const hint = document.createElement("div");
        hint.className = "wx-relation-view-dialog-hint";
        hint.textContent = description || "";

        return hint;
    },

    /**
     * Builds a field label.
     * @param {string} text - The caption.
     * @param {boolean} [optional] - Whether the field may stay empty.
     * @returns {HTMLElement} The label.
     */
    _label: function (text, optional) {
        const label = document.createElement("label");
        label.className = "wx-relation-view-dialog-label";
        label.textContent = text;

        if (optional) {
            label.classList.add("wx-relation-view-dialog-label-optional");
        }

        return label;
    },

    /**
     * Translates a caption through the control, so the page speaks the language
     * of the surface it was opened from.
     * @param {object} modal - The dialog the page belongs to.
     * @param {string} key - The i18n key below the webexpress.webapp bundle.
     * @param {string} fallback - The fallback text.
     * @returns {string} The caption.
     */
    _text: function (modal, key, fallback) {
        return modal._linkCtrl
            ? modal._linkCtrl._i18n("webexpress.webapp:" + key, fallback)
            : fallback;
    }
});
