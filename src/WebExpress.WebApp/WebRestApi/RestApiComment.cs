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
    /// Abstract base class for a threaded comment REST endpoint. The class
    /// dispatches the sub-path routes consumed by the client-side
    /// <c>webexpress.webapp.CommentCtrl</c>:
    /// <list type="bullet">
    ///   <item><c>GET    {base}</c> → list of comments</item>
    ///   <item><c>POST   {base}</c> → create comment</item>
    ///   <item><c>PUT    {base}/{id}</c> → update comment</item>
    ///   <item><c>DELETE {base}/{id}</c> → delete comment</item>
    ///   <item><c>POST   {base}/{id}/likes</c> → toggle like</item>
    ///   <item><c>POST   {base}/{id}/pin</c> → toggle pinned</item>
    ///   <item><c>POST   {base}/{id}/reactions</c> → toggle reaction</item>
    ///   <item><c>POST   {base}/{id}/replies</c> → append reply</item>
    /// </list>
    /// Derived classes provide storage and identity by overriding the
    /// <c>Retrieve*</c>, <c>Persist*</c> and <c>ResolveCurrentUser</c>
    /// methods. The base class only deals with HTTP wiring, sub-path
    /// matching and JSON marshalling.
    /// </summary>
    /// <typeparam name="TIndexItem">Type of the index item.</typeparam>
    public abstract class RestApiComment<TIndexItem> : IRestApi
        where TIndexItem : IIndexItem
    {
        private static readonly JsonSerializerOptions _jsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = true
        };

        /// <summary>
        /// Handles the <c>GET</c> entry point. Always returns the full list
        /// of comments - paging is delegated to the JS controller, which
        /// renders client-side.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The HTTP response.</returns>
        [Method(RequestMethod.GET)]
        public virtual IResponse Retrieve(IRequest request)
        {
            try
            {
                //var segments = GetRelativeSegments(request);
                //if (segments.Count != 0)
                //{
                //    return new ResponseNotFound();
                //}

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
                var comments = RetrieveComments(query, context, request) ?? [];

                return Json(comments);
            }
            catch (Exception ex)
            {
                return new ResponseBadRequest(new StatusMessage($"error processing get request: {ex.Message}"));
            }
        }

        /// <summary>
        /// Handles every <c>POST</c> route: create comment, toggle like /
        /// pin / reaction, post reply.
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

                // POST {base}
                if (segments.Count == 0)
                {
                    var payload = GetPayload<RestApiCommentPayload>(request);
                    if (payload is null)
                    {
                        return new ResponseBadRequest(new StatusMessage("missing or invalid payload."));
                    }
                    var created = CreateComment(payload, context, request);
                    return created is null
                        ? new ResponseBadRequest(new StatusMessage("comment could not be created."))
                        : Json(created);
                }

                // POST {base}/{id}/...
                if (segments.Count == 2)
                {
                    var id = segments[0];

                    if (Matches(segments[1], "likes"))
                    {
                        var payload = GetPayload<RestApiCommentLikePayload>(request);
                        var likes = ToggleLike(id, payload?.UserId ?? ResolveCurrentUser(context, request), context, request);
                        return likes is null
                            ? new ResponseNotFound()
                            : Json(new { likes });
                    }

                    if (Matches(segments[1], "pin"))
                    {
                        var pinned = TogglePin(id, context, request);
                        return pinned is null
                            ? new ResponseNotFound()
                            : Json(new { pinned });
                    }

                    if (Matches(segments[1], "reactions"))
                    {
                        var payload = GetPayload<RestApiCommentReactionPayload>(request);
                        if (payload is null || string.IsNullOrEmpty(payload.Emoji))
                        {
                            return new ResponseBadRequest(new StatusMessage("missing reaction emoji."));
                        }

                        var reactions = ToggleReaction(id, payload.Emoji, payload.UserId ?? ResolveCurrentUser(context, request), context, request);
                        return reactions is null
                            ? new ResponseNotFound()
                            : Json(new { reactions });
                    }

                    if (Matches(segments[1], "replies"))
                    {
                        var payload = GetPayload<RestApiCommentReplyPayload>(request);
                        if (payload is null || string.IsNullOrWhiteSpace(payload.Body))
                        {
                            return new ResponseBadRequest(new StatusMessage("missing reply body."));
                        }

                        var reply = AppendReply(id, payload.Body, context, request);
                        return reply is null
                            ? new ResponseNotFound()
                            : Json(reply);
                    }
                }

                return new ResponseNotFound();
            }
            catch (Exception ex)
            {
                return new ResponseBadRequest(new StatusMessage($"error processing post request: {ex.Message}"));
            }
        }

        /// <summary>
        /// Handles <c>PUT {base}/{id}</c>: updates the body / category /
        /// labels of an existing comment.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The HTTP response.</returns>
        [Method(RequestMethod.PUT)]
        public virtual IResponse Update(IRequest request)
        {
            try
            {
                using var context = CreateContext();
                var segments = GetRelativeSegments(request);
                if (segments.Count != 1)
                {
                    return new ResponseNotFound();
                }

                var payload = GetPayload<RestApiCommentPayload>(request);
                if (payload is null)
                {
                    return new ResponseBadRequest(new StatusMessage("missing or invalid payload."));
                }

                var updated = UpdateComment(segments[0], payload, context, request);
                return updated is null
                    ? new ResponseNotFound()
                    : Json(updated);
            }
            catch (Exception ex)
            {
                return new ResponseBadRequest(new StatusMessage($"error processing put request: {ex.Message}"));
            }
        }

        /// <summary>
        /// Handles <c>DELETE {base}/{id}</c>.
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

                var deleted = DeleteComment(segments[0], context, request);
                return deleted
                    ? new ResponseNoContent()
                    : new ResponseNotFound();
            }
            catch (Exception ex)
            {
                return new ResponseBadRequest(new StatusMessage($"error processing delete request: {ex.Message}"));
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
        /// Returns the current set of comments to be rendered by the
        /// client-side controller.
        /// </summary>
        /// <param name="query">
        /// The query that defines the criteria for selecting Scrum items. Cannot 
        /// be null.
        /// </param>
        /// <param name="context">
        /// The context in which the query is executed, providing additional 
        /// information or constraints. Cannot be null.
        /// </param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The comments.</returns>
        protected abstract IEnumerable<RestApiCommentItem> RetrieveComments(IQuery<TIndexItem> query, IQueryContext context, IRequest request);

        /// <summary>
        /// Persists a newly created comment.
        /// </summary>
        /// <param name="payload">The create payload.</param>
        /// <param name="context">
        /// The context in which the query is executed, providing additional 
        /// information or constraints. Cannot be null.
        /// </param>
        /// <param name="request">The incoming request.</param>
        /// <returns>
        /// The created comment, or <see langword="null"/> when creation failed.
        /// </returns>
        protected abstract RestApiCommentItem CreateComment(RestApiCommentPayload payload, IQueryContext context, IRequest request);

        /// <summary>
        /// Updates the body / category / labels of an existing comment.
        /// </summary>
        /// <param name="id">The id of the comment to update.</param>
        /// <param name="payload">The new field values.</param>
        /// <param name="context">
        /// The context in which the query is executed, providing additional 
        /// information or constraints. Cannot be null.
        /// </param>
        /// <param name="request">
        /// The incoming request.
        /// </param>
        /// <returns>
        /// The updated comment, or <see langword="null"/> when not found.
        /// </returns>
        protected abstract RestApiCommentItem UpdateComment(string id, RestApiCommentPayload payload, IQueryContext context, IRequest request);

        /// <summary>
        /// Permanently removes a comment.
        /// </summary>
        /// <param name="id">The id of the comment to delete.</param>
        /// <param name="context">
        /// The context in which the query is executed, providing additional 
        /// information or constraints. Cannot be null.
        /// </param>
        /// <param name="request">The incoming request.</param>
        /// <returns>
        /// <see langword="true"/> when the comment existed and was deleted.
        /// </returns>
        protected abstract bool DeleteComment(string id, IQueryContext context, IRequest request);

        /// <summary>
        /// Toggles the like for the specified user on the comment with the
        /// given id.
        /// </summary>
        /// <param name="id">The comment id.</param>
        /// <param name="userId">The user toggling the like.</param>
        /// <param name="context">
        /// The context in which the query is executed, providing additional 
        /// information or constraints. Cannot be null.
        /// </param>
        /// <param name="request">The incoming request.</param>
        /// <returns>
        /// The new like collection, or <see langword="null"/> when the 
        /// comment does not exist.
        /// </returns>
        protected abstract IEnumerable<string> ToggleLike(string id, string userId, IQueryContext context, IRequest request);

        /// <summary>
        /// Toggles the pinned state of a comment.
        /// </summary>
        /// <param name="id">The comment id.</param>
        /// <param name="context">
        /// The context in which the query is executed, providing additional 
        /// information or constraints. Cannot be null.
        /// </param>
        /// <param name="request">The incoming request.</param>
        /// <returns>
        /// The new pinned state, or <see langword="null"/> when the comment 
        /// does not exist.
        /// </returns>
        protected abstract bool? TogglePin(string id, IQueryContext context, IRequest request);

        /// <summary>
        /// Toggles a reaction emoji for the specified user on the comment
        /// with the given id.
        /// </summary>
        /// <param name="id">The comment id.</param>
        /// <param name="emoji">The emoji glyph.</param>
        /// <param name="userId">The user toggling the reaction.</param>
        /// <param name="context">
        /// The context in which the query is executed, providing additional 
        /// information or constraints. Cannot be null.
        /// </param>
        /// <param name="request">
        /// The incoming request.
        /// </param>
        /// <returns>
        /// The new reactions map, or <see langword="null"/> when the comment 
        /// does not exist.
        /// </returns>
        protected abstract IDictionary<string, IEnumerable<string>> ToggleReaction(string id, string emoji, string userId, IQueryContext context, IRequest request);

        /// <summary>
        /// Appends a reply to the specified parent comment.
        /// </summary>
        /// <param name="id">The parent comment id.</param>
        /// <param name="body">The reply body.</param>
        /// <param name="context">
        /// The context in which the query is executed, providing additional 
        /// information or constraints. Cannot be null.
        /// </param>
        /// <param name="request">The incoming request.</param>
        /// <returns>
        /// The created reply, or <see langword="null"/> when the parent 
        /// does not exist.
        /// </returns>
        protected abstract RestApiCommentReply AppendReply(string id, string body, IQueryContext context, IRequest request);

        /// <summary>
        /// Returns the id of the user driving the current request. Override
        /// to plug a real identity provider in; the default implementation
        /// returns <see langword="null"/>.
        /// </summary>
        /// <param name="context">
        /// The context in which the query is executed, providing additional 
        /// information or constraints. Cannot be null.
        /// </param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The user id.</returns>
        protected virtual string ResolveCurrentUser(IQueryContext context, IRequest request) => null;

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
        /// Returns the path segments of the request below the endpoint's
        /// base path. For an endpoint mounted at <c>/api/v1/comments</c>
        /// invoked with <c>/api/v1/comments/c1/likes</c>, the result is
        /// <c>[ "c1", "likes" ]</c>.
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
        /// Compares a path segment against an expected literal case-insensitively.
        /// </summary>
        /// <param name="segment">The segment.</param>
        /// <param name="expected">The expected literal.</param>
        /// <returns><see langword="true"/> when equal.</returns>
        private static bool Matches(string segment, string expected) =>
            string.Equals(segment, expected, StringComparison.OrdinalIgnoreCase);

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
