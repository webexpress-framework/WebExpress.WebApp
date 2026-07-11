/**
 * A control showing the velocity of the last few sprints as a column chart.
 * Each column represents one sprint: the solid bar is the completed story points
 * (the sprint's velocity), the faint backdrop bar is the committed points, and a
 * dashed line marks the average velocity across the shown sprints. Only the last
 * N sprints are drawn; the header carries the rolling average.
 *
 * The chart is built from plain HTML/CSS so the labels and values stay crisp
 * across themes. The control is read-only and loads its data via a single GET.
 *
 * Declarative configuration: the host carries a wx-service island named "data"
 * for the velocity endpoint and an optional data-max-sprints attribute.
 *
 * It is ViewState-capable: when the host carries a data-wx-resource binding the
 * sprints are a slice of an enclosing ViewState, so the control
 * subscribes to that slice and the ViewState owns the central load; without a
 * binding it owns its own wx-service island and loads itself (standalone).
 *
 * REST contract:
 *   GET {data} → [{ id, name, committed, completed }]   (oldest sprint first)
 *
 * Events dispatched on the host element:
 *   webexpress.webui.Event.DATA_REQUESTED_EVENT
 *   webexpress.webui.Event.DATA_ARRIVED_EVENT
 *   webexpress.webui.Event.UPDATED_EVENT
 */
