![WebExpress](https://raw.githubusercontent.com/webexpress-framework/.github/main/docs/assets/img/banner.png)

# ScrumTeamCtrl

The `ScrumTeamCtrl` component renders the people working in the current sprint as a compact row of avatars, each badged with the story points assigned to that person. Only the first *N* people are shown inline; the rest collapse into a `+N` overflow chip. A trailing total chip sums the committed points. Clicking any avatar, the overflow chip or the total chip opens a modal that lists **every** person as a table that breaks their load down into **completed** and **planned** story points — with a per-person completion bar — sorted by the heaviest load first and closed by a total row for each column.

The layout mirrors the [`WatcherCtrl`](watcher.md) so the two avatar surfaces read alike. Unlike the watcher, this control is read-only: it loads its data via a single `GET` and never mutates it.

```
   ┌──────────────────────────────────────────────────────────┐
   │ (GT⁸) (EM¹³) (LC⁵) (VL³) … +4   [ Σ 47 pts ]             │
   │                                       │                  │
   │                                       ▼                  │
   │         ┌──────────────────────────────────────────┐     │
   │         │ Sprint team                         [×]  │     │
   │         ├──────────────────────────────────────────┤     │
   │         │ Person                 Completed Planned │     │
   │         │ (GT) Guybrush · Pirates       5      13  │     │
   │         │ (EM) Elaine · Gov             8       8  │     │
   │         │ (LC) Captain LeChuck · Ghosts 2       5  │     │
   │         │ …                                        │     │
   │         ├──────────────────────────────────────────┤     │
   │         │ Total                        15      47  │     │
   │         └──────────────────────────────────────────┘     │
   └──────────────────────────────────────────────────────────┘
```

## Declarative Configuration

The control is bootstrapped from a single host element carrying the `wx-webapp-scrum-team` CSS class. The endpoint is authored in C# through a `wx-service` island named `data`; the client resolves it and rewrites the element's contents to render the avatar row.

### Container Element Attributes

| Attribute            | Description                                                                                          | Example
|----------------------|-----------------------------------------------------------------------------------------------------|------------------------------
| `data-max-visible`   | Maximum number of avatars rendered inline before the overflow chip (`+N`) appears. Defaults to `6`. | `data-max-visible="4"`

The data endpoint is not spelled as an attribute. It is contributed in C# by `.DataService<TEndpoint>()` on `ControlDataScrumTeam`, which emits the hidden `wx-service` island the client consumes.

### REST Contract

| Method   | URL            | Body | Response                | Purpose
|----------|----------------|------|-------------------------|-------------------------------------------
| `GET`    | `{data}`       | —    | `TeamMember[]`          | Initial load and refresh.

`TeamMember` objects are expected to carry at least `id`, `name` and `points` (the planned/committed load), and optionally `completed` (the points already done), `team`, `initials` and `color` (a CSS color used as the avatar background). When `initials` is omitted, the client derives them from the name; when `color` is omitted, a neutral grey is used; `points` and `completed` are coerced to non-negative integers and `completed` is clamped so it never exceeds `points`.

```json
[
    { "id": "guybrush", "name": "Guybrush Threepwood", "team": "Mighty Pirates", "initials": "GT", "color": "#1d4ed8", "points": 13, "completed": 5 },
    { "id": "elaine",   "name": "Elaine Marley",       "team": "Governor's Office", "initials": "EM", "color": "#7c3aed", "points": 8, "completed": 8 }
]
```

## Programmatic Control

Once initialized, the `ScrumTeamCtrl` instance is retrievable via `getInstanceByElement(element)` for refreshing the list or reading the current members.

```javascript
// find the host element in the DOM
const teamElement = document.querySelector(".wx-webapp-scrum-team");

// retrieve the controller instance associated with the element
const teamCtrl = webexpress.webui.Controller.getInstanceByElement(teamElement);

// force a re-fetch from the server (useful after the sprint composition changes)
if (teamCtrl) {
    teamCtrl.refresh();
}

// read the current members (a copy of { id, name, team, initials, color, points, completed })
const members = teamCtrl ? teamCtrl.value : [];
```

## Events

The component dispatches the standard data lifecycle events on the host element. All events bubble.

- **`webexpress.webui.Event.DATA_REQUESTED_EVENT`** — fired before the `GET` is issued.
- **`webexpress.webui.Event.DATA_ARRIVED_EVENT`** — fired after the members have loaded successfully.
- **`webexpress.webui.Event.UPDATED_EVENT`** — fired after every render of the avatar row.

```javascript
teamElement.addEventListener(webexpress.webui.Event.DATA_ARRIVED_EVENT, () => {
    console.log("Sprint team loaded");
});
```

## Use Case Examples

The following example wires a `ScrumTeamCtrl` into a sprint detail page. The avatar row sits inside a sidebar card and is fed by the team workload endpoint.

```html
<!-- Sidebar card -->
<div class="wx-webapp-side-card">
    <div class="wx-webapp-side-row">
        <span class="wx-webapp-side-label">Team</span>
        <span class="wx-webapp-side-value">
            <!-- The scrum team control: bootstraps itself from the wx-service island -->
            <div class="wx-webapp-scrum-team" data-max-visible="6"></div>
        </span>
    </div>
</div>
```

Authored in C# with the fluent data surface:

```csharp
new ControlDataScrumTeam("sprint-team")
{
    MaxVisible = _ => 6
}
    .DataService<RestApiScrumTeam>();
```
