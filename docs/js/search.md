![WebExpress](https://raw.githubusercontent.com/webexpress-framework/.github/main/docs/assets/img/banner.png)

# SearchCtrl

The `webexpress.webapp.SearchCtrl` component combines a basic search field and an advanced WQL prompt in one control. A link switches between the two presentations, and both report search changes through a shared event. The C# `ControlAdvancedSearch` renders the `wx-webapp-search` host. Its configuration is read from HTML attributes and a `wx-service` island during initialization.

```
   Basic mode
   ┌──────────────────────────────────────┐
   │ Search text                      [×] │  advanced
   └──────────────────────────────────────┘

   WQL mode
   ┌──────────────────────────────────────┐
   │ WQL expression                       │  basic
   └──────────────────────────────────────┘
```

## Declarative Configuration

The host element carries the `wx-webapp-search` class. The controller creates the basic search field, the WQL prompt and the mode switch inside this element.

| Attribute | Description | Example |
|-----------|-------------|---------|
| `class` | The marker used for automatic initialization. | `class="wx-webapp-search"` |
| `id` | Identifies the control and supplies its default persistence key. Use a stable, unique id across page loads. | `id="issue-search"` |
| `data-initial` | Initial presentation when no valid preference is stored. Accepts `basic` or `wql`; defaults to `basic`. | `data-initial="wql"` |
| `data-value` | Initial text of the embedded basic search field. | `data-value="release"` |
| `data-persist-key` | Explicit localStorage key for the search mode. Overrides the key derived from the host id. | `data-persist-key="issue-search-mode"` |
| `data-wx-resource` | Optional ViewState resource to query when the search changes. | `data-wx-resource="issues"` |
| `data-wx-model-query` | Alternative resource binding; takes precedence over `data-wx-resource`. | `data-wx-model-query="issues"` |
| `data-wx-model` | State key for the basic search text when bound to a ViewState. Defaults to `search`; WQL always uses `wql`. | `data-wx-model="search"` |
| `data-wx-viewstate` | Optional identifier of the ViewState to bind to. Without it, the resource binding determines the ViewState. | `data-wx-viewstate="issue-browser"` |

### WQL Service

A child `wx-service` island named `data` supplies the WQL service endpoint. The controller passes this endpoint to the embedded `webexpress.webapp.WqlPromptCtrl`, which uses the service layer for suggestions, history and validation. Without a service island, the prompt still accepts WQL text.

```html
<wx-service hidden name="data" kind="rest"
            base-uri="/api/issues/wql" method="GET"></wx-service>
```

### Mode Persistence

The selected `basic` or `wql` mode is stored in localStorage under `wx_search_mode_{id}`, or under `data-persist-key` when supplied. Distinct keys keep the preferences of multiple search controls independent.

On initialization, a valid stored mode takes precedence over `data-initial`. Missing or invalid preferences fall back to the declared mode, then to `basic`. A control without an id or explicit storage key does not persist its mode. Blocked or full storage leaves the search usable.

Only the presentation mode is retained as a UI preference. Search text remains in the embedded controls or the bound ViewState. Existing UI cookies are not read or migrated.

## Programmatic Control

Configure the host before initialization. The combined controller communicates search changes through events on its host; it does not expose public `value` or `mode` properties for the embedded controls.

### Accessing an Automatically Created Instance

For a declaratively defined search, retrieve the controller through `webexpress.webui.Controller.getInstanceByElement(element)`.

```javascript
const searchElement = document.getElementById("issue-search");
const searchCtrl = webexpress.webui.Controller.getInstanceByElement(searchElement);
```

The instance is a `webexpress.webapp.SearchCtrl`. Attach application listeners to `searchElement` as shown in the Events section.

### Manual Instantiation

A search can also be created programmatically. Assign its id and initial configuration before constructing the controller so persistence and the initial presentation are resolved together.

```javascript
const container = document.getElementById("search-container");
const searchElement = document.createElement("div");
searchElement.id = "dynamic-search";
searchElement.dataset.initial = "basic";
searchElement.dataset.value = "release";
container.appendChild(searchElement);

const dynamicSearchCtrl = new webexpress.webapp.SearchCtrl(searchElement);
```

## Events

The component dispatches **`webexpress.webui.Event.CHANGE_FILTER_EVENT`** when the basic search changes, when the WQL prompt submits a query, and when the user switches modes. A mode switch reports the current text of the newly visible input. Initial mode restoration does not submit a search.

| Detail Property | Description |
|-----------------|-------------|
| `sender` | The combined search host element. |
| `id` | The id of the combined search host. |
| `value` | The search text or WQL expression. |
| `searchType` | The originating presentation: `basic` or `wql`. |

```javascript
const searchElement = document.getElementById("issue-search");

searchElement.addEventListener(webexpress.webui.Event.CHANGE_FILTER_EVENT, (event) => {
    const { value, searchType } = event.detail;
    if (searchType === "basic" || searchType === "wql") {
        console.log(searchType, value);
    }
});
```

When bound to a ViewState, the control dispatches `viewstate/query` for its resource. A basic search updates the configured search key and clears `wql`; a WQL search updates `wql` and clears the basic search key. Both reset `page` to `0` and query the resource again.

## Use Case Examples

The following examples show the initial presentation, an explicit persistence key and a ViewState binding.

```html
<!-- A basic search with an initial term and a preference derived from its id -->
<div id="issue-search" class="wx-webapp-search"
     data-initial="basic" data-value="release">
</div>

<!-- A search that opens in WQL mode until the user chooses another mode -->
<div id="advanced-issue-search" class="wx-webapp-search"
     data-initial="wql" data-persist-key="advanced-issue-search-mode">
    <wx-service hidden name="data" kind="rest"
                base-uri="/api/issues/wql" method="GET"></wx-service>
</div>

<!-- A search bound to the issues resource of an existing ViewState -->
<div id="bound-issue-search" class="wx-webapp-search"
     data-wx-viewstate="issue-browser"
     data-wx-resource="issues" data-wx-model="search">
    <wx-service hidden name="data" kind="rest"
                base-uri="/api/issues/wql" method="GET"></wx-service>
</div>
```
