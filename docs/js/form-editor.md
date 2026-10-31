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

### Initial state

`ControlDataFormEditor.StateFactory` emits a `wx-state` island. The controller reads it **before** it replaces the children of the host, so the island survives the skeleton being built. Every key is optional:

| Key          | Type       | Meaning
|--------------|------------|------------------------------------------------
| `create`     | boolean    | `true` opens a **new form**: nothing is loaded, and the first save (or the publication) creates it. Without it a form the endpoint does not know is a load error, never a new form.
| `structure`  | json       | The definition a new or an offline form starts with. Ignored when a form is loaded.
| `catalog`    | json       | The fields the QuickAdd picker offers where nothing is loaded (`[{ id, label, type }]`).
| `activeTab`  | string     | The id of the tab shown first.
| `collapsed`  | json       | The ids of the groups shown collapsed.
| `preview`    | boolean    | Whether the preview is shown; overrides `data-preview`.

### ViewState binding

Like the data table, the editor runs in one of two modes:

- **Standalone** (default): it owns its `wx-service` islands, loads the definition from `data` and writes to it.
- **Bound** (`data-wx-resource`, authored with `.Resource<TResource>()`): the enclosing ViewState owns the load and the service. The editor renders the resource slice (the raw `{ catalog, data }` answer), writes through `viewState.serviceForResource(resource)`, and retries a failed load with `viewState.reload(resource)`. The draft service stays the editor's own island.

**A slice never replaces unsaved work.** A slice arriving while a change is unsaved, a write is in flight, a conflict waits for the user, or a publication, discard or reload runs, is held back and looked at again once everything is confirmed; for a new, offline or stale form it is ignored. A slice is only taken over when it is **newer** than the definition on screen:

- a higher `version` than the one the editor holds is newer; a lower one is the answer to a query sent before the editor's own write and is dropped;
- without a newer version — a draft, whose saves do not move it, or a store that does not version — a slice is taken over only as long as the editor has not written since it took over a definition, because afterwards it cannot be told apart from an answer that predates the write;
- an unchanged definition is not taken over again, so the selection stays.

If the server moved on in a way the editor does not take over, the next write reports a conflict.

### Services

The endpoints are declared in C# and emitted as `wx-service` islands among the children of the host. Without any service the editor runs offline and persists nothing.

| Service | Method   | Body          | Response                                | Purpose
|---------|----------|---------------|-----------------------------------------|------------------------------------------------
| `data`  | `GET`    | —             | `{ catalog, data }`                     | What the editor opens on: the structure and the field catalog of the QuickAdd picker. The endpoint decides whether the structure is the draft or the published form; the control does not merge them.
| `data`  | `PUT`    | the structure | `{ data }` with the new `version`       | Without a draft: the autosave. With a draft: **the publication.** The endpoint applies the structure and ends the draft itself.
| `draft` | `GET`    | —             | `{ draft, updated, revision }`          | Whether the editor is resuming an unpublished draft, since when, and its revision. Only these keys are read.
| `draft` | `PUT`    | the structure and `draftRevision` | `{ revision }`      | Stores the structure as the unpublished draft, unless it was edited on top of another revision (409).
| `draft` | `DELETE` | —             | —                                       | Discards the draft.

The draft payload is **the same shape the publish sends** — the structure as `getStructure()` returns it, plus the `draftRevision` it was edited on top of — so an endpoint reads one contract and not two.

The controller **never deletes a draft as part of publishing**. A delete racing a publish that failed would destroy the only copy of the work, so ending the draft is the publish endpoint's job, inside its own transaction. After a publication the client sends no `DELETE`.

#### Load answers

The `GET` of the data service must answer a definition: `{ catalog, data }`, `{ structure }`, or a bare structure. Anything else is a **load error**, not an empty form:

| Answer                                   | Phase    | What the user sees
|------------------------------------------|----------|------------------------------------------------
| `200` with a definition                  | `ready`  | the form
| `404`                                    | `error`  | *The form does not exist.* and a retry
| `200` without a definition (`data: null`)| `error`  | *The server did not answer with a form definition.* and a retry
| network failure / other status           | `error`  | the reason and a retry

After a load error there is no definition, so there is nothing to edit and nothing an autosave could write over the form it failed to load. `FORM_EDITOR_LOADED_EVENT` is raised only when a valid definition was taken over.

#### Write answers

Every `PUT` — autosave, draft save, publication — is classified by the normalised service result:

