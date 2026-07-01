using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the WebSocket-driven status task (dot) control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlStatusTask
    {
        /// <summary>
        /// Tests the id property of the status task control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div id=""*"" class=""wx-webapp-status-task""></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-webapp-status-task""></div>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlStatusTask(id);

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the TaskId property - the rendered host element must carry the
        /// configured task id as a <c>data-task</c> attribute so the JavaScript
        /// controller can filter incoming MessageQueue updates by task.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div id=""*"" class=""wx-webapp-status-task""></div>")]
        [InlineData("", @"<div id=""*"" class=""wx-webapp-status-task""></div>")]
        [InlineData("id", @"<div id=""*"" class=""wx-webapp-status-task"" data-task=""id""></div>")]
        public void TaskId(string taskId, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlStatusTask()
            {
                TaskId = _ => taskId
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the Status property - only a non-default status is seeded into the
        /// <c>data-status</c> attribute, so the implicit <c>none</c> state stays off
        /// the wire.
        /// </summary>
        [Theory]
        [InlineData(TypeStatusTask.None, @"<div id=""*"" class=""wx-webapp-status-task""></div>")]
        [InlineData(TypeStatusTask.Pending, @"<div id=""*"" class=""wx-webapp-status-task"" data-status=""pending""></div>")]
        [InlineData(TypeStatusTask.Running, @"<div id=""*"" class=""wx-webapp-status-task"" data-status=""running""></div>")]
        [InlineData(TypeStatusTask.Warning, @"<div id=""*"" class=""wx-webapp-status-task"" data-status=""warning""></div>")]
        [InlineData(TypeStatusTask.Error, @"<div id=""*"" class=""wx-webapp-status-task"" data-status=""error""></div>")]
        [InlineData(TypeStatusTask.Done, @"<div id=""*"" class=""wx-webapp-status-task"" data-status=""done""></div>")]
        public void Status(TypeStatusTask status, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlStatusTask()
            {
                Status = _ => status
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the Label property - the caption is emitted as a <c>data-label</c>
        /// attribute the client turns into the visible caption and the tooltip.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div id=""*"" class=""wx-webapp-status-task""></div>")]
        [InlineData("Deployment", @"<div id=""*"" class=""wx-webapp-status-task"" data-label=""Deployment""></div>")]
        public void Label(string label, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlStatusTask()
            {
                Label = _ => label
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
        [InlineData(false, @"<div id=""*"" class=""wx-webapp-status-task""></div>")]
        [InlineData(true, @"<div id=""*"" class=""wx-webapp-status-task"" data-show-on-start=""true""></div>")]
        public void ShowOnStart(bool value, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlStatusTask()
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
        [InlineData(false, @"<div id=""*"" class=""wx-webapp-status-task""></div>")]
        [InlineData(true, @"<div id=""*"" class=""wx-webapp-status-task"" data-hide-on-finish=""true""></div>")]
        public void HideOnFinish(bool value, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlStatusTask()
            {
                HideOnFinish = _ => value
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the Display property - the host element picks up the <c>d-none</c>
        /// CSS class when the control is rendered hidden.
        /// </summary>
        [Theory]
        [InlineData(TypeDisplay.Default, @"<div id=""*"" class=""wx-webapp-status-task""></div>")]
        [InlineData(TypeDisplay.None, @"<div id=""*"" class=""wx-webapp-status-task d-none""></div>")]
        public void Display(TypeDisplay value, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlStatusTask()
            {
                Display = _ => value
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Disabled controls must render to <c>null</c> so the page is not polluted
        /// with an inert status host.
        /// </summary>
        [Fact]
        public void Enable_False_RendersNothing()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlStatusTask()
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
