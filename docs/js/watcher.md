![WebExpress](https://raw.githubusercontent.com/webexpress-framework/.github/main/docs/assets/img/banner.png)

# WatcherCtrl

The `WatcherCtrl` component renders the list of users watching (following) a domain object as a compact row of avatars. A trailing `+` button opens a live-search dropdown that lets the user attach new watchers; clicking an existing avatar (with the small `×` overlay) detaches that watcher. All changes are persisted via REST: the control issues `GET` / `POST` / `DELETE` requests against the configured endpoint and dispatches events that let the surrounding application react to additions and removals.

```
   ┌──────────────────────────────────────────────────────────┐
   │ (MP) (EM) (LS) (MV) … +12   [ + ]                        │
   │                              │                           │
   │                              ▼                           │
   │                  ┌─────────────────────────────────┐     │
   │                  │ [Search person…]                │     │
   │                  ├─────────────────────────────────┤     │
   │                  │ (PR) Priya Rao   · Security     │     │
   │                  │ (TB) Tom Becker  · End-User     │     │
   │                  └─────────────────────────────────┘     │
   └──────────────────────────────────────────────────────────┘
```

## Declarative Configuration

The control is bootstrapped from a single host element carrying the `wx-webapp-watcher` CSS class. The control reads its configuration from `data-` attributes on that element, then rewrites the element's contents to render the avatar row.

### Container Element Attributes

| Attribute            | Description                                                                                                                       | Example
|----------------------|-----------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------
| `data-uri`           | REST endpoint for the watcher collection of the current object. Required.                                                          | `data-uri="/api/watchers/INC-00123"`
| `data-users-uri`     | REST endpoint used to populate the live-search dropdown when adding a new watcher. Required for adding; omit for read-only views. | `data-users-uri="/api/users"`
| `data-max-visible`   | Maximum number of avatars rendered inline before the overflow chip (`+N`) appears. Defaults to `6`.                                | `data-max-visible="4"`
| `data-readonly`      | When `"true"`, hides the `+` button and the per-avatar remove affordance.                                                          | `data-readonly="true"`

### REST Contract

| Method   | URL                            | Body                | Response               | Purpose
|----------|--------------------------------|---------------------|------------------------|-------------------------------------------
| `GET`    | `{data-uri}`                   | —                   | `User[]`               | Initial load and refresh.
| `POST`   | `{data-uri}`                   | `{ "userId": "u3" }`| `User`                 | Attach a watcher; returns the persisted user.
| `DELETE` | `{data-uri}/{userId}`          | —                   | `204 No Content`       | Detach a watcher.
| `GET`    | `{data-users-uri}?q={search}`  | —                   | `User[]`               | Search candidates for the add dropdown.

`User` objects are expected to carry at least `id`, `name`, `initials`, `team`, and `color` (a CSS color used as the avatar background). An optional `image` carries the uri of an avatar picture; when present, it replaces the initials badge in the avatar row and in the search results.

## Programmatic Control

Once initialized, the `WatcherCtrl` instance is retrievable via `getInstanceByElement(element)` for refreshing the list or attaching event listeners from application code.

```javascript
// find the host element in the DOM
const obsElement = document.querySelector(".wx-webapp-watcher");

// retrieve the controller instance associated with the element
const obsCtrl = webexpress.webui.Controller.getInstanceByElement(obsElement);

// force a re-fetch from the server (useful after external state changes)
if (obsCtrl) {
    obsCtrl.refresh();
}
```

## Events

The component dispatches events on the host element whenever the watcher set changes. Both events bubble.

- **`webexpress.webapp.Event.WATCHER_ADDED_EVENT`** — fired after a successful `POST`. `event.detail` contains `{ user }`, the newly attached watcher.
- **`webexpress.webapp.Event.WATCHER_REMOVED_EVENT`** — fired after a successful `DELETE`. `event.detail` contains `{ user }`, the detached watcher.

```javascript
obsElement.addEventListener(webexpress.webapp.Event.WATCHER_ADDED_EVENT, (e) => {
    console.log("Watcher added:", e.detail.user.name);
});
```

## Use Case Examples

The following example wires an `WatcherCtrl` to an object detail page. The watcher row sits inside the right-hand sidebar card and is fed by the same REST endpoint that the rest of the page uses for its watcher state.

```html
<!-- Right-side sidebar card -->
<div class="wx-webapp-side-card">
    <div class="wx-webapp-side-row">
        <span class="wx-webapp-side-label">Beobachter</span>
        <span class="wx-webapp-side-value">
            <!-- The watcher control: bootstraps itself from data-* -->
            <div class="wx-webapp-watcher"
                 data-uri="/api/watchers/INC-00123"
                 data-users-uri="/api/users"
                 data-max-visible="6"></div>
        </span>
    </div>
</div>
```

A read-only variant for users without edit rights:

```html
<div class="wx-webapp-watcher"
     data-uri="/api/watchers/INC-00123"
     data-readonly="true"></div>
```

## ViewState Binding

`ControlDataWatcher` is **ViewState-capable**. Bound to a resource of an enclosing `ControlViewState`, the watchers become a slice of that ViewState's shared state instead of an independent surface; the candidate search is bound to the ViewState's users service:

```csharp
// inside the ViewState:
new ControlDataWatcher("watchers")
    .Resource<IncidentWatchersResource>()
    .UsersService<RestApiUsers>();
```

When a resource is bound the control:

- emits only the `data-wx-resource` binding (and the `data-wx-users` binding of the ViewState users service) instead of its own `wx-service` islands, because the ViewState owns the state, the services and the central load;
- on the client, resolves the enclosing `ViewState`, **subscribes** to the resource slice and re-renders the avatar row whenever the ViewState re-queries it;
- still persists additions and removals through the ViewState's resource service and then **re-queries** the resource, so every sibling control bound to the same resource refreshes.

Left unbound, the control owns its `wx-service` islands and loads itself (standalone), exactly as documented above. The path is chosen automatically — by `DataIslandExtensions.EmitDataIslands` on the server and by the presence of `data-wx-resource` on the client.