webexpress.webapp.ScrumVelocityCtrl = class extends webexpress.webapp.Data {

    // headroom above the tallest bar so the value labels never clip the top edge
    static HEADROOM = 1.18;

    /**
     * Construct a new ScrumVelocityCtrl.
     * @param {HTMLElement} element - host element.
     */
    constructor(element) {
        // resolve the service and the initial state before super, so the
        // Component seeds its store from the optional wx-state island and owns
        // the service map
        const services = webexpress.webapp.ServiceRegistry.fromElement(element);
        const initialState = Object.assign({ sprints: [] }, webexpress.webapp.Data.readState(element));

        super(element, { state: initialState, services: services });

        this._maxSprints = parseInt(element.dataset.maxSprints || "6", 10);
        // the resource a ViewState renders; when present the sprints are a pure
        // view of a central resource the enclosing ViewState owns, when absent the
        // control loads itself (standalone)
        this._resource = (element.dataset && element.dataset.wxResource) || null;
        this._service = this.useService("data");

        // the completed, committed and average colors are authored in C# and
        // emitted either as a CSS class (system color) or an inline style
        // (user-defined color); both paths are honored when painting
        this._colors = {
            completed: this._readColor(element, "color-completed"),
            committed: this._readColor(element, "color-committed"),
            average: this._readColor(element, "color-average")
        };

        // clean host
        element.textContent = "";
        element.removeAttribute("data-max-sprints");
        element.classList.add("wx-scrum-velocity");

        // subscribe to the store, perform the first render and run onMount
        this.mount();

        // when the server seeded the sprints through the wx-state island the
        // first paint needs no round trip; otherwise load them from the endpoint
        if (this._resource) {
            this._attachToViewState(element);
        } else if (this._sprints.length === 0) {
            this._load();
        }
    }

    /**
     * Attaches the control to the enclosing ViewState and renders its
     * resource slice. The ViewState owns the central load and the service; this
     * control becomes a pure view that re-renders whenever the ViewState re-queries
     * the resource.
     * @param {HTMLElement} element - The host element.
     */
    _attachToViewState(element) {
        const viewStateId = (element.dataset && element.dataset.wxViewstate) || null;

        webexpress.webapp.ViewStateRegistry.whenReady(element, viewStateId, (viewState) => {
            this._viewState = viewState;

            const service = viewState.serviceForResource(this._resource);
            if (service) {
                this._service = service;
            }

            const unsubscribe = viewState.watch((state) => state[this._resource], (slice) => this._applySlice(slice));
            (element._wxCleanup = element._wxCleanup || []).push(unsubscribe);

            this._applySlice(viewState.getState()[this._resource]);
        });
    }

    /**
     * Renders a resource slice the ViewState loaded centrally.
     * @param {object} slice - The resource slice { items, total, data, loading, error }.
     */
    _applySlice(slice) {
        slice = slice || {};
        if (slice.data) {
            this._sprints = webexpress.webapp.scrumVelocityModel.normalizeList(slice.data);
        }
    }

    /**
     * The sprints, backed by the component store so the store is the single
     * source of truth and a change triggers a re-render through the subscription.
     * @returns {Array<object>} The current sprints, oldest first.
     */
    get _sprints() {
        return this.state.sprints || [];
    }

    set _sprints(value) {
        this.setState({ sprints: value });
    }

    /**
     * Renders the chart on the first paint.
     */
    onMount() {
        this._render();
    }

    /**
     * Renders the chart whenever the sprint state changes.
     */
    onUpdate() {
        this._render();
    }

    /**
     * Reloads the sprints, in ViewState mode through the ViewState's central re-query
     * and standalone from the configured endpoint.
     */
    refresh() {
        if (this._viewState && this._resource) {
            this._viewState.reload(this._resource);
        } else {
            this._load();
        }
    }

    /**
     * Loads the sprints from the configured service and renders them.
     */
    async _load() {
        if (!this._service) {
            this._sprints = [];
            return;
        }

        this._dispatch(webexpress.webui.Event.DATA_REQUESTED_EVENT, {});
        try {
            const res = await this._service.query({});
            if (!res.ok) {
                throw new Error(res.error ? res.error.message : String(res.status));
            }
            this._sprints = webexpress.webapp.scrumVelocityModel.normalizeList(res.data);
            this._dispatch(webexpress.webui.Event.DATA_ARRIVED_EVENT, {});
        } catch (e) {
            console.warn("ScrumVelocityCtrl: load failed", e);
            this._sprints = [];
        }
    }

    /**
     * Renders the velocity chart from `this._sprints`.
     */
    _render() {
        this._element.replaceChildren();

        const model = webexpress.webapp.scrumVelocityModel;
        const sprints = model.lastN(this._sprints, this._maxSprints);

        if (sprints.length === 0) {
            const empty = document.createElement("div");
            empty.className = "wx-scrum-velocity-empty";
            empty.textContent = this._i18n("webexpress.webapp:scrum.velocity.empty", "No completed sprints yet.");
            this._element.appendChild(empty);
            this._dispatch(webexpress.webui.Event.UPDATED_EVENT, {});
            return;
        }

        const average = model.average(sprints);
        const scale = model.maxValue(sprints) * webexpress.webapp.ScrumVelocityCtrl.HEADROOM;

        this._element.appendChild(this._buildHeader(average));
        this._element.appendChild(this._buildPlot(sprints, average, scale));
        this._element.appendChild(this._buildLabels(sprints));
        this._element.appendChild(this._buildLegend());

        this._dispatch(webexpress.webui.Event.UPDATED_EVENT, {});
    }

    /**
     * Builds the header with the eyebrow and the rolling average chip.
     * @param {number} average - The average velocity.
     * @returns {HTMLElement}
     */
    _buildHeader(average) {
        const header = document.createElement("div");
        header.className = "wx-scrum-velocity-header";

        const eyebrow = document.createElement("span");
        eyebrow.className = "wx-scrum-velocity-eyebrow";
        eyebrow.textContent = this._i18n("webexpress.webapp:scrum.velocity.title", "Velocity");
        header.appendChild(eyebrow);

        const avg = document.createElement("span");
        avg.className = "wx-scrum-velocity-avg";
        avg.title = this._i18n("webexpress.webapp:scrum.velocity.average", "Average");
        avg.textContent = "Ø " + this._formatPoints(average) + " "
            + this._i18n("webexpress.webapp:scrum.velocity.points_abbr", "pts");
        header.appendChild(avg);

        return header;
    }

    /**
     * Builds the plot area with the per-sprint columns and the average line.
     * @param {Array<object>} sprints - The sprints to plot.
     * @param {number} average - The average velocity.
     * @param {number} scale - The value mapped to the full plot height.
     * @returns {HTMLElement}
     */
    _buildPlot(sprints, average, scale) {
        const plot = document.createElement("div");
        plot.className = "wx-scrum-velocity-plot";

        for (const sprint of sprints) {
            plot.appendChild(this._buildColumn(sprint, scale));
        }

        if (average > 0) {
            const line = document.createElement("div");
            line.className = "wx-scrum-velocity-avg-line";
            line.style.bottom = this._pct(average, scale);
            line.title = this._i18n("webexpress.webapp:scrum.velocity.average", "Average")
                + ": " + this._formatPoints(average) + " "
                + this._i18n("webexpress.webapp:scrum.velocity.points_abbr", "pts");
            this._applyColor(line, this._colors.average);
            plot.appendChild(line);
        }

        return plot;
    }

    /**
     * Builds a single sprint column with the committed backdrop, the completed
     * bar and the value label.
     * @param {object} sprint - The sprint record.
     * @param {number} scale - The value mapped to the full plot height.
     * @returns {HTMLElement}
     */
    _buildColumn(sprint, scale) {
        const col = document.createElement("div");
        col.className = "wx-scrum-velocity-col";
        col.title = sprint.name + ": " + sprint.completed + "/" + sprint.committed + " "
            + this._i18n("webexpress.webapp:scrum.velocity.points_abbr", "pts");

        const committed = document.createElement("span");
        committed.className = "wx-scrum-velocity-bar-committed";
        committed.style.height = this._pct(sprint.committed, scale);
        this._applyColor(committed, this._colors.committed);
        col.appendChild(committed);

        const completed = document.createElement("span");
        completed.className = "wx-scrum-velocity-bar-completed";
        completed.style.height = this._pct(sprint.completed, scale);
        this._applyColor(completed, this._colors.completed);
        col.appendChild(completed);

        const value = document.createElement("span");
        value.className = "wx-scrum-velocity-value";
        value.style.bottom = "calc(" + this._pct(sprint.completed, scale) + " + 3px)";
        value.textContent = String(sprint.completed);
        col.appendChild(value);

        return col;
    }

    /**
     * Builds the row of sprint labels below the plot, aligned to the columns.
     * @param {Array<object>} sprints - The sprints.
     * @returns {HTMLElement}
     */
    _buildLabels(sprints) {
        const labels = document.createElement("div");
        labels.className = "wx-scrum-velocity-labels";

        for (const sprint of sprints) {
            const label = document.createElement("span");
            label.className = "wx-scrum-velocity-label";
            label.textContent = sprint.name;
            label.title = sprint.name;
            labels.appendChild(label);
        }

        return labels;
    }

    /**
     * Builds the legend distinguishing the committed backdrop from the completed
     * velocity bar.
     * @returns {HTMLElement}
     */
    _buildLegend() {
        const legend = document.createElement("div");
        legend.className = "wx-scrum-velocity-legend";

        legend.appendChild(this._buildLegendItem("completed", this._i18n("webexpress.webapp:scrum.velocity.completed", "Completed")));
        legend.appendChild(this._buildLegendItem("committed", this._i18n("webexpress.webapp:scrum.velocity.committed", "Committed")));

        return legend;
    }

    /**
     * Builds a single legend item with a colour swatch and a label.
     * @param {string} variant - The swatch variant, "completed" or "committed".
     * @param {string} text - The label text.
     * @returns {HTMLElement}
     */
    _buildLegendItem(variant, text) {
        const item = document.createElement("span");
        item.className = "wx-scrum-velocity-legend-item";

        const swatch = document.createElement("span");
        swatch.className = "wx-scrum-velocity-swatch " + variant;
        this._applyColor(swatch, this._colors[variant]);
        item.appendChild(swatch);

        const label = document.createElement("span");
        label.textContent = text;
        item.appendChild(label);

        return item;
    }

    /**
     * Reads a user-definable color authored on the host as a `data-{name}-css`
     * class (system color) and a `data-{name}-style` inline declaration
     * (user-defined color), removing the source attributes so the host is left
     * clean after the configuration has been consumed.
     * @param {HTMLElement} element - The host element.
     * @param {string} name - The attribute base name, for example "color-completed".
     * @returns {{css: (string|null), style: (string|null)}} The color descriptor.
     */
    _readColor(element, name) {
        const cssAttr = "data-" + name + "-css";
        const styleAttr = "data-" + name + "-style";

        const color = {
            css: element.getAttribute(cssAttr) || null,
            style: element.getAttribute(styleAttr) || null
        };

        element.removeAttribute(cssAttr);
        element.removeAttribute(styleAttr);

        return color;
    }

    /**
     * Applies a color descriptor to an element, preferring the CSS class and
     * falling back to the inline style declaration. A null or empty descriptor
     * leaves the element's stylesheet default untouched.
     * @param {HTMLElement} element - The target element.
     * @param {{css: (string|null), style: (string|null)}} color - The descriptor.
     */
    _applyColor(element, color) {
        if (!element || !color) {
            return;
        }

        if (color.css) {
            for (const cls of color.css.split(/\s+/)) {
                if (cls) {
                    element.classList.add(cls);
                }
            }
        } else if (color.style) {
            element.style.cssText += ";" + color.style;
        }
    }

    /**
     * Maps a value onto a percentage of the plot height.
     * @param {number} value - The value.
     * @param {number} scale - The value mapped to the full plot height.
     * @returns {string} The CSS percentage.
     */
    _pct(value, scale) {
        const pct = scale > 0 ? Math.max(0, Math.min(100, (value / scale) * 100)) : 0;
        return pct.toFixed(1) + "%";
    }

    /**
     * Formats a points value, trimming the decimal for whole numbers.
     * @param {number} value - The value.
     * @returns {string}
     */
    _formatPoints(value) {
        if (typeof value !== "number" || isNaN(value)) {
            return "0";
        }
        return Number.isInteger(value) ? String(value) : value.toFixed(1);
    }

    /**
     * Gets the current list of sprints.
     * @returns {Array<object>}
     */
    get value() {
        return this._sprints.slice();
    }
};

// register for declarative auto-init
webexpress.webui.Controller.registerClass("wx-webapp-scrum-velocity", webexpress.webapp.ScrumVelocityCtrl);
