using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the api wizard page control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlRestWizardPage
    {
        /// <summary>
        /// Tests the id property of the api wizard page control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-wizard-page""><main></main></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-wizard-page""><main></main></div>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestWizardPage(id)
            {
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }
    }
}