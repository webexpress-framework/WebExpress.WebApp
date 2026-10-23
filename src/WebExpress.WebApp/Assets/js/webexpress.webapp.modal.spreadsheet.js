/**
 * The dialog a workbook is worked on in: the spreadsheet as the whole of its content, the
 * workbook's name on its title bar, and on the footer bar - beside the publish button - the
 * switch to the reading view, who else is here, the save state and the overflow menu.
 *
 * Drafting, publishing, discarding, sharing and the bar are those of the document dialog this
 * class extends (see webexpress.webapp.ModalEditorCtrl), and so are its events. A workbook only
 * differs in what the body is: the value read for the reading view is the spreadsheet's JSON,
 * and the reading view is a spreadsheet without toolbar, formula bar and editing - what a page
 * showing the published workbook read-only would show.
 */
webexpress.webapp.ModalSpreadsheetCtrl = class extends webexpress.webapp.ModalEditorCtrl {

    /**
     * Creates the host of the reading view: a read-only spreadsheet in the language of the
     * surface, filled from the surface when it is shown.
     * @returns {HTMLElement} The host, not yet in the document.
     */
    _createPreview() {
        const preview = document.createElement("div");
        preview.className = "wx-webui-spreadsheet wx-editor-form-preview";
        preview.setAttribute("data-readonly", "true");
        preview.setAttribute("data-toolbar", "false");
        preview.setAttribute("data-formula-bar", "false");
        preview.setAttribute("data-fill", "true");

        const locale = this._surfaceHost()?.getAttribute("data-locale");

        if (locale) {
            preview.setAttribute("data-locale", locale);
        }

        // the reading view is filled from the surface, so its own change is no change of the
        // document: it would otherwise reach the form as an edit and be drafted
        preview.addEventListener(webexpress.webui.Event.CHANGE_VALUE_EVENT, (event) => event.stopPropagation());

        return preview;
    }

    /**
     * Returns what the spreadsheet holds, as the workbook's JSON.
     * @returns {string|null} The workbook, or null without a spreadsheet, which the reading view
     * shows as an empty workbook.
     */
    _value() {
        const host = this._surfaceHost();
        const ctrl = host ? webexpress.webui.Controller.getInstanceByElement(host) : null;

        return ctrl?.value ?? null;
    }

    /**
     * Finds the host of the spreadsheet the author works in. The reading view is a spreadsheet
     * too and sits in the same dialog, so it is excluded by name rather than by order.
     * @returns {HTMLElement|null} The host, or null.
     */
    _surfaceHost() {
        return Array.from(this._element.querySelectorAll(".wx-spreadsheet")).find((element) => !this._preview?.contains(element)) ?? null;
    }
};

// register for declarative auto-init
webexpress.webui.Controller.registerClass("wx-webapp-modal-spreadsheet", webexpress.webapp.ModalSpreadsheetCtrl);
