/**
 * A modular form.
 * Triggers the following events:
 * - webexpress.webui.Event.MODAL_SHOW_EVENT
 * - webexpress.webui.Event.MODAL_HIDE_EVENT
 */
webexpress.webapp.ModalFormCtrl = class extends webexpress.webui.ModalFormCtrl {

    /**
     * Constructor
     */
    constructor() {
        super(document.createElement("div"));

        document.body.appendChild(this._element);
    }
};
