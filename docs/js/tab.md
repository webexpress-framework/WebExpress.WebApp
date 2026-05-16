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

The initial structure is defined in HTML. The root element is the tab host (`.wx-webapp-tab`), and children with `.wx-template` (or native `<template>`) are used as pane templates.

### Container Element Attributes

|Attribute     |Description                                                                           | Example 
|---------------|---------------------------------------------------------------------------------------|----------------------------
|`data-layout` |Visual style of tabs. Supported values: `tab`, `pill`, `underline`.                                            | `data-layout="underline"`
|`data-uri`    |The uri is used to determine the tabs.   | `/api/1/tab`
|`data-readonly`|Disables add/close interactions when set to `true`. | `data-readonly="true"`

### Tab Template Element Attributes

| Attribute                | Description                                                        | Example                         |
|--------------------------|--------------------------------------------------------------------|---------------------------------|
| `id`                     | Template identifier (`templateId` reference from REST payload).    | `id="monkeyTemplate"`          |
| `data-icon`              | Icon CSS class shown in the template picker.                       | `data-icon="fas fa-map"`       |
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
      "icon": "fas fa-umbrella-beach",
      "color": "text-primary",
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

## Use Case Example

```html
<div id="myTabs" class="wx-webapp-tab" data-layout="underline" data-uri="/api/1/tab">
    <div class="wx-tab-toolbar">
        <div class="btn-group">
            <button class="btn btn-outline-secondary btn-sm">Action</button>
        </div>
    </div>

    <div id="profile-tab" class="wx-template" data-icon="fas fa-map" data-name="Profile" data-description="Profile">
        <h5 data-wx-bind="title"></h5>
        <p data-wx-bind="name"></p>
    </div>
</div>
```
