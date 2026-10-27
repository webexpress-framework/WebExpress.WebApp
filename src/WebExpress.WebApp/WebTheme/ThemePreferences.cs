using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using WebExpress.WebApp.WebControl;
using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore;
using WebExpress.WebCore.WebApplication;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebPage;
using WebExpress.WebCore.WebTheme;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebTheme
{
    /// <summary>
    /// Connects application-owned preferences to shared administration pages without owning persistence.
    /// </summary>
    public sealed class ThemePreferences
    {
        private static readonly ConditionalWeakTable<IApplicationContext, ThemePreferences> _applications = new();
        private static readonly ConditionalWeakTable<IApplicationContext, IconSetPreferences> _iconSets = new();
        private static readonly ConditionalWeakTable<IApplicationContext, ColorSchemePreferences> _colorSchemes = new();
        private readonly Func<IRenderContext, IThemeContext> _resolve;
        private readonly Func<IControl> _createSelector;

        /// <summary>
        /// Keeps the preference resolver and selector factory together for one application.
        /// </summary>
        /// <param name="resolve">The resolver that reads the current request's preference.</param>
        /// <param name="createSelector">The factory that creates a fresh selection control.</param>
        private ThemePreferences(Func<IRenderContext, IThemeContext> resolve, Func<IControl> createSelector)
        {
            _resolve = resolve;
            _createSelector = createSelector;
        }

        /// <summary>
        /// Registers the application's integration for shared settings pages.
        /// </summary>
        /// <param name="application">The application owning the preference.</param>
        /// <param name="resolve">The resolver that reads the current request's preference.</param>
        /// <param name="createSelector">The factory that creates a fresh selection control.</param>
        public static void Register(IApplicationContext application, Func<IRenderContext, IThemeContext> resolve, Func<IControl> createSelector)
        {
            _applications.AddOrUpdate(application, new ThemePreferences(resolve, createSelector));
        }

        /// <summary>
        /// Releases the application's integration when its plugin is unloaded.
        /// </summary>
        /// <param name="application">The application being disposed.</param>
        public static void Remove(IApplicationContext application)
        {
            _applications.Remove(application);
            _iconSets.Remove(application);
            _colorSchemes.Remove(application);
        }

        /// <summary>
        /// Registers the light or dark choice of an application, stored behind
        /// <typeparamref name="TEndpoint"/>.
        /// </summary>
        /// <remarks>
        /// The endpoint is named by type because it serves two clients: the picker on the
        /// Designs page and the client's dark mode switch, whose address every page announces
        /// on its root so a toggle anywhere is stored as the same preference.
        /// </remarks>
        /// <typeparam name="TEndpoint">The endpoint that stores the choice.</typeparam>
        /// <param name="application">The application owning the preference.</param>
        /// <param name="resolve">The resolver that reads the current request's scheme (light, dark or null).</param>
        public static void RegisterColorScheme<TEndpoint>(IApplicationContext application, Func<IRenderContext, string> resolve)
            where TEndpoint : RestApiColorScheme
        {
            _colorSchemes.AddOrUpdate(application, new ColorSchemePreferences
            (
                resolve,
                () => new ControlDataSelectionColorScheme().DataService<TEndpoint>(),
                () => WebEx.ComponentHub?.SitemapManager?.GetUri<TEndpoint>(application)?.ToString()
            ));
        }

        /// <summary>
        /// Resolves the visitor's mode, or null when the visitor has not chosen one.
        /// </summary>
        /// <param name="context">The request and application being rendered.</param>
        /// <returns><see cref="ColorScheme.Light"/>, <see cref="ColorScheme.Dark"/> or null.</returns>
        public static string ResolveColorScheme(IRenderContext context)
        {
            var application = context?.PageContext?.ApplicationContext;
            return application is not null && _colorSchemes.TryGetValue(application, out var preferences)
                ? ColorScheme.Normalize(preferences.Resolve(context))
                : null;
        }

        /// <summary>
        /// Returns the mode a page is rendered in: the visitor's choice, else the default the theme declares.
        /// </summary>
        /// <param name="context">The request and application being rendered.</param>
        /// <param name="theme">The theme the page is rendered with.</param>
        /// <returns><see cref="ColorScheme.Light"/> or <see cref="ColorScheme.Dark"/>.</returns>
        public static string EffectiveColorScheme(IRenderContext context, IThemeContext theme)
        {
            return ResolveColorScheme(context) ?? ColorScheme.Default(theme);
        }

        /// <summary>
        /// Creates the application-specific scheme selector inside the shared Designs page.
        /// </summary>
        /// <param name="application">The application whose preference can be changed.</param>
        /// <returns>A fresh selection control, or null when no scheme preference is registered.</returns>
        public static IControl CreateColorSchemeSelector(IApplicationContext application)
        {
            return application is not null && _colorSchemes.TryGetValue(application, out var preferences)
                ? preferences.CreateSelector()
                : null;
        }

        /// <summary>
        /// Marks the root of a page with the scheme it is rendered in.
        /// </summary>
        /// <remarks>
        /// The visitor's mode wins over the theme's default. Once an application keeps the
        /// choice, the root also names the service that stores it, which tells the client's
        /// dark mode switch to follow the server instead of a browser copy and to store a
        /// toggle there. Without a registration the page keeps the former behaviour: only a
        /// dark theme marks the root.
        /// </remarks>
        /// <param name="context">The request and application being rendered.</param>
        /// <param name="html">The root element of the page.</param>
        /// <param name="theme">The theme the page is rendered with.</param>
        public static void ApplyColorScheme(IRenderContext context, HtmlElementRootHtml html, IThemeContext theme)
        {
            var application = context?.PageContext?.ApplicationContext;

            if (application is null || !_colorSchemes.TryGetValue(application, out var preferences))
            {
                if (theme?.ThemeMode == ThemeMode.Dark)
                {
                    html.AddUserAttribute("data-wx-theme", ColorScheme.Dark);
                }

                return;
            }

            html.AddUserAttribute("data-wx-theme", EffectiveColorScheme(context, theme));
            html.AddUserAttribute("data-wx-theme-service", preferences.Endpoint());
        }

        /// <summary>
        /// Registers the icon sets an application offers next to its color themes.
        /// </summary>
        /// <remarks>
        /// The drawings are independent of the color scheme, so the choice is a preference of
        /// its own - stored, resolved and offered by the application just like the theme.
        /// </remarks>
        /// <param name="application">The application owning the preference.</param>
        /// <param name="iconSets">The selectable sets, including the framework drawings when they stay selectable.</param>
        /// <param name="resolve">The resolver that reads the current request's icon set id.</param>
        /// <param name="createSelector">The factory that creates a fresh selection control.</param>
        public static void RegisterIconSets(IApplicationContext application, IEnumerable<IconSet> iconSets, Func<IRenderContext, string> resolve, Func<IControl> createSelector)
        {
            _iconSets.AddOrUpdate(application, new IconSetPreferences([.. iconSets ?? []], resolve, createSelector));
        }

        /// <summary>
        /// Lists the icon sets an application offers, so endpoints validate a choice against them.
        /// </summary>
        /// <param name="application">The application.</param>
        /// <returns>The registered sets, or an empty list.</returns>
        public static IReadOnlyList<IconSet> GetIconSets(IApplicationContext application)
        {
            return application is not null && _iconSets.TryGetValue(application, out var preferences)
                ? preferences.IconSets
                : [];
        }

        /// <summary>
        /// Resolves the current icon set, ignoring ids the application does not offer (any more).
        /// </summary>
        /// <param name="context">The request and application being rendered.</param>
        /// <returns>The chosen set, or null when the framework drawings apply.</returns>
        public static IconSet ResolveIconSet(IRenderContext context)
        {
            var application = context?.PageContext?.ApplicationContext;
            if (application is null || !_iconSets.TryGetValue(application, out var preferences))
            {
                return null;
            }

            var id = preferences.Resolve(context);
            return preferences.IconSets.FirstOrDefault(x => string.Equals(x.Id, id, StringComparison.OrdinalIgnoreCase));
        }

        /// <summary>
        /// Creates the application-specific icon set selector inside the shared Designs page.
        /// </summary>
        /// <param name="application">The application whose preference can be changed.</param>
        /// <returns>A fresh selection control, or null when no icon sets are offered.</returns>
        public static IControl CreateIconSetSelector(IApplicationContext application)
        {
            return application is not null && _iconSets.TryGetValue(application, out var preferences)
                ? preferences.CreateSelector()
                : null;
        }

        /// <summary>
        /// Adds the stylesheet of the current icon set after the framework rules it overrides.
        /// </summary>
        /// <remarks>
        /// The masks override rules of the same specificity, so the set has to be the last
        /// stylesheet: it is moved behind a theme stylesheet applied before, and applying it
        /// again on a re-render does not add it twice.
        /// </remarks>
        /// <param name="context">The request and application being rendered.</param>
        /// <param name="visualTree">The visual tree that receives the stylesheet.</param>
        public static void ApplyIconSet(IRenderContext context, VisualTreeControl visualTree)
        {
            var application = context?.PageContext?.ApplicationContext;
            if (visualTree is null || application is null)
            {
                return;
            }

            foreach (var iconSet in GetIconSets(application).Where(x => !string.IsNullOrWhiteSpace(x.Stylesheet)))
            {
                visualTree.RemoveCssLink(application.Route.Concat(iconSet.Stylesheet).ToString());
            }

            var stylesheet = ResolveIconSet(context)?.Stylesheet;
            if (!string.IsNullOrWhiteSpace(stylesheet))
            {
                visualTree.AddCssLink(application.Route.Concat(stylesheet).ToString());
            }
        }

        /// <summary>
        /// Keeps the offered sets, resolver and selector factory of one application together.
        /// </summary>
        /// <param name="IconSets">The selectable sets.</param>
        /// <param name="Resolve">The resolver of the current request's icon set id.</param>
        /// <param name="CreateSelector">The factory of the selection control.</param>
        private sealed record IconSetPreferences(IReadOnlyList<IconSet> IconSets, Func<IRenderContext, string> Resolve, Func<IControl> CreateSelector);

        /// <summary>
        /// Keeps the resolver, selector factory and storing endpoint of one application's scheme.
        /// </summary>
        /// <param name="Resolve">The resolver of the current request's scheme.</param>
        /// <param name="CreateSelector">The factory of the selection control.</param>
        /// <param name="Endpoint">The address of the storing endpoint.</param>
        private sealed record ColorSchemePreferences(Func<IRenderContext, string> Resolve, Func<IControl> CreateSelector, Func<string> Endpoint);

        /// <summary>
        /// Resolves the current preference while preventing themes from crossing application boundaries.
        /// </summary>
        /// <param name="context">The request and application being rendered.</param>
        /// <returns>The selected theme, or null when no applicable preference exists.</returns>
        public static IThemeContext Resolve(IRenderContext context)
        {
            var application = context?.PageContext?.ApplicationContext;
            if (application is null || !_applications.TryGetValue(application, out var preferences))
            {
                return null;
            }

            var theme = preferences._resolve(context);
            return theme?.ApplicationContext == application ? theme : null;
        }

        /// <summary>
        /// Creates the application-specific selector inside the shared Designs page.
        /// </summary>
        /// <param name="application">The application whose preference can be changed.</param>
        /// <returns>A fresh selection control, or null when selection is not supported.</returns>
        public static IControl CreateSelector(IApplicationContext application)
        {
            return application is not null && _applications.TryGetValue(application, out var preferences)
                ? preferences._createSelector()
                : null;
        }
    }
}
