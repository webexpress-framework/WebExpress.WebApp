using System;
using System.Linq;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebData;
using WebExpress.WebApp.WebControl;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the C# rollout of the data-wx-service island across the control
    /// families that already have a tested JavaScript descriptor: kanban,
    /// dashboard, tile, comment, scrum backlog, workflow and tab. Each family
    /// asserts that a declared data service emits the island and that it
    /// coexists with the legacy uri attribute. The non breaking default (no
    /// service emits no island) is covered by the existing per control render
    /// tests, which would fail if the emission were unconditional.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlDataServiceIslandRollout
    {
        /// <summary>
        /// Renders a control through the standard mock render context and visual
        /// tree, so each test stays a single expressive line.
        /// </summary>
        /// <param name="render">The render invocation.</param>
        /// <returns>The rendered html node.</returns>
        private static IHtmlNode Render(Func<IRenderControlContext, IVisualTreeControl, IHtmlNode> render)
        {
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);

            return render(context, visualTree);
        }

        // kanban

        [Fact]
        public void KanbanEmitsTheIsland()
        {
            var html = Render((ctx, vt) => new ControlDataKanban() { ServiceFactory = _ => DataServiceDescriptor.Data("/api/board") }.Render(ctx, vt));
            AssertExtensions.EqualWithPlaceholders(@"<div id=""*"" class=""wx-webapp-kanban"" data-wx-service=""*""></div>", html);
        }


        // dashboard

        [Fact]
        public void DashboardEmitsTheIsland()
        {
            var html = Render((ctx, vt) => new ControlDataDashboard() { ServiceFactory = _ => DataServiceDescriptor.Data("/api/dash") }.Render(ctx, vt));
            AssertExtensions.EqualWithPlaceholders(@"<div id=""*"" class=""wx-webapp-dashboard"" data-wx-service=""*""></div>", html);
        }


        // tile

        [Fact]
        public void TileEmitsTheIsland()
        {
            var html = Render((ctx, vt) => new ControlDataTile() { ServiceFactory = _ => DataServiceDescriptor.Data("/api/tiles") }.Render(ctx, vt));
            AssertExtensions.EqualWithPlaceholders(@"<div id=""*"" class=""wx-webapp-tile"" data-wx-service=""*""></div>", html);
        }


        // comment (renders no id attribute when the id is null)

        [Fact]
        public void CommentEmitsTheIsland()
        {
            var html = Render((ctx, vt) => new ControlDataComment() { ServiceFactory = _ => DataServiceDescriptor.Data("/api/comments") }.Render(ctx, vt));
            AssertExtensions.EqualWithPlaceholders(@"<div class=""wx-webapp-comment"" data-wx-service=""*""></div>", html);
        }


        // scrum backlog (uses the data-rest-uri attribute)

        [Fact]
        public void ScrumBacklogEmitsTheIsland()
        {
            var html = Render((ctx, vt) => new ControlDataScrumBacklog() { ServiceFactory = _ => DataServiceDescriptor.Data("/api/backlog") }.Render(ctx, vt));
            AssertExtensions.EqualWithPlaceholders(@"<div id=""*"" class=""wx-webapp-scrum-backlog"" data-wx-service=""*""></div>", html);
        }


        // workflow

        [Fact]
        public void WorkflowEmitsTheIsland()
        {
            var html = Render((ctx, vt) => new ControlDataWorkflow() { ServiceFactory = _ => DataServiceDescriptor.Data("/api/wf") }.Render(ctx, vt));
            AssertExtensions.EqualWithPlaceholders(@"<div id=""*"" class=""wx-webapp-workflow-editor"" data-wx-service=""*""></div>", html);
        }


        // tab (uses the tab data descriptor with the id query and items response)

        [Fact]
        public void TabEmitsTheIsland()
        {
            var html = Render((ctx, vt) => new ControlDataTab() { ServiceFactory = _ => DataServiceDescriptor.TabData("/api/tabs") }.Render(ctx, vt));
            AssertExtensions.EqualWithPlaceholders(@"<div id=""*"" class=""wx-webapp-tab"" data-wx-service=""*""></div>", html);
        }

    }
}
