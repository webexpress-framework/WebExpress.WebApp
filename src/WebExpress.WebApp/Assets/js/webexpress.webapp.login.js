/**
 * A REST-backed login form controller that extends the base LoginCtrl
 * from WebExpress.WebUI. Inherits the login form UI, overriding submission
 * to send credentials to a REST endpoint via POST with JSON payload,
 * and adding support for rate-limiting with an exponential retry countdown
 * and an account lockout after a specific amount of failed attempts.
 *
 * The following events are triggered on the host element:
 * - webexpress.webui.Event.DATA_REQUESTED_EVENT
 * - webexpress.webui.Event.DATA_ARRIVED_EVENT
 */
webexpress.webapp.LoginCtrl = class extends webexpress.webui.LoginCtrl {
    /**
     * Creates a new REST login form controller.
     * @param {HTMLElement} element - The host element for the login control.
     */
    constructor(element) {
        super(element);

        // read rest-specific configuration
        this._apiEndpoint = element.dataset.uri || null;
        this._redirectUri = element.dataset.redirect || null;

        // clean up rest-specific data attributes
        element.removeAttribute("data-uri");
        element.removeAttribute("data-redirect");

        // swap class from webui base to webapp
        this._element.classList.remove("wx-webui-login");
        this._element.classList.add("wx-webapp-loginform");

        // internal state for rate limiting and account locking
        this._submitting = false;
        this._retryTimer = null;
        this._retryCountdown = 0;
        this._failedAttempts = 0;

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

            // block submission if currently processing, locked out or in countdown
            if (this._submitting || this._failedAttempts >= 5) {
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
            const submitLabel = this._loginBtn.textContent;
            this._loginBtn.textContent = "…";

            this._dispatch(webexpress.webui.Event.DATA_REQUESTED_EVENT, {
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
                    this._dispatch(webexpress.webui.Event.DATA_ARRIVED_EVENT, data);

                    if (data.success) {
                        // reset failed attempts on successful login
                        this._failedAttempts = 0;

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

                    // increase failed attempts counter
                    this._failedAttempts++;

                    // permanently lock form after 5 failed attempts
                    if (this._failedAttempts >= 5) {
                        this._showError(this._i18n("webexpress.webapp:login.error.locked", "Account is locked due to too many failed attempts."));
                        this._submitting = false;
                        this._loginBtn.disabled = true;
                        this._loginBtn.textContent = this._i18n("webexpress.webapp:login.locked", "Locked");
                        return;
                    }

                    // apply exponential penalty starting from the 3rd attempt
                    if (this._failedAttempts >= 3) {
                        // base penalty is 30 seconds, doubles with each subsequent fail
                        const basePenalty = 30;
                        const multiplier = Math.pow(2, this._failedAttempts - 3);
                        const penaltySeconds = basePenalty * multiplier;

                        this._startRetryCountdown(
                            penaltySeconds,
                            this._i18n("webexpress.webapp:login.error.ratelimit", "Too many failed attempts. Please wait."),
                            submitLabel
                        );

                        return;
                    }

                    // normal authentication failed response
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
     *
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
        this._showError(message);
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
webexpress.webui.Controller.registerClass("wx-webapp-login", webexpress.webapp.LoginCtrl);