using WebExpress.WebApp.Test.Model;
using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebIndex.Queries;
using WebExpress.WebIndex.Wql;

namespace WebExpress.WebApp.Test
{
    /// <summary>
    /// Represents a read-only dropdown of test index items for use with REST API scenarios.
    /// </summary>
    public sealed class TestRestApiDropdown : RestApiDropdown<TestIndexItem>
    {
        private readonly IEnumerable<TestIndexItem> _testData;

        /// <summary>
        /// Initializes a new instance of the TestRestApiTile class with the specified data 
        /// and tile title.
        /// </summary>
        /// <param name="data">
        /// The collection of TestIndexItem objects to be displayed in the tile. Cannot be null.
        /// </param>
        public TestRestApiDropdown(IEnumerable<TestIndexItem> data)
        {
            _testData = data;
        }

        /// <summary>
        /// Retrieves a queryable collection of index items that match the specified query criteria.
        /// </summary>
        /// <param name="query">
        /// An object containing the query parameters used to filter and select index items. Cannot 
        /// be null.
        /// </param>
        /// <param name="context">
        /// The context in which the query is executed. Provides additional information or constraints 
        /// for the retrieval operation. Cannot be null.
        /// </param>
        /// <param name="request">
        /// The request that provides the operational context.
        /// </param>
        /// <returns>
        /// An enumerable collection of RestApiDropdownItem objects that match 
        /// the specified query and context. The collection may be empty if no
        /// items are found.
        /// </returns>
        protected override IEnumerable<RestApiDropdownItem> RetrieveItems(IQuery<TestIndexItem> query, IQueryContext context, IRequest request)
        {
            return query.Apply(_testData.AsQueryable())
                .Select(x => new RestApiDropdownItem()
                {
                    Id = x.Id,
                    Text = x.Description
                });
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
        /// A query representing the filtered set of items that match the criteria defined by 
        /// the WQL statement.
        /// </returns>
        protected override IQuery<TestIndexItem> Filter(IWqlStatement<TestIndexItem> wqlStatement, IQuery<TestIndexItem> query, IRequest request)
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
        /// A query representing the filtered set of items that match the criteria defined by 
        /// the filter statement.
        /// </returns>
        protected override IQuery<TestIndexItem> Filter(string filter, IQuery<TestIndexItem> query, IRequest request)
        {
            return query;
        }

        /// <summary>
        /// Returns a collection of available REST API options for the specified 
        /// request and data row.
        /// </summary>
        /// <param name="id">
        /// The id representing the item for which options are generated. Cannot be null.
        /// </param>
        /// <param name="request">
        /// The request context for which to generate API options. Cannot be null.
        /// </param>
        /// <returns>
        /// An enumerable collection of <see cref="RestApiOption"/> objects representing the 
        /// available actions for the given request and row. The collection will contain at 
        /// least one option if actions are available; otherwise, it may be empty.
        /// </returns>
        private IEnumerable<RestApiOption> GetOptions(string id, IRequest request)
        {
            return
            [
                new RestApiOptionEdit(request) { }
            ];
        }
    }
}
