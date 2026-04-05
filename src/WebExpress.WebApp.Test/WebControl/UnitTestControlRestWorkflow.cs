using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the api workflow control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlRestWorkflow
    {
        /// <summary>
        /// Tests the id property of the api workflow control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div id=""*"" class=""wx-webapp-workflow-editor""></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-webapp-workflow-editor""></div>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestWorkflow(id)
            {
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the RestUri property of the api workflow control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div id=""*"" class=""wx-webapp-workflow-editor""></div>")]
        [InlineData("https://example.com/api/data", @"<div id=""*"" class=""wx-webapp-workflow-editor"" data-uri=""https://example.com/api/data""></div>")]
        public void RestUri(string uriString, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestWorkflow()
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