/**
 * A REST-backed password input control that extends the base InputPasswordCtrl
 * from WebExpress.WebUI. Inherits the visibility toggle and input handling,
 * adding only the REST-specific CSS class swap.
 */
webexpress.webapp.InputPasswordCtrl = class extends webexpress.webui.InputPasswordCtrl {
    /**
     * Creates a new REST password input control instance.
     * @param {HTMLElement} element - The host element for the control.
     */
    constructor(element) {
        super(element);

        // swap class from WebUI base to WebApp
        this._element.classList.remove("wx-webui-input-password");
        this._element.classList.add("wx-webapp-input-password");
    }
};

// register the class in the controller
webexpress.webapp.Controller?.registerClass?.("wx-webapp-input-password", webexpress.webapp.InputPasswordCtrl);
