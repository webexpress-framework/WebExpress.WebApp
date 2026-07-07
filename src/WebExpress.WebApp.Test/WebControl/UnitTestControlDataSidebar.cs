using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebApp.WebData;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the REST sidebar control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlDataSidebar
    {
        /// <summary>
        /// Tests the id property of the REST sidebar control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-sidebar""></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-webapp-sidebar""></div>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataSidebar(id)
            {
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that the service factory emits the wx-service island.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-sidebar""></div>")]
        [InlineData("https://example.com/api/navigation", @"<div class=""wx-webapp-sidebar""><wx-service hidden name=""data"" kind=""rest"" base-uri=""https://example.com/api/navigation"" method=""GET""></wx-service></div>")]
        public void Service(string uriString, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataSidebar()
            {
                ServiceFactory = uriString is not null ? _ => DataServiceDescriptor.QueryData(uriString) : null
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the breakpoint property of the REST sidebar control.
        /// </summary>
        [Theory]
        [InlineData(-1, @"<div class=""wx-webapp-sidebar""></div>")]
        [InlineData(80, @"<div class=""wx-webapp-sidebar"" data-breakpoint=""80""></div>")]
        public void Breakpoint(int breakpoint, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataSidebar()
            {
                Breakpoint = _ => breakpoint
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that the state factory emits the wx-state island so the client
        /// can seed the first paint without a round trip.
        /// </summary>
        [Fact]
        public void State()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataSidebar()
            {
                StateFactory = _ => DataState.Create().Set("id", "root")
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(
                @"<div class=""wx-webapp-sidebar""><wx-state hidden><wx-prop name=""id"">root</wx-prop></wx-state></div>",
                html);
        }
    }
}
