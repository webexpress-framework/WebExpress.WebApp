/**
 * Renders a workflow status as a colored chip, so the cards and the status dialogs show a
 * state in the same color the application assigned to it.
 */
webexpress.webapp.KanbanStatusChip = class {
    /**
     * Creates the chip of a status. A status without a color receives no fill class, which
     * leaves its look to the container.
     * @param {object} status - The normalized status with label, colorCss, and colorStyle.
     * @param {string} className - The class distinguishing the place the chip is shown in.
     * @returns {HTMLElement} The chip element.
     */
    static create(status, className) {
        const chip = document.createElement("span");
        chip.className = className;
        if (status.colorCss) {
            chip.classList.add(...status.colorCss.split(/\s+/).filter(Boolean));
        } else if (status.colorStyle) {
            // assigned through the cssom, which the content security policy permits where a
            // style attribute in markup would be blocked
            chip.style.cssText = status.colorStyle;
        }
        chip.textContent = status.label;
        return chip;
    }

    /**
     * Tells whether the application assigned a color to the status.
     * @param {object} status - The normalized status.
     * @returns {boolean} True when the status carries a system or user-defined color.
     */
    static hasColor(status) {
        return !!(status && (status.colorCss || status.colorStyle));
    }
};

/**
 * Uses the data selection control with the status catalog already loaded by the board.
 * The catalog belongs to the current board response, so opening this picker does not issue another request.
 */
webexpress.webapp.KanbanStatusSelectionCtrl = class extends webexpress.webapp.InputSelectionCtrl {
    /**
     * Supplies the current catalog while retaining the selection control's local filtering.
     */
    receiveData() {
        this.options = (this._element._wxKanbanStatuses || []).map((status) => {
            // selection options accept markup, but workflow labels are plain text
            const text = document.createElement("span");
            text.textContent = status.label;
            return {
                id: status.id,
                label: status.label,
                content: text.innerHTML,
                // a status without a color keeps the chip color of every other selection
                color: status.colorCss || (status.colorStyle ? "" : "wx-selection-primary"),
                style: status.colorStyle,
                type: "option"
            };
        });
    }
};

/**
 * Keeps status edits provisional until the user explicitly confirms them.
 * The same dialog supports column assignments and a single destination status.
 */
webexpress.webapp.KanbanStatusDialog = class extends webexpress.webui.ModalCtrl {
    _statusSelection = null;

    /**
     * Creates an owned dialog outside the board so a render cannot remove it.
     */
    constructor() {
        super(document.createElement("dialog"));
        document.body.appendChild(this._element);
    }

    /**
     * Removes the owned dialog and releases any active browser focus trap.
     */
    destroy() {
        this.hide();
        this._statusSelection?.destroy();
        this._statusSelection = null;
        this._element.remove();
        super.destroy();
    }

    /**
     * Opens a fresh selection without modifying the board on cancellation.
     * @param {string} title - The accessible dialog title.
     * @param {Array<object>} statuses - The available status identifiers and labels.
     * @param {Array<string>} selected - The initially assigned status identifiers.
     * @param {boolean} multiple - Whether several statuses may be selected.
     * @param {Function} onSave - Receives the confirmed status identifiers.
     */
    open(title, statuses, selected, multiple, onSave) {
        this._statusSelection?.destroy();
        this._statusSelection = null;
        this._titleHeading.textContent = title;
        this._bodyDiv.replaceChildren();
        this._footerDiv.replaceChildren();

        const help = document.createElement("p");
        help.textContent = statuses.length === 0
            ? this._i18n("webexpress.webapp:kanban.status.empty", "No valid destination status is available.")
            : multiple
                ? this._i18n("webexpress.webapp:kanban.status.help", "Select the statuses assigned to this column.")
                : this._i18n("webexpress.webapp:kanban.status.choose.help", "Select the destination status for this card.");
        this._bodyDiv.appendChild(help);

        const group = document.createElement("fieldset");
        const legend = document.createElement("legend");
        legend.className = "visually-hidden";
        legend.textContent = title;
        group.appendChild(legend);
        this._bodyDiv.appendChild(group);
        const inputs = [];
        if (multiple) {
            const picker = document.createElement("div");
            picker.id = this._element.id + "-statuses";
            picker.setAttribute("placeholder", this._i18n("webexpress.webapp:kanban.status.column", "Column statuses"));
            picker.dataset.multiselection = "true";
            picker._wxKanbanStatuses = statuses;
            group.appendChild(picker);
            this._statusSelection = new webexpress.webapp.KanbanStatusSelectionCtrl(picker);
            this._statusSelection.value = statuses.filter((status) => selected.includes(status.id)).map((status) => status.id);
        } else {
            for (const status of statuses) {
                const label = document.createElement("label");
                label.className = "form-check d-flex align-items-center gap-2 mb-2";
                const input = document.createElement("input");
                input.type = "radio";
                input.name = this._element.id + "-status";
                input.value = status.id;
                input.className = "form-check-input m-0";
                input.checked = selected.includes(status.id);
                label.appendChild(input);
                label.appendChild(webexpress.webapp.KanbanStatusChip.hasColor(status)
                    ? webexpress.webapp.KanbanStatusChip.create(status, "badge")
                    : document.createTextNode(status.label));
                group.appendChild(label);
                inputs.push(input);
            }
        }

        const save = document.createElement("button");
        save.type = "button";
        save.className = "btn btn-primary";
        save.textContent = multiple
            ? this._i18n("webexpress.webui:save", "Save")
            : this._i18n("webexpress.webapp:kanban.status.move", "Move card");
        save.disabled = !multiple;
        group.addEventListener("change", () => {
            save.disabled = !multiple && !inputs.some((input) => input.checked);
        });
        save.addEventListener("click", () => {
            const values = multiple
                ? this._statusSelection.value.slice()
                : inputs.filter((input) => input.checked).map((input) => input.value);
            if (!multiple && values.length !== 1) {
                return;
            }
            this.hide();
            onSave(values);
        });
        this._cancelButton.textContent = this._i18n("webexpress.webapp:kanban.status.cancel", "Cancel");
        this._footerDiv.append(save, this._cancelButton);
        this.show();
    }
};
