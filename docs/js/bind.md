![WebExpress](https://raw.githubusercontent.com/webexpress-framework/.github/main/docs/assets/img/banner.png)

# Binds

A bind is a declarative connection between two controls that never learn about each other. The server declares it as an attribute on one control; the client resolves it at runtime. That is what lets a search box be reused above a list, a table or a tile grid without any of them being written against it — and what lets a list be searched by a box it knows nothing about.

Binds come in two families. The **store binds** (`state`, `model`) connect an element to a state path. The **source binds** (`search`, `paging`, `filter`) connect a data component to a surface that produces a value for it.

```
   ┌───────────────┐                       ┌─────────────────────┐
   │ ControlSearch │ ── CHANGE_FILTER ──►  │  bind: search       │
   └───────────────┘                       │                     │
                                           │  ControlDataList    │
   ┌───────────────────┐                   │  .search(term)      │
   │ ControlPagination │ ─ CHANGE_PAGE ──► │  .page(index)       │
   └───────────────────┘                   │  bind: paging       │
             ▲                             └──────────┬──────────┘
             └──────── updateState(page, total) ──────┘
```

## Source binds

A source bind is declared **on the reader** — the data component that renders the result — and names the surface it listens to by selector. That direction is deliberate: several readers may follow one search box, and a surface that had to name its readers would have to be re-authored for every page it appears on.

| Attribute                   | Description
|-----------------------------|--------------------------------------------------------------------------
| `data-wx-bind="search"`     | The component is driven by a search box.
| `data-wx-source-search`     | Selector of the search box, for example `#id_search`.
| `data-wx-bind="paging"`     | The component is driven by a pager.
| `data-wx-source-paging`     | Selector of the pager, for example `#id_pager`.
| `data-wx-bind="filter"`     | The component is driven by the quickfilter registry.

Several binds are declared as one comma separated list, which is what `Binding` emits:

```html
<div id="id_list"
     class="wx-webapp-list"
     data-wx-bind="search,filter,paging"
     data-wx-source-search="#id_search"
     data-wx-source-paging="#id_pager"></div>
```

### What each bind does

`search` subscribes to the search box's `CHANGE_FILTER_EVENT` and calls `search(pattern, searchType)` on the component. The component decides what a search *means*: it dispatches its own search intent, patches its store and re-queries its service. The bind only carries the term, and the search type the surface reports — `basic` from a plain `ControlSearch`, `wql` from a `ControlAdvancedSearch` that produced a query.

`paging` subscribes to the pager's `CHANGE_PAGE_EVENT` and calls `page(index)`. Only the forward direction runs through the bind. The other one — the component telling the pager how many pages there are — stays inside the component, which learns the total only once a response has arrived, and pushes it into the pager through `updateState(page, total)` so that the update does not read as a user picking a page.

`filter` is a marker. The quickfilter registry owns the active filters and writes them into the shared state itself, so nothing has to be wired; the bind exists so that declaring it is not reported as an unknown bind, and so that a quickfilter driven component can be told from one that is not.

### Requirements on the reader

A source bind expects the component to expose the matching method of the data dispatch surface — `search(pattern, searchType)` and `page(index)`. `ControlDataList`, `ControlDataTable` and `ControlDataTile` do. A component that does not is reported on the console rather than called, because the declaration is written on the server where nothing can check it.

### Resolution order

Neither the surface nor the reader has to exist when the bind runs.

The **surface** is resolved when an event arrives, not when the bind is established. Document order decides whether a search box above a list or a pager below it has been constructed yet, and resolving late removes the question: by the time an event is dispatched, whatever dispatched it exists. The event is received on the document — the control events bubble — and the sender is matched against the named selector, so one search box on a page cannot drive a list it was not bound to.

The **reader** may also be missing: the controller establishes the binds of an element before it constructs that element's own instance. An unresolved reader therefore waits for the `webexpress.webapp.data.mount` event every data component dispatches, which is the same deferral the store binds use.

## Declaring binds from C#

The binds are authored through `Binding` and applied by the control that reads them:

```csharp
public ControlDataList List { get; } = new ControlDataList(ListId)
{
    ServiceFactory = _ => DataServiceDescriptor.QueryData(uri),
    Bind = _ => new Binding()
        .Add(new BindSearch() { Source = SearchFragment.ContentId })
        .Add(new BindFilter())
        .Add(new BindPaging() { Source = PaginationFragment.ContentId })
};
```

`Source` takes the id of the surface with or without a leading `#`; the bind adds it when it is missing. A `BindSearch` or `BindPaging` without a `Source` is inert and says so on the console, because a bind that names nothing can only be an oversight.

## Store binds

| Attribute                   | Description
|-----------------------------|--------------------------------------------------------------------------
| `data-wx-bind="state"`      | Reflects a store path on the element (the read direction of a controlled component).
| `data-wx-bind-path`         | The observed state path, for example `order.total`.
| `data-wx-bind-as`           | The reflection: `text` (default), `value`, `show` or `class`.
| `data-wx-bind-class`        | The class toggled when `as="class"`.
| `data-wx-bind="model"`      | Two way binding for inputs (the controlled input pattern).
| `data-wx-model`             | The bound state path.
| `data-wx-model-query`       | Resource to re-query on write, so the write routes through the `viewstate/query` intent.
| `data-wx-resource`          | Binds the enclosing ViewState as the store.
| `data-wx-bind-store`        | Id of the owning component; defaults to the nearest ancestor.

## Registering a bind

The registry is open, so an application may add binds of its own:

```javascript
webexpress.webui.Binds.register("myBind", {
    /**
     * Called once when the binding is established for an element.
     * @param {HTMLElement} element - The bound element, carrying the data-wx-* attributes.
     */
    bind(element) {
        // ...
    }
});
```

A bind is established for every element carrying `data-wx-bind`, including elements added to the document later. Register a cleanup through `element._wxCleanup` so a subscription is released when the element is removed.
