using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the api wizard control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlRestWizard
    {
        /// <summary>
        /// Tests the id property of the api wizard control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<form id=""*"" class=""wx-webapp-restwizard""></form>")]
        [InlineData("id", @"<form id=""id"" class=""wx-webapp-restwizard""></form>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestWizard(id)
            {
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the RestUri property of the api wizard control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<form id=""*"" class=""wx-webapp-restwizard""></form>")]
        [InlineData("https://example.com/api/data", @"<form id=""*"" class=""wx-webapp-restwizard"" data-uri=""https://example.com/api/data""></form>")]
        public void RestUri(string uriString, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestWizard()
            {
                RestUri = uriString is not null ? new UriEndpoint(uriString) : null
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }
    }
}