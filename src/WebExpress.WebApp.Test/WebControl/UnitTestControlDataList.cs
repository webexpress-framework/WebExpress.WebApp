using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the api list control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlDataList
    {
        /// <summary>
        /// Tests the id property of the api list control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div id=""*"" class=""wx-webapp-list""></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-webapp-list""></div>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataList(id)
            {
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the layout property of the list control.
        /// </summary>
        [Theory]
        [InlineData(TypeLayoutList.Default, @"<div id=""*"" class=""wx-webapp-list""></div>")]
        [InlineData(TypeLayoutList.Simple, @"<div id=""*"" class=""wx-webapp-list"" data-layout=""list-unstyled""></div>")]
        [InlineData(TypeLayoutList.Group, @"<div id=""*"" class=""wx-webapp-list"" data-layout=""list-group""></div>")]
        [InlineData(TypeLayoutList.Horizontal, @"<div id=""*"" class=""wx-webapp-list"" data-layout=""list-group list-group-horizontal""></div>")]
        [InlineData(TypeLayoutList.Flush, @"<div id=""*"" class=""wx-webapp-list"" data-layout=""list-group list-group-flush""></div>")]
        public void Layout(TypeLayoutList layout, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataList()
            {
                Layout = _ => layout
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that the Title property emits a data-title attribute.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div id=""*"" class=""wx-webapp-list""></div>")]
        [InlineData("", @"<div id=""*"" class=""wx-webapp-list""></div>")]
        [InlineData("My List", @"<div id=""*"" class=""wx-webapp-list"" data-title=""My List""></div>")]
        [InlineData("webexpress.webui:plugin.name", @"<div id=""*"" class=""wx-webapp-list"" data-title=""WebExpress.WebUI""></div>")]
        public void Title(string title, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataList(null) { Title = _ => title };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that Sortable=true emits data-sortable="true" and Sortable=false omits the attribute.
        /// </summary>
        [Theory]
        [InlineData(false, @"<div id=""*"" class=""wx-webapp-list""></div>")]
        [InlineData(true, @"<div id=""*"" class=""wx-webapp-list"" data-sortable=""true""></div>")]
        public void Sortable(bool sortable, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataList(null) { Sortable = _ => sortable };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }
    }
}