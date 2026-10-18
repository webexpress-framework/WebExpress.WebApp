var webexpress = webexpress || {}
webexpress.webapp = webexpress.webapp || {}

/**
 * Projects the state of a webexpress.webapp.WqlPromptModel onto the editable surface of a WQL
 * prompt and maps DOM boundaries back to model positions.
 *
 * The view holds no text of its own: whatever it renders is derived from a model state, and
 * whatever it reads back (text, selection, target ranges) is handed to the controller, which
 * decides how the model changes. Highlighting markup, line wrappers and caret placeholders exist
 * only on the surface and never reach a model position.
 */
webexpress.webapp.WqlPromptView = class {
    /**
     * Binds the view to the elements it draws into.
     * @param {HTMLElement} surface - The contenteditable element showing the text.
     * @param {HTMLElement} listbox - The listbox publishing the suggestions.
     */
    constructor(surface, listbox) {
        this._surface = surface;
        this._listbox = listbox;
    }

    /**
     * Renders the text with syntax highlighting and puts the selection back when the surface owns
     * it, so a render while the user works elsewhere on the page does not pull the focus.
     * @param {object} state - The model state to show.
     */
    render(state) {
        // decided before the old nodes go, as a selection in removed nodes no longer points here
        const restore = this.ownsSelection();
        const syntaxFunction = webexpress.webui.Syntax?.get?.("wql");
        if (typeof syntaxFunction === "function") {
            this._surface.innerHTML = syntaxFunction(state.text);
            this._surface.querySelectorAll(".wx-code-line").forEach((line) => {
                if (!line.firstChild) {
                    // empty lines need a caret target without contributing query text
                    line.textContent = "​";
                }
            });
        } else {
            this._surface.textContent = state.text;
        }
        if (restore) {
            this.showSelection(state.selection, true);
        }
    }

    /**
     * Tells whether the document selection belongs to the surface; only then may it be moved,
     * since placing a selection in an unfocused editable steals the focus in some browsers.
     * @returns {boolean} True when the surface holds the focus or the selection.
     */
    ownsSelection() {
        const selection = window.getSelection();
        return document.activeElement === this._surface
            || !!(selection && selection.rangeCount && this._surface.contains(selection.anchorNode));
    }

    /**
     * Shows a model selection on the surface, keeping its direction.
     * @param {object} selection - The { anchor, focus } pair in model positions.
     * @param {boolean} [force=false] - Writes the selection even when the surface does not own it.
     */
    showSelection(selection, force = false) {
        const documentSelection = window.getSelection();
        if (!documentSelection || (!force && !this.ownsSelection())) {
            return;
        }
        const map = this.map();
        const a = map.positions[Math.min(selection.anchor, map.text.length)];
        const f = map.positions[Math.min(selection.focus, map.text.length)];
        if (a && f) {
            documentSelection.setBaseAndExtent(a.node, a.offset, f.node, f.offset);
        }
    }

    /**
     * Reads the document selection in model positions, keeping its direction.
     * @param {object} [map] - A text map of the surface already at hand.
     * @returns {object|null} Anchor and focus when both lie on the surface.
     */
    readSelection(map) {
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount || !this._surface.contains(selection.anchorNode)
            || !this._surface.contains(selection.focusNode)) {
            return null;
        }
        map = map || this.map();
        const anchor = this.offsetOf(map, selection.anchorNode, selection.anchorOffset);
        const focus = this.offsetOf(map, selection.focusNode, selection.focusOffset);
        return anchor === null || focus === null ? null : { anchor: anchor, focus: focus };
    }

    /**
     * Maps visible WQL text and DOM boundaries through the same newline rules.
     * Inline syntax spans do not separate lines, while line wrappers and breaks do.
     * @returns {object} The text, DOM positions and normalized offsets per node.
     */
    map() {
        let text = "";
        const positions = [{ node: this._surface, offset: 0 }];
        const offsets = new Map();
        const isLine = (node) => node.nodeType === Node.ELEMENT_NODE
            && (node.classList.contains("wx-code-line") || ["DIV", "P"].includes(node.nodeName));

        /**
         * Records every DOM boundary, including invisible placeholder characters.
         * @param {Node} node - The subtree whose text contributes to the editor.
         */
        const visit = (node) => {
            const boundaries = [];
            offsets.set(node, boundaries);
            if (node.nodeType === Node.TEXT_NODE) {
                for (let i = 0; i <= node.data.length; i++) {
                    boundaries[i] = text.length;
                    positions[text.length] = { node: node, offset: i };
                    if (i < node.data.length && node.data[i] !== "​") {
                        text += node.data[i];
                    }
                }
                return;
            }
            boundaries[0] = text.length;
            if (node.nodeName === "BR") {
                text += "\n";
                return;
            }
            const children = Array.from(node.childNodes);
            if (children.length === 0) {
                positions[text.length] = { node: node, offset: 0 };
            }
            children.forEach((child, index) => {
                const previous = children[index - 1];
                if (previous && previous.nodeName !== "BR" && (isLine(child) || isLine(previous))
                    && (!text.endsWith("\n") || isLine(previous))) {
                    text += "\n";
                    positions[text.length] = { node: node, offset: index };
                }
                boundaries[index] = text.length;
                visit(child);
                boundaries[index + 1] = text.length;
                if (!positions[text.length]) {
                    positions[text.length] = { node: node, offset: index + 1 };
                }
            });
        };
        visit(this._surface);
        return { text: text, positions: positions, offsets: offsets };
    }

    /**
     * Converts a DOM boundary to a model position.
     * @param {object} map - The text map of the surface.
     * @param {Node} node - The boundary container.
     * @param {number} offset - The boundary offset.
     * @returns {number|null} The position, or null outside the surface.
     */
    offsetOf(map, node, offset) {
        const value = map.offsets.get(node)?.[offset];
        return value === undefined ? null : value;
    }

    /**
     * Converts the browser's target range of an input to model positions.
     * @param {InputEvent} e - The beforeinput event.
     * @returns {number[]|null} [start, end], or null when the browser gives no usable range.
     */
    targetRange(e) {
        const ranges = typeof e.getTargetRanges === "function" ? e.getTargetRanges() : [];
        if (!ranges || !ranges.length) {
            return null;
        }
        const map = this.map();
        const start = this.offsetOf(map, ranges[0].startContainer, ranges[0].startOffset);
        const end = this.offsetOf(map, ranges[0].endContainer, ranges[0].endOffset);
        return start === null || end === null ? null : [start, end];
    }

    /**
     * Finds the model position under a pointer position.
     * @param {number} x - The client x coordinate.
     * @param {number} y - The client y coordinate.
     * @returns {number|null} The position, or null when it lies outside the surface.
     */
    offsetFromPoint(x, y) {
        const position = document.caretPositionFromPoint?.(x, y);
        const range = position ? null : document.caretRangeFromPoint?.(x, y);
        const node = position ? position.offsetNode : range?.startContainer;
        const offset = position ? position.offset : range?.startOffset;
        return node ? this.offsetOf(this.map(), node, offset) : null;
    }

    /**
     * Keeps a newly added last line in view when the surface has grown beyond its height.
     */
    scrollToEnd() {
        if (this._surface.scrollHeight > this._surface.clientHeight) {
            this._surface.scrollTop = this._surface.scrollHeight;
        }
    }

    /**
     * Publishes the offered completions as the combobox's listbox, with the one Tab would
     * accept as the active option.
     * @param {string[]} items - The suggestions; empty collapses the combobox.
     * @param {number} active - The index of the highlighted suggestion.
     */
    renderSuggestions(items, active) {
        const options = items.map((suggestion, index) => {
            const option = document.createElement("li");
            option.id = `${this._listbox.id}-${index}`;
            option.setAttribute("role", "option");
            option.setAttribute("aria-selected", String(index === active));
            option.textContent = suggestion;
            return option;
        });
        this._listbox.replaceChildren(...options);
        this._surface.setAttribute("aria-expanded", String(options.length > 0));
        if (options.length > 0) {
            this._surface.setAttribute("aria-activedescendant", (options[active] ?? options[0]).id);
        } else {
            this._surface.removeAttribute("aria-activedescendant");
        }
    }
};
