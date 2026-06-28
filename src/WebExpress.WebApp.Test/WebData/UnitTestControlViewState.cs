using System.Net.Http;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebApp.WebData;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebData
{
    /// <summary>
    /// Tests the ControlViewState scope host. It renders its child controls inside
    /// the scope element, marks the element with its scope id and emits the state,
    /// service and resource islands at the start of the element, so the JavaScript
    /// ViewState seeds, configures and loads the scope from a single host.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlViewState
    {
        /// <summary>
        /// Tests that the host carries the scope class and the scope id, so the
        /// controller instantiates a ViewState the controls resolve by id and by
        /// ancestry.
        /// </summary>
        [Fact]
        public void EmitsTheScopeHost()
        {
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlViewState("orders");

            var html = control.Render(context, visualTree).ToString();

            Assert.Contains("wx-webapp-viewstate", html);
            Assert.Contains("data-wx-scope=\"orders\"", html);
        }

        /// <summary>
        /// Tests that the scope host emits the state, service and resource islands
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
        /// Tests that the scope renders its child controls inside the scope
        /// element, so the controls of a region live in the scope they subscribe
        /// to and resolve it by ancestry.
        /// </summary>
        [Fact]
        public void RendersChildControlsInsideTheScope()
        {
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlViewState("orders", new ControlDataList("inner"))
                .Resource("orders", r => r.Service("data").Param("page"));

            var html = control.Render(context, visualTree).ToString();

            // the child list renders inside the scope, while the scope keeps its
            // own resource island separate from the child's islands
            Assert.Contains("wx-webapp-list", html);
            Assert.Contains("id=\"inner\"", html);
            Assert.Contains("<wx-resource hidden name=\"orders\"", html);
        }

        /// <summary>
        /// Tests that a scope-bound child carries only the resource binding and
        /// skips its own state and service islands, because the enclosing scope
        /// owns the state, the service and the central load.
        /// </summary>
        [Fact]
        public void ScopeBoundChildEmitsResourceBindingNotItsOwnIslands()
        {
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var list = new ControlDataList("list") { Resource = _ => "orders" }
                .State(s => s.Page(0))
                .Service("data", svc => svc.Method(HttpMethod.Get));

            var html = list.Render(context, visualTree).ToString();

            Assert.Contains("data-wx-resource=\"orders\"", html);
            Assert.DoesNotContain("<wx-service", html);
            Assert.DoesNotContain("<wx-state", html);
        }
    }
}
