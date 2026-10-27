/**
 * Stores a toggle of the client's dark mode switch on the server, once the page names the
 * service that keeps the choice (data-wx-theme-service on the root). The switch itself
 * lives in WebUI and only rewrites the page; without this the choice would stay in the
 * browser and contradict the one shown on the Designs page.
 */
webexpress.webapp.ColorScheme = new class {
    /**
     * Listens for scheme changes for the lifetime of the page.
     */
    constructor() {
        document.addEventListener(webexpress.webui.Event.CHANGE_DARKMODE_EVENT, (e) => this._persist(e));
    }

    /**
     * Sends the new scheme to the announced service.
     * @param {CustomEvent} e - The change event of the dark mode switch.
     */
    _persist(e) {
        const endpoint = document.documentElement.getAttribute("data-wx-theme-service");
        const mode = e && e.detail ? e.detail.mode : null;
        if (!endpoint || (mode !== "light" && mode !== "dark")) {
            return;
        }

        const body = new URLSearchParams();
        body.set("v", mode);

        webexpress.webapp.ServiceRegistry.request(endpoint, {
            method: "PUT",
            headers: { "Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString(),
            credentials: "same-origin"
        }).then((res) => {
            if (!res.ok) {
                console.error(`color scheme persistence failed: http ${res.status}`);
            }
        }).catch((err) => {
            console.error("the color scheme could not be persisted:", err);
        });
    }
};
