using WebExpress.WebApp.Test.Model;
using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebIndex;
using WebExpress.WebIndex.Queries;
using WebExpress.WebIndex.Wql;

namespace WebExpress.WebApp.Test
{
    /// <summary>
    /// Represents a read-only table of test index items for use with REST API scenarios.
    /// </summary>
    public sealed class TestRestApiTable : TestRestApiTable<TestIndexItem>
    {
        /// <summary>
        /// Initializes a new instance of the TestRestApiTable class with the specified data 
        /// and table title.
        /// </summary>
        /// <param name="data">
        /// The collection of TestIndexItem objects to be displayed in the table. Cannot be null.
        /// </param>
        /// <param name="title">
        /// The title to display for the table. If not specified, defaults to "tab_title".
        /// </param>
        public TestRestApiTable(IEnumerable<TestIndexItem> data, string title = "tab_title")
            : base(data, title)
        {
        }
    }

    /// <summary>
    /// Provides a test implementation of a REST API table for retrieving 
    /// index items using filter strings or WQL statements.
    /// </summary>
    public class TestRestApiTable<TIndexItem> : RestApiTable<TIndexItem>
        where TIndexItem : IIndexItem
    {
        private readonly IEnumerable<TIndexItem> _testData;

        /// <summary>
        /// Initializes a new instance of the class with the specified data and optional table title.
        /// </summary>
        /// <param name="data">
        /// The collection of TestIndexItem objects to be displayed in the table. Cannot be null.
        /// </param>
        /// <param name="title">
        /// The title of the table. If not specified, defaults to "tab_title".
        /// </param>
        public TestRestApiTable(IEnumerable<TIndexItem> data, string title = "tab_title")
        {
            _testData = data;
            Title = title;
        }

        /// <summary>
        /// Returns a collection of available REST API options for the specified 
        /// request and data row.
        /// </summary>
        /// <param name="row">
        /// The data row representing the item for which options are generated. Cannot be null.
        /// </param>
        /// <param name="request">
        /// The request context for which to generate API options. Cannot be null.
        /// </param>
        /// <returns>
        /// An enumerable collection of <see cref="RestApiOption"/> objects representing the 
        /// available actions for the given request and row. The collection will contain at 
        /// least one option if actions are available; otherwise, it may be empty.
        /// </returns>
        public override IEnumerable<RestApiOption> GetOptions(TIndexItem row, IRequest request)
        {
            return
            [
                new RestApiOptionEdit(request) { }
            ];
        }

        /// <summary>
        /// Retrieves a queryable collection of index items that match the specified query criteria.
        /// </summary>
        /// <param name="query">
        /// An object containing the query parameters used to filter and select index items. Cannot 
        /// be null.
        /// </param>
        /// <returns>
        /// A collection representing the filtered set of index items. 
        /// The collection may be empty if no items match the query.
        /// </returns>
        protected override IEnumerable<TIndexItem> Retrieve(IQuery<TIndexItem> query)
        {
            return query.Apply(_testData.AsQueryable());
        }

        /// <summary>
        /// Applies filtering criteria to the specified query based on the provided WQL statement.
        /// </summary>
        /// <param name="wqlStatement">
        /// The WQL statement that defines the filtering conditions to apply to the query. Cannot 
        /// be null.
        /// </param>
        /// <param name="query">
        /// The query object to which the filtering criteria will be applied. Cannot be null.
        /// </param>
        /// <param name="request">
        /// The request that provides the operational context for resolving
        /// the appropriate REST API URI.
        /// </param>
        /// <returns>
        /// A new query representing the result of applying the WQL filter to the input 
        /// query. The returned query may be further composed or executed to retrieve 
        /// filtered results.
        /// </returns>
        public override IQuery<TIndexItem> Filter(IWqlStatement wqlStatement, IQuery<TIndexItem> query, IRequest request)
        {
            return query;
        }

        /// <summary>
        /// Applies the specified filter criteria to the given query object.
        /// </summary>
        /// <param name="filter">
        /// A string representing the filter expression to apply. The format and supported 
        /// operators depend on the implementation.
        /// </param>
        /// <param name="query">
        /// The query object to which the filter will be applied.
        /// </param>
        /// <param name="request">
        /// The request that provides the operational context for resolving
        /// the appropriate REST API URI.
        /// </param>
        /// <returns>
        /// A new query representing the result of applying the WQL filter to the input 
        /// query. The returned query may be further composed or executed to retrieve 
        /// filtered results.
        /// </returns>
        public override IQuery<TIndexItem> Filter(string filter, IQuery<TIndexItem> query, IRequest request)
        {
            return query;
        }
    }
}
