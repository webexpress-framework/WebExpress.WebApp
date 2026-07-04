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
                .ToIslandElement()
                .ToString();

            // validation
            Assert.Contains("name=\"data\"", island);
            Assert.Contains("method=\"GET\"", island);
            Assert.Contains("update-method=\"PUT\"", island);
            Assert.Contains("<wx-query name=\"search\" wire=\"q\"></wx-query>", island);
            Assert.Contains("<wx-response name=\"items\" wire=\"items\"></wx-response>", island);
            Assert.Contains("<wx-response name=\"total\" wire=\"total\"></wx-response>", island);
        }

        /// <summary>
        /// Tests that the fluent State extension makes the control emit the
        /// wx-state island element.
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
            var html = control.Render(context, visualTree).ToString();

            // validation
            Assert.Contains("<wx-state hidden>", html);
            Assert.Contains("<wx-prop name=\"page\" type=\"number\">0</wx-prop>", html);
            Assert.Contains("<wx-prop name=\"pageSize\" type=\"number\">25</wx-prop>", html);
        }

        /// <summary>
        /// Tests that the fluent Service extension makes the control emit the
        /// wx-service island element with the declared shape.
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
            Assert.Contains("<wx-service hidden name=\"data\"", html);
            Assert.Contains("method=\"GET\"", html);
            Assert.Contains("<wx-response name=\"items\" wire=\"items\"></wx-response>", html);
        }

        /// <summary>
        /// Tests that two declared services emit one wx-service island element
        /// per service, which is the shape a form with a load and a submit
        /// service produces and that ServiceRegistry.fromElement consumes.
        /// </summary>
        [Fact]
        public void TwoServicesEmitTwoIslands()
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

            // validation: one island element per named service
            Assert.Contains("<wx-service hidden name=\"load\"", html);
            Assert.Contains("<wx-service hidden name=\"submit\"", html);
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
                .ToIslandElement()
                .ToString();

            // validation: identical to the historical list mapping
            Assert.Contains("<wx-query name=\"search\" wire=\"q\"></wx-query>", island);
            Assert.Contains("<wx-query name=\"wql\" wire=\"wql\"></wx-query>", island);
            Assert.Contains("<wx-query name=\"filter\" wire=\"f\"></wx-query>", island);
            Assert.Contains("<wx-query name=\"page\" wire=\"p\"></wx-query>", island);
            Assert.Contains("<wx-query name=\"pageSize\" wire=\"l\"></wx-query>", island);
            Assert.Contains("<wx-query name=\"orderBy\" wire=\"o\"></wx-query>", island);
            Assert.Contains("<wx-query name=\"orderDir\" wire=\"d\"></wx-query>", island);
            Assert.Contains("<wx-response name=\"items\" wire=\"items\"></wx-response>", island);
            Assert.Contains("<wx-response name=\"total\" wire=\"total\"></wx-response>", island);
        }

        /// <summary>
        /// Tests that the typed state helpers set the closed state vocabulary,
        /// so the initial state needs no string at the call site.
        /// </summary>
        [Fact]
        public void TypedStateHelpersSetTheVocabulary()
        {
            // act
            var island = DataState.Create().Page(0).PageSize(25).ToIslandElement().ToString();

            // validation
            Assert.Contains("<wx-prop name=\"page\" type=\"number\">0</wx-prop>", island);
            Assert.Contains("<wx-prop name=\"pageSize\" type=\"number\">25</wx-prop>", island);
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
        /// Tests that declaring the endpoint derives the domains from the CRUD
        /// item type, so an author who writes Endpoint&lt;TEndpoint&gt;() gets
        /// live data updates without naming the domain a second time.
        /// </summary>
        [Fact]
        public void EndpointDerivesTheDomainsFromTheCrudItemType()
        {
            // arrange: the endpoint resolution touches the sitemap at build time
            UnitTestControlFixture.CreateAndRegisterComponentHubMock();

            // act
            var island = new DataServiceBuilder("data")
                .Endpoint<FakeCrudEndpoint>()
                .Build(null)
                .ToIslandElement()
                .ToString();

            // validation: the wire name is the lower case full name of the item type
            Assert.Contains($"domains=\"{typeof(FakeDomainItem).FullName.ToLower()}\"", island);
        }

        /// <summary>
        /// Tests that an endpoint whose item type belongs to no domain derives
        /// no domains, so the service island stays free of the attribute.
        /// </summary>
        [Fact]
        public void EndpointWithoutADomainItemDerivesNoDomains()
        {
            // arrange
            UnitTestControlFixture.CreateAndRegisterComponentHubMock();

            // act
            var island = new DataServiceBuilder("data")
                .Endpoint<FakeEndpoint>()
                .Build(null)
                .ToIslandElement()
                .ToString();

            // validation
            Assert.DoesNotContain("domains", island);
        }

        /// <summary>
        /// Tests that the explicit Domain declaration emits the domain for
        /// endpoints whose item types cannot be derived from the endpoint type.
        /// </summary>
        [Fact]
        public void ExplicitDomainDeclarationEmitsTheDomain()
        {
            // act
            var island = new DataServiceBuilder("data")
                .Domain<FakeDomainItem>()
                .Build(null)
                .ToIslandElement()
                .ToString();

            // validation
            Assert.Contains($"domains=\"{typeof(FakeDomainItem).FullName.ToLower()}\"", island);
        }

        /// <summary>
        /// A marker endpoint for the preset test.
        /// </summary>
        private sealed class FakeEndpoint : WebExpress.WebCore.WebEndpoint.IEndpoint
        {
        }

        /// <summary>
        /// An index item that belongs to a domain, so a CRUD endpoint that
        /// serves it announces its changes.
        /// </summary>
        private sealed class FakeDomainItem : WebExpress.WebIndex.IIndexItem, WebExpress.WebCore.WebDomain.IDomain
        {
            public Guid Id { get; set; }
        }

        /// <summary>
        /// A CRUD endpoint over the domain item, mirroring the shape an
        /// application REST API has.
        /// </summary>
        private sealed class FakeCrudEndpoint : WebExpress.WebApp.WebRestApi.RestApiCrud<FakeDomainItem>
        {
            protected override IEnumerable<FakeDomainItem> Retrieve(WebExpress.WebIndex.Queries.IQuery<FakeDomainItem> query, WebExpress.WebIndex.Queries.IQueryContext context, WebExpress.WebCore.WebMessage.IRequest request)
            {
                return [];
            }
        }
    }
}
