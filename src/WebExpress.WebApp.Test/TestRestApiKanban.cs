using WebExpress.WebApp.Test.Model;
using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebIndex.Queries;

namespace WebExpress.WebApp.Test
{
    /// <summary>
    /// Provides a test implementation of a REST API kanban.
    /// </summary>
    public class TestRestApiKanban : RestApiKanban<TestIndexItem>
    {
        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="title">
        /// The title to display for the tile. If not specified, defaults to "kanban_title".
        /// </param>
        public TestRestApiKanban(string title = "kanban_title")
        {
            Title = title;
        }

        /// <summary>
        /// Retrieves the collection of dashboard columns.
        /// </summary>
        /// <param name="request">
        /// The request context used to determine which dashboard columns to retrieve.
        /// </param>
        /// <returns>
        /// An enumerable collection of Kanban columns relevant to the request. The 
        /// collection is empty if no columns are available.
        /// </returns>
        protected override IEnumerable<RestApiKanbanColumn> RetrieveColumns(IRequest request)
        {
            // return empty by default
            return [];
        }

        /// <summary>
        /// Retrieves the collection of swimlanes associated with the specified request.
        /// </summary>
        /// <param name="request">
        /// The request context used to determine which swimlanes to retrieve.
        /// </param>
        /// <returns>
        /// An enumerable collection of swimlanes relevant to the request. The 
        /// collection is empty if no swimlanes are available.
        /// </returns>
        protected override IEnumerable<RestApiKanbanSwimlane> RetrieveSwimlanes(IRequest request)
        {
            // return empty by default
            return [];
        }

        /// <summary>
        /// Retrieves a collection of Kanban cards based on the specified request parameters.
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
        /// The request context used to determine which cards to retrieve.
        /// </param>
        /// <returns>
        /// An enumerable collection of cards relevant to the request. The 
        /// collection is empty if no cards are available.
        /// </returns>
        protected override IEnumerable<RestApiKanbanCard> RetrieveCards(IQuery<TestIndexItem> query, IQueryContext context, IRequest request)
        {
            // return empty by default
            return [];
        }
    }
}
