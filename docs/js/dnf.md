![WebExpress](https://raw.githubusercontent.com/webexpress-framework/.github/main/docs/assets/img/banner.png)

# Disjunctive Normal Form (REST)

A disjunctive normal form (DNF) is a filter written as a disjunction of
conjunctions: `[[A,B],[C]]` reads as `(A AND B) OR (C)`. The static half of the
family lives in `WebExpress.WebUI` and is documented there — the
[notation](../../../WebExpress.WebUI/docs/js/dnf.md), the group handling, the
operator rendering and the events are identical here and are not repeated.

What the REST variants replace is a single thing: **where the terms come from.**

| Component                       | Marker class            | C# control
|---------------------------------|-------------------------|--------------------------------------
| `webexpress.webapp.InputDnfCtrl`| `wx-webapp-input-dnf`   | `ControlDataFormItemInputDnf`
| `webexpress.webapp.DnfCtrl`     | `wx-webapp-dnf`         | `ControlDataDnf`

Both consume a `wx-service` island named `data`, which is the single channel the
endpoint travels through. Without one they behave exactly like their WebUI base
and render only the statically declared `.wx-selection-item` children.

# webexpress.webapp.InputDnfCtrl

Every conjunction is a REST backed
[selection](../../../WebExpress.WebUI/docs/js/selection.md), so each one:

- **loads lazily** — the request is issued when the picker is opened,
- **searches server side** — the filter box queries the endpoint, debounced and
  with the superseded request aborted,
- **keeps its own list** — two conjunctions are searched independently, which is
  the reason a picker per group exists rather than one shared list.

A conjunction added later starts from the terms already received rather than
empty, so its list is on screen before its own request returns.

```
   ┌ AND ───────────────────────────────────────┬───┐
   │ [Amsterdam ×] [Berlin ×]               [v] │ × │   GET /api/1/terms?g=&p=0
   └────────────────────────────────────────────┴───┘
   ─────────────────── OR ───────────────────────────
   ┌────────────────────────────────────────────┬───┐
   │ [Cairo ×]                              [v] │ × │   GET /api/1/terms?g=cai&p=0
   └────────────────────────────────────────────┴───┘
              [+ Add expression]

   hidden input value: "a;b|c"
```

## Declarative configuration

```csharp
new ControlForm(null,
    new ControlDataFormItemInputDnf("filter")
    {
        Label = _ => "Filter",
        Placeholder = _ => "Pick a term",
        MaxGroups = _ => 4,
        MaxItems = _ => 25
    }
    .DataService<TermRestApi>()
);
```

### Container element attributes

| Attribute          | Description
|--------------------|-------------------------------------------------------------------
| `id`               | Transferred to the hidden input for form submission.
| `name`             | The form field name of the hidden input.
| `placeholder`      | Shown in a conjunction that holds no term yet.
| `data-value`       | The initial expression, for example `a;b|c`.
| `data-max-groups`  | The maximum number of conjunctions. Absent means unlimited.
| `data-maxItems`    | The maximum number of terms a picker shows at once.
| `data-method`      | `GET` (default) or `POST`.
| `data-query-param` | The wire name of the search term. Default `g`.
| `data-page-param`  | The wire name of the page. Default `p`.
| `data-debounce`    | Milliseconds before a keystroke becomes a request. Default `250`.

The configuration is inherited by every group: the control copies these settings
onto each picker and gives each one its own copy of the service island, which is
what makes a group a fully-featured REST selection.

## REST contract

The terms are queried the way a selection queries its items, so a
[`RestApiSelection<T>`](#endpoint) endpoint serves a DNF control unchanged:

| Request                                | Description
|----------------------------------------|--------------------------------------------
| `GET {baseUri}?g={term}&p={page}`       | Returns the terms matching the search term.

```json
{
    "items": [
        { "id": "a", "name": "Amsterdam", "icon": "city", "color": "wx-selection-primary" },
        { "id": "b", "name": "Berlin" }
    ],
    "pagination": { "pageNumber": 0, "pageSize": 50, "totalCount": 2 }
}
```

The item mapping is `webexpress.webapp.selectionModel.mapApiItem`: `id` is the
term id the expression stores, and the display text is taken from `content`,
`name`, `text` or `title`, in that order.

### <a name="endpoint"></a>The endpoint

```csharp
public sealed class TermRestApi : RestApiSelection<TermIndexItem>
{
    protected override IEnumerable<RestApiSelectionItem> RetrieveItems
        (IQuery<TermIndexItem> query, IQueryContext context, IRequest request)
    {
        return query.Apply(_terms.AsQueryable())
            .Select(x => new RestApiSelectionItem() { Id = x.Id, Text = x.Name });
    }
}
```

## Events

In addition to the events of the base control:

- `webexpress.webui.Event.DATA_ARRIVED_EVENT` — terms arrived. The event is
  announced **on the control**, not only on the group that fetched, so a host
  listening on the DNF input hears about the data without subscribing to every
  group. The smart edit rebuilds its read view on this event; without it a
  finished edit would fall back to showing raw term ids.

## Programmatic control

The API is the one of the base control. One addition matters:

```javascript
dnf.options;   // the terms that arrived, not the (empty) declared ones
```

The terms are queried by the groups, so the declared list stays empty on the
control itself. The getter answers with what actually arrived, because that is
what the read view of the smart edit asks for.

# webexpress.webapp.DnfCtrl

Displays an expression whose term ids are resolved against the endpoint. An
expression stores ids, so a view without terms renders the ids themselves —
readable to the database, not to the reader. This control fetches the term set
once and relabels the expression already on screen.

Two behaviours are deliberate:

- **Before the terms arrive the expression renders as its ids.** A filter that
  renders as nothing while its request is open would claim the rows are
  unfiltered, which is the one thing it must never say falsely.
- **A failed request leaves the expression standing.** An unreadable filter
  still says which rows are filtered; an empty one claims there is no filter at
  all.

## Declarative configuration

```csharp
new ControlDataDnf("filter-display")
{
    Value = _ => new ControlFormInputValueDnf("a;b|c"),
    Compact = _ => true
}
.DataService<TermRestApi>();
```

| Attribute          | Description
|--------------------|--------------------------------------------------------------
| `data-value`       | The expression to display.
| `data-compact`     | `"true"` clips the expression to a single line.
| `data-placeholder` | Text shown in place of an empty expression.
| `data-maxItems`    | The maximum number of terms to resolve.

# Table template

The `rest_dnf` column template renders a DNF column whose terms are queried from
an endpoint rather than travelling with the table — the right choice for a term
set shared across the rows or too large to embed. For a short, table specific
list use the static `dnf` template instead.

```csharp
new ControlTableColumnTemplate("filter", new ControlTableTemplateRestDnf()
{
    Editable = _ => true,
    Placeholder = _ => "Pick a term",
    MaxGroups = _ => 3
}
.DataService<TermRestApi>())
{
    Title = _ => "Filter"
};
```

| Option        | Description
|---------------|----------------------------------------------------------------
| `editable`    | `true` mounts the smart edit.
| `uri`         | The endpoint the terms are queried from.
| `placeholder` | Shown in a conjunction that holds no term yet.
| `maxGroups`   | The maximum number of conjunctions.
| `compact`     | `"false"` lets the expression wrap instead of clipping.

A template is inert, so the declared data service resolves into the template's
`uri`; the table builds a client side `wx-service` island when it materializes
the cells.

For a REST rendered table the column carries
`RestApiTableColumnTemplateRestDnf`:

```csharp
new RestApiTableColumn("filter")
{
    Template = new RestApiTableColumnTemplateRestDnf(editable: true, placeholder: "Pick a term")
    {
        Uri = sitemapManager.GetUri<TermRestApi>(applicationContext)
    }
};
```

# Smart edit

Smart edit works for the REST variant exactly as for the static one: the read
view is a `DnfCtrl` fed with the terms the input control loaded. Because the
options arrive asynchronously, the read view is rebuilt when the control reports
`DATA_ARRIVED_EVENT` — the display is not frozen as a snapshot taken before the
terms existed.

```csharp
new ControlDataFormItemInputDnf("filter")
{
    Placeholder = _ => "Pick a term"
}
.DataService<TermRestApi>();
```

placed inside a smart edit host renders as the read expression until the reader
asks to change it, and submits the whole expression under `filter` on save.
