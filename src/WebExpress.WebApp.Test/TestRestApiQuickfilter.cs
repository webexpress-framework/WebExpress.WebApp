using WebExpress.WebApp.Test.Model;
using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebIndex.Queries;

namespace WebExpress.WebApp.Test
{
    /// <summary>
    /// Provides a test implementation of a REST API quickfilter.
    /// </summary>
    public sealed class TestRestApiQuickfilter : RestApiQuickfilter<TestIndexItem>
    {
        private readonly IEnumerable<TestIndexItem> _testData;

        /// <summary>
        /// Initializes a new instance of the class with the specified data.
        /// </summary>
        /// <param name="data">
        /// The collection of TestIndexItem objects to be displayed in the quickfilter. Cannot be null.
        /// </param>
        public TestRestApiQuickfilter(IEnumerable<TestIndexItem> data)
        {
            _testData = data;
        }

        /// <summary>
        /// Retrieves a queryable collection of index items.
        /// </summary>
        /// <param name="context">
        /// The context in which the query is executed. Provides additional information or constraints 
        /// for the retrieval operation. Cannot be null.
        /// </param>
        /// <param name="request">
        /// The request that provides the operational context.
        /// </param>
        /// <returns>
        /// An enumerable collection of quick filter items that match the 
        /// specified context and request. The collection may be empty if 
        /// no items are found.
        /// </returns>
        protected override IEnumerable<RestApiQuickfilterItem> RetrieveItems(IQueryContext context, IRequest request)
        {
            return _testData.Select(x => new RestApiQuickfilterItem()
            {
                Id = x.Id.ToString(),
                Name = x.Key
            });
        }
    }
}
