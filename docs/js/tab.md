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
|`data-uri`    |The uri is used to determine the tabs.   | `/api/1/tab`
|`data-readonly`|Disables add/close interactions when set to `true`. | `data-readonly="true"`
|`data-movable-tab`|Enables drag-and-drop reordering of the tabs when set to `true`. Each tab header gets a ⠿ grip handle; dropping persists the new order via `PUT`. | `data-movable-tab="true"`

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

### Tab Template Element Attributes

| Attribute                | Description                                                        | Example                         |
|--------------------------|--------------------------------------------------------------------|---------------------------------|
| `id`                     | Template identifier (`templateId` reference from REST payload).    | `id="monkeyTemplate"`          |
| `data-icon`              | Icon CSS class shown in the template picker.                       | `data-icon="map"`       |
| `data-name`              | Display name shown in the template picker.                         | `data-name="Monkey Island"`    |
| `data-description`       | Optional description shown under the template name in picker menu. | `data-description="Adventure"` |
| `data-multiplicity`      | Optional maximum number of tab items that may be created from this template. Once the limit is reached, the add button (or this template's entry in the picker menu) is disabled. If omitted, the template is unlimited. | `data-multiplicity="3"`        |

## REST Data Contract

### GET (`data-uri`)

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

### DELETE (close tab)

Closing a tab sends a `DELETE` request to:

`<data-uri>?id=<tabId>`

### PUT (reorder tabs)

When `data-movable-tab="true"` and the user drags a tab to a new position, the controller sends a `PUT` to `<data-uri>` with the full ordered list of tab ids:

```json
{
  "action": "reorder",
  "order": ["tab_pirates", "tab_island", "tab_inventory", "tab_secrets"]
}
```

The server applies the order and answers `204 No Content`. On the server side, derive from `RestApiTab<TIndexItem>` and override `ReorderViews(order, context, request)`.

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
- `data-wx-bind-uri-target=".wx-webapp-dashboard"`

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
  data-wx-bind-uri-target=".wx-webapp-dashboard"
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

## Use Case Example

```html
<div id="myTabs" class="wx-webapp-tab" data-layout="underline" data-uri="/api/1/tab">
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
