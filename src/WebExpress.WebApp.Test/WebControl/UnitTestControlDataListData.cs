using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebData;
using WebExpress.WebApp.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests that the REST list control emits the C# authored wx-state island
    /// element through the IDataIsland interface, alongside the wx-service
    /// island. The state island is consumed by the engine through
    /// webexpress.webapp.Data.readState. These tests assert both the emission
    /// and the default (an absent or empty state emits no island).
    /// </summary>
    public class UnitTestControlDataListData
    {
        /// <summary>
        /// Tests that a declared state emits the wx-state island element.
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
            var html = control.Render(context, visualTree).ToString();

            // validation
            Assert.Contains("<wx-state hidden>", html);
            Assert.Contains("<wx-prop name=\"page\" type=\"number\">0</wx-prop>", html);
            Assert.Contains("<wx-prop name=\"pageSize\" type=\"number\">50</wx-prop>", html);
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
            var html = control.Render(context, visualTree).ToString();

            // validation
            Assert.Contains("<wx-state hidden>", html);
            Assert.Contains("<wx-service hidden name=\"data\"", html);
            Assert.True(html.IndexOf("<wx-state") < html.IndexOf("<wx-service"));
        }

        /// <summary>
        /// Tests that an empty state emits no island, so the markup stays
        /// minimal.
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
        /// Tests that state values are written as encoded text, so markup in a value
        /// cannot close the island and become part of the page.
        /// </summary>
        [Fact]
        public void StateValuesAreHtmlEncoded()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataList()
            {
                StateFactory = _ => DataState.Create().Set("items", new[] { "a", "b" }).Set("search", "</wx-prop><script>alert(1)</script>")
            };

            // act
            var html = control.Render(context, visualTree).ToString();

            // validation
            Assert.Contains("<wx-prop name=\"items\" type=\"json\">[\"a\",\"b\"]</wx-prop>", html);
            Assert.Contains("&lt;/wx-prop&gt;&lt;script&gt;", html);
            Assert.DoesNotContain("<script>", html);
        }
    }
}
