![WebExpress](https://raw.githubusercontent.com/webexpress-framework/.github/main/docs/assets/img/banner.png)

# TrafficLightCtrl

The `TrafficLightCtrl` component renders a **REST-backed traffic light** for a domain object: it lights one of three lamps — red, yellow or green — to show a status. The current status is **loaded** from a REST endpoint on mount (`GET`) and a user change is **persisted** with the service's update method (`PUT` by default). With `data-readonly="true"` the lamps are rendered for reading only and nothing is persisted.

The control **composes** the matching WebUI representation rather than hard-coding one — exactly the read-only / editable split the table template uses:

- **read-only** (`data-readonly="true"`) composes `webexpress.webui.TrafficLightCtrl`, a static `role="img"` display;
- **editable** composes `webexpress.webui.InputTrafficLightCtrl`, the interactive lamp engine, and persists each change.

All network access is routed through the **service layer** (`webexpress.webapp.ServiceRegistry`), so the endpoint stays authored in C# and resolved through the sitemap.

```
   ┌─────┐
   │  ○  │   red
   │  ●  │   yellow   ← lit lamp reflects the loaded status
   │  ○  │   green
   └─────┘
```

## Declarative Configuration

The control is bootstrapped from a single host element carrying the `wx-webapp-traffic-light` CSS class. It reads its configuration from the data island and `data-` attributes, then rewrites the element's contents to render the lamps.

### Container Element Attributes

| Attribute            | Description                                                                                               | Example
|----------------------|----------------------------------------------------------------------------------------------------------|------------------------------------
| `<wx-service>`       | Hidden service island emitted by `EmitDataIslands`. Carries the endpoint, the load method and the update method. | `name="data" base-uri="/api/status/INC-1" method="GET" update-method="PUT"`
| `data-value`         | Optional. The initial lit lamp (`red`, `yellow`, `green`) rendered server-side to avoid a flash before the endpoint responds. | `data-value="green"`
| `data-orientation`   | Optional. `vertical` (default) stacks the lamps; `horizontal` lines them up.                              | `data-orientation="horizontal"`
| `data-readonly`      | When `"true"`, the lamps are rendered for reading only; a change is neither possible nor persisted.       | `data-readonly="true"`

The `ControlDataTrafficLight.Size` property scales the lamps through the shared `.wx-traffic-light-{xs,sm,lg,xl}` modifier classes (the compact default emits none), and the housing follows the page theme: bright in light mode, dark under `[data-bs-theme="dark"]`.

The endpoint is authored in C# through the fluent data surface, so the host element is produced by:

```csharp
new ControlDataTrafficLight("crew-status")
    .DataService<MonkeyIslandStatus>();
```

### REST Contract

A **single endpoint** serves both operations.

| Method | URL          | Body         | Response       | Purpose
|--------|--------------|--------------|----------------|----------------------------------
| `GET`  | `{base-uri}` | —            | `{ value }`    | Load the current status token.
| `PUT`  | `{base-uri}` | `{ value }`  | `{ value }`    | Persist the chosen status token.

The status token is one of `red`, `yellow`, `green` or an empty string for off. The client also accepts a bare string or an object carrying `value`, `state` or `status` in the `GET` response.

The server side is a plain REST endpoint that answers `GET` and `PUT`; the fluent `DataService<TEndpoint>()` preset wires the load (`GET`) and update (`PUT`) methods into the service island.

## Programmatic Control

Once initialized, the `TrafficLightCtrl` instance is retrievable via `getInstanceByElement(element)`. Its `value` getter/setter (delegating to the composed inner control) exposes the current lamp token; assigning it through user interaction also persists the change.

```javascript
// find the host element in the DOM by its id (the controller consumes the
// wx-webapp-traffic-light marker class when it mounts the control)
const element = document.getElementById("crew-status");

// retrieve the controller instance associated with the element
const trafficLight = webexpress.webui.Controller.getInstanceByElement(element);

// read the current status
if (trafficLight) {
    console.log(trafficLight.value); // e.g. "green"
}
```

## Events

The composed inner control fires `webexpress.webui.Event.CHANGE_VALUE_EVENT` on every local change (it bubbles to the host); the following higher-level event fires on the host **after** the change has been persisted via REST. The event bubbles.

- **`webexpress.webapp.Event.CHANGE_STATUS_EVENT`** — fired after a successful `PUT`. `event.detail` contains `{ value }`.

```javascript
element.addEventListener(webexpress.webapp.Event.CHANGE_STATUS_EVENT, (e) => {
    console.log("status persisted:", e.detail.value);
});
```

## Read-only Mode

Setting `data-readonly="true"` (or `Readonly = _ => true` on the `ControlDataTrafficLight`) composes the dedicated **read-only representation** (`webexpress.webui.TrafficLightCtrl`, `role="img"`) instead of a disabled input: the current status is still loaded from the endpoint, but the lamps are not interactive and a change is never persisted. This is useful for dashboards and status surfaces that display a state without allowing edits.

## ViewState Binding

`ControlDataTrafficLight` is **ViewState-capable**. Bound to a resource of an enclosing `ControlViewState`, the status becomes a slice of that ViewState's shared state instead of an independent surface:

```csharp
new ControlViewState("incident", status, tags, assignee)
    .State(s => s./* … */)
    .Service("data", svc => svc./* … */)
    .Resource<IncidentStatusResource>();

// inside the ViewState:
new ControlDataTrafficLight("status").Resource<IncidentStatusResource>();
```

When a resource is bound the control:

- emits only the `data-wx-resource` binding (and the optional `data-wx-viewstate` id) instead of its own `wx-service` island, because the ViewState owns the state, the service and the central load;
- on the client, resolves the enclosing `ViewState`, **subscribes** to the resource slice and re-renders whenever the ViewState re-queries it;
- in editable mode, persists a change through the ViewState's resource service and then **re-queries** the resource, so every sibling control bound to the same resource refreshes.

Left unbound, the control owns its `wx-service` island and loads itself (standalone), exactly as documented above. The path is chosen automatically — by `DataIslandExtensions.EmitDataIslands` on the server and by the presence of `data-wx-resource` on the client.
