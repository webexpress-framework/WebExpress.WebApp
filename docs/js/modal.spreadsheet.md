![WebExpress](https://raw.githubusercontent.com/webexpress-framework/.github/main/docs/assets/img/banner.png)

# ModalSpreadsheetCtrl

The `ModalSpreadsheetCtrl` is the dialog a workbook is worked on in. It is the client half of `ControlDataModalSpreadsheet`, and it is derived from [`ModalEditorCtrl`](modal.editor.md): the workbook dialog **is** the document dialog — the workbook's name on its title bar, the spreadsheet as the whole of its content, the switch, the save state, the overflow menu and the publish button on its footer bar — with a spreadsheet where the text editor would be.

```
   ┌────────────────────────────────────────────────────────────────┐
   │ Household budget                                       [⛶] [×] │  // .wx-modal-header
   ├────────────────────────────────────────────────────────────────┤
   │ ↶ ↷ │ ✂ ⎘ 📋 │ Standard ▾ 10 ▾ │ B I U │ ⊞ │ ≡ ≡ ≡ │ # € %  │  // .wx-modal-content
   │ A1   fx Item                                                   │  //   holds the spreadsheet,
   │    │ A        │ B        │ C        │ D        │ E             │  //   data-fill="true"
   │  1 │ Item     │ Jan      │ Feb      │ Mar      │ Apr           │
   │  2 │ Revenue  │ 42.000 € │ 43.500 € │ 45.000 € │ 46.500 €      │
   │ Budget 2026 │ +                                         100 %  │
   ├────────────────────────────────────────────────────────────────┤
   │ [Write|Preview] (MP) Saved · 19:12  [ ⋯ ] [ Publish ] [ Close ]│  // .wx-modal-footer
   └────────────────────────────────────────────────────────────────┘
```

Everything the document dialog does, this one does the same way, and it is described there: the **draft** that every change is written to while the author works, the **publication** through the record endpoint that ends the draft in its own transaction, the **discard** in the overflow menu, sharing through the collaborative container, the save states, the events (`EDITOR_DRAFT_SAVED`, `EDITOR_DRAFT_DISCARDED`, `EDITOR_PUBLISHED`, `EDITOR_STATE`, `CHANGE_VISIBILITY_EVENT`) and the programmatic control (`show`, `hide`, `state`, `save`, `discard`, `view`, `refresh`). The host attributes are the same as well.

A workbook only differs in what the body is.

## Value

The body is a `SpreadsheetCtrl` with a form name. It posts its workbook as JSON through a hidden input under that name, so the `RestFormCtrl` sends the workbook's JSON as the value of the body field — on publish to the record endpoint, while drafting to the draft endpoint — and fills it back from the same key when it loads. Formula cells carry their last result, so an endpoint reads figures without a formula engine; on the server, `SpreadsheetWorkbook.Parse` reads and validates what arrives.

```json
{
    "Title": "Household budget",
    "Body": "{\"sheets\":[{\"name\":\"Budget 2026\",\"cells\":{\"A1\":{\"v\":\"Item\"}}}]}"
}
```

Every change of the workbook — a value, a formula, a format, a row inserted, a sheet renamed — reaches the form as the spreadsheet's `CHANGE_VALUE_EVENT` and is drafted like a keystroke in a text.

## Preview

The reading view is the same workbook in a second spreadsheet: read-only, without toolbar and formula bar, in the language of the surface — what a page showing the published workbook read-only would show. It is filled from the surface at the moment *Preview* is picked and follows it while it is showing, so in a shared workbook the other authors' changes arrive in it too.

The reading view is a spreadsheet as well, so it raises change events of its own when it is filled. They stop at the view: they are not changes of the document, and reaching the form they would be drafted.

## Authoring in C\#

```csharp
new ControlButton()
{
    Text = _ => "Edit the budget",
    PrimaryAction = _ => new ActionModal("workbook")
},
new ControlDataModalSpreadsheet("workbook")
{
    Title = { Name = _ => "Title", Placeholder = _ => "Name of the workbook" },
    Body = { Name = _ => "Body", Locale = _ => "de" }
}
    .DataService<WorkbookRestApi>()
    .DraftService<WorkbookDraftRestApi>();
```

`Body` is a `ControlFormItemInputSpreadsheet`. Its own settings — `Toolbar`, `FormulaBar`, `SheetTabs`, `StatusBar`, `Rows`, `Columns`, `Locale`, `Zoom`, `ReadOnly` — configure the spreadsheet in the dialog; `Fill` is on, because the workbook takes the whole dialog. The dialog's own settings — `Draft`, `Debounce`, `MaxDelay`, `ShowState`, `Preview`, `Size`, `Show`, `Collaborative`, `CollaborationId`, `MoreItems` — are those of every document dialog (`ControlDataModalDocument`).

An endpoint pair that stores the workbook could look like this:

```csharp
[Method(RequestMethod.PUT)]
public IResponse Update(Request request)
{
    var payload = JsonSerializer.Deserialize<WorkbookPayload>(request.Content);

    if (!SpreadsheetWorkbook.TryParse(payload?.Body, out var workbook))
    {
        return new ResponseBadRequest(new StatusMessage("The body is no workbook."));
    }

    // store workbook.ToJson() with the record and end the draft in the same transaction
    ...
}
```
