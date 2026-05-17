using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebPage;
using WebExpress.WebCore.WebIcon;
using WebExpress.WebCore.WebPage;

namespace WebExpress.WebApp.Test.WebPage
{
    /// <summary>
    /// Verifies that the visual trees emit the icon-theme attribute on the
    /// root html element based on the ApplicationContext setting.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestVisualTreeWebAppIconTheme
    {
        /// <summary>
        /// Default icon theme leaves the html element without a
        /// <c>data-icon-theme</c> attribute.
        /// </summary>
        [Fact]
        public void Render_DefaultTheme_OmitsAttribute()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeWebApp(componentHub, context.PageContext)
            {
                IconTheme = TypeIconTheme.Default
            };
            var visualContext = new VisualTreeContext(context);

            // act
            var html = visualTree.Render(visualContext).ToString();

            // validation
            Assert.DoesNotContain("data-icon-theme", html);
        }

        /// <summary>
        /// Light icon theme produces a <c>data-icon-theme="light"</c> on the
        /// root html element so the JavaScript controls can pick it up
        /// through <c>webexpress.webui.IconTheme.current()</c>.
        /// </summary>
        [Fact]
        public void Render_LightTheme_EmitsAttribute()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeWebApp(componentHub, context.PageContext)
            {
                IconTheme = TypeIconTheme.Light
            };
            var visualContext = new VisualTreeContext(context);

            // act
            var html = visualTree.Render(visualContext).ToString();

            // validation
            Assert.Contains(@"data-icon-theme=""light""", html);
        }

        /// <summary>
        /// Same contract for the dedicated login visual tree.
        /// </summary>
        [Fact]
        public void Render_LoginLightTheme_EmitsAttribute()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeWebAppLogin(componentHub, context.PageContext)
            {
                IconTheme = TypeIconTheme.Light
            };
            var visualContext = new VisualTreeContext(context);

            // act
            var html = visualTree.Render(visualContext).ToString();

            // validation
            Assert.Contains(@"data-icon-theme=""light""", html);
        }

        /// <summary>
        /// Login visual tree without an explicit light theme leaves the
        /// attribute off.
        /// </summary>
        [Fact]
        public void Render_LoginDefaultTheme_OmitsAttribute()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeWebAppLogin(componentHub, context.PageContext);
            var visualContext = new VisualTreeContext(context);

            // act
            var html = visualTree.Render(visualContext).ToString();

            // validation
            Assert.DoesNotContain("data-icon-theme", html);
        }
    }
}
