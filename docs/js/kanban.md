![WebExpress](https://raw.githubusercontent.com/webexpress-framework/.github/main/docs/assets/img/banner.png)

# Data Kanban

The control `webexpress.webapp.KanbanCtrl` extends the WebUI board with REST persistence and workflow status selection. The host enables column editing through `ControlDataKanban.EditableColumn`. Its column menu then offers **Column statuses** when the board response includes a status catalog.

## Status data

The board response defines available statuses in `statuses` as objects with stable `id` and localized `label` values. Each column assigns zero or more identifiers through `statusIds`. Each card carries its current `statusId` and can restrict transitions through `allowedStatusIds`.

The permission list distinguishes absence from an empty list. An omitted or null `allowedStatusIds` permits every status assigned to the target column. An empty list permits no status transition. Unknown identifiers never become selectable destinations. A null or omitted board catalog retains position-only behavior for boards without workflow statuses.

The following response illustrates a column with two statuses and a card that can enter only one of them.

```json
{
  "statuses": [
    { "id": "open", "label": "Open" },
    { "id": "active", "label": "In progress" },
    { "id": "review", "label": "In review" }
  ],
  "columns": [
    { "id": "todo", "label": "To do", "statusIds": ["open"] },
    { "id": "work", "label": "In progress", "statusIds": ["active", "review"] }
  ],
  "items": [
    { "id": "task-1", "columnId": "todo", "statusId": "open", "allowedStatusIds": ["review"] }
  ]
}
```

## Interaction

The column dialog edits a provisional selection through the data selection control with search and removable chips. Its menu entry follows the color command and precedes the deletion separator. Saving emits the complete ordered column layout, including every column's `statusIds`. Closing or cancelling the dialog leaves the configuration unchanged. A column with no assigned statuses accepts no cross-column status transitions.

The move operation intersects the target column assignments with the card's permitted statuses. One destination is applied immediately. Multiple destinations open a radio selection with no default and require explicit confirmation. An empty intersection opens an explanatory dialog and leaves the card untouched. Both empty-cell drops and drops before or after another card use the same rule, as do keyboard moves with Alt and the left or right arrow key.

The reorder operation within a column preserves the current status, including moves between swimlanes. Cancelling a destination dialog sends no update. Incoming board data closes any pending dialog so a stale selection cannot overwrite a refreshed card. Successful status moves reload the board through its existing service or ViewState to refresh permitted transitions.

## REST integration

The server derives from `RestApiKanban<TIndexItem>` and overrides `RetrieveStatuses`, `RetrieveColumns`, and `RetrieveCards`. The corresponding DTOs expose `RestApiKanbanStatus`, `RestApiKanbanColumn.StatusIds`, `RestApiKanbanCard.StatusId`, and `RestApiKanbanCard.AllowedStatusIds`. Column updates reach the existing `UpdtaeColumns` hook with assignments in `RestApiLayoutColumn.StatusIds`.

The confirmed card move is submitted through the configured service update operation. Its payload contains `cardId`, `columnId`, `swimlaneId`, and `statusId`. The endpoint verifies the selected status against the current catalog, column assignments, and card permissions before invoking `MoveCard(RestApiKanbanMove, IRequest)`. A reorder with an unchanged column and status does not require a workflow transition.

The application persistence hook owns authorization and the workflow transaction. Implementations must persist the selected status and destination and atomically recheck mutable workflow rules. They also decide how status assignments affect card placement when rebuilding the board. The base class does not store application data. The Monkey Island tutorial demonstrates persisted assignments and card destinations using an in-memory store.
