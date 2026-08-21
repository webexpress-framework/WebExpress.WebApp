![WebExpress](https://raw.githubusercontent.com/webexpress-framework/.github/main/docs/assets/img/banner.png)

# WorkflowEditorCtrl

The `WorkflowEditorCtrl` is a REST-backed editor for workflow definitions - states and the
transitions between them. It extends `webexpress.webui.GraphEditorCtrl`, so the canvas, the
toolbar, selection, undo/redo and the whole keyboard model come from the graph editor and
are documented in [graph.md](../../../WebExpress.WebUI/docs/js/graph.md).

What this control adds on top is the workflow domain: a split layout with an inline
properties panel instead of the graph editor's modal, the rule editors (validations,
guards, post functions) a transition carries, a preflight check over the state machine,
and a debounced autosave against `RestApiWorkflow` with a visible persistence status.

```
   ┌──────────────────────────────────────────────────────────────────┐
   │ ↶ ↷ │ 🗑 │ ⭳ │ ▥ │                        ✓ Saved 14:32          │
   ├──────────────────────────────────────┬───────────────────────────┤
   │                                      │ [＋ New state] [⇄ New tr.]│
   │      ┌────────┐      ┌────────┐      ├───────────────────────────┤
   │      │ Draft  │─────▶│ Review │      │ TRANSITION                │
   │      └────────┘      └────────┘      │ submit                    │
   │                           │          │ Draft → Review            │
   │                           ▼          ├───────────────────────────┤
   │                      ┌────────┐      │ Label      [submit_____]  │
   │                      │  Done  │      │ Source     [Draft     ▾]  │
   │                      └────────┘      │ Pattern    [▬▬][▬ ▬][· ·] │
   │  ┌──────────┐                        │ ┌───────┬────────┬──────┐ │
   │  │ ⤢ ⌖ ＋ − │                        │ │Valid.2│Guards 1│Post 0│ │
   │  └──────────┘                        │ └───────┴────────┴──────┘ │
   └──────────────────────────────────────┴───────────────────────────┘
```

## Declarative Configuration

The host element carries the class `wx-webapp-workflow-editor`; the `ControlDataWorkflow`
C# control sets it, along with the islands below. The graph attributes of the base control
(`data-edge-style`, `data-node-style`, `data-label`) apply as well.

