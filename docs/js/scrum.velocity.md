![WebExpress](https://raw.githubusercontent.com/webexpress-framework/.github/main/docs/assets/img/banner.png)

# ScrumVelocityCtrl

The `ScrumVelocityCtrl` component renders the velocity of the last few sprints as a small column chart. Each column is one sprint: the solid bar is the **completed** story points (the sprint's velocity), the faint backdrop bar is the **committed** points, and a dashed line marks the **average** velocity across the shown sprints. The header carries the rolling average. Only the last *N* sprints are drawn, so the chart stays compact in a sidebar or dashboard tile.

The control is read-only: it loads its data via a single `GET` and never mutates it. The chart is built from plain HTML/CSS so the labels and values stay crisp across themes.

```
   ┌──────────────────────────────────────────────────────────┐
   │ VELOCITY                                       Ø 26 pts  │
   │                                                          │
   │  31                              28                      │
   │  ┌─┐‐ ‐ ‐ ‐ 24‐ ‐ ‐ 27 ‐ ‐ ‐ ‐ ‐ ┌─┐ ‐ ‐ ‐ ‐ ‐ ‐ avg     │
   │  │█│  18    ┌─┐      ┌─┐         │█│        22           │
   │  │█│  ┌─┐   │█│      │█│   25     │█│        ┌─┐         │
   │  │█│  │█│   │█│      │█│   ┌─┐    │█│        │█│         │
   │  S1   S2    S3       S4   S5     S6         S7           │
   │                                                          │
   │  ■ Completed   □ Committed                               │
   └──────────────────────────────────────────────────────────┘
```

## Declarative Configuration

The control is bootstrapped from a single host element carrying the `wx-webapp-scrum-velocity` CSS class. The endpoint is authored in C# through a `wx-service` island named `data`; the client resolves it and rewrites the element's contents to render the chart.

### Container Element Attributes

| Attribute            | Description                                                                                         | Example
|----------------------|----------------------------------------------------------------------------------------------------|-----------------------------
| `data-max-sprints`   | Maximum number of most recent sprints drawn in the chart. Defaults to `6`.                         | `data-max-sprints="8"`

The data endpoint is not spelled as an attribute. It is contributed in C# by `.DataService<TEndpoint>()` on `ControlDataScrumVelocity`, which emits the hidden `wx-service` island the client consumes.

### REST Contract

| Method   | URL            | Body | Response                       | Purpose
|----------|----------------|------|--------------------------------|-------------------------------------------
| `GET`    | `{data}`       | —    | `VelocitySprint[]`             | Initial load and refresh.

The endpoint returns the sprints in **chronological order (oldest first)**; the client keeps the trailing `data-max-sprints` entries. `VelocitySprint` objects carry `id`, `name`, `committed` and `completed`; `committed` and `completed` are coerced to non-negative integers.

```json
[
    { "id": "s1", "name": "Sprint 1", "committed": 30, "completed": 24 },
    { "id": "s2", "name": "Sprint 2", "committed": 28, "completed": 27 },
    { "id": "s3", "name": "Sprint 3", "committed": 26, "completed": 26 }
]
```

## Programmatic Control

Once initialized, the `ScrumVelocityCtrl` instance is retrievable via `getInstanceByElement(element)` for refreshing the chart or reading the current sprints.

```javascript
// find the host element in the DOM
const velocityElement = document.querySelector(".wx-webapp-scrum-velocity");

// retrieve the controller instance associated with the element
const velocityCtrl = webexpress.webui.Controller.getInstanceByElement(velocityElement);

// force a re-fetch from the server (useful after a sprint is closed)
if (velocityCtrl) {
    velocityCtrl.refresh();
}

// read the current sprints (a copy of { id, name, committed, completed })
const sprints = velocityCtrl ? velocityCtrl.value : [];
```

## Events

The component dispatches the standard data lifecycle events on the host element. All events bubble.

- **`webexpress.webui.Event.DATA_REQUESTED_EVENT`** — fired before the `GET` is issued.
- **`webexpress.webui.Event.DATA_ARRIVED_EVENT`** — fired after the sprints have loaded successfully.
- **`webexpress.webui.Event.UPDATED_EVENT`** — fired after every render of the chart.

```javascript
velocityElement.addEventListener(webexpress.webui.Event.DATA_ARRIVED_EVENT, () => {
    console.log("Velocity loaded");
});
```

## Use Case Examples

The following example wires a `ScrumVelocityCtrl` into a sprint dashboard. The chart sits inside a card and is fed by the velocity endpoint.

```html
<!-- Dashboard card -->
<div class="wx-webapp-side-card">
    <!-- The scrum velocity control: bootstraps itself from the wx-service island -->
    <div class="wx-webapp-scrum-velocity" data-max-sprints="6"></div>
</div>
```

Authored in C# with the fluent data surface:

```csharp
new ControlDataScrumVelocity("sprint-velocity")
{
    MaxSprints = _ => 6
}
    .DataService<RestApiScrumVelocity>();
```

## Colors

The bar and line colors are user-definable, exactly like a control button. Each color is a `PropertyColorBackground`: a **system color** (`TypeColorBackground.Success`, …) is emitted as a CSS class (`bg-success`) and a **user-defined color** (`"#2563eb"`) as an inline style. When a color is not set, the stylesheet default applies. The client applies the class when present and otherwise the inline style, so both the CSS and the style path are honored.

| Property         | Element
|------------------|-------------------------------------------
| `ColorCompleted` | The completed (velocity) bars and their legend swatch.
| `ColorCommitted` | The committed backdrop bars and their legend swatch.
| `ColorAverage`   | The average line.

```csharp
new ControlDataScrumVelocity("sprint-velocity")
{
    MaxSprints = _ => 6,
    ColorCompleted = _ => new PropertyColorBackground("#2563eb"),                  // user-defined → inline style
    ColorAverage   = _ => new PropertyColorBackground(TypeColorBackground.Danger)  // system → CSS class
}
    .DataService<RestApiScrumVelocity>();
```

## ViewState Binding

`ControlDataScrumVelocity` is **ViewState-capable**. Bound to a resource of an enclosing `ControlViewState`, the sprint history becomes a slice of that ViewState's shared state instead of an independent surface:

```csharp
// inside the ViewState:
new ControlDataScrumVelocity("sprint-velocity").Resource<SprintVelocityResource>();
```

When a resource is bound the control:

- emits only the `data-wx-resource` binding (and the optional `data-wx-viewstate` id) instead of its own `wx-service` island, because the ViewState owns the state, the service and the central load;
- on the client, resolves the enclosing `ViewState`, **subscribes** to the resource slice and re-renders the chart whenever the ViewState re-queries it.

Left unbound, the control owns its `wx-service` island and loads itself (standalone), exactly as documented above. The path is chosen automatically — by `DataIslandExtensions.EmitDataIslands` on the server and by the presence of `data-wx-resource` on the client.
