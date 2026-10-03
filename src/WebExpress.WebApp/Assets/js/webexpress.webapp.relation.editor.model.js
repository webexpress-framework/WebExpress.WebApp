var webexpress = webexpress || {}
webexpress.webapp = webexpress.webapp || {}

/**
 * Pure model helpers for the relation type administration. The rules an
 * administrator meets - what a complete type definition is, what a symmetric
 * relation implies, how a reordering rewrites the list and how the preview reads
 * from either end - live here rather than in the table or the editor, so both
 * agree and both can be tested without a DOM.
 *
 * See WebExpress.WebApp/docs/js/relation.editor.md.
 */
webexpress.webapp.relationEditorModel = {
    /**
     * The key the editor page is registered under in
     * webexpress.webui.DialogPanels. It lives on the model rather than on a
     * control, because the page reads it while it registers itself.
     */
    PANELS_KEY: "webexpress.webapp.relation.editor",

    /**
     * Returns the scratch state the editor page keeps inside a dialog. The page
     * is a shared definition rendered into one modal, so its field references
     * hang off that modal rather than off the definition.
     * @param {object} modal - The dialog the page renders in.
     * @returns {object} The scratch state.
     */
    panelState(modal) {
        modal._linkTypeState = modal._linkTypeState || {};

        return modal._linkTypeState;
    },

    /**
     * The cardinality tokens, in the notation the table renders. They are the
     * wire values as well, so nothing translates between the two.
     */
    CARDINALITIES: ["1:1", "1:n", "n:1", "n:n"],

    /**
     * The workflow effect tokens a relation may carry.
     */
    EFFECTS: ["none", "blocksCompletion", "closesItem", "aggregatesProgress"],

    /**
     * Normalises the answer of the type endpoint.
     * @param {*} data - The raw response payload.
     * @returns {object} The result as { items, total, active, classes }.
     */
    normalizeResult(data) {
        const items = (data && Array.isArray(data.items) ? data.items : []).map((item) => this.normalizeItem(item));

        return {
            items: items,
            total: Number.isFinite(data && data.total) ? data.total : items.length,
            active: Number.isFinite(data && data.active) ? data.active : items.filter((item) => item.active).length,
            classes: (data && Array.isArray(data.classes) ? data.classes : []).filter((entry) => entry && entry.id)
        };
    },

    /**
     * Normalises one type definition.
     * @param {object} item - The raw type.
     * @returns {object} The normalised type.
     */
    normalizeItem(item) {
        item = item || {};
        const classes = Array.isArray(item.targetClasses) ? item.targetClasses.filter((entry) => !!entry) : [];

        return {
            id: item.id || "",
            label: item.label || item.id || "",
            inverse: item.symmetric ? (item.label || item.id || "") : (item.inverse || ""),
            symmetric: item.symmetric === true,
            system: item.system || "",
            targetClasses: classes,
            allClasses: item.allClasses === true || classes.length === 0,
            cardinality: this.CARDINALITIES.indexOf(item.cardinality) >= 0 ? item.cardinality : "n:n",
            effect: this.EFFECTS.indexOf(item.effect) >= 0 ? item.effect : "none",
            usage: Number.isFinite(item.usage) ? item.usage : 0,
            active: item.active !== false,
            builtin: item.builtin === true,
            description: item.description || "",
            icon: item.icon || "link",
            order: Number.isFinite(item.order) ? item.order : 0
        };
    },

    /**
     * Returns an empty type definition, which is what the editor opens with when
     * a relation is defined rather than changed.
     * @returns {object} The draft.
     */
    emptyItem() {
        return this.normalizeItem({ label: "", inverse: "", cardinality: "1:1", effect: "none", active: true });
    },

    /**
     * Builds the path segment that addresses one type below the endpoint base.
     * @param {string} id - The type id.
     * @returns {string} The path.
     */
    typePath(id) {
        return "/" + encodeURIComponent(id);
    },

    /**
     * Builds the path segment that addresses the order of the types.
     * @returns {string} The path.
     */
    orderPath() {
        return "/order";
    },

    /**
     * Builds the body that defines or changes a type. A symmetric relation reads
     * alike from both ends, so its counterpart follows its label instead of
     * being stored separately.
     * @param {object} draft - The edited type.
     * @returns {object} The request body.
     */
    payload(draft) {
        draft = draft || {};

        return {
            id: draft.id || "",
            label: (draft.label || "").trim(),
            inverse: draft.symmetric ? (draft.label || "").trim() : (draft.inverse || "").trim(),
            symmetric: draft.symmetric === true,
            system: draft.system || "",
            targetClasses: draft.allClasses ? [] : (draft.targetClasses || []).slice(),
            cardinality: draft.cardinality || "n:n",
            effect: draft.effect || "none",
            active: draft.active !== false,
            description: draft.description || "",
            icon: draft.icon || "link",
            order: Number.isFinite(draft.order) ? draft.order : 0
        };
    },

    /**
     * Returns what is still missing in a definition, or null when it is
     * complete.
     * @param {object} draft - The edited type.
     * @param {function} i18n - The translation function of the caller.
     * @returns {string|null} The message.
     */
    validate(draft, i18n) {
        draft = draft || {};

        if (!(draft.label || "").trim()) {
            return i18n("webexpress.webapp:relation.type.label.required", "Please name the relation.");
        }

        if (!draft.symmetric && !(draft.inverse || "").trim()) {
            return i18n("webexpress.webapp:relation.type.inverse.required", "Please name the counterpart, or mark the relation as symmetric.");
        }

        if (!draft.allClasses && (draft.targetClasses || []).length === 0) {
            return i18n("webexpress.webapp:relation.type.classes.required", "Please pick at least one target class.");
        }

        return null;
    },

    /**
     * Builds the two sentences the editor previews: how the relation reads on
     * the object it is created from and how it reads on the other end.
     * @param {object} draft - The edited type.
     * @param {string} sample - The example key of the editing class.
     * @param {string} placeholder - The caption of an unspecified target.
     * @returns {Array<object>} The two readings as { left, relation, right }.
     */
    preview(draft, sample, placeholder) {
        draft = draft || {};
        const label = (draft.label || "").trim();
        const inverse = draft.symmetric ? label : (draft.inverse || "").trim();

        return [
            { left: sample, relation: label, right: placeholder, subject: "left" },
            { left: placeholder, relation: inverse, right: sample, subject: "right" }
        ];
    },

    /**
     * Moves a type in front of another one and returns the resulting order. The
     * move is computed rather than applied in place, so the table renders the
     * new order before the server has confirmed it and the request carries
     * exactly what the user sees.
     * @param {Array<object>} items - The current order.
     * @param {string} movedId - The dragged type.
     * @param {string} beforeId - The type it was dropped in front of, or null for the end.
     * @returns {Array<object>} The new order.
     */
    reorder(items, movedId, beforeId) {
        const list = (Array.isArray(items) ? items : []).slice();
        const from = list.findIndex((item) => item.id === movedId);

        if (from < 0 || movedId === beforeId) {
            return list;
        }

        const [moved] = list.splice(from, 1);
        const to = beforeId ? list.findIndex((item) => item.id === beforeId) : -1;

        if (to < 0) {
            list.push(moved);
        } else {
            list.splice(to, 0, moved);
        }

        return list;
    },

    /**
     * Returns the ids of an order, which is the body of the reorder request.
     * @param {Array<object>} items - The ordered types.
     * @returns {Array<string>} The ids.
     */
    orderIds(items) {
        return (Array.isArray(items) ? items : []).map((item) => item.id);
    },

    /**
     * Returns the caption of a workflow effect.
     * @param {string} effect - The effect token.
     * @param {function} i18n - The translation function of the caller.
     * @returns {string} The caption.
     */
    effectLabel(effect, i18n) {
        switch (effect) {
            case "blocksCompletion":
                return i18n("webexpress.webapp:relation.effect.blocks", "Blocks completion");
            case "closesItem":
                return i18n("webexpress.webapp:relation.effect.closes", "Closes item");
            case "aggregatesProgress":
                return i18n("webexpress.webapp:relation.effect.aggregates", "Aggregates progress");
            default:
                return "-";
        }
    },

    /**
     * Reads the reason of a rejected request, which the type endpoint answers as
     * { code, message }.
     * @param {object} result - The failed service result.
     * @param {object} ctrl - The control, whose _i18n carries the fallback.
     * @returns {string} The message to show.
     */
    faultMessage(result, ctrl) {
        return webexpress.webapp.relationViewModel.faultMessage(result, ctrl);
    }
};
