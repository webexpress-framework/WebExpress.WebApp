![WebExpress](https://raw.githubusercontent.com/webexpress-framework/.github/main/docs/assets/img/banner.png)

# ScheduleCtrl

The `webexpress.webapp.ScheduleCtrl` is the data-driven schedule. It extends the WebUI [`ScheduleCtrl`](../../../WebExpress.WebUI/docs/js/schedule.md) with the data path: the items of the shown period and the holidays of the years it touches are loaded from REST endpoints, the matching range is reloaded whenever the view or the period changes, and item mutations are persisted.

The views, the calendar cultures, the navigation, the custom renderers and the interaction are entirely those of the base control — the two share one visual and functional concept and differ only in **where the data comes from**. Everything the base control documents applies here unchanged; this page covers only what is added.

## Declarative Configuration

The control is bootstrapped from a host element carrying the `wx-webapp-schedule` CSS class. It reads every attribute of the base control plus the ones below.

| Attribute                   | Description                                                                                                                | Example
|-----------------------------|----------------------------------------------------------------------------------------------------------------------------|----------------------------
| `data-auto-load`            | `false` skips the load on the first paint, leaving the statically authored items on screen. It loads otherwise.             | `data-auto-load="false"`
| `data-reload-on-navigate`   | `false` stops navigation and view switches from loading the new range. It reloads otherwise.                                | `data-reload-on-navigate="false"`
| `data-cache`                | `false` requests every range again instead of serving one already loaded from the client cache. It caches otherwise.        | `data-cache="false"`
| `data-refresh-interval`     | Seconds between periodic reloads of the shown period. Absent or non-positive means no polling.                              | `data-refresh-interval="60"`
| `data-holiday-region`       | The region the holidays are requested for, sent with the year.                                                              | `data-holiday-region="BY"`
| `data-creatable`            | `true` allows `createItem`.                                                                                                 | `data-creatable="true"`
| `data-deletable`            | `true` allows `deleteItem`.                                                                                                 | `data-deletable="true"`

The endpoints are not spelled as attributes. They are contributed in C# by `.DataService<TEndpoint>()` and `.HolidayService<TEndpoint>()` on `ControlDataSchedule`, which emit the hidden `wx-service` islands the client consumes. The **authentication headers, the retry policy and the change domains** live on those same descriptors — that is the one place the framework authors an endpoint, so there is no separate URL or token property.

## REST Contract

### Items — the `data` service

| Method   | URL                    | Body           | Response              | Purpose
|----------|------------------------|----------------|-----------------------|-----------------------------------
| `GET`    | `{data}?from=&to=`     | —              | `{ items, holidays }` | The items of a period.
| `POST`   | `{data}`               | `ScheduleItem` | `{ success, item }`   | Create.
| `PUT`    | `{data}`               | `ScheduleItem` | `{ success, item }`   | Update, which is the path a move takes.
| `DELETE` | `{data}?id=`           | —              | `{ success, id }`     | Delete.

`from` and `to` describe a **half-open range** of bare dates: `from` is the first day shown, `to` the day after the last. A source that cannot narrow by range may ignore them and return everything; the client renders only what falls into the shown period either way.

```json
{
    "items": [
        {
            "id": "standup",
            "title": "Standup",
            "start": "2026-08-12T09:00:00",
            "end": "2026-08-12T09:15:00",
            "allDay": false,
            "category": "crew",
            "colorCss": "bg-success",
            "icon": "users",
            "uri": "/meetings/standup",
            "meta": { "room": "Scumm Bar" }
        }
    ],
    "holidays": [
        { "date": "2026-08-15", "name": "Assumption Day", "region": "BY", "type": "public" }
    ]
}
```

The `items`/`events` and `holidays`/`publicHolidays` aliases are both accepted. Timestamps carry **no zone offset** and are parsed as local time; a holiday is a bare `yyyy-MM-dd` and is never turned into a point in time.

The write handlers answer with the persisted item, and **the server's version wins** — an id it assigns or a value it normalises is what the calendar goes on showing. A `PUT` for an unknown id must answer `404` rather than `200`: a successful answer would leave a moved entry where the user dropped it and the next reload would silently put it back.

### Holidays — the optional `holidays` service

| Method | URL                            | Response                          | Purpose
|--------|--------------------------------|-----------------------------------|--------------------------
| `GET`  | `{holidays}?year=&region=`     | `[…]` or `{ holidays: […] }`      | The holidays of one year and region.

Holidays are declared separately because they change once a year while the items change constantly, and the two are almost never owned by the same source. A year that has been loaded is never requested again unless the reload is forced. A range crossing new year fetches **both** years, so the January days of a December view come back with their holidays.

A schedule whose item endpoint already returns the holidays of the period simply omits the second service.

## Loading Behaviour

| Phase              | Behaviour
|--------------------|--------------------------------------------------------------------------------------
| Initial load       | The shown period is queried on construction, unless `data-auto-load="false"`.
| Navigation         | Stepping to another period or switching the view queries the new range, unless `data-reload-on-navigate="false"`.
| Range cache        | A range already loaded is not requested again. `refresh()` clears the caches; the periodic reload and a data-change notification bypass them.
| Periodic reload    | `data-refresh-interval` polls the shown period, but only while the host is visible.
| Live updates       | The control subscribes to the **change domains** of its service, so a change made elsewhere re-queries and flashes the calendar. This is the push path; the interval is for sources that cannot announce a change.
| Failure            | The last good model stays on screen, `DATA_ERROR_EVENT` is dispatched and the failure is logged. An empty calendar would read as "there is nothing", which is exactly the wrong conclusion when the endpoint is unreachable.
| Fallback           | Items added statically in C# are kept and can be restored with `restoreFallback()`.

Ranges are merged rather than replaced: everything that **starts** inside a freshly loaded range is replaced by what the server just sent, everything outside it is kept. Membership is decided by the start, so a multi-day item belongs to exactly one range and cannot be duplicated across two.

## Programmatic Control

```javascript
const element = document.querySelector(".wx-webapp-schedule");
const schedule = webexpress.webui.Controller.getInstanceByElement(element);

// reload the shown period, bypassing the range and holiday caches
await schedule.refresh();

// the softer form: skips the reload while the host is not visible
schedule.update();

// crud; create and delete are refused unless enabled on the control
const created = await schedule.createItem({
    title: "Sword fighting",
    start: "2026-08-20T09:00:00",
    end: "2026-08-20T11:00:00",
    category: "training"
});
await schedule.updateItem({ id: created.id, title: "Insult sword fighting", start: created.start, end: created.end });
await schedule.deleteItem(created.id);

// go back to the statically authored items
schedule.restoreFallback();
```

The navigation, the view switch, the model and the renderers are inherited unchanged — see the base control.

## Events

In addition to everything the base control dispatches:

| Event                                       | Fired when                                | `detail`
|---------------------------------------------|-------------------------------------------|-------------------------------------------
| `webexpress.webui.Event.DATA_REQUESTED_EVENT` | a period load is issued                 | `{ from, to }`
| `webexpress.webui.Event.DATA_ARRIVED_EVENT`   | a period has loaded                     | `{ from, to, count }`
| `webexpress.webui.Event.DATA_ERROR_EVENT`     | a load or a write failed                | `{ action, error, message, … }`
| `webexpress.webui.Event.CHANGE_VALUE_EVENT`   | an item was created, updated or deleted | `{ action, id, item }`

`action` is `load`, `holidays`, `create`, `update` or `delete`, which is what lets one handler distinguish a failed read from a refused write.

```javascript
element.addEventListener(webexpress.webui.Event.DATA_ERROR_EVENT, (e) => {
    if (e.detail.action === "load") {
        showBanner("The calendar could not be refreshed. Showing the last known state.");
    }
});
```

## Use Case Example

```csharp
new ControlDataSchedule("calendar")
{
    View = _ => TypeViewSchedule.Month,
    Culture = _ => "de-DE",
    IsoWeek = _ => true,
    ShowWeekNumbers = _ => true,
    MiniCalendar = _ => true,
    Editable = _ => true,
    Creatable = _ => true,
    Deletable = _ => true,
    HolidayRegion = _ => "BY",
    RefreshInterval = _ => 60
}
    .DataService<RestApiAppointments>()
    .HolidayService<RestApiHolidays>();
```

The item endpoint derives from `RestApiSchedule`, whose write handlers refuse by default — a read-only calendar needs no override and never silently accepts a change it does not persist:

```csharp
[Segment("appointments")]
public sealed class RestApiAppointments : RestApiSchedule
{
    protected override IEnumerable<RestApiScheduleItem> RetrieveItems(DateTime? from, DateTime? to, IRequest request)
    {
        return _store
            .Where(x => (from is null || x.End >= from) && (to is null || x.Start < to))
            .Select(x => new RestApiScheduleItem
            {
                Id = x.Id,
                Title = x.Title,
                Start = Format(x.Start),
                End = Format(x.End),
                Category = x.Category
            });
    }

    protected override RestApiScheduleItem Update(RestApiScheduleItem item, IRequest request)
    {
        // return null when the id is unknown, which answers 404
        return _store.TryUpdate(item) ? item : null;
    }
}
```

An authentication header, a retry policy or the change domains that drive the live updates are configured on the descriptor:

```csharp
new ControlDataSchedule("calendar")
    .DataService<RestApiAppointments>(svc => svc
        .WithHeader("X-Api-Key", token)
        .WithRetry(2, 250));
```

## ViewState Binding

`ControlDataSchedule` is **ViewState-capable**. Bound to a resource of an enclosing `ControlViewState`, the period becomes a slice of that ViewState's shared state:

```csharp
new ControlDataSchedule("calendar").Resource<PeriodResource>();
```

When a resource is bound the control emits only the `data-wx-resource` binding instead of its own islands, subscribes to the resource slice and re-renders whenever the ViewState re-queries it. The ViewState then owns the load, so the control's own range cache, periodic reload and navigation-triggered loads step aside.

## Extensibility

| Seam                          | How
|-------------------------------|--------------------------------------------------------------------------
| Renderers                     | `itemRenderer` and `holidayRenderer` of the base control.
| Calendar systems              | The Unicode calendar extension of the culture tag.
| REST adapter                  | The `kind` of the service descriptor selects the adapter the `ServiceRegistry` builds; `rest` is the shipped one.
| Caching strategy              | `data-cache` switches the built-in range cache off; a page that wants its own keeps it off and drives `model` directly.
| Offline / deferred mode       | `data-auto-load="false"` plus `restoreFallback()` renders the statically authored items and never touches the network until asked.
| External calendar sources     | ICS, CalDAV or Exchange are **server-side** concerns: an endpoint backed by any of them satisfies the same contract, and the control needs no change.
