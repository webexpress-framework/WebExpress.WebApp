using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebPage;
using WebExpress.WebApp.WebStatusPage;
using WebExpress.WebCore.WebApplication;
using WebExpress.WebCore.WebComponent;
using WebExpress.WebCore.WebEndpoint;
using WebExpress.WebCore.WebPlugin;
using WebExpress.WebCore.WebStatusPage;

namespace WebExpress.WebApp.Test.WebStatusPage
{
    /// <summary>
    /// Tests the WebApp status page base class.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestPageStatusWebApp
    {
        /// <summary>
        /// A minimal status page context, since the framework's context can only be populated by
        /// the status page manager.
        /// </summary>
        private sealed class StatusPageContextStub : IStatusPageContext
        {
            public IPluginContext PluginContext => null;
            public IApplicationContext ApplicationContext => null;
            public IComponentId StatusPageId => null;
            public int StatusCode => 404;
            public string StatusTitle => "title";
            public IRoute StatusIcon => null;
            public string StatusDescription => "description";
        }

        /// <summary>
        /// Exposes the protected constructor of the abstract status page.
        /// </summary>
        private sealed class TestStatusPage : PageStatusWebApp
        {
            public TestStatusPage(StatusMessage statusMessage)
                : base(new StatusPageContextStub(), statusMessage)
            {
            }
        }

        /// <summary>
        /// Renders the main content of the status page.
        /// </summary>
        /// <param name="statusMessage">The status message, or null for none.</param>
        /// <returns>The html of the primary main panel content.</returns>
        private static string Render(StatusMessage statusMessage)
        {
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeWebApp(componentHub, context.PageContext);
            var page = new TestStatusPage(statusMessage);

            page.Process(context, visualTree);

            return string.Concat(visualTree.Content.MainPanel.Primary
                .Select(x => x.Render(context, visualTree)?.ToString()));
        }

        /// <summary>
        /// Tests that the status message sits on the theme's recessed surface, so it follows dark
        /// mode instead of staying a bright block, and is not painted through the inline user-color
        /// path whose client-side contrast guess cannot resolve theme tokens.
        /// </summary>
        [Fact]
        public void Process_StatusMessage_UsesThemeSurface()
        {
            // act
            var html = Render(new StatusMessage("message"));

            // validation
            Assert.Contains("message", html);
            Assert.Contains("bg-body-tertiary", html);
            Assert.DoesNotContain("bg-light", html);
            Assert.DoesNotContain("--wx-tertiary-bg", html);
        }

        /// <summary>
        /// Tests that no message card is rendered when there is no status message.
        /// </summary>
        [Fact]
        public void Process_NoStatusMessage_OmitsCard()
        {
            // act
            var html = Render(null);

            // validation
            Assert.DoesNotContain("wx-webui-card", html);
        }
    }
}
