/**
 * Password input control that renders a password field with a visibility toggle.
 * Configuration is read from data-attributes on the host element.
 * The control dispatches the following events on the host element:
 * - webexpress.webui.Event.CHANGE_VALUE_EVENT
 */
webexpress.webapp.InputPasswordCtrl = class extends webexpress.webui.Ctrl {
    /**
     * Creates a new password input control instance.
     * @param {HTMLElement} element - The host element for the control.
     */
    constructor(element) {
        super(element);

        // read configuration from attributes
        const el = this._element;
        this._fieldName = el.getAttribute("name") || "password";
        this._initialValue = el.getAttribute("data-value") || "";
        this._placeholderText = el.getAttribute("placeholder") || "";
        this._minlength = parseInt(el.getAttribute("data-minlength") || "0", 10);
        this._maxlength = parseInt(el.getAttribute("data-maxlength") || "0", 10);

        // internal state
        this._currentValue = this._initialValue;
        this._visible = false;

        // prepare host element
        el.classList.add("wx-password");
        el.innerHTML = "";

        // remove config-bearing attributes from the host as they are now internal
        [
            "name",
            "placeholder",
            "data-value",
            "data-minlength",
            "data-maxlength"
        ].forEach((attr) => {
            el.removeAttribute(attr);
        });

        // build dom
        this._buildDom();
    }

    /**
     * Builds the DOM subtree for the control and wires event listeners.
     */
    _buildDom() {
        // wrapper for input group
        this._wrapper = document.createElement("div");
        this._wrapper.className = "input-group";

        // password input
        this._input = document.createElement("input");
        this._input.type = "password";
        this._input.className = "input form-control";
        this._input.value = this._currentValue;
        if (this._placeholderText) {
            this._input.setAttribute("placeholder", this._placeholderText);
        }
        this._input.setAttribute("autocomplete", "current-password");
        this._input.setAttribute("spellcheck", "false");
        this._input.name = this._fieldName;

        // toggle visibility button
        this._toggleBtn = document.createElement("button");
        this._toggleBtn.type = "button";
        this._toggleBtn.className = "btn btn-outline-secondary";
        this._toggleBtn.setAttribute("tabindex", "-1");

        this._toggleIcon = document.createElement("i");
        this._toggleIcon.className = "bi bi-eye";
        this._toggleBtn.appendChild(this._toggleIcon);

        // assemble
        this._wrapper.appendChild(this._input);
        this._wrapper.appendChild(this._toggleBtn);
        this._element.appendChild(this._wrapper);

        // event listeners
        this._input.addEventListener("input", () => {
            this._currentValue = this._input.value;
            this._dispatchEvent(webexpress.webui.Event.CHANGE_VALUE_EVENT, {
                name: this._fieldName,
                value: this._currentValue
            });
        });

        this._toggleBtn.addEventListener("click", () => {
            this._visible = !this._visible;
            this._input.type = this._visible ? "text" : "password";
            this._toggleIcon.className = this._visible ? "bi bi-eye-slash" : "bi bi-eye";
        });
    }

    /**
     * Returns the current value of the password input.
     * @returns {string} The current password value.
     */
    getValue() {
        return this._input ? this._input.value : this._currentValue;
    }

    /**
     * Sets the value of the password input.
     * @param {string} val - The value to set.
     */
    setValue(val) {
        this._currentValue = val || "";
        if (this._input) {
            this._input.value = this._currentValue;
        }
    }

    /**
     * Returns the field name.
     * @returns {string} The field name.
     */
    getFieldName() {
        return this._fieldName;
    }
};

// auto-initialize
webexpress.webapp.initInputPassword = () => {
    document.querySelectorAll(".wx-webapp-input-password").forEach((el) => {
        if (!el._wxPasswordCtrl) {
            el._wxPasswordCtrl = new webexpress.webapp.InputPasswordCtrl(el);
        }
    });
};

document.addEventListener("DOMContentLoaded", () => {
    webexpress.webapp.initInputPassword();
});
