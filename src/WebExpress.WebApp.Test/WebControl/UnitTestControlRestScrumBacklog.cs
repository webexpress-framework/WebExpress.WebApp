using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the scrum backlog control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlRestScrumBacklog
    {
        /// <summary>
        /// Tests the id property of the scrum backlog control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div id=""*"" class=""wx-webapp-scrum-backlog""></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-webapp-scrum-backlog""></div>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestScrumBacklog(id)
            {
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the properties of the scrum backlog control.
        /// </summary>
        [Fact]
        public void RenderAttributes()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestScrumBacklog("scrum")
            {
                RestUri = _ => new UriEndpoint("https://example.com/api/scrum/backlog"),
                Title = _ => "Backlog",
                Selectable = _ => false,
                IconActive = _ => "active-icon",
                IconPlanned = _ => "planned-icon",
                IconBacklog = _ => "backlog-icon",
                IconMoveToBacklog = _ => "move-backlog-icon",
                IconMoveToSprint = _ => "move-sprint-icon",
                IconStartSprint = _ => "start-icon",
                IconCompleteSprint = _ => "complete-icon",
                IconEditSprint = _ => "edit-icon",
                IconDeleteSprint = _ => "delete-icon"
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(@"<div id=""scrum"" class=""wx-webapp-scrum-backlog"" data-rest-uri=""https://example.com/api/scrum/backlog"" data-title=""Backlog"" data-selectable=""false"" data-icon-active=""active-icon"" data-icon-planned=""planned-icon"" data-icon-backlog=""backlog-icon"" data-icon-move-to-backlog=""move-backlog-icon"" data-icon-move-to-sprint=""move-sprint-icon"" data-icon-start-sprint=""start-icon"" data-icon-complete-sprint=""complete-icon"" data-icon-edit-sprint=""edit-icon"" data-icon-delete-sprint=""delete-icon""></div>", html);
        }
    }
}
