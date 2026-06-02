using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the api kanban control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlRestKanban
    {
        /// <summary>
        /// Tests the id property of the api kanban control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div id=""*"" class=""wx-webapp-kanban""></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-webapp-kanban""></div>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestKanban(id)
            {
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the RestUri property of the api kanban control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div id=""*"" class=""wx-webapp-kanban""></div>")]
        [InlineData("https://example.com/api/data", @"<div id=""*"" class=""wx-webapp-kanban"" data-uri=""https://example.com/api/data""></div>")]
        public void RestUri(string uriString, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestKanban()
            {
                RestUri = _ => uriString is not null ? new UriEndpoint(uriString) : null
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the column capability flags emit their data attributes only when true.
        /// </summary>
        [Theory]
        [InlineData(false, false, false, @"<div id=""*"" class=""wx-webapp-kanban""></div>")]
        [InlineData(true, false, false, @"<div id=""*"" class=""wx-webapp-kanban"" data-editable-column=""true""></div>")]
        [InlineData(false, true, false, @"<div id=""*"" class=""wx-webapp-kanban"" data-movable-column=""true""></div>")]
        [InlineData(false, false, true, @"<div id=""*"" class=""wx-webapp-kanban"" data-deletable-column=""true""></div>")]
        [InlineData(true, true, true, @"<div id=""*"" class=""wx-webapp-kanban"" data-editable-column=""true"" data-movable-column=""true"" data-deletable-column=""true""></div>")]
        public void ColumnFlags(bool editable, bool movable, bool deletable, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestKanban()
            {
                EditableColumn = _ => editable,
                MovableColumn = _ => movable,
                DeletableColumn = _ => deletable
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }
    }
}
