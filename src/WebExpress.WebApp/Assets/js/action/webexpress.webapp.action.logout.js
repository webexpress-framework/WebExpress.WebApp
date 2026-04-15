/**
 * Logout action definition for the WebExpress.WebApp action registry.
 * Sends a DELETE request to the session REST API endpoint to invalidate
 * the current session, then redirects the browser to the application root.
 */

// logout action
webexpress.webui.Actions.register("logout", {
    execute: function (element, prefix) {
        var uri = element.getAttribute("data-wx-" + prefix + "-uri");
        if (!uri) {
            return;
        }

        fetch(uri, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json; charset=utf-8"
            }
        }).then(function () {
            // redirect to application root after successful logout
            window.location.href = "/";
        }).catch(function () {
            // redirect even on failure to ensure the user leaves the session
            window.location.href = "/";
        });
    }
});
