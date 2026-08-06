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

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Abstract class providing quickfilter responses for REST API.
    /// </summary>
    /// <typeparam name="TIndexItem">Type of the index item.</typeparam>
    public abstract class RestApiQuickfilter<TIndexItem> : IRestApi
        where TIndexItem : IIndexItem
    {
        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        protected RestApiQuickfilter()
        {
        }

        /// <summary>
        /// Processing of the resource that was called via the get request.
        /// Returns a list-shaped payload with items, title and pagination.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The response containing the result of the operation.</returns>
        [Method(RequestMethod.GET)]
        public IResponse Retrieve(IRequest request)
        {
            try
            {
                using var context = CreateContext();

                // an id narrows the read to a single filter and answers in the
                // record shape a form binds to, because that is what the edit
                // dialog of a user-defined filter loads; without an id the whole
                // bar is returned as before
                var id = request?.GetParameter("id")?.Value;
                if (!string.IsNullOrWhiteSpace(id))
                {
                    var item = RetrieveItem(context, request, id);

                    return item is null
                        ? new ResponseNotFound(new StatusMessage($"unknown filter '{id}'."))
                        : new RestApiCrudResultRetrieve() { Data = item }.ToResponse();
                }

                var items = RetrieveItems(context, request);

                var result = new RestApiQuickfilterResult<TIndexItem>()
                {
                    Items = items
                };

                return result.ToResponse();
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "Error processing request.");
            }
        }

        /// <summary>
        /// Retrieves the single filter an edit dialog loads. The default picks it
        /// out of <see cref="RetrieveItems"/> and hands back the same shape a
        /// write takes, so the dialog reads exactly what it will send back. An
        /// endpoint that keeps more about a filter overrides this and returns a
        /// record of its own.
        /// </summary>
        /// <param name="context">The context in which the query is executed.</param>
        /// <param name="request">The request that provides the operational context.</param>
        /// <param name="id">The id of the filter.</param>
        /// <returns>The filter record, or null when the filter is unknown.</returns>
        protected virtual object RetrieveItem(IQueryContext context, IRequest request, string id)
        {
            var item = RetrieveItems(context, request)?.FirstOrDefault(x => x.Id == id);

            if (item is null)
            {
                return null;
            }

            return new RestApiQuickfilterPayload()
            {
                Id = item.Id,
                Name = item.Name,
                Icon = item.IconSpec,
                Color = item.ColorValue ?? item.ColorCss,
                Criteria = item.Criteria
            };
        }

        /// <summary>
        /// Processing of the resource that was called via the post request, which
        /// creates a user-defined filter. The endpoint owns the id, so the created
        /// item is returned and the client adopts it without reloading.
        /// </summary>
        /// <param name="request">The request carrying the filter payload.</param>
        /// <returns>The response containing the created filter.</returns>
        [Method(RequestMethod.POST)]
        public IResponse Create(IRequest request)
        {
            try
            {
                var payload = ReadPayload(request);
                if (payload is null)
                {
                    return new ResponseBadRequest(new StatusMessage("missing request body."));
                }

                using var context = CreateContext();
                var item = CreateItem(context, request, payload);

                return item is null
                    ? new ResponseNotImplemented(new StatusMessage("this endpoint does not create filters."))
                    : new RestApiQuickfilterResult<TIndexItem>() { Items = [item] }.ToResponse();
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "Error processing request.");
            }
        }

        /// <summary>
        /// Processing of the resource that was called via the put request, which
        /// changes a user-defined filter. The updated item is returned so the
        /// client can adopt the server's view of it.
        /// </summary>
        /// <param name="request">The request carrying the filter payload.</param>
        /// <returns>The response containing the updated filter.</returns>
        [Method(RequestMethod.PUT)]
        public IResponse Update(IRequest request)
        {
            try
            {
                var payload = ReadPayload(request);
                if (payload is null || string.IsNullOrWhiteSpace(payload.Id))
                {
                    return new ResponseBadRequest(new StatusMessage("missing filter id."));
                }

                using var context = CreateContext();
                var item = UpdateItem(context, request, payload);

                return item is null
                    ? new ResponseNotImplemented(new StatusMessage("this endpoint does not change filters."))
                    : new RestApiQuickfilterResult<TIndexItem>() { Items = [item] }.ToResponse();
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "Error processing request.");
            }
        }

        /// <summary>
        /// Processing of the resource that was called via the delete request,
        /// which removes a user-defined filter. The id is taken from the query
        /// parameter, falling back to the payload.
        /// </summary>
        /// <param name="request">The request identifying the filter.</param>
        /// <returns>The response indicating whether the filter was removed.</returns>
        [Method(RequestMethod.DELETE)]
        public IResponse Delete(IRequest request)
        {
            try
            {
                var id = request?.GetParameter("id")?.Value;
                if (string.IsNullOrWhiteSpace(id))
                {
                    id = ReadPayload(request)?.Id;
                }

                if (string.IsNullOrWhiteSpace(id))
                {
                    return new ResponseBadRequest(new StatusMessage("missing filter id."));
                }

                using var context = CreateContext();

                return DeleteItem(context, request, id)
                    ? new ResponseNoContent()
                    : new ResponseNotImplemented(new StatusMessage("this endpoint does not delete filters."));
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "Error processing request.");
            }
        }

        /// <summary>
        /// Deserializes the filter payload of a write request.
        /// </summary>
        /// <param name="request">The request to read.</param>
        /// <returns>The payload, or null when the request carries no body.</returns>
        private static RestApiQuickfilterPayload ReadPayload(IRequest request)
        {
            if (request is not Request requestData || requestData.Content is null || requestData.Content.Length == 0)
            {
                return null;
            }

            return JsonSerializer.Deserialize<RestApiQuickfilterPayload>
            (
                Encoding.UTF8.GetString(requestData.Content),
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }
            );
        }

        /// <summary>
        /// Creates a user-defined filter. An endpoint opts into user-defined
        /// filters by overriding this; the default offers none, which keeps every
        /// existing read-only endpoint unchanged.
        /// </summary>
        /// <param name="context">The context in which the query is executed.</param>
        /// <param name="request">The request that provides the operational context.</param>
        /// <param name="payload">The values the client supplied.</param>
        /// <returns>The created filter, or null when the endpoint creates none.</returns>
        protected virtual RestApiQuickfilterItem CreateItem(IQueryContext context, IRequest request, RestApiQuickfilterPayload payload)
        {
            return null;
        }

        /// <summary>
        /// Changes a user-defined filter. An endpoint opts in by overriding this;
        /// the default changes none.
        /// </summary>
        /// <param name="context">The context in which the query is executed.</param>
        /// <param name="request">The request that provides the operational context.</param>
        /// <param name="payload">The values the client supplied.</param>
        /// <returns>The updated filter, or null when the endpoint changes none.</returns>
        protected virtual RestApiQuickfilterItem UpdateItem(IQueryContext context, IRequest request, RestApiQuickfilterPayload payload)
        {
            return null;
        }

        /// <summary>
        /// Removes a user-defined filter. An endpoint opts in by overriding this;
        /// the default removes none.
        /// </summary>
        /// <param name="context">The context in which the query is executed.</param>
        /// <param name="request">The request that provides the operational context.</param>
        /// <param name="id">The id of the filter to remove.</param>
        /// <returns>True when the filter was removed.</returns>
        protected virtual bool DeleteItem(IQueryContext context, IRequest request, string id)
        {
            return false;
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
        /// Retrieves a queryable collection of index items.
        /// </summary>
        /// <param name="context">
        /// The context in which the query is executed. Provides additional information or constraints 
        /// for the retrieval operation. Cannot be null.
        /// </param>
        /// <param name="request">
        /// The request that provides the operational context.
        /// </param>
        /// <returns>
        /// An enumerable collection of quick filter items that match the 
        /// specified context and request. The collection may be empty if 
        /// no items are found.
        /// </returns>
        protected abstract IEnumerable<RestApiQuickfilterItem> RetrieveItems(IQueryContext context, IRequest request);

    }
}