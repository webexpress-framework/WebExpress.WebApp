using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the web app headline control.
    /// </summary>
    public class UnitTestControlWebAppHeadline
    {
        /// <summary>
        /// Tests the id property of the web app headline control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<header style=""display: block;"">*</header>")]
        [InlineData("id", @"<header id=""id"" style=""display: block;"">*</header>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlWebAppHeadline(id)
            {
            };

            // act
            var html = control.Render(context, visualTree);

            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the title property of the web app headline control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<header style=""display: block;"">*<div class=""me-2 mb-0""></div>*</header>")]
        [InlineData("title", @"<header style=""display: block;"">*<h2 class=""me-2 mb-0"">title</h2>*</header>")]
        [InlineData("webexpress.webui:plugin.name", @"<header style=""display: block;"">*<h2 class=""me-2 mb-0"">WebExpress.WebUI</h2>*</header>")]
        public void Title(string title, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlWebAppHeadline()
            {
                Title = title
            };

            // act
            var html = control.Render(context, visualTree);

            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that a title editor replaces the read-only title while the slot keeps
        /// the heading semantics and look.
        /// </summary>
        [Fact]
        public void TitleEditor()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlWebAppHeadline()
            {
                Title = "title",
                TitleEditor = new ControlSmartEdit("edit")
                    .Add(new ControlFormItemInputText("name").Initialize(x => x.Value.Text = "edited"))
            };

            // act
            var html = control.Render(context, visualTree).ToString();

            // assert
            AssertExtensions.EqualWithPlaceholders(@"<header style=""display: block;"">*<div class=""h2 me-2 mb-0 wx-webapp-headline-title"" role=""heading""><div id=""edit"" class=""wx-webui-smart-edit""*<input*value=""edited""*</div></div>*</header>", html);
            Assert.DoesNotContain("<h2", html);
        }
    }
}
