using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebRestApi;

namespace WebExpress.WebApp.Test.WebRestApi
{
    /// <summary>
    /// Tests that the paging parameters a client sends are kept within bounds, so one request
    /// cannot ask for the whole data set.
    /// </summary>
    public class UnitTestRestApiPaging
    {
        /// <summary>
        /// Verifies the page size and page number read from a query.
        /// </summary>
        /// <param name="query">The query.</param>
        /// <param name="size">The expected page size.</param>
        /// <param name="page">The expected page number.</param>
        [Theory]
        [InlineData("l=20&p=3", 20, 3)]
        [InlineData("l=2147483647&p=0", 500, 0)]
        [InlineData("l=0&p=-5", 1, 0)]
        [InlineData("l=abc", 50, 0)]
        public void PagingIsBounded(string query, int size, int page)
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var request = UnitTestControlFixture.CreateRequestMock("/api?" + query);

            // validation
            Assert.Equal(size, request.ParsePageSize("l", 50));
            Assert.Equal(page, request.ParsePageNumber("p"));
        }
    }
}