| Attribute            | Description                                                                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data-wx-resource`   | The ViewState resource slice this editor renders. When present the enclosing ViewState owns the load; when absent the editor loads itself.          |
| `data-wx-viewstate`  | The id of the enclosing ViewState. Only relevant together with `data-wx-resource`.                                                                  |

Two islands carry the rest of the configuration, both as direct children of the host:

- a **`<wx-state>` island** holding a `<wx-prop name="id">` with the logical workflow id,
  which rides along as the `id` query parameter on load and save;
- a **`<wx-service>` island** named `data`, whose `base-uri` points at the
  `RestApiWorkflow` endpoint.

Both are read **before** the base constructor runs, because the graph viewer clears the
host while building its canvas.

## Wire Format

A single `GET` returns the whole editing context as a `RestApiWorkflowResult`: the workflow
header, its states and transitions, and the catalogs of guards, validations and post
functions the rule pickers offer. The autosave `PUT` mirrors that shape.

```jsonc
{
  "id": "approval",
  "name": "Approval",
  "version": "7",                  // see Concurrency below
  "states": [
    {
      "id": "draft", "label": "Draft", "x": 40, "y": 120,
      "icon": "pen",        // a CSS class
      "image": "/assets/draft.png",// a URL - never put one into "icon"
      "isStart": true, "isEnd": false,
      "backgroundColor": "#ffffff", "foregroundColor": "#000000",
      "shape": "rect", "layout": "label-inside"
    }
  ],
  "transitions": [
    {
      "id": "t1", "from": "draft", "to": "review", "label": "submit",
      "description": "…", "form": "…",
      "color": "#5bc0de", "dasharray": "", "waypoints": [{ "x": 120, "y": 90 }],
      "guards": [], "validators": [], "postfunctions": []
    }
  ],
  "guards": [], "validations": [], "postfunctions": []   // the catalogs
}
```

The payload also accepts `nodes` / `edges` as aliases for `states` / `transitions`, and
`source` / `target` as aliases for `from` / `to`. The save writes both spellings so a
backend can read either.

`x` and `y` address the **top left corner** of a state, matching the graph editor's model
coordinate space.

### States

`isStart` and `isEnd` are what let the editor reason about the state machine rather than
guess at it. Both are editable in the properties panel and round-trip through the wire
format. `icon` and `image` are distinct: the first is a CSS class rendered as a glyph, the
second a URL rendered as a picture. A URL in `icon` renders nothing.

## Properties Panel

Selecting a state or a transition renders its properties inline in the right pane; with
nothing selected the panel shows the preflight status. The pane is resizable through the
`SplitCtrl` divider and can be collapsed with the toolbar's `▥` button, which hides the
pane **and** the divider; the split state persists across reloads.

An action bar at the top of the pane carries **New state** and **New transition**. Those
are the graph editor's creation actions, moved here from the toolbar: a new state is
created next to the fields that will describe it, and the panel already shows the
properties of whatever is selected, so a separate "edit" button has nothing left to open.
**New transition** is a mode - it stays pressed while the next two clicks on the canvas
pick the source and the target - and the button is the only place that mode is visible.

Deleting sits at the bottom of the properties of the very element it removes, rather than
behind a toolbar icon acting on an invisible selection. The `Delete` key keeps working
throughout.

The toolbar therefore keeps only undo/redo, export and the pane toggle, plus the
persistence status. View actions (fit, centre, zoom) sit in the lower left of the canvas.

## Sizing

The editor has a **definite height**, not one derived from its content. A content-driven
height meant the whole control grew and shrank as the properties panel filled with rule
lists or was collapsed, so the canvas jumped under the pointer on every selection. Each
pane now scrolls inside a stable frame.

The height comes from `--wx-we-host-height`, which defaults to `--wx-we-host-min-height`
(600px). To fill a parent that has a height of its own:

```css
#my-workflow-editor { --wx-we-host-height: 100%; }
```

An inline `height` on the host works too and wins over both.

Colour fields use the framework colour control (`ControlFormItemInputColor` /
`InputColorCtrl`), so the panel offers the same curated palette as every other colour field
in the application.

A transition additionally carries three tabbed rule lists - **Validations**, **Guards** and
**Post functions** - each fed from the catalog in the REST response. Post functions are
ordered and can be moved with ↑ / ↓; the badge on each tab shows how many rules are
configured. The active tab is remembered so picking a rule does not snap the panel back to
the first tab.

## Preflight

The empty-state panel reports the first problem it finds in the model:

| Finding             | Meaning                                                                            |
| ------------------- | ---------------------------------------------------------------------------------- |
| broken reference    | A transition points at a state that does not exist.                                |
| no entry state      | No state is marked `isStart`, so reachability cannot be computed.                  |
| unreachable state   | A state cannot be reached from any entry state.                                     |
| dead end            | A state has no outgoing transition and is not marked `isEnd`.                       |

Reachability is computed from the states marked `isStart`. It is deliberately **not**
computed from an arbitrary state: doing so makes the verdict depend on the order the server
happened to serialize the states in, so the same workflow reports green or red on
alternating loads.

## Persistence

Every mutation schedules a save 500 ms later; a burst of edits collapses into one `PUT`.
The toolbar carries a status indicator that makes the outcome visible, because a silent
autosave cannot be told apart from a failed one:

| State     | Shown                                                          |
| --------- | -------------------------------------------------------------- |
| `dirty`   | Unsaved changes - edits are queued.                            |
| `saving`  | A request is in flight.                                        |
| `saved`   | Confirmed, with the time of the write.                          |
| `error`   | The reason, plus a **Retry** button.                            |

A failed load is reported the same way, with a retry that reloads - previously an empty
canvas was the only symptom.

**Teardown flushes.** `destroy()` pushes a queued save through before dropping the timer.
Single-page navigation routinely lands inside the 500 ms window, and discarding the timer
there loses the last edits without telling anyone. A browser navigation cannot be delayed,
so a `beforeunload` guard warns instead while changes are pending.

### Concurrency

`RestApiWorkflowResult.Version` is a revision the client round-trips. A `PUT` presenting a
stale version is rejected with **409 Conflict** rather than overwriting the newer revision;
the editor then offers to reload the server state instead of retrying the same payload,
because merging two graph revisions automatically is not something it can do safely. A
successful save adopts the version the response returns, so the next save is current.

A backing store that leaves `Version` empty opts out: with nothing to compare there is
nothing to reject, and the editor behaves as before.

## Keyboard Shortcuts

The graph shortcuts (navigate, nudge, connect, waypoints, undo, delete, zoom) are listed in
[graph.md](../../../WebExpress.WebUI/docs/js/graph.md). The workflow editor adds:

| Key                | Action                                                          |
| ------------------ | ---------------------------------------------------------------- |
| `F2`               | Moves the focus into the label field of the selected state.     |
| `Ctrl` + `S`       | Flushes the pending autosave immediately.                        |

`Ctrl` + `S` is scoped to the editor host, so it also works while a properties field has the
focus. Every other shortcut follows the graph editor's ownership rule: a key pressed in a
text field, or in a different editor on the same page, does not reach this one.

## Programmatic Control

### Accessing an Automatically Created Instance

```javascript
// find the host element in the DOM
const host = document.getElementById('myWorkflowEditor');

// retrieve the controller instance associated with the element
const editor = webexpress.webui.Controller.getInstanceByElement(host);

if (editor) {
    // replace the whole definition
    editor.model = {
        nodes: [
            { id: 'draft', label: 'Draft', x: 40, y: 120, isStart: true },
            { id: 'done', label: 'Done', x: 340, y: 120, isEnd: true }
        ],
        edges: [
            { id: 't1', from: 'draft', to: 'done', label: 'approve', guards: [], validators: [], postfunctions: [] }
        ]
    };

    // persist right away instead of waiting for the debounce
    editor._flushSave();
}
```

### Events

The editor emits `webexpress.webui.Event.CHANGE_VALUE_EVENT` after every mutation, with the
current model in `detail.model`. State positions are synchronized into the model before the
event is dispatched.

## Use Case Example

```html
<div id="approval-workflow"
     class="wx-webapp-workflow-editor"
     data-edge-style="smooth"
     data-label="Approval workflow"
     style="height: 640px;">

    <!-- state island: the logical workflow id -->
    <wx-state hidden>
        <wx-prop name="id" type="string">approval</wx-prop>
    </wx-state>

    <!-- service island: the RestApiWorkflow endpoint -->
    <wx-service hidden name="data" kind="rest" base-uri="/api/1/workflow"></wx-service>

</div>
```

The editor loads `GET /api/1/workflow?id=approval`, renders the definition, and autosaves
every change with `PUT /api/1/workflow?id=approval`.
