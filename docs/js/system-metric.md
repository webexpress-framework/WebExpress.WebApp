![WebExpress](https://raw.githubusercontent.com/webexpress-framework/.github/main/docs/assets/img/banner.png)

# SystemMetricCtrl

The `SystemMetricCtrl` component renders a **live gauge for one system metric** of the server: the CPU load of the server process or the physical memory usage of the host. The readings arrive over the **MessageQueue WebSocket** (see `WebExpress.WebApp.WebMessageQueue.SystemMetricsDispatcher`): the server samples both metrics every two seconds and pushes a `webexpress.webapp.systemmetric.update` message per metric to the sessions that subscribed the metric's channel, so the gauge is live without any HTTP polling and survives page navigation, transient disconnects and multiple windows.

```
   value              bar
   ─────────────      ───────────────
   below 60 %    →    green
   from  60 %    →    yellow  (warn)
   from  85 %    →    red     (critical)
```

Each control instance renders exactly **one** metric. A surface that shows CPU and memory side by side places two instances, which keeps every gauge a small, composable unit instead of a configured dashboard widget.

The gauge comes in two **layouts**: a compact `bar` that fills to the current percentage (the default), and a `chart` that plots a live sparkline of the recent readings so a trend — a climbing load, a memory leak — is visible at a glance. The chart **scrolls right-to-left like a task manager CPU chart**: the newest reading sits at the right edge, older readings step to the left by a fixed slot width, and the oldest drops off the left once the rolling history of 45 readings is full. Both layouts share the same head line and the same threshold colors.

## Declarative Configuration

The control is bootstrapped from a single host element carrying the `wx-webapp-system-metric` CSS class. It reads its configuration from `data-` attributes, then replaces its content with the gauge: a head line (label and current percentage) and a color coded bar.

### Container Element Attributes

| Attribute     | Description                                                                                                | Example
|---------------|------------------------------------------------------------------------------------------------------------|----------------------------
| `data-metric` | Optional. The metric to render: `cpu` (processor load of the server process, normalized over all cores) or `ram` (physical memory usage of the host). Defaults to `cpu`. | `data-metric="ram"`
| `data-layout` | Optional. The visual form: `bar` (a filling bar) or `chart` (a live sparkline of the recent history). Defaults to `bar`. | `data-layout="chart"`
| `data-label`  | Optional. The caption above the gauge. Without a label the control falls back to the translated metric name (`webexpress.webapp:systemmetric.cpu` / `.ram`). | `data-label="Server load"`

The color is applied through the `wx-system-metric-warn` and `wx-system-metric-critical` modifier classes on the host (thresholds: 60 % and 85 %); below the warn threshold the gauge is green. In the bar layout the fill is `.wx-system-metric-bar-fill` inside a `.wx-system-metric-track`; in the chart layout an inline `<svg>` sparkline (`.wx-system-metric-chart-line` over `.wx-system-metric-chart-area`) plots the history on a fixed 100×100 viewBox stretched to the host, with the newest reading pinned to the right edge (x = 100) and older readings stepping left. The chart draws a faint square grid behind the trace (a CSS background on the `<svg>`, so it stays crisp and square regardless of the stretched viewBox), like a task manager CPU chart. The memory gauge additionally carries the absolute usage (`used / total`, formatted) as the host's tooltip. The host follows the page theme.

The control is authored in C# through the fluent surface, so the host element is produced by:

```csharp
// compact bar (default layout)
new ControlSystemMetric("cpu")
{
    Metric = _ => TypeSystemMetric.Cpu
};

// live sparkline of the recent memory history
new ControlSystemMetric("ram")
{
    Metric = _ => TypeSystemMetric.Ram,
    Layout = _ => TypeSystemMetricLayout.Chart,
    Label = _ => "Memory"
};
```

## Data Contract

There is **no REST endpoint**. On construction the control subscribes its metric's channel (`webexpress.webapp.systemmetric.cpu` or `webexpress.webapp.systemmetric.ram`) through the runtime channel subscription of `webexpress.webapp.MessageQueue` — the same mechanism the data change notifications ride — so the server addresses only the connections that render the metric, and a page without a gauge receives no metric traffic. The subscription is re-announced automatically after every reconnect.

Every reading arrives as a `webexpress.webapp.systemmetric.update` message:

| Field        | Type    | Purpose
|--------------|---------|--------------------------------------------------------------
| `type`       | string  | Always `webexpress.webapp.systemmetric.update`.
| `metric`     | string  | The metric the reading belongs to: `cpu` or `ram`. The controller ignores readings of other metrics.
| `value`      | number  | The reading as a percentage between 0 and 100, rounded to one decimal.
| `usedBytes`  | number  | Only on the `ram` metric: the physical memory in use, in bytes.
| `totalBytes` | number  | Only on the `ram` metric: the available physical memory, in bytes.

The CPU reading is the processor time of the **server process**, taken as the delta between two samples and normalized over all cores; the memory reading is the physical memory load of the **host** as the garbage collector reports it, which also respects container limits.

## Programmatic Control

Once initialized, the `SystemMetricCtrl` instance is retrievable via `getInstanceByElement(element)`. Its `value` getter exposes the last received percentage (or `null` before the first reading), `metric` names the rendered metric, `layout` names the rendered form (`bar` or `chart`), and the static `formatBytes` and `chartPoints` helpers format byte figures and map a reading history to the sparkline geometry.

```javascript
// find the host element in the DOM by its id
const element = document.getElementById("cpu");

// retrieve the controller instance associated with the element
const gauge = webexpress.webui.Controller.getInstanceByElement(element);

if (gauge) {
    console.log(gauge.metric); // "cpu"
    console.log(gauge.value);  // e.g. 12.3
}

webexpress.webapp.SystemMetricCtrl.formatBytes(3.4 * 1024 * 1024 * 1024); // "3.4 GB"
```

## Events

The following event is dispatched on the host and **bubbles**:

- **`webexpress.webui.Event.CHANGE_VALUE_EVENT`** — fired on every received reading. `event.detail` contains `{ metric, value }`.

```javascript
element.addEventListener(webexpress.webui.Event.CHANGE_VALUE_EVENT, (e) => {
    console.log(e.detail.metric, e.detail.value);
});
```
