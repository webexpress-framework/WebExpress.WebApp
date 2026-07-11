using System.Net.Http;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.WebEndpoint;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebData
{
    /// <summary>
    /// Tests the ControlViewState host. It renders its child controls inside
    /// the host element, marks the element with its ViewState id and emits the
    /// state, service and resource islands at the start of the element, so the
    /// JavaScript ViewState seeds, configures and loads from a single host.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlViewState
    {
        /// <summary>
        /// Tests that the host carries the host class and the ViewState id, so the
        /// controller instantiates a ViewState the controls resolve by id and by
        /// ancestry.
        /// </summary>
        [Fact]
        public void EmitsTheViewStateHost()
        {
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlViewState("orders");

            var html = control.Render(context, visualTree).ToString();

            Assert.Contains("wx-webapp-viewstate", html);
            Assert.Contains("data-wx-viewstate=\"orders\"", html);
        }

        /// <summary>
        /// Tests that the ViewState host emits the state, service and resource islands
        /// together from one chain, which is the markup contract the JavaScript
        /// ViewState consumes.
        /// </summary>
        [Fact]
        public void EmitsStateServiceAndResourceIslands()
        {
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlViewState("orders")
                .State(s => s.Page(0).PageSize(25))
                .Service("data", svc => svc.Method(HttpMethod.Get).Query(q => q.Page()).Response(r => r.Items().Total()))
                .Resource("orders", r => r.Service("data").Param("page", "page").Param("search", "search", "out"));

            var html = control.Render(context, visualTree).ToString();

            Assert.Contains("<wx-state hidden>", html);
            Assert.Contains("<wx-prop name=\"page\" type=\"number\">0</wx-prop>", html);
            Assert.Contains("<wx-service hidden name=\"data\"", html);
            Assert.Contains("<wx-resource hidden name=\"orders\"", html);
            Assert.Contains("<wx-param name=\"page\" state=\"page\" dir=\"inout\"></wx-param>", html);
            Assert.Contains("<wx-param name=\"search\" state=\"search\" dir=\"out\"></wx-param>", html);
        }

        /// <summary>
        /// Tests that the ViewState renders its child controls inside the host
        /// element, so the controls of a region live in the ViewState they
        /// subscribe to and resolve it by ancestry.
        /// </summary>
        [Fact]
        public void RendersChildControlsInsideTheViewState()
        {
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlViewState("orders", new ControlDataList("inner"))
                .Resource("orders", r => r.Service("data").Param("page"));

            var html = control.Render(context, visualTree).ToString();

            // the child list renders inside the ViewState, which keeps its own
            // resource island separate from the child's islands
            Assert.Contains("wx-webapp-list", html);
            Assert.Contains("id=\"inner\"", html);
            Assert.Contains("<wx-resource hidden name=\"orders\"", html);
        }

        /// <summary>
        /// Tests that a ViewState-bound child carries only the resource binding and
        /// skips its own state and service islands, because the enclosing ViewState
        /// owns the state, the service and the central load.
        /// </summary>
        [Fact]
        public void ViewStateBoundChildEmitsResourceBindingNotItsOwnIslands()
        {
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);

            // the list declares a state and a service, but binds a resource by
            // type; the resource binding wins, so the own islands are skipped
            var list = new ControlDataList("list")
                .State(s => s.Page(0))
                .Service("data", svc => svc.Method(HttpMethod.Get));
            list.Resource<OrdersTestResource>();

            var html = list.Render(context, visualTree).ToString();

            Assert.Contains("data-wx-resource=\"" + DataTypeName.Of<OrdersTestResource>() + "\"", html);
            Assert.DoesNotContain("<wx-service", html);
            Assert.DoesNotContain("<wx-state", html);
        }

        /// <summary>
        /// Tests that the type-safe generic ViewState emits the state from the typed
        /// model and the service and resource named by their types, with no child
        /// controls and no string names at the authoring site.
        /// </summary>
        [Fact]
        public void GenericViewStateEmitsTypedStateServiceAndResource()
        {
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);

            var viewState = new ControlViewState<DataQueryState>("orders")
                .State(s => { s.Page = 0; s.PageSize = 25; })
                .Service<FakeEndpoint>(svc => svc.Method(HttpMethod.Get))
                .Resource<OrdersTestResource>(r => r.Service<FakeEndpoint>().Page().PageSize());

            var html = viewState.Render(context, visualTree).ToString();

            Assert.Contains("wx-webapp-viewstate", html);
            Assert.Contains("<wx-prop name=\"page\" type=\"number\">0</wx-prop>", html);
            Assert.Contains("<wx-prop name=\"pageSize\" type=\"number\">25</wx-prop>", html);
            Assert.Contains("<wx-service hidden name=\"" + DataTypeName.Of<FakeEndpoint>() + "\"", html);
            Assert.Contains("<wx-resource hidden name=\"" + DataTypeName.Of<OrdersTestResource>() + "\"", html);
            Assert.Contains("service=\"" + DataTypeName.Of<FakeEndpoint>() + "\"", html);
            Assert.Contains("<wx-param name=\"page\"", html);
        }

        /// <summary>
        /// Tests that the fluent Resource binding returns the concrete control
        /// type, so it chains, and sets the resource binding to the resource type.
        /// </summary>
        [Fact]
        public void FluentResourceBindingPreservesTheControlType()
        {
            // the explicit ControlDataList target only compiles because the
            // per-family binding returns the concrete control type, not IViewStateBound
            ControlDataList list = new ControlDataList("list").Resource<OrdersTestResource>();

            Assert.NotNull(list.ResourceFactory);
            Assert.Equal(DataTypeName.Of<OrdersTestResource>(), list.ResourceFactory(null));
        }

        /// <summary>
        /// A test resource identity used by the ViewState-bound binding test.
        /// </summary>
        private sealed class OrdersTestResource : IDataResource
        {
        }

        /// <summary>
        /// A test endpoint identity used by the generic ViewState authoring test.
        /// </summary>
        private sealed class FakeEndpoint : IEndpoint
        {
        }
    }
}
