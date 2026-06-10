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

        /// <summary>
        /// Tests that two declared services emit one data-wx-service island that
        /// carries a json array of both descriptors, which is the shape a form
        /// with a load and a submit service produces and that
        /// ServiceRegistry.fromElement already consumes.
        /// </summary>
        [Fact]
        public void TwoServicesEmitOneIslandArray()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataList("myList")
                .Service("load", svc => svc.Method(HttpMethod.Get))
                .Service("submit", svc => svc.Method(HttpMethod.Post));

            // act
            var html = control.Render(context, visualTree).ToString();

            // validation: the island is an array carrying both named services
            Assert.Contains("data-wx-service=\"[", html);
            Assert.Contains("&quot;name&quot;:&quot;load&quot;", html);
            Assert.Contains("&quot;name&quot;:&quot;submit&quot;", html);
        }

        /// <summary>
        /// Tests that assigning the singular ServiceFactory convenience replaces
        /// all previously declared services, so the property keeps its historical
        /// single service semantics.
        /// </summary>
        [Fact]
        public void ServiceFactoryConvenienceReplacesAllServices()
        {
            // arrange
            var control = new ControlDataList("myList")
                .Service("load", svc => svc.Method(HttpMethod.Get))
                .Service("submit", svc => svc.Method(HttpMethod.Post));

            // act
            control.ServiceFactory = _ => DataServiceDescriptor.ListData("/api/orders");

            // validation
            Assert.Single(control.ServiceFactories);
            Assert.NotNull(control.ServiceFactory);
        }

        /// <summary>
        /// Tests that the typed query helpers map the closed logical vocabulary
        /// to the historical wire names, so the standard mapping needs no string
        /// at the call site.
        /// </summary>
        [Fact]
        public void TypedQueryHelpersMapTheVocabulary()
        {
            // act
            var island = new DataServiceBuilder("data")
                .Method(HttpMethod.Get)
                .Query(q => q.Search().Wql().Filter().Page().PageSize().OrderBy().OrderDir())
                .Response(r => r.Items().Total())
                .Build(null)
                .ToIsland();

            // validation: identical to the historical list mapping
            Assert.Contains(
                "\"query\":{\"search\":\"q\",\"wql\":\"wql\",\"filter\":\"f\",\"page\":\"p\",\"pageSize\":\"l\",\"orderBy\":\"o\",\"orderDir\":\"d\"}",
                island);
            Assert.Contains("\"response\":{\"items\":\"items\",\"total\":\"total\"}", island);
        }

        /// <summary>
        /// Tests that the typed state helpers set the closed state vocabulary,
        /// so the initial state needs no string at the call site.
        /// </summary>
        [Fact]
        public void TypedStateHelpersSetTheVocabulary()
        {
            // act
            var island = DataState.Create().Page(0).PageSize(25).ToIsland();

            // validation
            Assert.Equal("{\"page\":0,\"pageSize\":25}", island);
        }

        /// <summary>
        /// Tests that the fluent Template extension makes the control emit the
        /// data-wx-template attribute that the client Templates registry resolves.
        /// </summary>
        [Fact]
        public void FluentTemplateEmitsTheTemplateAttribute()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataList("myList")
                .Template("orders-view");

            // act
            var html = control.Render(context, visualTree).ToString();

            // validation
            Assert.Contains("data-wx-template=\"orders-view\"", html);
        }

        /// <summary>
        /// Tests that the family preset declares the standard data service in a
        /// single typed call. The endpoint resolution through the sitemap is
        /// exercised by the tutorial pages; this test asserts that the preset
        /// registers exactly one service factory.
        /// </summary>
        [Fact]
        public void FamilyPresetRegistersTheStandardService()
        {
            // act
            var control = new ControlDataList("myList")
                .State(s => s.Page(0).PageSize(25))
                .DataService<FakeEndpoint>();

            // validation
            Assert.Single(control.ServiceFactories);
            Assert.NotNull(control.StateFactory);
        }

        /// <summary>
        /// A marker endpoint for the preset test.
        /// </summary>
        private sealed class FakeEndpoint : WebExpress.WebCore.WebEndpoint.IEndpoint
        {
        }
    }
}
