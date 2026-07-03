![WebExpress](https://raw.githubusercontent.com/webexpress-framework/.github/main/docs/assets/img/banner.png)

# DropdownThemeCtrl

The `webexpress.webapp.DropdownThemeCtrl` is a REST-backed theme picker that extends `webexpress.webui.DropdownCtrl`. It loads the themes registered for the current application from a REST endpoint, surfaces the active theme as the dropdown's label so exactly one theme is always selected, hands the user's choice to the application via a `PUT`, and reloads the page. The framework does **not** persist the choice itself - storage is owned by the application, which also tells the visual tree which theme to use on subsequent renders.

```
   ┌──────────────────────────────────────────────┐
   │ Theme B                                   ▾  │
   ├──────────────────────────────────────────────┤
   │ Theme A                                      │
   │ Theme B                                      │
   │ Theme C                                      │
   └──────────────────────────────────────────────┘
```

## Declarative Configuration

The control is rendered server-side by `ControlDataSelectionTheme`. Manual HTML usage is also supported:

|Attribute                |Description
|-------------------------|-----------------------------------------------------------------
|`class`                  |Must contain `wx-webapp-dropdown-theme`.
|`data-uri`               |REST endpoint returning the theme list (see contract below).
|`data-reload-on-change`  |Set to `"false"` to keep the page after a selection (default reloads).

```html
<div class="wx-webapp-dropdown-theme"
     id="themeSelector"
     data-uri="/app/api/1/themeapi"></div>
```

## REST Data Contract

### `GET` - list

Returns the themes for the request's application:

```json
{
  "items": [
    { "id": "myapp.themes.default", "content": "Default Theme", "name": "Default Theme" },
    { "id": "myapp.themes.light",   "content": "Light Icons",   "name": "Light Icons", "selected": true }
  ],
  "selected": "myapp.themes.light"
}
```

The `selected` field on the envelope tells the dropdown which entry to mark as the active label; when it is empty, the first item is chosen so the dropdown is never blank. The value comes from `RestApiTheme.GetActiveThemeId`, which the application overrides to read from its own store.

### `PUT` / `POST` - persist

Body (`application/x-www-form-urlencoded`):

```
v=<themeId>
```

An empty value clears the preference. The endpoint calls `RestApiTheme.PersistSelection` so the application can write the value wherever it likes (session, identity profile, database, …). The response carries no cookie - the framework deliberately leaves persistence to the application.

## Server-side Integration

```csharp
// 1. expose RestApiTheme under a routable name (one per application) and
//    plug its persistence hooks into your own storage:
[Title("Theme Selector")]
public sealed class ThemeApi : RestApiTheme
{
    protected override string GetActiveThemeId(IQueryContext c, IRequest r)
        => MyStore.Get(r);                 // your store - file, db, session, …

    protected override void PersistSelection(string v, IQueryContext c, IRequest r)
        => MyStore.Set(r, v);
}

// 2. drop the selector onto a page - it is a standalone dropdown:
new ControlDataSelectionTheme("themeSelector")
{
    RestUri = _ => sitemapManager.GetUri<ThemeApi>(applicationContext)
};

// 3. tell the visual tree which theme to render with on every request -
//    the framework does not consult your store on its own:
public override void Process(IRenderContext ctx, VisualTreeWebApp visualTree)
{
    if (MyStore.Get(ctx.Request) == typeof(LightIconTheme).FullName?.ToLower())
        visualTree.UseTheme<LightIconTheme>();
    else
        visualTree.UseTheme<DefaultIconTheme>();

    base.Process(ctx, visualTree);
}
```

`RestApiTheme` (the abstract base) ships with WebExpress.WebApp; the derivation in step 1 gives the endpoint a routable identity in the host application's namespace and wires the persistence hooks.

## Resolution Order

The visual tree picks the active theme in the following order:

1. Explicit per-request `visualTree.UseTheme<TTheme>()` (called by application code from the page's `Process` override based on whatever the application stored).
2. Application's `[Theme<TTheme>]` default.
3. First theme registered for the application (legacy fallback).
4. `null` -> icon theme falls back to `TypeIconTheme.Default`.

The framework does NOT inspect cookies, sessions, or identities - persistence and theme activation are owned by the application.

## Events

The control reuses the events of the underlying `webexpress.webui.DropdownCtrl`:

- `webexpress.webui.Event.CLICK_EVENT` - fired when the user picks an entry; the controller listens for this internally to trigger the persistence `PUT`.
- `webexpress.webui.Event.CHANGE_VISIBILITY_EVENT` - emitted when the menu opens or closes.
