using WebExpress.WebApp.Test.Model;
using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebIndex.Wql;

namespace WebExpress.WebApp.Test
{
    /// <summary>
    /// Provides a test implementation of a REST API table for retrieving 
    /// index items using filter strings or WQL statements.
    /// </summary>
    public sealed class TestRestApiTable : RestApiTable<TestData>
    {
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
        public override IEnumerable<TestData> GetData(string filter, IRequest request)
        {
            throw new NotImplementedException();
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
        public override IEnumerable<TestData> GetData(IWqlStatement wqlStatement, IRequest request)
        {
            throw new NotImplementedException();
        }
    }
}