| Answer                                  | Kind         | Save state  | Behaviour
|-----------------------------------------|--------------|-------------|------------------------------------------------
| `2xx`                                   | —            | `saved` / `idle` | the revision the write carried is confirmed; `saved` only when no newer change exists, otherwise `pending` and the next write follows at once
| `409` / `412`                           | `conflict`   | `conflict`  | nothing is retried or overwritten; the local changes stay and every write is held until the user resolves it (see below)
| `400` / `422`                           | `validation` | `error`     | the messages are listed in the notice and put on the tree rows they name; `FORM_EDITOR_VALIDATION_FAILED_EVENT` is raised
| network failure                         | `network`    | `error`     | *The server is not reachable. Your changes are kept…* and a retry
| any other status                        | `server`     | `error`     | *The server could not save the changes (status N)…* and a retry

A refused definition is read with the classification of the REST form, so the endpoint answers `400` with `{ message }` (what `RestApiRefusal` produces), `{ errors: { "<node id or label>": "message" } }` or `[{ field, message }]`; `{ validation: ["message"] }` is read as well. A `field` is matched against the node ids first and the node labels second.

#### Version conflicts

`RestApiFormEditor<TIndexItem>.Update` compares the `version` of the incoming structure with the one `RetrieveVersion` answers — by default the version of what `RetrieveItem` answers. An endpoint whose `RetrieveItem` answers the draft where one exists overrides `RetrieveVersion` with the published version, so a publication is refused when someone else published on top of the version the draft was started from. When both are greater than `0` and differ, it answers `409` with `{ "message", "version" }` (the stored version) instead of calling `UpdateItem`. A form not stored yet, and a client or store that does not version (`0`), are unaffected. The check is on the server on purpose: only the endpoint knows the stored version.

The editor offers two ways out, both explicit:

- **Load their version** — `resolveConflict("reload")`: the local changes are dropped and the server version is loaded.
- **Keep my version** — `resolveConflict("overwrite")`: the local version is written on top of the stored one, whose version the conflict answer named (or a fresh load supplies). A conflict raised by a publication is resolved by publishing again.

#### Draft conflicts

Draft saves do not move `version` — nothing the forms in use see changes — so two editors drafting the same form cannot tell each other's saves apart by it. The draft therefore has a **revision** of its own: the draft `GET` answers it, every draft `PUT` carries the revision it was edited on top of as `draftRevision` (the only key the draft payload adds to the structure), and the answer names the new one.

`RestApiFormEditorDraft<TIndexItem>` implements this contract. Its `PUT` answers `409` with `{ "message", "revision" }` when the presented revision is not the stored one — also when the draft was published or discarded in the meantime (stored revision `0`), so an editor still working on it does not re-open it unnoticed. The editor treats it like any conflict; **Keep my version** writes on top of the revision the answer named. A draft endpoint that answers no revision keeps working: the editor then sends `draftRevision: 0` and the endpoint ignores it.

`RestApiFormEditorItem.DraftRevision` is only written when it is not `0`, so the structure the data endpoint answers is unchanged.

#### Discard whose re-load fails

When the `DELETE` succeeded but the following `GET` failed, `discard()` resolves to `false` and the editor enters the phase **`stale`**: the former draft stays on screen for recovery, marked by a notice as *no longer stored anywhere*, and it is locked — neither editable nor saved, not even when the page is left. `FORM_EDITOR_DRAFT_DISCARDED_EVENT` is raised with `{ reloaded: false }`, `FORM_EDITOR_LOADED_EVENT` is not. The notice offers **Reload** (`reload()`) and **Restore as draft** (`restore()`, which writes the kept content back as a draft).

### Wire format

The structure mirrors the `RestApiFormEditorItem` payload. A field node looks like `{"id":"…","kind":"field","label":"Title","type":"string","required":true}`; a group node like `{"id":"…","kind":"group","layout":"horizontal","label":"Reported","children":[…]}`. Field types are the logical ones the editor previews (`string`, `text`, `richtext`, `password`, `timestamp`, `daterange`, `ref`, `enum`, `choice`, `tags`, `number`, `range`, `rating`, `estimate`, `color`, `avatar`, `tile`, `move`, `file`). Group layouts are one of `vertical`, `horizontal`, `mix`, `col-vertical`, `col-horizontal`, `col-mix`.

## State

The controller is a `webexpress.webapp.Data` control. Its state — `store.getState()` — has three parts kept apart, and the surface and the actions it offers are derived from them:

