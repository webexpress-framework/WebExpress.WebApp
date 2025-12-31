using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the message queue.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlMessageQueueStatus
    {
        /// <summary>
        /// Tests the id property of the message queue control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-message-queue-status"" role=""status""></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-webapp-message-queue-status"" role=""status""></div>")]
        [InlineData("03C6031F-04A9-451F-B817-EBD6D32F8B0C", @"<div id=""03C6031F-04A9-451F-B817-EBD6D32F8B0C"" class=""wx-webapp-message-queue-status"" role=""status""></div>")]
        public void Id(string id, string expected)
        {
            // preconditions
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlMessageQueueStatus(id)
            {
            };

            // test execution
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }
    }
}
