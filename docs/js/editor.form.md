![WebExpress](https://raw.githubusercontent.com/webexpress-framework/.github/main/docs/assets/img/banner.png)

# EditorFormCtrl

The `EditorFormCtrl` keeps a document form saved as an unpublished draft while it is being written, and reports that on the footer bar the publish button sits on. It is the client half of `ModalDataEditor`.

A rest form is a single transaction: it loads once, it submits once, and everything typed in between exists only in the DOM. For an issue that is right — the form is short and the save is one click away. For a document it is not: the text is the work, a lost tab is a lost afternoon, and the save that matters ("publish") is a decision about readers rather than about storage. A form that only saves on submit therefore loses an afternoon to a closed tab, while a form that saves continuously publishes every unfinished sentence to whoever is reading the page.

So the two are split across the two services the form declares. Every change is written to the **draft** service — no commit, no revision, nothing the readers see — while the submit goes to the **data** service, whose `PUT` applies the text and ends the draft in its own transaction. Leaving without publishing keeps the draft, so the next edit resumes where this one stopped while the reading view still shows the last published text.

The controller **never deletes a draft as part of publishing**. A delete racing a publish that failed would destroy the only copy of the text, so ending the draft is the publish endpoint's job, inside its own transaction.

```
   ┌────────────────────────────────────────────────────────────────┐
   │ Getting started with WebExpress                        [⛶] [×] │  // .wx-modal-header
   ├────────────────────────────────────────────────────────────────┤
   │ ┌────────────────────────────────────────────────────────────┐ │
   │ │ B I U │ ≡ ≡ ≡ │ ⌗ 🖼 😀 │ ⎌ ⎌                              │ │
   │ ├────────────────────────────────────────────────────────────┤ │  // .wx-modal-content
   │ │ Lorem ipsum dolor sit amet, consectetur adipiscing elit.   │ │  //   holds the body,
   │ │                                                            │ │  //   data-fill="true"
   │ │                                                            │ │
   │ └────────────────────────────────────────────────────────────┘ │
   ├────────────────────────────────────────────────────────────────┤
   │ (MP)(EM)  Draft saved · 19:12       [ ⋯ ] [ Publish ] [ Close ]│  // .wx-modal-footer
   └────────────────────────────────────────────────────────────────┘
```

The control **is** the dialog rather than a form somebody else opens as one, because a writing
surface is only right at that size: the title belongs on the title bar the dialog needs anyway,
and the body has to end exactly where the dialog does. The rendered markup is a `<form>` holding
its hidden service islands and one `div.wx-webui-modal`; `ModalCtrl` lifts the three
`.wx-modal-*` sections onto the dialog it builds inside it, and appends the fullscreen toggle,
the close button and the cancel button last — which is why *state · ⋯ · publish · close* is the
reading of the footer bar and why nothing a form contributes can land to the right of them.

## Declarative Configuration

The controller is mounted on the **save indicator** on the footer bar, not on the form. The controller registry keeps one instance per element and the form already carries the `RestFormCtrl` that loads and publishes, so a second class registered on it would replace the first in the registry and never be torn down. The indicator carries the whole configuration instead, and reaches the form and its services by walking up to it with `closest("form")` — which keeps working after `ModalCtrl` has rebuilt the dialog around it, because the dialog is built *inside* the form.

### Host Element Attributes

| Attribute              | Description                                                                                                   | Example
|------------------------|---------------------------------------------------------------------------------------------------------------|--------------------------------
| `data-wx-state`        | The save state, written by the controller and selected on by the stylesheet. Server-rendered as `idle`.         | `data-wx-state="saved"`
| `data-wx-debounce`     | Milliseconds the typing has to rest before a save goes out. Defaults to `900`.                                 | `data-wx-debounce="900"`
| `data-wx-max-delay`    | Milliseconds after which a change is written however continuous the typing is. Defaults to `5000`.             | `data-wx-max-delay="5000"`
| `data-wx-menu`         | The `id` of the overflow menu, revealed once a draft exists.                                                   | `data-wx-menu="editor_menu"`
| `data-wx-discard`      | The `id` of the discard entry in that menu.                                                                    | `data-wx-discard="editor_discard"`

The host element exists only while the surface actually drafts. A form that declares no draft service — or whose `Draft` resolver answers false — renders no indicator, so this controller never mounts.

The entry is found by walking up from the click target rather than by a selector, because a dropdown rebuilds its entries into fresh anchors: only the `id` and the `data-*` attributes of the authored entry survive that.

### REST Contract

Two services, one per meaning of save. Both are declared in C# and emitted as `wx-service` islands among the direct children of the form.

| Service  | Method   | Body                       | Response                              | Purpose
|----------|----------|----------------------------|---------------------------------------|------------------------------------------------
| `data`   | `GET`    | —                          | the form values                       | What the editor opens on. The endpoint decides whether that is the draft or the published text; the control does not merge them.
| `data`   | `PUT`    | the serialized form        | —                                     | **The publication.** The endpoint applies the text and ends the draft itself.
| `draft`  | `GET`    | —                          | the same shape plus `draft`, `updated`| Whether the editor is resuming an unpublished draft, and since when.
| `draft`  | `PUT`    | the serialized form        | —                                     | Stores the current values as the unpublished draft.
| `draft`  | `DELETE` | —                          | —                                     | Discards the draft.

The draft payload is **the same shape the publish sends**, keyed by the field names the host declared, so an endpoint reads one contract and not two. It is built by the form controller's `serialize()` rather than by reading the form a second time, which is what keeps the two from drifting apart on the next controlled input.

Only the two reserved keys of the `GET` answer are read. Which text the editor opens on is the record endpoint's decision, and the form has already loaded it.

## Functionality

- **Debounce.** A save goes out `data-wx-debounce` ms after the typing rests, and is forced after `data-wx-max-delay` ms of continuous typing, so a long paragraph is not held hostage to the pause that never comes.
- **Touch gate.** Nothing is saved until a trusted user event has occurred inside the form — `keydown`, `paste`, `cut`, `drop`, `pointerdown`. Hydrating the form from the server fires the same `input` and change events typing does, and saving on those would report "saved" to someone who has written nothing.
- **No redundant writes.** A payload identical to the last one sent is dropped; the editor reports a change for a caret move through a formatting command as readily as for a typed character.
- **Rich text.** The editor moves the field name off its host onto a hidden `<input>` it creates inside it and reports the change with `webexpress.webui.change.value`, which bubbles — so one listener on the form covers the editor however deeply it nests, and the value is read from the hidden input rather than from the markup.
- **Leaving the page.** `pagehide` and a `visibilitychange` to hidden flush a pending save with `keepalive: true`, so a tab closed mid-sentence still lands.
- **Publish.** The submit goes to the record service through the `RestFormCtrl`. The pending autosave is cancelled first — it would otherwise land after the publication and re-open the draft. The dialog then **closes**: the decision it was opened for has been taken. Closing is done here rather than left to the form controller, which only closes when the endpoint's answer happens to say so.
- **Discard.** `DELETE` on the draft service, then the form's own `load()`, then the dialog **closes**. The reload happens even though the dialog is going away, because the dialog is not rebuilt when it is opened again — without it the next open would show the text that was just thrown away. The page is deliberately **not** reloaded: a framework control does not get to navigate its host.
- **Abandoning.** Closing the dialog by hand does nothing at all. The draft stays, and the next edit resumes it.
- **Presence.** A shared document docks the `CollaborativeCtrl` presence chips onto the footer bar through `data-collaborative-presence-host`, so who else is in the document reads beside the save state instead of floating over the first line of what is being written. The chips are rendered by the collaborative control; this one only provides the slot, at the left end of the bar ahead of the save state — who is here is a fact about the document rather than about the draft. Because that control joins its channel when the dialog opens and leaves when it closes, the people shown are the ones who have the document **open** — not everybody who happens to have loaded the page it can be opened from.
- **Opening and closing.** The dialog renders closed and is opened by a trigger addressing its id. Closing it does nothing at all — no save, no discard, no confirmation: the draft is already stored, and the next edit resumes it.

### Save States

One attribute, `data-wx-state`, on the indicator; the text comes from `webexpress.webui.I18N.translate`, with `{0}` filled by the local time of the last write.

| State         | Means
|---------------|------------------------------------------------
| `idle`        | nothing unsaved, no draft
| `draft`       | opened on an existing unpublished draft
| `pending`     | a change is queued
| `saving`      | a request is in flight
| `saved`       | stored, with the time
| `error`       | the write failed; the next change retries
| `publishing`  | the submit is in flight
| `discarding`  | the draft is being dropped

## Events

All four are dispatched on the host element and bubble.

- **`webexpress.webapp.Event.EDITOR_DRAFT_SAVED`** — after a successful `PUT`. `event.detail` carries `{ values, updated }`.
- **`webexpress.webapp.Event.EDITOR_DRAFT_DISCARDED`** — after a successful `DELETE`.
- **`webexpress.webapp.Event.EDITOR_PUBLISHED`** — after the form reports a successful submit. `event.detail` carries `{ response }`.
- **`webexpress.webapp.Event.EDITOR_STATE`** — on every state change. `event.detail` carries `{ state }`.

```javascript
const indicator = document.querySelector(".wx-editor-form-state");

indicator.addEventListener(webexpress.webapp.Event.EDITOR_DRAFT_SAVED, (e) => {
    console.log("draft stored at", e.detail.updated);
});
```

## Programmatic Control

The instance is retrievable through the framework registry:

```javascript
const indicator = document.querySelector(".wx-editor-form-state");
const ctrl = webexpress.webui.Controller.getInstanceByElement(indicator);

// what the indicator is showing
console.log(ctrl.state);

// write the current text as the draft now, without waiting for the debounce
await ctrl.save();

// drop the draft and return the surface to the published text
await ctrl.discard();
```

`destroy()` removes every listener and clears the pending timer. The page-level listeners additionally take themselves off when the host has left the document: the modal marks the footer it lifts onto the dialog bar as intentionally detached, and the controller registry skips a detached subtree when it tears an element down, so a controller living on that bar can outlive its dialog.

## Use Case Examples

The control is authored in C#; the markup below is what it renders, and what the controller expects to find.

```html
<form id="editor_form" class="wx-webapp-restform" method="PUT" data-method="PUT" data-mode="edit">
    <wx-service hidden name="data" kind="rest" base-uri="/api/1/documents"></wx-service>
    <wx-service hidden name="draft" kind="rest" base-uri="/api/1/drafts" method="GET" update-method="PUT"></wx-service>

    <div id="editor" class="wx-webui-modal wx-editor-form" role="dialog"
         data-size="modal-fullscreen" data-scrollable="false">

        <div class="wx-modal-header wx-editor-form-header">
            <input name="Title" type="text" class="wx-editor-form-title-input form-control">
        </div>

        <div class="wx-modal-content wx-editor-form-content">
            <main>
                <div class="wx-webui-editor form-control" name="Body" data-fill="true"></div>
            </main>
        </div>

        <div class="wx-modal-footer wx-editor-form-footer">
            <div id="editor_state"
                 class="wx-webapp-editor-form wx-editor-form-state"
                 data-wx-state="idle"
                 data-wx-debounce="900"
                 data-wx-max-delay="5000"
                 data-wx-menu="editor_menu"
                 data-wx-discard="editor_discard">No unsaved changes</div>
            <div id="editor_presence" class="wx-editor-form-presence"></div>
            <div id="editor_menu" class="wx-webui-dropdown wx-editor-form-menu wx-editor-form-menu-empty">
                <div id="editor_discard" class="wx-dropdown-item">Discard</div>
            </div>
            <div><button type="submit" class="btn btn-success">Publish</button></div>
        </div>
    </div>
</form>
```

Three placements are load-bearing, and each costs a debugging cycle when it moves:

- **The dialog is inside the form, not around it.** The form keeps the submit, the fields and the islands; the dialog is only how they are presented. Wrapping the other way round would take the fields out of the form that submits them.
- **The islands stay direct children of the form.** `ServiceRegistry.fromElement` reads them from the form's own children rather than from its descendants, and `ModalCtrl` moves everything it recognizes out of where it was authored.
- **The controller's marker sits on a child, never on the form.** A form served into a remote dialog has its `className` filtered down to `wx`-prefixed classes by `ModalFormCtrl`; a marker on a child element is untouched either way.

## Authoring in C\#

```csharp
new ModalDataEditor("editor")
    .DataService<DocumentRestApi>()
    .DraftService<DocumentDraftRestApi>();
```

The dialog renders closed. A trigger opens it by addressing its id — the control id is the dialog's, and the form's is derived from it:

```csharp
new ControlButton("edit")
{
    Text = _ => "Edit",
    PrimaryAction = _ => new ActionModal("editor")
};
```

A page that *is* the editor has nothing to be triggered from and sets `Show = _ => true` instead.

Drafting is optional in two ways, and both lead to the same surface: an ordinary edit dialog with no autosave, no state indicator, no overflow menu, and a submit that reads *Save* beside the dialog's *Close*.

```csharp
// no draft endpoint declared at all
new ModalDataEditor("editor")
    .DataService<DocumentRestApi>();

// both endpoints declared, but this request may not hold an unpublished version
new ModalDataEditor("editor")
    {
        // whatever the host's own authorisation says about holding an unpublished version
        Draft = renderContext => permissionManager.MayDraft(renderContext.Request)
    }
    .DataService<DocumentRestApi>()
    .DraftService<DocumentDraftRestApi>();
```

`Draft` is a resolver rather than a fixed value for the second case: whether a draft may exist is often a question about the request. It is kept apart from the endpoint declaration so that turning drafting off does not mean withdrawing the endpoint — the host declares its two endpoints once and decides per request which of the two meanings of save the surface offers. Everything the draft brings with it hangs off that one answer, so a surface can never be half-drafting.

Sharing is independent of it: a document that does not draft still shows who else is in it.

Turning `ShowState` off hides the indicator rather than dropping it — it is the host of this controller, so dropping it would drop the autosave with it. What "no state" means is a quiet bar, not a form that loses what was written.
