using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the page toolbar of a WebApp page.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlWebAppToolbar
    {
        /// <summary>
        /// The page toolbar is a region landmark, and a region is only a landmark when it has
        /// a name; it carries its own name rather than the generic one of every toolbar, so
        /// assistive technology can tell it apart from toolbars inside the content.
        /// </summary>
        [Fact]
        public void RegionHasOwnAccessibleName()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlWebAppToolbar("toolbar")
                .AddPrimary(new ControlToolbarItemButton() { Text = _ => "Edit" });

            // act
            var html = control.Render(context, visualTree).ToString();

            // validation
            Assert.Contains(@"role=""region""", html);
            Assert.Matches(@"aria-label=""(Page actions|Seitenaktionen)""", html);
        }

        /// <summary>
        /// A label set by the page replaces the default name of the region.
        /// </summary>
        [Fact]
        public void LabelOverridesDefaultName()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlWebAppToolbar("toolbar")
            {
                Label = _ => "Invoice actions"
            };

            // act
            var html = control.Render(context, visualTree).ToString();

            // validation
            Assert.Contains(@"aria-label=""Invoice actions""", html);
        }
    }
}
