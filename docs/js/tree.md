![WebExpress](https://raw.githubusercontent.com/webexpress-framework/.github/main/docs/assets/img/banner.png)

# TreeCtrl

The `TreeCtrl` component (`wx-webapp-tree`, C#: `ControlDataTree`) renders a tree over a REST endpoint that loads one level per expansion. The static tree of WebUI renders every node into the page, which does not scale beyond a few hundred nodes; a hierarchy of any size, such as the pages of a wiki, the units of an organization or the items of a configuration database, opens here as fast as its first level. The tree keeps its expansion across reloads, selects and reveals a node by id, follows the ARIA tree pattern and, when movable, moves its nodes with the drag-and-drop protocol of WebUI.

```
   ┌──────────────────────────┐
   │ ▾ Handbook               │
   │     ▸ Installation       │
   │     • [Configuration]    │
   │ ▸ Release Notes          │
   └──────────────────────────┘
```

## Declarative Configuration

The tree is configured through `data-` attributes on the host element. The endpoint is bound through a `wx-service` island, which `ControlDataTree` emits from `.DataService<TEndpoint>()`.

| Attribute       | Description                                                                                         | Example
|-----------------|-----------------------------------------------------------------------------------------------------|---------------------------------
| `data-movable`  | Enables moving the nodes by drag and drop. A move is sent to the endpoint as `PUT`.                  | `data-movable="true"`
| `data-selected` | The id of the node that is selected when the tree opens; a node below the first level is revealed.  | `data-selected="configuration"`
| `data-expanded` | The ids of the nodes that are open when the tree loads, as a JSON array.                             | `data-expanded='["handbook"]'`
| `data-persist-key` | The key under which the nodes the user opened are stored in the browser. Without it the key is derived from the id of the host; a host without an id stores nothing. | `data-persist-key="pages-tree"`

The endpoint derives from `RestApiTree<TIndexItem>`. A `GET` without parameters answers the root nodes as `[{ id, label, icon, uri, hasChildren, droppable }]`, a `GET ?node=<id>` the children of a node, and a `GET ?reveal=<id>` answers `{ path, levels }`: the ids from the root down to the node and every level the path passes by parent id, with `""` for the root. A `PUT { node, target, position }` moves a node, where the position is `above`, `below` or `child`; a move into the own subtree, or one that `MoveNode` refuses, is answered with 400. `hasChildren` draws the indicator and lets the tree ask for the children only when a node is opened, so it is a flag and not a count. A node with `droppable: false` takes no children, but still takes siblings above and below it.

```csharp
public sealed class RestApiPageTree : RestApiTree<Page>
{
    protected override IEnumerable<RestApiTreeNode> RetrieveChildren(string parentId, IQueryContext context, IRequest request)
        => Pages.ChildrenOf(parentId).Select(x => new RestApiTreeNode
        {
            Id = x.Id.ToString(), Label = x.Title, Uri = x.Uri, HasChildren = x.HasChildren
        });

    protected override string RetrieveParent(string id, IQueryContext context, IRequest request)
        => Pages.ParentOf(id)?.ToString();

    protected override bool MoveNode(string node, string target, RestApiTreeMovePosition position, IQueryContext context, IRequest request)
        => Pages.Move(node, target, position);
}
```

## Functionality and Behavior

The expansion lives in the state of the tree. It is seeded from `data-expanded` or from the `expanded` entry of the `wx-state` island and survives every reload, including the one a data change of the service triggers; the levels open from the top down, since a level can only be asked for once its parent is known. A reload also forgets the levels of the closed branches, so a branch opened again afterwards is asked for anew and shows what the endpoint holds now rather than what it held when it was last open.

The expansion is a view preference as well: the nodes the user opened are stored through `webexpress.webui.LocalStorage` and are opened again, together with those the page names, the next time the page loads.

The tree is a field whose value is the id of the selected node. A node that is loaded but hidden below a closed node is shown by opening its ancestors, and a node that is not loaded yet is revealed with a single request. The tree is a single tab stop, and the stop always lies on a node that is shown, so closing the parent of the focused node hands the stop to that parent. The arrow keys walk the nodes, Right opens a node and Left closes it, and Home and End jump to the first and the last node. Enter and Space open or close a node with children and select it; on a node that is a link, Enter follows the link. The asterisk opens every sibling of the focused node.

A movable tree moves a node above, into or below another node of the same tree, never into its own subtree. Only a drag that started in the same tree and asks for a move counts as a move: two trees on one page may hold the same ids, and a copy is left to the page. A move is shown at once and stored the way a control stores a change it applies at once, with the cancelable before-save event, the task events around the request and the saved event; a vetoed move is taken back without a word of failure, and a refused one is reported. In every case the tree reads the touched levels back, since the endpoint decides where a node ends up. A drop of other items, such as rows of a table, is left to the page.

## Programmatic Control

Once initialized, the tree can be controlled through its controller instance.

### Accessing an Automatically Created Instance

For trees defined declaratively in HTML, the associated instance is retrieved via the `getInstanceByElement(element)` method of the central `webexpress.webui.Controller`.

```javascript
// find the host element in the DOM
const treeElement = document.getElementById('pages');

// retrieve the controller instance associated with the element
const treeCtrl = webexpress.webui.Controller.getInstanceByElement(treeElement);

// reveal and select a node that is not loaded yet
if (treeCtrl) {
    treeCtrl.select('configuration');
}
```

### Manual Instantiation

A tree can also be created programmatically on a host element that carries the service island of its endpoint.

```javascript
// find the host element that carries the wx-service island
const host = document.getElementById('pages');

// create a new instance of TreeCtrl manually
const treeCtrl = new webexpress.webapp.TreeCtrl(host);
```

| Member                         | Description
|--------------------------------|-------------------------------------------------------------------
| `load()`                       | Reloads the root and every open level.
| `toggle(id, open)`             | Opens or closes a node; opening loads its children the first time.
| `select(id)`                   | Selects a node and shows it, revealing it when it is not loaded.
| `reveal(id)`                   | Loads the path to a node, opens its ancestors and selects it.
| `move(node, target, position)` | Moves a node as a drop would.
| `value`                        | The id of the selected node.

## Events

The component dispatches standardized events to notify the application of changes.

- **`webexpress.webui.Event.CHANGE_VALUE_EVENT`**: Fired when the selected node changes. The `detail` object carries the new id as `value`, or null when the selection was cleared; selecting the selected node again fires nothing.
- **`webexpress.webui.Event.CLICK_EVENT`**: Fired when a node is clicked. The `detail` object carries the id as `node`.
- **`webexpress.webui.Event.SELECT_ITEM_EVENT`**: Fired when a node is selected. The `detail` object carries the id as `node`.
- **`webexpress.webui.Event.CHANGE_VISIBILITY_EVENT`**: Fired when a node is opened or closed. The `detail` object contains `node` and `expanded`.
- **`webexpress.webui.Event.MOVE_EVENT`**: Fired when a node is moved, as the static tree does. The `detail` object contains `node`, `target` and `position` (`above`, `below` or `child`).
- **`webexpress.webui.Event.BEFORE_SAVE_EVENT`**: Fired before a move is stored; cancelable. The `detail` object contains `action` (`move`) and `payload`.
- **`webexpress.webui.Event.SAVED_EVENT`**: Fired when a move was stored.
- **`webexpress.webui.Event.DATA_ERROR_EVENT`**: Fired when loading, revealing or moving failed. The `detail` object contains `action` (`load`, `reveal` or `move`) and `error`.

## Use Case Examples

A movable tree over the pages of a wiki, opened at a page below the first level:

```html
<div id="pages" class="wx-webapp-tree" data-movable="true" data-selected="configuration" data-expanded='["handbook"]'>
    <wx-service hidden name="data" kind="rest" base-uri="/api/1/pages" method="GET" update-method="PUT"></wx-service>
</div>
```

The same tree authored in C#:

```csharp
new ControlDataTree("pages")
{
    Movable = _ => true,
    Selected = _ => "configuration",
    Expanded = _ => ["handbook"]
}
    .DataService<RestApiPageTree>();
```
