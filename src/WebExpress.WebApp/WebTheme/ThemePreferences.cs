using System;
using System.Runtime.CompilerServices;
using WebExpress.WebCore.WebApplication;
using WebExpress.WebCore.WebPage;
using WebExpress.WebCore.WebTheme;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebTheme
{
    /// <summary>
    /// Connects application-owned preferences to shared administration pages without owning persistence.
    /// </summary>
    public sealed class ThemePreferences
    {
        private static readonly ConditionalWeakTable<IApplicationContext, ThemePreferences> _applications = new();
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
        }

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
