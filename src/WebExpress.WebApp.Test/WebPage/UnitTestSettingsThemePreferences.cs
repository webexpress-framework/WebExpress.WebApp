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
    }
}
