![WebExpress](https://raw.githubusercontent.com/webexpress-framework/.github/main/docs/assets/img/banner.png)

# InputCascadingCtrl

The `webexpress.webapp.InputCascadingCtrl` component renders a cascading selection whose option levels are fetched from a REST endpoint on demand. It extends the static `webexpress.webui.InputCascadingCtrl` from WebExpress.WebUI (see the WebUI documentation for the declarative base control): each level is rendered as a selection input, and choosing a node reveals the next level. In remote mode the root level is loaded from the endpoint on mount, and the children of a selected node are requested only when that node is chosen for the first time. Responses are cached per parent, so navigating back and forth does not repeat requests.

```
   ┌───────────────────────────┐
   │ Europe                ▼   │   GET /api/v1/regions
   ├───────────────────────────┤
   │ Germany               ▼   │   GET /api/v1/regions?parent=europe
   ├───────────────────────────┤
   │ Select an option      ▼   │   GET /api/v1/regions?parent=germany
   └───────────────────────────┘
   hidden input value: "europe;germany"
```

## Declarative Configuration

The control is bootstrapped from a host element carrying the `wx-webapp-input-cascading` CSS class, which the C# `ControlDataFormItemInputCascading` emits. The endpoint is authored through a `wx-service` island named `data`. Without a service island the control behaves exactly like the WebUI base and renders the statically declared `.wx-cascading-item` children.

```csharp
new ControlForm(null,
    new ControlDataFormItemInputCascading("region")
    {
        Label = _ => "Region",
        Placeholder = _ => "Select an option"
    }
    .DataService<RegionRestApi>()
);
```

### Container Element Attributes

| Attribute | Description |
| --- | --- |
| `id` | Transferred to the hidden input for form submission. |
| `name` | The form field name of the hidden input. |
| `placeholder` | The placeholder shown on every level's selection input. |
| `data-value` | Optional initial path as a semicolon-separated id list. |

### REST Contract

The endpoint serves one level per request and is queried with GET:

| Request | Description |
| --- | --- |
| `GET {baseUri}` | Returns the root level nodes. |
| `GET {baseUri}?parent={id}` | Returns the children of the node with the given id. |

The response is a JSON array of node objects:

```json
[
    {
        "id": "europe",
        "label": "Europe",
        "labelColor": null,
        "icon": "globe",
        "image": null,
        "content": "<b>Europe</b>",
        "disabled": false
    }
]
```

- `label` falls back to `name`, `content` falls back to `html`; both are optional.
- A node may embed its `children` inline; the embedded subtree is then used without further requests.
- A node without a `children` property is expanded lazily: its children are fetched via `?parent={id}` when the node is selected. An empty array marks a leaf.
- A failed request is logged to the console and cached as an empty level, so a broken endpoint does not cause a request storm while the user navigates.

## Programmatic Control

Once initialized, the instance is retrievable via `getInstanceByElement(element)`. The inherited `value` getter/setter exposes the selected path as an array of node ids; the setter also accepts a semicolon-separated string.

```javascript
const element = document.querySelector(".wx-cascading");
const cascadingCtrl = webexpress.webui.Controller.getInstanceByElement(element);

// read the current path
console.log(cascadingCtrl.value); // e.g. ["europe", "germany"]

// preselect a path; each level renders as its nodes arrive
cascadingCtrl.value = "europe;germany";
```

## Events

| Event | Description |
| --- | --- |
| `webexpress.webui.Event.CHANGE_VALUE_EVENT` | Raised whenever the selected path changes; the detail carries the path as `{ value: [...] }`. |

## Form Submission

The selected path is mirrored into a hidden input as a semicolon-separated id list (for example `europe;germany`), so a surrounding form submits the cascading selection like any other field.
