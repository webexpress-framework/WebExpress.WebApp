using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebApiControl;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the api progress task control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlRestProgressTask
    {
        /// <summary>
        /// Tests the id property of the api progress task control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div id=""*"" class=""wx-webapp-progress-task"" data-uri=""/""></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-webapp-progress-task"" data-uri=""/""></div>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestProgressTask(id)
            {
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the interval property of the api progress task control.
        /// </summary>
        [Theory]
        [InlineData(-1, @"<div id=""*"" class=""wx-webapp-progress-task"" data-uri=""/""></div>")]
        [InlineData(0, @"<div id=""*"" class=""wx-webapp-progress-task"" data-uri=""/""></div>")]
        [InlineData(1000, @"<div id=""*"" class=""wx-webapp-progress-task"" data-interval=""1000"" data-uri=""/""></div>")]
        public void Interval(int interval, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestProgressTask()
            {
                Interval = interval
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the taskid property of the api progress task control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div id=""*"" class=""wx-webapp-progress-task"" data-uri=""/""></div>")]
        [InlineData("", @"<div id=""*"" class=""wx-webapp-progress-task"" data-uri=""/""></div>")]
        [InlineData("id", @"<div id=""*"" class=""wx-webapp-progress-task"" data-task=""id"" data-uri=""/""></div>")]
        public void TaskId(string taskId, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestProgressTask()
            {
                TaskId = taskId
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the show on start property of the api progress task control.
        /// </summary>
        [Theory]
        [InlineData(false, @"<div id=""*"" class=""wx-webapp-progress-task"" data-uri=""/""></div>")]
        [InlineData(true, @"<div id=""*"" class=""wx-webapp-progress-task"" data-show-on-start=""true"" data-uri=""/""></div>")]
        public void ShowOnStart(bool value, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestProgressTask()
            {
                ShowOnStart = value
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the hide on finish property of the api progress task control.
        /// </summary>
        [Theory]
        [InlineData(false, @"<div id=""*"" class=""wx-webapp-progress-task"" data-uri=""/""></div>")]
        [InlineData(true, @"<div id=""*"" class=""wx-webapp-progress-task"" data-hide-on-finish=""true"" data-uri=""/""></div>")]
        public void HideOnFinish(bool value, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestProgressTask()
            {
                HideOnFinish = value
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the hide on finish property of the api progress task control.
        /// </summary>
        [Theory]
        [InlineData(TypeDisplay.Default, @"<div id=""*"" class=""wx-webapp-progress-task"" data-uri=""/""></div>")]
        [InlineData(TypeDisplay.None, @"<div id=""*"" class=""wx-webapp-progress-task d-none"" data-uri=""/""></div>")]
        public void Display(TypeDisplay value, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestProgressTask()
            {
                Display = value
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }
    }
}
