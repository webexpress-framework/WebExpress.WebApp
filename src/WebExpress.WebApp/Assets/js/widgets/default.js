/**
 * Registers the WebApp dashboard widgets that build on WebApp controls. These
 * are declared here rather than in the WebUI widget file so the base dashboard
 * stays free of WebApp dependencies.
 */

/**
 * Makes the scrum velocity chart available as a dashboard item. The widget is
 * flagged available so it appears in the board "…" add menu, and it declares a
 * single type-specific setting (the number of sprints) on top of the shared
 * name and color. The sprint history is seeded from the widget params as a
 * wx-state island, so the embedded ScrumVelocityCtrl paints without its own
 * service round trip.
 */
webexpress.webui.DashboardWidgets.register("widget_scrum_velocity", {
    title: webexpress.webui.I18N.translate("webexpress.webapp:dashboard.widget.scrum_velocity.title"),
    icon: "fas fa-chart-column",

    settings: [
        {
            key: "maxSprints",
            label: webexpress.webui.I18N.translate("webexpress.webapp:dashboard.widget.scrum_velocity.max_sprints"),
            type: "number",
            min: 1,
            max: 20,
            default: "6"
        }
    ],

    /**
     * Renders the velocity chart into the widget body.
     * @param {HTMLElement} container - The widget body element.
     * @param {object} data - The widget data, whose params may carry maxSprints and sprints.
     */
    render: function (container, data) {
        const params = data.params || {};

        const host = document.createElement("div");
        host.className = "wx-webapp-scrum-velocity";
        if (params.maxSprints) {
            host.setAttribute("data-max-sprints", params.maxSprints);
        }

        // seed the sprint history through a wx-state island so the chart renders
        // from the persisted data without contacting a service
        const sprints = this._readSprints(params.sprints);
        if (sprints !== null) {
            const state = document.createElement("wx-state");
            const prop = document.createElement("wx-prop");
            prop.setAttribute("name", "sprints");
            prop.setAttribute("type", "json");
            prop.textContent = sprints;
            state.appendChild(prop);
            host.appendChild(state);
        }

        container.appendChild(host);

        new webexpress.webapp.ScrumVelocityCtrl(host);
    },

    /**
     * Normalises the sprints param into a JSON string for the state island, or
     * null when no sprint history was provided.
     * @param {*} value - The raw sprints param (a JSON string or an array).
     * @returns {string|null} The JSON string, or null.
     */
    _readSprints: function (value) {
        if (value == null || value === "") {
            return null;
        }
        if (typeof value === "string") {
            return value;
        }
        try {
            return JSON.stringify(value);
        } catch (e) {
            return null;
        }
    }
});
