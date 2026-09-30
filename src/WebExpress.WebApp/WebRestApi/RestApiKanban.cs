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

            // the board settings dialog persists a wql filter that arrives as a
            // request parameter on the next load; a server that stores it can
            // seed the value through RetrieveFilter for full page reloads
            var wql = RetrieveFilter(request.GetParameter("wql")?.Value, request);
            query = ApplyWql(wql, query, request);

            var columns = RetrieveColumns(request);
            var swimlanes = RetrieveSwimlanes(request);
            var cards = RetrieveCards(query, context, request);

            try
            {
                var result = new RestApiKanbanResult()
                {
                    Title = I18N.Translate(request, Title),
                    Filter = wql,
                    Statuses = RetrieveStatuses(request),
                    Columns = columns,
                    Swimlanes = swimlanes,
                    Cards = cards
                };

                return result.ToResponse();
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "error processing get request.");
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

                    // structural changes and card transitions have separate persistence hooks
                    switch (payload?.Action)
                    {
                        case "columns":
                            ValidateColumnStatuses(payload, request);
                            UpdtaeColumns(payload, request);
                            break;
                        case "swimlanes":
                            UpdateSwimlanes(payload, request);
                            break;
                        case "settings":
                            UpdateSettings(payload, request);
                            break;
                        case null:
                        case "move":
                            var move = JsonSerializer.Deserialize<RestApiKanbanMove>(bodyString, _jsonOptions);
                            ValidateMove(move, request);
                            MoveCard(move, request);
                            break;
                    }
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
                return RestApiFault.BadRequest(request, ex, "error processing put request.");
            }
        }

        /// <summary>
        /// Supplies the workflow statuses offered by the board to the current request.
        /// </summary>
        /// <param name="request">The request used to scope the status catalog.</param>
        /// <returns>The available statuses, or null for a board without workflow statuses.</returns>
        protected virtual IEnumerable<RestApiKanbanStatus> RetrieveStatuses(IRequest request)
        {
            return null;
        }

        /// <summary>
        /// Persists a validated card transition in the application's workflow store.
        /// Implementations must enforce application authorization and atomically recheck mutable workflow rules.
        /// </summary>
        /// <remarks>
        /// A move the application declines is refused with a <see cref="RestApiRefusal"/>; its
        /// message reaches the user when the board takes the card back. Any other exception is
        /// answered with a generic message.
        /// </remarks>
        /// <param name="move">The confirmed card destination and status.</param>
        /// <param name="request">The request used to authorize and persist the transition.</param>
        protected virtual void MoveCard(RestApiKanbanMove move, IRequest request)
        {
        }

        /// <summary>
        /// Rejects column assignments that reference statuses outside the current catalog.
        /// </summary>
        /// <remarks>
        /// A layout without columns cannot come from the board and stays a programming error. An
        /// unknown status, however, is what a board loaded before the catalog changed submits, so
        /// the user learns why the board fell back instead of seeing a generic failure.
        /// </remarks>
        /// <param name="layout">The submitted column assignments.</param>
        /// <param name="request">The request used to resolve available statuses.</param>
        private void ValidateColumnStatuses(RestApiDashboardLayout layout, IRequest request)
        {
            var statuses = RetrieveStatuses(request)?.Select(status => status.Id).ToHashSet();
            if (statuses == null)
            {
                return;
            }

            if (layout.Columns == null || layout.Columns.Any(column => column == null))
            {
                throw new ArgumentException("The layout requires its columns.");
            }

            if (layout.Columns.Any(column => (column.StatusIds ?? []).Any(id => !statuses.Contains(id))))
            {
                throw new RestApiRefusal(I18N.Translate(request, "webexpress.webapp:kanban.refused.column"));
            }
        }

        /// <summary>
        /// Checks destinations against current server data before invoking application persistence.
        /// </summary>
        /// <remarks>
        /// A move the board validated on load can still fail here when the workflow, the card or
        /// the user's permissions changed in the meantime. Those cases are refused with a
        /// translated reason the board shows when it takes the card back; only a request that
        /// lacks its identifiers, which the board never sends, is treated as a programming error.
        /// </remarks>
        /// <param name="move">The untrusted card move received from the client.</param>
        /// <param name="request">The request used to resolve cards, columns, and allowed statuses.</param>
        private void ValidateMove(RestApiKanbanMove move, IRequest request)
        {
            if (string.IsNullOrWhiteSpace(move?.CardId) || string.IsNullOrWhiteSpace(move.ColumnId))
            {
                throw new ArgumentException("A card and destination column are required.");
            }

            var statuses = RetrieveStatuses(request)?.Select(status => status.Id).ToHashSet();
            if (statuses == null)
            {
                return;
            }

            using var context = CreateContext();
            var card = RetrieveCards(new Query<TIndexItem>(), context, request).FirstOrDefault(item => item.Id == move.CardId);
            var column = RetrieveColumns(request).FirstOrDefault(item => item.Id == move.ColumnId);
            if (card == null || column == null || (move.SwimlaneId != null
                && !RetrieveSwimlanes(request).Any(lane => lane.Id == move.SwimlaneId)))
            {
                throw new RestApiRefusal(I18N.Translate(request, "webexpress.webapp:kanban.refused.card"));
            }

            // reordering within the same column does not require a workflow transition
            if (card.ColumnId == move.ColumnId && card.StatusId == move.StatusId)
            {
                return;
            }

            if (move.StatusId == null || !statuses.Contains(move.StatusId)
                || !(column.StatusIds?.Contains(move.StatusId) ?? false)
                || (card.AllowedStatusIds != null && !card.AllowedStatusIds.Contains(move.StatusId)))
            {
                throw new RestApiRefusal(I18N.Translate(request, "webexpress.webapp:kanban.refused.status"));
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
        /// <remarks>
        /// A change the application declines is refused with a <see cref="RestApiRefusal"/>,
        /// whose message reaches the user.
        /// </remarks>
        protected virtual void UpdtaeColumns(RestApiDashboardLayout layout, IRequest request)
        {
        }

        /// <summary>
        /// Updates the swimlanes of the board (add / rename / reorder / delete)
        /// based on the ordered swimlane list carried in the payload.
        /// </summary>
        /// <param name="layout">
        /// The layout payload whose <see cref="RestApiDashboardLayout.Swimlanes"/>
        /// carries the new swimlane list.
        /// </param>
        /// <param name="request">
        /// The request containing the details for updating the swimlanes.
        /// </param>
        protected virtual void UpdateSwimlanes(RestApiDashboardLayout layout, IRequest request)
        {
        }

        /// <summary>
        /// Updates the board settings (currently the WQL filter) based on the
        /// payload. The filter narrows the card query on the next load.
        /// </summary>
        /// <param name="layout">
        /// The layout payload whose <see cref="RestApiDashboardLayout.Filter"/>
        /// carries the submitted WQL filter.
        /// </param>
        /// <param name="request">
        /// The request containing the details for updating the settings.
        /// </param>
        protected virtual void UpdateSettings(RestApiDashboardLayout layout, IRequest request)
        {
        }

        /// <summary>
        /// Resolves the active WQL filter of the board. By default it echoes the
        /// filter carried on the request; a server that persists the filter
        /// through <see cref="UpdateSettings"/> overrides this to seed the stored
        /// value when the request carries none (e.g. after a full page reload).
        /// </summary>
        /// <param name="wql">The WQL filter carried on the request, or null.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The active WQL filter, or null when the board has none.</returns>
        protected virtual string RetrieveFilter(string wql, IRequest request)
        {
            return wql;
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

        /// <summary>
        /// Applies the WQL filter of the board settings to the card query.
        /// </summary>
        /// <param name="wql">
        /// The WQL filter persisted through the board settings dialog, or null
        /// when the board carries no filter.
        /// </param>
        /// <param name="query">
        /// The query object the filter narrows.
        /// </param>
        /// <param name="request">
        /// The request that provides the operational context.
        /// </param>
        /// <returns>
        /// A query representing the filtered set of items; the unchanged query
        /// when no filter is set.
        /// </returns>
        protected virtual IQuery<TIndexItem> ApplyWql(string wql, IQuery<TIndexItem> query, IRequest request)
        {
            return query;
        }
    }
}
