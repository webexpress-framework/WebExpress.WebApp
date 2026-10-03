using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the api feed control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlDataFeed
    {
        /// <summary>
        /// Tests the id property of the feed control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div id=""*"" class=""wx-webapp-feed"" data-page-size=""5""></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-webapp-feed"" data-page-size=""5""></div>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataFeed(id)
            {
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the page size of the feed control. It is what the reader gets before the button,
        /// so it reaches the client even when it is the default.
        /// </summary>
        [Theory]
        [InlineData(0, @"<div id=""*"" class=""wx-webapp-feed"" data-page-size=""5""></div>")]
        [InlineData(3, @"<div id=""*"" class=""wx-webapp-feed"" data-page-size=""3""></div>")]
        [InlineData(20, @"<div id=""*"" class=""wx-webapp-feed"" data-page-size=""20""></div>")]
        public void PageSize(int pageSize, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataFeed()
            {
                PageSize = _ => pageSize
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the captions of the feed control. They are rendered on the server so the button
        /// carries its wording before any data has arrived.
        /// </summary>
        [Fact]
        public void Captions()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataFeed("feed")
            {
                MoreLabel = _ => "more",
                EmptyText = _ => "empty",
                OpenLabel = _ => "open"
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders
            (
                @"<div id=""feed"" class=""wx-webapp-feed"" data-page-size=""5"" data-more-label=""more"" data-empty-text=""empty"" data-open-label=""open""></div>",
                html
            );
        }

        /// <summary>
        /// Tests the css classes of the feed control.
        /// </summary>
        [Fact]
        public void Classes()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataFeed("feed")
            {
                Classes = ["custom"]
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders
            (
                @"<div id=""feed"" class=""wx-webapp-feed custom"" data-page-size=""5""></div>",
                html
            );
        }
    }
}
