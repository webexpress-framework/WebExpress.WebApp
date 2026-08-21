![WebExpress](https://raw.githubusercontent.com/webexpress-framework/.github/main/docs/assets/img/banner.png)

# SearchSuggestionCtrl

The `SearchSuggestionCtrl` is a search box whose suggestions come from a REST endpoint instead of from the static markup. It extends the WebUI [`SearchCtrl`](../../../WebExpress.WebUI/docs/js/search.md), so the box, the icon, the clear button and the dropdown are inherited; what the control replaces is where the suggestions come from.

The menu opens underneath the box on focus and on every keystroke. With an **empty term** the endpoint decides what to offer — the recently opened entries, for example — so the menu is useful before the first keystroke. Every keystroke queries the endpoint again, **debounced by 180 ms**, so a typed word costs one request rather than one per letter.

A suggestion is a **link to its target**: clicking it opens that target directly, which is what makes the box a navigation rather than a filter. The arrow keys walk the menu and `Enter` opens the highlighted suggestion; with nothing highlighted, `Enter` submits the term to the results page declared through `data-submituri`.

```
   ┌──────────────────────────────────────────┐
   │ 🔍 guy▏                              ✕   │   the box (inherited)
   └──────────────────────────────────────────┘
   ┌──────────────────────────────────────────┐
   │ Recently opened                          │   type: "header"
   │ 👤 Guybrush Threepwood                   │ ← a link to item.uri
   │ 👤 Guybrush's map                        │
   │ ──────────────────────────────────────── │   type: "divider"
   │ 🏝 Mêlée Island                          │
   ├──────────────────────────────────────────┤
   │ footer (from ControlSearch.Footer)       │
   └──────────────────────────────────────────┘
     ↑ Arrow keys walk, Enter opens, Escape closes
```

## Structure

The control is bootstrapped from a single host element carrying the `wx-webapp-search-suggestion` CSS class, which `ControlDataSearch` renders in place of the base `wx-webui-search` marker — the marker decides which of the two controllers mounts the host. The endpoint is authored in C# and emitted as a `wx-service` island, which the controller consumes before the base constructor empties the host.

```html
<div id="mySearch" class="wx-webapp-search-suggestion"
     placeholder="Search…"
     data-maxitems="10"
     data-queryparam="q"
     data-submituri="/search"
     data-emptytext="No matches found.">
    <wx-service hidden name="data" kind="rest" base-uri="/api/v1/search" method="GET"></wx-service>
    <div class="wx-search-footer">…optional footer…</div>
</div>
```

The base constructor rewrites the host into the search box and the dropdown menu; the controller then fills the menu on every focus and keystroke.

## Configuration

The behavior is read from `data-` attributes on the host element, before the base constructor strips the attributes it owns.

| Attribute          | Description
|--------------------|-----------------------------------------------------------------------------------------------------------------
| `data-maxitems`    | The largest number of **selectable** suggestions to render. Default `10`. Headers and dividers are structural and do not count against it, so a capped menu still keeps its captions.
| `data-queryparam`  | The name of the query parameter the term is sent in. Default `q`. A different name is sent **in addition to** `q`, so an endpoint that reads only the convention still receives the term.
| `data-submituri`   | The page the term is submitted to when `Enter` is pressed with no suggestion highlighted. Without it, `Enter` only opens a highlighted suggestion.
| `data-emptytext`   | The text shown in place of the suggestions when nothing matched. Defaults to the i18n key `webexpress.webapp:search.suggestion.empty`.
| `data-method`      | The http method used for the request. Default `GET`. Not emitted by `ControlDataSearch`; it is the hook for a hand-written host whose endpoint expects something else.

The following attributes are inherited from `ControlSearch` and keep their meaning: `placeholder`, `data-icon`, `data-image` and `data-value` (the term the box starts with).

Two inherited features do **not** apply, because the control replaces the rendering they live in:

- static `.wx-search-suggestion` children are read by the base constructor but never rendered — the endpoint is the only source of suggestions here;
- `EnableFavorited` / `data-favorited` has no effect, because the favourite star is drawn by the base renderer.

The `Footer` of `ControlSearch` **is** kept: it stays below the suggestions and also keeps the menu open when the endpoint returned nothing at all.

## REST Contract

A single `GET` serves the menu. The endpoint receives the term and the entry cap and answers with the item stream.

| Parameter | Description
|-----------|--------------------------------------------------------------------------------
| `q`       | The search term. Empty on the first focus, which is the endpoint's cue to offer its default entries.
| *custom*  | The term again, under the name from `data-queryparam`, when that is not `q`.
| `l`       | The entry cap from `data-maxitems`, so the endpoint can limit server-side.

The response is the shape `RestApiDropdown<T>` already produces:

```json
{
    "items": [
        { "type": "header", "text": "Recently opened" },
        { "type": "item", "id": "…", "text": "Guybrush Threepwood", "uri": "/crew/1", "icon": "user" },
        { "type": "divider" },
        { "type": "item", "id": "…", "text": "Mêlée Island", "uri": "/islands/2", "image": "/assets/img/melee.png" }
    ]
}
```

| Field   | Description
|---------|--------------------------------------------------------------------------------------------
| `type`  | `item` (default), `header` (a non-clickable caption) or `divider` (a separator). Headers and dividers travel in the same stream as the items so an endpoint can interleave them freely.
| `id`    | The identity of the entry. Optional.
| `uri`   | The target the suggestion opens. Also accepted as `url`. An entry **without** a target adopts its label as the search term instead of navigating, which is how an endpoint offers query fragments such as `is:open`.
| `text`  | The label. Also accepted as `name`, `label` or `title`.
| `icon`  | A CSS icon class rendered in front of the label.
| `image` | An image uri rendered in front of the label. Also accepted as `img`.
| `color` | A CSS class applied to the label.

The server side is the `WebExpress.WebApp.WebRestApi.RestApiDropdown<T>` base class: derive from it, implement `RetrieveItems` and `Filter`, and return `RestApiDropdownItem` (plus `RestApiDropdownItemHeader` / `RestApiDropdownItemDivider`) entries. It already reads `q` and `l` and serializes into the `items` envelope.

### Slow and failing endpoints

- Only the answer to the **newest** request may render. A slow answer that arrives after a later keystroke is dropped rather than painted over the newer term.
- A failed request empties the menu and shows the empty state rather than leaving stale hits standing, logs the failure and still dispatches `DATA_ARRIVED_EVENT` — with `count: 0` and the reason in `error`.
- A host without a `wx-service` island renders no suggestions at all instead of requesting an undefined endpoint.

## Keyboard

| Key                 | Behavior
|---------------------|--------------------------------------------------------------------------
| `ArrowDown` / `ArrowUp` | Move the highlight through the suggestions. The highlight stops at both ends rather than wrapping.
| `Enter`             | Opens the highlighted suggestion. With nothing highlighted, submits the term to `data-submituri` as `{submituri}?{queryparam}={term}`. A term-less submit is ignored, because it would open the results page with no query at all.
| `Escape`            | Closes the menu and drops the highlight.

## Programmatic Control

```javascript
// find the host element in the DOM
const element = document.getElementById("mySearch");

// retrieve the controller instance associated with the element
const search = webexpress.webui.Controller.getInstanceByElement(element);

if (search) {
    // the inherited value getter/setter is the current term; assigning it
    // dispatches CHANGE_FILTER_EVENT
    console.log(search.value);
    search.value = "guybrush";
}
```

## Events

All events are dispatched on the host element and bubble.

- **`webexpress.webui.Event.CHANGE_FILTER_EVENT`** — inherited; fired whenever the term changes.
  - Payload: `{ value: string }`
- **`webexpress.webui.Event.DROPDOWN_SHOW_EVENT`** / **`DROPDOWN_HIDDEN_EVENT`** — fired when the suggestion menu opens or closes.
- **`webexpress.webui.Event.DATA_REQUESTED_EVENT`** — fired before the endpoint is asked.
  - Payload: `{ endpoint, method, queryParam, term }`
- **`webexpress.webui.Event.DATA_ARRIVED_EVENT`** — fired after the answer was rendered, successfully or not.
  - Payload: `{ endpoint, method, queryParam, term, count, durationMs, error }`

```javascript
element.addEventListener(webexpress.webui.Event.DATA_ARRIVED_EVENT, (e) => {
    if (e.detail.error) {
        console.warn("suggestions unavailable:", e.detail.error);
    }
});
```

## Use Case Example

```csharp
// the endpoint: a dropdown api that answers with the matching crew members
public sealed class CrewSuggestions : RestApiDropdown<Character>
{
    protected override IEnumerable<RestApiDropdownItem> RetrieveItems
    (
        IQuery<Character> query,
        IQueryContext context,
        IRequest request
    )
    {
        var items = query.Apply(ViewModel.Characters.AsQueryable())
            .Select(x => new RestApiDropdownItem()
            {
                Id = x.Id,
                Text = x.Name,
                Uri = _detailUri?.BindParameters(new CharacterIdParameter(x.Id))?.ToString()
            });

        // a caption above the entries, in the same stream as the items
        return new RestApiDropdownItem[] { new RestApiDropdownItemHeader("Crew") }
            .Concat(items);
    }

    protected override IQuery<Character> Filter(string filter, IQuery<Character> query, IRequest request)
    {
        return string.IsNullOrEmpty(filter) || filter == "null"
            ? query
            : query.WhereContainsIgnoreCase(x => x.Name, filter);
    }
}
```

```csharp
// the control: the box, wired to that endpoint
new ControlDataSearch("crewSearch")
{
    Placeholder = _ => "Search the crew…",
    MaxItems = _ => 8,
    EmptyText = _ => "No crew member found.",
    SubmitUri = renderContext => sitemapManager.GetUri<SearchResults>(applicationContext)
}
    .DataService<CrewSuggestions>();
```
