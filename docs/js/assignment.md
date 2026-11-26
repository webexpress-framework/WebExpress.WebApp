![WebExpress](https://raw.githubusercontent.com/webexpress-framework/.github/main/docs/assets/img/banner.png)

# AssignmentCtrl

The `AssignmentCtrl` component shows the person responsible for a domain object as one row: a round portrait or, without one, the initials, a small caption above the name and the action at the end of the row. A caller who may change the assignment assigns the object to themselves or removes their assignment; with a bound users service they also search for another assignee. Every change is stored via REST against the configured endpoint, and the row is redrawn from the answer without reloading the page.

```
   ┌──────────────────────────────────────────────────────────────┐
   │ (JD)  Assignee                [+ Assign to me] [Assign to …] │
   │       Jane Doe                                     │         │
   │                                                    ▼         │
   │                        ┌─────────────────────────────────┐   │
   │                        │ [Search person…]                │   │
   │                        ├─────────────────────────────────┤   │
   │                        │ (AK) Alex Kim                   │   │
   │                        │ (MS) Maria Silva                │   │
   │                        └─────────────────────────────────┘   │
   └──────────────────────────────────────────────────────────────┘

   ┌──────────────────────────────────────────────────────────────┐
   │ ( )   Assignee                              [+ Assign to me] │
   │       Unassigned                                             │
   └──────────────────────────────────────────────────────────────┘
```

Without an assignee the row draws a dashed empty circle and the placeholder in the muted text colour, in italics, so an unassigned object reads as a state rather than as a missing value.

## Declarative Configuration

The control is bootstrapped from a single host element carrying the `wx-webapp-assignment` CSS class. Rendered from C#, `ControlDataAssignment` already emits the complete row, so the page shows the assignee before the script runs and without it. The control reads its configuration from `data-` attributes and its endpoints from `wx-service` islands inside the host, then replaces the server rendered row with its own rendering of the same state.

```csharp
new ControlDataAssignment("assignee")
{
    Assignee = ctx => CurrentAssignee(ctx),
    Self = ctx => CurrentUser(ctx),
    MayChange = ctx => MayWrite(ctx)
}
    .DataService<RestApiIssueAssignment>()
    .UsersService<RestApiUsers>();
```

`Assignee`, `Self` and `MayChange` seed the row. When one of them is set, the control also emits them as the `wx-state` island `{ assignee, self, mayChange }` and the client renders without a first request. Left unset, the server renders the unassigned row without an action and the client loads the state from the data service. The seed only decides what is drawn; the endpoint checks the right on every write.

### Container Element Attributes

| Attribute            | Description                                                                                       | Example
|----------------------|---------------------------------------------------------------------------------------------------|-------------------------------------
| `data-readonly`      | When `"true"`, the row offers no action, whatever the endpoint reports about the caller's rights. | `data-readonly="true"`
| `data-caption`       | Caption above the name. Defaults to the translation of `assignee.caption` ("Assignee").           | `data-caption="Owner"`
| `data-placeholder`   | Text in place of the name of a missing assignee. Defaults to "Unassigned".                        | `data-placeholder="Nobody yet"`
| `data-assign-to-me`  | Text of the action that assigns the object to the caller. Defaults to "Assign to me".             | `data-assign-to-me="Take it"`
| `data-unassign`      | Text of the action that removes the caller's assignment. Defaults to "Unassign".                  | `data-unassign="Hand back"`
| `data-assign-to`     | Text of the action that opens the search for another assignee. Defaults to "Assign to …".         | `data-assign-to="Delegate"`

`ControlDataAssignment` emits the text attributes only for the texts set through `Caption`, `Placeholder`, `AssignToMeText`, `UnassignText` and `AssignToText`, each an i18n key or plain text; the defaults come from the WebApp dictionaries. The property for the caption is not called `Role`, because `Control` already uses that name for the ARIA role.

### Services

The endpoints are named `wx-service` islands, hidden child elements of the host. `ControlDataAssignment` emits them through `.DataService<TEndpoint>()` and `.UsersService<TEndpoint>()`. The data service carries the domains of its endpoint, so lists bound to the same domain load the new assignee when the endpoint announces a change.

| Service | Description                                                                                                  | Island
|---------|--------------------------------------------------------------------------------------------------------------|----------------------------------------------
| `data`  | REST endpoint of the assignment of the current object. Required.                                              | `<wx-service hidden name="data" base-uri="/api/assignment/ISSUE-123"></wx-service>`
| `users` | REST endpoint of the "assign to" search. Optional; without it the row offers only assigning and unassigning. | `<wx-service hidden name="users" base-uri="/api/users"></wx-service>`

## Functionality and Behavior

The action depends on the state the endpoint reports and is drawn only when `mayChange` is `true` and the row is not read-only. A known caller who is not the assignee gets "Assign to me" with the person plus icon, the assignee gets "Unassign" with the person cross icon. With a bound users service the row adds "Assign to …", which opens the same live search as the [`WatcherCtrl`](watcher.md); the chosen person becomes the assignee, and the current assignee is not offered. While a request runs, the actions carry `aria-busy="true"` and `aria-disabled="true"` and ignore clicks; they stay focusable, so the focus does not jump away.

A refused change leaves the row as it was, because the control applies nothing before the endpoint confirmed it. The failure is put in front of the user through `webexpress.webapp.ErrorChannel`, as the other data bound controls do: the reason of a `RestApiRefusal`, else "You may not change the assignee." for a `403` or "The assignee was not changed." otherwise. After a `403` the control loads the state again, so an action the caller lost disappears.

Each action is a `<button>` whose visible text is its accessible name; the icon is `aria-hidden`. Caption and name sit in an `aria-live="polite"` region, so a screen reader announces the new assignee once the row is redrawn. The portrait is decorative and hidden from assistive technology, since the name stands beside it as text. The search field carries an `aria-label`, and `Escape` closes the search and returns the focus to the action that opened it. The styles use the `--wx-*` tokens only: the initials use the emphasis text of the primary hue on its subtle wash, and the actions mix a fifth of the body colour into the link colour, which keeps text above 4.5:1 in the light and in the dark theme, the muted placeholder included.

### REST Contract

Every method answers the same state, so a write hands the control the state it left behind.

| Method   | URL                  | Body                  | Response                          | Purpose
|----------|----------------------|-----------------------|-----------------------------------|-------------------------------------
| `GET`    | `{data}`             | none                  | `{ assignee, self, mayChange }`   | Initial load and refresh.
| `PUT`    | `{data}`             | `{ "userId": "u3" }`  | `{ assignee, self, mayChange }`   | Assign the object. Without `userId` it is assigned to the caller.
| `DELETE` | `{data}`             | none                  | `{ assignee, self, mayChange }`   | Remove the assignment.
| `GET`    | `{users}?q={search}` | none                  | `Person[]`                        | Search candidates for "assign to".

`assignee` and `self` are `Person` objects `{ id, name, image, initials }` or `null`; `self` is the caller. An `image` replaces the initials; without `initials` the first letters of the first two words of the name are used. The client ignores the body of a `DELETE`, because the service layer reads none, and keeps `self` and `mayChange` of the state it shows.

The server side is the abstract `RestApiAssignment<TIndexItem>`, which owns the protocol. An endpoint implements the hooks `RetrieveItem` (the addressed object), `RetrieveAssignee`, `RetrieveSelf`, `MayChange`, `Assign` and `Unassign`. A successful write is announced on the domain of the object when the object implements `IDomain`.

| Situation                                        | Answer
|--------------------------------------------------|---------------------------------------------------------------
| `RetrieveItem` finds no object                   | `404` for every method.
| `MayChange` rejects the caller                   | `403` for `PUT` and `DELETE`; nothing is changed.
| `PUT` without `userId` by an anonymous caller    | `403`.
| `Assign` does not know the person                | `400`.
| A hook throws `RestApiRefusal`                   | `400` with `{ "message": … }`, the reason written for the user.

## Programmatic Control

Once initialized, the controller exposes the current assignee as `value` and reloads the state from the endpoint through `load()`, for example after the assignment was changed elsewhere on the page.

### Accessing an Automatically Created Instance

For rows rendered declaratively, the associated instance is retrieved via the `getInstanceByElement(element)` method of the central `webexpress.webui.Controller`.

```javascript
// find the host element in the DOM
const element = document.getElementById("issue-assignee");

// retrieve the controller instance associated with the element
const ctrl = webexpress.webui.Controller.getInstanceByElement(element);

// read the current assignee, or load it again after an external change
if (ctrl) {
    console.log(ctrl.value);
    ctrl.load();
}
```

### Manual Instantiation

A row can also be created programmatically on a host element that carries its service islands.

```javascript
// find the host element that carries the wx-service islands
const host = document.getElementById("issue-assignee");

// create a new instance of AssignmentCtrl manually
const ctrl = new webexpress.webapp.AssignmentCtrl(host);
```

## Events

The component dispatches its events on the host element. All of them bubble.

- **`webexpress.webapp.Event.ASSIGNMENT_CHANGED_EVENT`**: This event is fired after a stored change that moved the assignment. The event `detail` object contains `{ assignee, previous }`, each a `Person` or `null`.
- **`webexpress.webui.Event.BEFORE_SAVE_EVENT`**: This event is fired before a change is sent, with `{ action, payload }`, where `action` is `assign` or `unassign`. A listener vetoes the change with `preventDefault()`.
- **`webexpress.webui.Event.SAVED_EVENT`**: This event is fired after the endpoint confirmed a change.
- **`webexpress.webui.Event.DATA_ERROR_EVENT`**: This event is fired after a refused change. The event `detail` object contains `{ action, error }`.

```javascript
element.addEventListener(webexpress.webapp.Event.ASSIGNMENT_CHANGED_EVENT, (e) => {
    console.log("Assignee:", e.detail.assignee ? e.detail.assignee.name : "none");
});
```

## Use Case Examples

The row on an issue detail page, seeded by the server and with the search for another assignee:

```html
<div id="issue-assignee" class="wx-webapp-assignment">
    <wx-state hidden>
        <wx-prop name="assignee" type="json">{"id":"u2","name":"Jane Doe","image":null,"initials":"JD"}</wx-prop>
        <wx-prop name="self" type="json">{"id":"u1","name":"Alex Kim","image":null,"initials":"AK"}</wx-prop>
        <wx-prop name="mayChange" type="boolean">true</wx-prop>
    </wx-state>
    <wx-service hidden name="data" base-uri="/api/assignment/ISSUE-123"></wx-service>
    <wx-service hidden name="users" base-uri="/api/users"></wx-service>
</div>
```

A read-only variant that loads its state from the endpoint:

```html
<div class="wx-webapp-assignment" data-readonly="true">
    <wx-service hidden name="data" base-uri="/api/assignment/ISSUE-123"></wx-service>
</div>
```

## ViewState Binding

`ControlDataAssignment` is **ViewState-capable**. Bound to a resource of an enclosing `ControlViewState`, the assignment becomes a slice of that ViewState's shared state instead of an independent surface, and the "assign to" search is bound to the ViewState's users service. The ViewState service of the resource needs `PUT` as its update method, because assigning goes through it.

```csharp
new ControlViewState<DataQueryState>("issue")
    .State(s => { })
    .Service<RestApiIssueAssignment>(svc => svc.Method(HttpMethod.Get).UpdateMethod(HttpMethod.Put))
    .Service<RestApiUsers>(svc => svc.Method(HttpMethod.Get))
    .Resource<IssueAssignmentResource>(r => r.Service<RestApiIssueAssignment>());

new ControlDataAssignment("assignee")
    .Resource<IssueAssignmentResource>()
    .UsersService<RestApiUsers>();
```

With a bound resource, the control emits the `data-wx-resource` binding and the `data-wx-users` binding of the ViewState users service instead of its own `wx-service` islands, because the ViewState owns the services and the central load. The server rendered row and the seed stay, so the row is not blank before the ViewState answered. On the client, the control resolves the enclosing `ViewState`, subscribes to the resource slice and redraws the row whenever the ViewState queries it. A change is stored through the ViewState's service for the resource, and the resource is then queried again, so every control bound to it follows; `load()` asks the ViewState for that query as well.

Left unbound, the control owns its `wx-service` islands and loads itself, as documented above. The path is chosen automatically, by `DataIslandExtensions.EmitDataIslands` on the server and by the presence of `data-wx-resource` on the client.
