![WebExpress](https://raw.githubusercontent.com/webexpress-framework/.github/main/docs/assets/img/banner.png)

# RelationViewCtrl

The `RelationViewCtrl` component renders the **link surface** of one object: every semantic relation it holds, grouped by what the relation says, together with the dialog that establishes a new one. It is the reading half of the hybrid link system; the administrative half is the [`RelationEditorCtrl`](relation.editor.md).

Two categories of link are supported natively, they share one entity and they are **listed together**:

1. **Object links** between two abstract items of the application — *blocks*, *causes*, *references*, *similar to*, *duplicate of*, *parent of*, *replaces*.
2. **Web links** to an address outside the application — carried by the same structure, addressed by a uri instead of by an object key.

The control interprets the generic link structure and nothing else. Which systems may be linked through and which relations exist is answered by the server at request time, so a system or a relation a plugin contributed appears here without a change to this control or to the page that hosts it.

```
   ┌──────────────────────────────────────────────────────────────────────────────┐
   │ 🔗 LINKS  10                            [ ≣ List | ⁘ Graph ]     [ + Link ] │
   ├──────────────────────────────────────────────────────────────────────────────┤
   │ ⚑ BLOCKS            (counterpart: is blocked by)                           1 │
   │ ⚑ CHG-00045   Change   Firmware update VPN gateway   ● Approved since 19.08 ›│
   │ ⚡ IS CAUSED BY      (counterpart: causes)                                 1 │
   │ ⚡ CHG-00041   Change   Firmware patch 7.4.2          ● Closed  since 17.08 ›│
   │ ↗ WEB LINK                                                                 1 │
   │ ↗ https://example.com/advisory   Vendor advisory                since 11.08 ›│
   └──────────────────────────────────────────────────────────────────────────────┘
```

Every row starts with the icon of its relation, so a link stays recognisable by what it says even when the group heading has scrolled out of sight. Picking a row opens the **detail dialog** of that link — the note it was created with, what a plugin carries on it and the actions that change or drop it. Clicking the key itself follows the link instead, because that is what a link is for.

## Reading a link from two sides

A relation is one fact told from two sides, and it is stored **once**. Which of the two labels applies is decided by the end the surface sits on: the object that authored the link reads it under the label of its type (*blocks*), the object at the other end reads the same link under the inverse label (*is blocked by*). The endpoint therefore marks each link with `inverse` and the control renders the opposite end.

That is also why one relation may produce **two** groups on the same surface — an incident that blocks one change and is blocked by another shows both headings.

A **symmetric** relation (*similar to*) reads alike from either end and renders no counterpart badge.

## Declarative Configuration

The control is bootstrapped from a host element carrying the `wx-webapp-relation-view` CSS class. Author it in C# with `ControlDataRelationView`:

```csharp
new ControlDataRelationView("links")
{
    Subject = _ => incident.Key,
    SubjectClass = _ => "Incident"
}
    .DataService<IncidentLinkRestApi>()
    .SystemsService<RelationSystemRestApi>()
    .TargetsService<LinkTargetRestApi>();
```

### Container Element Attributes

| Attribute             | Description                                                                                                                            | Example
|-----------------------|----------------------------------------------------------------------------------------------------------------------------------------|-----------------------------
| `data-subject`        | Business key of the object the surface belongs to. Every link the dialog establishes starts from it, and the target search excludes it. | `data-subject="INC-00123"`
| `data-subject-class`  | Class of that object.                                                                                                                   | `data-subject-class="Incident"`
| `data-view`           | Presentation the surface opens with: `list`, `graph` or the token of a contributed view. Defaults to `list`.                            | `data-view="graph"`
| `data-readonly`       | When `"true"`, the add affordance and the actions of the detail dialog are suppressed.                                                  | `data-readonly="true"`
| `data-header-icon`    | When `"false"`, the header leaves out its icon.                                                                                        | `data-header-icon="false"`
| `data-header-text`    | When `"false"`, the header leaves out its caption.                                                                                     | `data-header-text="false"`
| `data-header-badge`   | When `"false"`, the header leaves out the count of relations.                                                                          | `data-header-badge="false"`

### The header

The header carries an icon, a caption and the count of relations, and each of the three is optional (`HeaderIcon`, `HeaderText`, `HeaderBadge` on the control). A page that already names the section around the surface turns off what it would otherwise say twice.

With all three off the header is left out entirely rather than rendered empty, because an empty heading would still claim the gap of the toolbar; the presentation switch and the add affordance move up into its place. This pairs with the flat layout, where the surface is one section of a page rather than a card of its own.

### Services

The host carries three `wx-service` islands:

| Name       | Purpose
|------------|-------------------------------------------------------------------------------
| `data`     | The links of the object: load, establish, change and remove.
| `systems`  | The registered link systems and the relations they offer — the dialog sidebar.
| `targets`  | The search for the object a link points at, plus the suggestions shown up front.

### REST Contract

| Method   | URL                                              | Body                                   | Response                | Purpose
|----------|--------------------------------------------------|----------------------------------------|-------------------------|--------------------------------
| `GET`    | `{data}?type=&system=&status=&target=&q=`        | —                                      | `LinkResult`            | Load the grouped links.
| `POST`   | `{data}`                                         | `LinkPayload`                          | `Link`                  | Establish a link.
| `PUT`    | `{data}/{id}`                                    | `{ status, comment, direction, title }`| `Link`                  | Change status or note.
| `DELETE` | `{data}/{id}`                                    | —                                      | `204 No Content`        | Remove a link.
| `GET`    | `{systems}?kind=&enabled=`                       | —                                      | `RelationSystem[]`          | The dialog sidebar.
| `GET`    | `{targets}?q=&type=&system=&source=&l=`          | —                                      | `RelationReference[]`       | Target search and suggestions.

`LinkResult`:

```json
{
  "groups": [
    {
      "type": "blocks",
      "inverse": false,
      "label": "blocks",
      "counterpart": "is blocked by",
      "symmetric": false,
      "icon": "flag",
      "effect": "blocksCompletion",
      "count": 1,
      "items": [ /* Link */ ]
    }
  ],
  "total": 5,
  "objectCount": 5,
  "externalCount": 5
}
```

`objectCount` and `externalCount` report the two categories separately; the surface lists them together and shows the `total`. The `kind` filter of the endpoint stays available for a caller that wants only one of them.

`Link`:

```json
{
  "id": "l1",
  "system": "webexpress.webapp.relation.object",
  "type": "blocks",
  "direction": "bidirectional",
  "status": "active",
  "inverse": false,
  "comment": "same gateway",
  "created": "2026-08-19T10:00:00Z",
  "createdBy": "mp",
  "source": { "key": "INC-00123", "class": "Incident" },
  "target": { "key": "CHG-00045", "class": "Change", "title": "Firmware update",
              "uri": "/change/45", "status": "Approved", "statusColor": "success" },
  "metadata": { "pullRequest": "417" }
}
```

`LinkPayload` — one body for both categories: an object link fills `targetKey`/`targetClass`, a web link fills `address`, and both may carry a `title`, a `comment` and free `metadata`.

A refused link is answered as `400` with `{ "code": "relation.duplicate", "message": "…" }`. The `code` is an i18n key, so the surface reports **what** the server objected to rather than a bare status.

## Lifecycle rather than deletion

A relation that stopped holding is marked **obsolete** rather than deleted — the fact that it once held is part of the history of both objects. An obsolete link stays visible in the list, muted and struck through, and no longer occupies its cardinality slot; the detail dialog offers it *reactivate* as the way back. Which status a link reaches is otherwise the decision of whoever owns the object rather than of the surface, which is why the dialog does not offer to set one.

The actions of the detail dialog are therefore *navigate to*, *reactivate* for an obsolete link, and *remove link*. It closes after each of them, because what it was showing either changed or was left behind. *Navigate to* follows the rule the key in the list follows: a linked object of the application is opened in place, a web link beside it. It is also the one action a read-only surface still offers, because reading where a link points is not a change; a link whose reference carries no address does not offer it at all.

## Layout

`Layout` decides how the surface presents itself:

| Value                            | Appearance
|----------------------------------|--------------------------------------------------------------------------------
| `TypeLayoutRelationView.Default` | A card: bordered, rounded, with a filled toolbar. For a page of framed panels.
| `TypeLayoutRelationView.Flat`    | A flat section: no border, no card, no filled toolbar - the quiet upper-case label with its count, a hairline across the remaining width, and the relations below it. For a page that reads as one column of sections, where a second frame would claim a separation the content does not have.

```csharp
new ControlDataRelationView("relations")
{
    Layout = _ => TypeLayoutRelationView.Flat
}
    .DataService<IncidentRelationRestApi>();
```

## Further views

The surface brings the list and the graph. A page adds a further way of reading the same relations - a timeline, a matrix, an impact analysis - with `Add(...)`, and a **plugin** adds one through a fragment, without the page hosting the surface knowing about it:

```csharp
[Section<SectionRelationViewPrimary>]
[Scope<IncidentPage>]
public sealed class TimelineView : FragmentControlDataRelationViewItem
{
    public TimelineView(IFragmentContext fragmentContext)
        : base(fragmentContext, "timeline")
    {
        Label = _ => "Timeline";
        Icon = _ => new PropertyIcon(TypeIcon.Clock);
        Add(new ControlDataSchedule().DataService<IncidentTimeline>());
    }
}
```

The three sections - `SectionRelationViewPreferences`, `SectionRelationViewPrimary` and `SectionRelationViewSecondary` - decide where the entry appears in the switch, exactly as the sections of `ControlView` decide where a contributed item appears.

A view is **rendered on the server** and handed to the client as a hidden pane inside the host, carrying its token, its caption and its icon as data attributes. The client builds the switch entry from the pane itself and only shows and hides it. That keeps a contributed view free to use any control of the framework - it does not have to be expressible in the client model of the surface - and switching to it costs no round trip.

The switch itself is the shared one (`webexpress.webui.ViewSwitcher`), the same control `ControlView` and `ControlDataFileView` offer their presentations through, so a contributed view joins a switch a user already knows. The surface only hands it its own palette through the `--wx-view-switcher-*` custom properties; the layout of the switch is stated once, with the switch.

## The graph view

The same relations are also rendered as a graph around the object: one node per linked end, one edge per link, labelled with the relation as it reads on this object. The model is derived from the links that are already loaded rather than from a second endpoint, so switching the presentation costs no round trip and the two views can never disagree.

Every node is a rectangle carrying what its row in the list carries:

```
   ┌────────────────────────────────────────┐
   │ ⚑  CHG-00045                ● Approved │
   │    Change · Firmware update VPN gateway│
   └────────────────────────────────────────┘
```

the icon of its relation, the key, the type and the title of the object, and its state as a coloured dot with its caption. A long description is cut, because a node states what an object is rather than everything about it. An external end has no key, so it is named by the host of its address.

The object the surface belongs to is the one node the reader has to find first, so it is painted with the primary accent through the `wx-relation-view-node-subject` class; every other node keeps the default paint of the graph viewer.

## The add dialog and its extension point

`+ Link` opens the framework sidebar dialog, `webexpress.webui.ModalSidebarPanelCtrl` — the same modal the editor toolbar opens for its own dialogs, assembled the same way: a host carrying the panel registry key, a header, a content area and a footer with the submit button. The modal owns the sidebar, the page switching, the validation and the submit; the surface only supplies the pages and a back reference to itself under `_linkCtrl`.

The fields of a link system are a **page** of that dialog, registered through `webexpress.webui.DialogPanels` under the key `webexpress.webapp.relation`:

```javascript
webexpress.webui.DialogPanels.register(webexpress.webapp.relationViewModel.PANELS_KEY, {
    id: "acme.github",          // the system id this page renders
    kind: "object",             // "object" | "external"
    generic: false,             // true = serves every system of that category
    title: "GitHub",            // the sidebar entry
    iconClass: webexpress.webui.IconSet.resolve("link"),

    render: function (pane, modal, systemId) { /* build the fields */ },
    onShow: function (modal, systemId) { },
    validate: function (modal, systemId) { return null; },   // a string keeps the dialog open
    onSubmit: function (modal, systemId) { modal._linkCtrl.createLink({ … }); }
});
```

A page reaches everything it needs through the modal: `modal._linkCtrl` is the surface (with `subject` and `targets`), `modal._linkSystems` is the catalog the server answered, and `webexpress.webapp.relationViewModel.panelState(modal, systemId)` is the scratch state the page keeps per system — so switching systems back and forth does not lose what was typed.

The pages come from two places, which is what makes the dialog both framework-driven and server-driven:

1. the registered panels are **autoloaded** by the registry key, exactly as the editor loads its dialog pages;
2. every further system the server reports gets a page added for it, rendered by the generic panel of its category.

WebExpress ships two panels — `webexpress.webapp.relation.object` and `webexpress.webapp.relation.web` — and both declare `generic: true`. **A system a plugin registers without shipping a panel of its own is therefore rendered by the generic panel of its category**, so contributing a link system can be done entirely on the server. A system the server reports as `enabled: false` gets no page, because the dialog exists to create links.

### The two pickers of the object page

Both fields are the framework selection control, so a relation and a target are picked the way everything else in the application is picked — the same field, the same dropdown, the same filter.

The relation is `webexpress.webui.InputSelectionCtrl` over the relations the system offers, with the first one picked up front. Changing it drops the target that was picked and asks for the candidates again rather than filtering what is already shown, because which classes are accepted depends on the relation.

The target is `webexpress.webapp.RelationTargetSelectionCtrl`, which is the REST-backed `webexpress.webapp.InputSelectionCtrl` (`wx-webapp-input-selection`) with `receiveData` replaced. That control reads its endpoint from a `wx-service` island on its own element and asks it for a term and a page; a target search needs more than a term — which relation is being established, which system it belongs to and which object it starts from all decide what may be linked — and the surface already holds that service. Overriding the request keeps everything the control does around it: the debounce (`searchDelay`, 200 ms), the spinner, the abort of a superseded search and the dropdown itself.

What the request needs is attached to the element as `_wxRelationTarget`, not to the instance, because the control issues its first search inside its own constructor — before a subclass could be handed anything. The answer becomes the options: the caption of a candidate is its key, its class and its title, escaped, because the control renders the caption as markup. An answer without a single candidate becomes one disabled option that says so; an aborted search leaves the options alone, because what is shown belongs to the newer one.

The service already answered what matches the term — it matches on the class too, which the caption does not carry — so the local filter of the control is switched off for the target field. Filtering the answer again against the caption would drop candidates the server found.

### What the dialog validates, and what it does not

`validate` returning a string is the framework's signal to keep the dialog open and show the message, so an incomplete draft — no relation picked, no target chosen, an address that is not `http(s)` — never reaches the server.

The framework submit is synchronous: `onSubmit` runs and the dialog closes. A rejection only the server can see (a duplicate that appeared meanwhile, an exhausted cardinality) therefore arrives after the dialog is gone and is reported as a popup notification carrying the server's `code`, rather than inside the closed dialog.

## Programmatic Control

```javascript
const element = document.querySelector(".wx-webapp-relation-view");
const ctrl = webexpress.webui.Controller.getInstanceByElement(element);

// the links of the loaded groups, flattened
console.log(ctrl.value);

// open the detail dialog of one link
ctrl._openDetail("l1");
```

## Events

All events bubble from the host element.

- **`webexpress.webapp.Event.RELATION_ADDED_EVENT`** — `{ link }` after a link was established.
- **`webexpress.webapp.Event.RELATION_UPDATED_EVENT`** — `{ link }` after its status or note changed.
- **`webexpress.webapp.Event.RELATION_REMOVED_EVENT`** — `{ link }` after a link was removed.

```javascript
element.addEventListener(webexpress.webapp.Event.RELATION_ADDED_EVENT, (e) => {
    console.log(e.detail.link);
});
```

## ViewState

The control is ViewState-capable. Bound with `Resource<TResource>()` it renders the resource slice an enclosing ViewState loads centrally and re-queries that resource after every write, so sibling controls refresh with it. Left unbound it owns its islands and loads itself.

## Server side

The endpoint derives from `WebExpress.WebApp.WebRestApi.RestApiRelation`. It implements the whole generic half — filtering, grouping, the perspective and the validation against `RelationRegistry` — and leaves an implementation only the storage questions: `RetrieveSubject`, `RetrieveLinks`, `RetrieveLink`, `CreateLink`, `UpdateLink`, `DeleteLink` and `Exists`.

See also: [`RelationEditorCtrl`](relation.editor.md).
