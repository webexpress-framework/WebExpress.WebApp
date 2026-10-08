using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the api table control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlDataTable
    {
        /// <summary>
        /// Tests the id property of the api table control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div id=""*"" class=""wx-webapp-table""></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-webapp-table""></div>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataTable(id)
            {
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }


        /// <summary>
        /// Tests the page size property of the API table control.
        /// </summary>
        [Theory]
        [InlineData(0, @"<div id=""*"" class=""wx-webapp-table""></div>")]
        [InlineData(10, @"<div id=""*"" class=""wx-webapp-table"" data-page-size=""10""></div>")]
        public void PageSize(uint pageSize, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataTable()
            {
                PageSize = _ => pageSize
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }
        /// <summary>
        /// Tests that the fill mode marks the host, which is what makes the shell
        /// hand a height down to the table instead of letting it grow.
        /// </summary>
        [Theory]
        [InlineData(false, @"<div id=""*"" class=""wx-webapp-table""></div>")]
        [InlineData(true, @"<div id=""*"" class=""wx-webapp-table wx-fill""></div>")]
        public void Fill(bool fill, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataTable()
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
