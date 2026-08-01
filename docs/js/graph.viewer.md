![WebExpress](https://raw.githubusercontent.com/webexpress-framework/.github/main/docs/assets/img/banner.png)

# GraphViewerCtrl

The `webexpress.webapp.GraphViewerCtrl` renders a network graph — nodes and the edges between them — from a REST endpoint. It extends the WebUI [`GraphViewerCtrl`](../../../WebExpress.WebUI/docs/js/graph.md) with the data path: instead of reading its model from DOM children, it loads the nodes and edges with a single `GET`, while the pan, zoom, drag, layout simulation, view controls and accessibility behaviour stay those of the base control.

The viewer is **read-only**: it never writes back. A graph that is also authored belongs in the workflow editor, which owns the editing surface and the write path.

```
   ┌──────────────────────────────────────────────────────────────┐
   │                        ┌────────────┐                        │
   │            ┌──────────►│  [Icon]    │                        │
   │            │  HTTPS    │  Node B    │                        │
   │      ┌─────┴──────┐    └─────┬──────┘                        │
   │      │  Node A    │          │ replicates                    │
   │      └─────┬──────┘          ▼                               │
   │            │            ┌────────────┐                       │
   │            └───────────►│  Node C    │                       │
   │                reads    └────────────┘                       │
   │  ⊕ ⊖ ⤢ ⌖                                                     │
   └──────────────────────────────────────────────────────────────┘
```

## Declarative Configuration

The control is bootstrapped from a single host element carrying the `wx-webapp-graph-viewer` CSS class. The endpoint is authored in C# through a `wx-service` island named `data`; the client resolves it, loads the graph and renders it into an SVG canvas that replaces the host's content.

### Container Element Attributes

The attributes are the ones of the base viewer, because the data path changes where the model comes from, not how it is drawn.

| Attribute              | Description                                                                                                                            | Example
|------------------------|----------------------------------------------------------------------------------------------------------------------------------------|------------------------------
| `data-node-style`      | Default layout for nodes that carry no layout of their own. `label-below` places the text under the icon or shape.                      | `data-node-style="label-below"`
| `data-edge-style`      | Routing of the edges: rounded corners (default), `straight` (sharp corners) or `smooth` (bezier).                                       | `data-edge-style="smooth"`
| `data-physics-enabled` | Set to `false` to switch the layout simulation off. It is on otherwise and places the nodes that arrive without coordinates.            | `data-physics-enabled="false"`
| `data-grid`            | Optional background grid. A number sets the cell size; omitting it leaves the grid off.                                                 | `data-grid="20"`
| `data-grid-snap`       | Set to `true` to snap dragged nodes to the grid. Requires `data-grid`.                                                                  | `data-grid-snap="true"`
| `data-label`           | Accessible name announced for the canvas.                                                                                              | `data-label="Service topology"`

The data endpoint is not spelled as an attribute. It is contributed in C# by `.DataService<TEndpoint>()` on `ControlDataGraphViewer`, which emits the hidden `wx-service` island the client consumes.

### REST Contract

| Method | URL      | Body | Response       | Purpose
|--------|----------|------|----------------|--------------------------
| `GET`  | `{data}` | —    | `Graph`        | Initial load and refresh.

```json
{
    "nodes": [
        { "id": "web", "label": "Web", "icon": "fas fa-globe", "x": 100, "y": 120, "backgroundColor": "#e0f7fa" },
        { "id": "api", "label": "API", "icon": "fas fa-server", "x": 320, "y": 120 },
        { "id": "db",  "label": "Database", "shape": "circle", "icon": "fas fa-database" }
    ],
    "edges": [
        { "id": "e1", "from": "web", "to": "api", "label": "HTTPS" },
        { "id": "e2", "from": "api", "to": "db", "dasharray": "4,4", "waypoints": [{ "x": 320, "y": 240 }] }
    ]
}
```

#### Node fields

| Field                                     | Description
|-------------------------------------------|-----------------------------------------------------------------------------
| `id`                                      | **Required.** The edges address the nodes by it.
| `label`                                   | Falls back to the `id`, so a node is never unlabelled.
| `x` / `y`                                 | The **top left corner** of the node. Omit **both** to let the layout simulation place it.
| `shape`                                   | `rect` (default) or `circle`.
| `layout`                                  | `label-inside` (default) or `label-below`. Falls back to `data-node-style`.
| `icon`                                    | A CSS class, for example `fas fa-server`.
| `image`                                   | A URL. Not interchangeable with `icon` — see below.
| `uri`                                     | The target the node links to.
| `backgroundColor` / `backgroundCss`       | The node fill, as a literal colour or as a CSS class.
| `foregroundColor` / `foregroundCss`       | The label and icon colour, as a literal colour or as a CSS class.

#### Edge fields

| Field              | Description
|--------------------|-----------------------------------------------------------------------------
| `id`               | The identity of the edge.
| `from` / `to`      | **Required.** The ids of the source and target node.
| `label`            | Drawn in the middle of the edge.
| `color` / `colorCss` | The stroke, as a literal colour or as a CSS class. The arrowhead follows the stroke.
| `dasharray`        | An SVG `stroke-dasharray`, for example `5,5`.
| `waypoints`        | `[{ "x": …, "y": … }]`, either as an array or as a JSON string.

### How the payload is read

The model layer (`webexpress.webapp.graphViewerModel`) is deliberately tolerant, because a graph is usually assembled from two different sources — the entities and the relations between them:

- **Aliases.** `items` is accepted for `nodes`, `links` for `edges` and `source`/`target` for `from`/`to`.
- **Half positions are dropped.** A node with only an `x` would otherwise sit at `y = 0`; instead the position is discarded entirely and the simulation places the node.
- **Dangling edges are removed.** An edge whose source or target is not among the nodes is dropped rather than kept, so a caller reading `graphCtrl.value` never sees a connection that is not drawn.
- **Malformed input degrades to empty.** A missing, non-object or non-array payload yields `{ nodes: [], edges: [] }` rather than an exception.

> **Icons and images are not interchangeable.** `icon` is a CSS class rendered as `<i class="…">` inside a `foreignObject`; `image` is a URL rendered as an SVG `<image href="…">`. Putting a URL into `icon` sets it as a class name on an empty element and renders nothing.

## Programmatic Control

Once initialized, the instance is retrievable via `getInstanceByElement(element)`.

```javascript
// find the host element in the DOM
const graphElement = document.querySelector(".wx-webapp-graph-viewer");

// retrieve the controller instance associated with the element
const graphCtrl = webexpress.webui.Controller.getInstanceByElement(graphElement);

// force a re-fetch from the server
if (graphCtrl) {
    graphCtrl.refresh();
}

// read the current graph ({ nodes, edges })
const graph = graphCtrl ? graphCtrl.value : { nodes: [], edges: [] };
```

`refresh()` always reloads. `update()` is the softer form: standalone it skips the reload while the host is not visible, because a hidden canvas cannot be fitted to the view and would come back at the wrong zoom.

Assigning `graphCtrl.model = …` still works and bypasses the endpoint entirely, which is the escape hatch for a graph that is computed on the client.

## Events

The component dispatches the standard data lifecycle events on the host element, in addition to the base control's `CLICK_EVENT` and `DOUBLE_CLICK_EVENT` for nodes. All events bubble.

- **`webexpress.webui.Event.DATA_REQUESTED_EVENT`** — fired before the `GET` is issued.
- **`webexpress.webui.Event.DATA_ARRIVED_EVENT`** — fired after the graph has loaded successfully.
- **`webexpress.webui.Event.UPDATED_EVENT`** — fired after every render of the graph.

```javascript
graphElement.addEventListener(webexpress.webui.Event.DATA_ARRIVED_EVENT, () => {
    console.log("Graph loaded");
});
```

## Use Case Examples

```html
<!-- The REST graph viewer: bootstraps itself from the wx-service island -->
<div class="wx-webapp-graph-viewer"
     data-edge-style="smooth"
     data-grid="20"
     data-label="Service topology"></div>
```

Authored in C# with the fluent data surface:

```csharp
new ControlDataGraphViewer("service-topology")
{
    EdgeStyle = _ => TypeStyleGraphEdge.Smooth,
    Grid = _ => 20,
    Label = _ => "Service topology"
}
    .DataService<RestApiServiceTopology>();
```

The endpoint derives from `RestApiGraph`, which answers `GET` with the nodes and the edges:

```csharp
[Segment("topology")]
public sealed class RestApiServiceTopology : RestApiGraph
{
    protected override IEnumerable<RestApiGraphNode> RetrieveNodes(IRequest request)
    {
        return
        [
            new() { Id = "web", Label = "Web", Icon = "fas fa-globe", X = 100, Y = 120 },
            new() { Id = "api", Label = "API", Icon = "fas fa-server", X = 320, Y = 120 },
            new() { Id = "db",  Label = "Database", Shape = "circle", Icon = "fas fa-database" }
        ];
    }

    protected override IEnumerable<RestApiGraphEdge> RetrieveEdges(IRequest request)
    {
        return
        [
            new() { Id = "e1", From = "web", To = "api", Label = "HTTPS" },
            new() { Id = "e2", From = "api", To = "db", DashArray = "4,4" }
        ];
    }
}
```

Leaving `X` and `Y` unset — as the `db` node does — hands the placement to the layout simulation. A graph whose endpoint delivers every position is better served with `Physics = _ => false`, because the simulation would otherwise move the authored layout.

## ViewState Binding

`ControlDataGraphViewer` is **ViewState-capable**. Bound to a resource of an enclosing `ControlViewState`, the graph becomes a slice of that ViewState's shared state instead of an independent surface:

```csharp
// inside the ViewState:
new ControlDataGraphViewer("service-topology").Resource<TopologyResource>();
```

When a resource is bound the control:

- emits only the `data-wx-resource` binding (and the optional `data-wx-viewstate` id) instead of its own `wx-service` island, because the ViewState owns the state, the service and the central load;
- on the client, resolves the enclosing `ViewState`, **subscribes** to the resource slice and re-renders the graph whenever the ViewState re-queries it.

Left unbound, the control owns its `wx-service` island and loads itself (standalone), exactly as documented above. The path is chosen automatically — by `DataIslandExtensions.EmitDataIslands` on the server and by the presence of `data-wx-resource` on the client.

## Seeding and Reloading

An initial graph can be handed to the control through the `wx-state` island, in which case the first paint costs no round trip and the endpoint is only asked on an explicit `refresh()`:

```csharp
new ControlDataGraphViewer("service-topology")
    .State(s => s.Set("nodes", nodes).Set("edges", edges))
    .DataService<RestApiServiceTopology>();
```

Standalone, the control also subscribes to the data-change domains of its service, so a change made elsewhere re-queries the graph and flashes the host.
