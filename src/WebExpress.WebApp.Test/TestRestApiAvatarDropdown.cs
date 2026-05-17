using WebExpress.WebApp.Test.Model;
using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebIndex.Queries;
using WebExpress.WebIndex.Wql;

namespace WebExpress.WebApp.Test
{
    /// <summary>
    /// Represents a read-only avatar dropdown of test index items for use with REST API scenarios.
    /// </summary>
    public sealed class TestRestApiAvatarDropdown : RestApiAvatarDropdown<TestIndexItem>
    {
        private readonly IEnumerable<TestIndexItem> _testData;

        /// <summary>
        /// Initializes a new instance of the TestRestApiAvatarDropdown class with the specified data.
        /// </summary>
        /// <param name="data">
        /// The collection of TestIndexItem objects to be displayed in the avatar dropdown. Cannot be null.
        /// </param>
        public TestRestApiAvatarDropdown(IEnumerable<TestIndexItem> data)
        {
            _testData = data;
        }

        /// <summary>
        /// Retrieves a collection of avatar dropdown items that match the specified query criteria.
        /// </summary>
        /// <param name="query">
        /// An object containing the query parameters used to filter and select index items.
        /// </param>
        /// <param name="context">
        /// The context in which the query is executed.
        /// </param>
        /// <param name="request">
        /// The request that provides the operational context.
        /// </param>
        /// <returns>
        /// An enumerable collection of RestApiAvatarDropdownItem objects.
        /// </returns>
        protected override IEnumerable<RestApiAvatarDropdownItem> RetrieveItems(IQuery<TestIndexItem> query, IQueryContext context, IRequest request)
        {
            return query.Apply(_testData.AsQueryable())
                .Select(x => new RestApiAvatarDropdownItem()
                {
                    Id = x.Id,
                    Text = x.Description,
                    Section = "primary"
                });
        }

        /// <summary>
        /// Applies filtering criteria to the specified query based on the provided WQL statement.
        /// </summary>
        /// <param name="wqlStatement">
        /// The WQL statement that defines the filtering conditions to apply to the query.
        /// </param>
        /// <param name="query">
        /// The query object to which the filtering criteria will be applied.
        /// </param>
        /// <param name="request">
        /// The request that provides the operational context.
        /// </param>
        /// <returns>
        /// A query representing the filtered set of items.
        /// </returns>
        protected override IQuery<TestIndexItem> Filter(IWqlStatement<TestIndexItem> wqlStatement, IQuery<TestIndexItem> query, IRequest request)
        {
            return query;
        }

        /// <summary>
        /// Applies the specified filter criteria to the given query object.
        /// </summary>
        /// <param name="filter">
        /// A string representing the filter expression to apply.
        /// </param>
        /// <param name="query">
        /// The query object to which the filter will be applied.
        /// </param>
        /// <param name="request">
        /// The request that provides the operational context.
        /// </param>
        /// <returns>
        /// A query representing the filtered set of items.
        /// </returns>
        protected override IQuery<TestIndexItem> Filter(string filter, IQuery<TestIndexItem> query, IRequest request)
        {
            return query;
        }
    }
}
