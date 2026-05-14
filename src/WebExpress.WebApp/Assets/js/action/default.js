/**
 * Logout action definition for the WebExpress.WebApp action registry.
 * Sends a DELETE request to the session REST API endpoint to invalidate
 * the current session, then redirects the browser to the application root.
 */
webexpress.webui.Actions.register("logout", {
    execute: function (element, prefix) {
        var uri = element.getAttribute("data-wx-" + prefix + "-uri");
        if (!uri) {
            console.warn("Logout action: no session API URI specified.");
            return;
        }
        var target = element.getAttribute("data-wx-" + prefix + "-target") || "/";
        if (!target) {
            console.warn("Logout action: redirect target is empty, using '/' as fallback.");
            target = "/";
        }

        fetch(uri, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json; charset=utf-8"
            }
        }).finally(function () {
            // redirect to application root regardless of outcome
            window.location.href = target;
        });
    }
});

/**
 * Plugin package management action.
 * Executes activate/deactivate/delete requests and upload-based install/update.
 */
webexpress.webui.Actions.register("plugin-package", {
    execute: function (element, prefix) {
        var uri = element.getAttribute("data-wx-" + prefix + "-uri");
        if (!uri) {
            console.warn("Plugin package action: missing endpoint URI.");
            return;
        }

        var method = (element.getAttribute("data-wx-" + prefix + "-method") || "POST").toUpperCase();
        var requireFile = (element.getAttribute("data-wx-" + prefix + "-require-file") || "") === "true";
        var confirmText = element.getAttribute("data-wx-" + prefix + "-confirm");

        if (confirmText && !window.confirm(confirmText)) {
            return;
        }

        var handleResponse = function (response) {
            if (!response.ok) {
                return response.text().then(function (text) {
                    throw new Error(text || ("Request failed with status " + response.status + " for " + method + " " + uri));
                });
            }
            return response.json().catch(function () { return {}; });
        };

        var handleResult = function (payload) {
            if (payload && payload.message) {
                console.info(payload.message);
            }
            window.location.reload();
        };

        var handleError = function (error) {
            console.error("Plugin package action failed:", error);
            window.alert(error && error.message ? error.message : "Plugin package action failed.");
        };

        if (requireFile) {
            var input = document.createElement("input");
            input.type = "file";
            input.accept = ".wxp";
            input.style.display = "none";
            var cleanup = function () {
                input.value = "";
            };

            input.addEventListener("change", function () {
                if (!input.files || input.files.length === 0) {
                    cleanup();
                    return;
                }

                var formData = new FormData();
                formData.append("file", input.files[0], input.files[0].name);

                fetch(uri, {
                    method: method,
                    body: formData
                }).then(handleResponse).then(handleResult).catch(handleError).finally(cleanup);
            }, { once: true });

            input.click();
            return;
        }

        fetch(uri, {
            method: method
        }).then(handleResponse).then(handleResult).catch(handleError);
    }
});

/**
 * Popup notification action — lets any client side element show a popup
 * notification when triggered (typically by a click), using the existing
 * PopupNotificationCtrl pipeline. The action synthesizes a
 * <c>webexpress.webapp.popup.show</c> envelope and dispatches it through
 * the local MessageQueue listener channel so every PopupNotificationCtrl
 * instance on the page picks it up. No HTTP roundtrip is involved.
 *
 * Supported attributes:
 *   data-wx-{primary|secondary}-heading      — alert heading text
 *   data-wx-{primary|secondary}-message      — alert body html
 *   data-wx-{primary|secondary}-type         — bootstrap alert class
 *                                              (default: "alert-primary")
 *   data-wx-{primary|secondary}-durability   — lifetime in ms (-1 = pinned,
 *                                              default: 5000)
 *   data-wx-{primary|secondary}-icon         — optional icon URL
 *
 * Example:
 *   <button type="button"
 *           data-wx-primary-action="popup"
 *           data-wx-primary-heading="Saved"
 *           data-wx-primary-message="Your changes were stored."
 *           data-wx-primary-type="alert-success"
 *           data-wx-primary-durability="4000">Save</button>
 */
webexpress.webui.Actions.register("popup", {
    execute: function (element, prefix, controller, event) {
        if (event && typeof event.preventDefault === "function") {
            event.preventDefault();
        }

        function attr(name) {
            return element.getAttribute("data-wx-" + prefix + "-" + name);
        }

        var heading = attr("heading") || "";
        var message = attr("message") || "";
        var type = attr("type") || "alert-primary";
        var icon = attr("icon") || null;
        var durabilityRaw = attr("durability");
        var durability = durabilityRaw === null || durabilityRaw === ""
            ? 5000
            : parseInt(durabilityRaw, 10);
        if (isNaN(durability)) {
            durability = 5000;
        }

        // build a notification id — random per click so multiple presses
        // produce distinct alerts instead of replacing one another
        var id = "popup-" + Date.now().toString(36) + "-"
            + Math.random().toString(36).slice(2, 8);

        var payload = {
            type: "webexpress.webapp.popup.show",
            notification: {
                id: id,
                heading: heading,
                message: message,
                type: type,
                icon: icon,
                durability: durability,
                progress: -1,
                created: new Date().toISOString()
            }
        };

        var queue = (typeof webexpress !== "undefined" && webexpress.webapp)
            ? webexpress.webapp.MessageQueue
            : null;
        if (queue && typeof queue.dispatchLocal === "function") {
            queue.dispatchLocal(payload);
        }
    }
});
