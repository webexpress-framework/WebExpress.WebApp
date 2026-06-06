using System.Net.Http;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebApp.WebData;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebData
{
    /// <summary>
    /// Tests the fluent C# authoring surface of the data layer: the
    /// <see cref="DataServiceBuilder"/> that produces a service descriptor and the
    /// State and Service extensions that let a control declare its state and
    /// service by chaining, matching the View, State and Service concept. The
    /// endpoint resolution through the sitemap is exercised by the tutorial pages;
    /// these tests cover the builder shape and that the chain emits the islands.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestDataAuthoring
    {
        /// <summary>
        /// Tests that the builder produces a descriptor that carries the declared
        /// method, update method, query mapping and response mapping.
        /// </summary>
        [Fact]
        public void BuilderProducesDescriptorShape()
        {
            // act
            var island = new DataServiceBuilder("data")
                .Method(HttpMethod.Get)
                .UpdateMethod(HttpMethod.Put)
                .Query(q => q.Map("search", "q").Map("page", "p"))
                .Response(r => r.Items("items").Total("total"))
                .Build(null)
                .ToIsland();

            // validation
            Assert.Contains("\"name\":\"data\"", island);
            Assert.Contains("\"method\":\"GET\"", island);
            Assert.Contains("\"updateMethod\":\"PUT\"", island);
            Assert.Contains("\"search\":\"q\"", island);
            Assert.Contains("\"items\":\"items\"", island);
            Assert.Contains("\"total\":\"total\"", island);
        }

        /// <summary>
        /// Tests that the fluent State extension makes the control emit the
        /// data-wx-state island.
        /// </summary>
        [Fact]
        public void FluentStateEmitsTheStateIsland()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataList("myList")
                .State(s => s.Set("page", 0).Set("pageSize", 25));

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(@"<div id=""myList"" class=""wx-webapp-list"" data-wx-state=""*""></div>", html);
        }

        /// <summary>
        /// Tests that the fluent Service extension makes the control emit the
        /// data-wx-service island with the declared, HTML-encoded shape.
        /// </summary>
        [Fact]
        public void FluentServiceEmitsTheServiceIsland()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataList("myList")
                .Service("data", svc => svc.Method(HttpMethod.Get).Response(r => r.Items("items")));

            // act
            var html = control.Render(context, visualTree).ToString();

            // validation
            Assert.Contains("data-wx-service=", html);
            Assert.Contains("&quot;name&quot;:&quot;data&quot;", html);
            Assert.Contains("&quot;method&quot;:&quot;GET&quot;", html);
        }
    }
}
