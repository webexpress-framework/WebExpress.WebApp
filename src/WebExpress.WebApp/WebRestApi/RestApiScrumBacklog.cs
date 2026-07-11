using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using WebExpress.WebApp.WebMessageQueue;
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
    /// Provides a server-side Scrum REST API for backlog data.
    /// </summary>
    /// <typeparam name="TIndexScrum">Type of the scrum sprint index item.</typeparam>
    /// <typeparam name="TIndexItem">Type of the index item.</typeparam>
    public abstract class RestApiScrumBacklog<TIndexScrum, TIndexItem> : IRestApi
        where TIndexScrum : IIndexItem
        where TIndexItem : IIndexItem
    {
        private static readonly object _syncRoot = new();
        private static readonly JsonSerializerOptions _jsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        /// <summary>
        /// Gets a value indicating whether backlog endpoints are enabled.
        /// </summary>
        protected virtual bool IsBacklogEnabled => true;

        /// <summary>
        /// Retrieves backlog data.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The response.</returns>
        [Method(RequestMethod.GET)]
        public virtual IResponse Retrieve(IRequest request)
        {
            try
            {
                var segments = GetRelativeSegments(request);
                var routeSegments = NormalizeBacklogSegments(segments);
                var search = request.GetParameter("q")?.Value ?? string.Empty;
                var wql = request.GetParameter("wql")?.Value;
                var filters = request.GetParameter("f")?.Value?.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries) ?? [];
                var query = new Query<TIndexItem>() as IQuery<TIndexItem>;

                query = Filter(filters, query, request);

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

                using var context = CreateContext();
                var sprints = RetrieveSprints(new Query<TIndexScrum>(), context, request)
                    .ToList();
                var items = RetrieveItems(query, context, request)
                    .ToList();

                if (routeSegments.Count == 0 || Matches(routeSegments, "backlog"))
                {
                    if (!IsBacklogEnabled)
                    {
                        return new ResponseNotFound();
                    }

                    var result = new RestApScrumResult<TIndexScrum, TIndexItem>()
                    {
                        Sprints = sprints.Select(ToRestSprint),
                        Items = items.Select(ToRestItem)
                    };

                    return result.ToResponse();
                }

                return new ResponseNotFound();
            }
            catch (Exception ex)
            {
                return new ResponseBadRequest(new StatusMessage($"Error processing request.{ex}"));
            }
        }

        /// <summary>
        /// Creates a new sprint in the backlog.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The response.</returns>
        [Method(RequestMethod.POST)]
        public virtual IResponse Create(IRequest request)
        {
            if (!IsBacklogEnabled)
            {
                return new ResponseNotFound();
            }

            var segments = GetRelativeSegments(request);
            var routeSegments = NormalizeBacklogSegments(segments);
            if (!(routeSegments.Count == 0 || Matches(routeSegments, "backlog")))
            {
                return new ResponseNotFound();
            }

            var payload = GetPayload<RestApiSprintPayload>(request);
            if (payload is null)
            {
                return new ResponseBadRequest(new StatusMessage("Invalid sprint payload."));
            }

            var validation = ValidateSprint(default, payload, request);
            if (!validation.IsValid)
            {
                return ToValidationResponse(validation);
            }

            try
            {
                lock (_syncRoot)
                {
                    var result = CreateSprint(payload, request, out var newSprint);
                    if (result is null)
                    {
                        return new ResponseBadRequest(new StatusMessage("Creation failed."));
                    }

                    NotifyDomain(newSprint, DataChangeOperation.Created);

                    return result.ToResponse();
                }
            }
            catch (Exception ex)
            {
                return new ResponseBadRequest(new StatusMessage($"Error creating resource: {ex.Message}"));
            }
        }

        /// <summary>
        /// Updates sprint metadata, sprint state or item position data.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The response.</returns>
        [Method(RequestMethod.PUT)]
        [Method(RequestMethod.PATCH)]
        public virtual IResponse Update(IRequest request)
        {
            if (!IsBacklogEnabled)
            {
                return new ResponseNotFound();
            }

            var segments = GetRelativeSegments(request);
            var routeSegments = NormalizeBacklogSegments(segments);

            try
            {
                if (routeSegments.Count == 2 && EqualsSegment(routeSegments[0], "sprints"))
                {
                    var sprintId = routeSegments[1];
                    if (!Guid.TryParse(sprintId, out var sprintGuid))
                    {
                        return new ResponseNotFound(new StatusMessage("Sprint not found."));
                    }

                    using var context = CreateContext();
                    var sprint = RetrieveSprints(new Query<TIndexScrum>(), context, request)
                        .FirstOrDefault(x => x.Id == sprintGuid);

                    if (sprint == null)
                    {
                        return new ResponseNotFound(new StatusMessage("Sprint not found."));
                    }

                    var payload = GetPayload<RestApiSprintPayload>(request);
                    if (payload is null)
                    {
                        return new ResponseBadRequest(new StatusMessage("Invalid sprint payload."));
                    }

                    var validation = ValidateSprint(sprint, payload, request);
                    if (!validation.IsValid)
                    {
                        return ToValidationResponse(validation);
                    }

                    lock (_syncRoot)
                    {
                        var result = UpdateSprint(sprint, payload, request);

                        NotifyDomain(sprint, DataChangeOperation.Updated);

                        return result?.ToResponse() ?? new ResponseBadRequest(new StatusMessage("Update failed."));
                    }
                }

                if (routeSegments.Count == 3 && EqualsSegment(routeSegments[0], "items") && EqualsSegment(routeSegments[2], "move"))
                {
                    var itemId = routeSegments[1];
                    if (!Guid.TryParse(itemId, out var itemGuid))
                    {
                        return new ResponseNotFound(new StatusMessage("Item not found."));
                    }

                    using var context = CreateContext();
                    var item = RetrieveItems(new Query<TIndexItem>(), context, request)
                        .FirstOrDefault(x => x.Id == itemGuid);

                    if (item == null)
                    {
                        return new ResponseNotFound(new StatusMessage("Item not found."));
                    }

                    var payload = GetPayload<RestApiScrumMovePayload>(request);
                    if (payload is null)
                    {
                        return new ResponseBadRequest(new StatusMessage("Invalid item move payload."));
                    }

                    var validation = ValidateMove(item, payload, request);
                    if (!validation.IsValid)
                    {
                        return ToValidationResponse(validation);
                    }

                    lock (_syncRoot)
                    {
                        var result = MoveItem(item, payload, request);

                        NotifyDomain(item, DataChangeOperation.Updated);

                        return result?.ToResponse() ?? new ResponseBadRequest(new StatusMessage("Update failed."));
                    }
                }

                if (routeSegments.Count == 3 && EqualsSegment(routeSegments[0], "items") && EqualsSegment(routeSegments[2], "rank"))
                {
                    var itemId = routeSegments[1];
                    if (!Guid.TryParse(itemId, out var itemGuid))
                    {
                        return new ResponseNotFound(new StatusMessage("Item not found."));
                    }

                    using var context = CreateContext();
                    var item = RetrieveItems(new Query<TIndexItem>(), context, request)
                        .FirstOrDefault(x => x.Id == itemGuid);

                    if (item == null)
                    {
                        return new ResponseNotFound(new StatusMessage("Item not found."));
                    }

                    var payload = GetPayload<RestApiScrumRankPayload>(request);
                    if (payload is null)
                    {
                        return new ResponseBadRequest(new StatusMessage("Invalid item rank payload."));
                    }

                    var validation = ValidateRank(item, payload, request);
                    if (!validation.IsValid)
                    {
                        return ToValidationResponse(validation);
                    }

                    lock (_syncRoot)
                    {
                        var result = RankItem(item, payload, request);

                        NotifyDomain(item, DataChangeOperation.Updated);

                        return result?.ToResponse() ?? new ResponseBadRequest(new StatusMessage("Update failed."));
                    }
                }

                if (routeSegments.Count == 2 && EqualsSegment(routeSegments[0], "items"))
                {
                    var itemId = routeSegments[1];
                    if (!Guid.TryParse(itemId, out var itemGuid))
                    {
                        return new ResponseNotFound(new StatusMessage("Item not found."));
                    }

                    using var context = CreateContext();
                    var item = RetrieveItems(new Query<TIndexItem>(), context, request)
                        .FirstOrDefault(x => x.Id == itemGuid);

                    if (item == null)
                    {
                        return new ResponseNotFound(new StatusMessage("Item not found."));
                    }

                    var payload = GetPayload<RestApiScrumItemPayload>(request);
                    if (payload is null)
                    {
                        return new ResponseBadRequest(new StatusMessage("Invalid item payload."));
                    }

                    var validation = ValidateItem(item, payload, request);
                    if (!validation.IsValid)
                    {
                        return ToValidationResponse(validation);
                    }

                    lock (_syncRoot)
                    {
                        var result = UpdateItem(item, payload, request);

                        NotifyDomain(item, DataChangeOperation.Updated);

                        return result?.ToResponse() ?? new ResponseBadRequest(new StatusMessage("Update failed."));
                    }
                }

                return new ResponseNotFound();
            }
            catch (Exception ex)
            {
                return new ResponseBadRequest(new StatusMessage($"Error updating resource: {ex.Message}"));
            }
        }

        /// <summary>
        /// Deletes a sprint and moves its items back to the backlog.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The response.</returns>
        [Method(RequestMethod.DELETE)]
        public virtual IResponse Delete(IRequest request)
        {
            if (!IsBacklogEnabled)
            {
                return new ResponseNotFound();
            }

            var segments = GetRelativeSegments(request);
            var routeSegments = NormalizeBacklogSegments(segments);
            if (routeSegments.Count != 2 || !EqualsSegment(routeSegments[0], "sprints"))
            {
                return new ResponseNotFound();
            }

            var sprintId = routeSegments[1];
            if (!Guid.TryParse(sprintId, out var sprintGuid))
            {
                return new ResponseNotFound(new StatusMessage("Sprint not found."));
            }

            using var context = CreateContext();
            var sprint = RetrieveSprints(new Query<TIndexScrum>(), context, request)
                .FirstOrDefault(x => x.Id == sprintGuid);

            if (sprint == null)
            {
                return new ResponseNotFound(new StatusMessage("Sprint not found."));
            }

            try
            {
                lock (_syncRoot)
                {
                    var result = DeleteSprint(sprint, request);

                    NotifyDomain(sprint, DataChangeOperation.Deleted);

                    return result?.ToResponse() ?? new ResponseBadRequest(new StatusMessage("Delete failed."));
                }
            }
            catch (Exception ex)
            {
                return new ResponseBadRequest(new StatusMessage($"Error deleting resource: {ex.Message}"));
            }
        }

        /// <summary>
        /// Creates a new instance of an object that implements the IQueryContext 
        /// interface.
        /// </summary>
        /// <returns>
        /// An IQueryContext instance that can be used to execute queries.
        /// </returns>
        protected virtual IQueryContext CreateContext()
        {
            return new DefaultQueryContext();
        }

        /// <summary>
        /// Retrieves a collection of sprints that match the specified query criteria.
        /// </summary>
        /// <param name="query">
        /// The query used to filter and select sprints. Defines the criteria that 
        /// sprints must meet to be included in
        /// the result.
        /// </param>
        /// <param name="context">
        /// The context in which the query is executed. Provides additional information
        /// or services required for query evaluation.
        /// </param>
        /// <param name="request">
        /// The request details associated with the operation. May include user 
        /// information, authentication, or other request-specific data.
        /// </param>
        /// <returns>
        /// An enumerable collection of sprints that satisfy the query criteria. The
        /// collection is empty if no sprints match.
        /// </returns>
        protected abstract IEnumerable<TIndexScrum> RetrieveSprints(IQuery<TIndexScrum> query, IQueryContext context, IRequest request);

        /// <summary>
        /// Retrieves a collection of Scrum items that match the specified 
        /// query criteria.
        /// </summary>
        /// <param name="query">
        /// The query that defines the criteria for selecting Scrum items. Cannot 
        /// be null.
        /// </param>
        /// <param name="context">
        /// The context in which the query is executed, providing additional 
        /// information or constraints. Cannot be null.
        /// </param>
        /// <param name="request">
        /// The request object containing details about the current API request. 
        /// Cannot be null.
        /// </param>
        /// <returns>
        /// An enumerable collection of Scrum items that satisfy the query 
        /// criteria. The collection is empty if no items match.
        /// </returns>
        protected abstract IEnumerable<TIndexItem> RetrieveItems(IQuery<TIndexItem> query, IQueryContext context, IRequest request);

        /// <summary>
        /// Validates the specified sprint payload.
        /// </summary>
        /// <param name="existingSprint">
        /// The existing sprint or null if a new sprint is created.
        /// </param>
        /// <param name="payload">
        /// The payload to validate.
        /// </param>
        /// <param name="request">
        /// The current request context.
        /// </param>
        /// <returns>
        /// An object representing the validation result.
        /// </returns>
        protected virtual IRestApiValidationResult ValidateSprint(TIndexScrum existingSprint, RestApiSprintPayload payload, IRequest request)
        {
            return new RestApiValidationResult();
        }

        /// <summary>
        /// Validates the specified move payload.
        /// </summary>
        /// <param name="existingItem">
        /// The existing item.
        /// </param>
        /// <param name="payload">
        /// The move payload to validate.
        /// </param>
        /// <param name="request">
        /// The current request context.
        /// </param>
        /// <returns>
        /// An object representing the validation result.
        /// </returns>
        protected virtual IRestApiValidationResult ValidateMove(TIndexItem existingItem, RestApiScrumMovePayload payload, IRequest request)
        {
            return new RestApiValidationResult();
        }

        /// <summary>
        /// Validates the specified rank payload.
        /// </summary>
        /// <param name="existingItem">
        /// The existing item.
        /// </param>
        /// <param name="payload">
        /// The rank payload to validate.
        /// </param>
        /// <param name="request">
        /// The current request context.
        /// </param>
        /// <returns>
        /// An object representing the validation result.
        /// </returns>
        protected virtual IRestApiValidationResult ValidateRank(TIndexItem existingItem, RestApiScrumRankPayload payload, IRequest request)
        {
            return new RestApiValidationResult();
        }

        /// <summary>
        /// Validates the specified item assignment/estimation payload.
        /// </summary>
        /// <param name="existingItem">
        /// The existing item.
        /// </param>
        /// <param name="payload">
        /// The item payload to validate.
        /// </param>
        /// <param name="request">
        /// The current request context.
        /// </param>
        /// <returns>
        /// An object representing the validation result.
        /// </returns>
        protected virtual IRestApiValidationResult ValidateItem(TIndexItem existingItem, RestApiScrumItemPayload payload, IRequest request)
        {
            return new RestApiValidationResult();
        }

        /// <summary>
        /// Creates a new sprint.
        /// </summary>
        /// <param name="payload">
        /// The incoming sprint payload.
        /// </param>
        /// <param name="request">
        /// The current request context.
        /// </param>
        /// <param name="newSprint">
        /// The created sprint.
        /// </param>
        /// <returns>
        /// The creation result.
        /// </returns>
        protected virtual IRestApiCrudResultCreate CreateSprint(RestApiSprintPayload payload, IRequest request, out TIndexScrum newSprint)
        {
            newSprint = default;

            return new RestApiCrudResultCreate()
            {
            };
        }

        /// <summary>
        /// Updates the specified sprint.
        /// </summary>
        /// <param name="existingSprint">
        /// The sprint to update.
        /// </param>
        /// <param name="payload">
        /// The incoming sprint payload.
        /// </param>
        /// <param name="request">
        /// The current request context.
        /// </param>
        /// <returns>
        /// The update result.
        /// </returns>
        protected virtual IRestApiCrudResultUpdate UpdateSprint(TIndexScrum existingSprint, RestApiSprintPayload payload, IRequest request)
        {
            return new RestApiCrudResultUpdate();
        }

        /// <summary>
        /// Moves the specified item to another sprint or to the backlog.
        /// </summary>
        /// <param name="existingItem">
        /// The item to update.
        /// </param>
        /// <param name="payload">
        /// The move payload.
        /// </param>
        /// <param name="request">
        /// The current request context.
        /// </param>
        /// <returns>
        /// The update result.
        /// </returns>
        protected virtual IRestApiCrudResultUpdate MoveItem(TIndexItem existingItem, RestApiScrumMovePayload payload, IRequest request)
        {
            return new RestApiCrudResultUpdate();
        }

        /// <summary>
        /// Updates the rank of the specified item.
        /// </summary>
        /// <param name="existingItem">
        /// The item to update.
        /// </param>
        /// <param name="payload">
        /// The rank payload.
        /// </param>
        /// <param name="request">
        /// The current request context.
        /// </param>
        /// <returns>
        /// The update result.
        /// </returns>
        protected virtual IRestApiCrudResultUpdate RankItem(TIndexItem existingItem, RestApiScrumRankPayload payload, IRequest request)
        {
            return new RestApiCrudResultUpdate();
        }

        /// <summary>
        /// Updates the assignment and the story-point estimate of the specified item.
        /// </summary>
        /// <param name="existingItem">
        /// The item to update.
        /// </param>
        /// <param name="payload">
        /// The item payload carrying the new assignee and estimate.
        /// </param>
        /// <param name="request">
        /// The current request context.
        /// </param>
        /// <returns>
        /// The update result.
        /// </returns>
        protected virtual IRestApiCrudResultUpdate UpdateItem(TIndexItem existingItem, RestApiScrumItemPayload payload, IRequest request)
        {
            return new RestApiCrudResultUpdate();
        }

        /// <summary>
        /// Deletes the specified sprint.
        /// </summary>
        /// <param name="existingSprint">
        /// The sprint to delete.
        /// </param>
        /// <param name="request">
        /// The current request context.
        /// </param>
        /// <returns>
        /// The delete result.
        /// </returns>
        protected virtual IRestApiCrudResultDelete DeleteSprint(TIndexScrum existingSprint, IRequest request)
        {
            return new RestApiCrudResultDelete();
        }

        /// <summary>
        /// Applies filtering criteria to the specified query based on the provided 
        /// WQL statement.
        /// </summary>
        /// <param name="wqlStatement">
        /// The WQL statement that defines the filtering conditions to apply to 
        /// the query. Cannot 
        /// be null.
        /// </param>
        /// <param name="query">
        /// The query object to which the filtering criteria will be applied. Cannot
        /// be null.
        /// </param>
        /// <param name="request">
        /// The request that provides the operational context for resolving
        /// the appropriate REST API URI.
        /// </param>
        /// <returns>
        /// A query representing the filtered set of items that match the criteria
        /// defined by the WQL statement.
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
        /// A string representing the filter expression to apply. The format and 
        /// supported operators depend on the implementation.
        /// </param>
        /// <param name="query">
        /// The query object to which the filter will be applied.
        /// </param>
        /// <param name="request">
        /// The request that provides the operational context for resolving
        /// the appropriate REST API URI.
        /// </param>
        /// <returns>
        /// A query representing the filtered set of items that match the criteria 
        /// defined by the filter statement.
        /// </returns>
        protected virtual IQuery<TIndexItem> Filter(string search, IQuery<TIndexItem> query, IRequest request)
        {
            return query;
        }

        /// <summary>
        /// Applies the specified filter criteria to the given query object.
        /// </summary>
        /// <param name="filters">
        /// A collection of quickfilter identifiers that should be applied in 
        /// addition to the WQL criteria.
        /// </param>
        /// <param name="query">
        /// The query object to which the filter will be applied.
        /// </param>
        /// <param name="request">
        /// The request that provides the operational context for resolving
        /// the appropriate REST API URI.
        /// </param>
        /// <returns>
        /// A query representing the filtered set of items that match the criteria 
        /// defined by the filter statement.
        /// </returns>
        protected virtual IQuery<TIndexItem> Filter(IEnumerable<string> filters, IQuery<TIndexItem> query, IRequest request)
        {
            return query;
        }

        /// <summary>
        /// Serializes the specified object as JSON and sets the response content 
        /// accordingly.
        /// </summary>
        /// <param name="response">
        /// The response whose content and Content-Type header will be updated.
        /// </param>
        /// <param name="data">
        /// The object to serialize as JSON and write into the response. Cannot 
        /// be null.
        /// </param>
        /// <returns>
        /// The updated response containing the JSON‑serialized content and the 
        /// Content-Type header
        /// set to "application/json".
        /// </returns>
        private static Response Json(Response response, object data)
        {
            response.Content = JsonSerializer.SerializeToUtf8Bytes(data, _jsonOptions);
            return response.AddHeaderContentType("application/json");
        }

        /// <summary>
        /// Deserializes the content of the specified request into an object of the 
        /// given type.
        /// </summary>
        /// <typeparam name="T">
        /// The type into which the request content should be deserialized. Must be a
        /// reference type.
        /// </typeparam>
        /// <param name="request">
        /// The request whose content is to be deserialized.
        /// </param>
        /// <returns>
        /// An instance of T deserialized from the request content, or null if the
        /// content is missing, empty, or deserialization fails.
        /// </returns>
        private static T GetPayload<T>(IRequest request)
            where T : class
        {
            if (request is not Request requestData || requestData.Content is null || requestData.Content.Length == 0)
            {
                return null;
            }

            try
            {
                return JsonSerializer.Deserialize<T>(requestData.Content, _jsonOptions);
            }
            catch
            {
                return null;
            }
        }

        /// <summary>
        /// Creates an HTTP response with status code 400 (Bad Request) and returns the
        /// validation result
        /// in JSON format.
        /// </summary>
        /// <param name="validation">
        /// The API validation result to include in the response. Must not be null.
        /// </param>
        /// <returns>
        /// A ResponseBadRequest object containing the validation result as JSON 
        /// content and the content type 'application/json'.
        /// </returns>
        private static Response ToValidationResponse(IRestApiValidationResult validation)
        {
            return new ResponseBadRequest()
            {
                Content = validation.ToJson()
            }
            .AddHeaderContentType("application/json");
        }

        /// <summary>
        /// Announces a data change for the specified entity if it belongs to a
        /// domain, so open ViewStates re-query the changed data. Entities that do
        /// not implement IDomain are ignored.
        /// </summary>
        /// <param name="entity">
        /// The changed entity.
        /// </param>
        /// <param name="operation">
        /// The kind of change the entity underwent.
        /// </param>
        private static void NotifyDomain(object entity, DataChangeOperation operation)
        {
            _ = DataChangedNotifier.NotifyAsync(entity, operation, (entity as IIndexItem)?.Id.ToString());
        }

        /// <summary>
        /// Determines the relative path segments of a request compared to the base path
        /// or after the last occurrence of "scrum" in the path.
        /// </summary>
        /// <param name="request">
        /// The request object containing the URI with path segments. May be null.
        /// </param>
        /// <returns>
        /// A list of strings representing the relative segments of the request path.  
        /// Returns an empty list if no relative segments can be determined.
        /// </returns>
        private static List<string> GetRelativeSegments(IRequest request)
        {
            var path = request?.Uri?.PathSegments?
                .Select(x => x?.Value)
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .ToList() ?? [];

            var basePath = request?.Uri?.BasePath?.PathSegments?
                .Select(x => x?.Value)
                .Where(x => !string.IsNullOrWhiteSpace(x))
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

            var scrumIndex = path.FindLastIndex(x => string.Equals(x, "scrum", StringComparison.OrdinalIgnoreCase));
            return scrumIndex >= 0 ? path.Skip(scrumIndex + 1).ToList() : [];
        }

        /// <summary>
        /// Determines whether the specified sequence of segments matches the expected
        /// sequence exactly, comparing each segment in order.
        /// </summary>
        /// <param name="segments">
        /// The list of segments to compare. The order and number of elements must 
        /// match the expected sequence.
        /// </param>
        /// <param name="expected">
        /// The expected sequence of segment values to match against. Each value is
        /// compared to the corresponding element in the segments list.
        /// </param>
        /// <returns>
        /// true if the segments sequence matches the expected sequence 
        /// exactly; otherwise, false.
        /// </returns>
        private static bool Matches(IReadOnlyList<string> segments, params string[] expected)
        {
            if (segments.Count != expected.Length)
            {
                return false;
            }

            for (var i = 0; i < expected.Length; i++)
            {
                if (!EqualsSegment(segments[i], expected[i]))
                {
                    return false;
                }
            }

            return true;
        }

        /// <summary>
        /// Compares two strings for equality while ignoring case.
        /// </summary>
        /// <param name="a">
        /// The first string to compare. May be null.
        /// </param>
        /// <param name="b">
        /// The second string to compare. May be null.
        /// </param>
        /// <returns>
        /// Returns <see langword="true"/> if the two strings are equal, ignoring case;  
        /// otherwise <see langword="false"/>.
        /// </returns>
        private static bool EqualsSegment(string a, string b)
        {
            return string.Equals(a, b, StringComparison.OrdinalIgnoreCase);
        }

        private static IReadOnlyList<string> NormalizeBacklogSegments(IReadOnlyList<string> segments)
        {
            if (segments.Count > 0 && EqualsSegment(segments[0], "backlog"))
            {
                return segments.Skip(1).ToArray();
            }

            return segments;
        }

        /// <summary>
        /// Converts the specified sprint identifier string to a nullable GUID if it
        /// is a valid GUID representation.
        /// </summary>
        /// <param name="sprintId">
        /// The sprint identifier to normalize. Must be a string representation of
        /// a GUID or null.
        /// </param>
        /// <returns>
        /// A GUID value if the input string is a valid GUID; otherwise, null.
        /// </returns>
        protected static Guid? NormalizeSprintId(string sprintId)
        {
            return Guid.TryParse(sprintId, out var sprintIdValue) ? sprintIdValue : null;
        }

        /// <summary>
        /// Calculates the next available rank value for items within the 
        /// specified sprint.
        /// </summary>
        /// <param name="items">
        /// A collection of items to evaluate for determining the next rank. Each 
        /// item must have a SprintId and Rank property.
        /// </param>
        /// <param name="sprintId">
        /// The identifier of the sprint to filter items by. If null, items with a 
        /// null SprintId are considered.
        /// </param>
        /// <returns>
        /// The next rank value, which is one greater than the highest rank among 
        /// items in the specified sprint. Returns 1 if no items are found.
        /// </returns>
        protected static int NextRank(IEnumerable<RestApiScrumItem> items, Guid? sprintId)
        {
            var sid = sprintId;
            return items
                .Where(x => x.SprintId == sid.ToString())
                .Select(x => x.Rank)
                .DefaultIfEmpty(0)
                .Max() + 1;
        }

        /// <summary>
        /// Normalizes the ranking of the specified Scrum items within a given sprint 
        /// by reassigning their ranks.
        /// </summary>
        /// <param name="items">
        /// The collection of Scrum items whose ranks should be normalized.  
        /// Each element must have a valid sprint ID and rank value.
        /// </param>
        /// <param name="sprintId">
        /// The unique identifier of the sprint for which rank normalization should 
        /// be performed.  
        /// If null, no items are processed.
        /// </param>
        protected static void NormalizeRanks(IEnumerable<RestApiScrumItem> items, Guid? sprintId)
        {
            var sid = sprintId;
            var orderedItems = items
                .Where(x => x.SprintId == sid.ToString())
                .OrderBy(x => x.Rank)
                .ThenBy(x => x.Id)
                .ToList();

            for (var i = 0; i < orderedItems.Count; i++)
            {
                orderedItems[i].Rank = i + 1;
            }
        }

        /// <summary>
        /// Reorders the specified item within a collection of Scrum items for a 
        /// given sprint, updating ranks to reflect the new order.
        /// </summary>
        /// <param name="items">
        /// The collection of Scrum items to be reordered. Only items belonging to 
        /// the specified sprint are affected.
        /// </param>
        /// <param name="item">
        /// The Scrum item to move to a new rank within the sprint.
        /// </param>
        /// <param name="sprintId">
        /// The identifier of the sprint in which to reorder the item. If null, only 
        /// items with a null sprint are considered.
        /// </param>
        /// <param name="requestedRank">
        /// The desired rank (1-based) for the item within the sprint. Values outside
        /// the valid range are clamped to the nearest valid position.
        /// </param>
        protected static void ReorderItem(IEnumerable<RestApiScrumItem> items, RestApiScrumItem item, Guid? sprintId, int requestedRank)
        {
            var sid = sprintId;
            var rankedItems = items
                .Where(x => x.Id != item.Id)
                .Where(x => x.SprintId == sid.ToString())
                .OrderBy(x => x.Rank)
                .ThenBy(x => x.Id)
                .ToList();

            var index = Math.Clamp(requestedRank, 1, rankedItems.Count + 1) - 1;
            rankedItems.Insert(index, item);

            for (var i = 0; i < rankedItems.Count; i++)
            {
                rankedItems[i].SprintId = sid.ToString();
                rankedItems[i].Rank = i + 1;
            }
        }

        /// <summary>
        /// Closes all active sprints in the specified collection except for the 
        /// sprint with the given active sprint identifier.
        /// </summary>
        /// <param name="sprints">A collection of sprints to evaluate and update. 
        /// Each sprint with an active status, except the one matching the 
        /// specified active sprint identifier, will be closed.
        /// </param>
        /// <param name="activeSprintId">
        /// The unique identifier of the sprint that should remain active. All other
        /// active sprints will be closed.
        /// </param>
        protected static void CloseOtherActiveSprints(IEnumerable<RestApiScrumSprintItem> sprints, Guid activeSprintId)
        {
            foreach (var sprint in sprints.Where(x => x.Id != activeSprintId.ToString()))
            {
                if (string.Equals(sprint.Status, "active", StringComparison.OrdinalIgnoreCase))
                {
                    sprint.Status = "closed";
                }
            }
        }

        /// <summary>
        /// Creates a new instance of the RestApiScrumSprint class that is a copy 
        /// of the specified sprint.
        /// </summary>
        /// <remarks>The cloned instance is a shallow copy; reference-type properties 
        /// are not deeply cloned.
        /// </remarks>
        /// <param name="sprint">
        /// The RestApiScrumSprint instance to clone. Cannot be null.
        /// </param>
        /// <returns>
        /// A new RestApiScrumSprint object with the same property values as the 
        /// specified sprint.
        /// </returns>
        protected static RestApiScrumSprintItem Clone(RestApiScrumSprintItem sprint)
        {
            return new RestApiScrumSprintItem
            {
                Id = sprint.Id,
                Name = sprint.Name,
                Goal = sprint.Goal,
                Status = sprint.Status,
                Start = sprint.Start,
                End = sprint.End,
                Capacity = sprint.Capacity
            };
        }

        /// <summary>
        /// Creates a new instance of a RestApiScrumItem that is a copy of the 
        /// specified item.
        /// </summary>
        /// <remarks>
        /// The cloned item is a shallow copy; reference-type properties are not 
        /// deeply cloned. Use this method to duplicate an item without affecting 
        /// the original instance.
        /// </remarks>
        /// <param name="item">
        /// The RestApiScrumItem to clone. Cannot be null.
        /// </param>
        /// <returns>
        /// A new RestApiScrumItem instance with property values copied from the 
        /// specified item.
        /// </returns>
        protected static RestApiScrumItem Clone(RestApiScrumItem item)
        {
            return new RestApiScrumItem
            {
                Id = item.Id,
                Type = item.Type,
                Icon = item.Icon,
                Key = item.Key,
                Title = item.Title,
                Priority = item.Priority,
                Points = item.Points,
                SprintId = item.SprintId,
                Status = item.Status,
                Rank = item.Rank
            };
        }

        /// <summary>
        /// Converts a sprint model instance into the REST sprint DTO.
        /// </summary>
        /// <param name="sprint">The sprint model.</param>
        /// <returns>The REST sprint DTO.</returns>
        protected virtual RestApiScrumSprintItem ToRestSprint(TIndexScrum sprint)
        {
            if (sprint is RestApiScrumSprintItem restSprint)
            {
                return Clone(restSprint);
            }

            return new RestApiScrumSprintItem
            {
                Id = sprint.Id.ToString()
            };
        }

        /// <summary>
        /// Converts an item model instance into the REST item DTO.
        /// </summary>
        /// <param name="item">The item model.</param>
        /// <returns>The REST item DTO.</returns>
        protected virtual RestApiScrumItem ToRestItem(TIndexItem item)
        {
            if (item is RestApiScrumItem restItem)
            {
                return Clone(restItem);
            }

            return new RestApiScrumItem
            {
                Id = item.Id.ToString()
            };
        }
    }
}
