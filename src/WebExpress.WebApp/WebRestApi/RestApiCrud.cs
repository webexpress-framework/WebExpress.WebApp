using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using WebExpress.WebApp.WebMessageQueue;
using WebExpress.WebCore;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebDomain;
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
        private readonly JsonSerializerOptions _options = new()
        {
            PropertyNameCaseInsensitive = true
        };

        /// <summary>
        /// Returns the collection of indexed items.
        /// </summary>
        public IEnumerable<TIndexItem> Data { get; protected set; } = [];

        /// <summary>
        /// Creates data (NEW).
        /// Handles HTTP POST and validates inputs before persisting.
        /// </summary>
        [Method(RequestMethod.POST)]
        public virtual IResponse Create(IRequest request)
        {
            var payload = GetPayload(request);
            if (payload is null)
            {
                return new ResponseBadRequest(new StatusMessage("Invalid or empty JSON payload."))
                    .AddHeaderContentType("application/json");
            }

            // validate request for creation; item is null for new resources
            var validationResult = Validate(default, payload, request);
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
                var result = Create(payload, request);

                if (result is null)
                {
                    return new ResponseBadRequest(new StatusMessage("Creation failed."));
                }

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
        public virtual IResponse Retrieve(IRequest request)
        {
            // extract 'id' parameter if present
            var id = request.GetParameter("id")?.Value ?? string.Empty;
            // current page number
            var pageNumber = Convert.ToInt32(request.GetParameter("p")?.Value ?? "0");
            // number of items per page
            var pageSize = Convert.ToInt32(request.GetParameter("s")?.Value ?? "50");

            if (string.IsNullOrEmpty(id))
            {
                var data = Data;

                // return all items
                return new RestApiCrudResultRetrieveMany<TIndexItem>()
                {
                    Data = data
                        .Skip(pageNumber * pageSize)
                        .Take(pageSize)
                }
                    .ToResponse();
            }

            try
            {
                var data = Data
                    .Where(x => x.Id.ToString().Equals(id, StringComparison.OrdinalIgnoreCase))
                    .FirstOrDefault();

                var result = new RestApiCrudResultRetrieve<TIndexItem>()
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
        public virtual IResponse Update(IRequest request)
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

            var payload = GetPayload(request);
            if (payload is null)
            {
                return new ResponseBadRequest(new StatusMessage("Invalid or empty JSON payload."))
                    .AddHeaderContentType("application/json");
            }

            // validate the update request using the existing item and the payload
            var validation = Validate(existingItem, payload, request);
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
                var result = Update(existingItem, payload, request);

                return result?.ToResponse();
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
        public virtual IRestApiValidationResult Validate(TIndexItem existingItem, RestApiCrudFormData payload, IRequest request)
        {
            // default: no validation errors
            return new RestApiValidationResult();
        }

        /// <summary>
        /// Persists the newly created resource.
        /// Override this method in derived classes to implement the actual
        /// persistence logic and return a result describing the creation.
        /// </summary>
        /// <param name="payload">
        /// The dynamic payload containing the fields required to create the resource.
        /// </param>
        /// <param name="request">
        /// The HTTP request providing additional context for the creation process.
        /// </param>
        /// <returns>
        /// A result object containing information about the create operation,
        /// including the created resource.
        /// </returns>

        protected virtual IRestApiCrudResultCreate Create(RestApiCrudFormData payload, IRequest request)
        {
            return new RestApiCrudResultCreate()
            {
                HideForm = true
            };
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
        public virtual IRestApiCrudResultUpdate Update(TIndexItem existingItem, RestApiCrudFormData payload, IRequest request)
        {
            return new RestApiCrudResultUpdate()
            {
                HideForm = true
            };
        }

        /// <summary>
        /// Deletes data.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The response containing the result of the operation.</returns>
        [Method(RequestMethod.DELETE)]
        public virtual IResponse Delete(IRequest request)
        {
            var id = request.GetParameter("id")?.Value;
            if (string.IsNullOrEmpty(id))
            {
                return new ResponseBadRequest(new StatusMessage("Missing 'id' parameter."));
            }

            var item = Data.FirstOrDefault
            (
                x => x.Id.ToString()
                    .Equals(id, StringComparison.OrdinalIgnoreCase)
            );

            if (item is null)
            {
                return new ResponseNotFound(new StatusMessage($"Item with id '{id}' not found."));
            }

            try
            {
                var result = Delete(item, request);

                if (item is IDomain domain)
                {
                    var messageQueueManager = WebEx.ComponentHub
                        .GetComponentManager<MessageQueueManager>();
                    var message = new Message("update");
                    var address = new AddressDomain(domain);

                    _ = messageQueueManager.SendAsync(address, message);
                }

                return result.ToResponse();
            }
            catch (Exception ex)
            {
                return new ResponseBadRequest
                (
                    new StatusMessage($"Error deleting resource: {ex.Message}")
                );
            }
        }

        /// <summary>
        /// Deletes the specified resource.
        /// Override this method in derived classes to implement the actual
        /// deletion logic.
        /// </summary>
        /// <param name="existingItem">
        /// The currently persisted item that is to be deleted.
        /// </param>
        /// <param name="request">
        /// The HTTP request providing additional context for the delete operation.
        /// </param>
        /// <returns>
        /// A result object containing information about the delete operation.
        /// </returns>
        public virtual IRestApiCrudResultDelete Delete(TIndexItem existingItem, IRequest request)
        {
            return new RestApiCrudResultDelete()
            {
                HideForm = true
            };
        }

        /// <summary>
        /// Parses the JSON content of the specified request into a Payload 
        /// object, returning an error response if the payload is invalid 
        /// or missing.
        /// </summary>
        /// <param name="request">
        /// The request containing the JSON content to be parsed into a 
        /// Payload object. The Content property should contain a valid 
        /// JSON string.
        /// </param>
        /// <returns>
        /// A Payload object representing the parsed JSON content if 
        /// successful; otherwise null.
        /// </returns>
        private RestApiCrudFormData GetPayload(IRequest request)
        {
            // parse JSON payload into a dynamic Payload structure
            var payload = default(RestApiCrudFormData);
            if (request is Request r && r.Content is not null)
            {
                try
                {
                    // deserialize raw JSON into a JsonElement first
                    var root = JsonSerializer.Deserialize<JsonElement>(r.Content, _options);

                    // convert JsonElement → Payload (recursive)
                    payload = root.ToPayload() as RestApiCrudFormData;
                }
                catch (JsonException)
                {
                    // JSON is malformed or cannot be parsed
                    return null;
                }
            }

            if (payload is null)
            {
                // payload is missing or empty
                return null;
            }

            return payload;
        }
    }
}