![WebExpress](https://raw.githubusercontent.com/webexpress-framework/.github/main/docs/assets/img/banner.png)

# SlaCtrl

The `SlaCtrl` of `WebExpress.WebApp` is the **REST-backed service level agreement** of a domain object: the [WebUI agreement widget](../../../WebExpress.WebUI/docs/js/sla.md) with its state sourced from data. It loads the state from the configured endpoint, requests a pause, a resume or a manual settlement there, and optionally re-reads the state on an interval so several visitors of the same agreement stay in step.

Everything else - the countdown, the move between the states, the cycle rollover, the actions, the localisation - is inherited unchanged from `webexpress.webui.SlaCtrl`, which is what keeps the data-driven and the static agreement from ever disagreeing about what a status means.

## ControlDataSla

`ControlDataSla` derives from `ControlSla`, so **every property of the static agreement applies unchanged** - `Label`, `Start`, `Target`, `WarningThreshold`, `Recurrence`, `Cycles`, `ShowActions`, `Live`. Whatever is configured statically stays the fallback the widget shows until - and if - the endpoint answers; seeding it with the last known state is what keeps the tile from flashing an empty or violated frame on every page load.

| Property          | Type   | Description
|-------------------|--------|--------------------------------------------------------------------
| `RefreshInterval` | `int?` | The seconds between two reads of the endpoint. Without it the widget loads once and then counts on its own, which is correct as long as it is the only thing changing the agreement.

```csharp
new ControlDataSla("sla-response")
{
    Label = _ => "First response",
    Target = _ => TimeSpan.FromHours(4),
    Recurrence = _ => TypeRecurrenceSla.Daily,
    Cycles = _ => 5,
    RefreshInterval = _ => 30
}
    .DataService<SlaEndpoint>();
```

The endpoint, the authentication headers and the retry policy are not properties here: they belong to the service descriptor that `DataService<TEndpoint>()` emits as a `wx-service` island, which is the one place the framework authors an endpoint.

> **The interval is a poll, not a stream.** It costs one request per widget and interval, so a wall display of thirty agreements is better served by one longer interval than by thirty short ones.

## Service Contract

`DataService<TEndpoint>()` declares the standard service of the agreement (`DataServiceDescriptor.SlaData`): it loads the state with `GET` and requests a transition with `POST`, because a pause or a settlement is an action the endpoint applies to the agreement rather than a new representation the client dictates.

**Load**

```http
GET /api/v1/sla
```

**Transition**

```http
POST /api/v1/sla
Content-Type: application/json

{ "action": "pause" }
```

Both answer with the state that resulted. Every field is optional; the widget adopts the ones it is given and keeps the rest.

```json
{
    "status": "paused",
    "target": 14400,
    "elapsed": 11520,
    "remaining": 2880,
    "period": 86400,
    "cycle": 3,
    "cycles": 5,
    "paused": true,
    "settled": false
}
```

An endpoint owns no logic of its own - it applies the transitions of `SlaDefinition` and reports what `SlaEvaluator` derives from the result, so the widget, the endpoint and the tests all arrive at the same status by the same route.

## Declarative Configuration

The control is bootstrapped from a host element carrying the `wx-webapp-sla` CSS class. It renders the full agreement markup of the WebUI control, so [every attribute of the base contract](../../../WebExpress.WebUI/docs/js/sla.md#declarative-configuration) is present and seeded by the server; on top of it the host carries the data islands.

| Attribute               | Description                                                             | Example
|-------------------------|---------------------------------------------------------------------------|-----------------------------
| `data-refresh-interval` | The seconds between two reads of the endpoint. Absent when it loads once. | `data-refresh-interval="30"`
| `<wx-service>`          | The service island the state is loaded from and the transitions are sent to.

## Events

In addition to the events of the base control:

| Event                                  | Constant              | Detail
|----------------------------------------|-----------------------|------------------------
| `webexpress.webapp.change.status`      | `CHANGE_STATUS_EVENT` | `action`, `status` - raised after a transition was persisted
| `webexpress.webui.data.error`          | `DATA_ERROR_EVENT`    | `action`, `error` - raised when a load or a transition failed

A transition is applied locally first and persisted afterwards: the visitor asked for it and the outcome is known, so waiting for a round trip to grey out a paused agreement would make the button feel broken. The state the endpoint answers with is adopted when it arrives, which is how the widget recovers from a local guess the endpoint did not agree with.

## Use Case Example

```html
<div id="sla-response"
     class="wx-sla wx-webapp-sla wx-sla-at-risk"
     role="group"
     aria-label="First response"
     data-status="at-risk"
     data-target="14400"
     data-elapsed="11520"
     data-remaining="2880"
     data-recurrence="daily"
     data-period="86400"
     data-cycle="3"
     data-cycles="5"
     data-refresh-interval="30">

    <!-- the agreement markup of the WebUI control -->

    <wx-service hidden name="data" kind="rest"
                base-uri="/api/v1/sla"
                method="GET"
                update-method="POST"></wx-service>
</div>
```
