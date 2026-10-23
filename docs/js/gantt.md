![WebExpress](https://raw.githubusercontent.com/webexpress-framework/.github/main/docs/assets/img/banner.png)

# GanttCtrl

The `GanttCtrl` component renders an interactive gantt chart: a task grid on the left and a scrollable timeline on the right, drawn from a pure JSON model of tasks and dependency links. Tasks carry a start date, an end date, a duration in days, a progress percentage and a resource list; tasks with children act as containers whose dates and progress are derived from their subtree and which collapse in the grid. Bars are dragged to reschedule, their edges resize the duration, a small handle adjusts the progress, and dragging a link port at a bar edge onto another bar creates a typed dependency (FS, SS, FF, SF) rendered as an orthogonal connector with an arrowhead. New tasks are created through the toolbar button or a double-click on a free spot in the timeline; the grid cells (name, dates, duration, progress, resources) are edited inline.

```
   ┌──────────────────────────────────────────────────────────────────────────┐
   │ [+ New task]                       [Day][Week][Month]  [−][+] [Today]    │
   ├────────────────────────────┬─────────────────────────────────────────────┤
   │ Task        Start    Dur.  │        June 2026     │      July 2026       │
   │                            │ 26 27 28 29 30  1  2  3  4  5  6  7  8  9   │
   ├────────────────────────────┼─────────────────────────────────────────────┤
   │ ▾ Rollout   26.06.   8 d   │     ▛▀▀▀▀▀▀▀▀▀▀▀▀▀▀▜                        │
   │    Prepare  26.06.   3 d   │     ▓▓▓▓▓▓░░░░ Anna ──┐                     │
   │    Install  01.07.   4 d   │                       └─▶▓▓▓░░░░░░░ Bob     │
   │ ◆ Go-live   09.07.   0 d   │                                    ◆        │
   └────────────────────────────┴─────────────────────────────────────────────┘
```

## Declarative Configuration

The control is bootstrapped from a single host element carrying the `wx-webapp-gantt` CSS class, which the C# `ControlDataGantt` emits. The endpoint is authored through a `wx-service` island named `data`, the project and the view configuration are optionally seeded through the `wx-state` island; the client resolves both and rewrites the element's contents.

```csharp
new ControlDataGantt("release-plan")
    .DataService<ProjectPlanRestApi>();
```

### Container Element Attributes

| Attribute       | Description                                                                              | Example
|-----------------|------------------------------------------------------------------------------------------|------------------------------
| `data-scale`    | The initial timeline scale: `day`, `week` or `month`. Defaults to `day`.                 | `data-scale="week"`
| `data-scales`   | The scales offered in the toolbar, a comma separated subset. Defaults to all three.      | `data-scales="week,month"`
| `data-columns`  | The grid columns shown, a comma separated subset of `name`, `start`, `end`, `duration`, `progress`, `resources`. Defaults to all; the name column always stays. | `data-columns="name,start,duration"`
| `data-readonly` | Disables every mutating interaction; the timeline stays fully navigable.                 | `data-readonly="true"`
| `data-grid-collapsed` | Starts with the task grid collapsed; the toolbar toggle, a double-click on the splitter or grabbing it bring the grid back. | `data-grid-collapsed="true"`
| `data-sandbox`  | Offers the sandbox in the toolbar (see [Sandbox](#sandbox)). Never offered on a read-only plan. | `data-sandbox="true"`

The same keys (`scale`, `scales`, `columns`, `readonly`, `gridCollapsed`, `sandbox`, `zoom`) may instead be seeded through the `wx-state` island via `StateFactory`; island values win over the attributes. Seeding `tasks` and `links` renders the project without an initial `GET`.

### Data Structure

The model separates data from presentation. A project is a plain JSON structure:

```json
{
    "tasks": [
        { "id": "t1", "label": "Prepare", "start": "2026-06-26", "duration": 3,
          "progress": 60, "resources": ["Anna"], "parentId": "p1" },
        { "id": "p1", "label": "Rollout" },
        { "id": "m1", "label": "Go-live", "start": "2026-07-09", "duration": 0 }
    ],
    "links": [
        { "id": "l1", "from": "t1", "to": "t2", "type": "FS" }
    ]
}
```

- Any two of `start`, `end` and `duration` suffice; the third is derived. A task with `duration: 0` is a milestone (diamond).
- `progress` is clamped to 0..100; `resources` accepts an array of strings, objects with a `name` or a comma separated string.
- `parentId` forms the container hierarchy. A container needs no own dates: start, end and the duration-weighted progress are rolled up from its subtree.
- `icon` optionally names a per-task icon — a CSS icon class (for example `"ship"`) or an image URL, both resolved through the shared icon factory — shown before the task name in the grid and on the bar.
- `type` is one of `FS` (finish-to-start, default), `SS`, `FF` and `SF`. Links that are self-referential, duplicated, dangling or would close a cycle are dropped on load and refused on creation.

### Working Calendar

The calendar is supplied as data by the surrounding application through `calendar` in the project response or the `wx-state` island. The C# `Calendar` factory can supply the same object through `data-calendar`. DataGantt does not provide a calendar editor or maintain a regional holiday catalogue. An explicit calendar enables working-day durations; an omitted or null initial calendar retains calendar-day durations.

The calendar structure contains `workingDays`, using Sunday as `0` through Saturday as `6`, and `holidays`, containing ISO date strings. An omitted or invalid empty workweek defaults to Monday through Friday. Invalid holiday dates are ignored and duplicate dates are removed. Project responses that omit `calendar` retain the control's current configuration; `calendar: null` explicitly clears it.

```json
{
    "calendar": {
        "workingDays": [1, 2, 3, 4, 5],
        "holidays": ["2026-07-06"]
    },
    "tasks": [
        { "id": "review", "label": "Review", "start": "2026-07-03", "duration": 2 }
    ],
    "links": []
}
```

The date interval includes the start and excludes the finish. In this example Friday and Tuesday contribute effort, so the task finishes at the start of Wednesday, July 8. A single working day on Friday finishes at the start of Saturday. The bar always spans calendar dates, while the duration column reports effort. Weekly non-working days and explicit holidays are shaded on the day scale.

The editing rules use the same calendar throughout normalization, creation, start-date changes, drag previews, moves, edge resizing and container rollups. Moving a task preserves effort and snaps its start in the drag direction. Creation and direct date entry snap forward. Resizing retains at least one working day; entering zero in the duration cell creates a milestone. Entering a positive duration converts a milestone back to a task.

The endpoint integration uses `RetrieveCalendar(IRequest)` to return a `RestApiGanttCalendar`. Applications own holiday calculation and calendar persistence. The nullable `RestApiGanttTask.Duration` distinguishes an omitted duration, which is derived from dates, from the explicit zero used for milestones.

```csharp
protected override RestApiGanttCalendar RetrieveCalendar(IRequest request)
{
    return new RestApiGanttCalendar
    {
        WorkingDays = [1, 2, 3, 4, 5],
        Holidays = ["2026-07-06"]
    };
}
```

### Dependency Editing

The relationship type selects the source and target bar boundaries. Selecting a connector exposes a localized type selector and a delete action in the toolbar. Read-only plans show the relationship without enabling changes. A link gesture starts at a source port and accepts a drop anywhere inside the target bar, including its label or progress fill. The left half selects the target start and the right half selects its finish. An explicit target port always selects its own boundary. The candidate bar and boundary are highlighted only when the link passes validation.

| Type | Source boundary | Target boundary |
|------|-----------------|-----------------|
| FS | Finish | Start |
| SS | Start | Start |
| FF | Finish | Finish |
| SF | Start | Finish |

The update API is `updateLink(id, { type, from, to })`, where omitted fields retain their values. It preserves the link identity, rejects invalid types, missing endpoints, self references, duplicate pairs and cycles, and persists the complete link using `PUT /links/{id}`. A successful local edit raises `webexpress.webapp.gantt.link.update` and invokes `onLinkUpdate` with `{ link }`. Dependencies describe relationships and do not automatically reschedule successor tasks.

The server integration requires overriding `UpdateLink(id, link, request)` to persist link edits. The base hook returns null until implemented, which produces HTTP 404. Invalid payloads produce HTTP 400. Applications must enforce graph consistency transactionally in their persistence hooks when multiple clients can edit the same project.

### REST Contract

| Method   | URL                 | Body       | Response          | Purpose
|----------|---------------------|------------|-------------------|--------------------------------------------
| `GET`    | `{data}`            | —          | `{ tasks, links }`| Initial load and refresh.
| `POST`   | `{data}/tasks`      | task       | `{ id }` optional | Create a task; a returned id replaces the client id.
| `PUT`    | `{data}/tasks/{id}` | task       | —                 | Persist a change (drag, resize, progress, inline edit).
| `DELETE` | `{data}/tasks/{id}` | —          | —                 | Delete a task (issued per removed subtree member).
| `POST`   | `{data}/links`      | link       | `{ id }` optional | Create a dependency.
| `PUT`    | `{data}/links/{id}` | link       | link              | Update a dependency type or its endpoints.
| `DELETE` | `{data}/links/{id}` | —          | —                 | Delete a dependency.

Every mutation is shown before its request completes. When the server refuses a write, the chart takes the change back and shows a popup notification instead of hiding the timeline: a refused new link is removed and a refused link edit restores the previous link, while a refused task change or link deletion reloads the stored plan. The popup uses the `message` of a JSON error body when the server sends one, and a generic "not saved" text otherwise. The control also dispatches `webexpress.webui.data.error` with `{ action, error }`. The inline error panel with its retry action appears only when the initial load or a refresh fails. A `DELETE` answered with 404 is not a refusal: the resource is gone, which is what the deletion asked for. This keeps a server that cascades a container deletion over its subtree and links from turning the follow-up deletions into error popups.

### Sandbox

In the sandbox a planner can try out changes without the stored plan, or anyone else looking at it, seeing the steps in between. `ControlDataGantt.Sandbox = _ => true` (or `data-sandbox="true"`) adds a sandbox button with a flask icon to the toolbar; its name and hint show as tooltip and accessible label. While the sandbox is open:

- a strip below the toolbar and a highlighted frame show that nothing is stored yet, together with the number of pending changes;
- every interaction works as usual, but no request is sent; the control only records which tasks and links were touched;
- reloads (a refresh, or a new slice from the ViewState) are held back so they cannot wipe the sandbox, and run once it closes;
- leaving the page while changes are pending makes the browser ask for confirmation (`beforeunload`); an untouched sandbox lets the page go.

**End sandbox** closes it right away when nothing is left to store. Otherwise the strip asks what to do with the changes: **Save all changes**, **Discard changes** or **Keep editing**.

- **Save** sends the net result: one request per touched resource, compared with its state when the sandbox opened. A task changed ten times costs one `PUT`, and a task created and deleted again costs nothing. The requests go out one after another in an order the server can follow: created tasks (parents first), changed tasks, deleted links, changed links, created links, deleted tasks (children first). A server id returned for a created task replaces the client id before its children and links are sent. If the server refuses a request, the save stops, the refusal shows as a popup and the sandbox stays open with exactly the changes not stored yet, ready to be corrected and saved again, or discarded.
- **Discard** restores the plan as it was when the sandbox opened. If a save already stored part of the changes, or a reload was held back, the plan is reloaded instead, since the entry state is then no longer what the server holds.

The mutation events (`TASK_CREATE_EVENT`, …) still fire inside the sandbox, because they describe what the user did on screen. Their detail carries `sandbox: true` there, so a listener that mirrors the stored plan can skip them and react to `SANDBOX_LEAVE_EVENT` with `saved: true` instead.

## Programmatic Control

Once initialized, the `GanttCtrl` instance is retrievable via `getInstanceByElement(element)`.

```javascript
const element = document.querySelector(".wx-gantt");
const gantt = webexpress.webui.Controller.getInstanceByElement(element);

// read or replace the whole project (a defensive copy)
const project = gantt.value;
gantt.value = { tasks: [...], links: [...] };

// mutations: persisted REST-fully, raising the matching events
const task = gantt.addTask({ label: "Review", start: "2026-07-13", duration: 2, resources: ["Anna"] });
gantt.updateTask(task.id, { progress: 50 });
gantt.addLink("t1", task.id, "FS");
gantt.updateLink("l1", { type: "FF" });
gantt.removeLink("l1");
gantt.removeTask(task.id);          // cascades over the subtree and attached links

// view
gantt.setScale("month");            // "day" | "week" | "month"
gantt.zoomIn(); gantt.zoomOut(); gantt.setZoom(1.5);
gantt.scrollToToday();
gantt.toggleCollapse("p1");         // collapse/expand a container (view only)
gantt.toggleGrid();                 // collapse/expand the task grid pane
gantt.select("t1");                 // or gantt.select(null, "l1") for a link
gantt.refresh();                    // re-fetch from the endpoint

// sandbox
gantt.enterSandbox();               // false when already open or read-only
gantt.inSandbox;                    // true while open
gantt.sandboxChangeCount();         // requests a save would send
gantt.endSandbox();                 // closes at once without changes, otherwise asks in the strip
await gantt.saveSandbox();          // true when everything was stored and the sandbox closed
gantt.discardSandbox();             // restores the state on entry
```

## Events & Callbacks

Every mutation raises a DOM event on the host element and calls the matching assignable callback with the same detail. Every detail also carries `sandbox`, which is `true` while the [sandbox](#sandbox) is open, so the change exists only on screen, and `false` otherwise:

| Callback       | DOM event (`webexpress.webapp.GanttCtrl.*`)     | Detail
|----------------|--------------------------------------------------|--------------------------------------
| `onTaskCreate` | `TASK_CREATE_EVENT`                              | `{ task }`
| `onTaskUpdate` | `TASK_UPDATE_EVENT`                              | `{ task, patch }`
| `onTaskDelete` | `TASK_DELETE_EVENT`                              | `{ task, removedIds }`
| `onLinkCreate` | `LINK_CREATE_EVENT`                              | `{ link }`
| `onLinkDelete` | `LINK_DELETE_EVENT`                              | `{ link }`
| —              | `SELECT_EVENT`                                   | `{ taskId, linkId }`
| —              | `SANDBOX_ENTER_EVENT`                            | `{}`
| —              | `SANDBOX_LEAVE_EVENT`                            | `{ saved }`

```javascript
gantt.onTaskUpdate = ({ task, patch }) => console.log("rescheduled", task.id, patch);

element.addEventListener(webexpress.webapp.GanttCtrl.LINK_CREATE_EVENT, (e) => {
    console.log("linked", e.detail.link.from, "→", e.detail.link.to, e.detail.link.type);
});
```

## Interaction Reference

- **Drag a bar** — move the task by whole days (duration preserved).
- **Drag a bar edge** — resize; the duration never falls below one day. Milestones and containers are not resizable.
- **Drag the small bottom handle** — adjust the progress percentage.
- **Drag a link port (circles at the bar edges)** onto another bar — create a dependency. End→start is FS, start→start SS, end→end FF, start→end SF. Invalid drops (self, duplicate, cycle) are refused.
- **Click a connector** — select it; **double-click** or press `Delete` — remove it.
- **Double-click a free spot in the timeline** — create a task at that day, inserted at that row; the name goes straight into inline editing.
- **Double-click a grid cell** — edit the name, dates, duration, progress or resources inline (`Enter`/blur commits, `Escape` cancels).
- **Drag the free timeline surface** — pan the view horizontally and vertically; the connectors of a dragged bar follow it live.
- **Drag the splitter between the panes** — resize the task grid; the chosen width survives re-renders. Columns that no longer fit hide right to left (resources first), while the task name column always stays.
- **Toolbar grid toggle / double-click the splitter** — collapse or expand the task grid, giving the timeline the full width.
- **`Delete`** removes the selected task or link, **`Escape`** clears the selection, **`Ctrl`+wheel** zooms.

## Layout & Theming

The host is a flexible column that fills its container width; its height defaults to `480px` and is overridable through the `--wx-gantt-height` CSS variable, the initial grid pane width through `--wx-gantt-grid-w` (the splitter overrides it interactively). The timeline always fills its pane: when the project range is shorter than the visible width, the scale is padded with filler days. Below `768px` the grid collapses to the name column. All colors derive from the WebExpress theme variables, so the control follows the active theme.

### Filling the pane

A height of its own is right for a plan shown among other blocks on a page. Where the chart *is* the view, it is wrong: inside an application shell the page does not scroll, the panes do, and a chart with its own height either leaves dead space below it or reaches past the pane, which then scrolls around panes that already scroll. `Fill` takes the height from the host instead:

```csharp
new ControlDataGantt("plan")
{
    Fill = _ => true
};
```

The host is marked `wx-fill`, and a flex column host then drives the chart: it grows into the free space and shrinks with it. In a `WebExpress.WebApp` shell the content panel becomes one on its own as soon as a filling control is on the page, so `Fill` is all a page there has to set; elsewhere, make the host a flex column with `min-height: 0`. A host that hands nothing down leaves the chart at `--wx-gantt-height`, **never at its content height** - the grid and the timeline are scrollports, and a scrollport only exists while its container is bounded. `max-height: 100%` keeps the chart inside a host that does have an extent.
