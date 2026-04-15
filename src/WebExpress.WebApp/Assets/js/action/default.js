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
