/**
 * Live gauge for one system metric of the server (cpu load or memory usage).
 *
 * The server samples the metrics every two seconds and pushes them over the
 * MessageQueue WebSocket (WebExpress.WebApp.WebMessageQueue.SystemMetricsDispatcher)
 * as webexpress.webapp.systemmetric.update messages, addressed to the sessions
 * that subscribed the metric's channel. On construction the control subscribes
 * its metric (webexpress.webapp.systemmetric.cpu or .ram) through the runtime
 * channel subscription of the MessageQueue, so the readings start flowing
 * without any HTTP polling and resume automatically after a reconnect.
 *
 * Each control instance renders exactly one metric, in one of two layouts:
 * a compact bar that fills to the current percentage, or a live sparkline
 * chart that scrolls right-to-left (newest reading at the right edge) like a
 * task manager cpu chart, so a trend is visible at a glance. Both
 * layouts share the color thresholds (green, yellow from the warn threshold,
 * red from the critical threshold); the memory gauge additionally carries the
 * absolute usage as its tooltip.
 *
 * Dispatched events (CustomEvent on the host element, bubbles):
 * - webexpress.webui.Event.CHANGE_VALUE_EVENT with { metric, value }
 */
webexpress.webapp.SystemMetricCtrl = class extends webexpress.webui.Ctrl {
    /**
     * The wire type the SystemMetricsDispatcher sends. Must match
     * SystemMetricMessageTypes.Update on the server.
     * @type {string}
     */
    static UPDATE_TYPE = "webexpress.webapp.systemmetric.update";

    /**
     * The prefix of the subscription channel of a metric. Must match
     * SystemMetricMessageTypes.Channel on the server.
     * @type {string}
     */
    static CHANNEL_PREFIX = "webexpress.webapp.systemmetric.";

    /**
     * The SVG namespace used to build the chart layout.
     * @type {string}
     */
    static SVG_NS = "http://www.w3.org/2000/svg";

    /**
     * How many readings the chart layout keeps and plots. At the two second
     * sampling interval this is roughly a minute and a half of history.
     * @type {number}
     */
    static HISTORY_LENGTH = 45;

    /**
     * From this percentage on the gauge turns yellow.
     * @type {number}
     */
    static WARN_THRESHOLD = 60;

    /**
     * From this percentage on the gauge turns red.
     * @type {number}
     */
    static CRITICAL_THRESHOLD = 85;

    /**
     * Constructor.
     * @param {HTMLElement} element - The DOM element associated with the control.
     */
    constructor(element) {
        super(element);

        this._metric = (element.dataset.metric || "cpu").toLowerCase();
        this._layout = (element.dataset.layout || "bar").toLowerCase() === "chart" ? "chart" : "bar";
        this._label = element.dataset.label
            || this._i18n("webexpress.webapp:systemmetric." + this._metric, this._metric.toUpperCase());
        this._value = null;
        this._history = [];

        element.removeAttribute("data-metric");
        element.removeAttribute("data-layout");
        element.removeAttribute("data-label");

        // the styling hook classes are NOT the registered selector, so a later
        // DOM scan never re-instantiates the control on the same host
        element.classList.add("wx-system-metric", "wx-system-metric-" + this._layout);

        // head: the label and the current value, shared by both layouts
        this._labelSpan = document.createElement("span");
        this._labelSpan.className = "wx-system-metric-label";
        this._labelSpan.textContent = this._label;

        this._valueSpan = document.createElement("span");
        this._valueSpan.className = "wx-system-metric-value";
        this._valueSpan.textContent = "–";

        const head = document.createElement("div");
        head.className = "wx-system-metric-head";
        head.appendChild(this._labelSpan);
        head.appendChild(this._valueSpan);

        element.innerHTML = "";
        element.appendChild(head);
        element.appendChild(this._layout === "chart" ? this._buildChart() : this._buildBar());

        // subscribe the metric's channel on the shared MessageQueue; the queue
        // re-announces the subscription after every reconnect, so the stream
        // resumes without the control doing anything
        this._queue = (typeof webexpress !== "undefined" && webexpress.webapp)
            ? webexpress.webapp.MessageQueue
            : null;
        this._onMessage = (payload) => this._handleMessage(payload);

        if (this._queue) {
            this._queue.register(this._onMessage);
            if (typeof this._queue.subscribeDomains === "function") {
                this._queue.subscribeDomains([
                    webexpress.webapp.SystemMetricCtrl.CHANNEL_PREFIX + this._metric
                ]);
            }
        }
    }

    /**
     * Releases the queue listener. Called by the controller on teardown.
     */
    destroy() {
        if (this._queue && this._onMessage) {
            this._queue.unregister(this._onMessage);
        }
    }

    /**
     * Returns the last received reading as a percentage, or null before the
     * first update arrived.
     * @returns {number|null} The reading.
     */
    get value() {
        return this._value;
    }

    /**
     * Returns the metric this control renders ("cpu" or "ram").
     * @returns {string} The metric token.
     */
    get metric() {
        return this._metric;
    }

    /**
     * Returns the layout this control renders ("bar" or "chart").
     * @returns {string} The layout token.
     */
    get layout() {
        return this._layout;
    }

    /**
     * Builds the bar layout: a track with a filling bar that carries the
     * progressbar semantics.
     * @returns {HTMLElement} The bar body.
     */
    _buildBar() {
        this._bar = document.createElement("div");
        this._bar.className = "wx-system-metric-bar-fill";

        this._track = document.createElement("div");
        this._track.className = "wx-system-metric-track";
        this._track.setAttribute("role", "progressbar");
        this._track.setAttribute("aria-valuemin", "0");
        this._track.setAttribute("aria-valuemax", "100");
        this._track.appendChild(this._bar);

        return this._track;
    }

    /**
     * Builds the chart layout: an SVG sparkline with a filled area under a
     * line. The viewBox is a fixed 100x100 grid stretched to the host, so the
     * readings map to percentages directly and the line stays crisp through a
     * non-scaling stroke.
     * @returns {HTMLElement} The chart body.
     */
    _buildChart() {
        const ns = webexpress.webapp.SystemMetricCtrl.SVG_NS;

        this._svg = document.createElementNS(ns, "svg");
        this._svg.setAttribute("class", "wx-system-metric-chart-svg");
        this._svg.setAttribute("viewBox", "0 0 100 100");
        this._svg.setAttribute("preserveAspectRatio", "none");
        this._svg.setAttribute("role", "img");

        this._area = document.createElementNS(ns, "polygon");
        this._area.setAttribute("class", "wx-system-metric-chart-area");
        this._area.setAttribute("points", "");

        this._line = document.createElementNS(ns, "polyline");
        this._line.setAttribute("class", "wx-system-metric-chart-line");
        this._line.setAttribute("points", "");
        this._line.setAttribute("vector-effect", "non-scaling-stroke");

        this._svg.appendChild(this._area);
        this._svg.appendChild(this._line);

        return this._svg;
    }

    /**
     * Filters the queue traffic down to the updates of this control's metric.
     * @param {*} payload - The message payload.
     */
    _handleMessage(payload) {
        if (!payload || typeof payload !== "object"
            || payload.type !== webexpress.webapp.SystemMetricCtrl.UPDATE_TYPE
            || payload.metric !== this._metric
            || typeof payload.value !== "number") {
            return;
        }

        this.update(payload);
    }

    /**
     * Renders a fresh reading: the percentage text, the threshold color, the
     * active layout (the bar width or the appended sparkline point) and, for a
     * metric that carries byte figures, the absolute usage as the tooltip.
     * @param {object} payload - The update { value, usedBytes?, totalBytes? }.
     */
    update(payload) {
        const ctor = webexpress.webapp.SystemMetricCtrl;
        this._value = Math.max(0, Math.min(100, payload.value));

        this._valueSpan.textContent = this._value.toFixed(1) + " %";

        this._element.classList.toggle("wx-system-metric-warn",
            this._value >= ctor.WARN_THRESHOLD && this._value < ctor.CRITICAL_THRESHOLD);
        this._element.classList.toggle("wx-system-metric-critical",
            this._value >= ctor.CRITICAL_THRESHOLD);

        if (this._layout === "chart") {
            this._history.push(this._value);
            if (this._history.length > ctor.HISTORY_LENGTH) {
                this._history.shift();
            }
            this._renderChart();
        } else {
            this._bar.style.width = this._value + "%";
            this._track.setAttribute("aria-valuenow", String(this._value));
        }

        if (typeof payload.usedBytes === "number" && typeof payload.totalBytes === "number") {
            this._element.title = ctor.formatBytes(payload.usedBytes)
                + " / " + ctor.formatBytes(payload.totalBytes);
        }

        this._dispatch(webexpress.webui.Event.CHANGE_VALUE_EVENT, {
            metric: this._metric,
            value: this._value
        });
    }

    /**
     * Recomputes the sparkline from the reading history. The newest reading
     * sits at the right edge and older readings step to the left, so the chart
     * scrolls right-to-left like a task manager cpu chart; a value of 100 sits
     * at the top (y = 0), so the trace reads like the bar. The area repeats the
     * trace and closes down to the baseline for the fill.
     */
    _renderChart() {
        const ctor = webexpress.webapp.SystemMetricCtrl;
        const n = this._history.length;
        const points = ctor.chartPoints(this._history);
        this._line.setAttribute("points", points);

        if (n > 0) {
            const step = 100 / Math.max(1, ctor.HISTORY_LENGTH - 1);
            const oldestX = (100 - (n - 1) * step).toFixed(2);
            // close the trace to the baseline, from the newest point at the
            // right edge back to the oldest point on the left
            this._area.setAttribute("points", points + " 100.00,100.00 " + oldestX + ",100.00");
        } else {
            this._area.setAttribute("points", "");
        }

        this._svg.setAttribute("aria-label", this._label + " " + this._value.toFixed(1) + " %");
    }

    /**
     * Maps a reading history to the sparkline points on the fixed 100x100
     * viewBox. Kept pure and static so the geometry is unit testable: the
     * newest reading (last in the history) sits at the right edge (x = 100) and
     * each older reading steps one fixed slot to the left, so the trace scrolls
     * right-to-left and the oldest reading drops off the left once the history
     * is full. A higher percentage sits higher (a lower y).
     * @param {Array<number>} history - The readings, oldest first.
     * @param {number} [capacity] - The history capacity that fixes the slot width; defaults to HISTORY_LENGTH.
     * @returns {string} The SVG points attribute, for example "75.00,40.00 100.00,10.00".
     */
    static chartPoints(history, capacity = webexpress.webapp.SystemMetricCtrl.HISTORY_LENGTH) {
        const n = history.length;
        if (n === 0) {
            return "";
        }

        const step = 100 / Math.max(1, capacity - 1);

        return history.map((value, index) => {
            const x = 100 - (n - 1 - index) * step;
            const y = 100 - Math.max(0, Math.min(100, value));
            return x.toFixed(2) + "," + y.toFixed(2);
        }).join(" ");
    }

    /**
     * Formats a byte figure into a compact, human readable unit. Kept pure and
     * static so the formatting is unit testable.
     * @param {number} bytes - The byte figure.
     * @returns {string} The formatted figure, for example "3.4 GB".
     */
    static formatBytes(bytes) {
        if (!(bytes >= 0)) {
            return "0 B";
        }

        const units = ["B", "KB", "MB", "GB", "TB"];
        let value = bytes;
        let unit = 0;

        while (value >= 1024 && unit < units.length - 1) {
            value /= 1024;
            unit += 1;
        }

        return (unit >= 3 ? value.toFixed(1) : String(Math.round(value))) + " " + units[unit];
    }
};

// register the control with the controller for auto-instantiation
webexpress.webui.Controller.registerClass("wx-webapp-system-metric", webexpress.webapp.SystemMetricCtrl);
