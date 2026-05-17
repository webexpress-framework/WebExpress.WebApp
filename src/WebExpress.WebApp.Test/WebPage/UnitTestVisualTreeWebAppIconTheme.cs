using System.Reflection;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebPage;
using WebExpress.WebCore.WebApplication;
using WebExpress.WebCore.WebIcon;
using WebExpress.WebCore.WebPage;

namespace WebExpress.WebApp.Test.WebPage
{
    /// <summary>
    /// Verifies that the visual trees pull the icon theme from the first
    /// registered theme on the application and emit it on the root
    /// <c>&lt;html data-icon-theme&gt;</c> attribute. The legacy
    /// <c>IApplicationContext.IconTheme</c> path was removed; the theme is
    /// now declared via <c>[IconTheme(...)]</c> on the theme class.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestVisualTreeWebAppIconTheme
    {
        /// <summary>
        /// With no theme registered for the request's application, the
        /// visual tree falls back to <see cref="TypeIconTheme.Default"/>
        /// and the html element does not carry a data-icon-theme attribute.
        /// </summary>
        [Fact]
        public void Render_NoThemeRegistered_OmitsAttribute()
        {
            // arrange - default request mock builds an ad-hoc ApplicationContext
            // that is not known to the ThemeManager, so no theme resolves.
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeWebApp(componentHub, context.PageContext);
            var visualContext = new VisualTreeContext(context);

            // act
            var html = visualTree.Render(visualContext).ToString();

            // validation
            Assert.Equal(TypeIconTheme.Default, visualTree.IconTheme);
            Assert.Null(visualTree.Theme);
            Assert.DoesNotContain("data-icon-theme", html);
        }

        /// <summary>
        /// With <c>TestThemeA</c> (carrying <c>[IconTheme(Light)]</c>)
        /// registered for the request's application, the visual tree adopts
        /// the theme's icon-theme and emits <c>data-icon-theme="light"</c>.
        /// </summary>
        [Fact]
        public void Render_LightThemeRegistered_EmitsAttribute()
        {
            // arrange - take the application context the ThemeManager actually
            // knows about so the theme resolution succeeds.
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var applicationContext = componentHub.ApplicationManager
                .GetApplications(typeof(TestApplication))
                .FirstOrDefault();

            var context = UnitTestControlFixture.CreateRenderContextMock();
            BindPageContextToApplication(context.PageContext, applicationContext);

            var visualTree = new VisualTreeWebApp(componentHub, context.PageContext);
            var visualContext = new VisualTreeContext(context);

            // act
            var html = visualTree.Render(visualContext).ToString();

            // validation
            Assert.NotNull(visualTree.Theme);
            Assert.Equal(TypeIconTheme.Light, visualTree.IconTheme);
            Assert.Contains(@"data-icon-theme=""light""", html);
        }

        /// <summary>
        /// Same contract for the dedicated login visual tree.
        /// </summary>
        [Fact]
        public void Render_Login_LightThemeRegistered_EmitsAttribute()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var applicationContext = componentHub.ApplicationManager
                .GetApplications(typeof(TestApplication))
                .FirstOrDefault();

            var context = UnitTestControlFixture.CreateRenderContextMock();
            BindPageContextToApplication(context.PageContext, applicationContext);

            var visualTree = new VisualTreeWebAppLogin(componentHub, context.PageContext);
            var visualContext = new VisualTreeContext(context);

            // act
            var html = visualTree.Render(visualContext).ToString();

            // validation
            Assert.NotNull(visualTree.Theme);
            Assert.Equal(TypeIconTheme.Light, visualTree.IconTheme);
            Assert.Contains(@"data-icon-theme=""light""", html);
        }

        /// <summary>
        /// Login visual tree without a registered theme also leaves the
        /// attribute off.
        /// </summary>
        [Fact]
        public void Render_Login_NoThemeRegistered_OmitsAttribute()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeWebAppLogin(componentHub, context.PageContext);
            var visualContext = new VisualTreeContext(context);

            // act
            var html = visualTree.Render(visualContext).ToString();

