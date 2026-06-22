using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebData;
using WebExpress.WebApp.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests that the REST table control emits the C# authored wx-service
    /// island element. The JavaScript consumes the island through
    /// ServiceRegistry.fromElement, so these tests assert both the default
    /// (no declared service emits no island) and the emission shape.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlDataTableService
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
            var control = new ControlDataTable();

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(@"<div id=""*"" class=""wx-webapp-table""></div>", html);
        }

        /// <summary>
        /// Tests that a declared data service emits the wx-service island
        /// element with the table mappings.
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
            var html = control.Render(context, visualTree).ToString();

            // validation
            Assert.Contains("<wx-service hidden name=\"data\" kind=\"rest\" base-uri=\"/api/orders\" method=\"GET\" update-method=\"PUT\">", html);
            Assert.Contains("<wx-response name=\"rows\" wire=\"rows\"></wx-response>", html);
            Assert.DoesNotContain("data-wx-service", html);
        }
    }
}
