![WebExpress](https://raw.githubusercontent.com/webexpress-framework/.github/main/docs/assets/img/banner.png)

# DashboardCtrl

The `DashboardCtrl` (`wx-webapp-dashboard`) arranges widgets into independent vertical columns (lanes). Each column has a title, a size and an optional accent color; each widget is a card with a title, an optional color and type-specific content. The REST-backed controller loads the board from a `GET`, and persists every structural change (column add / rename / reorder / resize / recolor / delete and widget add / move / reconfigure / delete) back to the endpoint.

```
┌───────────────────────────────────────────────── ⋮ (board menu) ┐
│  ● Locations        │  ● Inventory      │  ● Crew           ⋮    │
│  ┌───────────── ⋮ ┐  │  ┌──────────── ⋮ ┐ │  ┌──────────── ⋮ ┐    │
│  │⠿ Scumm Bar    │  │  │⠿ Inventory   │ │  │⠿ Velocity     │    │
│  │ …content…     │  │  │ …content…    │ │  │ …chart…       │    │
│  └───────────────┘  │  └──────────────┘ │  └───────────────┘    │
└──────────────────────────────────────────────────────────────────┘
   ● = column color   ⠿ = move handle   ⋮ = "…" menu (hover)
```

The move handles and the per-column / per-widget "…" menus reveal on hover; an open menu keeps its trigger visible. The board "…" menu (top right) stays visible as the entry point for adding columns and items.

## Declarative Configuration

The controller bootstraps from a host element carrying the `wx-webapp-dashboard` CSS class. The data endpoint is authored in C# through a `wx-service` island named `data` (or a bound ViewState resource, see below); the client resolves it, loads the board and rewrites the host.

### Container Element Attributes

| Attribute                    | Enables                                                                                     |
|------------------------------|---------------------------------------------------------------------------------------------|
| `data-editable-column`       | The column "…" menu entries **Rename**, **Size** and **Color**.                             |
| `data-movable-column`        | The ⠿ move handle and drag-and-drop column reordering (with before/after drop indicators).  |
| `data-deletable-column`      | The column "…" menu entry **Delete**.                                                       |
| `data-addable-column`        | The board "…" menu entry **New column**.                                                    |
| `data-addable-widget`        | The board "…" menu **Add item** section, populated from the server's `availableWidgets`.    |
| `data-configurable-widget`   | The **Settings** entry in each widget's "…" menu (always name + color, plus type fields).    |

Each attribute is emitted only when its `ControlDataDashboard` flag is set, so a read-only board carries none of them and offers no affordances.

## Menus

- **Board "…" menu** — adds a **New column** (`data-addable-column`) and lists the **addable items** the server declares in `availableWidgets` (`data-addable-widget`). Only server-declared widget types can be placed on the board.
- **Column "…" menu** — **Rename** (inline edit), **Size** (drill-down: Auto / 25 % / 33 % / 50 % / 66 % / 75 %), **Color** (drill-down palette + None), **Delete**.
- **Widget "…" menu** — **Settings** (`data-configurable-widget`) and **Delete** (when the widget is removable).

Adding a column rebalances every column to an equal `1fr` fraction, so the existing columns make room for the new one.

While a column is dragged by its grip, the header under the pointer shows an insertion indicator on the edge where the column would land (`wx-board-col-drop-before` / `wx-board-col-drop-after`) and the dragged header dims (`wx-board-col-dragging`); after the drop the header at the new position briefly flashes (`wx-board-col-moved`, respecting `prefers-reduced-motion`) — the same feedback as the kanban.

## Badges

A column header and a widget header each render an optional trailing badge (`wx-board-col-badge`, `wx-dashboard-widget-badge`) — for example the widget count on a column or an item count on a widget. The badge text comes from `badge`; its color from `badgeColor` (a system color css class) or `badgeStyle` (an inline user color), like the tab header badge. On the server `RestApiDashboardColumn` and `RestApiDashboardWidget` each carry a `Badge` plus a typed `BadgeColor` (`PropertyColorBackgroundBadge`) that collapses into `badgeColor` / `badgeStyle` at serialization time.

## Widget Settings

The settings dialog always carries **Name** (the widget title) and **Color** (the card accent, edited with the framework color control — the same one `ControlFormItemInputColor` renders). A widget contributes type-specific fields by declaring a `settings` schema on its registration; each field is written back into the widget's `params`.

```javascript
webexpress.webui.DashboardWidgets.register("widget_scrum_velocity", {
    title: webexpress.webui.I18N.translate("webexpress.webapp:dashboard.widget.scrum_velocity.title"),
    icon: "chart-column",
    // configurable: true (default) — set false to hide the Settings entry for this type
    // removable:    true (default) — set false to hide the Delete entry for this type
    settings: [
        { key: "maxSprints", label: "Number of sprints", type: "number", min: 1, max: 20, default: "6" }
    ],
    render: function (container, data) {
        // data.params carries the persisted settings (name is data.title / data.color)
    }
});
```

Supported field `type`s: `text`, `number` (`min` / `max` / `step`), `select` (`options: [{ value, label }]`), `checkbox`, `color`. Values round-trip as strings in `params`.

## REST Contract

| Method | URL      | Body                              | Response                              | Purpose                          |
|--------|----------|-----------------------------------|---------------------------------------|----------------------------------|
| `GET`  | `{data}` | —                                 | `{ title, columns[], availableWidgets[] }` | Initial load and refresh.  |
| `PUT`  | `{data}` | Column or board change (see below)| `{ success: true }`                   | Persist a structural change.     |

### GET response

```json
{
    "title": "Dashboard",
    "columns": [
        {
            "id": "info", "label": "Locations", "size": "33%", "color": "#0d6efd", "badge": "2", "badgeColor": "text-bg-secondary",
            "widgets": [
                { "id": "widget_info", "title": "Scumm Bar", "color": "brown", "badge": "New", "badgeColor": "text-bg-success", "params": { "title": "Scumm Bar", "desc": "…" } }
            ]
        }
    ],
    "availableWidgets": [
        { "id": "widget_scrum_velocity", "title": "Velocity", "icon": "chart-column", "description": "Sprint velocity chart" }
    ]
}
```

`availableWidgets` is **server-owned**: only the listed widget type ids may be added. Each entry's `title` / `icon` / `description` override the client widget registry for the add-menu display; when omitted the registry default (and its i18n title) is used. The client still resolves the render function from its registry by `id`.

### PUT — column change

Rename, reorder, resize, recolor, add or delete a column. The full ordered column list is sent; an absent column is deleted, an unknown id is created.

```json
{
    "action": "columns",
    "columns": [
        { "id": "info", "title": "Locations", "size": "1fr", "color": "#0d6efd" },
        { "id": "crew", "title": "Crew", "size": "1fr", "color": null }
    ]
}
```

### PUT — widget change

Add, delete, reorder or reconfigure a widget. The full **board** (columns with their widgets, including the per-widget name, color and params) is sent, so widget settings survive the round trip. `action` is one of `add`, `remove`, `reorder`, `settings`. A legacy `layout` array (widget ids per column) is also included for back-compat.

```json
{
    "action": "settings",
    "board": [
        {
            "id": "crew", "title": "Crew", "size": "1fr", "color": "#fd7e14",
            "widgets": [
                { "id": "widget_scrum_velocity", "title": "Crew Velocity", "color": "#20c997", "params": { "maxSprints": "8" } }
            ]
        }
    ]
}
```

## C# Authoring

The control declares its capabilities through flags and binds its endpoint with the fluent data surface. The endpoint derives from `RestApiDashboard`.

```csharp
new ControlDataDashboard("board")
{
    EditableColumn     = _ => true,
    MovableColumn      = _ => true,
    DeletableColumn    = _ => true,
    AddableColumn      = _ => true,
    AddableWidget      = _ => true,
    ConfigurableWidget = _ => true
}
    .DataService<MyDashboardApi>(svc => svc.Method(HttpMethod.Get).UpdateMethod(HttpMethod.Put));
```

The endpoint overrides the retrieve and update hooks:

```csharp
public sealed class MyDashboardApi : RestApiDashboard
{
    // GET → columns (with their widgets)
    protected override IEnumerable<RestApiDashboardColumn> RetrieveColumns(IRequest request) => _columns;

    // GET → the widget types the board may add (server owns the set)
    protected override IEnumerable<RestApiDashboardAvailableWidget> RetrieveAvailableWidgets(IRequest request) =>
    [
        new() { Id = "widget_scrum_velocity", Title = "Velocity", Icon = "chart-column", Description = "…" }
    ];

    // PUT action:"columns" → reconcile the column list (add / rename / reorder / recolor / delete)
    protected override void UpdtaeColumns(RestApiDashboardLayout layout, IRequest request) { /* … */ }

    // PUT with a board → rebuild the columns and their widgets (add / delete / settings)
    protected override void UpdateBoard(IEnumerable<RestApiDashboardBoardColumn> board, IRequest request) { /* … */ }
}
```

A widget whose concrete C# type is not known ahead of time (anything a user adds through the add menu) is stored with `RestApiDashboardWidgetGeneric`, which carries the client type id and a pass-through `params` dictionary.

## ViewState Binding

`ControlDataDashboard` is **ViewState-capable**. Bound to a resource of an enclosing `ControlViewState` with `.Resource<TResource>()`, the board becomes a slice of that ViewState's shared state: the control emits only the `data-wx-resource` binding, the ViewState owns the central load, and the control re-renders when the ViewState re-queries the resource. Layout changes still persist through the ViewState's update service. Left unbound, the control owns its own `wx-service` island and loads itself.
