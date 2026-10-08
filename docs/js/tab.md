![WebExpress](https://raw.githubusercontent.com/webexpress-framework/.github/main/docs/assets/img/banner.png)

# TabCtrl

The `webexpress.webapp.TabCtrl` component is a REST-enabled tab controller. It extends `webexpress.webui.TabCtrl`, loads tab data from a REST endpoint, instantiates pane templates, applies declarative bindings, and supports creating/closing tabs via REST requests.

```
   ┌─────────────────────────────────────────────────────────────────┐
   │ [Tab 1]  [Tab 2]  [Tab 3]                            [Toolbar]  │
   ├─────────────────────────────────────────────────────────────────┤
   │                                                                 │
   │ Content for the active tab                                      │
   │                                                                 │
   └─────────────────────────────────────────────────────────────────┘
```

## Declarative Configuration

The initial structure is defined in HTML. The root element is the tab host (`.wx-webapp-tab`), and native `<template>` children (or legacy `.wx-template` divs) are used as pane templates. Prefer native `<template>` elements: their content is inert, so nested controls are not instantiated and their `wx-service` islands are not consumed before the tab control extracts the template. A `.wx-template` div is live DOM — the controller initializes its content in place, which breaks panes created from it later.

### Container Element Attributes

|Attribute     |Description                                                                           | Example 
|---------------|---------------------------------------------------------------------------------------|----------------------------
|`data-layout` |Visual style of tabs. Supported values: `tab`, `pill`, `underline`. Omitted for the default layout. On the server side it is the `Layout` property of `ControlDataTab`; its `HighlightColor` colors the marker of the `underline` layout. | `data-layout="underline"`
|`data-readonly`|Disables adding, reordering and the tab menu when set to `true`. | `data-readonly="true"`
|`data-movable-tab`|Enables drag-and-drop reordering of the tabs when set to `true`. Each tab header gets a ⠿ grip handle; dropping persists the new order via `PUT`. | `data-movable-tab="true"`
|`data-editable-tab`|Offers *Rename tab* and *Color* in the tab menu when set to `true`; `F2` renames the focused tab. Both are persisted via `PUT`. On the server side it is the `EditableTab` property of `ControlDataTab`. Ignored when `data-readonly="true"`. | `data-editable-tab="true"`
|`data-deletable-tab`|Offers *Delete tab* in the tab menu when set to `true`; `Delete` deletes the focused tab after confirmation. On the server side it is the `DeletableTab` property of `ControlDataTab`. Ignored when `data-readonly="true"`. | `data-deletable-tab="true"`

### Tab Menu

Each tab header carries a "…" menu, the same one the kanban columns have, as long as `data-editable-tab` or `data-deletable-tab` is set and the control is not read-only. Without either the menu is not rendered at all, so a page can deny it per user: both flags are `Func<IRenderControlContext, bool>` on the server and are evaluated per request, for example against the user's write permission.

|Entry      |Shown with             |Action
|-----------|-----------------------|------------------------------------------------
|Rename tab |`data-editable-tab`    |Opens the rename field over the header (`F2`).
|Color      |`data-editable-tab`    |Drills down in place to *None* and a palette of twelve colors.
|Delete tab |`data-deletable-tab`   |Asks for confirmation, then deletes (`Delete`).

A tab list may hold nothing but tabs, so neither the glyph nor the menu is part of it: the glyph is no control of its own (`aria-hidden`), and the menu lives in the header row outside the `tablist`, anchored to its glyph. The keyboard opens the same menu as a context menu - the menu key or `Shift+F10` on the focused tab - and lands on its first entry; a right click does the same for the pointer. The tab announces its shortcuts through `aria-keyshortcuts`, and closing the menu hands the focus back to the tab.

The controller checks the flags again before it acts, so calling an action of a tab without the permission does nothing.

### Empty-State Placeholder

An optional `.wx-webapp-tab-empty` child of the host carries the placeholder shown while the tab set holds no items. The controller takes it out of the markup on init and puts it into the content area whenever the tab set is empty — after a load, after the last tab was closed, or right away when no data service is configured. While the first request is still in flight the placeholder stays away, so a pending load does not read as "nothing here".

The server renders it hidden (`d-none`), because only the client knows whether the tab set is empty; the controller lifts the hiding. On the server side the placeholder is the `EmptyState` property of `ControlDataTab` (a `ControlEmptyState`), which also renders a generic default when none is authored.

```html
<div class="wx-webapp-tab-empty d-none">
    <div class="wx-empty-state">
        <span class="wx-empty-state-title">No tabs</span>
        <span class="wx-empty-state-message">No tab has been created yet.</span>
    </div>
</div>
```

### Data Service

The endpoint is the `data` service, a hidden `wx-service` island inside the host that the controller consumes on startup; a host without the island loads nothing and keeps its tabs local. Rendered from C#, `ControlDataTab` emits the island itself through `.DataService<TEndpoint>()`.

```html
<wx-service hidden name="data" base-uri="/api/1/tab"></wx-service>
```

### Tab Template Element Attributes

| Attribute                | Description                                                        | Example                         |
|--------------------------|--------------------------------------------------------------------|---------------------------------|
| `id`                     | Template identifier (`templateId` reference from REST payload).    | `id="monkeyTemplate"`          |
| `data-icon`              | Icon CSS class shown in the template picker.                       | `data-icon="map"`       |
| `data-name`              | Display name shown in the template picker.                         | `data-name="Monkey Island"`    |
| `data-description`       | Optional description shown under the template name in picker menu. | `data-description="Adventure"` |
| `data-multiplicity`      | Optional maximum number of tab items that may be created from this template. Once the limit is reached, the add button (or this template's entry in the picker menu) is disabled. If omitted, the template is unlimited. | `data-multiplicity="3"`        |

## REST Data Contract

### GET (`data` service)

The controller expects JSON with an `items` array:

```json
{
  "items": [
    {
      "id": "tab_profile",
      "label": "Profiles",
      "name": "All known profiles",
      "icon": "umbrella-beach",
      "color": "text-primary",
      "tabColor": "#198754",
      "badge": "12",
      "badgeColor": "text-bg-danger",
      "primaryAction": "open",
      "primaryTarget": "self",
      "templateId": "profileTemplate",
      "binding": {
        "title": "Profiles",
        "name": "All known profiles"
      }
    }
  ]
}
```

The optional `badge` renders at the trailing edge of the tab header, typically a count. Its color arrives as the `badgeColor` css class (a system color) or the `badgeStyle` inline style (a user-defined color); on the server both derive from the typed `BadgeColor` property (`PropertyColorBackgroundBadge`) of `RestApiTabView`.

The optional `tabColor` is the color chosen from the tab menu, a `#rrggbb` value that underlines the tab header the way the `underline` layout marks its active tab: muted on inactive tabs, so a colored tab is never mistaken for the active one, and in full on the active tab. In the `underline` layout the color takes over the active marker. It is kept apart from `color`, the css class of the icon that the server authors; on the server it is the `TabColor` property of `RestApiTabView`.

### POST (create tab)

When the add button is used, the controller sends:

```json
{
  "action": "create",
  "templateId": "<selected-template-id>"
}
```

The response must contain `newTab`:

```json
{
  "newTab": {
    "id": "tab_dynamic_1",
    "label": "New Tab",
    "templateId": "Profile"
  }
}
```

### DELETE (delete tab)

*Delete tab* in the tab menu, or the `Delete` key on the focused tab, opens the shared `webexpress.webui.ModalConfirm` with the tab's name. Both need `data-deletable-tab`.
Only confirmation sends a `DELETE` request through the configured data service to:

`<base-uri>?id=<tabId>`

The tab, selection and template capacity remain unchanged until the service succeeds.
While the request is pending, confirmation and dismissal are locked to prevent duplicate
requests. A failed or aborted request keeps the dialog open with a translated error and
allows retry. Cancel, the dialog close button and Escape dismiss an idle confirmation
without deleting anything. A control without a service removes the tab locally after
confirmation. Readonly controls and controls without `data-deletable-tab` do not expose deletion.

On success, the controller disposes the owned pane's child controls and emits
`TAB_CLOSED_EVENT` once. Deleting the active tab selects its preceding neighbor (or the
first remaining tab); deleting the last tab shows the empty-state placeholder. A data
refresh preserves the selected id when it still exists and reapplies its visible state.

### PUT (reorder tabs)

When `data-movable-tab="true"` and the user drags a tab to a new position, the controller sends a `PUT` to the `base-uri` of the `data` service with the full ordered list of tab ids:

```json
{
  "action": "reorder",
  "order": ["tab_pirates", "tab_island", "tab_inventory", "tab_secrets"]
}
```

The server applies the order and answers `204 No Content`. On the server side, derive from `RestApiTab<TIndexItem>` and override `ReorderViews(order, context, request)`.

### PUT (rename tab)

When `data-editable-tab="true"`, *Rename tab* in the tab menu or `F2` on the focused tab opens a rename field over the header. The field is no tab, and a tab list may hold nothing but tabs, so it lives in the header row outside the `tablist` and is only laid over the header, which keeps its place.

- `Enter` or leaving the field accepts the label, `Escape` discards it. Switching to another window does not count as leaving the field, and the `Enter` that confirms an IME candidate does not accept.
- Focus returns to the tab after `Enter` or `Escape`; a field left by a click elsewhere leaves focus where the click put it.
- Control characters turn into spaces, and the field takes at most 200 characters (the server default). A label that is empty after trimming, or unchanged, sends nothing.

Otherwise the controller sends a `PUT` to the `base-uri` of the `data` service and keeps the field open, read-only, until the server answers:

```json
{
  "action": "rename",
  "id": "tab_pirates",
  "label": "Pirate crews"
}
```

The server stores the label and answers `204 No Content`; only then does the header show the new label. A failed request keeps the field open with a translated error (`role="alert"`, `aria-invalid`) and allows a retry. A load that lands while the request is pending does not undo the rename, and in a ViewState the label is patched into the resource slice rather than reloading every pane.

On the server side, derive from `RestApiTab<TIndexItem>` and override `RenameView(viewId, label, context, request)`; the default refuses every rename. The label arrives trimmed and never empty. `IsValidLabel` refuses labels longer than `MaxLabelLength` (200) and labels with control characters or bidirectional overrides and isolates, answering `400`; both members can be overridden. Without a data service the rename stays local.

The base `webexpress.webui.TabCtrl` offers `setTabLabel(tabId, label)` to relabel a tab programmatically.

### PUT (color tab)

When `data-editable-tab="true"`, the *Color* level of the tab menu offers *None* and a palette of twelve colors. Picking one sends a `PUT` to the `base-uri` of the `data` service; `color` is `null` for *None*:

```json
{
  "action": "color",
  "id": "tab_pirates",
  "color": "#198754"
}
```

The server stores the color and answers `204 No Content`; only then does the header show it. A failed request keeps the previous color and is announced beside the tab list (`role="alert"`) for a few seconds, since the menu that asked for it has already closed. As with the rename, a load that lands while the request is pending does not undo the change, and in a ViewState the color is patched into the resource slice.

On the server side, override `RecolorView(viewId, color, context, request)` and store the value in `RestApiTabView.TabColor`; the default refuses every change. `IsValidColor` accepts a plain `#rrggbb` value only and answers anything else with `400`, so a stored color can never carry more css into the pages of other users. Without a data service the color stays local.

## Binding Model

The binding model is unified and declarative. There is no split into separate binding systems. A template element declares one or more binding keys in `data-wx-bind`, and each key can optionally define its own mode, target, and name.

This allows compact single-key bindings as well as multi-key bindings on the same element, for example:
`data-wx-bind="uri, title, isActive"`.

### Value Resolution

For each binding key `k`, value resolution is:

1. `item.binding[k]`
2. `item[k]`
3. `""` (empty string)

This supports both flat payloads and nested `binding` payloads.

### Core Binding Attribute

|Attribute      |Required |Description                         
|---------------|---------|------------------------------------
|`data-wx-bind` |yes      |Comma-separated list of source keys. 

Example:
```html
<div data-wx-bind="uri, title, isActive"></div>
```

### Per-Key Binding Attributes

Each key in `data-wx-bind` can define specific options:

- `data-wx-bind-<key>-mode`
- `data-wx-bind-<key>-target`
- `data-wx-bind-<key>-name`

If an option is not defined for a key, defaults apply:
- mode: `text`
- target: `self`
- name: `""`

Example for key `uri`:
- `data-wx-bind-uri-mode="attr"`
- `data-wx-bind-uri-name="data-uri"`
- `data-wx-bind-uri-target=".wx-webapp-like-mount"`

### Supported Modes

|Mode     |Behavior
|---------|----------
|`text`   |Writes to `textContent`.
|`html`   |Writes to `innerHTML`.
|`attr`   |Writes an HTML attribute (`name` required).
|`prop`   |Writes a DOM property (`name` required).
|`class`  |If `name` is set: adds class by value; otherwise replaces `className`.
|`style`  |Writes CSS property (`name` required).
|`toggle` |Toggles class in `name` by boolean truthiness (`name` required).

### Target Resolution

- `target="self"` binds to the source element itself.
- If a CSS selector is provided, matching nodes inside the pane are selected.
- The source element is always included as fallback target to avoid dropped bindings.

### Binding Metadata Cleanup

After binding is applied, binding metadata attributes are removed from the final rendered pane:
- `data-wx-bind`
- all `data-wx-bind-<key>-mode`
- all `data-wx-bind-<key>-name`
- all `data-wx-bind-<key>-target`

This ensures the resulting DOM contains only effective runtime attributes.

## Binding Examples

### Single Key

```html
<h5
  data-wx-bind="title">
</h5>
```

```html
<a
  data-wx-bind="uri"
  data-wx-bind-uri-mode="attr"
  data-wx-bind-uri-name="href">
  Open
</a>
```

### Multiple Keys with Per-Key Options

```html
<div
  data-wx-bind="uri, title, isActive"
  data-wx-bind-uri-mode="attr"
  data-wx-bind-uri-name="data-uri"
  data-wx-bind-uri-target=".wx-webapp-like-mount"
  data-wx-bind-title-mode="text"
  data-wx-bind-title-target=".title"
  data-wx-bind-isActive-mode="toggle"
  data-wx-bind-isActive-name="active"
  data-wx-bind-isActive-target=".card">

  <div class="wx-webapp-dashboard"></div>
  <h5 class="title"></h5>
  <div class="card"></div>
</div>
```

### HTML, Property, and Style Modes

```html
<div
  data-wx-bind="htmlSnippet"
  data-wx-bind-htmlSnippet-mode="html">
</div>

<input
  type="checkbox"
  data-wx-bind="isDisabled"
  data-wx-bind-isDisabled-mode="prop"
  data-wx-bind-isDisabled-name="disabled">

<div
  data-wx-bind="priorityColor"
  data-wx-bind-priorityColor-mode="style"
  data-wx-bind-priorityColor-name="border-color">
</div>
```

## Programmatic Control

Once initialized, the `TabCtrl` instance can be used programmatically.

```javascript
// find the host element in the dom
const tabElement = document.getElementById("myTabs");

// retrieve the controller instance associated with the element
const tabCtrl = webexpress.webui.Controller.getInstanceByElement(tabElement);

// programmatically select a specific tab by its id
if (tabCtrl) {
    tabCtrl.selectTab("settings-tab");
}
```

## Events

The component dispatches events for tab interactions:

- `webexpress.webui.Event.SELECTED_TAB_EVENT`  
  Fired when a tab becomes active. `detail.tabId` contains the selected tab id.

- `webexpress.webapp.Event.TAB_ADDED_EVENT`  
  Fired after a tab was created and appended. `detail.tabId` contains the new tab id.

- `webexpress.webapp.Event.TAB_CLOSED_EVENT`  
  Fired after a tab was removed. `detail.tabId` contains the removed tab id.

- `webexpress.webapp.Event.TAB_REORDERED_EVENT`  
  Fired after the tabs were reordered via drag and drop and the new order was persisted. `detail.order` contains the array of tab ids in their new sequence.

- `webexpress.webapp.Event.TAB_RECOLORED_EVENT`  
  Fired after the color of a tab was changed and persisted. `detail.tabId` contains the tab id, `detail.color` the new color or `null`.

- `webexpress.webapp.Event.TAB_RENAMED_EVENT`  
  Fired after a tab header was renamed and the new label was persisted. `detail.tabId` contains the tab id, `detail.label` the new label.

## Use Case Example

```html
<div id="myTabs" class="wx-webapp-tab" data-layout="underline">
    <wx-service hidden name="data" base-uri="/api/1/tab"></wx-service>

    <div class="wx-tab-toolbar">
        <div class="btn-group">
            <button class="btn btn-outline-secondary btn-sm">Action</button>
        </div>
    </div>

    <template id="profile-tab" data-icon="map" data-name="Profile" data-description="Profile">
        <h5 data-wx-bind="title"></h5>
        <p data-wx-bind="name"></p>
    </template>
</div>
```


## UI persistence

The active tab is remembered in localStorage through the WebUI base (`wx-tab:{id}`, or `data-persist-key`). The selection is restored once the REST tab data is available. Use stable ids for both the host and its tabs.