            // validation
            Assert.Equal(TypeIconTheme.Default, visualTree.IconTheme);
            Assert.Null(visualTree.Theme);
            Assert.DoesNotContain("data-icon-theme", html);
        }

        /// <summary>
        /// Verifies that the visual tree honours the application's
        /// <c>[Theme&lt;TestThemeA&gt;]</c> declaration when the
        /// ApplicationContext exposes it through
        /// <see cref="IApplicationContext.DefaultTheme"/>.
        /// </summary>
        [Fact]
        public void Resolution_PrefersApplicationDefaultTheme()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var applicationContext = componentHub.ApplicationManager
                .GetApplications(typeof(TestApplication))
                .FirstOrDefault();

            var context = UnitTestControlFixture.CreateRenderContextMock();
            BindPageContextToApplication(context.PageContext, applicationContext);

            // act
            var visualTree = new VisualTreeWebApp(componentHub, context.PageContext);

            // validation - DefaultTheme on the application points at TestThemeA.
            Assert.NotNull(applicationContext.DefaultTheme);
            Assert.Same(applicationContext.DefaultTheme, visualTree.Theme);
        }

        /// <summary>
        /// Verifies that <c>UseTheme&lt;TestThemeB&gt;()</c> replaces the
        /// default theme on a registered application and that the new theme's
        /// IconTheme (Default) propagates through.
        /// </summary>
        [Fact]
        public void UseTheme_OverridesDefault()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var applicationContext = componentHub.ApplicationManager
                .GetApplications(typeof(TestApplication))
                .FirstOrDefault();

            var context = UnitTestControlFixture.CreateRenderContextMock();
            BindPageContextToApplication(context.PageContext, applicationContext);

            var visualTree = new VisualTreeWebApp(componentHub, context.PageContext);
            var previousTheme = visualTree.Theme;
            Assert.NotNull(previousTheme);
            Assert.Equal(TypeIconTheme.Light, visualTree.IconTheme);

            // act
            visualTree.UseTheme<TestThemeB>();

            // validation
            Assert.NotNull(visualTree.Theme);
            Assert.NotSame(previousTheme, visualTree.Theme);
            Assert.Equal("webexpress.webapp.test.testthemeb", visualTree.Theme.ThemeId?.ToString());
            Assert.Equal(TypeIconTheme.Default, visualTree.IconTheme);
        }

        /// <summary>
        /// Verifies that <c>UseTheme&lt;TTheme&gt;()</c> with an unknown
        /// theme type is a no-op and leaves the previously resolved theme
        /// in place.
        /// </summary>
        [Fact]
        public void UseTheme_UnknownTheme_IsNoOp()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var applicationContext = componentHub.ApplicationManager
                .GetApplications(typeof(TestApplication))
                .FirstOrDefault();

            var context = UnitTestControlFixture.CreateRenderContextMock();
            BindPageContextToApplication(context.PageContext, applicationContext);

            var visualTree = new VisualTreeWebApp(componentHub, context.PageContext);
            var previousTheme = visualTree.Theme;

            // act - UnregisteredTheme is not known to the ThemeManager.
            visualTree.UseTheme<UnregisteredTheme>();

            // validation
            Assert.Same(previousTheme, visualTree.Theme);
        }

        /// <summary>
        /// A theme type that is intentionally never registered for any
        /// application; used to exercise the no-op path of
        /// <c>UseTheme&lt;TTheme&gt;()</c>.
        /// </summary>
        private sealed class UnregisteredTheme : WebCore.WebTheme.ITheme
        {
        }

        /// <summary>
        /// Swap the ad-hoc ApplicationContext on the test page context with
        /// the manager-registered instance so theme lookup succeeds.
        /// </summary>
        private static void BindPageContextToApplication(IPageContext pageContext, IApplicationContext applicationContext)
        {
            var concreteType = pageContext.GetType();
            var prop = concreteType.GetProperty(nameof(IPageContext.ApplicationContext),
                BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance);
            prop?.SetValue(pageContext, applicationContext);
        }
    }
}
