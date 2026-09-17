![WebExpress](https://raw.githubusercontent.com/webexpress-framework/.github/main/docs/assets/img/banner.png)

# ModalEditorCtrl

The `ModalEditorCtrl` is the dialog a document is written in. It is the client half of `ControlDataModalEditor`, and it is derived from `ModalCtrl`: the editor dialog **is** a modal — with the document's name on its title bar and the writing surface as the whole of its content — that also keeps what is written saved as an unpublished draft, and offers the reading view of it on the footer bar the publish button sits on.

It is the dialog's controller rather than a guest on the form, because everything it does is about the dialog: the save state sits on the dialog's bar, the reading view stands in for the dialog's content, publishing and discarding end with the dialog closing, and abandoning means closing it. The `RestFormCtrl` stays on the form and keeps what is the form's — loading, validating, publishing — and the `EditorCtrl` keeps the text; the dialog reaches both through the registry rather than owning them.

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
   │ [Write|Preview] (MP) Saved · 19:12  [ ⋯ ] [ Publish ] [ Close ]│  // .wx-modal-footer
   └────────────────────────────────────────────────────────────────┘
```

The control **is** the dialog rather than a form somebody else opens as one, because a writing surface is only right at that size: the title belongs on the title bar the dialog needs anyway, and the body has to end exactly where the dialog does. The rendered markup is a `<form>` holding its hidden service islands and one `<dialog>`; the controller lifts the three `.wx-modal-*` sections onto the dialog it builds inside it, and the base appends the fullscreen toggle, the close button and the cancel button last — which is why *switch · presence · state · ⋯ · publish · close* is the reading of the footer bar and why nothing a form contributes can land to the right of them.

## Draft

A rest form is a single transaction: it loads once, it submits once, and everything typed in between exists only in the DOM. For an issue that is right — the form is short and the save is one click away. For a document it is not: the text is the work, a lost tab is a lost afternoon, and the save that matters ("publish") is a decision about readers rather than about storage. A form that only saves on submit therefore loses an afternoon to a closed tab, while a form that saves continuously publishes every unfinished sentence to whoever is reading the page.

So the two are split across the two services the form declares. Every change is written to the **draft** service — no commit, no revision, nothing the readers see — while the submit goes to the **data** service, whose `PUT` applies the text and ends the draft in its own transaction. Leaving without publishing keeps the draft, so the next edit resumes where this one stopped while the reading view still shows the last published text.

The controller **never deletes a draft as part of publishing**. A delete racing a publish that failed would destroy the only copy of the text, so ending the draft is the publish endpoint's job, inside its own transaction.

Drafting is optional: a form that declares no draft service — or whose `Draft` resolver answers false — renders no draft island and no autosave configuration, and the dialog is an ordinary edit form with a submit that reads *Save*.

## Preview

The editor shows its working surface, not the document: add-ons sit in the frame that names and configures them, tables keep their column resizers, and what cannot be typed into is fenced by the empty paragraphs the caret needs. What the readers get is built from the same value by `ContentCtrl` — the same conversion `ControlContent` ships for a page — and an author who wants to see it should not have to publish to find out.

The switch at the left end of the bar is the shared presentation switch (`webexpress.webui.ViewSwitcher`) every surface with several views of one subject uses. Picking *Preview* puts the reading view in the place of the surface, filled from the editor at that moment; picking *Write* takes it away again. The preview is independent of the draft: a document that does not draft still previews.

## Declarative Configuration

The controller is mounted on the **dialog**, which carries the whole configuration as attributes. It reaches the form by walking up to it with `closest("form")` — the dialog is built *inside* the form — and hydrates the draft service from the islands beside it.

### Host Element Attributes

| Attribute              | Description                                                                                                   | Example
|------------------------|---------------------------------------------------------------------------------------------------------------|--------------------------------
| `data-size`, `data-close-label`, `data-scrollable`, `data-auto-show` | The modal's own; see `ModalCtrl`.                                                       |
| `data-wx-preview`      | `true` to offer the reading view. Absent, neither the switch nor the view is built.                            | `data-wx-preview="true"`
| `data-wx-debounce`     | Milliseconds the typing has to rest before a save goes out. Defaults to `900`. Rendered only when drafting.    | `data-wx-debounce="900"`
| `data-wx-max-delay`    | Milliseconds after which a change is written however continuous the typing is. Defaults to `5000`.             | `data-wx-max-delay="5000"`
| `data-wx-show-state`   | `false` builds the save indicator hidden: the state is still tracked and announced, it just says nothing.       | `data-wx-show-state="false"`
| `data-wx-channel`      | The collaboration channel a shared document announces its saves on. Absent, the writes are kept to itself.     | `data-wx-channel="doc-1"`

Nothing about the state itself is rendered: the server cannot know whether an unpublished draft exists — only the draft endpoint can — so the controller opens on "nothing unsaved" and corrects it from the answer of its first request.

### What the server renders on the bar, and what the controller builds

The footer bar reads *switch · presence · state · menu · publish · close*. Only two of those are rendered, because only two have to exist before the dialog's own controller runs:

- **The presence slot** `#{id}_presence`, for a shared document. The collaborative container docks its presence bar into it at mount — and the registry initializes children before their parents, so the slot has to be there before this controller is.
- **The overflow menu** `#{id}_menu` with its discard entry `#{id}_discard`, because it carries entries the host authored. It is rendered hidden (`wx-editor-form-menu-empty`) and revealed once the draft endpoint has answered that there is something to discard. The controller finds both by the ids derived from the dialog's own, which is the one thing about them a dropdown rebuild leaves standing.

The controller builds the rest: the switch ahead of the slot, the save indicator (`.wx-editor-form-state`) between the slot and the menu, and the reading view (`.wx-webui-content.wx-editor-form-preview`) beside the surface in the content box — through the registry, so it is the same content control a page renders.

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
- **Rich text.** The editor moves the field name off its host onto a hidden `<input>` it creates inside it and reports the change with `webexpress.webui.change.value`, which bubbles — so one listener on the form covers the editor however deeply it nests.
- **Leaving the page.** `pagehide` and a `visibilitychange` to hidden flush a pending save with `keepalive: true`, so a tab closed mid-sentence still lands.
- **Publish.** The submit goes to the record service through the `RestFormCtrl`. The pending autosave is cancelled first — it would otherwise land after the publication and re-open the draft. The dialog then **closes**: the decision it was opened for has been taken. Closing is done here rather than left to the form controller, which only closes when the endpoint's answer happens to say so.
- **Discard.** `DELETE` on the draft service, then the form's own `load()`, then the dialog **closes**. The reload happens even though the dialog is going away, because the dialog is not rebuilt when it is opened again — without it the next open would show the text that was just thrown away. The page is deliberately **not** reloaded: a framework control does not get to navigate its host.
- **Abandoning.** Closing the dialog by hand does nothing to the draft — no save, no discard, no confirmation: it is already stored, and the next edit resumes it.
- **Presence.** A shared document docks the `CollaborativeCtrl` presence chips onto the footer bar through `data-collaborative-presence-host`, so who else is in the document reads beside the save state instead of floating over the first line of what is being written. Because that control joins its channel when the dialog opens and leaves when it closes, the people shown are the ones who have the document **open** — not everybody who happens to have loaded the page it can be opened from.
- **Preview swap.** Picking *Preview* fills the reading view from the editor's value and swaps the `hidden` attribute between the view and the surface — the `<main>` section, or the collaborative container around it, whichever is the one thing in the content box. The view is revealed before it is filled, because the add-ons it brings to life measure themselves. Picking *Write* swaps back without touching the editor.
- **Following the text.** While the reading view is showing, every `webexpress.webui.change.value` the form sees rebuilds it — the peers of a shared document keep typing, and a form that re-loads after a discard replaces the text. Under the surface nothing is rendered into a view nobody sees.
- **Closing returns to writing.** Whoever comes back to a document comes to write, and a reading view left open would greet them with a text they cannot type into.
- **Fill contract.** The reading view carries `data-fill="true"` like the editor, so it ends where the dialog does and scrolls inside itself.

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

All are dispatched on the dialog and bubble, beside the modal's own `MODAL_SHOW_EVENT` and `MODAL_HIDE_EVENT`.

- **`webexpress.webapp.Event.EDITOR_DRAFT_SAVED`** — after a successful `PUT`. `event.detail` carries `{ values, updated }`.
- **`webexpress.webapp.Event.EDITOR_DRAFT_DISCARDED`** — after a successful `DELETE`.
- **`webexpress.webapp.Event.EDITOR_PUBLISHED`** — after the form reports a successful submit. `event.detail` carries `{ response }`.
- **`webexpress.webapp.Event.EDITOR_STATE`** — on every state change. `event.detail` carries `{ state }`.
- **`webexpress.webui.Event.CHANGE_VISIBILITY_EVENT`** — once per view change. `event.detail` carries `{ view }`, one of `write`, `preview`.

```javascript
const dialog = document.getElementById("editor");

dialog.addEventListener(webexpress.webapp.Event.EDITOR_DRAFT_SAVED, (e) => {
    console.log("draft stored at", e.detail.updated);
});
```

## Programmatic Control

The instance is retrievable through the framework registry, and is a `ModalCtrl`:

```javascript
const dialog = document.getElementById("editor");
const ctrl = webexpress.webui.Controller.getInstanceByElement(dialog);

// the modal's own
ctrl.show();
ctrl.hide();

// what the indicator is showing
console.log(ctrl.state);

// write the current text as the draft now, without waiting for the debounce
await ctrl.save();

// drop the draft and return the surface to the published text
await ctrl.discard();

// which presentation is showing, and switching it
console.log(ctrl.view);
ctrl.view = "preview";

// rebuild a showing reading view from the editor
ctrl.refresh();
```

`destroy()` removes every listener and clears the pending timer.

## Use Case Examples

The control is authored in C#; the markup below is what it renders, and what the controller expects to find.

```html
<form id="editor_form" class="wx-webapp-restform" method="PUT" data-method="PUT" data-mode="edit">
    <wx-service hidden name="data" kind="rest" base-uri="/api/1/documents"></wx-service>
    <wx-service hidden name="draft" kind="rest" base-uri="/api/1/drafts" method="GET" update-method="PUT"></wx-service>

    <dialog id="editor" class="wx-webapp-modal-editor wx-editor-form" role="dialog"
            data-size="modal-fullscreen" data-scrollable="false"
            data-wx-preview="true"
            data-wx-debounce="900" data-wx-max-delay="5000">

        <div class="wx-modal-header wx-editor-form-header">
            <input name="Title" type="text" class="wx-editor-form-title-input form-control">
        </div>

        <div class="wx-modal-content wx-editor-form-content">
            <main>
                <div class="wx-webui-editor form-control" name="Body" data-fill="true"></div>
            </main>
        </div>

        <div class="wx-modal-footer wx-editor-form-footer">
            <div id="editor_presence" class="wx-editor-form-presence"></div>
            <div id="editor_menu" class="wx-webui-dropdown wx-editor-form-menu wx-editor-form-menu-empty">
                <div id="editor_discard" class="wx-dropdown-item">Discard</div>
            </div>
            <div><button type="submit" class="btn btn-success">Publish</button></div>
        </div>
    </dialog>
</form>
```

Three placements are load-bearing, and each costs a debugging cycle when it moves:

- **The dialog is inside the form, not around it.** The form keeps the submit, the fields and the islands; the dialog is only how they are presented. Wrapping the other way round would take the fields out of the form that submits them.
- **The islands stay direct children of the form.** `ServiceRegistry.fromElement` reads them from the form's own children rather than from its descendants, and the controller moves everything it recognizes out of where it was authored.
- **The content box holds the surface and nothing else.** The controller takes the box's only child — `<main>`, or the collaborative container around it — as the thing the reading view stands in for, and places the view beside it. A second child would be hidden along with the surface.

## Authoring in C\#

```csharp
new ControlDataModalEditor("editor")
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
new ControlDataModalEditor("editor")
    .DataService<DocumentRestApi>();

// both endpoints declared, but this request may not hold an unpublished version
new ControlDataModalEditor("editor")
    {
        // whatever the host's own authorisation says about holding an unpublished version
        Draft = renderContext => permissionManager.MayDraft(renderContext.Request)
    }
    .DataService<DocumentRestApi>()
    .DraftService<DocumentDraftRestApi>();
```

`Draft` is a resolver rather than a fixed value for the second case: whether a draft may exist is often a question about the request. It is kept apart from the endpoint declaration so that turning drafting off does not mean withdrawing the endpoint — the host declares its two endpoints once and decides per request which of the two meanings of save the surface offers. Everything the draft brings with it hangs off that one answer, so a surface can never be half-drafting.

Sharing is independent of it: a document that does not draft still shows who else is in it.

Turning `ShowState` off asks for a quiet bar: the controller builds its indicator hidden rather than leaving it out, so the state is still tracked and announced.

The reading view is on by default and independent of both. `Preview = _ => false` withdraws the offer, and the controller builds neither the switch nor the view.
