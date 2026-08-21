/**
 * Active sprint overview control. Renders the sprint name, goal, points
 * progress, capacity utilisation and a burn-down chart drawn as SVG. The
 * data is loaded from a REST API endpoint specified via the data-rest-uri
 * attribute on the host element. The expected JSON payload has the form:
 *
 * {
 *   "name": "Sprint 24",
 *   "goal": "Customer-Portal MVP launch-ready",
 *   "status": "active",
 *   "start": "2026-04-29",
 *   "end":   "2026-05-13",
 *   "daysTotal": 14,
 *   "daysElapsed": 7,
 *   "capacity": 60,
 *   "committedPoints": 47,
 *   "completedPoints": 18,
 *   "totalItems": 9,
 *   "completedItems": 2,
 *   "burndown": {
 *     "ideal":  [47, 43.6, 40.2, ...],
 *     "actual": [47, 46, 44, 41, 39, 35, 31, 29]
 *   }
 * }
 *
 * It is ViewState-capable: when the host carries a data-wx-resource binding the
 * sprint is a slice of an enclosing ViewState, so the control subscribes
 * to that slice and the ViewState owns the central load; without a binding it owns
 * its own wx-service island and loads itself (standalone).
 *
 * The following events are dispatched on the host element:
 * - webexpress.webui.Event.DATA_REQUESTED_EVENT
 * - webexpress.webui.Event.DATA_ARRIVED_EVENT
 * - webexpress.webui.Event.UPDATED_EVENT
 * - webexpress.webui.Event.SELECT_EVENT (or "wx:select-sprint" fallback)
 *   when the sprint card is clicked
 */
