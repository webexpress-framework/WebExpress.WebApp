using System;
using System.Collections.Generic;
using System.Text;
using System.Text.Json;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebParameter;
using WebExpress.WebCore.WebRestApi;
using WebExpress.WebCore.WebStatusPage;
using WebExpress.WebIndex;
using WebExpress.WebIndex.Queries;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Abstract base class for the REST API that backs the visual form editor
    /// (<c>ControlRestFormEditor</c> / <c>webexpress.webapp.RestFormEditorCtrl</c>).
    /// Handles the GET (load) and PUT (save) requests for a single form
    /// structure addressed by its form id.
    /// </summary>
    /// <typeparam name="TIndexItem">Type of the index item.</typeparam>
    public abstract class RestApiFormEditor<TIndexItem> : IRestApi
        where TIndexItem : IIndexItem
    {
        private static readonly JsonSerializerOptions _jsonOptions = new()
        {
            PropertyNameCaseInsensitive = true
        };

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        public RestApiFormEditor()
        {
        }

        /// <summary>
        /// Processes GET requests for a single form structure. The form id is
        /// taken from the route parameter <c>id</c> (matching the JS-side URL
        /// pattern <c>{restUrl}/item/{formId}</c>).
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The response carrying the form structure.</returns>
        [Method(RequestMethod.GET)]
        public IResponse Retrieve(IRequest request)
        {
            var id = request.GetParameter<ParameterId>()?.Value;
            if (string.IsNullOrWhiteSpace(id))
            {
                return new ResponseBadRequest(new StatusMessage("Missing form id."));
            }

            try
            {
                using var context = CreateContext();
                var catalog = RetrieveCatalog(context, request);
                var item = RetrieveItem(id, context, request);

                if (item is null)
                {
                    return new ResponseNotFound(new StatusMessage($"Form '{id}' not found."));
                }

                var result = new RestApiFormEditorResult
                {
                    Catalog = catalog,
                    Data = item
                };

                return result.ToResponse();
            }
            catch (Exception ex)
            {
                return new ResponseBadRequest(new StatusMessage($"Error processing request. {ex}"));
            }
        }

        /// <summary>
        /// Processes PUT requests for a single form structure. Deserializes the
        /// incoming JSON body into a <see cref="RestApiFormEditorItem"/> and
        /// hands it to <see cref="UpdateItem"/> for persistence.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The response carrying the saved (typically version-incremented) form structure.</returns>
        [Method(RequestMethod.PUT)]
        public IResponse Update(IRequest request)
        {
            var id = request.GetParameter<ParameterId>()?.Value;
            if (string.IsNullOrWhiteSpace(id))
            {
                return new ResponseBadRequest(new StatusMessage("Missing form id."));
            }

            try
            {
                if (request is not Request requestData || requestData.Content is null || requestData.Content.Length == 0)
                {
                    return new ResponseBadRequest(new StatusMessage("Missing request body."));
                }

                var bodyString = Encoding.UTF8.GetString(requestData.Content);
                var incoming = JsonSerializer.Deserialize<RestApiFormEditorItem>(bodyString, _jsonOptions);

                if (incoming is null)
                {
                    return new ResponseBadRequest(new StatusMessage("Invalid or empty JSON payload."));
                }

                using var context = CreateContext();
                var saved = UpdateItem(id, incoming, context, request);

                var result = new RestApiFormEditorResult
                {
                    Data = saved
                };

                return result.ToResponse();
            }
            catch (Exception ex)
            {
                return new ResponseBadRequest(new StatusMessage($"Error processing request. {ex}"));
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
        /// Retrieves a catalog of form editor field items based on the specified query context and request parameters.
        /// </summary>
        /// <param name="context">
        /// The query context that provides information about the current data retrieval operation. Cannot be null.
        /// </param>
        /// <param name="request">
        /// The request containing parameters that influence which catalog items are retrieved. Cannot be null.
        /// </param>
        /// <returns>
        /// An enumerable collection of catalog field items that match the specified context and request. The 
        /// collection may be empty if no items are found.
        /// </returns>
        protected abstract IEnumerable<RestApiFormEditorFieldItem> RetrieveCatalog(IQueryContext context, IRequest request);

        /// <summary>
        /// Retrieves the form structure that corresponds to the given form id.
        /// Subclasses load the structure from their persistence layer.
        /// </summary>
        /// <param name="formId">
        /// The id of the form to load. Never null or whitespace.
        /// </param>
        /// <param name="context">
        /// The context in which the query is executed.
        /// </param>
        /// <param name="request">
        /// The request that provides the operational context.
        /// </param>
        /// <returns>
        /// The form structure, or <c>null</c> if no form with the given id exists.
        /// </returns>
        protected abstract RestApiFormEditorItem RetrieveItem(string formId, IQueryContext context, IRequest request);

        /// <summary>
        /// Persists the supplied form structure under the given form id.
        /// Subclasses are expected to validate, store and (typically) increment
        /// the structural version, returning the resulting item.
        /// </summary>
        /// <param name="formId">
        /// The id of the form to update. Never null or whitespace.
        /// </param>
        /// <param name="item">
        /// The deserialized form structure sent by the client. Field and group
        /// children are already resolved to their concrete subtypes via the
        /// <c>kind</c> discriminator.
        /// </param>
        /// <param name="context">
        /// The context in which the query is executed.
        /// </param>
        /// <param name="request">
        /// The request that provides the operational context.
        /// </param>
        /// <returns>
        /// The saved form structure that is sent back to the client.
        /// </returns>
        protected abstract RestApiFormEditorItem UpdateItem(string formId, RestApiFormEditorItem item, IQueryContext context, IRequest request);
    }
}
