using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;
using WebExpress.WebCore.WebStatusPage;
using WebExpress.WebIndex;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Abstract class providing CRUD operations for REST API.
    /// </summary>
    /// <typeparam name="TIndexItem">Type of the index item.</typeparam>
    public abstract class RestApiCrud<TIndexItem> : IRestApiCrud<TIndexItem>
        where TIndexItem : IIndexItem
    {
        JsonSerializerOptions options = new JsonSerializerOptions() { PropertyNameCaseInsensitive = true };

        /// <summary>
        /// Returns the collection of indexed items.
        /// </summary>
        public IEnumerable<TIndexItem> Data { get; protected set; } = [];

        /// <summary>
        /// Creates data (NEW).
        /// Handles HTTP POST and validates inputs before persisting.
        /// </summary>
        [Method(RequestMethod.POST)]
        public virtual Response CreateData(Request request)
        {
            // validate request for creation; item is null for new resources
            var validationResult = ValidateData(default(TIndexItem), null, request);
            if (!validationResult.IsValid)
            {
                return new ResponseBadRequest()
                {
                    Content = validationResult.ToJson()
                }
                .AddHeaderContentType("application/json");
            }

            try
            {
                // persist creation - derived class implements actual persistence and returns created item
                var created = PersistCreateData(null, request);

                if (created == null)
                {
                    return new ResponseBadRequest(new StatusMessage("Creation failed."));
                }

                var result = new RestApiCrudResult<TIndexItem>()
                {
                    Data = created
                };

                return result.ToResponse();
            }
            catch (Exception ex)
            {
                return new ResponseBadRequest(new StatusMessage($"Error creating resource: {ex.Message}"));
            }
        }

        /// <summary>
        /// Processing of the resource that was called via the get request.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The response containing the result of the operation.</returns>
        [Method(RequestMethod.GET)]
        public virtual Response Retrieve(Request request)
        {
            var id = request.GetParameter("id")?.Value ?? string.Empty;

            try
            {
                var data = Data
                    .Where(x => x.Id.ToString().Equals(id, StringComparison.OrdinalIgnoreCase))
                    .FirstOrDefault();

                var result = new RestApiCrudResult<TIndexItem>()
                {
                    Data = data
                };

                return result.ToResponse();
            }
            catch (Exception ex)
            {
                return new ResponseBadRequest(new StatusMessage($"Error processing request.{ex}"));
            }
        }

        /// <summary>
        /// Updates data (EDIT).
        /// Handles HTTP PUT and validates inputs before applying the update.
        /// </summary>
        [Method(RequestMethod.PUT)]
        public virtual Response UpdateData(Request request)
        {
            // extract and validate the 'id' parameter
            var id = request.GetParameter("id")?.Value;
            if (string.IsNullOrEmpty(id))
            {
                return new ResponseBadRequest(new StatusMessage("Missing 'id' parameter."));
            }

            // locate the existing item by ID
            var existingItem = Data.FirstOrDefault(x =>
                x.Id.ToString().Equals(id, StringComparison.OrdinalIgnoreCase));

            if (existingItem == null)
            {
                return new ResponseNotFound(new StatusMessage($"Item with id '{id}' not found."));
            }

            // parse JSON payload into a dynamic Payload structure
            var payload = default(Payload);

            if (request.Content is not null)
            {
                try
                {
                    // deserialize raw JSON into a JsonElement first
                    var root = JsonSerializer.Deserialize<JsonElement>(request.Content, options);

                    // convert JsonElement → Payload (recursive)
                    payload = root.ToPayload() as Payload;
                }
                catch (JsonException)
                {
                    // JSON is malformed or cannot be parsed
                    return new ResponseBadRequest(new StatusMessage("Invalid JSON payload."))
                        .AddHeaderContentType("application/json");
                }
            }

            if (payload is null)
            {
                // payload is missing or empty
                return new ResponseBadRequest(new StatusMessage("Invalid or empty JSON payload."))
                    .AddHeaderContentType("application/json");
            }

            // validate the update request using the existing item and the payload
            var validation = ValidateData(existingItem, payload, request);
            if (!validation.IsValid)
            {
                // Validation failed → return structured error response
                return new ResponseBadRequest()
                {
                    Content = validation.ToJson()
                }.AddHeaderContentType("application/json");
            }

            // apply the update (implemented by derived classes)
            try
            {
                UpdateData(existingItem, payload, request);
                return new ResponseOK();
            }
            catch (Exception ex)
            {
                // any exception during update is treated as a bad request
                return new ResponseBadRequest(new StatusMessage($"Error updating resource: {ex.Message}"));
            }
        }

        /// <summary>
        /// Validate the data for create or update operations. When creating, existingItem will 
        /// be null and proposedItem contains the values to create. When updating, existingItem 
        /// is the currently persisted entity and proposedItem contains the incoming values to 
        /// validate. Override in derived classes to implement specific validation rules.
        /// </summary>
        /// <param name="existingItem">
        /// The currently persisted item (null for create).
        /// </param>
        /// <param name="payload">
        /// The dynamic payload containing updated fields.
        /// </param>
        /// <param name="request">
        /// The HTTP request providing additional context.
        /// </param>
        /// <returns>
        /// An IRestApiValidationResult indicating validation success or errors.
        /// </returns>
        public virtual IRestApiValidationResult ValidateData(TIndexItem existingItem, Payload payload, Request request)
        {
            // default: no validation errors
            return new RestApiValidationResult();
        }

        /// <summary>
        /// Persists the newly created resource.
        /// Override in derived classes to implement actual persistence and return the created item.
        /// </summary>
        /// <param name="payload">
        /// The dynamic payload containing updated fields.
        /// </param>
        /// <param name="request">
        /// The HTTP request providing additional context.
        /// </param>
        /// <returns>
        /// The created item or null on failure.
        /// </returns>
        protected virtual TIndexItem PersistCreateData(Payload payload, Request request)
        {
            // default: not implemented - derived classes must override
            throw new NotImplementedException("PersistCreateData must be implemented in the derived class to create the resource.");
        }

        /// <summary>
        /// Updates the data record.
        /// Derived classes should implement actual update logic here.
        /// </summary>
        /// <param name="existingItem">
        /// The currently persisted item (null for create).
        /// </param>
        /// <param name="payload">
        /// The dynamic payload containing updated fields.
        /// </param>
        /// <param name="request">
        /// The HTTP request providing additional context.
        /// </param>
        public virtual void UpdateData(TIndexItem existingItem, Payload payload, Request request)
        {
            // default: no-op - derived classes should override
        }

        /// <summary>
        /// Deletes data.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The response containing the result of the operation.</returns>
        [Method(RequestMethod.DELETE)]
        public virtual Response DeleteData(Request request)
        {
            var id = request.GetParameter("id")?.Value;
            if (string.IsNullOrEmpty(id))
            {
                return new ResponseBadRequest(new StatusMessage("Missing 'id' parameter."));
            }

            var item = Data.FirstOrDefault(x => x.Id.ToString().Equals(id, StringComparison.OrdinalIgnoreCase));
            if (item == null)
            {
                return new ResponseNotFound(new StatusMessage($"Item with id '{id}' not found."));
            }

            try
            {
                DeleteData(id, request);
                return new ResponseOK();
            }
            catch (Exception ex)
            {
                return new ResponseBadRequest(new StatusMessage($"Error deleting resource: {ex.Message}"));
            }
        }

        /// <summary>
        /// Deletes data.
        /// </summary>
        /// <param name="id">The id of the data to delete.</param>
        /// <param name="request">The request.</param>
        public virtual void DeleteData(string id, Request request)
        {
            // default: not implemented - derived classes must override to perform deletion
            throw new NotImplementedException();
        }
    }
}