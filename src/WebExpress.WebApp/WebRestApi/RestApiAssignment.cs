using System;
using System.Text;
using System.Text.Json;
using WebExpress.WebApp.WebMessageQueue;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;
using WebExpress.WebCore.WebStatusPage;
using WebExpress.WebIndex;
using WebExpress.WebIndex.Queries;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Abstract base class for an assignment REST endpoint, the counterpart of the
    /// client-side <c>webexpress.webapp.AssignmentCtrl</c>.
    /// </summary>
    /// <remarks>
    /// Every method answers the same <see cref="RestApiAssignmentResult"/>, so a write hands
    /// the control the state it left behind and the control redraws without a second
    /// request. The base owns the protocol: an unknown object is <c>404</c>, a caller the
    /// <see cref="MayChange"/> hook rejects is <c>403</c> and nothing is changed, and a
    /// <see cref="RestApiRefusal"/> thrown by a hook reaches the user with its message. A
    /// successful write is announced on the domain of the object, so lists bound to the
    /// same domain pick up the new assignee.
    /// </remarks>
    /// <typeparam name="TIndexItem">Type of the object that carries the assignee.</typeparam>
    public abstract class RestApiAssignment<TIndexItem> : IRestApi
        where TIndexItem : IIndexItem
    {
        private static readonly JsonSerializerOptions _jsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = true
        };

        /// <summary>
        /// Handles <c>GET {base}</c>: answers the assignment state of the object.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The HTTP response.</returns>
        [Method(RequestMethod.GET)]
        public virtual IResponse Retrieve(IRequest request)
        {
            try
            {
                using var context = CreateContext();
                var item = RetrieveItem(context, request);
                if (item is null)
                {
                    return new ResponseNotFound();
                }

                return Json(CreateResult(item, context, request));
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "error processing get request.");
            }
        }

        /// <summary>
        /// Handles <c>PUT {base}</c> with the body <c>{ userId }</c>: assigns the object. A
        /// body without a user id assigns the object to the caller.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The HTTP response.</returns>
        [Method(RequestMethod.PUT)]
        public virtual IResponse Update(IRequest request)
        {
            try
            {
                using var context = CreateContext();
                var item = RetrieveItem(context, request);
                if (item is null)
                {
                    return new ResponseNotFound();
                }

                if (!MayChange(item, context, request))
                {
                    return new ResponseForbidden();
                }

                if (!TryGetPayload(request, out var payload))
                {
                    return new ResponseBadRequest(new StatusMessage("invalid payload."));
                }

                var userId = payload?.UserId;
                if (string.IsNullOrWhiteSpace(userId))
                {
                    // an anonymous caller has nobody to assign the object to
                    userId = RetrieveSelf(context, request)?.Id;
                    if (string.IsNullOrWhiteSpace(userId))
                    {
                        return new ResponseForbidden();
                    }
                }

                if (!Assign(item, userId, context, request))
                {
                    return new ResponseBadRequest(new StatusMessage("unknown person."));
                }

                _ = DataChangedNotifier.NotifyAsync(item, DataChangeOperation.Updated, item.Id.ToString());

                return Json(CreateResult(item, context, request));
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "error processing put request.");
            }
        }

        /// <summary>
        /// Handles <c>DELETE {base}</c>: removes the assignment of the object.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The HTTP response.</returns>
        [Method(RequestMethod.DELETE)]
        public virtual IResponse Delete(IRequest request)
        {
            try
            {
                using var context = CreateContext();
                var item = RetrieveItem(context, request);
                if (item is null)
                {
                    return new ResponseNotFound();
                }

                if (!MayChange(item, context, request))
                {
                    return new ResponseForbidden();
                }

                Unassign(item, context, request);

                _ = DataChangedNotifier.NotifyAsync(item, DataChangeOperation.Updated, item.Id.ToString());

                return Json(CreateResult(item, context, request));
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "error processing delete request.");
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
        /// Returns the object the request addresses, typically resolved from a route
        /// parameter of the endpoint.
        /// </summary>
        /// <param name="context">The context in which the query is executed.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>
        /// The object, or <see langword="null"/> when it does not exist or the caller may
        /// not see it, which the endpoint answers with <c>404</c>.
        /// </returns>
        protected abstract TIndexItem RetrieveItem(IQueryContext context, IRequest request);

        /// <summary>
        /// Returns the assignee of the object.
        /// </summary>
        /// <param name="item">The object.</param>
        /// <param name="context">The context in which the query is executed.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The assignee, or <see langword="null"/> when the object is unassigned.</returns>
        protected abstract RestApiAssignmentItem RetrieveAssignee(TIndexItem item, IQueryContext context, IRequest request);

        /// <summary>
        /// Returns the person calling the endpoint.
        /// </summary>
        /// <param name="context">The context in which the query is executed.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The caller, or <see langword="null"/> for an anonymous caller.</returns>
        protected abstract RestApiAssignmentItem RetrieveSelf(IQueryContext context, IRequest request);

        /// <summary>
        /// Decides whether the caller may change the assignment of the object. The decision
        /// is the application's, so the base offers no default that could open a write by
        /// accident.
        /// </summary>
        /// <param name="item">The object.</param>
        /// <param name="context">The context in which the query is executed.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>
        /// <see langword="true"/> when the caller may assign and unassign; otherwise
        /// <see langword="false"/>, which the writing methods answer with <c>403</c>.
        /// </returns>
        protected abstract bool MayChange(TIndexItem item, IQueryContext context, IRequest request);

        /// <summary>
        /// Persists a new assignee. A change the application declines for a reason the user
        /// should read is refused with a <see cref="RestApiRefusal"/>.
        /// </summary>
        /// <param name="item">The object.</param>
        /// <param name="userId">The id of the person the object is assigned to.</param>
        /// <param name="context">The context in which the query is executed.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>
        /// <see langword="true"/> when the assignment was stored; <see langword="false"/>
        /// when the person cannot be resolved.
        /// </returns>
        protected abstract bool Assign(TIndexItem item, string userId, IQueryContext context, IRequest request);

        /// <summary>
        /// Removes the assignee. Unassigning an object without an assignee is not an error,
        /// because the state the caller asked for is reached either way. A change the
        /// application declines is refused with a <see cref="RestApiRefusal"/>.
        /// </summary>
        /// <param name="item">The object.</param>
        /// <param name="context">The context in which the query is executed.</param>
        /// <param name="request">The incoming request.</param>
        protected abstract void Unassign(TIndexItem item, IQueryContext context, IRequest request);

        /// <summary>
        /// Builds the answer every method shares from the current state of the object.
        /// </summary>
        /// <param name="item">The object.</param>
        /// <param name="context">The context in which the query is executed.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The assignment state.</returns>
        private RestApiAssignmentResult CreateResult(TIndexItem item, IQueryContext context, IRequest request)
        {
            return new RestApiAssignmentResult
            {
                Assignee = RetrieveAssignee(item, context, request),
                Self = RetrieveSelf(context, request),
                MayChange = MayChange(item, context, request)
            };
        }

        /// <summary>
        /// Reads the optional request body. An empty body is valid and yields no payload,
        /// a body that is not valid json is not.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <param name="payload">The payload, or <see langword="null"/> for an empty body.</param>
        /// <returns><see langword="false"/> when the body cannot be read.</returns>
        private static bool TryGetPayload(IRequest request, out RestApiAssignmentPayload payload)
        {
            payload = null;

            if (request is not Request data || data.Content is null || data.Content.Length == 0)
            {
                return true;
            }

            try
            {
                payload = JsonSerializer.Deserialize<RestApiAssignmentPayload>(data.Content, _jsonOptions);
                return true;
            }
            catch (JsonException)
            {
                return false;
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
