![WebExpress](https://raw.githubusercontent.com/webexpress-framework/.github/main/docs/assets/img/banner.png)

# Data Kanban

The control `webexpress.webapp.KanbanCtrl` extends the WebUI board with REST persistence and workflow status selection. The host enables column editing through `ControlDataKanban.EditableColumn`. Its column menu then offers **Column statuses** when the board response includes a status catalog.

## Status data

The board response defines available statuses in `statuses` as objects with stable `id` and localized `label` values. Each column assigns zero or more identifiers through `statusIds`. Each card carries its current `statusId` and can restrict transitions through `allowedStatusIds`.

A status may carry a chip color as `colorCss`, a system color class, or as `colorStyle`, an inline style for a user-defined color. The server authors it through the typed `RestApiKanbanStatus.Color`, which collapses into one of the two fields. A card whose `statusId` names a status of the catalog shows that status as the leading chip of its footer, so a column with several statuses still tells which one a card is in. The chip uses the status color, or the neutral footer chip look when the status has none. The destination dialog and the column status chips use the same colors. A card without a status, with an unknown status, or on a board without catalog shows no status chip.

The permission list distinguishes absence from an empty list. An omitted or null `allowedStatusIds` permits every status assigned to the target column. An empty list permits no status transition. Unknown identifiers never become selectable destinations. A null or omitted board catalog retains position-only behavior for boards without workflow statuses.

The following response illustrates a column with two statuses and a card that can enter only one of them.

```json
{
  "statuses": [
    { "id": "open", "label": "Open", "colorCss": "text-bg-secondary" },
    { "id": "active", "label": "In progress", "colorCss": "text-bg-primary" },
    { "id": "review", "label": "In review", "colorStyle": "background:#7c3aed;color:#fff;" }
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

## Moves that need a dialog

Some moves need input the board cannot ask for, such as the form of a workflow transition. A card names a dialog per destination status in `moveDialogs`, a map from status identifier to the dialog's address. A status without an entry, or with an empty address, is a move the board stores itself.

```json
{ "id": "task-1", "columnId": "todo", "statusId": "open",
  "moveDialogs": { "review": "/tasks/task-1/transition/review" } }
```

A move into such a status stores nothing: whether it is a drop, a keyboard move or the choice in the destination dialog, the card stays in its column with its status, and the board opens the address in the form dialog of the page (`modal-form` by default, `ControlDataKanban.MoveDialogModal` names another). The dialog is told to keep the page after its form succeeded (success action `none`, see [RestFormCtrl](form.md)), because the form may be written for a detail page that reloads; a reload would throw away the open tab, the selected card, the search and the scroll position only to show one card in its new column. Once the form reports success (`UPLOAD_SUCCESS_EVENT`) the dialog closes and the board loads itself again: through `viewState.reload(resource)` when it is bound to a ViewState, otherwise standalone. The dialog's submit is what moves the card.

- Cancelling the dialog stores nothing, and a later form in the same page dialog leaves the board alone.
- A board removed while its dialog was open does nothing when the dialog succeeds.
- A page without the form dialog opens the address as a page of its own; only http and https addresses are followed.
- The same form opened anywhere else, without the override, keeps its own success action, a reload for instance.
- A reorder within the column needs no dialog, nor does a move whose status stays the same.

## Interaction

The column dialog edits a provisional selection through the data selection control with search and removable chips. Its menu entry follows the color command and precedes the deletion separator. Saving emits the complete ordered column layout, including every column's `statusIds`. Closing or cancelling the dialog leaves the configuration unchanged. A column with no assigned statuses accepts no cross-column status transitions.

The move operation intersects the target column assignments with the card's permitted statuses. One destination is applied immediately. Multiple destinations open a radio selection with no default and require explicit confirmation. An empty intersection opens an explanatory dialog and leaves the card untouched. Both empty-cell drops and drops before or after another card use the same rule, as do keyboard moves with Alt and the left or right arrow key.

The reorder operation within a column preserves the current status, including moves between swimlanes. Cancelling a destination dialog sends no update. Incoming board data closes any pending dialog so a stale selection cannot overwrite a refreshed card. Successful status moves reload the board through its existing service or ViewState to refresh permitted transitions.

## Loading

While the board loads - the first time, after a move, or when another user changed its data - a thin progress bar above the columns (below the board menu) says so, as the table does. The bar keeps its place while it is hidden, so showing it moves nothing. The placeholders shimmer (`placeholder-glow`) only while there is no board on screen yet; a board on screen does not pulse on every reload.

A reload bound to a ViewState first marks the resource slice as loading while it still carries the board as it was. The board renders a slice only when it brings a payload it has not shown yet, so a card just moved stays where it was dropped until the stored board arrives, instead of appearing once more in its old column.

## REST integration

The server derives from `RestApiKanban<TIndexItem>` and overrides `RetrieveStatuses`, `RetrieveColumns`, and `RetrieveCards`. The corresponding DTOs expose `RestApiKanbanStatus`, `RestApiKanbanColumn.StatusIds`, `RestApiKanbanCard.StatusId`, `RestApiKanbanCard.AllowedStatusIds`, and `RestApiKanbanCard.MoveDialogs`. Column updates reach the existing `UpdateColumns` hook with assignments in `RestApiLayoutColumn.StatusIds`.

The server names the dialogs of a card in `RestApiKanbanCard.MoveDialogs`, an `IDictionary<string, string>` from destination status to address. The update endpoint refuses a move into such a status with a translated reason (`kanban.refused.dialog`), which is what a board loaded before the card named the dialog would send. The check reads the card from `RetrieveCards` like the board does, so it needs no hook of its own; the dialog moves the card through its own endpoint.

The confirmed card move is submitted through the configured service update operation. Its payload contains `cardId`, `columnId`, `swimlaneId`, and `statusId`. The endpoint verifies the selected status against the current catalog, column assignments, and card permissions before invoking `MoveCard(RestApiKanbanMove, IRequest)`. A reorder with an unchanged column and status does not require a workflow transition.

The application persistence hook owns authorization and the workflow transaction. Implementations must persist the selected status and destination and atomically recheck mutable workflow rules. They also decide how status assignments affect card placement when rebuilding the board. The base class does not store application data. The Monkey Island tutorial demonstrates persisted assignments and card destinations using an in-memory store.
