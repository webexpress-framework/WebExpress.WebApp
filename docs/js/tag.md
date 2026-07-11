![WebExpress](https://raw.githubusercontent.com/webexpress-framework/.github/main/docs/assets/img/banner.png)

# TagCtrl

The `TagCtrl` component renders a **read-only** row of **tag (label) chips** for a domain object, followed by a **"+" button**. Clicking "+" opens a **modal** in which tags are added and deleted. While typing in the modal, an **autocomplete dropdown** offers matching tags from the existing vocabulary. Every change is persisted immediately via a REST endpoint (tags are loaded on open, additions are `POST`ed, deletions are `DELETE`d, suggestions are fetched from the **same** endpoint via the `q` query parameter); when the modal closes, the read-only chips reflect the edits.

The read-only surface extends the WebUI read-only `webexpress.webui.TagCtrl`; the editable surface inside the modal extends the WebUI `webexpress.webui.InputTagCtrl` (the add/remove engine).

```
   read-only surface                  click "+" → modal
   ┌──────────────────────────┐       ┌──────────────────────────────────┐
   │  pirate   grog   [ + ]   │       │ Tags                         [x] │
   └──────────────────────────┘       ├──────────────────────────────────┤
                                      │  pirate x   grog x   | vood▏     │
                                      │           ┌────────────────────┐ │
                                      │           │ voodoo             │ │
                                      │           │ voodoo-doll        │ │
                                      │           └────────────────────┘ │
                                      ├──────────────────────────────────┤
                                      │                         [ Close ]│
                                      └──────────────────────────────────┘
```

## Declarative Configuration

The control is bootstrapped from a single host element carrying the `wx-webapp-tag` CSS class. The control reads its configuration from `data-` attributes on that element, then rewrites the element's contents to render the read-only chips and the "+" button. The editable surface (input field, removable chips and suggestion dropdown) is built on demand inside a modal when the "+" button is clicked.

### Container Element Attributes

| Attribute            | Description                                                                                                                               | Example
|----------------------|-------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------
| `data-uri`           | REST endpoint backing the tag surface. Required for loading, adding, deleting and suggesting.                                              | `data-uri="/api/tags/INC-00123"`
| `data-value`         | Optional. Semicolon-separated set of tags rendered server-side to avoid a flash before the REST endpoint responds.                         | `data-value="pirate;grog"`
| `data-readonly`      | When `"true"`, the input field and the per-chip remove buttons are suppressed; the chips are rendered for reading only.                    | `data-readonly="true"`
| `placeholder`        | Placeholder shown in the input field while no tags are present.                                                                            | `placeholder="add tag…"`
| `data-color-css`     | Optional CSS class applied to the chips (e.g. one of the `wx-tag-*` system colors).                                                        | `data-color-css="wx-tag-primary"`
| `data-color-style`   | Optional inline style applied to the chips when a custom color is used.                                                                    | `data-color-style="background: gold;"`

### REST Contract

A **single endpoint** serves all operations. The `GET` route distinguishes loading from suggesting via the presence of the `q` query parameter.

| Method   | URL                          | Body          | Response     | Purpose
|----------|------------------------------|---------------|--------------|-------------------------------------------------
| `GET`    | `{data-uri}`                 | —             | `Tag[]`      | Load the tags currently attached to the object.
| `GET`    | `{data-uri}?q={term}`        | —             | `Tag[]`      | Autocomplete suggestions from the tag vocabulary.
| `POST`   | `{data-uri}`                 | `{ value }`   | `Tag`        | Add a tag.
| `DELETE` | `{data-uri}/{value}`         | —             | `204`        | Remove a tag.

`Tag` objects carry `value` (the display text and identity) and an optional `color` (a CSS class or color value). The client also accepts plain strings in any of the arrays.

The server side is provided by the abstract `WebExpress.WebApp.WebRestApi.RestApiTag` base class: derive from it and implement `RetrieveTags`, `SuggestTags`, `CreateTag` and `DeleteTag`.

## Programmatic Control

Once initialized, the `TagCtrl` instance is retrievable via `getInstanceByElement(element)`. The inherited `value` getter/setter exposes the current tags as a semicolon-separated string (or accepts a string or array).

```javascript
// find the host element in the DOM; the wx-webapp-tag boot selector is
// consumed at initialization, wx-tag-surface is the hook the control re-adds
const tagElement = document.querySelector(".wx-tag-surface");

// retrieve the controller instance associated with the element
const tagCtrl = webexpress.webui.Controller.getInstanceByElement(tagElement);

// read the current tags
if (tagCtrl) {
    console.log(tagCtrl.value); // e.g. "pirate;grog"
}
```

## Events

The component dispatches events on the host element. The inherited
`webexpress.webui.Event.ADD_EVENT` / `REMOVE_EVENT` fire on every local change;
the following higher-level events fire after the change has been persisted via
REST. All events bubble.

- **`webexpress.webapp.Event.TAG_ADDED_EVENT`** — fired after a successful `POST`. `event.detail` contains `{ value }`.
- **`webexpress.webapp.Event.TAG_REMOVED_EVENT`** — fired after a successful `DELETE`. `event.detail` contains `{ value }`.

```javascript
tagElement.addEventListener(webexpress.webapp.Event.TAG_ADDED_EVENT, (e) => {
    console.log("tag added:", e.detail.value);
});
```

## Read-only Mode

Setting `data-readonly="true"` (or `Readonly = _ => true` on the `ControlDataTag`) suppresses the "+" button, leaving a pure read-only chip display with no way to open the editing modal. This is useful for surfaces that should display tags without allowing edits.

## ViewState Binding

`ControlDataTag` is **ViewState-capable**. Bound to a resource of an enclosing `ControlViewState`, the tags become a slice of that ViewState's shared state instead of an independent surface:

```csharp
// inside the ViewState:
new ControlDataTag("tags").Resource<IncidentTagsResource>();
```

When a resource is bound the control:

- emits only the `data-wx-resource` binding (and the optional `data-wx-viewstate` id) instead of its own `wx-service` island, because the ViewState owns the state, the service and the central load;
- on the client, resolves the enclosing `ViewState`, **subscribes** to the resource slice and re-renders the chips whenever the ViewState re-queries it;
- still persists additions and deletions through the ViewState's resource service and **re-queries** the resource when the editing modal closes, so every sibling control bound to the same resource refreshes.

Left unbound, the control owns its `wx-service` island and loads itself (standalone), exactly as documented above. The path is chosen automatically — by `DataIslandExtensions.EmitDataIslands` on the server and by the presence of `data-wx-resource` on the client.
