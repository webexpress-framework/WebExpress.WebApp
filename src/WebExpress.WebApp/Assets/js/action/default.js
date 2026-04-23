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
                    throw new Error(text || "Request failed");
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
            document.body.appendChild(input);

            input.addEventListener("change", function () {
                if (!input.files || input.files.length === 0) {
                    document.body.removeChild(input);
                    return;
                }

                var formData = new FormData();
                formData.append("file", input.files[0], input.files[0].name);

                fetch(uri, {
                    method: method,
                    body: formData
                }).then(handleResponse).then(handleResult).catch(handleError).finally(function () {
                    if (document.body.contains(input)) {
                        document.body.removeChild(input);
                    }
                });
            }, { once: true });

            input.click();
            return;
        }

        fetch(uri, {
            method: method
        }).then(handleResponse).then(handleResult).catch(handleError);
    }
});
