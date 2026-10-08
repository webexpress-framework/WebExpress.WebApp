![WebExpress](https://raw.githubusercontent.com/webexpress-framework/.github/main/docs/assets/img/banner.png)

# PermissionCtrl

The `PermissionCtrl` component manages the group-to-policy assignments of a protected resource, following the identity model of WebExpress (`Identity -> Group -> Policy -> Permission`). The surface is a single table: one row per group, the first column naming the group and the second carrying every policy the group holds as chips, mirroring `IIdentityGroup.Policies`. The chips are edited inline with the move control (`webexpress.webui.InputMoveCtrl`) and the options menu of a row revokes the group. Paging is left to a `ControlPagination` the host binds through the paging bind, so the surface itself stays a table. It is typically hosted inside a modal ("Manage permissions for …").

Further groups are assigned through the dialog the **Assign groups** button above the table opens, not through a row of the table: picking groups together with the policy set they receive needs more room than a table row offers, and a half-filled row reads like an assignment that already exists. The table therefore shows stored assignments only.

The control derives from `webexpress.webapp.TableCtrl`, so the rendering, the column templates, the options menu and the pager wiring are the ones every REST table uses. All changes are persisted via REST: the control issues `GET` / `POST` / `PUT` / `DELETE` requests against the configured assignment endpoint and dispatches events that let the surrounding application react to assignments and revocations.

```
   [Title] [<Preferences>|<Primary>|<Secondary>]    [ + Assign groups ]
   ┌──────────────────────────────────────────────────────────────────┐
   │  Group               │ Permissions                               │
   │  ────────────────────┼────────────────────────────────────────── │
   │  IT Support          │ (class_edit_policy)(class_view_policy) ⋯  │
   │  Service Desk        │ (class_view_policy)                    ⋯  │
   │  Incident Managers   │ (class_admin_policy)                   ⋯  │
   └──────────────────────────────────────────────────────────────────┘
                                            ‹  1  2  3  ›
```

## Title and tools

The toolbar above the table reads `[title] [tools] … [assign groups]`. Title and tools are optional; without either, the bar holds the assign affordance alone, and a read-only surface without either has no bar at all.

- The **title** captions the surface. It names what the assignments protect when the surrounding page does not - hosted in a modal, the dialog header usually does, which is why it is left empty there. The C# control translates it, so an i18n key may be passed.
- The **tools** are contributed by fragments: a search box, a filter, an action a plugin adds without the page hosting the surface knowing about it. Three sections decide the order on the bar - `SectionPermissionToolbarPreferences`, `SectionPermissionToolbarPrimary` and `SectionPermissionToolbarSecondary` - exactly as the toolbar sections of the WebApp page do. Any control fragment (`IFragmentControl`) may be contributed.
- The sections resolve against the **runtime type** of the control. A fragment scoped to `ControlDataPermission` joins every permission surface of the application; a fragment aimed at one particular surface is scoped to a subclass that surface is declared with.
- A **search box** among the tools (`FragmentControlSearch`) searches the surface: the control binds it through the search bind itself, because the page does not know the id a fragment renders with. A search bind the page authored through `Bind` keeps precedence.
- Title and tools **stay on a read-only surface**, because reading the assignments is what they help with as well; only the assign affordance, the options menu and the inline edit go.

```csharp
[Section<SectionPermissionToolbarPrimary>]
[Scope<ControlDataPermission>]
public sealed class PermissionSearch : FragmentControlSearch
{
    public PermissionSearch(IFragmentContext fragmentContext)
        : base(fragmentContext)
    {
        Placeholder = _ => "Search groups…";
    }
}
```

The tools are rendered on the server and handed to the client inside the host, in a container carrying the class `wx-permission-tools`. The client lifts the container out before the table takes over the host and mounts it on the toolbar between the caption and the assign affordance, so a contributed tool is free to be any control of the framework and keeps the instance the server rendered.

## The assign dialog

The dialog is the framework modal (`webexpress.webui.ModalCtrl`), built on the first open and refilled on every later one, so it always offers the state of the current page load rather than the one the first open happened to see.

```
   ┌ Assign groups ──────────────────────────────────────────────── ✕ ┐
   │  Groups *                                                        │
   │  [ (Service Desk ×) (Incident Managers ×)                    ▼]  │
   │                                                                  │
   │  Permissions                                                     │
   │  ┌ Selected ─────────┐  ┌───┐  ┌ Available ──────────────────┐   │
   │  │ class_edit_policy │  │ < │  │ class_view_policy           │   │
   │  │                   │  │ > │  │ class_admin_policy          │   │
   │  └───────────────────┘  └───┘  └─────────────────────────────┘   │
   │                                                                  │
   │                                       [ Cancel ] [ + Assign ]    │
   └──────────────────────────────────────────────────────────────────┘
```

- The **groups** are picked with the framework selection control (`webexpress.webui.InputSelectionCtrl`, multi-select) and only the groups that do not own a row yet are offered. A picked group is chipped in the primary colour (`wx-selection-primary`), the accent of the confirming action it is about to be written with.
- The field is required: the caption carries the `wx-form-required` asterisk and **Assign** stays disabled until at least one group is picked.
- The **policies** are picked with the same move control the table cells are edited with, so picking a policy set for a new group behaves exactly like changing it for an existing one. The set is assigned to **every** picked group, which is how a resource is usually opened up for several groups at once.
- Each group is a `POST` of its own, issued one after another. The dialog closes once all of them were written; if the endpoint rejects some, it stays open with exactly those groups still picked, so a retry does not need the picks to be made again. Every written group is announced with its own `PERMISSION_ASSIGNED_EVENT`.
- Once every group of the directory owns a row, the **Assign groups** button is disabled and states why, because the dialog could then only offer an empty picker.

## Declarative Configuration

The control is bootstrapped from a single host element carrying the `wx-webapp-permission` CSS class. The services are declared through `wx-service` island elements inside the host, additional options through `data-` attributes; the control then rewrites the element's contents to render the table. A child element carrying the class `wx-permission-tools` survives the rewrite: it is lifted onto the toolbar and holds the contributed tools.

### Services

| Island name | Description                                                                                     | Required
|-------------|-------------------------------------------------------------------------------------------------|----------
| `data`      | REST endpoint for the assignments of the protected resource.                                     | Yes
| `groups`    | REST endpoint resolving the identity groups the assign dialog offers.                            | For assigning
| `policies`  | REST endpoint resolving the identity policies the chips are picked from.                         | For assigning

### Container Element Attributes

| Attribute                | Description                                                                                | Example
|--------------------------|--------------------------------------------------------------------------------------------|----------------------------
| `data-page-size`         | Number of groups per page. The C# control emits `10` unless a page size is declared.        | `data-page-size="25"`
| `data-title`             | Caption at the start of the toolbar. Omitted, the bar starts with the tools or the assign affordance. | `data-title="Permissions of Incident"`
| `data-readonly`          | When `"true"`, hides the assign affordance, the options menu and the inline editing of the chips; the caption and the tools stay. | `data-readonly="true"`
| `data-wx-source-paging`  | Selector of the pagination control the surface pages through, set by the paging bind.        | `data-wx-source-paging="#permissions_pager"`
| `data-wx-source-search`  | Selector of the search box that searches the surface, set by the search bind - by the page, or by the control for a search box among the tools. | `data-wx-source-search="#permissions_search"`

### REST Contract

| Method   | URL                      | Body                                            | Response                                            | Purpose
|----------|--------------------------|-------------------------------------------------|-----------------------------------------------------|-------------------------------------------
| `GET`    | `{data}?q=…&p=…&l=…`     | —                                               | `{ items: Entry[], total, assignedGroupIds }`       | Load a filtered, paged window of group entries.
| `POST`   | `{data}`                 | `{ "groupId": "g1", "policyIds": ["p1"] }`      | `Entry`                                             | Add one group with its initial policy set, which is what the assign dialog writes per picked group; reconciling an existing group is idempotent.
| `PUT`    | `{data}/{groupId}`       | `{ "policyIds": ["p1", "p3"] }`                 | `Entry`                                             | Replace the policy set of a group, which is what the inline edit writes.
| `DELETE` | `{data}/{groupId}`       | —                                               | `204 No Content`                                    | Revoke every policy of the group.
| `GET`    | `{groups}?q=…`           | —                                               | `[{ id, name }]`                                    | Resolve the assignable groups.
| `GET`    | `{policies}?q=…`         | —                                               | `[{ id, name, description }]`                       | Resolve the selectable policies.

`Entry` objects carry `groupId`, `groupName` and `policyIds`; the chip labels are resolved once through the policy directory rather than repeated per row. The `total` counts the groups after filtering but before paging, which drives the pager. `assignedGroupIds` spans **all** entries, independent of the filter and the paging, so the assign dialog keeps offering only groups that do not own a row yet — even when that row lives on another page.

On the server side, the abstract base classes `RestApiPermission`, `RestApiPermissionGroups` and `RestApiPermissionPolicies` (in `WebExpress.WebApp.WebRestApi`) implement this contract. The store stays pair-based: a concrete endpoint supplies and mutates single `(group, policy)` assignments, and `RestApiPermission` projects them onto the group-shaped wire surface, so a group's chips are never split across two pages.

## Programmatic Control

Once initialized, the `PermissionCtrl` instance is retrievable via `getInstanceByElement(element)` for reloading the table or attaching event listeners from application code.

```javascript
// find the host element in the DOM
const permElement = document.querySelector(".wx-webapp-permission");

// retrieve the controller instance associated with the element
const permCtrl = webexpress.webui.Controller.getInstanceByElement(permElement);

// force a re-fetch from the server (useful after external state changes)
if (permCtrl) {
    permCtrl.update();
}
```

`search(pattern)`, `filter(pattern)` and `paging(page)` are inherited from the REST table, so a search or a pager control declared on the page drives the surface through the usual binds.

## Events

The component dispatches events on the host element whenever the assignment set changes. Both events bubble.

- **`webexpress.webapp.Event.PERMISSION_ASSIGNED_EVENT`** — fired after a successful `POST` or `PUT`. `event.detail` contains `{ groupId, policyIds }`, the policy set the group carries afterwards.
- **`webexpress.webapp.Event.PERMISSION_REMOVED_EVENT`** — fired after a successful `DELETE`. `event.detail` contains `{ groupId }`, the revoked group.

```javascript
permElement.addEventListener(webexpress.webapp.Event.PERMISSION_ASSIGNED_EVENT, (e) => {
    console.log("Assigned:", e.detail.groupId, "→", e.detail.policyIds.join(", "));
});
```

## Use Case Examples

The following example manages the permissions of the class `Incident` on a page of its own, captioned by the surface itself. The C# page declares the control through the fluent authoring surface:

```csharp
new ControlDataPermission("incident-permissions")
{
    Title = _ => "webexpress.myapp:incident.permissions.title",
    PageSize = _ => 10
}
    .DataService<IncidentPermissions>()
    .GroupsService<IncidentPermissionGroups>()
    .PoliciesService<IncidentPermissionPolicies>();
```

The rendered host element carries the service islands, the caption, the tools a fragment contributed (here the search box of the example above, bound by the control), the paging bind and the pagination control it drives:

```html
<div class="wx-webapp-permission" data-page-size="10" data-title="Permissions of Incident"
     data-wx-bind="search,paging"
     data-wx-source-search="#myapp-webfragment-permissionsearch"
     data-wx-source-paging="#incident-permissions_pager">
    <wx-service hidden name="data" kind="rest" base-uri="/api/permissions/incident" method="GET"></wx-service>
    <wx-service hidden name="groups" kind="rest" base-uri="/api/identity/groups" method="GET"></wx-service>
    <wx-service hidden name="policies" kind="rest" base-uri="/api/identity/policies" method="GET"></wx-service>
    <div class="wx-permission-tools">
        <div id="myapp-webfragment-permissionsearch" class="wx-webui-search" …></div>
    </div>
</div>
<div id="incident-permissions_pager" class="wx-webui-pagination"></div>
```

Hosted in a modal whose header already names the resource, the title is left empty and the bar starts with the tools or the assign affordance.

A read-only variant for users without administrative rights:

```html
<div class="wx-webapp-permission" data-readonly="true" data-page-size="10">
    <wx-service hidden name="data" kind="rest" base-uri="/api/permissions/incident" method="GET"></wx-service>
    <wx-service hidden name="policies" kind="rest" base-uri="/api/identity/policies" method="GET"></wx-service>
</div>
```
