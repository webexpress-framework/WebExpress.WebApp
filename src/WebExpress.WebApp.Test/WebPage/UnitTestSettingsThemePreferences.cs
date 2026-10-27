using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebApp.WebData;
using WebExpress.WebApp.WebSettingPage;
using WebExpress.WebApp.WebTheme;
using WebExpress.WebCore.WebPage;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.Test.WebPage
{
    /// <summary>
    /// Guards preference propagation to shared settings and the combined Designs page.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestSettingsThemePreferences
    {
        /// <summary>
        /// Ensures settings resolve preferences on every request rather than retaining a construction default.
        /// </summary>
        [Fact]
        public void Render_Settings_ReappliesCurrentPreference()
        {
            // arrange
            var hub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = hub.ApplicationManager.GetApplications(typeof(TestApplication)).First();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var themes = hub.ThemeManager.Themes.Where(x => x.ApplicationContext == application).ToArray();
            var selected = themes[0];
            var tree = new VisualTreeWebAppSetting(hub, context.PageContext);
            ThemePreferences.Register(application, _ => selected, () => new ControlText());
            try
            {
                // act
                tree.Render(new VisualTreeContext(context));
                var first = tree.Theme;
                selected = themes.First(x => x != first);
                tree.Render(new VisualTreeContext(context));

                // validation
                Assert.Same(themes[0], first);
                Assert.Same(selected, tree.Theme);
            }
            finally
            {
                ThemePreferences.Remove(application);
            }
        }

        /// <summary>
        /// Ensures the shared Designs page contains both preference selection and the theme catalog.
        /// </summary>
        [Fact]
        public void Process_Designs_IncludesSelectorAndCatalog()
        {
            // arrange
            var hub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = hub.ApplicationManager.GetApplications(typeof(TestApplication)).First();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var selected = hub.ThemeManager.GetThemes<TestThemeB>(application).First();
            var tree = new VisualTreeWebAppSetting(hub, context.PageContext);
            ThemePreferences.Register(application, _ => selected,
                () => new ControlDataSelectionTheme("preference-selector-marker") { ServiceFactory = _ => DataServiceDescriptor.Data("/app/api/themes") });
            try
            {
                // act
                new WWW.Settings.System.Theme(hub).Process(context, tree);
                var html = tree.Render(new VisualTreeContext(context)).ToString();

                // validation
                Assert.Contains("preference-selector-marker", html);
                Assert.Contains("wx-webapp-dropdown-theme", html);
                Assert.Contains("base-uri=\"/app/api/themes\"", html);
                Assert.Contains("webexpress.webapp.dropdown.theme.js", html);
                Assert.Contains("TestThemeB", html);
                Assert.Same(selected, tree.Theme);
            }
            finally
            {
                ThemePreferences.Remove(application);
            }
        }

        /// <summary>
        /// Ensures application isolation and removal both fall back without retaining a foreign preference.
        /// </summary>
        [Fact]
        public void Resolve_ForeignApplicationOrRemovedRegistration_ReturnsNull()
        {
            // arrange
            var hub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = hub.ApplicationManager.GetApplications(typeof(TestApplication)).First();
            var foreign = UnitTestControlFixture.CreateRenderContextMock(new WebCore.WebApplication.ApplicationContext());
            var selected = hub.ThemeManager.GetThemes<TestThemeB>(application).First();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            ThemePreferences.Register(foreign.PageContext.ApplicationContext, _ => selected, () => new ControlText());
            ThemePreferences.Register(application, _ => selected, () => new ControlText());
            try
            {
                // act
                var foreignTheme = ThemePreferences.Resolve(foreign);
                ThemePreferences.Remove(application);
                var removed = ThemePreferences.Resolve(context);

                // validation
                Assert.Null(foreignTheme);
                Assert.Null(removed);
                Assert.Null(ThemePreferences.CreateSelector(application));
            }
            finally
            {
                ThemePreferences.Remove(application);
                ThemePreferences.Remove(foreign.PageContext.ApplicationContext);
            }
        }

        /// <summary>
        /// Ensures the Designs page offers the icon set next to the theme, each behind a caption.
        /// </summary>
        [Fact]
        public void Process_Designs_IncludesIconSetSelectorBesideThemeSelector()
        {
            // arrange
            var hub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = hub.ApplicationManager.GetApplications(typeof(TestApplication)).First();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var tree = new VisualTreeWebAppSetting(hub, context.PageContext);
            ThemePreferences.Register(application, _ => null, () => new ControlText() { Text = _ => "theme-selector-marker" });
            ThemePreferences.RegisterIconSets(application, [IconSet.Default], _ => null,
                () => new ControlDataSelectionIconSet("iconset-selector-marker") { ServiceFactory = _ => DataServiceDescriptor.Data("/app/api/iconsets") });
            try
            {
                // act
                new WWW.Settings.System.Theme(hub).Process(context, tree);
                var html = tree.Render(new VisualTreeContext(context)).ToString();

                // validation
                Assert.Contains("theme-selector-marker", html);
                Assert.Contains("iconset-selector-marker", html);
                Assert.Contains("base-uri=\"/app/api/iconsets\"", html);
                Assert.Contains("wx-webapp-theme-choices", html);
                Assert.Contains("dropdown-toggle", html);
            }
            finally
            {
                ThemePreferences.Remove(application);
            }
        }

        /// <summary>
        /// Ensures the mode picker shows the mode the page is rendered in - the theme's default
        /// without a choice, the choice once there is one - and the catalog no longer pins a
        /// theme to one mode.
        /// </summary>
        /// <param name="stored">The stored mode, or null for none.</param>
        /// <param name="expected">The mode the picker and the page must show.</param>
        [Theory]
        [InlineData(null, "light")]
        [InlineData("dark", "dark")]
        public void Process_Designs_ModePickerShowsTheRenderedMode(string stored, string expected)
        {
            // arrange
            var hub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = hub.ApplicationManager.GetApplications(typeof(TestApplication)).First();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var tree = new VisualTreeWebAppSetting(hub, context.PageContext);
            ThemePreferences.RegisterColorScheme<ModeApi>(application, _ => stored);
            try
            {
                // act
                new WWW.Settings.System.Theme(hub).Process(context, tree);
                var html = tree.Render(new VisualTreeContext(context)).ToString();

                // validation
                Assert.Contains($"data-default=\"{expected}\"", html);
                Assert.Contains($"data-wx-theme=\"{expected}\"", html);
                Assert.Contains("data-wx-theme-service", html);
                Assert.DoesNotContain("setting.theme.mode.label", html);
            }
            finally
            {
                ThemePreferences.Remove(application);
            }
        }

        /// <summary>
        /// Ensures the chosen set is linked exactly once, even when a tree renders twice, and
        /// that an id the application does not offer (any more) falls back to the framework drawings.
        /// </summary>
        [Fact]
        public void ApplyIconSet_LinksChosenSetOnceAndIgnoresUnknownIds()
        {
            // arrange
            var hub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = hub.ApplicationManager.GetApplications(typeof(TestApplication)).First();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var tree = new VisualTreeWebAppSetting(hub, context.PageContext);
            var chosen = "PIRATES";
            ThemePreferences.RegisterIconSets(application, [IconSet.Default, new IconSet("pirates", "Pirates", null, "assets/css/pirates.css")],
                _ => chosen, () => new ControlText());
            try
            {
                // act
                ThemePreferences.ApplyIconSet(context, tree);
                ThemePreferences.ApplyIconSet(context, tree);
                var linked = tree.CssLinks.Count(x => x.EndsWith("assets/css/pirates.css"));
                var resolved = ThemePreferences.ResolveIconSet(context)?.Id;
                chosen = "removed-set";
                ThemePreferences.ApplyIconSet(context, tree);

                // validation
                Assert.Equal(1, linked);
                Assert.Equal("pirates", resolved);
                Assert.Null(ThemePreferences.ResolveIconSet(context));
                Assert.DoesNotContain(tree.CssLinks, x => x.EndsWith("assets/css/pirates.css"));
            }
            finally
            {
                ThemePreferences.Remove(application);
            }
        }

        /// <summary>
        /// Ensures the mode endpoint offers light and dark only and refuses what it does not offer.
        /// </summary>
        [Fact]
        public void ModeEndpoint_OffersLightAndDarkOnly()
        {
            // arrange
            var api = new ModeApi();
            var hub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = hub.ApplicationManager.GetApplications(typeof(TestApplication)).First();
            var request = UnitTestControlFixture.CreateRenderContextMock(application).Request;

            // act
            var list = System.Text.Encoding.UTF8.GetString((byte[])api.Retrieve(request).Content);

            // validation
            Assert.Contains("\"id\":\"light\"", list);
            Assert.Contains("\"id\":\"dark\"", list);
            Assert.DoesNotContain("auto", list);
            Assert.Contains("\"selected\":null", list);
            Assert.Equal(new[] { ColorScheme.Light, ColorScheme.Dark }, ColorScheme.All);
            Assert.Null(ColorScheme.Normalize("auto"));
        }

        /// <summary>
        /// A mode endpoint without a store: nothing chosen, nothing kept.
        /// </summary>
        private sealed class ModeApi : WebExpress.WebApp.WebRestApi.RestApiColorScheme
        {
            /// <summary>
            /// Returns no stored mode.
            /// </summary>
            /// <param name="context">The query context.</param>
            /// <param name="request">The request.</param>
            /// <returns>Always null.</returns>
            protected override string GetActiveColorScheme(WebExpress.WebIndex.Queries.IQueryContext context, WebExpress.WebCore.WebMessage.IRequest request) => null;

            /// <summary>
            /// Keeps nothing.
            /// </summary>
            /// <param name="colorScheme">The mode.</param>
            /// <param name="context">The query context.</param>
            /// <param name="request">The request.</param>
            protected override void PersistSelection(string colorScheme, WebExpress.WebIndex.Queries.IQueryContext context, WebExpress.WebCore.WebMessage.IRequest request)
            {
            }
        }
    }
}
