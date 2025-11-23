using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebCore.WebSitemap;

namespace WebExpress.WebApp.Test.WebPage
{
    /// <summary>
    /// Test the page manager.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestPageManager
    {
        /// <summary>
        /// Test the id property of the page manager.
        /// </summary>
        [Theory]
        [InlineData(typeof(TestApplication), typeof(TestPageA), "webexpress.webapp.test.testpagea")]
        public void Id(Type applicationType, Type pageType, string id)
        {
            // preconditions
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(applicationType).FirstOrDefault();

            // test execution
            var page = componentHub.PageManager.GetPages(pageType, application);

            if (id is null)
            {
                Assert.Empty(page);
                return;
            }

            // validation
            Assert.Contains(id, page.Select(x => x.EndpointId?.ToString()));
        }

        /// <summary>
        /// Test the process function of the page manager.
        /// </summary>
        [Theory]
        [InlineData("http://localhost:8080/server/app/pagea", "webexpress.webapp.test.testpagea")]
        public void SearchResource(string uri, string id)
        {
            // preconditions
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateHttpContextMock();
            var httpServerContext = UnitTestControlFixture.CreateHttpServerContextMock();
            var searchContext = Activator.CreateInstance<SearchContext>();
            componentHub.SitemapManager.Refresh();
            typeof(SearchContext).GetProperty("HttpServerContext").SetValue(searchContext, httpServerContext);
            typeof(SearchContext).GetProperty("Culture").SetValue(searchContext, httpServerContext.Culture);
            typeof(SearchContext).GetProperty("HttpContext").SetValue(searchContext, context);

            // test execution
            var searchResult = componentHub.SitemapManager.SearchResource(new Uri(uri), searchContext);
            _ = componentHub.EndpointManager.HandleRequest(UnitTestControlFixture.CreateRequestMock(), searchResult.EndpointContext);

            // validation
            Assert.Equal(id, searchResult?.EndpointContext?.EndpointId.ToString());
        }
    }
}
