![WebExpress](https://raw.githubusercontent.com/webexpress-framework/.github/main/docs/assets/img/banner.png)

# GanttCtrl

The `GanttCtrl` component renders an interactive gantt chart: a task grid on the left and a scrollable timeline on the right, drawn from a pure JSON model of tasks and dependency links. Tasks carry a start date, an end date, a duration in days, a progress percentage and a resource list; tasks with children act as containers whose dates and progress are derived from their subtree and which collapse in the grid. Bars are dragged to reschedule, their edges resize the duration, a small handle adjusts the progress, and dragging a link port at a bar edge onto a port of another bar creates a typed dependency (FS, SS, FF, SF) rendered as an orthogonal connector with an arrowhead. New tasks are created through the toolbar button or a double-click on a free spot in the timeline; the grid cells (name, dates, duration, progress, resources) are edited inline.

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

The same keys (`scale`, `scales`, `columns`, `readonly`, `gridCollapsed`, `zoom`) may instead be seeded through the `wx-state` island via `StateFactory`; island values win over the attributes. Seeding `tasks` and `links` renders the project without an initial `GET`.

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
- `icon` optionally names a per-task icon — a CSS icon class (for example `"fas fa-ship"`) or an image URL, both resolved through the shared icon factory — shown before the task name in the grid and on the bar.
- `type` is one of `FS` (finish-to-start, default), `SS`, `FF` and `SF`. Links that are self-referential, duplicated, dangling or would close a cycle are dropped on load and refused on creation.

### REST Contract

| Method   | URL                 | Body       | Response          | Purpose
|----------|---------------------|------------|-------------------|--------------------------------------------
| `GET`    | `{data}`            | —          | `{ tasks, links }`| Initial load and refresh.
| `POST`   | `{data}/tasks`      | task       | `{ id }` optional | Create a task; a returned id replaces the client id.
| `PUT`    | `{data}/tasks/{id}` | task       | —                 | Persist a change (drag, resize, progress, inline edit).
| `DELETE` | `{data}/tasks/{id}` | —          | —                 | Delete a task (issued per removed subtree member).
| `POST`   | `{data}/links`      | link       | `{ id }` optional | Create a dependency.
| `DELETE` | `{data}/links/{id}` | —          | —                 | Delete a dependency.

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
```

## Events & Callbacks

Every mutation raises a DOM event on the host element and calls the matching assignable callback with the same detail:

| Callback       | DOM event (`webexpress.webapp.GanttCtrl.*`)     | Detail
|----------------|--------------------------------------------------|--------------------------------------
| `onTaskCreate` | `TASK_CREATE_EVENT`                              | `{ task }`
| `onTaskUpdate` | `TASK_UPDATE_EVENT`                              | `{ task, patch }`
| `onTaskDelete` | `TASK_DELETE_EVENT`                              | `{ task, removedIds }`
| `onLinkCreate` | `LINK_CREATE_EVENT`                              | `{ link }`
| `onLinkDelete` | `LINK_DELETE_EVENT`                              | `{ link }`
| —              | `SELECT_EVENT`                                   | `{ taskId, linkId }`

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
- **Drag a link port (circles at the bar edges)** onto a port of another bar — create a dependency. End→start is FS, start→start SS, end→end FF, start→end SF. Invalid drops (self, duplicate, cycle) are refused.
- **Click a connector** — select it; **double-click** or press `Delete` — remove it.
- **Double-click a free spot in the timeline** — create a task at that day, inserted at that row; the name goes straight into inline editing.
- **Double-click a grid cell** — edit the name, dates, duration, progress or resources inline (`Enter`/blur commits, `Escape` cancels).
- **Drag the free timeline surface** — pan the view horizontally and vertically; the connectors of a dragged bar follow it live.
- **Drag the splitter between the panes** — resize the task grid; the chosen width survives re-renders. Columns that no longer fit hide right to left (resources first), while the task name column always stays.
- **Toolbar grid toggle / double-click the splitter** — collapse or expand the task grid, giving the timeline the full width.
- **`Delete`** removes the selected task or link, **`Escape`** clears the selection, **`Ctrl`+wheel** zooms.

## Layout & Theming

The host is a flexible column that fills its container width; its height defaults to `480px` and is overridable through the `--wx-gantt-height` CSS variable, the initial grid pane width through `--wx-gantt-grid-w` (the splitter overrides it interactively). The timeline always fills its pane: when the project range is shorter than the visible width, the scale is padded with filler days. Below `768px` the grid collapses to the name column. All colors derive from the bootstrap theme variables, so the control follows the active theme.
