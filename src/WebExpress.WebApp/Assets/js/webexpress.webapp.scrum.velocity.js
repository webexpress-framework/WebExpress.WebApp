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
 * for the velocity endpoint, an optional data-max-sprints attribute and an
 * optional data-show-sprint-filter flag. The filter is the framework's dual
 * handle slider (wx-webui-input-slider) over the loaded history: it narrows the
 * plotted sprints to a window of it, starting on exactly the window
 * data-max-sprints describes.
 *
 * It is ViewState-capable: when the host carries a data-wx-resource binding the
 * sprints are a slice of an enclosing ViewState, so the control
 * subscribes to that slice and the ViewState owns the central load; without a
 * binding it owns its own wx-service island and loads itself (standalone).
 *
 * The chart is a pure function of the state (render), patched into the host by the keyed
 * reconciler of the Data base. The slider is a nested control: its row is rendered with the keep
 * flag and keyed by the history length, so a re-render never touches it, while a history of a
 * different length gets a new slider, which reads its scale only when it is created.
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
        const maxSprints = parseInt(element.dataset.maxSprints || "6", 10);
        const showSprintFilter = element.dataset.showSprintFilter === "true";
        const initialState = Object.assign({ sprints: [] }, webexpress.webapp.Data.readState(element));
        // the plotted window, as one based inclusive indices into the loaded sprints
        initialState.window = showSprintFilter
            ? webexpress.webapp.scrumVelocityModel.clampWindow(null, initialState.sprints.length, maxSprints)
            : null;

        super(element, { state: initialState, services: services });

        this._maxSprints = maxSprints;
        this._showSprintFilter = showSprintFilter;
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
        element.removeAttribute("data-show-sprint-filter");
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

            const unsubscribe = viewState.watch((state) => viewState.slice(this._resource, state), (slice) => this._applySlice(slice));
            (element._wxCleanup = element._wxCleanup || []).push(unsubscribe);

            this._applySlice(viewState.slice(this._resource));
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

    /**
     * Replaces the sprints and keeps the selected window inside the new history.
     * @param {Array<object>} value - The sprints, oldest first.
     */
    set _sprints(value) {
        this.setState({
            sprints: value,
            window: this._showSprintFilter
                ? webexpress.webapp.scrumVelocityModel.clampWindow(this.state.window, value.length, this._maxSprints)
                : null
        });
    }

    /**
     * Announces the first paint.
     */
    onMount() {
        this._dispatch(webexpress.webui.Event.UPDATED_EVENT, {});
    }

    /**
     * Announces every later paint.
     */
    onUpdate() {
        this._dispatch(webexpress.webui.Event.UPDATED_EVENT, {});
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
     * Renders the chart, or the empty hint, and the filter row.
     * @param {object} state - The current state.
     * @returns {Array<object>} The virtual node tree of the host.
     */
    render(state) {
        const h = webexpress.webui.h;
        const model = webexpress.webapp.scrumVelocityModel;
        const sprints = this._visibleSprints(state);
        const children = [];

        if (sprints.length === 0) {
            children.push(h("div", { key: "empty", class: "wx-scrum-velocity-empty" },
                this._i18n("webexpress.webapp:scrum.velocity.empty", "No completed sprints yet.")));
        } else {
            const average = model.average(sprints);
            const scale = model.maxValue(sprints) * webexpress.webapp.ScrumVelocityCtrl.HEADROOM;

            children.push(this._renderHeader(average));
            children.push(this._renderPlot(sprints, average, scale));
            children.push(this._renderLabels(sprints));
            children.push(this._renderLegend());
        }

        children.push(this._renderFilter(state));
        return children;
    }

    /**
     * Returns the sprints the chart plots: the window the filter selects, or the
     * trailing MaxSprints slice while there is no filter.
     * @param {object} state - The current state.
     * @returns {Array<object>} The sprints to plot, oldest first.
     */
    _visibleSprints(state) {
        const sprints = state.sprints || [];

        if (!this._showSprintFilter) {
            return webexpress.webapp.scrumVelocityModel.lastN(sprints, this._maxSprints);
        }

        return state.window ? sprints.slice(state.window.min - 1, state.window.max) : [];
    }

    /**
     * Renders the filter row around the framework's dual handle slider. The row is kept from
     * the reconciler and keyed by the history length: the slider reads its scale once, so a
     * different sprint count is answered with a new slider rather than an update of the old one.
     * @param {object} state - The current state.
     * @returns {object|null} The filter row, or null when there is nothing to narrow.
     */
    _renderFilter(state) {
        const total = (state.sprints || []).length;
        const registry = webexpress.webui.Controller && webexpress.webui.Controller.classRegistry;

        // a single sprint is already the whole history; a slider over it would
        // offer a choice that does not exist
        if (!this._showSprintFilter || total < 2 || !state.window || !registry || !registry.has("wx-webui-input-slider")) {
            return null;
        }

        return webexpress.webui.h("div", {
            key: "filter-" + total,
            class: "wx-scrum-velocity-filter",
            keep: true,
            ref: (row) => this._mountFilter(row, total, state.window)
        });
    }

    /**
     * Builds the caption and the slider inside a newly rendered filter row; a row that already
     * holds its slider is left as it is.
     * @param {HTMLElement} row - The filter row.
     * @param {number} total - The number of loaded sprints.
     * @param {{min:number, max:number}} window - The window the handles start on.
     */
    _mountFilter(row, total, window) {
        if (row.firstChild) {
            return;
        }

        const caption = document.createElement("span");
        caption.className = "wx-scrum-velocity-filter-caption";
        caption.textContent = this._i18n("webexpress.webapp:scrum.velocity.filter", "Sprints");
        row.appendChild(caption);

        const host = document.createElement("div");
        host.className = "wx-scrum-velocity-slider";
        // the scale is the position in the history rather than the sprint name,
        // because the names are already spelled out under the columns
        host.dataset.min = "1";
        host.dataset.max = String(total);
        host.dataset.step = "1";
        host.dataset.valueMin = String(window.min);
        host.dataset.valueMax = String(window.max);
        row.appendChild(host);

        // the marker class is consumed by the controller on instantiation, so
        // the styling hook has to be a second class
        host.classList.add("wx-webui-input-slider");
        webexpress.webui.Controller.createInstances(host);

        host.addEventListener(webexpress.webui.Event.CHANGE_VALUE_EVENT, (e) => {
            // the slider's own change is an implementation detail of the chart;
            // letting it bubble would reach a page that listens for the value
            // changes of its own inputs under the same name
            if (typeof e.stopPropagation === "function") {
                e.stopPropagation();
            }

            this.setState({ window: { min: e.detail.valueMin, max: e.detail.valueMax } });
        });
    }

    /**
     * Renders the header with the eyebrow and the rolling average chip.
     * @param {number} average - The average velocity.
     * @returns {object} The header virtual node.
     */
    _renderHeader(average) {
        const h = webexpress.webui.h;
        return h("div", { key: "header", class: "wx-scrum-velocity-header" },
            h("span", { class: "wx-scrum-velocity-eyebrow" },
                this._i18n("webexpress.webapp:scrum.velocity.title", "Velocity")),
            h("span", {
                class: "wx-scrum-velocity-avg",
                title: this._i18n("webexpress.webapp:scrum.velocity.average", "Average")
            }, "Ø " + this._formatPoints(average) + " "
                + this._i18n("webexpress.webapp:scrum.velocity.points_abbr", "pts")));
    }

    /**
     * Renders the plot area with the per-sprint columns and the average line.
     * @param {Array<object>} sprints - The sprints to plot.
     * @param {number} average - The average velocity.
     * @param {number} scale - The value mapped to the full plot height.
     * @returns {object} The plot virtual node.
     */
    _renderPlot(sprints, average, scale) {
        const h = webexpress.webui.h;
        return h("div", { key: "plot", class: "wx-scrum-velocity-plot" },
            sprints.map((sprint) => this._renderColumn(sprint, scale)),
            average > 0 && h("div", Object.assign({
                key: "average",
                title: this._i18n("webexpress.webapp:scrum.velocity.average", "Average")
                    + ": " + this._formatPoints(average) + " "
                    + this._i18n("webexpress.webapp:scrum.velocity.points_abbr", "pts")
            }, this._colored("wx-scrum-velocity-avg-line", "bottom:" + this._pct(average, scale), this._colors.average))));
    }

    /**
     * Renders a single sprint column with the committed backdrop, the completed
     * bar and the value label.
     * @param {object} sprint - The sprint record.
     * @param {number} scale - The value mapped to the full plot height.
     * @returns {object} The column virtual node.
     */
    _renderColumn(sprint, scale) {
        const h = webexpress.webui.h;
        return h("div", {
            key: sprint.id,
            class: "wx-scrum-velocity-col",
            title: sprint.name + ": " + sprint.completed + "/" + sprint.committed + " "
                + this._i18n("webexpress.webapp:scrum.velocity.points_abbr", "pts")
        },
            h("span", this._colored("wx-scrum-velocity-bar-committed", "height:" + this._pct(sprint.committed, scale), this._colors.committed)),
            h("span", this._colored("wx-scrum-velocity-bar-completed", "height:" + this._pct(sprint.completed, scale), this._colors.completed)),
            h("span", {
                class: "wx-scrum-velocity-value",
                style: "bottom:calc(" + this._pct(sprint.completed, scale) + " + 3px)"
            }, String(sprint.completed)));
    }

    /**
     * Renders the row of sprint labels below the plot, aligned to the columns.
     * @param {Array<object>} sprints - The sprints.
     * @returns {object} The labels virtual node.
     */
    _renderLabels(sprints) {
        const h = webexpress.webui.h;
        return h("div", { key: "labels", class: "wx-scrum-velocity-labels" },
            sprints.map((sprint) => h("span", { key: sprint.id, class: "wx-scrum-velocity-label", title: sprint.name }, sprint.name)));
    }

    /**
     * Renders the legend distinguishing the committed backdrop from the completed
     * velocity bar.
     * @returns {object} The legend virtual node.
     */
    _renderLegend() {
        const h = webexpress.webui.h;
        const item = (variant, text) => h("span", { class: "wx-scrum-velocity-legend-item" },
            h("span", this._colored("wx-scrum-velocity-swatch " + variant, "", this._colors[variant])),
            h("span", null, text));

        return h("div", { key: "legend", class: "wx-scrum-velocity-legend" },
            item("completed", this._i18n("webexpress.webapp:scrum.velocity.completed", "Completed")),
            item("committed", this._i18n("webexpress.webapp:scrum.velocity.committed", "Committed")));
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
     * Combines the class and the inline style of a colored element, preferring the color's
     * CSS class and falling back to its inline declaration. A null or empty descriptor leaves
     * the stylesheet default untouched.
     * @param {string} className - The element's own classes.
     * @param {string} style - The element's own inline style.
     * @param {{css: (string|null), style: (string|null)}} color - The descriptor.
     * @returns {{class: string, style: string}} The props of the element.
     */
    _colored(className, style, color) {
        if (color && color.css) {
            return { class: className + " " + color.css.split(/\s+/).filter(Boolean).join(" "), style: style };
        }
        if (color && color.style) {
            return { class: className, style: style + ";" + color.style };
        }
        return { class: className, style: style };
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

    /**
     * Gets the window the chart plots, as one based inclusive indices into the
     * loaded sprints, or null while the filter is off.
     * @returns {{min:number, max:number}|null} The window.
     */
    get sprintWindow() {
        const window = this.state.window;
        return window ? { min: window.min, max: window.max } : null;
    }
};

// register for declarative auto-init
webexpress.webui.Controller.registerClass("wx-webapp-scrum-velocity", webexpress.webapp.ScrumVelocityCtrl);
