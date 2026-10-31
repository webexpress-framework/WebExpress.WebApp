/**
 * The target picker of the object link system: the framework selection control,
 * answered by the targets service of the surface instead of by an endpoint of
 * its own.
 *
 * It is the REST-backed `webexpress.webapp.InputSelectionCtrl` with one method
 * replaced. That control reads its endpoint from a `wx-service` island on its
 * own element and asks it for a term and a page; a target search needs more
 * than a term - which relation is being established, which system it belongs to
 * and which object it starts from all decide what may be linked - and the
 * surface already holds that service. Overriding the request keeps everything
 * the control does around it: the debounce, the spinner, the abort of a
 * superseded search and the dropdown itself.
 */
webexpress.webapp.RelationTargetSelectionCtrl = class extends webexpress.webapp.InputSelectionCtrl {
    /**
     * Answers the options from the targets service of the surface. Everything
     * this needs hangs off the element rather than off the instance, because the
     * base constructor issues the first search before a subclass could attach
     * anything to itself.
     * @param {string} filter - The term that was typed.
     * @returns {Promise<void>} Resolves when the options were replaced.
     */
    async receiveData(filter) {
        const scope = this._element._wxRelationTarget;

        if (!scope || !scope.ctrl || !scope.ctrl.targets) {
            return;
        }

        this._showSpinner();

        const result = await scope.ctrl.targets.query({
            search: filter == null ? "" : String(filter),
            type: scope.state.type,
            system: scope.system,
            source: scope.ctrl.subject.key || ""
        });

        this._hideSpinner();

        // a search a newer keystroke aborted has nothing to say about what the
        // dropdown should show
        if (!result.ok) {
            if (!result.error || result.error.kind !== "abort") {
                this.options = [];
            }

            return;
        }

        const candidates = Array.isArray(result.data) ? result.data : ((result.data && result.data.items) || []);

        scope.state.candidates = new Map(candidates.map((candidate) => [scope.panel.keyOf(candidate), candidate]));
        this.options = candidates.length > 0
            ? candidates.map((candidate) => scope.panel.candidateOption(candidate))
            : [scope.panel.emptyOption(scope.empty)];
    }

    /**
     * Shows that a search is running, in the place the control reserves for it.
     */
    _showSpinner() {
        if (this._spinner && this._selection && this._spinner.parentNode !== this._selection) {
            this._selection.appendChild(this._spinner);
        }
    }

    /**
     * Takes the running indication away again.
     */
    _hideSpinner() {
        if (this._spinner && this._spinner.parentNode) {
            this._spinner.parentNode.removeChild(this._spinner);
        }
    }
};

/**
 * The panel of the native object link system: a relation picked from the types
 * the system offers, a target searched in the application and a note that says
 * why the two belong together.
 *
 * It is a page of the framework sidebar dialog
 * (webexpress.webui.ModalSidebarPanelCtrl), registered the way the editor
 * registers its own dialog pages: the modal autoloads it by the registry key and
 * drives its render, its validation and its submit. Everything the panel needs
 * about the link surface hangs off the modal - the control under `_linkCtrl` and
 * the registered systems under `_linkSystems` - which is the same back reference
 * the editor toolbar sets on its modals.
 *
 * Both fields are the framework selection control, so a relation and a target
 * are picked the way everything else in the application is picked.
 *
 * It declares itself generic for the object category, so a link system a plugin
 * contributes without shipping a panel of its own is rendered by it too; the
 * plugin only has to answer the target search.
 */
