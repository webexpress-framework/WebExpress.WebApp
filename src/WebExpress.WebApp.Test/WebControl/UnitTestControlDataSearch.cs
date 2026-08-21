using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.WebEndpoint;
using WebExpress.WebCore.WebIcon;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebIcon;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the search control with endpoint backed suggestions.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlDataSearch
    {
        /// <summary>
        /// Tests the id property of the search control. The marker class of the static base
        /// control gives way to the data bound one, so only the data bound controller mounts.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-search-suggestion""></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-webapp-search-suggestion""></div>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataSearch(id)
            {
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that the declared endpoint is emitted as the service island the controller
        /// fetches its suggestions through.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-search-suggestion""></div>")]
        [InlineData("https://example.com/api/data", @"<div class=""wx-webapp-search-suggestion""><wx-service hidden name=""data"" kind=""rest"" base-uri=""https://example.com/api/data"" method=""GET""></wx-service></div>")]
        public void Service(string uriString, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataSearch()
            {
                ServiceFactory = uriString is not null ? _ => DataServiceDescriptor.QueryData(uriString) : null
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the entry cap of the search control, which is omitted when it is not capped.
        /// </summary>
        [Theory]
        [InlineData(-1, @"<div class=""wx-webapp-search-suggestion""></div>")]
        [InlineData(0, @"<div class=""wx-webapp-search-suggestion""></div>")]
        [InlineData(5, @"<div class=""wx-webapp-search-suggestion"" data-maxitems=""5""></div>")]
        public void MaxItems(int maxItems, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataSearch()
            {
                MaxItems = _ => maxItems
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the page a submitted term is carried over to.
        /// </summary>
        [Fact]
        public void SubmitUri()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataSearch()
            {
                SubmitUri = _ => new UriEndpoint("/search"),
                QueryParameter = _ => "term"
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(@"<div class=""wx-webapp-search-suggestion"" data-queryparam=""term"" data-submituri=""/search""></div>", html);
        }

        /// <summary>
        /// Tests that the properties of the base control still reach the client, so the box
        /// carries its placeholder and icon as any other search box does.
        /// </summary>
        [Fact]
        public void Appearance()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataSearch()
            {
                Placeholder = _ => "abc",
                Icon = _ => new IconStar(),
                EmptyText = _ => "nothing found"
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(@"<div class=""wx-webapp-search-suggestion"" placeholder=""abc"" data-icon=""wx-icon-light wx-icon-light-star"" data-emptytext=""nothing found""></div>", html);
        }

        /// <summary>
        /// Tests that the family preset declares the suggestion endpoint in a single typed
        /// call. The suggestion search asks the way the remote dropdown does, so the preset
        /// registers exactly one service under the name the controller reads its endpoint from.
        /// </summary>
        [Fact]
        public void DataServiceRegistersTheSuggestionEndpoint()
        {
            // arrange: the endpoint resolution touches the sitemap at build time
            UnitTestControlFixture.CreateAndRegisterComponentHubMock();

            // act
            var control = new ControlDataSearch("crewSearch")
                .DataService<FakeSuggestionEndpoint>();

            // validation
            Assert.Single(control.ServiceFactories);
        }

        /// <summary>
        /// A marker endpoint for the preset test.
        /// </summary>
        private sealed class FakeSuggestionEndpoint : IEndpoint
        {
        }
    }
}
