![WebExpress](https://raw.githubusercontent.com/webexpress-framework/.github/main/docs/assets/img/banner.png)

# StatusTaskCtrl

The `StatusTaskCtrl` component renders the lifecycle of a server-side task (`WebTask`) as a **single colored dot**. It consumes the exact same live pipeline as the [progress bar](#relationship-to-progresstaskctrl): the server pushes every state change (start, progress tick, message change, finish, cancel) over the **MessageQueue WebSocket** (see `WebExpress.WebApp.WebMessageQueue.ProgressTaskDispatcher`), and on (re)connect the dispatcher replays the current snapshot of every active task. Instead of a bar, the state is condensed into one at-a-glance signal, so a dense surface — a table row, a list item, a header — can carry a status without the footprint of a progress bar.

```
   task state            dot
   ─────────────────     ───
   Created   (0)   →     ● gray    pending
   Run       (1)   →     ● blue    running   (pulses)
   Finish    (3)   →     ● green   done
   Canceled  (2)   →     ● red     error
   (static only)   →     ● yellow  warning
```

Because every relevant lifecycle event is broadcast as it happens, the dot reacts immediately without any HTTP roundtrip, survives page navigation and reconnects, and updates in lockstep across multiple windows and with a `ControlProgressTask` bound to the same task.

## Declarative Configuration

The control is bootstrapped from a single host element carrying the `wx-webapp-status-task` CSS class. It reads its configuration from `data-` attributes, then replaces its content with the dot and an optional caption.

### Container Element Attributes

| Attribute             | Description                                                                                                   | Example
|-----------------------|---------------------------------------------------------------------------------------------------------------|----------------------------
| `data-task`           | Optional. The id of the task to follow. The controller filters incoming `webexpress.webapp.progresstask.update` messages by this id. When absent the control is a **static** dot driven by `data-status`. | `data-task="deploy-42"`
| `data-status`         | Optional. The static status token (`pending`, `running`, `warning`, `error`, `done`) shown when the control is not driven by a task. The implicit default is `none` (a dim, outlined dot). | `data-status="warning"`
| `data-label`          | Optional. The caption of a **static** dot, and the tooltip fallback of every dot. A **task-driven** dot captions the live server `message` instead (see the [data contract](#data-contract)), so the caption follows the current step and stays empty until the first update. | `data-label="Deployment"`
| `data-show-on-start`  | When `"true"`, the control stays hidden until the first update for the task arrives.                          | `data-show-on-start="true"`
| `data-hide-on-finish` | When `"true"`, the control hides itself once the task finishes or is canceled.                                | `data-hide-on-finish="true"`
| `data-auto-start`     | When `"true"` (and a starter service is configured), the dot posts to the start endpoint on load instead of on a click. | `data-auto-start="true"`
| `data-repeat`         | When `"true"` (and a starter service is configured), the dot restarts the task once it finishes successfully. A cancel or an error ends the loop. | `data-repeat="true"`

A `starter` [service island](#task-starter) makes the dot a task starter.

The dot's color is applied through the `wx-status-dot-{pending,running,warning,error,done}` modifier classes on an inner `.wx-status-dot` span; the `running` state pulses. The host follows the page theme.

The control is authored in C# through the fluent surface, so the host element is produced by:

```csharp
// task driven: the dot follows the task live
new ControlStatusTask("crew-status")
{
    TaskId = _ => "sword-fighting-insult-status-task"
};

// static: a plain status point, e.g. inside a table row or a header
new ControlStatusTask("build-status")
{
    Status = _ => TypeStatusTask.Warning,
    Label = _ => "Build"
};

// task starter: a click posts to the start endpoint, the dot follows the
// started task, and repeat restarts it on a successful finish
new ControlStatusTask("deploy-status")
{
    AutoStart = _ => false,
    Repeat = _ => true
}
.Service("starter", svc => svc.Endpoint<StartDeployApi>().Method(HttpMethod.Post));
```

## Task Starter

A `ControlStatusTask` becomes a **task starter** when it declares a `starter` service — a `POST` endpoint, emitted as a hidden `wx-service` island named `starter`. The dot then drives the whole task lifecycle from the client:

1. On a **click** (or on **load** when `data-auto-start` is set) the dot posts to the start endpoint.
2. The server **starts the task** and answers with its id (a plain string, or an object with `taskId`/`id`). The dot adopts that id and follows it over the MessageQueue, exactly as a fixed `data-task` dot does. So the id need not be known when the page renders.
3. The dot goes **pending** the moment a start is triggered, before the first server update arrives, so the trigger is acknowledged immediately.
4. With `data-repeat` a **successful finish** posts to the start endpoint again. A cancel or an error **ends** the loop, so a failing task never restarts forever.

A starter dot carries the `wx-status-task-starter` class, `role="button"` and `tabindex="0"`, so it reads and is operable as a button (Enter/Space activate it). The start posts through the service layer (`webexpress.webapp.ServiceRegistry`), never a bare `fetch`.

| `starter` island attribute | Value
|----------------------------|----------------------------------
| `name`                     | `starter`
| `kind`                     | `rest`
| `base-uri`                 | The start endpoint, resolved through the sitemap.
| `method`                   | `POST`

## Data Contract

Task **updates** never use a REST endpoint. Every update arrives as a `webexpress.webapp.progresstask.update` message over the MessageQueue WebSocket — the same message the progress bar consumes — so one server pipeline drives both surfaces. The optional [starter](#task-starter) endpoint is the only HTTP call, and only to *start* the task, not to observe it.

| Field      | Type     | Purpose
|------------|----------|--------------------------------------------------------------
| `type`     | string   | Always `webexpress.webapp.progresstask.update`.
| `taskId`   | string   | The task the update refers to; the controller ignores updates for other ids.
| `state`    | number   | The `WebTask.TaskState`: `0` Created, `1` Run, `2` Canceled, `3` Finish. Mapped to the dot color.
| `progress` | number   | 0–100. Unused by the dot (it shows state, not amount).
| `message`  | string   | Optional status text; shown as the dot's **caption** (and tooltip), so the caption follows the current step the server reports.

`warning` is intentionally **not** part of the task lifecycle, so it is only reachable through a static `data-status`. This keeps the wire contract identical to the progress bar while still exposing the full status palette to a static dot.

## Programmatic Control

Once initialized, the `StatusTaskCtrl` instance is retrievable via `getInstanceByElement(element)`. Its `value` getter/setter exposes the current status token; assigning it repaints the dot (this does not persist anything, it is a client-side display).

```javascript
// find the host element in the DOM by its id
const element = document.getElementById("build-status");

// retrieve the controller instance associated with the element
const status = webexpress.webui.Controller.getInstanceByElement(element);

if (status) {
    console.log(status.value); // e.g. "running"
    status.value = "done";     // repaint the dot green
}
```

When the control is a [task starter](#task-starter), `start()` posts to the start endpoint, adopts the returned task id and returns a promise that resolves `true` when the task was started. Overlapping starts are ignored, and a `start()` on a dot without a starter service is a no-op.

```javascript
const element = document.getElementById("deploy-status");
const status = webexpress.webui.Controller.getInstanceByElement(element);

status.start().then((started) => {
    if (started) {
        console.log("the task was started and the dot now follows it");
    }
});
```

## Events

The following events are dispatched on the host and **bubble**. They are shared with `ProgressTaskCtrl`, so existing task listeners keep working when a bar is swapped for a dot.

- **`webexpress.webui.Event.TASK_UPDATE_EVENT`** — fired on every non-final update. `event.detail` contains `{ taskid }`.
- **`webexpress.webui.Event.TASK_FINISH_EVENT`** — fired once when the task reaches `Finish` or `Canceled`.
- **`webexpress.webui.Event.SHOW_EVENT`** — fired when a `data-show-on-start` dot reveals itself on the first update.
- **`webexpress.webui.Event.HIDE_EVENT`** — fired when a `data-hide-on-finish` dot hides itself after the task finishes.

```javascript
element.addEventListener(webexpress.webui.Event.TASK_FINISH_EVENT, (e) => {
    console.log("task finished:", e.detail.taskid);
});
```

## Relationship to ProgressTaskCtrl

`StatusTaskCtrl` and [`ProgressTaskCtrl`](https://webexpress-framework.github.io/WebExpress.WebApp/) are two renderings of the **same** task pipeline:

- both subscribe to `webexpress.webapp.MessageQueue` and filter by `taskId`;
- both map the `WebTask.TaskState` and dispatch the same task events;
- the bar shows the *amount* of progress, the dot shows the *state* at a glance.

Bind both to the same `TaskId` and they update in lockstep — use the bar where there is room for a detailed overlay, and the dot where space is tight.
