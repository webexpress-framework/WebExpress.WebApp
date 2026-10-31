![WebExpress](https://raw.githubusercontent.com/webexpress-framework/.github/main/docs/assets/img/banner.png)

# Real-time collaboration

Several users can edit the same document at the same time — a rich text document in the
WYSIWYG editor, a graph in the graph editor or a query in the WQL prompt — without changes
getting lost or overwriting each other. The procedure is **operational transformation (OT)**
with the server as the binding **sequencer**. `ControlCollaborative` coordinates the
collaboration; the controls stay responsible for editing their documents. Collaboration is
optional: a control outside a collaborative container behaves exactly as before.

```
 ┌─ browser A ───────────────────────────┐          ┌─ server ──────────────────────────┐
 │ EditorCtrl ── steps ──▶ Collaborative-│  submit  │ CollaborativeDocumentManager       │
 │   ▲  model + schema      Document     │ ───────▶ │  · checks token, version, schema   │
 │   │                     (confirmed,   │   ack    │  · assigns the next version        │
 │   └── remote steps ◀── in transit,    │ ◀─────── │  · stores, snapshots, trims        │
 │                          buffered)    │  ops     │  · distributes to all members      │
 └───────────────────────────────────────┘ ◀─────── └────────────────────────────────────┘
          transformation only here                     never transforms (rebase principle)
```

## The document model

The model is the single source of truth; the DOM is rendered from it and never read as state.
Input is captured in `beforeinput` and translated into model actions. IME compositions,
autocorrect and spelling suggestions, where browsers change the DOM on their own, are taken back
into the model in a controlled way: the committed composition text is reduced against the range
the composition started on, and remote changes that arrive during a composition wait until it
ends. There is no second, parallel model: the collaboration works on the editor's own model.

The model is described by a **schema** (`EditorModel.SCHEMA`) that defines which nodes may hold
which children and attributes:

| Node | Content |
|------|---------|
| `doc` | one or more `row` |
| `row` | one or more `region` |
| `region`, `blockquote`, `li`, `td`, `th`, content container `addon` | one or more blocks |
| `p`, `h1`–`h6`, `pre` | inline content |
| `ul`, `ol` | one or more `li` |
| `table` | `thead`, `tbody`, `tfoot` |
| `thead`, `tbody`, `tfoot` | `tr` |
| `tr` | `td`, `th` |

Blocks are text blocks, `ul`, `ol`, `blockquote`, `table`, `hr` and add-ons that are not
inline. Inline content is text, `image`, `atom` (instruction, mention, date), `br` and inline
add-ons. Every attribute and mark must already be in the form the sanitizer produces, which keeps
unsafe addresses and styles out of a document that arrives as operations. `EditorModel.check`
verifies a document without changing it; `normalize` produces exactly this shape.

### Positions

For addressing, the hierarchical document is **linearized**: every character, the opening and
the closing of every structured node and every atomic node (image, atom, line break, rule, add-on
without editable content) occupy one position. Positions in paragraphs, lists, tables and inline
elements are therefore plain integers and the structure is not lost:

```
row  region  p  a  ␣  b  /p  ul  li  p  c   /p  /li  /ul  /region  /row
 0     1     2  3  4  5  6   7   8   9  10  11  12   13     14      15
```

The caret at the end of the first paragraph is position 6, right before its closing token;
position 7 lies between the paragraph and the list and resolves to the next text position.

Characters count UTF-16 code units, like JavaScript strings and the editor's caret positions.
The editor keeps its caret positions for editing and converts at the collaboration boundary
(`EditorModel.toLinear` / `fromLinear`).

## Primitives

Only three kinds of primitive steps exist (`webexpress.webui.Ot`):

| Step | Fields | Covers |
|------|--------|--------|
| `replace` | `from`, `to`, `slice` | insertion, deletion and every structural change; the slice is a structured token sequence |
| `addMark` / `removeMark` | `from`, `to`, `name`, `value` | formatting, links, comment anchors |
| `setAttr` | `pos`, `id`, `key`, `value` | node attributes: cell backgrounds, image sizes, list starts, graph coordinates |

Complex edits are sequences of these primitives — a table row, an indented list item or an
inserted add-on is not an operation type of its own. The controls compute the steps of a change
by comparing the model before and after it; the comparison matches nodes by identity, so moving a
list item or wrapping a paragraph touches only the tokens that actually changed, and text a
concurrent user types into the moved content survives. Add-ons and plugins therefore never bring
transformation rules of their own; they edit the model, and the model change becomes primitives.

Applied steps are **invertible**: `apply` records the removed content of a replacement and the
previous values of marks and attributes. Steps are executed deterministically and travel as JSON:

```json
{ "type": "replace", "from": 4, "to": 4, "slice": [{ "t": "s", "v": "hello", "m": { "bold": true } }] }
{ "type": "addMark", "from": 3, "to": 8, "name": "color", "value": "#cc0000" }
{ "type": "setAttr", "pos": 12, "id": "n17-k3x9qa", "key": "background", "value": "#eeeeee" }
```

Tokens: `{ t: "s", v, m }` a run of characters with marks, `{ t: "o", n, id, a }` an opening,
`{ t: "e", n, id }` a closing, `{ t: "l", n, id, a }` an atomic leaf.

### Operations

An **operation** groups the steps of one transmission and carries their identity: a unique id,
the id of the client, the client's running sequence number and the document version it is based
on (`{ id, client, seq, base, steps }`). The server adds the version it assigned.

## Transformation

`Ot.transform(a, b, aFirst)` transforms two concurrent step sequences against each other so that
either can be applied after the other with the same result. A replacement is split into a
deletion and an insertion, which reduces every pair of primitives to a small fixed rule set:

- Two insertions at the same position are ordered by a fixed order: the client id that sorts
  first goes first, on every client alike.
- An insertion inside a range another user deletes survives at the start of the deletion:
  nobody intended to delete new text. The deletion is split around it.
- Overlapping deletions remove the union exactly once.
- Formatting does not extend to text another user inserts inside the formatted range; the new
  text keeps the marks it was typed with.
- Conflicting formatting of the same mark (or of exclusive marks such as subscript and
  superscript) is decided by the fixed order on the overlap only.
- An attribute change on a node another user deleted is dropped; two changes of the same
  attribute are decided by the fixed order.

Randomized tests apply thousands of concurrent sequences in both orders and require identical
results (`ot.test.mjs`).

## Conflict rules

After every transformation the result is checked against the schema. When a concurrent
structural change would leave an invalid document, the client repairs it by the following
documented rules before it sends anything (`EditorModel.repairTokens`, `OtSchema.repairGraph`,
`OtSchema.repairText`):

| Element | Situation | Rule |
|---------|-----------|------|
| Paragraphs | Text typed into a range another user deleted, now outside any block | wrapped into a new paragraph |
| Paragraphs | Two users split the same paragraph at the same place | both splits take effect |
| Nested lists | An item moved by indent or outdent while another user types into it | the item moves with the new text |
| Nested lists | A list loses its last item through concurrent deletions | the empty list receives an empty item, or goes with its parent |
| Lists, tables | An item, row or cell left outside its parent | the wrapper is dropped, the content kept |
| Tables | A row or column inserted while another user types into a cell | both take effect |
| Tables | A table deleted while another user types into a cell | the typed text survives as a paragraph |
| Tables | A cell background set on a column another user deleted | the change is dropped |
| Inline elements | Formatting and typing inside the same range | the typed text keeps its own marks |
| Images | An image resized while another user removes it | the image stays removed |
| Content containers | A container removed while another user types into it | the typed text survives as a paragraph in the region |
| Comments | A comment anchor whose text another user partly deletes | the anchor shrinks to the remaining text |
| Graphs | An edge drawn to a node another user deleted | the edge is dropped |
| Any | Two nodes with the same id after concurrent moves | the later one receives a new id |

If nothing valid can be made of the pending changes, they are not dropped silently: the client
shows the shared version and offers the local one in a notice (`COLLABORATIVE_CONFLICT`); the
user can take it over as a new change. The scenario tests (`collaborative.scenarios.test.mjs`)
cover each rule.

### Comments and mentions

Comment anchors are marks and mentions are inline nodes, so both are transformed with the text
around them. With a comment store (`EditorCtrl.commentStore`, provided by `CommentCtrl.anchorStore`
through `ControlCollaborative.Comments`) the document holds only the anchor id; the comment
itself — text, author, replies, reactions — stays in the backend of `CommentCtrl`, which links it
to the anchor by the label `anchor:{id}`.

## Server

The server works by the **rebase principle** and never transforms; the transformation logic
exists exactly once, in JavaScript, so it cannot diverge from a second implementation. The server
(`CollaborativeDocumentManager`) only

1. checks the access token of the page and the optional `ICollaborativeAccessPolicy`,
2. accepts an operation only on the current version — otherwise it rejects it together with the
   operations the client missed,
3. applies the steps (`OtDocument`) and validates the result against the schema of the document
   kind (`RichTextSchema`, `PlainTextSchema`, `GraphSchema`), so a manipulated client can inject
   neither invalid structures nor arbitrary HTML,
4. assigns the next version, stores the operation and distributes it to all members.

A repeated message is recognized by client id and sequence number and answered with the
acknowledgement it got the first time, without being applied again. A client id is bound to a
secret on first use, so nobody can claim another client's operations. The processing of a
document is atomic: within an instance by a gate per document, across the instances of a cluster
additionally by a cluster-wide lock per document, so exactly one place sequences a document at
any time; accepted operations reach the members on other instances over the cluster bus.

The apply and the schemas mirror the client exactly, including JavaScript's whitespace and
character classes. A fixture the client generates (`JsTest/collaborative.fixture.json`) is
replayed by the server tests, so both sides agree on every document and step they judge.

### Persistence

Document state, snapshots at regular intervals and the operation history are stored through the
exchangeable `ICollaborativeDocumentStore`: in memory by default, in the cluster store while
instances share one, or in an application's own database. The history is trimmed only as far as
no client may still need it for a resumption: never the operations after the last snapshot, never
the most recent ones and never those a client seen within the retention period has not yet
received.

| Setting | Default | Purpose |
|---------|---------|---------|
| `Store` | memory, or cluster store | persistence of documents |
| `SnapshotInterval` | 100 | operations between snapshots |
| `Retention` | 1 hour | how long a disconnected client may resume from the history |
| `AccessPolicy` | none | permission checks beyond the page's token |
| `Provider` | none | initial content of documents (otherwise the first writer seeds them) |
| `RegisterSchema` | richtext, text, graph | further document kinds |

```csharp
var documents = messageQueueManager.CollaborativeDocuments;
documents.Store = new MyDatabaseDocumentStore();
documents.AccessPolicy = new TicketAccessPolicy();
documents.Retention = TimeSpan.FromHours(4);
```

## Client

`webexpress.webapp.CollaborativeDocument` manages the unconfirmed operations of one shared
control. Local changes are shown at once, without waiting for the network. At most one operation
is in transit; further local changes are buffered behind it. Incoming operations of other users
are transformed against the operation in transit and the buffer and then applied; they pass
through the document model but are neither sent again nor recorded in the local undo history.

When the connection breaks, transmission pauses and local changes keep collecting. On
reconnection the client reports its last confirmed version and receives the operations since. If
the server no longer holds that history, or the local state cannot be reconstructed reliably, the
client resynchronizes with the server's state: its pending changes are rebased onto it as far as
possible, and what cannot be merged is offered to the user instead of being dropped.

### Undo and redo

While a document is shared, undo and redo invert operations selectively: a user undoes only the
own edits, and the inverse is transformed against everything that happened since before it is
applied and sent like any other change. A snapshot history would restore whole documents and
overwrite what others wrote. Consecutive typing merges into one undo step until a word boundary
or a pause of a second; consecutive deleting likewise. An undo step whose content another user
removed has become empty and is skipped for the next one. Outside collaboration the snapshot
history stays in use.

### Cursors and selections

Remote cursors and selections travel as model positions together with the version they refer to,
not as DOM coordinates. They are transformed like operation positions with every change and only
then converted to coordinates (`getModelPositionRect`, `getModelRangeRects`), so other users'
cursors stay in place while text is inserted or deleted before them. The visual presentation —
presence chips, pointers, carets and selections — stays with `ControlCollaborative`; the existing
caret messages carry the model selection in the field `model`.

## Protocol

All messages travel through the existing MessageQueue WebSocket. Operation messages share the
prefix `webexpress.webapp.collaborative.ot.` and carry `protocol` (currently `1`) and `document`;
client messages also carry `token`, `client` and `secret`.

| Message | Direction | Fields |
|---------|-----------|--------|
| `join` | client → server | `kind`, `state` (the content offered to seed an unknown document) |
| `resume` | client → server | `version` (the last confirmed version) |
| `submit` | client → server | `operations` |
| `state` | server → client | `version`, `state`, `clients` (the client's own last sequence number) |
| `operations` | server → client | `operations` with versions; `resumed` when answering a resume |
| `ack` | server → client | `version`, `operations` (`id`, `seq`, `version`) |
| `reject` | server → client | `reason` (`version`, `invalid`, `forbidden`, `unknown`, `busy`, `protocol`), `seq`, `version`, `operations` or `state` |

A `reject` with reason `version` lists the operations missed since the operation's base, or the
complete `state` when the history no longer reaches back that far. A client that receives
operations out of order holds the later ones and resumes from its last version.

## Using ControlCollaborative with an editor

```csharp
var collaborative = new ControlCollaborative("ticket-collab",
    new ControlFormItemInputText("body") { Format = _ => TypeEditTextFormat.Wysiwyg })
{
    // everyone editing ticket 42 meets in the same documents, whichever page they came from
    Document = ctx => "ticket-" + ticket.Id,
    ReadOnly = ctx => !ctx.CanEdit(ticket),
    // comment texts stay in the ticket's comment control; the document keeps the anchors
    Comments = _ => "ticket-comments"
};
```

The container renders `data-collaborative-document` (the scope) and `data-collaborative-token`
(signed by the server for exactly that scope and access mode). Every control inside that
implements the collaboration methods — `EditorCtrl`, `GraphEditorCtrl`, `WqlPromptCtrl` — is
shared as the document `scope/element id`. Plain input fields keep being synchronized by value.
Without a scope and token, for example in hand-written markup, the container falls back to the
value synchronization of earlier versions.

### The collaboration interface of a control

A control takes part by implementing these members; WebUI has no dependency on WebApp:

| Member | Purpose |
|--------|---------|
| `collaborationKind` | `"richtext"`, `"text"` or `"graph"` |
| `beginCollaboration({ tag })`, `endCollaboration()` | switches undo to selective mode; `tag` keeps new ids unique across clients |
| `getCollaborationTokens()`, `loadCollaborationTokens(tokens)` | the document as packed tokens |
| `checkCollaborationTokens(tokens)`, `repairCollaborationTokens(tokens)` | the schema and its repair rules |
| `applyRemoteSteps(steps)` | applies another user's steps; returns false when they do not fit |
| `getModelSelection()`, `getModelPositionRect(pos)`, `getModelRangeRects(from, to)` | the selection as model positions and its coordinates |
| event `webexpress.webui.Event.COLLABORATION_STEPS_EVENT` | announces local steps (`detail.steps`) |

## Tests

| Test | What it secures |
|------|-----------------|
| `WebUI/JsTest/ot.test.mjs` | every transformation rule, invertibility, the structural diff, randomized TP1 |
| `WebUI/JsTest/editor.collab.test.mjs` | the editor interface, selective undo, IME, schema and repair |
| `WebUI/JsTest/control.graph-editor.collab.test.mjs` | the graph editor interface and its repair rule |
| `WebApp/JsTest/collaborative.convergence.test.mjs` | randomized convergence of several clients with delayed, reordered, duplicated and dropped messages and broken connections |
| `WebApp/JsTest/collaborative.scenarios.test.mjs` | the conflict rules for paragraphs, lists, tables, images, containers, comments and undo |
| `WebApp/JsTest/control.collaborative.documents.test.mjs` | discovery, routing, carets, conflicts and reconnection of the container |
| `WebApp/JsTest/wql.prompt.collab.test.mjs` | the WQL prompt interface |
| `WebApp.Test/WebCollaboration` | the sequencer, persistence, trimming, access, and the server/client fixture |

The existing editor test suite runs unchanged, which shows that the editor without collaboration
has no functional restriction or regression.
