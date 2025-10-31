using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the web app header app title control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlWebAppHeaderAppTitle
    {
        /// <summary>
        /// Tests the id property of the web app header app title control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<a href=""/server/app"" class=""text-decoration-none""><h1 class=""p-1 me-2 mb-0"">TestApplication</h1></a>")]
        [InlineData("id", @"<a id=""id"" href=""/server/app"" class=""text-decoration-none""><h1 class=""p-1 me-2 mb-0"">TestApplication</h1></a>")]
        public void Id(string id, string expected)
        {
            // preconditions
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock(componentHub?.ApplicationManager.Applications.FirstOrDefault());
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlWebAppHeaderAppTitle(id)
            {
            };

            // test execution
            var html = control.Render(context, visualTree);

            AssertExtensions.EqualWithPlaceholders(expected, html);
        }
    }
}
