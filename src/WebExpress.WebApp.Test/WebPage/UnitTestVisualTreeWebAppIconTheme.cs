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
