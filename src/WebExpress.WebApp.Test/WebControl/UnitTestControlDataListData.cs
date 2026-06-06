using System.Net;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebData;
using WebExpress.WebApp.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests that the REST list control emits the C# authored data-wx-state
    /// island through the IDataIsland interface, alongside the data-wx-service
    /// island. The state island is consumed by the engine through
    /// webexpress.webapp.Data.readState. These tests assert both the new
    /// emission and the non breaking default (an absent or empty state emits no
    /// island).
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlDataListData
    {
        /// <summary>
        /// Tests that a declared state emits the data-wx-state island.
        /// </summary>
        [Fact]
        public void StateEmitsTheStateIsland()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataList()
            {
                StateFactory = _ => DataState.Create().Set("page", 0).Set("pageSize", 50)
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(@"<div id=""*"" class=""wx-webapp-list"" data-wx-state=""*""></div>", html);
        }

        /// <summary>
        /// Tests that a declared state and service emit both islands, with the
        /// state island first.
        /// </summary>
        [Fact]
        public void StateAndServiceEmitBothIslands()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataList()
            {
                StateFactory = _ => DataState.Create().Set("page", 0),
                ServiceFactory = _ => DataServiceDescriptor.ListData("/api/orders")
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(@"<div id=""*"" class=""wx-webapp-list"" data-wx-state=""*"" data-wx-service=""*""></div>", html);
        }

        /// <summary>
        /// Tests that an empty state emits no island, so the default stays non
        /// breaking.
        /// </summary>
        [Fact]
        public void EmptyStateEmitsNoStateIsland()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataList()
            {
                StateFactory = _ => DataState.Create()
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(@"<div id=""*"" class=""wx-webapp-list""></div>", html);
        }

        /// <summary>
        /// Tests that the state island is HTML attribute encoded so its json
        /// quotes do not break the markup, and that the full encoded island is
        /// present.
        /// </summary>
        [Fact]
        public void StateIslandIsHtmlEncoded()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataList()
            {
                StateFactory = _ => DataState.Create().Set("page", 0).Set("pageSize", 50)
            };

            // act
            var html = control.Render(context, visualTree).ToString();

            // validation
            Assert.Contains("&quot;page&quot;:0", html);
            Assert.Contains(WebUtility.HtmlEncode(DataState.Create().Set("page", 0).Set("pageSize", 50).ToIsland()), html);
        }
    }
}
