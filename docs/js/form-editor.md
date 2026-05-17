![WebExpress](https://raw.githubusercontent.com/webexpress-framework/.github/main/docs/assets/img/banner.png)

# FormEditorCtrl

The `FormEditorCtrl` is a self-contained visual editor for form definitions. It hosts a tab bar, a structure tree (with drag-and-drop, inline rename, keyboard navigation and a QuickAdd picker), an optional live preview pane that re-renders the active tab as a real form, and an optional palette pane (in three-pane layout). Configuration is done declaratively via `data-` attributes on the host element; behaviour is driven entirely client-side and persisted to a REST endpoint.

```
   ┌─────────────────────────────────────────────────────────────┐
   │  FormName  v3       [ Two-pane | Tree | Three-pane ]  [Hide]│
   ├─────────────────────────────────────────────────────────────┤
   │ [ Details ] [ Environment ] [ Attachments ]   [+ Add tab]   │
   ├─────────────────────────────┬───────────────────────────────┤
   │       Live preview          │   Structure · Details         │
   │  ┌──────────────────────┐   │   ▾ Title          string     │
   │  │ Title:  ___________  │   │   ▾ Status         enum       │
   │  │ Status: ◯ ◉ ○ ○      │   │   ▸ Group: Reported by/When   │
   │  └──────────────────────┘   │   …                           │
   │                             │   [Quick add… ____]  [+ Add]  │
   │                             │   ↑↓ Navigate  F2 Rename …    │
   └─────────────────────────────┴───────────────────────────────┘
```

## Declarative Configuration

The editor is configured entirely via `data-` attributes on the host element. The element must carry the class `wx-webui-form-editor` (the `ControlFormEditor` C# control sets this automatically).

### Container Attributes

| Attribute                  | Description                                                                                                                                                | Example                                          |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `data-form-id`             | Identifier of the form to load on startup. When omitted, the editor renders an empty placeholder structure.                                                | `data-form-id="b3f02a…"`                         |
| `data-rest-url`            | Base URL of the form-structure REST endpoint. Used for both initial load (`GET /item/{id}`) and autosave (`PUT /item/{id}`). Omit for offline-mock mode.   | `data-rest-url="/api/1/FormStructure"`           |
| `data-field-catalog-url`   | URL of the field-catalog endpoint used by the QuickAdd picker. When omitted, only a small built-in catalog is offered.                                    | `data-field-catalog-url="/api/1/FormFieldCatalog"` |
| `data-layout`              | Initial layout. One of `two-pane` (default), `tree-table`, `three-pane`.                                                                                   | `data-layout="three-pane"`                       |
| `data-preview`             | Whether the live preview pane is shown initially. Defaults to `true`.                                                                                      | `data-preview="false"`                           |
| `data-indent`              | Tree indent in pixels. Clamped to `8`–`32`. Defaults to `18`.                                                                                              | `data-indent="22"`                               |
| `data-readonly`            | When `true`, suppresses all mutation UI (no add/remove/drag/rename) and skips REST writes.                                                                 | `data-readonly="true"`                           |
| `data-initial-structure`   | Optional inline JSON snapshot matching `FormStructureDto`. When set, it takes precedence over `data-form-id` and skips the initial REST load. Useful for SSR and offline demos. | `data-initial-structure='{"tabs":[…]}'` |

### Wire format

The editor exchanges JSON shapes that mirror the `WebExpress.WebApp.WebForm.Dto` payloads exactly. A field node looks like `{"id":"…","kind":"field","name":"Title","type":"string","required":true}`; a group node like `{"id":"…","kind":"group","layout":"horizontal","label":"Reported","children":[…]}`. Field types are one of `string`, `text`, `timestamp`, `ref`, `enum`, `tags`, `number`, `file`. Group layouts are one of `vertical`, `horizontal`, `mix`, `col-vertical`, `col-horizontal`, `col-mix`.

## Programmatic Control

Once initialized, the editor can be programmatically controlled via its controller instance.

### Accessing an Automatically Created Instance

For form editors defined declaratively in HTML, the associated instance is retrieved via the `getInstanceByElement(element)` method of the central `webexpress.webui.Controller`.

```javascript
// find the host element in the DOM
const host = document.getElementById('myFormEditor');

// retrieve the controller instance associated with the element
const editor = webexpress.webui.Controller.getInstanceByElement(host);

// switch to three-pane layout
if (editor) {
    editor.layout = 'three-pane';
}

// add a new field to the active tab
editor.addNode({ kind: 'field', name: 'Severity', type: 'enum', required: true });

// dump the current in-memory structure
console.log(editor.getStructure());
```

### Manual Instantiation

A form editor can also be created entirely programmatically and attached to a host element.

```javascript
const host = document.getElementById('form-editor');
host.classList.add('wx-webui-form-editor', 'wx-form-editor');
host.dataset.restUrl = '/api/1/FormStructure';
host.dataset.formId = '00000000-0000-0000-0000-000000000001';

const editor = new webexpress.webui.FormEditorCtrl(host);
```

### Public API

| Member                       | Description                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------------- |
| `formId` (get)               | Id of the form currently loaded.                                                         |
| `layout` (get/set)           | Active designer layout (`two-pane` / `tree-table` / `three-pane`).                       |
| `preview` (get/set)          | Whether the live preview pane is shown.                                                  |
| `indent` (get/set)           | Tree indent in pixels (clamped to `8`–`32`).                                             |
| `loadForm(formId)`           | Loads (or reloads) a form by id, fetching it from `data-rest-url` if configured.         |
| `addTab()`                   | Adds a new empty tab and selects it.                                                     |
| `addNode(spec)`              | Adds a field or group node to the active tab. Triggers an autosave.                      |
| `removeNode(nodeId)`         | Removes the node with the given id. Triggers an autosave.                                |
| `renameNode(nodeId, name)`   | Renames a tab, group, or field. Triggers an autosave.                                    |
| `getStructure()`             | Returns a deep clone of the current in-memory structure.                                 |
| `render()`                   | Triggers a full re-render of header, tabs and body.                                      |
| `destroy()`                  | Releases global event listeners (keyboard, outside-click) and cancels pending autosave.  |

## Events

The component dispatches standardized events to inform the application about interactions.

- **`webexpress.webui.Event.FORM_EDITOR_LOADED_EVENT`**: Fired after a form's structure has been loaded (or reloaded) into the editor. Detail: `{ structure }`.
- **`webexpress.webui.Event.FORM_EDITOR_NODE_ADDED_EVENT`**: Fired after a new field or group has been added. Detail: `{ node }`.
- **`webexpress.webui.Event.FORM_EDITOR_NODE_REMOVED_EVENT`**: Fired after a node has been removed. Detail: `{ id }`.
- **`webexpress.webui.Event.FORM_EDITOR_NODE_RENAMED_EVENT`**: Fired after a node's label / field name has been changed. Detail: `{ id, name }`.
- **`webexpress.webui.Event.FORM_EDITOR_NODE_MOVED_EVENT`**: Fired after a drag-and-drop reorder. Detail: `{ nodeId, targetId, position }` where `position` is one of `before` / `after` / `into`.
- **`webexpress.webui.Event.FORM_EDITOR_TAB_ADDED_EVENT`**: Fired after a new tab has been created. Detail: `{ tab }`.
- **`webexpress.webui.Event.FORM_EDITOR_TAB_RENAMED_EVENT`**: Fired after a tab has been renamed. Detail: `{ tabId, name }`.
- **`webexpress.webui.Event.FORM_EDITOR_LAYOUT_CHANGED_EVENT`**: Fired after the designer layout has changed. Detail: `{ layout }`.
- **`webexpress.webui.Event.FORM_EDITOR_SAVED_EVENT`**: Fired after a successful `PUT` against the structure endpoint. Detail: the JSON response body.
- **`webexpress.webui.Event.FORM_EDITOR_VALIDATION_FAILED_EVENT`**: Fired when the server rejected a structure save. Detail: the JSON error body (containing `validation`).

## Keyboard Shortcuts

When the structure tree has focus (no inline rename is active and no input is focused outside the editor):

| Key       | Action                              |
| --------- | ----------------------------------- |
| `↑` / `↓` | Move selection up / down            |
| `←` / `→` | Collapse / expand a group           |
| `F2`      | Begin inline rename of selection    |
| `Del`     | Delete the selected node            |
| `N`       | Focus the QuickAdd picker input     |

## Use Case Examples

### REST-backed editor

```html
<div id="bug-default-form-editor"
     class="wx-webui-form-editor"
     data-form-id="00000000-0000-0000-0000-000000000001"
     data-rest-url="/api/1/FormStructure"
     data-field-catalog-url="/api/1/FormFieldCatalog"
     data-layout="two-pane">
</div>
```

### Offline preview seeded with an inline structure

```html
<div class="wx-webui-form-editor"
     data-layout="three-pane"
     data-initial-structure='{
       "formId": "demo",
       "formName": "DefaultForm",
       "className": "Bug",
       "version": 1,
       "tabs": [{
         "id": "t1",
         "name": "Details",
         "children": [
           { "id": "n1", "kind": "field", "name": "Title", "type": "string", "required": true },
           { "id": "n2", "kind": "field", "name": "Description", "type": "text" }
         ]
       }]
     }'>
</div>
```
