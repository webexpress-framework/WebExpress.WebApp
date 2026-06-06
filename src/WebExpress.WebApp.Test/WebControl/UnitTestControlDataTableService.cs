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
    /// Tests that the REST table control emits the C# authored data-wx-service
    /// island. This is the second control family of the C# rollout of the View,
    /// State and Service architecture, after the list. The JavaScript already
    /// consumes the island through ServiceRegistry.fromElement and falls back to
    /// its legacy descriptor when the island is absent, so these tests assert
    /// both the non breaking default and the new emission.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlDataTableService
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
            var control = new ControlDataTable();

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(@"<div id=""*"" class=""wx-webapp-table""></div>", html);
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
            var control = new ControlDataTable()
            {
                ServiceFactory = _ => DataServiceDescriptor.TableData("/api/orders")
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(@"<div id=""*"" class=""wx-webapp-table"" data-wx-service=""*""></div>", html);
        }

        /// <summary>
        /// Tests that the island is emitted next to the legacy data-uri attribute,
        /// so the migration is additive and the legacy fallback stays available.
        /// </summary>

        /// <summary>
        /// Tests that the island is HTML attribute encoded so its json quotes do
        /// not break the markup, and that the full encoded island is present.
        /// </summary>
        [Fact]
        public void IslandIsHtmlEncoded()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataTable()
            {
                ServiceFactory = _ => DataServiceDescriptor.TableData("/api/orders")
            };

            // act
            var html = control.Render(context, visualTree).ToString();

            // validation: encoded json quotes, and the full encoded island is present
            Assert.Contains("&quot;updateMethod&quot;:&quot;PUT&quot;", html);
            Assert.Contains(WebUtility.HtmlEncode(DataServiceDescriptor.TableData("/api/orders").ToIsland()), html);
        }
    }
}
