using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.WebMessage;

namespace WebExpress.WebApp.Test
{
    /// <summary>
    /// Provides a test implementation of a REST API dashboard.
    /// </summary>
    public class TestRestApiDashboard : RestApiDashboard
    {
        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        public TestRestApiDashboard()
        {
        }

        /// <summary>
        /// Retrieves the collection of dashboard columns.
        /// </summary>
        /// <param name="request">
        /// The request context used to determine which dashboard columns to retrieve.
        /// </param>
        /// <returns>
        /// An enumerable collection of dashboard columns relevant to the request. The 
        /// collection is empty if no columns are available.
        /// </returns>
        public override IEnumerable<RestApiDashboardColumn> GetColumns(IRequest request)
        {
            // return empty by default
            return [];
        }

        /// <summary>
        /// Updates the columns of the specified dashboard layout based on the provided 
        /// request.
        /// </summary>
        /// <param name="layout">
        /// The dashboard layout whose columns will be updated.
        /// </param>
        /// <param name="request">
        /// The request containing the details for updating the columns.
        /// </param>
        public override void UpdtaeColumns(RestApiDashboardLayout layout, IRequest request)
        {
        }
    }
}
