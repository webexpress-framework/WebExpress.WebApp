using System.Linq;
using System.Net;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebData;
using WebExpress.WebApp.WebControl;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests that the REST list control emits the C# authored data-wx-service
    /// island. This is the pilot of the C# side of the View, State and Service
    /// architecture: the JavaScript already consumes the island through
    /// ServiceRegistry.fromElement and falls back to its legacy descriptor when
    /// the island is absent, so these tests assert both the non breaking default
    /// and the new emission.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlDataListService
    {
        /// <summary>
        /// Tests that a control without a declared data service emits no island,
        /// so the existing markup and the legacy client fallback are preserved.
        /// </summary>
        [Fact]
        public void NoServiceEmitsNoIsland()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataList();

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(@"<div id=""*"" class=""wx-webapp-list""></div>", html);
        }

        /// <summary>
        /// Tests that a declared data service emits the data-wx-service island.
        /// </summary>
        [Fact]
        public void DataServiceEmitsTheIsland()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataList()
            {
                ServiceFactory = _ => DataServiceDescriptor.ListData("/api/orders")
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(@"<div id=""*"" class=""wx-webapp-list"" data-wx-service=""*""></div>", html);
        }

        /// <summary>
        /// Tests that the island is HTML attribute encoded so its json quotes do
        /// not break the markup, and that it decodes back to the exact island.
        /// </summary>
        [Fact]
        public void IslandIsHtmlEncoded()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataList()
            {
                ServiceFactory = _ => DataServiceDescriptor.ListData("/api/orders")
            };

            // act
            var html = control.Render(context, visualTree).ToString();

            // validation: encoded json quotes, and the full encoded island is present
            Assert.Contains("&quot;name&quot;:&quot;data&quot;", html);
            Assert.Contains(WebUtility.HtmlEncode(DataServiceDescriptor.ListData("/api/orders").ToIsland()), html);
        }
    }
}
