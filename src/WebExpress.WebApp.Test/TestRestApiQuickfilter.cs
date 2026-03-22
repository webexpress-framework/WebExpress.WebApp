using WebExpress.WebApp.Test.Model;
using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebIndex;
using WebExpress.WebIndex.Queries;

namespace WebExpress.WebApp.Test
{
    /// <summary>
    /// Provides a test implementation of a REST API quickfilter.
    /// </summary>
    public sealed class TestRestApiQuickfilter : TestRestApiQuickfilter<TestIndexItem>
    {
        /// <summary>
        /// Initializes a new instance of the class with the specified data.
        /// </summary>
        /// <param name="data">
        /// The collection of TestIndexItem objects to be displayed in the quickfilter. Cannot be null.
        /// </param>
        public TestRestApiQuickfilter(IEnumerable<TestIndexItem> data)
            : base(data)
        {
        }
    }

    /// <summary>
    /// Provides a test implementation of a REST API quickfilter.
    /// </summary>
    public class TestRestApiQuickfilter<TIndexItem> : RestApiQuickfilter<TIndexItem>
        where TIndexItem : IIndexItem
    {
        private readonly IEnumerable<TIndexItem> _testData;

        /// <summary>
        /// Initializes a new instance of the class with the specified data and optional table title.
        /// </summary>
        /// <param name="data">
        /// The collection of TestIndexItem objects to be displayed in the quickfilter. Cannot be null.
        /// </param>
        public TestRestApiQuickfilter(IEnumerable<TIndexItem> data)
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
        /// A collection representing the filtered set of index items. 
        /// The collection may be empty if no items match the query.
        /// </returns>
        protected override IEnumerable<TIndexItem> Retrieve(IQueryContext context, IRequest request)
        {
            return [];
        }
    }
}
