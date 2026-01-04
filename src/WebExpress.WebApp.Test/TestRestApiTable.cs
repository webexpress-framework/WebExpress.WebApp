using WebExpress.WebApp.Test.Model;
using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebIndex;
using WebExpress.WebIndex.Wql;

namespace WebExpress.WebApp.Test
{
    /// <summary>
    /// Represents a read-only table of test index items for use with REST API scenarios.
    /// </summary>
    public sealed class TestRestApiTable : TestRestApiTable<TestIndexItem>
    {
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
        /// <param name="request">
        /// The request context for which to generate API options. Cannot be null.
        /// </param>
        /// <param name="row">
        /// The data row representing the item for which options are generated. Cannot be null.
        /// </param>
        /// <returns>
        /// An enumerable collection of <see cref="RestApiOption"/> objects representing the 
        /// available actions for the given request and row. The collection will contain at 
        /// least one option if actions are available; otherwise, it may be empty.
        /// </returns>
        public override IEnumerable<RestApiOption> GetOptions(IRequest request, TIndexItem row)
        {
            return
            [
                new RestApiOptionEdit(request) { }
            ];
        }

        /// <summary>
        /// Retrieves a collection of index items that match the specified filter 
        /// and request parameters.
        /// </summary>
        /// <param name="filter">
        /// A string used to filter the results. The format and supported values 
        /// depend on the implementation. Can be null or empty to indicate no filtering.
        /// </param>
        /// <param name="request">
        /// An object containing additional parameters that influence the data 
        /// retrieval operation. Cannot be null.
        /// </param>
        /// <returns>
        /// An enumerable collection of index items of type TIndexItem that 
        /// satisfy the filter and request criteria. The collection may be 
        /// empty if no items match.
        /// </returns>
        public override IEnumerable<TIndexItem> GetData(string filter, IRequest request)
        {
            return _testData;
        }

        /// <summary>
        /// Retrieves a collection of index items that match the specified WQL 
        /// statement and request parameters.
        /// </summary>
        /// <param name="wqlStatement">
        /// The WQL statement that defines the query criteria for selecting index 
        /// items. Cannot be null.
        /// </param>
        /// <param name="request">
        /// The request object containing additional parameters or options that 
        /// influence the data retrieval. Cannot be null.
        /// </param>
        /// <returns>
        /// An enumerable collection of index items that satisfy the query 
        /// criteria. The collection is empty if no items match.
        /// </returns>
        public override IEnumerable<TIndexItem> GetData(IWqlStatement wqlStatement, IRequest request)
        {
            return _testData;
        }
    }
}
