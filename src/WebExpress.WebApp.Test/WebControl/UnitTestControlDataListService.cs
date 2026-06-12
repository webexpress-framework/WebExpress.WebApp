using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebData;
using WebExpress.WebApp.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests that the REST list control emits the C# authored wx-service island
    /// element. The JavaScript consumes the island through
    /// ServiceRegistry.fromElement, so these tests assert both the default
    /// (no declared service emits no island) and the emission shape.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlDataListService
    {
        /// <summary>
        /// Tests that a control without a declared data service emits no island.
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
        /// Tests that a declared data service emits the wx-service island
        /// element as the first child of the host.
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
            var html = control.Render(context, visualTree).ToString();

            // validation
            Assert.Contains("<wx-service hidden name=\"data\" kind=\"rest\" base-uri=\"/api/orders\" method=\"GET\">", html);
            Assert.Contains("</wx-service>", html);
        }

        /// <summary>
        /// Tests that the island carries the mappings as child elements rather
        /// than encoded json, so the markup stays inspectable.
        /// </summary>
        [Fact]
        public void IslandCarriesMappingsAsElements()
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

            // validation
            Assert.Contains("<wx-query name=\"search\" wire=\"q\"></wx-query>", html);
            Assert.Contains("<wx-response name=\"items\" wire=\"items\"></wx-response>", html);
            Assert.DoesNotContain("data-wx-service", html);
        }
    }
}
