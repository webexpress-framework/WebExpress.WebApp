![WebExpress](https://raw.githubusercontent.com/webexpress-framework/.github/main/docs/assets/img/banner.png)

# RestFormEditorCtrl

The `RestFormEditorCtrl` is a self-contained visual editor for form definitions. It hosts a structure tree (with tabs, drag-and-drop, inline rename, keyboard navigation and a QuickAdd picker) and an optional live preview pane that re-renders the active tab as a form. Configuration is done declaratively via `data-` attributes and `wx-service` islands on the host element; behaviour is driven entirely client-side and persisted through the service layer. It is the client half of `ControlDataFormEditor`.

A form definition has the two meanings of save a document has: *do not lose what I have built* and *let the forms out there use this*. With only the **data** service declared the two coincide and every mutation is written to it. With a **draft** service declared as well, every mutation goes to the draft instead — no version, nothing the forms in use see — and the data service is reached only through the publish button, whose `PUT` **is** the publication and ends the draft in its own transaction.

```
   ┌─────────────────────────────────────────────────────────────────┐
   │  FormName  v3                        [Hide preview] [ Publish ] │  // .wx-form-editor-head
   │  Form description                                               │
   ├──────────────────────────────┬──────────────────────────────────┤
   │  Structure · Details    5    │   Live preview                   │
   │  [Details] [Environment] [+] │  ┌────────────────────────────┐  │
   │   ▾ Title          string    │  │ Title:  ___________        │  │
   │   ▾ Status         enum      │  │ Status: ◯ ◉ ○ ○            │  │
   │   ▸ Group: Reported by/When  │  └────────────────────────────┘  │
   │  [Quick add… ____]  [+ Add]  │                                  │
   │  ↑↓ Navigate  F2 Rename …    │                                  │
   ├──────────────────────────────┴──────────────────────────────────┤
   │  Drag nodes to reorder · …        Draft saved · 19:12  Discard  │  // .wx-form-editor-foot
   └─────────────────────────────────────────────────────────────────┘
```

## Declarative Configuration

The host element must carry the class `wx-webapp-restform-editor` (the `ControlDataFormEditor` C# control sets this automatically); the controller adds `wx-form-editor`, which is what the stylesheet is written against.

### Container Attributes

| Attribute       | Description                                                                                                    | Example                 |
| --------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `data-preview`  | Whether the live preview pane is shown initially. Defaults to `true`.                                          | `data-preview="false"`  |
| `data-indent`   | Tree indent in pixels. Clamped to `8`–`32`. Defaults to `18`.                                                  | `data-indent="22"`      |
| `data-readonly` | When `true`, suppresses all mutation UI (no add/remove/drag/rename), skips every write and never drafts.        | `data-readonly="true"`  |

### Services

The endpoints are declared in C# and emitted as `wx-service` islands among the children of the host. Without any service the editor runs as an offline preview and persists nothing.

| Service | Method   | Body          | Response                                | Purpose
|---------|----------|---------------|-----------------------------------------|------------------------------------------------
| `data`  | `GET`    | —             | `{ catalog, data }`                     | What the editor opens on: the structure and the field catalog of the QuickAdd picker. The endpoint decides whether the structure is the draft or the published form; the control does not merge them.
| `data`  | `PUT`    | the structure | `{ data }` with the new `version`       | Without a draft: the autosave. With a draft: **the publication.** The endpoint applies the structure and ends the draft itself.
| `draft` | `GET`    | —             | `{ draft, updated }`                    | Whether the editor is resuming an unpublished draft, and since when. Only these two keys are read.
| `draft` | `PUT`    | the structure | —                                       | Stores the structure as the unpublished draft.
| `draft` | `DELETE` | —             | —                                       | Discards the draft.

The draft payload is **the same shape the publish sends** — the structure as `getStructure()` returns it — so an endpoint reads one contract and not two.

The controller **never deletes a draft as part of publishing**. A delete racing a publish that failed would destroy the only copy of the work, so ending the draft is the publish endpoint's job, inside its own transaction.

### Wire format

The structure mirrors the `RestApiFormEditorItem` payload. A field node looks like `{"id":"…","kind":"field","label":"Title","type":"string","required":true}`; a group node like `{"id":"…","kind":"group","layout":"horizontal","label":"Reported","children":[…]}`. Field types are the logical ones the editor previews (`string`, `text`, `richtext`, `password`, `timestamp`, `daterange`, `ref`, `enum`, `choice`, `tags`, `number`, `range`, `rating`, `estimate`, `color`, `avatar`, `tile`, `move`, `file`). Group layouts are one of `vertical`, `horizontal`, `mix`, `col-vertical`, `col-horizontal`, `col-mix`.

## Draft and publish

Where a draft service is declared, the editor drafts:

- **Every mutation** — adding, removing, renaming, moving a node or a tab, editing the form name or description — is written to the draft after a short debounce. One write is in flight at a time, and a change made while a request is open is written once it has returned, so the server sees the order the user acted in.
- **Publish.** The button in the header sends the structure on screen to the data service. A queued draft save is dropped rather than raced against the publication — it would otherwise land after it and re-open the draft — and one already in flight is waited for. The publication carries the structure itself, so nothing is lost by that. A publication the endpoint rejected leaves the draft standing, reports the reason through `FORM_EDITOR_VALIDATION_FAILED_EVENT`, and writes the dropped change to the draft after all.
- **Discard.** The link in the footer, behind a confirmation, sends `DELETE` to the draft service, then re-loads the structure from the data service so the editor shows what the forms in use see. The page is deliberately **not** reloaded: a control does not get to navigate its host.
- **Leaving.** A queued write is flushed with a keepalive request when the page is hidden or unloaded, so a tab closed right after a drag-and-drop still lands. Otherwise leaving does nothing: the draft stays, and the next visit resumes it.
- **Nothing unpublished.** The publish button is disabled and the discard link hidden until a draft exists, because the form is then already what the endpoint has.

### Save States

One attribute, `data-wx-state`, on the footer status; the text comes from the `webexpress.webapp:formeditor.state.*` keys, with `{0}` filled by the local time of the last draft write. Without a draft service the footer reads a fixed *autosaves on every change* (or *offline preview*) and the attribute stays `idle`.

| State         | Means
|---------------|------------------------------------------------
| `idle`        | published, nothing unsaved
| `draft`       | opened on an unpublished draft of unknown age
| `pending`     | a change is queued
| `saving`      | a draft write is in flight
| `saved`       | the draft is stored, with the time
| `error`       | the draft write failed; the next change retries
| `publishing`  | the publication is in flight
| `discarding`  | the draft is being dropped

## Programmatic Control

Once initialized, the editor can be programmatically controlled via its controller instance.

### Accessing an Automatically Created Instance

For form editors defined declaratively in HTML, the associated instance is retrieved via the `getInstanceByElement(element)` method of the central `webexpress.webui.Controller`.

```javascript
// find the host element in the DOM
const host = document.getElementById('myFormEditor');

// retrieve the controller instance associated with the element
const editor = webexpress.webui.Controller.getInstanceByElement(host);

// add a new field to the active tab
editor.addNode({ kind: 'field', label: 'Severity', type: 'enum', required: true });

// dump the current in-memory structure
console.log(editor.getStructure());

// let the forms out there use it
if (editor.drafting && editor.draft) {
    await editor.publish();
}
```

### Manual Instantiation

A form editor can also be created entirely programmatically and attached to a host element carrying the service islands.

```javascript
const host = document.getElementById('form-editor');
host.classList.add('wx-webapp-restform-editor');

const editor = new webexpress.webapp.RestFormEditorCtrl(host);
```

### Public API

| Member                       | Description                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------- |
| `preview` (get/set)          | Whether the live preview pane is shown.                                                           |
| `indent` (get/set)           | Tree indent in pixels (clamped to `8`–`32`).                                                      |
| `drafting` (get)             | Whether mutations go to a draft: a draft service is declared and the editor is not read-only.     |
| `draft` (get)                | Whether an unpublished draft exists on the server.                                                |
| `state` (get)                | The save state the footer shows (see above).                                                      |
| `addTab()`                   | Adds a new empty tab and selects it.                                                              |
| `addNode(spec)`              | Adds a field or group node to the active tab. Triggers a save.                                    |
| `removeNode(nodeId)`         | Removes the node with the given id. Triggers a save.                                              |
| `renameNode(nodeId, name)`   | Renames a group or field. Triggers a save.                                                        |
| `getStructure()`             | Returns a deep clone of the current in-memory structure.                                          |
| `save()`                     | Writes a queued change now, without waiting for the debounce.                                     |
| `publish()`                  | Publishes the structure on screen. Resolves to `true` when the endpoint accepted it.              |
| `discard()`                  | Drops the draft and re-loads the published structure. Resolves to `true` when the draft is gone.  |
| `render()`                   | Triggers a full re-render of header, body and footer.                                             |
| `destroy()`                  | Releases global event listeners (keyboard, outside-click, page leave) and cancels a pending save. |

## Events

The component dispatches standardized events on the host element to inform the application about interactions.

- **`webexpress.webapp.Event.FORM_EDITOR_LOADED_EVENT`**: Fired after a form's structure has been loaded (or re-loaded after a discard) into the editor. Detail: `{ structure }`.
- **`webexpress.webapp.Event.FORM_EDITOR_NODE_ADDED_EVENT`**: Fired after a new field or group has been added. Detail: `{ node }`.
- **`webexpress.webapp.Event.FORM_EDITOR_NODE_REMOVED_EVENT`**: Fired after a node has been removed. Detail: `{ id }`.
- **`webexpress.webapp.Event.FORM_EDITOR_NODE_RENAMED_EVENT`**: Fired after a node's label has been changed. Detail: `{ id, name }`.
- **`webexpress.webapp.Event.FORM_EDITOR_NODE_MOVED_EVENT`**: Fired after a drag-and-drop reorder. Detail: `{ nodeId, targetId, position }` where `position` is one of `before` / `after` / `into`.
- **`webexpress.webapp.Event.FORM_EDITOR_TAB_ADDED_EVENT`**: Fired after a new tab has been created. Detail: `{ tab }`.
- **`webexpress.webapp.Event.FORM_EDITOR_TAB_RENAMED_EVENT`**: Fired after a tab has been renamed. Detail: `{ tabId, name }`.
- **`webexpress.webapp.Event.FORM_EDITOR_SAVED_EVENT`**: Fired after a successful `PUT` against the data service where no draft is declared. Detail: the JSON response body.
- **`webexpress.webapp.Event.FORM_EDITOR_DRAFT_SAVED_EVENT`**: Fired after the structure was stored as the draft. Detail: `{ structure, updated }`.
- **`webexpress.webapp.Event.FORM_EDITOR_DRAFT_DISCARDED_EVENT`**: Fired after the draft was dropped, before the re-loaded structure is announced through `FORM_EDITOR_LOADED_EVENT`.
- **`webexpress.webapp.Event.FORM_EDITOR_PUBLISHED_EVENT`**: Fired after the data service accepted the publication. Detail: `{ structure, response }`.
- **`webexpress.webapp.Event.FORM_EDITOR_STATE_EVENT`**: Fired whenever the save state changes. Detail: `{ state }`.
- **`webexpress.webapp.Event.FORM_EDITOR_VALIDATION_FAILED_EVENT`**: Fired when the server rejected a save or a publication. Detail: the JSON error body.

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

The control is authored in C#; the markup below is what it renders, and what the controller expects to find.

### Autosaving editor

```html
<div id="bug-default-form-editor" class="wx-webapp-restform-editor">
    <wx-service hidden name="data" kind="rest" base-uri="/api/1/FormStructure/bug"></wx-service>
</div>
```

### Drafting editor

```html
<div id="bug-default-form-editor" class="wx-webapp-restform-editor">
    <wx-service hidden name="data" kind="rest" base-uri="/api/1/FormStructure/bug"></wx-service>
    <wx-service hidden name="draft" kind="rest" base-uri="/api/1/FormDraft/bug" method="GET" update-method="PUT"></wx-service>
</div>
```

## Authoring in C\#

```csharp
new ControlDataFormEditor("editor")
    .DataService<FormStructureRestApi>()
    .DraftService<FormDraftRestApi>();
```

`FormStructureRestApi` derives from `RestApiFormEditor<TIndexItem>`, whose `GET` answers the structure and the catalog and whose `PUT` receives the structure to apply. The draft endpoint answers `{ draft, updated }` on `GET`, stores the structure on `PUT` and drops it on `DELETE`.

Drafting is optional in two ways, and both lead to the same surface: an editor that autosaves into the form itself, with no publish button, no discard link and no draft state.

```csharp
// no draft endpoint declared at all
new ControlDataFormEditor("editor")
    .DataService<FormStructureRestApi>();

// both endpoints declared, but this request may not hold an unpublished version
new ControlDataFormEditor("editor")
    {
        Draft = renderContext => permissionManager.MayDraft(renderContext.Request)
    }
    .DataService<FormStructureRestApi>()
    .DraftService<FormDraftRestApi>();
```

`Draft` is a resolver rather than a fixed value for the second case: whether a draft may exist is often a question about the request. It is kept apart from the endpoint declaration so that turning drafting off does not mean withdrawing the endpoint — the host declares its two endpoints once and decides per request which of the two meanings of save the editor offers.

## Filling the pane

Growing with the form it edits is right for an editor among other blocks on a page. Where the editor *is* the view, it is wrong: inside an application shell the page does not scroll, the panes do, and a growing editor takes its head and its foot along with the page - the form name above and the save state below leave the screen while the user works. `Fill` takes the height from the host instead:

```csharp
new ControlDataFormEditor("editor")
{
    Fill = _ => true
};
```

The host is marked `wx-fill`, and a flex column host then drives the editor: it grows into the free space and shrinks with it, and the structure tree and the preview scroll on their own between chrome that stays. In a `WebExpress.WebApp` shell the content panel becomes one on its own as soon as a filling control is on the page, so `Fill` is all a page there has to set; elsewhere, make the host a flex column with `min-height: 0`. A host that hands nothing down leaves the editor at `--wx-form-editor-height` (default `70vh`), **never at its content height** - the panes are scrollports, and a scrollport only exists while its container is bounded. `max-height: 100%` keeps the editor inside a host that does have an extent.
