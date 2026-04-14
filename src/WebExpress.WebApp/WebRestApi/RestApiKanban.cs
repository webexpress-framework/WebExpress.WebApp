using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;
using WebExpress.WebCore.WebStatusPage;
using WebExpress.WebIndex;
using WebExpress.WebIndex.Queries;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// A REST API endpoint providing the kanban configuration and handling layout updates.
    /// </summary>
    /// <typeparam name="TIndexItem">Type of the index item.</typeparam>
    public class RestApiKanban<TIndexItem> : IRestApi
        where TIndexItem : IIndexItem
    {
        private static readonly JsonSerializerOptions _jsonOptions = new()
        {
            WriteIndented = true
        };

        /// <summary>
        /// Gets or sets the title associated with the current object.
        /// </summary>
        public string Title { get; protected set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        public RestApiKanban()
        {
            // search for an attribute of type Title and return its value if present
            Title = GetType().CustomAttributes
                .Where(x => x?.AttributeType == typeof(TitleAttribute))
                .Select(x => x.ConstructorArguments.FirstOrDefault().Value?.ToString())
                .FirstOrDefault();
        }

        /// <summary>
        /// Handles get requests to retrieve the current dashboard layout and configuration.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>A response containing the dashboard configuration.</returns>
        [Method(RequestMethod.GET)]
        public IResponse Retrieve(IRequest request)
        {
            using var context = CreateContext();
            var query = new Query<TIndexItem>() as IQuery<TIndexItem>;
            var filters = request.GetParameter("f")?.Value?.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries) ?? [];

            // quickfilters
            query = Filter(filters, query, request);

            var columns = RetrieveColumns(request);
            var swimlanes = RetrieveSwimlanes(request);
            var cards = RetrieveCards(query, context, request);

            try
            {
                var result = new RestApiKanbanResult()
                {
                    Title = I18N.Translate(request, Title),
                    Columns = columns,
                    Swimlanes = swimlanes,
                    Cards = cards
                };

                return result.ToResponse();
            }
            catch (Exception ex)
            {
                return new ResponseBadRequest(new StatusMessage($"error processing get request: {ex.Message}"));
            }
        }

        /// <summary>
        /// Handles put requests to update the dashboard layout.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>A response indicating the success of the update operation.</returns>
        [Method(RequestMethod.PUT)]
        public IResponse Update(IRequest request)
        {
            try
            {
                if (request is Request requestData)
                {
                    if (requestData.Content is null || requestData.Content.Length == 0)
                    {
                        return new ResponseBadRequest(new StatusMessage("missing request body."));
                    }

                    var bodyString = Encoding.UTF8.GetString(requestData.Content);
                    var payload = JsonSerializer.Deserialize<RestApiDashboardLayout>(bodyString, _jsonOptions);

                    UpdtaeColumns(payload, request);
                }

                var responseObj = new { success = true };
                var responseJson = JsonSerializer.Serialize(responseObj, _jsonOptions);

                return new ResponseOK
                {
                    Content = Encoding.UTF8.GetBytes(responseJson)
                }.AddHeaderContentType("application/json");
            }
            catch (Exception ex)
            {
                return new ResponseBadRequest(new StatusMessage($"error processing put request: {ex.Message}"));
            }
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
        protected virtual IEnumerable<RestApiKanbanColumn> RetrieveColumns(IRequest request)
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
        protected virtual void UpdtaeColumns(RestApiDashboardLayout layout, IRequest request)
        {
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
        protected virtual IEnumerable<RestApiKanbanSwimlane> RetrieveSwimlanes(IRequest request)
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
        protected virtual IEnumerable<RestApiKanbanCard> RetrieveCards(IQuery<TIndexItem> query, IQueryContext context, IRequest request)
        {
            // return empty by default
            return [];
        }

        /// <summary>
        /// Creates a new instance of an object that implements the IQueryContext interface.
        /// </summary>
        /// <returns>
        /// An IQueryContext instance that can be used to execute queries.
        /// </returns>
        protected virtual IQueryContext CreateContext()
        {
            return new DefaultQueryContext();
        }

        /// <summary>
        /// Applies the specified filter criteria to the given query object.
        /// </summary>
        /// <param name="filters">
        /// A collection of quickfilter identifiers that should be applied in addition to the WQL criteria.
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
        protected virtual IQuery<TIndexItem> Filter(IEnumerable<string> filters, IQuery<TIndexItem> query, IRequest request)
        {
            return query;
        }
    }
}
