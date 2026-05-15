using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;
using WebExpress.WebCore.WebStatusPage;
using WebExpress.WebIndex;
using WebExpress.WebIndex.Queries;
using WebExpress.WebIndex.Wql;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Abstract base class for an observer (watcher) REST endpoint.
    /// </summary>
    /// <typeparam name="TIndexItem">Type of the index item.</typeparam>
    public abstract class RestApiObserver<TIndexItem> : IRestApi
        where TIndexItem : IIndexItem
    {
        private static readonly JsonSerializerOptions _jsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = true
        };

        /// <summary>
        /// Handles the <c>GET</c> entry point. Returns the full list of
        /// observers attached to the entity addressed by the request.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The HTTP response.</returns>
        [Method(RequestMethod.GET)]
        public virtual IResponse Retrieve(IRequest request)
        {
            var pageNumber = Convert.ToInt32(request.GetParameter("p")?.Value ?? "0");
            var pageSize = Convert.ToInt32(request.GetParameter("l")?.Value ?? "50");
            var search = request.GetParameter("q")?.Value ?? string.Empty;
            var wql = request.GetParameter("wql")?.Value ?? null;
            var filters = request.GetParameter("f")?.Value?.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries) ?? [];
            var query = new Query<TIndexItem>() as IQuery<TIndexItem>;

            try
            {
                if (!string.IsNullOrWhiteSpace(wql))
                {
                    var parser = new WqlParser<TIndexItem>();
                    var wqlStatement = parser.Parse(wql);

                    query = Filter(wqlStatement, query, request);
                }
                else
                {
                    query = Filter(search, query, request);
                }

                // quickfilters
                query = Filter(filters, query, request);

                // paging 
                query = query.WithPaging(pageNumber * pageSize, pageSize);

                using var context = CreateContext();
                var observers = RetrieveObservers(query, context, request) ?? [];

                return Json(observers);
            }
            catch (Exception ex)
            {
                return new ResponseBadRequest(new StatusMessage($"error processing get request: {ex.Message}"));
            }
        }

        /// <summary>
        /// Handles <c>POST {base}</c>: adds an observer.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The HTTP response.</returns>
        [Method(RequestMethod.POST)]
        public virtual IResponse Create(IRequest request)
        {
            try
            {
                using var context = CreateContext();
                var segments = GetRelativeSegments(request);
                if (segments.Count != 0)
                {
                    return new ResponseNotFound();
                }

                var payload = GetPayload<RestApiObserverPayload>(request);
                if (payload is null || string.IsNullOrWhiteSpace(payload.UserId))
                {
                    return new ResponseBadRequest(new StatusMessage("missing or invalid payload."));
                }

                var added = AddObserver(payload.UserId, context, request);
                return added is null
                    ? new ResponseNotFound()
                    : Json(added);
            }
            catch (Exception ex)
            {
                return new ResponseBadRequest(new StatusMessage($"error processing post request: {ex.Message}"));
            }
        }

        /// <summary>
        /// Handles <c>DELETE {base}/{userId}</c>: removes an observer.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The HTTP response.</returns>
        [Method(RequestMethod.DELETE)]
        public virtual IResponse Delete(IRequest request)
        {
            try
            {
                using var context = CreateContext();
                var segments = GetRelativeSegments(request);
                if (segments.Count != 1)
                {
                    return new ResponseNotFound();
                }

                var removed = RemoveObserver(segments[0], context, request);
                return removed
                    ? new ResponseNoContent()
                    : new ResponseNotFound();
            }
            catch (Exception ex)
            {
                return new ResponseBadRequest(new StatusMessage($"error processing delete request: {ex.Message}"));
            }
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
        /// Returns the current set of observers to be rendered by the
        /// client-side controller.
        /// </summary>
        /// <param name="query">
        /// An object containing the query parameters used to filter and select 
        /// index items. Cannot be null.
        /// </param>
        /// <param name="context">
        /// The context in which the query is executed. Provides additional 
        /// information or constraints for the retrieval operation. Cannot 
        /// be null.
        /// </param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The observers.</returns>
        protected abstract IEnumerable<RestApiObserverItem> RetrieveObservers(IQuery<TIndexItem> query, IQueryContext context, IRequest request);

        /// <summary>
        /// Persists a newly added observer.
        /// </summary>
        /// <param name="userId">The id of the user to be added.</param>
        /// <param name="context">
        /// The context in which the query is executed. Provides additional 
        /// information or constraints for the retrieval operation. Cannot 
        /// be null.
        /// </param>
        /// <param name="request">The incoming request.</param>
        /// <returns>
        /// The added observer record, or <see langword="null"/> when the 
        /// user cannot be resolved.
        /// </returns>
        protected abstract RestApiObserverItem AddObserver(string userId, IQueryContext context, IRequest request);

        /// <summary>
        /// Removes an observer.
        /// </summary>
        /// <param name="userId">The id of the user to be removed.</param>
        /// <param name="context">
        /// The context in which the query is executed. Provides additional 
        /// information or constraints for the retrieval operation. Cannot 
        /// be null.
        /// </param>
        /// <param name="request">The incoming request.</param>
        /// <returns>
        /// <see langword="true"/> when the observer existed and was removed.
        /// </returns>
        protected abstract bool RemoveObserver(string userId, IQueryContext context, IRequest request);

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
        protected virtual IQuery<TIndexItem> Filter(IWqlStatement<TIndexItem> wqlStatement, IQuery<TIndexItem> query, IRequest request)
        {
            if (wqlStatement is null || wqlStatement.HasErrors)
            {
                return query;
            }

            return wqlStatement.ToQuery();
        }

        /// <summary>
        /// Applies the specified filter criteria to the given query object.
        /// </summary>
        /// <param name="search">
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
        protected virtual IQuery<TIndexItem> Filter(string search, IQuery<TIndexItem> query, IRequest request)
        {
            return query;
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
        /// Returns the path segments of the request below the endpoint's
        /// base path.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The remaining segments.</returns>
        private static IReadOnlyList<string> GetRelativeSegments(IRequest request)
        {
            var path = request?.Uri?.PathSegments?
                .Select(x => x?.Value)
                .Where(x => !string.IsNullOrWhiteSpace(x) && x != "/")
                .ToList() ?? [];

            var basePath = request?.Uri?.BasePath?.PathSegments?
                .Select(x => x?.Value)
                .Where(x => !string.IsNullOrWhiteSpace(x) && x != "/")
                .ToList() ?? [];

            if (basePath.Count > 0 && path.Count >= basePath.Count)
            {
                var matches = true;
                for (var i = 0; i < basePath.Count; i++)
                {
                    if (!string.Equals(path[i], basePath[i], StringComparison.OrdinalIgnoreCase))
                    {
                        matches = false;
                        break;
                    }
                }

                if (matches)
                {
                    return path.Skip(basePath.Count).ToList();
                }
            }

            return path;
        }

        /// <summary>
        /// Tries to deserialize the request body into the requested payload
        /// type.
        /// </summary>
        /// <typeparam name="T">The payload type.</typeparam>
        /// <param name="request">The incoming request.</param>
        /// <returns>The payload, or <see langword="null"/> when missing or invalid.</returns>
        private static T GetPayload<T>(IRequest request)
            where T : class
        {
            if (request is not Request data || data.Content is null || data.Content.Length == 0)
            {
                return null;
            }

            try
            {
                return JsonSerializer.Deserialize<T>(data.Content, _jsonOptions);
            }
            catch (JsonException)
            {
                return null;
            }
        }

        /// <summary>
        /// Builds an <c>application/json</c> 200 response containing the
        /// serialized payload.
        /// </summary>
        /// <param name="payload">The payload to serialize.</param>
        /// <returns>The HTTP response.</returns>
        private static IResponse Json(object payload)
        {
            var json = JsonSerializer.Serialize(payload, _jsonOptions);

            return new ResponseOK
            {
                Content = Encoding.UTF8.GetBytes(json)
            }
                .AddHeaderContentType("application/json");
        }
    }
}
