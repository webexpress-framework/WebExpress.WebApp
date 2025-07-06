using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the web app header app navigator control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlWebAppHeaderAppNavigator
    {
        /// <summary>
        /// Tests the id property of the web app header app navigator control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webui-dropdown mx-2"" role=""button""><div id=""webexpress.webapp.test.testfragmentsectionapppreferencesitem"" class=""wx-dropdown-item"">TestFragmentSectionAppPreferencesItem</div></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-webui-dropdown mx-2"" role=""button""><div id=""webexpress.webapp.test.testfragmentsectionapppreferencesitem"" class=""wx-dropdown-item"">TestFragmentSectionAppPreferencesItem</div></div>")]
        public void Id(string id, string expected)
        {
            // preconditions
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlWebAppHeaderAppNavigator(id)
            {
            };

            // test execution
            var html = control.Render(context, visualTree);

            AssertExtensions.EqualWithPlaceholders(expected, html);
        }
    }
}
