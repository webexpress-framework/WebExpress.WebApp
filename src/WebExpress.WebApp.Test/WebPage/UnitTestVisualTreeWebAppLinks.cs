using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebPage;
using WebExpress.WebApp.WebSettingPage;
using WebExpress.WebCore.WebComponent;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebPage
{
    /// <summary>
    /// Tests that the files a page links by their plain route - the theme stylesheet, the
    /// favicon - are linked by the route carrying their fingerprint, so the browser keeps them
    /// for good instead of asking for them again on every page.
    /// </summary>
    public class UnitTestVisualTreeWebAppLinks
    {
        /// <summary>
        /// Tests that the fallback theme stylesheet is linked by its fingerprint, on a route an
        /// asset is mounted on, and not by its plain route as well.
        /// </summary>
        /// <param name="treeType">The type of the visual tree.</param>
        [Theory]
        [InlineData(typeof(VisualTreeWebApp))]
        [InlineData(typeof(VisualTreeWebAppLogin))]
        [InlineData(typeof(VisualTreeWebAppSetting))]
        public void ThemeStylesheetIsLinkedByItsFingerprint(Type treeType)
        {
            // arrange
            var hub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = hub.ApplicationManager.GetApplications(typeof(TestApplication)).First();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var mounted = hub.AssetManager.GetAssets(application).Select(x => x.Route.ToString()).ToHashSet();

            // act
            var tree = (VisualTreeControl)Activator.CreateInstance(treeType, (IComponentHub)hub, context.PageContext);
            var theme = tree.CssLinks.Where(x => x.Contains("webexpress.webapp.theme")).ToList();

            // validation
            var link = Assert.Single(theme);
            Assert.Matches(@"/webexpress\.webapp/assets/css/webexpress\.webapp\.theme\.[0-9a-f]{12}\.css$", link);
            Assert.Contains(link, mounted);
        }

        /// <summary>
        /// Tests that a link added by its plain route is removed by it as well, although the page
        /// links it by its fingerprint - a theme swap removes the stylesheet of the previous theme.
        /// </summary>
        [Fact]
        public void LinkIsRemovedByItsPlainRoute()
        {
            // arrange
            var hub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = hub.ApplicationManager.GetApplications(typeof(TestApplication)).First();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var tree = new VisualTreeWebApp(hub, context.PageContext);
            var plain = $"{application.Route}/webexpress.webapp/assets/css/webexpress.webapp.theme.css";

            // act
            tree.RemoveCssLink(plain);

            // validation
            Assert.DoesNotContain(tree.CssLinks, x => x.Contains("webexpress.webapp.theme"));
        }

        /// <summary>
        /// Tests that the favicon, an image of the framework, is linked by its fingerprint.
        /// </summary>
        [Fact]
        public void FaviconIsLinkedByItsFingerprint()
        {
            // arrange
            var hub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = hub.ApplicationManager.GetApplications(typeof(TestApplication)).First();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);

            // act
            var tree = new VisualTreeWebApp(hub, context.PageContext);

            // validation
            Assert.Contains(tree.Favicons, x => System.Text.RegularExpressions.Regex.IsMatch(x.Url, @"/webexpress\.webui/assets/img/webexpress\.[0-9a-f]{12}\.svg$"));
        }
    }
}
