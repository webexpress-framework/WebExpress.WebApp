/**
 * A REST-backed login form controller that extends the base LoginCtrl
 * from WebExpress.WebUI. Inherits the login form UI, overriding submission
 * to send credentials to a REST endpoint via POST with JSON payload,
 * and adding support for rate-limiting with a retry countdown.
 *
 * The following events are triggered on the host element:
 * - webexpress.webui.Event.DATA_REQUESTED_EVENT
 * - webexpress.webui.Event.DATA_ARRIVED_EVENT
 */
webexpress.webapp.LoginFormCtrl = class extends webexpress.webui.LoginCtrl {
    /**
     * Creates a new REST login form controller.
     * @param {HTMLElement} element - The host element for the login control.
     */
    constructor(element) {
        super(element);

        // read REST-specific configuration
        this._apiEndpoint = element.dataset.uri || null;
        this._redirectUri = element.dataset.redirect || null;

        // clean up REST-specific data attributes
        element.removeAttribute("data-uri");
        element.removeAttribute("data-redirect");

        // swap class from WebUI base to WebApp
        this._element.classList.remove("wx-webui-login");
        this._element.classList.add("wx-webapp-loginform");

        // internal state for rate limiting
        this._submitting = false;
        this._retryTimer = null;
        this._retryCountdown = 0;

        // add error container before the form
        this._errorContainer = document.createElement("div");
        this._errorContainer.className = "alert alert-danger";
        this._errorContainer.style.display = "none";
        this._errorContainer.setAttribute("role", "alert");

        if (this._form && this._form.firstChild) {
            this._form.insertBefore(this._errorContainer, this._form.firstChild);
        }
    }

    /**
     * Override the base event handlers to use REST-based authentication
     * instead of the basic auth approach in the base class.
     */
    _attachEventHandlers() {
        this._form.addEventListener("submit", (e) => {
            e.preventDefault();

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
            this._loginBtn.disabled = true;
            var submitLabel = this._loginBtn.textContent;
            this._loginBtn.textContent = "…";

            this._dispatch(webexpress.webui.Events.DATA_REQUESTED_EVENT, {
                username: username
            });

            fetch(this._apiEndpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json; charset=utf-8"
                },
                body: JSON.stringify({ username, password })
            }).then((response) => {
                return response.json().then((data) => {
                    this._dispatch(webexpress.webui.Events.DATA_ARRIVED_EVENT, data);

                    if (data.success) {
                        // successful login
                        if (data.sessionId) {
                            document.cookie = "session=" + encodeURIComponent(data.sessionId) + "; path=/";
                        }

                        if (this._redirectUri) {
                            window.location.href = this._redirectUri;
                        } else {
                            window.location.reload();
                        }
                        return;
                    }

                    // handle rate limiting
                    if (data.retryAfter && data.retryAfter > 0) {
                        this._startRetryCountdown(data.retryAfter, data.message, submitLabel);
                        return;
                    }

                    // authentication failed
                    this._showError(data.message || this._i18n("webexpress.webapp:login.error.invalid", "Invalid username or password."));
                    this._submitting = false;
                    this._loginBtn.disabled = false;
                    this._loginBtn.textContent = submitLabel;
                });
            }).catch(() => {
                this._showError(this._i18n("webexpress.webapp:error.generic", "An error occurred."));
                this._submitting = false;
                this._loginBtn.disabled = false;
                this._loginBtn.textContent = submitLabel;
            });
        });
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
     * @param {string} submitLabel - The original submit button label.
     */
    _startRetryCountdown(seconds, message, submitLabel) {
        this._retryCountdown = seconds;
        this._loginBtn.disabled = true;
        this._showError(message || "Too many failed attempts.");
        this._loginBtn.textContent = submitLabel + " (" + this._retryCountdown + "s)";

        this._retryTimer = setInterval(() => {
            this._retryCountdown--;
            if (this._retryCountdown <= 0) {
                clearInterval(this._retryTimer);
                this._retryTimer = null;
                this._submitting = false;
                this._loginBtn.disabled = false;
                this._loginBtn.textContent = submitLabel;
                this._hideError();
            } else {
                this._loginBtn.textContent = submitLabel + " (" + this._retryCountdown + "s)";
            }
        }, 1000);
    }
};

// register the class in the controller
webexpress.webapp.Controller?.registerClass?.("wx-webapp-loginform", webexpress.webapp.LoginFormCtrl);
