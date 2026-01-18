using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebCore.WebSitemap;

namespace WebExpress.WebApp.Test.WebRestApi
{
    /// <summary>
    /// Test the rest api manager.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestRestApiManager
    {
        /// <summary>
        /// Test the id property of the rest api manager.
        /// </summary>
        [Theory]
        [InlineData(typeof(TestApplication), typeof(TestRestApiTable), "webexpress.webapp.test.testrestapitable")]
        public void Id(Type applicationType, Type pageType, string id)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(applicationType).FirstOrDefault();

            // act
            var page = componentHub.RestApiManager.GetRestApi(pageType, application);

            if (id is null)
            {
                Assert.Empty(page);
                return;
            }

            // validation
            Assert.Contains(id, page.Select(x => x.EndpointId?.ToString()));
        }

        /// <summary>
        /// Test the process function of the rest api manager.
        /// </summary>
        [Theory]
        [InlineData(@"http://localhost:8080/server/app/api/1/testrestapitable", "webexpress.webapp.test.testrestapitable")]
        public void SearchResource(string uri, string id)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateHttpContextMock();
            var httpServerContext = UnitTestControlFixture.CreateHttpServerContextMock();
            var searchContext = Activator.CreateInstance<SearchContext>();
            componentHub.SitemapManager.Refresh();
            typeof(SearchContext).GetProperty("HttpServerContext").SetValue(searchContext, httpServerContext);
            typeof(SearchContext).GetProperty("Culture").SetValue(searchContext, httpServerContext.Culture);
            typeof(SearchContext).GetProperty("HttpContext").SetValue(searchContext, context);

            // act
            var searchResult = componentHub.SitemapManager.SearchResource(new Uri(uri), searchContext);
            _ = componentHub.EndpointManager.HandleRequest(UnitTestControlFixture.CreateRequestMock(), searchResult.EndpointContext);

            // validation
            Assert.Equal(id, searchResult?.EndpointContext?.EndpointId.ToString());
        }
    }
}
