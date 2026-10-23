using System;
using System.Linq;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebData;
using WebExpress.WebApp.WebControl;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the C# rollout of the wx-service island element across the control
    /// families that already have a tested JavaScript descriptor: kanban,
    /// dashboard, tile, comment, scrum backlog, workflow and tab. Each family
    /// asserts that a declared data service emits the island element. The
    /// default (no service emits no island) is covered by the existing per
    /// control render tests, which would fail if the emission were
    /// unconditional.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlDataServiceIslandRollout
    {
        /// <summary>
        /// Renders a control through the standard mock render context and visual
        /// tree, so each test stays a single expressive line.
        /// </summary>
        /// <param name="render">The render invocation.</param>
        /// <returns>The rendered html string.</returns>
        private static string Render(Func<IRenderControlContext, IVisualTreeControl, IHtmlNode> render)
        {
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);

            return render(context, visualTree).ToString();
        }

        // kanban

        [Fact]
        public void KanbanEmitsTheIsland()
        {
            var html = Render((ctx, vt) => new ControlDataKanban() { ServiceFactory = _ => DataServiceDescriptor.Data("/api/board") }.Render(ctx, vt));
            Assert.Contains("class=\"wx-webapp-kanban\"", html);
            Assert.Contains("<wx-service hidden name=\"data\" kind=\"rest\" base-uri=\"/api/board\" method=\"GET\" update-method=\"PUT\">", html);
        }


        // dashboard

        [Fact]
        public void DashboardEmitsTheIsland()
        {
            var html = Render((ctx, vt) => new ControlDataDashboard() { ServiceFactory = _ => DataServiceDescriptor.Data("/api/dash") }.Render(ctx, vt));
            Assert.Contains("class=\"wx-webapp-dashboard\"", html);
            Assert.Contains("<wx-service hidden name=\"data\" kind=\"rest\" base-uri=\"/api/dash\" method=\"GET\" update-method=\"PUT\">", html);
        }


        // tile

        [Fact]
        public void TileEmitsTheIsland()
        {
            var html = Render((ctx, vt) => new ControlDataTile() { ServiceFactory = _ => DataServiceDescriptor.Data("/api/tiles") }.Render(ctx, vt));
            Assert.Contains("class=\"wx-webapp-tile\"", html);
            Assert.Contains("<wx-service hidden name=\"data\" kind=\"rest\" base-uri=\"/api/tiles\" method=\"GET\" update-method=\"PUT\">", html);
        }


        // comment

        [Fact]
        public void CommentEmitsTheIsland()
        {
            var html = Render((ctx, vt) => new ControlDataComment() { ServiceFactory = _ => DataServiceDescriptor.Data("/api/comments") }.Render(ctx, vt));
            Assert.Contains("class=\"wx-webapp-comment\"", html);
            Assert.Contains("<wx-service hidden name=\"data\" kind=\"rest\" base-uri=\"/api/comments\" method=\"GET\" update-method=\"PUT\">", html);
        }


        // scrum backlog

        [Fact]
        public void ScrumBacklogEmitsTheIsland()
        {
            var html = Render((ctx, vt) => new ControlDataScrumBacklog() { ServiceFactory = _ => DataServiceDescriptor.Data("/api/backlog") }.Render(ctx, vt));
            Assert.Contains("class=\"wx-webapp-scrum-backlog\"", html);
            Assert.Contains("<wx-service hidden name=\"data\" kind=\"rest\" base-uri=\"/api/backlog\" method=\"GET\" update-method=\"PUT\">", html);
        }


        // workflow

        [Fact]
        public void WorkflowEmitsTheIsland()
        {
            var html = Render((ctx, vt) => new ControlDataWorkflow() { ServiceFactory = _ => DataServiceDescriptor.Data("/api/wf") }.Render(ctx, vt));
            Assert.Contains("class=\"wx-webapp-workflow-editor\"", html);
            Assert.Contains("<wx-service hidden name=\"data\" kind=\"rest\" base-uri=\"/api/wf\" method=\"GET\" update-method=\"PUT\">", html);
        }


        // tab (uses the tab data descriptor with the id query and items response)

        [Fact]
        public void TabEmitsTheIsland()
        {
            var html = Render((ctx, vt) => new ControlDataTab() { ServiceFactory = _ => DataServiceDescriptor.TabData("/api/tabs") }.Render(ctx, vt));
            Assert.Contains("class=\"wx-webapp-tab\"", html);
            Assert.Contains("<wx-service hidden name=\"data\" kind=\"rest\" base-uri=\"/api/tabs\" method=\"GET\" update-method=\"PUT\">", html);
            Assert.Contains("<wx-query name=\"id\" wire=\"id\"></wx-query>", html);
        }

    }
}
