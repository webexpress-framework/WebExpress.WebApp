![WebExpress](https://raw.githubusercontent.com/webexpress-framework/.github/main/docs/assets/img/banner.png)

# PermissionCtrl

The `PermissionCtrl` component manages the group-to-policy assignments of a protected resource, following the identity model of WebExpress (`Identity -> Group -> Policy -> Permission`). An assignment is the pair `(group, policy)`: a group may carry several policies, mirroring `IIdentityGroup.Policies`. The control renders an assign row (a group select, a policy select and an assign button), a searchable, paged table of the current assignments and a remove affordance per row; the search box is the existing basic search control (`webexpress.webui.SearchCtrl`), instantiated on a nested host. The surface is typically hosted inside a modal ("Manage permissions for …"). All changes are persisted via REST: the control issues `GET` / `POST` / `DELETE` requests against the configured assignment endpoint and dispatches events that let the surrounding application react to assignments and revocations.

```
   ┌──────────────────────────────────────────────────────────────────┐
   │  Assign group*: [ IT Support        ▼]                           │
   │         Policy*: [ class_edit_policy ▼]                          │
   │  [+ Assign]                                                      │
   │                                                       [Search]   │
   │  Assigned group      │ Effective policy                          │
   │  ────────────────────┼────────────────────────────────────────── │
   │  IT Support          │ class_edit_policy                       ✕ │
   │  IT Support          │ class_view_policy                       ✕ │
   │  Service Desk        │ class_view_policy                       ✕ │
   │  Incident Managers   │ class_admin_policy                      ✕ │
   │                                                                  │
   │                                       ‹ Prev  1  2  3  Next ›    │
   └──────────────────────────────────────────────────────────────────┘
```

## Declarative Configuration

The control is bootstrapped from a single host element carrying the `wx-webapp-permission` CSS class. The services are declared through `wx-service` island elements inside the host, additional options through `data-` attributes; the control then rewrites the element's contents to render the surface.

### Services

| Island name | Description                                                                                     | Required
|-------------|-------------------------------------------------------------------------------------------------|----------
| `data`      | REST endpoint for the assignment collection of the protected resource.                           | Yes
| `groups`    | REST endpoint resolving the assignable identity groups for the group select.                     | For assigning
| `policies`  | REST endpoint resolving the assignable identity policies for the policy select.                  | For assigning

### Container Element Attributes

| Attribute        | Description                                                                                | Example
|------------------|--------------------------------------------------------------------------------------------|----------------------------
| `data-page-size` | Number of assignments per page. Defaults to `10`.                                           | `data-page-size="25"`
| `data-readonly`  | When `"true"`, hides the assign row and the per-row remove affordance.                      | `data-readonly="true"`

### REST Contract

| Method   | URL                            | Body                                      | Response                                              | Purpose
|----------|--------------------------------|-------------------------------------------|-------------------------------------------------------|-------------------------------------------
| `GET`    | `{data}?q=…&p=…&l=…`           | —                                         | `{ items: Assignment[], total, assignedPairs }`       | Load a filtered, paged assignment window.
| `POST`   | `{data}`                       | `{ "groupId": "g1", "policyId": "p1" }`   | `Assignment`                                          | Assign a policy to a group; an existing pair is idempotent.
| `DELETE` | `{data}/{groupId}/{policyId}`  | —                                         | `204 No Content`                                      | Revoke an assignment pair.
| `GET`    | `{groups}?q=…`                 | —                                         | `[{ id, name }]`                                      | Resolve the assignable groups.
| `GET`    | `{policies}?q=…`               | —                                         | `[{ id, name, description }]`                         | Resolve the assignable policies.

`Assignment` objects carry `groupId`, `groupName`, `policyId` and `policyName`, so the client never resolves the display names a second time. The `total` of the `GET` response counts the assignments after filtering but before paging, which drives the pager. `assignedPairs` (`[{ groupId, policyId }]`) spans **all** assignments, independent of the filter and the paging: the control uses it to exclude already assigned pairs from the selects — the policy select drops the policies the selected group already carries, and a group only disappears from the group select once it carries every policy of the directory.

On the server side, the abstract base classes `RestApiPermission`, `RestApiPermissionGroups` and `RestApiPermissionPolicies` (in `WebExpress.WebApp.WebRestApi`) implement this contract; a concrete endpoint only supplies the assignment store and the group and policy directories, typically backed by the identity manager.

## Programmatic Control

Once initialized, the `PermissionCtrl` instance is retrievable via `getInstanceByElement(element)` for refreshing the table or attaching event listeners from application code.

```javascript
// find the host element in the DOM
const permElement = document.querySelector(".wx-webapp-permission");

// retrieve the controller instance associated with the element
const permCtrl = webexpress.webui.Controller.getInstanceByElement(permElement);

// force a re-fetch from the server (useful after external state changes)
if (permCtrl) {
    permCtrl.refresh();
}
```

## Events

The component dispatches events on the host element whenever the assignment set changes. Both events bubble.

- **`webexpress.webapp.Event.PERMISSION_ASSIGNED_EVENT`** — fired after a successful `POST`. `event.detail` contains `{ assignment }`, the persisted assignment.
- **`webexpress.webapp.Event.PERMISSION_REMOVED_EVENT`** — fired after a successful `DELETE`. `event.detail` contains `{ assignment }`, the revoked assignment.

```javascript
permElement.addEventListener(webexpress.webapp.Event.PERMISSION_ASSIGNED_EVENT, (e) => {
    console.log("Assigned:", e.detail.assignment.groupName, "→", e.detail.assignment.policyName);
});
```

## Use Case Examples

The following example manages the permissions of the class `Incident` inside a modal. The C# page declares the control through the fluent authoring surface:

```csharp
new ControlDataPermission("incident-permissions")
{
    PageSize = _ => 10
}
    .DataService<IncidentPermissions>()
    .GroupsService<IncidentPermissionGroups>()
    .PoliciesService<IncidentPermissionPolicies>();
```

The rendered host element carries the service islands and bootstraps itself:

```html
<div class="wx-webapp-permission" data-page-size="10">
    <wx-service hidden name="data" kind="rest" base-uri="/api/permissions/incident" method="GET"></wx-service>
    <wx-service hidden name="groups" kind="rest" base-uri="/api/identity/groups" method="GET"></wx-service>
    <wx-service hidden name="policies" kind="rest" base-uri="/api/identity/policies" method="GET"></wx-service>
</div>
```

A read-only variant for users without administrative rights:

```html
<div class="wx-webapp-permission" data-readonly="true">
    <wx-service hidden name="data" kind="rest" base-uri="/api/permissions/incident" method="GET"></wx-service>
</div>
```