webexpress.webui.DialogPanels.register(webexpress.webapp.relationViewModel.PANELS_KEY, {
    id: "webexpress.webapp.relation.object",
    kind: "object",
    generic: true,
    title: webexpress.webui.I18N.translate("webexpress.webapp:relation.system.object"),
    iconClass: webexpress.webui.IconSet.resolve("link"),

    /**
     * The delay a keystroke waits before the target search is issued, so typing
     * a key does not send one request per character.
     */
    searchDelay: 200,

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
        state.target = null;
        state.comment = "";
        state.candidates = new Map();

        pane.appendChild(this._hint(system.description));

        pane.appendChild(this._label(this._text(modal, "relation.dialog.type", "Link type")));
        this._typeField(pane, modal, id, state, system);

        pane.appendChild(this._label(this._text(modal, "relation.dialog.search", "Find target")));
        this._targetField(pane, modal, id, state);

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
     * Loads the candidates when the page is revealed, so the first opening of
     * the dropdown shows what may be linked instead of an empty list.
     * @param {object} modal - The dialog the page belongs to.
     * @param {string} [systemId] - The system the page renders.
     */
    onShow: function (modal, systemId) {
        this._search(modal, systemId || this.id);
    },

    /**
     * Returns what is still missing, or null when the draft is complete. The
     * framework reads a returned string as the validation message and keeps the
     * dialog open, which is why an incomplete draft never reaches the server.
     * @param {object} modal - The dialog the page belongs to.
     * @param {string} [systemId] - The system the page renders.
     * @returns {string|null} The message.
     */
    validate: function (modal, systemId) {
        const state = webexpress.webapp.relationViewModel.panelState(modal, systemId || this.id);

        if (!state.type) {
            return this._text(modal, "relation.dialog.type.required", "Please pick a link type.");
        }

        if (!state.target || !state.target.key) {
            return this._text(modal, "relation.dialog.target.required", "Please pick the object to link to.");
        }

        return null;
    },

    /**
     * Establishes the link the page describes and clears the fields, so the next
     * one starts from an empty page.
     * @param {object} modal - The dialog the page belongs to.
     * @param {string} [systemId] - The system the page renders.
     */
    onSubmit: function (modal, systemId) {
        const id = systemId || this.id;
        const state = webexpress.webapp.relationViewModel.panelState(modal, id);

        modal._linkCtrl.createLink({
            system: id,
            type: state.type,
            target: state.target,
            comment: state.comment
        });

        this._reset(state);
    },

    /**
     * Returns what identifies a candidate, so the option the dropdown reports
     * back finds the reference it stands for.
     * @param {object} candidate - The candidate reference.
     * @returns {string} The identity.
     */
    keyOf: function (candidate) {
        return candidate.key || candidate.uri || "";
    },

    /**
     * Builds the option of one candidate. The content is markup the control
     * renders, which is why every part of it is escaped: what stands in it comes
     * from the objects of the application.
     * @param {object} candidate - The candidate reference.
     * @returns {object} The option.
     */
    candidateOption: function (candidate) {
        const parts = [this._span("key", candidate.key)];

        if (candidate.class) {
            parts.push(this._span("class", candidate.class));
        }

        parts.push(this._span("title", candidate.title));

        return {
            id: this.keyOf(candidate),
            value: this.keyOf(candidate),
            label: [candidate.key, candidate.title].filter((x) => x).join(" - "),
            content: `<span class="wx-relation-view-dialog-suggestion">${parts.join("")}</span>`
        };
    },

    /**
     * Builds the option that stands in for an answer without a single
     * candidate. It is disabled, so the dropdown says what happened rather than
     * offering something to pick.
     * @param {string} label - The caption.
     * @returns {object} The option.
     */
    emptyOption: function (label) {
        return {
            id: "",
            value: "",
            label: label,
            content: `<span class="wx-relation-view-dialog-empty">${this._escape(label)}</span>`,
            disabled: true
        };
    },

    /**
     * Builds the relation picker.
     * @param {HTMLElement} pane - The page pane the field goes into.
     * @param {object} modal - The dialog the page belongs to.
     * @param {string} systemId - The system the page renders.
     * @param {object} state - The scratch state of the page.
     * @param {object} system - The link system the page renders.
     */
    _typeField: function (pane, modal, systemId, state, system) {
        const element = document.createElement("div");
        element.className = "wx-relation-view-dialog-type";
        element.setAttribute("placeholder", this._text(modal, "relation.dialog.type.placeholder", "Pick a link type"));
        pane.appendChild(element);

        state.typeCtrl = new webexpress.webui.InputSelectionCtrl(element);
        state.typeCtrl.options = system.types.map((type) => ({
            id: type.id,
            value: type.id,
            label: type.label || type.id,
            content: this._escape(type.label || type.id),
            icon: type.icon ? webexpress.webui.IconSet.resolve(type.icon) : null
        }));
        state.typeCtrl.value = state.type ? [state.type] : [];

        // wired after the first relation was preselected, so preselecting it does
        // not count as a change and query the targets a second time
        element.addEventListener(webexpress.webui.Event.CHANGE_VALUE_EVENT, () => {
            state.type = (state.typeCtrl.value || [])[0] || "";

            // the accepted classes depend on the relation, so what was picked is
            // dropped and the candidates are asked for again rather than
            // filtered on what is already shown
            if (state.targetCtrl) {
                state.targetCtrl.value = [];
            }

            this._search(modal, systemId);
        });
    },

    /**
     * Builds the target picker.
     * @param {HTMLElement} pane - The page pane the field goes into.
     * @param {object} modal - The dialog the page belongs to.
     * @param {string} systemId - The system the page renders.
     * @param {object} state - The scratch state of the page.
     */
    _targetField: function (pane, modal, systemId, state) {
        const element = document.createElement("div");
        element.className = "wx-relation-view-dialog-search";
        element.setAttribute("placeholder", this._text(modal, "relation.dialog.search.placeholder", "Search object - key, title or class…"));
        element.dataset.debounce = String(this.searchDelay);

        // the control searches before a subclass could be handed anything, so
        // what its request needs is attached to the element it is built on
        element._wxRelationTarget = {
            panel: this,
            ctrl: modal._linkCtrl,
            state: state,
            system: systemId,
            empty: this._text(modal, "relation.dialog.no.matches", "No matches")
        };
        pane.appendChild(element);

        state.targetCtrl = new webexpress.webapp.RelationTargetSelectionCtrl(element);

        // the service already answered what matches the term - it also matches on
        // the class, which the caption of an option does not carry - so filtering
        // that answer again against the caption would drop candidates
        state.targetCtrl._optionfilter = () => true;

        element.addEventListener(webexpress.webui.Event.CHANGE_VALUE_EVENT, () => {
            const picked = (state.targetCtrl.value || [])[0] || null;

            state.target = picked ? (state.candidates.get(picked) || null) : null;
        });
    },

    /**
     * Asks the targets service for the candidates of the relation that is
     * currently picked.
     * @param {object} modal - The dialog the page belongs to.
     * @param {string} systemId - The system the page renders.
     * @returns {Promise<void>} Resolves when the candidates were rendered.
     */
    _search: function (modal, systemId) {
        const state = webexpress.webapp.relationViewModel.panelState(modal, systemId);

        return state.targetCtrl ? state.targetCtrl.receiveData("") : Promise.resolve();
    },

    /**
     * Clears the fields after a link was established.
     * @param {object} state - The scratch state of the page.
     */
    _reset: function (state) {
        state.target = null;
        state.comment = "";

        if (state.targetCtrl) {
            state.targetCtrl.value = [];
        }
        if (state.commentInput) {
            state.commentInput.value = "";
        }
    },

    /**
     * Builds one part of the caption of a candidate.
     * @param {string} part - The part, which names its css class.
     * @param {string} text - The text.
     * @returns {string} The markup.
     */
    _span: function (part, text) {
        return `<span class="wx-relation-view-dialog-suggestion-${part}">${this._escape(text)}</span>`;
    },

    /**
     * Escapes text that becomes markup of an option.
     * @param {string} text - The text.
     * @returns {string} The escaped text.
     */
    _escape: function (text) {
        return String(text == null ? "" : text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
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