webexpress.webapp.ScrumSprintCtrl = class extends webexpress.webapp.Data {

    static SVG_NS = "http://www.w3.org/2000/svg";
    static CHART_W = 160;
    static CHART_H = 50;
    static OVERBOOK_THRESHOLD = 0.10; // 10% delta vs ideal counts as ahead/behind

    _restUri = null;

    /**
     * Initializes the sprint overview control.
     * @param {HTMLElement} element - The host element.
     */
    constructor(element) {
        // seed the sprint state from the optional wx-state island before super,
        // so the component store owns the sprint, the load status and the error
        const initialState = Object.assign(
            { sprint: null, status: "idle", error: null },
            webexpress.webapp.Data.readState(element)
        );

        super(element, { state: initialState });

        // the endpoint is authored in C# through the wx-service island
        this._service = this.useService("data");
        this._restUri = this._service ? this._service.baseUri : null;
        // the resource a ViewState renders; when present the sprint is a pure view
        // of a central resource the enclosing ViewState owns, when absent the
        // control loads itself (standalone)
        this._resource = (element.dataset && element.dataset.wxResource) || null;
        element.classList.add("wx-scrum-sprint");

        // dispatch a select event when the card is clicked (ignoring inner controls)
        element.addEventListener("click", (e) => this._onCardClick(e));

        // without an endpoint and without a seed, fall back to the inline
        // config; a ViewState-bound card renders its slice instead
        if (!this._resource && !this._restUri && !this._sprint) {
            this._parseStaticConfig();
        }

        // subscribe and perform the first render from the seeded, parsed or empty
        // state; Component._apply calls the existing imperative render method
        this.mount();

        // load from the endpoint only when the server did not seed the sprint
        if (this._resource) {
            this._attachToViewState(element);
        } else if (this._restUri && !this._sprint) {
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
                this._restUri = service.baseUri;
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
            this.sprint = slice.data;
        }
    }

    // the sprint, the load status and the error are backed by the component store,
    // so the store is the single source of truth and a change re-renders through
    // the subscription that mount established

    get _sprint() { return this.state.sprint; }
    set _sprint(value) { this.setState({ sprint: value || null }); }

    get _state() { return this.state.status; }
    set _state(value) { this.setState({ status: value }); }

    get _error() { return this.state.error; }
    set _error(value) { this.setState({ error: value }); }

    /**
     * Returns the currently displayed sprint.
     * @returns {Object|null}
     */
    get sprint() {
        return this._sprint ? Object.assign({}, this._sprint) : null;
    }

    /**
     * Sets the sprint payload and rerenders.
     * @param {Object} sprint - The sprint payload.
     */
    set sprint(sprint) {
        this.setState({ sprint: sprint || null, status: "idle", error: null });
    }

    /**
     * Reloads the sprint payload, in ViewState mode through the ViewState's central
     * re-query and standalone from the configured REST endpoint.
     * @returns {void}
     */
    refresh() {
        if (this._viewState && this._resource) {
            this._viewState.reload(this._resource);
        } else if (this._restUri) {
            this._load();
        }
    }

    /**
     * Parses the inline json configuration block for tests / static use.
     * @returns {void}
     */
    _parseStaticConfig() {
        const cfgEl = this._element.querySelector(":ViewState > script[type='application/json']");
        if (!cfgEl) {
            return;
        }
        try {
            this._sprint = JSON.parse(cfgEl.textContent);
        } catch (e) {
            console.error("ScrumSprintCtrl: failed to parse static config", e);
            this._state = "error";
            this._error = e;
        }
    }

    /**
     * Loads the sprint payload from the REST API.
     * @returns {void}
     */
    _load() {
        this._state = "loading";
        this._error = null;
        this._dispatch(webexpress.webui.Event.DATA_REQUESTED_EVENT, { uri: this._restUri });

        webexpress.webapp.ServiceRegistry.request(this._restUri, { headers: { "Accept": "application/json" } })
            .then((r) => {
                if (!r.ok) {
                    throw new Error("HTTP " + r.status);
                }
                return r.data;
            })
            .then((data) => {
                this._sprint = data || null;
                this._state = "idle";
                this._dispatch(webexpress.webui.Event.DATA_ARRIVED_EVENT, { uri: this._restUri });
            })
            .catch((err) => {
                console.error("ScrumSprintCtrl: failed to load data", err);
                this._state = "error";
                this._error = err;
            });
    }

    /**
     * Handles clicks on the sprint card and emits a select event.
     * @param {MouseEvent} e - The mouse event triggered by clicking on the sprint card.
     * @returns {void}
     */
    _onCardClick(e) {
        // ignore clicks on actionable elements inside the card
        if (e.target.closest("button, a, [role='button']")) {
            return;
        }
        const eventName = webexpress.webui.Event.SELECT_EVENT || "wx:select-sprint";
        this._dispatch(eventName, {
            sprint: this.sprint,
            originalEvent: e
        });
    }

    /**
     * Renders the sprint overview including the burndown chart.
     * @returns {void}
     */
    render() {
        const el = this._element;
        el.replaceChildren();

        if (this._state === "loading") {
            el.appendChild(this._renderLoading());
        } else if (this._state === "error") {
            el.appendChild(this._renderError());
        } else if (!this._sprint) {
            el.appendChild(this._renderEmpty());
        } else {
            const view = this._buildView(this._sprint);
            el.appendChild(this._renderHeader(view));
            el.appendChild(this._renderProgress(view));
            el.appendChild(this._renderCapacity(view));
            el.appendChild(this._renderBurndown(view));
        }

        this._dispatch(webexpress.webui.Event.UPDATED_EVENT, {});
    }

    /**
     * Builds a normalised view-model from the sprint payload. All numeric
     * fields are coerced and derived values (percentages, days left) are
     * computed once instead of inline in the render methods.
     * @param {Object} s - the raw sprint payload.
     * @returns {Object}
     */
    _buildView(s) {
        const num = (v) => {
            const n = Number(v);
            return isNaN(n) ? 0 : n;
        };

        const committed = num(s.committedPoints);
        const completed = num(s.completedPoints);
        const capacity = num(s.capacity);
        const totalItems = num(s.totalItems);
        const completedItems = num(s.completedItems);
        const daysTotal = num(s.daysTotal);
        const daysElapsed = Math.min(num(s.daysElapsed), daysTotal);
        const daysLeft = Math.max(0, daysTotal - daysElapsed);

        const ideal = Array.isArray(s.burndown?.ideal) ? s.burndown.ideal : this._idealLine(committed, daysTotal);
        const actual = Array.isArray(s.burndown?.actual) ? s.burndown.actual : [];

        return {
            raw: s,
            name: s.name || "",
            goal: s.goal || "",
            start: s.start || null,
            end: s.end || null,

            committed, completed, capacity,
            totalItems, completedItems,
            daysTotal, daysElapsed, daysLeft,

            progressPct: committed > 0 ? Math.round((completed / committed) * 100) : 0,
            capacityPct: capacity > 0 ? Math.min(100, (committed / capacity) * 100) : 0,
            overbooked: committed > capacity,
            capacityDelta: Math.abs(committed - capacity),

            ideal,
            actual
        };
    }

    /**
     * Builds the empty/no-active-sprint placeholder.
     * @returns {HTMLElement}
     */
    _renderEmpty() {
        const empty = document.createElement("div");
        empty.className = "wx-scrum-empty";
        empty.textContent = this._i18n("webexpress.webapp:scrum.no_sprint", "No active sprint.");
        return empty;
    }

    /**
     * Builds a small loading skeleton with a spinner.
     * @returns {HTMLElement}
     */
    _renderLoading() {
        const wrap = document.createElement("div");
        wrap.className = "wx-scrum-sprint-state wx-scrum-sprint-loading";

        const spinner = document.createElement("div");
        spinner.className = "spinner-border spinner-border-sm";
        spinner.setAttribute("role", "status");
        const sr = document.createElement("span");
        sr.className = "visually-hidden";
        sr.textContent = this._i18n("webexpress.webapp:scrum.loading", "Loading...");
        spinner.appendChild(sr);

        const label = document.createElement("span");
        label.textContent = this._i18n("webexpress.webapp:scrum.loading", "Loading...");

        wrap.appendChild(spinner);
        wrap.appendChild(label);
        return wrap;
    }

    /**
     * Builds the error state with a retry button.
     * @returns {HTMLElement}
     */
    _renderError() {
        const wrap = document.createElement("div");
        wrap.className = "wx-scrum-sprint-state wx-scrum-sprint-error";

        wrap.appendChild(webexpress.webui.Icon.create("wx-icon-light wx-icon-light-triangle-exclamation"));

        const msg = document.createElement("span");
        const errText = this._error && this._error.message ? this._error.message : "";
        msg.textContent = this._i18n("webexpress.webapp:scrum.load_failed", "Failed to load sprint.")
            + (errText ? " (" + errText + ")" : "");
        wrap.appendChild(msg);

        if (this._restUri) {
            const retry = document.createElement("button");
            retry.type = "button";
            retry.className = "btn btn-sm btn-light wx-scrum-sprint-retry";
            retry.textContent = this._i18n("webexpress.webapp:scrum.retry", "Retry");
            retry.addEventListener("click", () => this.refresh());
            wrap.appendChild(retry);
        }

        return wrap;
    }

    /**
     * Builds the title section with goal and chips.
     * @param {Object} v - view-model.
     * @returns {HTMLElement}
     */
    _renderHeader(v) {
        const sec = this._buildSection(this._i18n("webexpress.webapp:scrum.active_sprint", "Active sprint"));

        const name = document.createElement("div");
        name.className = "wx-scrum-sprint-name";
        name.appendChild(document.createTextNode(v.name));
        if (v.daysTotal > 0) {
            const day = document.createElement("span");
            day.className = "wx-scrum-sprint-day";
            day.textContent = "Day " + v.daysElapsed + "/" + v.daysTotal;
            name.appendChild(day);
        }
        sec.appendChild(name);

        if (v.goal) {
            const goal = document.createElement("div");
            goal.className = "wx-scrum-sprint-goal";
            goal.textContent = "🎯 " + v.goal;
            sec.appendChild(goal);
        }

        const chips = document.createElement("div");
        chips.className = "wx-scrum-sprint-chips";
        if (v.start) {
            chips.appendChild(this._buildChip(v.start));
        }
        if (v.end) {
            chips.appendChild(this._buildChip("→ " + v.end));
        }
        if (v.daysTotal > 0) {
            chips.appendChild(this._buildChip(v.daysLeft + " " + this._i18n("webexpress.webapp:scrum.days_left", "days left")));
        }
        sec.appendChild(chips);

        return sec;
    }

    /**
     * Builds the progress section.
     * @param {Object} v - view-model.
     * @returns {HTMLElement}
     */
    _renderProgress(v) {
        const sec = this._buildSection(this._i18n("webexpress.webapp:scrum.progress", "Progress"));
        sec.appendChild(this._buildMetric(v.completed, "/ " + v.committed + " pts"));
        sec.appendChild(this._buildBar(v.progressPct));

        const caption = this._buildCaption(
            v.progressPct + "% " + this._i18n("webexpress.webapp:scrum.completed", "completed")
            + " · " + v.completedItems + " / " + v.totalItems + " " + this._i18n("webexpress.webapp:scrum.items", "items")
        );
        sec.appendChild(caption);

        return sec;
    }

    /**
     * Builds the capacity section.
     * @param {Object} v - view-model.
     * @returns {HTMLElement}
     */
    _renderCapacity(v) {
        const sec = this._buildSection(this._i18n("webexpress.webapp:scrum.capacity", "Capacity"));
        sec.appendChild(this._buildMetric(v.committed, "/ " + v.capacity + " pts"));
        sec.appendChild(this._buildBar(v.capacityPct, v.overbooked));

        const captionKey = v.overbooked
            ? "webexpress.webapp:scrum.over_capacity"
            : "webexpress.webapp:scrum.free_capacity";
        const captionFallback = v.overbooked ? "over capacity" : "free";
        sec.appendChild(this._buildCaption(v.capacityDelta + " pts " + this._i18n(captionKey, captionFallback)));

        return sec;
    }

    /**
     * Builds the burndown chart section. Shows ideal vs actual lines, a
     * dashed "today" indicator and tooltip on hovering an actual point.
     * @param {Object} v - view-model.
     * @returns {HTMLElement}
     */
    _renderBurndown(v) {
        const sec = this._buildSection(this._i18n("webexpress.webapp:scrum.burndown", "Burndown"));

        const W = webexpress.webapp.ScrumSprintCtrl.CHART_W;
        const H = webexpress.webapp.ScrumSprintCtrl.CHART_H;

        // x is anchored to the ideal length so actual stays aligned
        const lengthForX = (v.ideal.length || v.actual.length);
        const max = Math.max(v.committed, ...v.ideal, ...v.actual, 1);

        const xs = (i) => (lengthForX > 1 ? (i / (lengthForX - 1)) * W : 0);
        const ys = (val) => H - (val / max) * H;

        const svg = this._svg("svg");
        svg.setAttribute("class", "wx-scrum-sprint-burndown");
        svg.setAttribute("viewBox", "0 0 " + W + " " + H);
        svg.setAttribute("width", "100%");
        svg.setAttribute("height", String(H));
        svg.setAttribute("preserveAspectRatio", "none");

        // ideal line
        if (v.ideal.length > 1) {
            svg.appendChild(this._svgPath(this._buildPath(v.ideal, xs, ys), "ideal"));
        }

        // today marker (dashed vertical line) at the current x position
        if (v.daysTotal > 0 && lengthForX > 1) {
            const todayX = xs(Math.min(v.daysElapsed, lengthForX - 1));
            const todayLine = this._svg("line");
            todayLine.setAttribute("x1", todayX.toFixed(1));
            todayLine.setAttribute("x2", todayX.toFixed(1));
            todayLine.setAttribute("y1", "0");
            todayLine.setAttribute("y2", String(H));
            todayLine.setAttribute("class", "today");
            const todayTitle = this._svg("title");
            todayTitle.textContent = this._i18n("webexpress.webapp:scrum.today", "Today");
            todayLine.appendChild(todayTitle);
            svg.appendChild(todayLine);
        }

        // actual line
        if (v.actual.length > 1) {
            svg.appendChild(this._svgPath(this._buildPath(v.actual, xs, ys), "actual"));
        }

        // hover-able actual data points (above lines so they catch pointer events)
        const startDate = this._parseDate(v.start);
        for (let i = 0; i < v.actual.length; i++) {
            const cx = xs(i);
            const cy = ys(v.actual[i]);
            const isLast = i === v.actual.length - 1;

            const dot = this._svg("circle");
            dot.setAttribute("cx", cx.toFixed(1));
            dot.setAttribute("cy", cy.toFixed(1));
            dot.setAttribute("r", isLast ? "2.5" : "1.8");
            dot.setAttribute("class", isLast ? "marker" : "point");

            const dateLabel = this._dayLabel(startDate, i);
            const tip = this._svg("title");
            tip.textContent = this._i18n("webexpress.webapp:scrum.day_short", "Day") + " " + i
                + (dateLabel ? " · " + dateLabel : "")
                + " · " + this._formatPoints(v.actual[i]) + " pts";
            dot.appendChild(tip);

            svg.appendChild(dot);
        }

        sec.appendChild(svg);
        sec.appendChild(this._buildCaption(this._trendLabel(v.ideal, v.actual, v.daysElapsed)));

        return sec;
    }

    /**
     * Builds an SVG path "d" attribute from a series of values.
     * @param {Array<number>} values
     * @param {(i:number)=>number} xs
     * @param {(v:number)=>number} ys
     * @returns {string}
     */
    _buildPath(values, xs, ys) {
        return values
            .map((v, i) => (i === 0 ? "M" : "L") + xs(i).toFixed(1) + " " + ys(v).toFixed(1))
            .join(" ");
    }

    /**
     * Creates a generic SVG element in the SVG namespace.
     * @param {string} tag
     * @returns {SVGElement}
     */
    _svg(tag) {
        return document.createElementNS(webexpress.webapp.ScrumSprintCtrl.SVG_NS, tag);
    }

    /**
     * Creates an SVG path element.
     * @param {string} d
     * @param {string} className
     * @returns {SVGPathElement}
     */
    _svgPath(d, className) {
        const p = this._svg("path");
        p.setAttribute("d", d);
        p.setAttribute("class", className);
        return p;
    }

    /**
     * Builds a section wrapper with a leading eyebrow label.
     * @param {string} eyebrowText
     * @returns {HTMLElement}
     */
    _buildSection(eyebrowText) {
        const sec = document.createElement("div");
        sec.className = "wx-scrum-sprint-sec";

        const eyebrow = document.createElement("span");
        eyebrow.className = "wx-scrum-sprint-eyebrow";
        eyebrow.textContent = eyebrowText;
        sec.appendChild(eyebrow);

        return sec;
    }

    /**
     * Builds a numerator/denominator metric pair.
     * @param {number} numerator
     * @param {string} denominator
     * @returns {HTMLElement}
     */
    _buildMetric(numerator, denominator) {
        const metric = document.createElement("div");
        metric.className = "wx-scrum-sprint-metric";

        const num = document.createElement("span");
        num.className = "num";
        num.textContent = String(numerator);
        metric.appendChild(num);

        const denom = document.createElement("span");
        denom.className = "denom";
        denom.textContent = denominator;
        metric.appendChild(denom);

        return metric;
    }

    /**
     * Builds a horizontal bar with a fill width.
     * @param {number} pct - 0..100
     * @param {boolean} [warn=false] - render in warning style.
     * @returns {HTMLElement}
     */
    _buildBar(pct, warn = false) {
        const bar = document.createElement("div");
        bar.className = "wx-scrum-sprint-bar" + (warn ? " warn" : "");
        const fill = document.createElement("span");
        fill.style.width = Math.max(0, Math.min(100, pct)) + "%";
        bar.appendChild(fill);
        return bar;
    }

    /**
     * Builds a caption line below a section.
     * @param {string} text
     * @returns {HTMLElement}
     */
    _buildCaption(text) {
        const caption = document.createElement("div");
        caption.className = "wx-scrum-sprint-caption";
        caption.textContent = text;
        return caption;
    }

    /**
     * Helper to build a small chip element.
     * @param {string} text - The text shown in the chip.
     * @returns {HTMLElement}
     */
    _buildChip(text) {
        const chip = document.createElement("span");
        chip.className = "wx-scrum-sprint-chip";
        chip.textContent = text;
        return chip;
    }

    /**
     * Computes a synthetic ideal burndown line.
     * @param {number} committed - committed points.
     * @param {number} daysTotal - total sprint days.
     * @returns {Array<number>}
     */
    _idealLine(committed, daysTotal) {
        if (daysTotal <= 0 || committed <= 0) {
            return [];
        }
        const out = new Array(daysTotal + 1);
        for (let i = 0; i <= daysTotal; i++) {
            out[i] = committed - (committed * i / daysTotal);
        }
        return out;
    }

    /**
     * Returns a textual trend label depending on actual vs ideal at the
     * current point in time.
     * @param {Array<number>} ideal - ideal line.
     * @param {Array<number>} actual - actual line.
     * @param {number} daysElapsed - elapsed days.
     * @returns {string}
     */
    _trendLabel(ideal, actual, daysElapsed) {
        if (!actual || actual.length === 0) {
            return this._i18n("webexpress.webapp:scrum.trend.no_data", "Trend: no data");
        }
        const lastActual = actual[actual.length - 1];
        const idealAt = ideal[Math.min(daysElapsed, Math.max(ideal.length - 1, 0))] ?? lastActual;
        const delta = lastActual - idealAt;
        const tolerance = Math.max(1, idealAt * webexpress.webapp.ScrumSprintCtrl.OVERBOOK_THRESHOLD);

        if (delta > tolerance) {
            return this._i18n("webexpress.webapp:scrum.trend.behind", "Trend: behind");
        }
        if (delta < -tolerance) {
            return this._i18n("webexpress.webapp:scrum.trend.ahead", "Trend: ahead");
        }
        return this._i18n("webexpress.webapp:scrum.trend.on_track", "Trend: on track");
    }

    /**
     * Parses an ISO date string into a Date or returns null.
     * @param {string|null} iso
     * @returns {Date|null}
     */
    _parseDate(iso) {
        if (!iso) {
            return null;
        }
        const d = new Date(iso);
        return isNaN(d.getTime()) ? null : d;
    }

    /**
     * Returns the locale-formatted date for the i-th day of the sprint
     * (i = 0 → start). When the start date is unknown, returns null.
     * @param {Date|null} startDate
     * @param {number} dayIndex
     * @returns {string|null}
     */
    _dayLabel(startDate, dayIndex) {
        if (!startDate) {
            return null;
        }
        const d = new Date(startDate);
        d.setDate(d.getDate() + dayIndex);
        try {
            return d.toLocaleDateString();
        } catch (_) {
            return d.toISOString().split("T")[0];
        }
    }

    /**
     * Formats a point value, trimming trailing zeros for fractional values.
     * @param {number} v
     * @returns {string}
     */
    _formatPoints(v) {
        if (typeof v !== "number" || isNaN(v)) {
            return "0";
        }
        return Number.isInteger(v) ? String(v) : v.toFixed(1);
    }
};

// register the controller
webexpress.webui.Controller.registerClass("wx-webapp-scrum-sprint", webexpress.webapp.ScrumSprintCtrl);