| Part          | Holds
|---------------|------------------------------------------------
| `definition`  | the form definition (the structure `getStructure()` copies); `catalog` sits beside it
| `ui`          | the surface: `activeTabId`, `selectedId`, `editingId`, `collapsed`, `preview`, `indent`
| `persistence` | `phase`, save `status`, local `revision` and confirmed `savedRevision`, `draft`, `draftRevision`, `updated`, `savedAt`, `busy` (`publishing`, `discarding`, `reloading`), the last `error` (`{ kind, origin, status, message, details, items }`) and an offered `recovery` (`{ savedAt, changedSince }`)

### Phases

The phase says where the definition on screen came from, and whether it may be changed:

| Phase      | Means                                                         | Editable | Saved
|------------|---------------------------------------------------------------|----------|------
| `loading`  | the definition is being loaded                                | no       | no
| `ready`    | a definition was loaded                                       | yes      | yes
| `offline`  | no service is declared; the definition is local               | yes      | no
| `create`   | a new form was asked for (`create` in the state)              | yes      | yes (the first write creates it)
| `error`    | the load failed; there is no definition                       | no       | no
| `stale`    | the draft was discarded, the published form could not be loaded | no     | no (only `restore()`)

Editing is also locked while `busy` is set and on a read-only editor. The lock applies to the surface **and** to the methods: `addTab()`, `addNode()`, `removeNode()`, `renameNode()`, the inline name, description and tab editors and drag-and-drop all run through one change path that refuses it. The host carries `wx-form-editor--locked` and `aria-busy` while locked or busy.

### Save coordination

The same coordination serves the direct save and the draft:

- **Every change** — adding, removing, renaming, moving a node or a tab, editing the form name or description — counts the local `revision`. The editor is unsaved while `revision > savedRevision`, independent of the debounce timer.
- **Writes.** After a short debounce the definition is written. Each write carries an unshared copy taken at its revision. **One write is in flight at a time**; changes made meanwhile are written together right after it returned. A success confirms the revision it carried and reads `saved` only when no newer change exists.
- **Failures** keep the changes unsaved. The notice explains the kind and offers **Try again** (`retry()`); the next change retries as well. A conflict holds every write until the user decided.
- **Leaving.** Hiding or leaving the page goes through the same loop: without a write in flight the changes are sent at once with a keepalive request; with one in flight the keepalive is handed to the write that follows it, so nothing overtakes an open write. A sent request is not a save — the state reads `saving` until it answered. A body over the keepalive budget (60 000 bytes; browsers refuse more than 64 KiB in flight) goes out as an ordinary request instead of failing. A navigation cannot be delayed, so `beforeunload` asks the user while something is unsaved.
- **destroy()** inside a running application does not drop a queued change: a change that is not covered by the write in flight is written once that write returned, carrying the version and draft revision it answered. The outcome is no longer shown and raises no event. A change that cannot be saved (conflict, read-only, stale, publication or discard in progress) is reported on the console.
- **Recovery copy.** Whatever the server has not confirmed when the page is hidden, left or the editor is destroyed is also kept in the browser (`localStorage`, key `wx-form-editor:recovery:` + the address of the write target). A write that confirms everything removes it again. On the next load the copy is compared with what the server answers, by the parts the editor changes: equal means the write arrived after all, and the copy is dropped silently; otherwise the editor offers **Restore my changes** (`recover()`, written as a change of its own) or **Discard them** (`dismissRecovery()`). When the form has a different version since, the notice says that restoring replaces it. Nothing is restored without being asked, and an unavailable storage only means there is no copy.

## Draft and publish

Where a draft service is declared, the editor drafts:

- **Every change** goes to the draft (see *Save coordination*).
- **Publish.** The button in the header sends the structure on screen to the data service; editing is locked meanwhile. A queued draft save is dropped rather than raced against the publication — it would otherwise land after it and re-open the draft — and one already in flight is waited for. The publication carries the structure itself, so nothing is lost by that. A publication the endpoint rejected leaves the draft standing, reports the reason, and writes the dropped change to the draft after all.
- **Discard.** The link in the footer, behind a confirmation, sends `DELETE` to the draft service, then re-loads the structure from the data service so the editor shows what the forms in use see; editing is locked meanwhile. The page is deliberately **not** reloaded: a control does not get to navigate its host. A re-load that fails leaves the editor `stale` (see above).
- **Nothing unpublished.** The publish button is disabled and the discard link hidden until a draft exists (or a change is unsaved), because the form is then already what the endpoint has.

