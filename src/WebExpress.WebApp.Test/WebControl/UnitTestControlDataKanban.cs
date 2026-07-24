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
    public class UnitTestControlDataKanban
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
            var control = new ControlDataKanban(id)
            {
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
            var control = new ControlDataKanban()
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

        /// <summary>
        /// Tests the board and swimlane capability flags emit their data attributes only when true.
        /// </summary>
        [Theory]
        [InlineData(false, false, false, false, false, @"<div id=""*"" class=""wx-webapp-kanban""></div>")]
        [InlineData(true, false, false, false, false, @"<div id=""*"" class=""wx-webapp-kanban"" data-addable-column=""true""></div>")]
        [InlineData(false, true, false, false, false, @"<div id=""*"" class=""wx-webapp-kanban"" data-addable-swimlane=""true""></div>")]
        [InlineData(false, false, true, false, false, @"<div id=""*"" class=""wx-webapp-kanban"" data-editable-swimlane=""true""></div>")]
        [InlineData(false, false, false, true, false, @"<div id=""*"" class=""wx-webapp-kanban"" data-deletable-swimlane=""true""></div>")]
        [InlineData(false, false, false, false, true, @"<div id=""*"" class=""wx-webapp-kanban"" data-configurable-board=""true""></div>")]
        [InlineData(true, true, true, true, true, @"<div id=""*"" class=""wx-webapp-kanban"" data-addable-column=""true"" data-addable-swimlane=""true"" data-editable-swimlane=""true"" data-deletable-swimlane=""true"" data-configurable-board=""true""></div>")]
        public void MenuFlags(bool addableColumn, bool addableSwimlane, bool editableSwimlane, bool deletableSwimlane, bool configurableBoard, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataKanban()
            {
                AddableColumn = _ => addableColumn,
                AddableSwimlane = _ => addableSwimlane,
                EditableSwimlane = _ => editableSwimlane,
                DeletableSwimlane = _ => deletableSwimlane,
                ConfigurableBoard = _ => configurableBoard
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the swimlane move and settings capability flags emit their data attributes only when true.
        /// </summary>
        [Theory]
        [InlineData(false, false, @"<div id=""*"" class=""wx-webapp-kanban""></div>")]
        [InlineData(true, false, @"<div id=""*"" class=""wx-webapp-kanban"" data-movable-swimlane=""true""></div>")]
        [InlineData(false, true, @"<div id=""*"" class=""wx-webapp-kanban"" data-configurable-swimlane=""true""></div>")]
        [InlineData(true, true, @"<div id=""*"" class=""wx-webapp-kanban"" data-movable-swimlane=""true"" data-configurable-swimlane=""true""></div>")]
        public void SwimlaneFlags(bool movableSwimlane, bool configurableSwimlane, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataKanban()
            {
                MovableSwimlane = _ => movableSwimlane,
                ConfigurableSwimlane = _ => configurableSwimlane
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }
    }
}
