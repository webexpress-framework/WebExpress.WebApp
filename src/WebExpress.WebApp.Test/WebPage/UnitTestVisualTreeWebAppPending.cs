using System.Text.RegularExpressions;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebPage;
using WebExpress.WebApp.WebSettingPage;
using WebExpress.WebCore.WebComponent;
using WebExpress.WebCore.WebPage;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebPage
{
    /// <summary>
    /// Tests that every kind of page is rendered hidden until the controller has built its
    /// controls. The scripts are deferred, so a page without the mark is painted as its bare
    /// markup first - an editor as its encoded value, a menu as a row of bare links.
    /// </summary>
    public class UnitTestVisualTreeWebAppPending
    {
        /// <summary>
        /// Tests that the html element of each visual tree carries the mark.
        /// </summary>
        /// <param name="treeType">The type of the visual tree.</param>
        [Theory]
        [InlineData(typeof(VisualTreeControl))]
        [InlineData(typeof(VisualTreeWebApp))]
        [InlineData(typeof(VisualTreeWebAppLanding))]
        [InlineData(typeof(VisualTreeWebAppLogin))]
        [InlineData(typeof(VisualTreeWebAppSetting))]
        public void PageIsHiddenUntilItsControlsAreBuilt(Type treeType)
        {
            // arrange
            var hub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = hub.ApplicationManager.GetApplications(typeof(TestApplication)).First();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var tree = (VisualTreeControl)Activator.CreateInstance(treeType, (IComponentHub)hub, context.PageContext);

            // act
            var html = tree.Render(new VisualTreeContext(context)).ToString();

            // validation
            Assert.Matches(new Regex($@"<html\b[^>]*\s{VisualTreeControl.PendingAttribute}[\s>]"), html);
        }
    }
}