### Save States

One attribute, `data-wx-state`, on the footer status (and `data-wx-phase` beside it); the text comes from the `webexpress.webapp:formeditor.state.*` keys — `formeditor.state.direct.*` without a draft — with `{0}` filled by the local time of the last write. The states are the same with and without a draft:

| State         | Means
|---------------|------------------------------------------------
| `idle`        | published / stored, nothing unsaved
| `draft`       | opened on an unpublished draft of unknown age
| `pending`     | a change is not written yet
| `saving`      | a write is in flight
| `saved`       | the latest change is stored, with the time
| `error`       | a write failed; the changes are kept, retry offered
| `conflict`    | the server holds a newer version; nothing is written until the user decides
| `publishing`  | the publication is in flight (draft only)
| `discarding`  | the draft is being dropped (draft only)

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
| `drafting` (get)             | Whether changes go to a draft: a draft service is declared and the editor is not read-only.       |
| `draft` (get)                | Whether an unpublished draft exists on the server.                                                |
| `state` (get)                | The save state the footer shows (see above). The whole state is `store.getState()`.               |
| `phase` (get)                | The phase of the definition on screen (see above).                                                |
| `dirty` (get)                | Whether the definition holds changes the server has not confirmed.                                |
| `addTab()`                   | Adds a new empty tab and selects it. Refused while the editor is locked.                          |
| `addNode(spec)`              | Adds a field or group node to the active tab. Refused while the editor is locked.                 |
| `removeNode(nodeId)`         | Removes the node with the given id. Refused while the editor is locked.                           |
| `renameNode(nodeId, name)`   | Renames a group or field of the active tab, or a tab. Refused while the editor is locked.         |
| `getStructure()`             | Returns a deep clone of the current in-memory structure, or `null` without a definition.          |
| `save()`                     | Writes the unsaved changes now. Resolves to `true` when nothing unsaved is left.                  |
| `retry()`                    | Repeats what failed: the load, the publication or the write.                                      |
| `reload()`                   | Loads the server's definition and replaces what is on screen, unsaved changes included.           |
| `resolveConflict(choice)`    | Resolves a conflict with `"reload"` (take theirs) or `"overwrite"` (keep mine).                   |
| `restore()`                  | Writes the content kept in the `stale` phase back as a draft.                                     |
| `recover()`                  | Takes over the changes the browser kept from an earlier session and writes them.                  |
| `dismissRecovery()`          | Drops the changes the browser kept from an earlier session.                                       |
| `publish()`                  | Publishes the structure on screen. Resolves to `true` when the endpoint accepted it.              |
| `discard()`                  | Drops the draft and re-loads the published structure. Resolves to `true` only when both succeeded.|
| `render()`                   | Triggers a full re-render of header, body and footer.                                             |
| `destroy()`                  | Tears the editor down; safe to call twice. Removes its listeners, timers, ViewState subscription and inline editors, writes a pending change (see *Save coordination*) and ignores every later answer. |

## Events

The component dispatches standardized events on the host element to inform the application about interactions.

- **`webexpress.webapp.Event.FORM_EDITOR_LOADED_EVENT`**: Fired after a valid definition was taken over: loaded, re-loaded after a discard or a reload, a new form, or an offline one. Never after a failed load. Detail: `{ structure, phase }`.
- **`webexpress.webapp.Event.FORM_EDITOR_NODE_ADDED_EVENT`**: Fired after a new field or group has been added. Detail: `{ node }`.
- **`webexpress.webapp.Event.FORM_EDITOR_NODE_REMOVED_EVENT`**: Fired after a node has been removed. Detail: `{ id }`.
- **`webexpress.webapp.Event.FORM_EDITOR_NODE_RENAMED_EVENT`**: Fired after a node's label has been changed. Detail: `{ id, name }`.
- **`webexpress.webapp.Event.FORM_EDITOR_NODE_MOVED_EVENT`**: Fired after a drag-and-drop reorder. Detail: `{ nodeId, targetId, position }` where `position` is one of `before` / `after` / `into`.
- **`webexpress.webapp.Event.FORM_EDITOR_TAB_ADDED_EVENT`**: Fired after a new tab has been created. Detail: `{ tab }`.
- **`webexpress.webapp.Event.FORM_EDITOR_TAB_RENAMED_EVENT`**: Fired after a tab has been renamed. Detail: `{ tabId, name }`.
- **`webexpress.webapp.Event.FORM_EDITOR_SAVED_EVENT`**: Fired after a successful `PUT` against the data service where no draft is declared. Detail: the JSON response body.
- **`webexpress.webapp.Event.FORM_EDITOR_DRAFT_SAVED_EVENT`**: Fired after the structure was stored as the draft. Detail: `{ structure, updated }`, where `structure` is the copy the write carried.
- **`webexpress.webapp.Event.FORM_EDITOR_DRAFT_DISCARDED_EVENT`**: Fired after the draft was dropped. Detail: `{ reloaded }` — `true` when the published structure followed (announced through `FORM_EDITOR_LOADED_EVENT`), `false` when its re-load failed and the editor is `stale`.
- **`webexpress.webapp.Event.FORM_EDITOR_PUBLISHED_EVENT`**: Fired after the data service accepted the publication. Detail: `{ structure, response }`.
- **`webexpress.webapp.Event.FORM_EDITOR_STATE_EVENT`**: Fired whenever the save state or the phase changes. Detail: `{ state, phase, error }`.
- **`webexpress.webapp.Event.FORM_EDITOR_VALIDATION_FAILED_EVENT`**: Fired when the server refused a save or a publication as invalid (`400` / `422`). Detail: the JSON error body. Outages, technical failures and conflicts do not raise it; they are told apart by `error.kind` in `FORM_EDITOR_STATE_EVENT`.

