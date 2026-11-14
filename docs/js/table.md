![WebExpress](https://raw.githubusercontent.com/webexpress-framework/.github/main/docs/assets/img/banner.png)

# TableCtrl

The `TableCtrl` component (`wx-webapp-table`, C#: `ControlDataTable`) is the REST table. Its columns, rows, paging and layout persistence follow the WebUI table. This page describes what the REST table adds on top: the choice of rows for a bulk action, and the rows as sources and targets of the drag-and-drop protocol of WebUI.

```
   ┌──────────────────────────────────────────┐
   │ 2 selected           [Assign] [Archive]  │
   ├───┬──────────────────────────────────────┤
   │ ☑ │ Login fails after the update         │
   │ ☐ │ Export cuts off long names           │
   │ ☑ │ Search ignores the language filter   │
   └───┴──────────────────────────────────────┘
```

## Declarative Configuration

The additions are configured through `data-` attributes on the host element. The actions of the selection bar are server markup inside the host, which `ControlDataTable.AddSelectionAction` renders.

| Attribute          | Description                                                                                          | Example
|--------------------|------------------------------------------------------------------------------------------------------|---------------------------
| `data-multiselect` | Enables the checkbox column, the Ctrl and Shift clicks and the selection bar.                        | `data-multiselect="true"`
| `data-drag-kind`   | The kind the rows carry as drag sources; ignored by a table with movable rows, which keeps its own moves. | `data-drag-kind="issue"`
| `data-drop-kind`   | The kind the rows carry as drop targets, so items can be dropped onto a row.                          | `data-drop-kind="team"`
| `.wx-table-selection` | A child element with the controls that act on the chosen rows.                                    | `<div class="wx-table-selection" hidden>…</div>`

## Functionality and Behavior

Rows are chosen with the checkbox in front of each row, and the checkbox in the header chooses every row on screen or releases them again. A click on a row with Ctrl (Cmd on a Mac) adds the row to the choice or removes it, and Shift adds every row from the one chosen last up to the clicked one. A plain click still selects the row as before, because the selected row and the chosen rows are two separate things: the first drives a detail view, the second a bulk action. A chosen row carries `aria-selected="true"`, so assistive technology reads the choice as well.

The selection bar appears above the rows while at least one row is chosen and names how many are. The choice belongs to the rows on screen: when the table loads again, it releases the rows it no longer shows. That is the usual end of a bulk action, which changes or removes the rows it acted on, and it keeps the bar from acting on rows that are gone.

With a drag kind the rows carry their ids as sources of the drag-and-drop protocol, and a drag that starts on a chosen row carries every chosen row, so a multi-selection is moved as one. With a drop kind the rows become targets, so items such as tree nodes or rows of another table can be dropped onto a row. `ControlDataTile` and `ControlDataList` take the same two properties for their tiles and items, and a movable tile set keeps its own reordering.

## Programmatic Control

Once initialized, the choice can be read and changed through the controller instance.

### Accessing an Automatically Created Instance

For tables defined declaratively in HTML, the associated instance is retrieved via the `getInstanceByElement(element)` method of the central `webexpress.webui.Controller`.

```javascript
// find the host element in the DOM
const tableElement = document.getElementById('issues');

// retrieve the controller instance associated with the element
const tableCtrl = webexpress.webui.Controller.getInstanceByElement(tableElement);

// read the chosen rows and release them after the bulk action
if (tableCtrl) {
    const ids = tableCtrl.selection;
    tableCtrl.clearSelection();
}
```

### Manual Instantiation

A table can also be created programmatically on a host element that carries the service island of its endpoint.

```javascript
// find the host element that carries the wx-service island
const host = document.getElementById('issues');
host.setAttribute('data-multiselect', 'true');

// create a new instance of TableCtrl manually
const tableCtrl = new webexpress.webapp.TableCtrl(host);
```

| Member             | Description
|--------------------|-------------------------------------------------------------------
| `selection`        | The ids of the chosen rows; writable.
| `clearSelection()` | Releases every chosen row.

## Events

The component dispatches a standardized event when the choice changes, in addition to the events of the WebUI table.

- **`webexpress.webui.Event.SELECTION_CHANGED_EVENT`**: Fired when the chosen rows change. The `detail` object carries the ids of the chosen rows as `ids`.

## Use Case Examples

A table whose issues can be chosen for a bulk assignment and dragged onto a tree of teams:

```html
<div id="issues" class="wx-webapp-table" data-multiselect="true" data-drag-kind="issue">
    <wx-service hidden name="data" kind="rest" base-uri="/api/1/issues" method="GET"></wx-service>
    <div class="wx-table-selection" hidden>
        <button class="btn btn-primary btn-sm" type="button">Assign</button>
    </div>
</div>
```

The same table authored in C#:

```csharp
new ControlDataTable("issues")
{
    MultiSelect = _ => true,
    DragKind = _ => "issue"
}
    .AddSelectionAction(new ControlButton("assign") { Text = _ => "Assign" })
    .DataService<RestApiIssues>();
```
