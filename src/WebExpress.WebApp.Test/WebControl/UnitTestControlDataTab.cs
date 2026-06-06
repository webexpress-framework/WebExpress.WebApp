using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the api tab control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlDataTab
    {
        /// <summary>
        /// Tests the id property of the api tab control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div id=""*"" class=""wx-webapp-tab""></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-webapp-tab""></div>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataTab(id)
            {
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }


        /// <summary>
        /// Tests the readonly property emits a data-readonly attribute only when true.
        /// </summary>
        [Theory]
        [InlineData(false, @"<div id=""*"" class=""wx-webapp-tab""></div>")]
        [InlineData(true, @"<div id=""*"" class=""wx-webapp-tab"" data-readonly=""true""></div>")]
        public void Readonly(bool readOnly, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataTab()
            {
                Readonly = _ => readOnly
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that the MovableTab flag emits a data-movable-tab attribute only when true.
        /// </summary>
        [Theory]
        [InlineData(false, @"<div id=""*"" class=""wx-webapp-tab""></div>")]
        [InlineData(true, @"<div id=""*"" class=""wx-webapp-tab"" data-movable-tab=""true""></div>")]
        public void MovableTab(bool movable, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataTab()
            {
                MovableTab = _ => movable
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }
    }
}