No event is raised after `destroy()`.

## Keyboard Shortcuts

The keys belong to the structure tree that has the focus: they are listened for on the body of each editor, not on the window, so a second editor on the page never reacts to the same key. Inputs, text areas, selects and editable content — the inline rename and the QuickAdd field included — keep their normal keys. Navigation works on a locked definition too; rename, delete and add only while it may be changed.

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

`FormStructureRestApi` derives from `RestApiFormEditor<TIndexItem>`, whose `GET` answers the structure and the catalog and whose `PUT` receives the structure to apply. `FormDraftRestApi` derives from `RestApiFormEditorDraft<TIndexItem>`, which answers `{ draft, updated, revision }` on `GET`, stores the structure on `PUT` after the revision check and drops it on `DELETE`; a subclass implements `RetrieveDraft`, `StoreDraft` (moving the revision on) and `DeleteDraft`. The revision check and the store are two calls, so a store that serves concurrent writers compares `item.DraftRevision` with its revision again inside its own transaction and returns `null` to refuse, which is answered as the same `409`. Ending the draft on publication stays with the data endpoint's `UpdateItem`.

The tutorial shows the pair: `FormEditor` answers the draft where one exists, checks a publication against the published version (`RetrieveVersion`) and ends the draft in `UpdateItem`; `FormEditorDraft` keeps the drafts under the lock both share. The *DraftService* sample on the DataFormEditor page edits a form of its own; opened in two browser sessions it shows the draft conflict.

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

```csharp
// a new form: nothing is loaded, the first save creates it
new ControlDataFormEditor("editor")
    {
        StateFactory = _ => DataState.Create().Set("create", true)
    }
    .DataService<FormStructureRestApi>();

// inside a ViewState that loads the form centrally
new ControlDataFormEditor("editor")
    .Resource<FormResource>()
    .DraftService<FormDraftRestApi>();
```

`TemplateFactory` belongs to the data island contract every data control implements, but the form editor does not support it: a template replaces the whole view of a data control, which for the designer would drop every editing affordance. The control emits no `data-wx-template`, and the controller ignores one that is present.

## Filling the pane

Growing with the form it edits is right for an editor among other blocks on a page. Where the editor *is* the view, it is wrong: inside an application shell the page does not scroll, the panes do, and a growing editor takes its head and its foot along with the page - the form name above and the save state below leave the screen while the user works. `Fill` takes the height from the host instead:

```csharp
new ControlDataFormEditor("editor")
{
    Fill = _ => true
};
```

The host is marked `wx-fill`, and a flex column host then drives the editor: it grows into the free space and shrinks with it, and the structure tree and the preview scroll on their own between chrome that stays. In a `WebExpress.WebApp` shell the content panel becomes one on its own as soon as a filling control is on the page, so `Fill` is all a page there has to set; elsewhere, make the host a flex column with `min-height: 0`. A host that hands nothing down leaves the editor at `--wx-form-editor-height` (default `70vh`), **never at its content height** - the panes are scrollports, and a scrollport only exists while its container is bounded. `max-height: 100%` keeps the editor inside a host that does have an extent.
