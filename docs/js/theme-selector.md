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
|`data-reload-on-change`  |Set to `"false"` to keep the page after a selection (default reloads).

```html
<div class="wx-webapp-dropdown-theme"
     id="themeSelector">
    <wx-service hidden name="data" base-uri="/app/api/1/themeapi"></wx-service>
</div>
```

The REST endpoint returning the theme list (see contract below) is the `data` service, a hidden `wx-service` island inside the host. Rendered from C#, `ControlDataSelectionTheme` emits the island through `.DataService<TEndpoint>()`.

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
    RestEndpoint = _ => sitemapManager.GetUri<ThemeApi>(applicationContext)
};

// 3. tell the visual tree which theme to render with on every request -
//    the framework does not consult your store on its own:
public override void Process(IRenderContext ctx, VisualTreeWebApp visualTree)
{
    if (MyStore.Get(ctx.Request) == typeof(LightModeTheme).FullName?.ToLower())
        visualTree.UseTheme<LightModeTheme>();
    else
        visualTree.UseTheme<DarkModeTheme>();

    base.Process(ctx, visualTree);
}
```

`RestApiTheme` (the abstract base) ships with WebExpress.WebApp; the derivation in step 1 gives the endpoint a routable identity in the host application's namespace and wires the persistence hooks.

## Resolution Order

The visual tree picks the active theme in the following order:

1. Explicit per-request `visualTree.UseTheme<TTheme>()` (called by application code from the page's `Process` override based on whatever the application stored).
2. Application's `[Theme<TTheme>]` default.
3. First theme registered for the application (legacy fallback).
4. `null` -> the page renders without a theme.

The framework does NOT inspect cookies, sessions, or identities - persistence and theme activation are owned by the application.

## Appearance

The button reads as a choice: `ControlDataSelectionTheme` defaults to an outlined secondary button with a caret and a hover text. The menu is a single choice - every entry is a `menuitemradio`, the one in use carries `aria-checked="true"` and the `active` highlight. A pick the server refuses (non-2xx or network failure) restores the previous caption and mark instead of showing the refused value as the one in use.

## Icon Sets

The same dropdown picks an icon set. An icon set (`IconSet`) is a stylesheet of mask rules, linked after the framework rules it overrides; `IconSet.Default` stands for the framework drawings and should be offered first, because the dropdown shows the first entry while nothing is stored.

```csharp
// 1. offer the sets next to the themes (once, in the application constructor)
ThemePreferences.RegisterIconSets(applicationContext,
    [IconSet.Default, new IconSet("pirates", "myapp:iconset.pirates", null, "assets/css/pirates.icons.css")],
    ctx => MyStore.GetIconSet(ctx.Request),
    () => new ControlDataSelectionIconSet("iconSetSelector").DataService<IconSetApi>());

// 2. the endpoint: RestApiIconSet already refuses ids that are not offered
public sealed class IconSetApi : RestApiIconSet
{
    protected override string GetActiveIconSetId(IQueryContext c, IRequest r) => MyStore.GetIconSet(r);
    protected override void PersistSelection(string id, IQueryContext c, IRequest r) => MyStore.SetIconSet(r, id);
}
```

`VisualTreeWebApp` and the settings tree link the chosen set on render (`ThemePreferences.ApplyIconSet`), so no page has to do it. The icon set picker (`DropdownIconSetCtrl`, class `wx-webapp-dropdown-iconset`) applies a stored pick by swapping the stylesheet link - no reload - and announces it with `webexpress.webapp.iconset.change` on the document.

## Mode (light or dark)

A theme is a colour scheme that comes in a light and a dark variant (its stylesheet defines tokens under `[data-wx-theme="light"]` and `[data-wx-theme="dark"]`); light or dark is the visitor's decision, independent of the theme. `[ThemeMode]` on a theme only sets the default for a visitor who has not chosen. `RestApiColorScheme` offers `light` and `dark` and refuses anything else; an empty value clears the choice. Without a stored choice the endpoint answers `selected: null`, and the picker (`ControlDataSelectionColorScheme`) shows the mode the page is rendered in, which it receives as `data-default` - only the page knows the theme's default.

```csharp
ThemePreferences.RegisterColorScheme<ColorSchemeApi>(applicationContext, ctx => MyStore.GetColorScheme(ctx.Request));
```

Every WebApp page then renders the root with `data-wx-theme` (the visitor's mode, else the theme's default) and `data-wx-theme-service` (the storing endpoint). The service attribute makes the client's `webexpress.webui.DarkMode` follow the server instead of its `localStorage` copy, and `webexpress.webapp.colorscheme.js` stores every toggle of the dark mode switch there - the switch in a menu and the picker on the Designs page are one preference. Without a registration pages behave as before: only a dark theme marks the root, and the switch stays a browser preference.

The Designs settings page shows the pickers that are registered: colour scheme (the theme), mode (light or dark) and icons.

## Persisting in a Database

Both endpoints only call hooks, so a database is a matter of the store behind them:

- **Key** the record by the signed-in identity (`IdentityManager.GetCurrentIdentity(request).Id`), so the choice follows the person across browsers; fall back to a session or client key for anonymous visitors.
- **Row** one record per owner with one nullable column per choice, e.g. `Appearance(Owner PK, ThemeId NULL, IconSetId NULL, ChangedAt)`. A null id means the default applies; a record without any choice can be deleted.
- **Transaction** override `CreateContext` on `RestApiTheme` / `RestApiIconSet` to hand a unit of work to the hooks; read and write of one request share it.
- **Validation** store ids, not names, and resolve them against the registered themes and sets on render - an id that is no longer offered falls back to the default instead of failing.

The tutorial shows the prepared shape with an in-memory store: `IAppearanceStore` (`Get(owner)` / `Save(owner, AppearancePreference)`), `MemoryAppearanceStore`, and `ThemeStore` as the facade the endpoints and pages use. A database implementation replaces `ThemeStore.Store` at startup.

## Events

The control reuses the events of the underlying `webexpress.webui.DropdownCtrl`:

- `webexpress.webui.Event.CLICK_EVENT` - fired when the user picks an entry; the controller listens for this internally to trigger the persistence `PUT`.
- `webexpress.webui.Event.CHANGE_VISIBILITY_EVENT` - emitted when the menu opens or closes.
