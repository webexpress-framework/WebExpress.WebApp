![WebExpress](https://raw.githubusercontent.com/webexpress-framework/.github/main/docs/assets/img/banner.png)

# RelationEditorCtrl

The `RelationEditorCtrl` component administers the **relation types** a class may hold: how a relation reads from either end, which classes it accepts as a target, how often it may meet at each end, what it does to the workflow, how heavily it is already used and whether it may still be used at all.

It is the administrative half of the hybrid link system. What is defined here is immediately available everywhere — the [`RelationViewCtrl`](relation.view.md) groups by it and the add dialog offers it — because both read the same registry this endpoint writes.

```
   ┌───────────────────────────────────────────────────────────────────────────────────┐
   │ LINK TYPES OF CLASS Bug     7 active · 8 defined                    [ + New type ] │
   ├──┬ RELATION ──────────┬ TARGET TYPE ─────┬ CARDINALITY ┬ EFFECT ─────┬ USAGE ┬ ACT ┤
   │⣿ │ → blocks           │ Change  Task     │ n:n         │ Blocks      │  34   │ ▣   │
   │  │ ← is blocked by    │ Project          │             │ completion  │       │     │
   │⣿ │ → causes           │ Bug  Change      │ 1:n         │ —           │  21   │ ▣   │
   │  │ ← is caused by     │                  │             │             │       │     │
   │⣿ │ → similar to       │ Bug  Request     │ n:n         │ —           │  12   │ ▣   │
   │  │ ← similar to  ⟲    │                  │             │             │       │     │
   │⣿ │ → replaces         │ Document         │ 1:1         │ —           │   0   │ ▢   │
   │  │ ← is replaced by   │                  │             │             │       │     │
   └──┴────────────────────┴──────────────────┴─────────────┴─────────────┴───────┴─────┘
```

## What a relation type carries

The columns are named for what they hold rather than for how they are built: **Relation** (the abstract definition of the relation - name and direction), **Target type** (the type of the target object, optional), **Cardinality**, **Effect** (its functional meaning, optional), **Usage** (the number of instances of this relation type) and **Active**.

| Field           | Meaning
|-----------------|-------------------------------------------------------------------------------------------
| `label`         | How the relation reads on the item the link is created from — *blocks*.
| `inverse`       | How the same link reads on the other end — *is blocked by*.
| `symmetric`     | Both sides named alike (*similar to*). The counterpart then follows the label and cannot drift away from it.
| `targetClasses` | The classes a target may have. Empty means *all classes*.
| `cardinality`   | `1:1`, `1:n`, `n:1`, `n:n` — how many links may meet at each end.
| `effect`        | `none`, `blocksCompletion`, `closesItem`, `aggregatesProgress` — what the relation does to the workflow of its source.
| `active`        | Whether the relation may still be used. A deactivated relation keeps rendering its links but is no longer offered.
| `usage`         | How many stored links carry it — the number an administrator judges a change by.
| `builtin`       | Whether the relation is shipped by code rather than defined here. A shipped relation is edited and deactivated, never dropped.

### Cardinality, precisely

|          | max per source | max per target | example
|----------|----------------|----------------|---------------------------------------
| `1:1`    | 1              | 1              | a document replaces exactly one predecessor
| `1:n`    | unlimited      | 1              | a parent aggregates many children, each child has one parent
| `n:1`    | 1              | unlimited      | many duplicates point at one original
| `n:n`    | unlimited      | unlimited      | a plain reference

## Declarative Configuration

The control is bootstrapped from a host element carrying the `wx-webapp-relation-editor` CSS class. Author it in C# with `ControlDataRelationEditor`:

```csharp
new ControlDataRelationEditor("link-types")
{
    Class = _ => "Bug",
    Sample = _ => "BUG-00123"
}
    .DataService<RelationTypeRestApi>();
```

### Container Element Attributes

| Attribute        | Description                                                                                        | Example
|------------------|----------------------------------------------------------------------------------------------------|--------------------------
| `data-class`     | The class whose relations are administered. Narrows the table and names the caption.                | `data-class="Bug"`
| `data-sample`    | The example key the editor previews with. Falls back to the class name.                            | `data-sample="BUG-00123"`
| `data-readonly`  | When `"true"`, the define affordance, the editor, the reordering and the toggle are suppressed.     | `data-readonly="true"`

### REST Contract

| Method   | URL                        | Body                       | Response             | Purpose
|----------|----------------------------|----------------------------|----------------------|----------------------------
| `GET`    | `{data}?q=&class=&system=` | —                          | `RelationTypeResult`     | Load the catalog.
| `POST`   | `{data}`                   | `RelationTypePayload`          | `RelationType`           | Define a relation.
| `POST`   | `{data}/order`             | `{ "ids": ["b","a","c"] }` | `204 No Content`     | Rearrange the relations.
| `PUT`    | `{data}/{id}`              | `RelationTypePayload`          | `RelationType`           | Change a relation.
| `DELETE` | `{data}/{id}`              | —                          | `204 No Content`     | Drop an unused relation.

`RelationTypeResult`:

```json
{
  "items": [ /* RelationType */ ],
  "total": 8,
  "active": 7,
  "classes": [ { "id": "Bug", "label": "Bug" }, { "id": "Change", "label": "Change" } ]
}
```

The two counts are answered next to the items rather than derived from them, so the caption stays correct while the table is filtered. `classes` is the catalog the editor renders its class checkboxes from — only the application knows which classes it holds.

A refused definition is answered as `400` with `{ "code": "relation.type.duplicate", "message": "…" }`.

## The editor

Clicking a row (or `+ New type`) opens the framework sidebar modal, `webexpress.webui.ModalSidebarPanelCtrl`, at size `modal-lg`. The editor itself is a **page** of that modal, registered through `webexpress.webui.DialogPanels` under the key `webexpress.webapp.relation.editor` — the same mechanism the add dialog of the [`RelationViewCtrl`](relation.view.md) uses. A single page puts the modal into its single pane mode, so it renders as the plain framework dialog, with the framework submit button and the framework validation.

It asks for the one thing a relation really is — a fact told from two sides — so both labels sit next to each other, and the **preview** at the bottom reads the relation back from either end:

```
   BUG-00123   blocks         any item · e.g. CHG-00045
   any item · e.g. CHG-00045  is blocked by   BUG-00123
```

Below the preview the page reports how many stored links the change affects, because narrowing the accepted classes or the cardinality of a relation that is already in use is a different decision from defining a fresh one.

`validate` returning a string is the framework's signal to keep the dialog open and show the message, so an incomplete definition never reaches the server. The framework submit is synchronous and closes the dialog, so a rejection only the server can see — a colliding id, an unknown system — is reported as a popup notification carrying the server's `code`.

Ticking **symmetric** disables the counterpart field and mirrors the label into it; ticking **all classes** clears the individual class picks, because the two statements cannot both hold.

## Reordering

The drag handle rearranges the relations. The whole resulting order travels in one `POST {data}/order` rather than a single moved id, because a drag changes the position of every relation below it — and the table shows the new order immediately, so the request carries exactly what the user sees. The order is a property of the type, so the link surface groups by it as well.

## Removal is guarded

A relation that still carries links cannot be dropped — it is deactivated instead, which keeps the meaning of the stored links intact. The row of a shipped (`builtin`) relation or one with `usage > 0` therefore offers no delete, and the endpoint refuses the request with `link.type.in.use` even when it is issued directly.

## Programmatic Control

```javascript
const element = document.querySelector(".wx-webapp-relation-editor");
const ctrl = webexpress.webui.Controller.getInstanceByElement(element);

console.log(ctrl.value);       // the administered relations
```

## Events

All events bubble from the host element.

- **`webexpress.webapp.Event.RELATION_TYPE_SAVED_EVENT`** — `{ type }` after a relation was defined or changed.
- **`webexpress.webapp.Event.RELATION_TYPE_REMOVED_EVENT`** — `{ id }` after a relation was dropped.
- **`webexpress.webapp.Event.RELATION_TYPE_REORDERED_EVENT`** — `{ ids }` after the relations were rearranged.

## Server side

The endpoint derives from `WebExpress.WebApp.WebRestApi.RestApiRelationType`. Storing a definition goes through the same door a plugin uses — `RelationRegistry.RegisterType` — so a relation an administrator invents and one a plugin ships are indistinguishable to every surface that reads them:

```csharp
public sealed class RelationTypeRestApi : RestApiRelationType
{
    protected override IEnumerable<IRelationType> RetrieveTypes(IRequest request)
        => RelationRegistry.Types;

    protected override IRelationType StoreType(RelationType type, IRequest request)
    {
        _store.Save(type);                       // persist the definition
        return RelationRegistry.RegisterType(type);  // publish it
    }

    protected override int RetrieveUsage(string id, IRequest request)
        => _links.Count(x => x.Type == id);

    protected override bool IsBuiltin(IRelationType type, IRequest request)
        => _store.IsShipped(type.Id);
}
```

See also: [`RelationViewCtrl`](relation.view.md).
