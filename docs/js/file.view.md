![WebExpress](https://raw.githubusercontent.com/webexpress-framework/.github/main/docs/assets/img/banner.png)

# FileViewCtrl

The `FileViewCtrl` component shows **one set of files in several interchangeable presentations**. The tabular **file list** and the **tile board** are built in, further presentations are contributed by the server. All presentations render the same files, so switching between them never re-queries the endpoint.

The list presentation *is* the WebUI `webexpress.webui.FileListCtrl`, not a copy of it, so a file entry looks and behaves the same whether it is shown here or by the file list on its own. The switch between the presentations is likewise the shared `webexpress.webui.ViewSwitcher`, the one `ControlView` and `ControlDataRelationView` offer their views through; a switch over a single presentation offers no choice and steps aside.

Two things go beyond a plain listing:

* the **description of a file is editable in place**, through the WebUI `webexpress.webui.SmartEditCtrl`, and
* an **upload control can be bound to the view**, so a file that finished uploading shows up without a page reload.

```
   list presentation                          tile presentation
   ┌───────────────────────────[≣][▦]┐        ┌──────────────────────────[≣][▦]┐
   │ ▸2 📄 Proposal.pdf ⓘ draft ✎ 2 kB│        │ ┌──────────┐  ┌──────────┐     │
   │    🖼 Photo.jpg    ⓘ …     ✎ 5 MB│        │ │   [img]  │  │    📄    │     │
   │    📊 Budget.xlsx  ⓘ Q4    ✎ 3 kB│        │ │ Photo.jpg│  │Budget.xls│     │
   ├─────────────────────────────────┤        │ │ ⓘ …    ✎ │  │ ⓘ Q4   ✎ │     │
   │ 3 file(s)                       │        │ │ ▸ 2 vers.│  │          │     │
   └─────────────────────────────────┘        │ └──────────┘  └──────────┘     │
                                              └────────────────────────────────┘
   unfolded (▾)
   ┌─────────────────────────────────┐
   │ ▾2 📄 Proposal.pdf ⓘ draft ✎ 2 kB│
   │    v1 Proposal.pdf ⓘ first  1 kB│
   └─────────────────────────────────┘
```

## Declarative Configuration

The control is bootstrapped from a host element carrying the `wx-webapp-file-view` CSS class, which the C# control `WebExpress.WebApp.WebControl.ControlDataFileView` renders. The control reads its configuration from `data-` attributes, then relocates the children it found into the panes of the switcher.

### Container Element Attributes

| Attribute                   | Description                                                                                                              | Example
|-----------------------------|--------------------------------------------------------------------------------------------------------------------------|-------------------------------------
| `data-views`                | The built-in presentations the switcher offers, comma separated and in switching order. The first one opens.               | `data-views="list,tile"`
| `data-layout`               | `togglegroup` (default) shows the switch alone; `default` names the active presentation beside it, like `ControlView`.      | `data-layout="togglegroup"`
| `data-editable-description` | When `"true"`, the description of a file is edited in place instead of being shown as text.                                | `data-editable-description="true"`
| `data-page-size`            | Optional. The number of files requested per page.                                                                          | `data-page-size="25"`
| `data-wx-resource`          | Optional. The ViewState resource the control renders, instead of owning its state and loading itself.                       | `data-wx-resource="files"`

The endpoint is declared through the `wx-service` island of the View/State/Service architecture (see `architecture/view-state-service.md`), under the service name `data`.

### Child Elements

| Element                     | Description
|-----------------------------|--------------------------------------------------------------------------------------------------------------------------
| `.wx-webui-file-list`       | The server rendered file list. It becomes the list presentation, and its entries are the files shown until the first response arrives.
| `.wx-view`                  | An additional presentation, carrying its label in `data-label` and an optional glyph in `data-icon`. It joins the switcher after the built-in ones.

## REST Contract

| Method        | URL             | Body                      | Response       | Purpose
|---------------|-----------------|---------------------------|----------------|-------------------------------------------------
| `GET`         | `{base-uri}`    | —                         | `FileResult`   | Load the files, filtered by the usual `q`, `wql`, `f`, `p` and `l` parameters.
| `PUT`/`POST`  | `{base-uri}`    | `{ id, description }`     | `200`          | Persist a description edited in place.

The update names the file in its payload rather than in the address, so the endpoint stays a single address for the whole set — the same shape `RestApiTable` uses to take its configuration.

`FileResult` carries `items`, `total` and `pagination`. Each item has `id`, `name`, `uri`, `version`, `description` and the optional `icon`, `image`, `size` and `date`. **`size` and `date` are display strings**, formatted by the server, because only the server knows the culture the page is rendered in; this is also what makes a file that arrives through the API indistinguishable from one the server rendered into the page.

The server side is provided by the abstract `WebExpress.WebApp.WebRestApi.RestApiFile<TIndexItem>` base class: derive from it, implement `RetrieveItems` and — when descriptions are editable — override `UpdateDescription`. `RetrieveTotal` reports the count across all pages; the default says nothing and the client infers one from the page it got. The `FormatSize` and `FormatDate` helpers produce the display strings.

## Versions

The **name is the identity of a file across its versions**. Items that share a name are folded into one entry, the highest `version` at the head and the earlier ones behind it; both presentations show that entry as one row (one card) that unfolds to its history. Uploading a name that is already there is therefore a new version of that file, not a second file — the view shows the new version immediately and pushes what was on screen into the history, and the reload replaces the guess with the record the server made.

An endpoint that keeps no history simply leaves `version` at `0`: every name then has exactly one item, nothing is folded, and no unfold control appears. The earlier versions are shown for reading only — a past version is a record of what was, so its description carries no editor.

## Empty Descriptions

An empty value would leave an empty read view: nothing to hover, nothing to click, and so no way to reach the editor on exactly the files that most need one. The read view therefore falls back to the placeholder of its editor, which the `SmartEditCtrl` reads from `data-placeholder` on its host or from the `placeholder` attribute of the editor itself. The file view sets it from `webexpress.webapp:fileview.description.placeholder`.

## Showing an Upload Immediately

The view follows an upload control through the `upload` bind, declared on the view (the reader) rather than on the upload control, so the upload control stays reusable:

```csharp
var upload = new ControlUpload("myUpload") { AutoUpload = _ => true };

var files = new ControlDataFileView("myFiles")
{
    EditableDescription = _ => true,
    Bind = _ => new Binding().Add(new BindUpload { Source = "myUpload" })
}
    .Service("data", svc => svc.Endpoint<MyFilesApi>().Method(HttpMethod.Get).UpdateMethod(HttpMethod.Put));
```

When the upload reports success, the file appears in both presentations at once and the view re-queries the endpoint. A name that is already there becomes the newest version of that file rather than a second entry. The optimistic entry is replaced as soon as a response carries a file of the same name; until then it survives the reload, so an endpoint that indexes asynchronously does not make the new file disappear again.

## Programmatic Control

```javascript
const element = document.querySelector("#myFiles");
const fileView = webexpress.webui.Controller.getInstanceByElement(element);

// the files currently shown, one entry per name, each carrying its earlier
// versions in a versions array
console.log(fileView.files);

// replace them, which redraws every presentation
fileView.files = [{
    id: "2", name: "Proposal.pdf", uri: "/d/2", version: 2, description: "draft",
    versions: [{ id: "1", name: "Proposal.pdf", uri: "/d/1", version: 1 }]
}];

// the query surface every data control shares
fileView.search("proposal");
fileView.filter("recent");
fileView.paging(1);
fileView.load();

// show a file that was just uploaded and ask the server for its record
fileView.uploaded(file);
```

## Events

| Event                                              | Raised when
|----------------------------------------------------|--------------------------------------------------------------
| `webexpress.webui.Event.DATA_ARRIVED_EVENT`         | A load returned; the detail carries the raw response and the page.
| `webexpress.webui.Event.CHANGE_VISIBILITY_EVENT`    | The presentation changed; the detail carries the pane name.
| `webexpress.webui.Event.CHANGE_VALUE_EVENT`         | A description was edited; the detail carries the file id and the new text.
