using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the api quickfilter control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlDataQuickfilter
    {
        /// <summary>
        /// Tests the id property of the api quickfilter control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div id=""*"" class=""wx-webapp-quickfilter""></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-webapp-quickfilter""></div>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataQuickfilter(id)
            {
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the RestUri property of the api quickfilter control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div id=""*"" class=""wx-webapp-quickfilter""></div>")]
        [InlineData("https://example.com/api/data", @"<div id=""*"" class=""wx-webapp-quickfilter""><wx-service hidden name=""data"" kind=""rest"" base-uri=""https://example.com/api/data"" method=""GET""></wx-service></div>")]
        public void RestUri(string uriString, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataQuickfilter()
            {
                ServiceFactory = uriString is not null ? _ => DataServiceDescriptor.QueryData(uriString) : null
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests adding a REST-backed dropdown item, whose options the client loads
        /// from the endpoint emitted as the data-rest-uri attribute.
        /// </summary>
        [Fact]
        public void AddRestDropdown()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataQuickfilter("bar");

            // act
            control.Add(new ControlDataQuickfilterItemDropdown("games")
            {
                Text = _ => "Games",
                Multiple = _ => true,
                Uri = _ => new UriEndpoint("https://example.com/api/games")
            });
            var html = control.Render(context, visualTree);

            // validation
            var expected = @"*<div id=""games"" class=""wx-quickfilter-multiselect"" data-text=""Games"" data-rest-uri=""https://example.com/api/games""></div>*";
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests adding a single-choice REST dropdown, which renders as a dropdown
        /// (not a multi-select) and carries the group its options are exclusive in.
        /// </summary>
        [Fact]
        public void AddRestDropdownSingle()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataQuickfilter("bar");

            // act
            control.Add(new ControlDataQuickfilterItemDropdown("platform")
            {
                Text = _ => "Platform",
                Group = _ => "platform",
                Uri = _ => new UriEndpoint("https://example.com/api/platforms")
            });
            var html = control.Render(context, visualTree);

            // validation
            var expected = @"*<div id=""platform"" class=""wx-quickfilter-dropdown"" data-text=""Platform"" data-group=""platform"" data-rest-uri=""https://example.com/api/platforms""></div>*";
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }
    }
}