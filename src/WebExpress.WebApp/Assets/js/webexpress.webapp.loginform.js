/**
 * Login form controller. Builds a complete login form with username, password,
 * and submit button, then sends credentials to a REST endpoint via POST.
 *
 * The following events are triggered on the host element:
 * - webexpress.webui.Event.DATA_REQUESTED_EVENT
 * - webexpress.webui.Event.DATA_ARRIVED_EVENT
 */
webexpress.webapp.LoginFormCtrl = class extends webexpress.webui.Ctrl {
    /**
     * Creates a new login form controller.
     * @param {HTMLFormElement} element - The form element to enhance.
     */
    constructor(element) {
        super(element);

        const el = this._element;

        // read configuration from data-attributes
        this._apiEndpoint = el.getAttribute("data-uri") || null;
        this._redirectUri = el.getAttribute("data-redirect") || null;
        this._usernameLabel = el.getAttribute("data-username-label") || this._i18n("webexpress.webapp:login.username.label", "Username");
        this._usernamePlaceholder = el.getAttribute("data-username-placeholder") || this._i18n("webexpress.webapp:login.username.placeholder", "Enter your username");
        this._passwordLabel = el.getAttribute("data-password-label") || this._i18n("webexpress.webapp:login.password.label", "Password");
        this._passwordPlaceholder = el.getAttribute("data-password-placeholder") || this._i18n("webexpress.webapp:login.password.placeholder", "Enter your password");
        this._submitLabel = el.getAttribute("data-submit-label") || this._i18n("webexpress.webapp:login.submit.label", "Sign in");

        // internal state
        this._submitting = false;
        this._retryTimer = null;
        this._retryCountdown = 0;

        // remove config-bearing attributes
        [
            "data-uri",
            "data-redirect",
            "data-username-label",
            "data-username-placeholder",
            "data-password-label",
            "data-password-placeholder",
            "data-submit-label"
        ].forEach((attr) => {
            el.removeAttribute(attr);
        });

        el.classList.add("wx-loginform");

        // build dom
        this._buildDom();

        // attach submit handler
        this._onSubmitBound = this._onSubmit.bind(this);
        el.addEventListener("submit", this._onSubmitBound, true);
    }

    /**
     * Builds the DOM subtree for the login form.
     */
    _buildDom() {
        const el = this._element;
        el.innerHTML = "";

        // error container
        this._errorContainer = document.createElement("div");
        this._errorContainer.className = "alert alert-danger";
        this._errorContainer.style.display = "none";
        this._errorContainer.setAttribute("role", "alert");

        // username group
        const usernameGroup = document.createElement("div");
        usernameGroup.className = "mb-3";
        const usernameLabel = document.createElement("label");
        usernameLabel.className = "form-label";
        usernameLabel.setAttribute("for", this._element.id + "-username");
        usernameLabel.textContent = this._usernameLabel;
        this._usernameInput = document.createElement("input");
        this._usernameInput.type = "text";
        this._usernameInput.className = "form-control";
        this._usernameInput.id = this._element.id + "-username";
        this._usernameInput.name = "username";
        this._usernameInput.placeholder = this._usernamePlaceholder;
        this._usernameInput.setAttribute("autocomplete", "username");
        this._usernameInput.required = true;
        usernameGroup.appendChild(usernameLabel);
        usernameGroup.appendChild(this._usernameInput);

        // password group
        const passwordGroup = document.createElement("div");
        passwordGroup.className = "mb-3";
        const passwordLabel = document.createElement("label");
        passwordLabel.className = "form-label";
        passwordLabel.setAttribute("for", this._element.id + "-password");
        passwordLabel.textContent = this._passwordLabel;

        // password input wrapper with visibility toggle
        const passwordWrapper = document.createElement("div");
        passwordWrapper.className = "input-group";
        this._passwordInput = document.createElement("input");
        this._passwordInput.type = "password";
        this._passwordInput.className = "form-control";
        this._passwordInput.id = this._element.id + "-password";
        this._passwordInput.name = "password";
        this._passwordInput.placeholder = this._passwordPlaceholder;
        this._passwordInput.setAttribute("autocomplete", "current-password");
        this._passwordInput.required = true;

        this._toggleBtn = document.createElement("button");
        this._toggleBtn.type = "button";
        this._toggleBtn.className = "btn btn-outline-secondary";
        this._toggleBtn.setAttribute("tabindex", "-1");
        this._toggleIcon = document.createElement("i");
        this._toggleIcon.className = "bi bi-eye";
        this._toggleBtn.appendChild(this._toggleIcon);
        this._passwordVisible = false;

        this._toggleBtn.addEventListener("click", () => {
            this._passwordVisible = !this._passwordVisible;
            this._passwordInput.type = this._passwordVisible ? "text" : "password";
            this._toggleIcon.className = this._passwordVisible ? "bi bi-eye-slash" : "bi bi-eye";
        });

        passwordWrapper.appendChild(this._passwordInput);
        passwordWrapper.appendChild(this._toggleBtn);
        passwordGroup.appendChild(passwordLabel);
        passwordGroup.appendChild(passwordWrapper);

        // submit button
        const buttonGroup = document.createElement("div");
        buttonGroup.className = "d-grid";
        this._submitBtn = document.createElement("button");
        this._submitBtn.type = "submit";
        this._submitBtn.className = "btn btn-primary";
        this._submitBtn.textContent = this._submitLabel;
        buttonGroup.appendChild(this._submitBtn);

        // assemble
        el.appendChild(this._errorContainer);
        el.appendChild(usernameGroup);
        el.appendChild(passwordGroup);
        el.appendChild(buttonGroup);
    }

    /**
     * Handles form submission by sending credentials to the REST API.
     * @param {Event} evt - The submit event.
     */
    async _onSubmit(evt) {
        evt.preventDefault();
        evt.stopPropagation();

        if (this._submitting) {
            return;
        }

        // clear previous errors
        this._hideError();

        const username = this._usernameInput.value.trim();
        const password = this._passwordInput.value;

        // client-side validation
        if (!username || !password) {
            this._showError(this._i18n("webexpress.webapp:login.error.empty", "Username and password are required."));
            return;
        }

        if (!this._apiEndpoint) {
            this._showError(this._i18n("webexpress.webapp:error.no_endpoint", "No API endpoint configured."));
            return;
        }

        this._submitting = true;
        this._submitBtn.disabled = true;
        this._submitBtn.textContent = "…";

        this._dispatchEvent(webexpress.webui.Event.DATA_REQUESTED_EVENT, {
            username: username
        });

        try {
            const response = await fetch(this._apiEndpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json; charset=utf-8"
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            this._dispatchEvent(webexpress.webui.Event.DATA_ARRIVED_EVENT, data);

            if (data.success) {
                // successful login
                if (this._redirectUri) {
                    window.location.href = this._redirectUri;
                } else {
                    window.location.reload();
                }
                return;
            }

            // handle rate limiting
            if (data.retryAfter && data.retryAfter > 0) {
                this._startRetryCountdown(data.retryAfter, data.message);
                return;
            }

            // authentication failed
            this._showError(data.message || this._i18n("webexpress.webapp:login.error.invalid", "Invalid username or password."));
        } catch (err) {
            this._showError(this._i18n("webexpress.webapp:error.generic", "An error occurred."));
        } finally {
            this._submitting = false;
            if (!this._retryTimer) {
                this._submitBtn.disabled = false;
                this._submitBtn.textContent = this._submitLabel;
            }
        }
    }

    /**
     * Shows an error message in the error container.
     * @param {string} message - The error message to display.
     */
    _showError(message) {
        this._errorContainer.textContent = message;
        this._errorContainer.style.display = "block";
    }

    /**
     * Hides the error container.
     */
    _hideError() {
        this._errorContainer.style.display = "none";
        this._errorContainer.textContent = "";
    }

    /**
     * Starts a countdown timer that disables the submit button.
     * @param {number} seconds - The number of seconds to wait.
     * @param {string} message - The message to display.
     */
    _startRetryCountdown(seconds, message) {
        this._retryCountdown = seconds;
        this._submitBtn.disabled = true;
        this._showError(message || "Too many failed attempts.");
        this._updateRetryButton();

        this._retryTimer = setInterval(() => {
            this._retryCountdown--;
            if (this._retryCountdown <= 0) {
                clearInterval(this._retryTimer);
                this._retryTimer = null;
                this._submitBtn.disabled = false;
                this._submitBtn.textContent = this._submitLabel;
                this._hideError();
            } else {
                this._updateRetryButton();
            }
        }, 1000);
    }

    /**
     * Updates the submit button text with the retry countdown.
     */
    _updateRetryButton() {
        this._submitBtn.textContent = this._submitLabel + " (" + this._retryCountdown + "s)";
    }
};

// auto-initialize
webexpress.webapp.initLoginForm = () => {
    document.querySelectorAll(".wx-webapp-loginform").forEach((el) => {
        if (!el._wxLoginFormCtrl) {
            el._wxLoginFormCtrl = new webexpress.webapp.LoginFormCtrl(el);
        }
    });
};

document.addEventListener("DOMContentLoaded", () => {
    webexpress.webapp.initLoginForm();
});
