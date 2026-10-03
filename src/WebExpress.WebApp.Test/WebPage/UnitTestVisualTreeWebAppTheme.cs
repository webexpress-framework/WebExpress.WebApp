using System.Reflection;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebPage;
using WebExpress.WebCore.WebApplication;
using WebExpress.WebCore.WebPage;

namespace WebExpress.WebApp.Test.WebPage
{
    /// <summary>
    /// Verifies that the visual trees resolve the active theme from the
    /// application and keep it through a full render, including the
    /// per-request override via <c>UseTheme&lt;T&gt;()</c>.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestVisualTreeWebAppTheme
    {
        /// <summary>
        /// With no theme registered for the request's application, the
        /// </summary>
        [Fact]
        public void Render_NoThemeRegistered_LeavesThemeNull()
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
            Assert.Null(visualTree.Theme);
            Assert.Contains("<html", html);
        }

        /// <summary>
        /// </summary>
        [Fact]
        public void Render_ThemeRegistered_AdoptsTheme()
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
            Assert.Contains("<html", html);
        }

        /// <summary>
        /// Same contract for the dedicated login visual tree.
        /// </summary>
        [Fact]
        public void Render_Login_ThemeRegistered_AdoptsTheme()
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
            Assert.Contains("<html", html);
        }

        /// <summary>
        /// Login visual tree without a registered theme also leaves the
        /// attribute off.
        /// </summary>
        [Fact]
        public void Render_Login_NoThemeRegistered_LeavesThemeNull()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeWebAppLogin(componentHub, context.PageContext);
            var visualContext = new VisualTreeContext(context);

            // act
            var html = visualTree.Render(visualContext).ToString();

            // validation
            Assert.Null(visualTree.Theme);
            Assert.Contains("<html", html);
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

            // act
            visualTree.UseTheme<TestThemeB>();

            // validation
            Assert.NotNull(visualTree.Theme);
            Assert.NotSame(previousTheme, visualTree.Theme);
            Assert.Equal("webexpress.webapp.test.testthemeb", visualTree.Theme.ThemeId?.ToString());
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
