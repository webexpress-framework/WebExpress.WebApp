using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebApiControl;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the REST dropdown control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlRestDropdown
    {
        /// <summary>
        /// Tests the id property of the REST dropdown control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-dropdown"" role=""button""></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-webapp-dropdown"" role=""button""></div>")]
        public void Id(string id, string expected)
        {
            // preconditions
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestDropdown(id)
            {
            };

            // test execution
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the api property of the REST dropdown control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-dropdown"" role=""button""></div>")]
        [InlineData("https://example.com/api/data", @"<div class=""wx-webapp-dropdown"" role=""button"" data-uri=""https://example.com/api/data""></div>")]
        public void RestUri(string uriString, string expected)
        {
            // preconditions
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestDropdown()
            {
                RestUri = uriString != null ? new UriEndpoint(uriString) : null
            };

            // test execution
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the max items property of the REST dropdown control.
        /// </summary>
        [Theory]
        [InlineData(-1, @"<div class=""wx-webapp-dropdown"" role=""button""></div>")]
        [InlineData(0, @"<div class=""wx-webapp-dropdown"" role=""button""></div>")]
        [InlineData(5, @"<div class=""wx-webapp-dropdown"" role=""button"" data-maxItems=""5""></div>")]
        public void MaxItems(int maxItems, string expected)
        {
            // preconditions
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestDropdown()
            {
                MaxItems = maxItems
            };

            // test execution
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the search placeholder property of the REST dropdown control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-dropdown"" role=""button""></div>")]
        [InlineData("abc", @"<div class=""wx-webapp-dropdown"" role=""button"" data-searchPlaceholder=""abc""></div>")]
        [InlineData("webexpress.webui:plugin.name", @"<div class=""wx-webapp-dropdown"" role=""button"" data-searchPlaceholder=""WebExpress.WebUI""></div>")]
        public void SearchPlaceholder(string searchPlaceholder, string expected)
        {
            // preconditions
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestDropdown()
            {
                SearchPlaceholder = searchPlaceholder
            };

            // test execution
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }
    }
}