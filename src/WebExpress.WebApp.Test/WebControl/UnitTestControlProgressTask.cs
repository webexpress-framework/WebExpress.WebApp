using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the WebSocket-driven progress task control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlProgressTask
    {
        /// <summary>
        /// Tests the id property of the progress task control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div id=""*"" class=""wx-webapp-progress-task""></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-webapp-progress-task""></div>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlProgressTask(id);

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the TaskId property - the rendered host element must carry
        /// the configured task id as a <c>data-task</c> attribute so the
        /// JavaScript controller can filter incoming MessageQueue updates by
        /// task.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div id=""*"" class=""wx-webapp-progress-task""></div>")]
        [InlineData("", @"<div id=""*"" class=""wx-webapp-progress-task""></div>")]
        [InlineData("id", @"<div id=""*"" class=""wx-webapp-progress-task"" data-task=""id""></div>")]
        public void TaskId(string taskId, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlProgressTask()
            {
                TaskId = _ => taskId
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the ShowOnStart property.
        /// </summary>
        [Theory]
        [InlineData(false, @"<div id=""*"" class=""wx-webapp-progress-task""></div>")]
        [InlineData(true, @"<div id=""*"" class=""wx-webapp-progress-task"" data-show-on-start=""true""></div>")]
        public void ShowOnStart(bool value, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlProgressTask()
            {
                ShowOnStart = _ => value
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the HideOnFinish property.
        /// </summary>
        [Theory]
        [InlineData(false, @"<div id=""*"" class=""wx-webapp-progress-task""></div>")]
        [InlineData(true, @"<div id=""*"" class=""wx-webapp-progress-task"" data-hide-on-finish=""true""></div>")]
        public void HideOnFinish(bool value, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlProgressTask()
            {
                HideOnFinish = _ => value
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the Display property - verifies that the host element picks
        /// up the <c>d-none</c> CSS class when the control is rendered
        /// hidden.
        /// </summary>
        [Theory]
        [InlineData(TypeDisplay.Default, @"<div id=""*"" class=""wx-webapp-progress-task""></div>")]
        [InlineData(TypeDisplay.None, @"<div id=""*"" class=""wx-webapp-progress-task d-none""></div>")]
        public void Display(TypeDisplay value, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlProgressTask()
            {
                Display = _ => value
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Disabled controls must render to <c>null</c> so the page is not
        /// polluted with an inert progress host.
        /// </summary>
        [Fact]
        public void Enable_False_RendersNothing()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlProgressTask()
            {
                Enable = _ => false
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            Assert.Null(html);
        }
    }
}
