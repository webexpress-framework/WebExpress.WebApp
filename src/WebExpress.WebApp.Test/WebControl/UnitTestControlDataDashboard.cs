using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the api dashboard control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlDataDashboard
    {
        /// <summary>
        /// Tests the id property of the api dashboard control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div id=""*"" class=""wx-webapp-dashboard""></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-webapp-dashboard""></div>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataDashboard(id)
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
        [InlineData(false, false, false, @"<div id=""*"" class=""wx-webapp-dashboard""></div>")]
        [InlineData(true, false, false, @"<div id=""*"" class=""wx-webapp-dashboard"" data-editable-column=""true""></div>")]
        [InlineData(false, true, false, @"<div id=""*"" class=""wx-webapp-dashboard"" data-movable-column=""true""></div>")]
        [InlineData(false, false, true, @"<div id=""*"" class=""wx-webapp-dashboard"" data-deletable-column=""true""></div>")]
        [InlineData(true, true, true, @"<div id=""*"" class=""wx-webapp-dashboard"" data-editable-column=""true"" data-movable-column=""true"" data-deletable-column=""true""></div>")]
        public void ColumnFlags(bool editable, bool movable, bool deletable, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataDashboard()
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
        /// Tests the board menu capability flags emit their data attributes only when true.
        /// </summary>
        [Theory]
        [InlineData(false, false, false, @"<div id=""*"" class=""wx-webapp-dashboard""></div>")]
        [InlineData(true, false, false, @"<div id=""*"" class=""wx-webapp-dashboard"" data-addable-column=""true""></div>")]
        [InlineData(false, true, false, @"<div id=""*"" class=""wx-webapp-dashboard"" data-addable-widget=""true""></div>")]
        [InlineData(false, false, true, @"<div id=""*"" class=""wx-webapp-dashboard"" data-configurable-widget=""true""></div>")]
        [InlineData(true, true, true, @"<div id=""*"" class=""wx-webapp-dashboard"" data-addable-column=""true"" data-addable-widget=""true"" data-configurable-widget=""true""></div>")]
        public void MenuFlags(bool addableColumn, bool addableWidget, bool configurableWidget, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataDashboard()
            {
                AddableColumn = _ => addableColumn,
                AddableWidget = _ => addableWidget,
                ConfigurableWidget = _ => configurableWidget
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }
        /// <summary>
        /// Tests that the fill mode marks the host, which is what makes the shell
        /// hand a height down to the board instead of letting it grow.
        /// </summary>
        [Theory]
        [InlineData(false, @"<div id=""*"" class=""wx-webapp-dashboard""></div>")]
        [InlineData(true, @"<div id=""*"" class=""wx-webapp-dashboard wx-fill""></div>")]
        public void Fill(bool fill, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataDashboard()
            {
                Fill = _ => fill
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }
    }
}