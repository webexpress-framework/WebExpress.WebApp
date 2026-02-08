using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text.Json;
using WebExpress.WebApp.WebAttribute;
using WebExpress.WebApp.WebMessageQueue;
using WebExpress.WebCore;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebDomain;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebParameter;
using WebExpress.WebCore.WebRestApi;
using WebExpress.WebCore.WebStatusPage;
using WebExpress.WebIndex;
using WebExpress.WebIndex.Queries;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Abstract class providing CRUD operations for REST API.
    /// </summary>
    /// <typeparam name="TIndexItem">Type of the index item.</typeparam>
    public abstract class RestApiCrud<TIndexItem> : IRestApiCrud
        where TIndexItem : IIndexItem
    {
        private readonly JsonSerializerOptions _options = new()
        {
            PropertyNameCaseInsensitive = true
        };

        /// <summary>
        /// Creates data (NEW).
        /// Handles HTTP POST and validates inputs before persisting.
        /// </summary>
        [Method(RequestMethod.POST)]
        public virtual IResponse Create(IRequest request)
        {
            // parse and validate incoming JSON
            var fieldMap = GetFieldMap(request);
            if (fieldMap is null)
            {
                return new ResponseBadRequest(new StatusMessage("Invalid or empty JSON payload."))
                    .AddHeaderContentType("application/json");
            }

            // optional id parameter (used for clone operations)
            var id = request.GetParameter<ParameterGuid>()?.Value;
            var query = new Query<TIndexItem>();

            if (!string.IsNullOrWhiteSpace(id))
            {
                query.WhereEquals(x => x.Id, Guid.Parse(id));
            }

            // retrieve existing item if id is provided
            using var context = CreateContext();
            var existingItem = id is not null
                ? Retrieve(query, context).FirstOrDefault()
                : default;

            // validate request (existingitem is null for new resources)
            var validationResult = Validate(existingItem, fieldMap, request);
            if (!validationResult.IsValid)
            {
                return new ResponseBadRequest
                {
                    Content = validationResult.ToJson()
                }
                .AddHeaderContentType("application/json");
            }

            try
            {
                // create or clone the resource
                var newItem = default(TIndexItem);
                var result = id is null
                    ? Create(fieldMap, request, out newItem)
                    : Clone(existingItem, fieldMap, request, out newItem);

                if (result is null)
                {
                    return new ResponseBadRequest(new StatusMessage("Creation failed."));
                }

                // notify domain listeners
                if (newItem is IDomain domain)
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
                return new ResponseBadRequest(
                    new StatusMessage($"Error creating resource: {ex.Message}")
                );
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
            try
            {
                // extract 'id' parameter if present
                var id = request.GetParameter<ParameterGuid>()?.Value ?? string.Empty;
                // current page number
                var pageNumber = Convert.ToInt32(request.GetParameter("p")?.Value ?? "0");
                // number of items per page
                var pageSize = Convert.ToInt32(request.GetParameter("s")?.Value ?? "50");
                var modeParam = request.GetParameter("mode")?.Value ?? "default";
                var mode = modeParam switch
                {
                    "new" => string.IsNullOrWhiteSpace(id)
                        ? RestApiCrudMode.Create
                        : RestApiCrudMode.Clone,
                    "edit" => RestApiCrudMode.Update,
                    "delete" => RestApiCrudMode.Delete,
                    _ => RestApiCrudMode.Default
                };
                var query = new Query<TIndexItem>();

                if (!string.IsNullOrWhiteSpace(id))
                {
                    query.WhereEquals(x => x.Id, Guid.Parse(id));
                }

                if (string.IsNullOrEmpty(id) && mode == RestApiCrudMode.Create)
                {
                    var result = RetrieveForCreate(request);

                    return result.ToResponse();
                }
                else if (!string.IsNullOrEmpty(id) && mode == RestApiCrudMode.Clone)
                {
                    var result = RetrieveForClone(query, request);

                    return result.ToResponse();
                }
                else if (!string.IsNullOrEmpty(id) && mode == RestApiCrudMode.Update)
                {
                    var result = RetrieveForUpdate(query, request);

                    return result.ToResponse();
                }
                else if (!string.IsNullOrEmpty(id) && mode == RestApiCrudMode.Delete)
                {
                    var result = RetrieveForDelete(query, request);

                    return result.ToResponse();
                }
                else if (string.IsNullOrEmpty(id))
                {
                    // paging
                    query.WithPaging(pageNumber * pageSize, pageSize);

                    using var context = CreateContext();
                    var data = Retrieve(query, context);

                    // return all items
                    return new RestApiCrudResultRetrieveMany()
                    {
                        Data = data.Select(x => ConvertToJson(x))
                    }
                        .ToResponse();
                }
                else
                {
                    return new ResponseBadRequest(new StatusMessage($"Error processing request."));
                }
            }
            catch (Exception ex)
            {
                return new ResponseBadRequest(new StatusMessage($"Error processing request.{ex}"));
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
        /// Retrieves a queryable collection of index items that match the specified query criteria.
        /// </summary>
        /// <param name="query">
        /// An object containing the query parameters used to filter and select index items. Cannot 
        /// be null.
        /// </param>
        /// <param name="context">
        /// The context in which the query is executed. Provides additional information or constraints 
        /// for the retrieval operation. Cannot be null.</param>
        /// <returns>
        /// A collection representing the filtered set of index items. 
        /// The collection may be empty if no items match the query.
        /// </returns>
        protected abstract IEnumerable<TIndexItem> Retrieve(IQuery<TIndexItem> query, IQueryContext context);

        /// <summary>
        /// Retrieves a result object containing default values and metadata for 
        /// creating a new item.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>
        /// A result instance representing the data and metadata required
        /// to initialize a new item for creation.
        /// </returns>
        protected virtual IRestApiCrudResultRetrieve RetrieveForCreate(IRequest request)
        {
            return RetrieveForCreate(request, null);
        }

        /// <summary>
        /// Retrieves the result object used to initialize a create operation in the REST API workflow.
        /// </summary>
        /// <param name="request">
        /// The current request context containing information about the HTTP request and user 
        /// environment.
        /// </param>
        /// <param name="title">
        /// An optional title to use for the result. If null, a default localized title is provided.
        /// </param>
        /// <returns>
        /// An <see cref="IRestApiCrudResultRetrieve"/> instance configured for the create operation.
        /// </returns>
        protected virtual IRestApiCrudResultRetrieve RetrieveForCreate(IRequest request, string title)
        {
            return new RestApiCrudResultRetrieve()
            {
                Title = I18N.Translate(request, title ?? "webexpress.webapp:create.title")
            };
        }

        /// <summary>
        /// Retrieves a result object containing default values and metadata for 
        /// cloning a item.
        /// </summary>
        /// <param name="query">
        /// An object containing the query parameters used to filter and select index items. Cannot 
        /// be null.
        /// </param>
        /// <param name="request">The request.</param>
        /// <returns>
        /// A result instance representing the data and metadata required
        /// to initialize a new item for creation.
        /// </returns>
        protected virtual IRestApiCrudResultRetrieve RetrieveForClone(IQuery<TIndexItem> query, IRequest request)
        {
            using var context = CreateContext();
            var data = Retrieve(query, context)
                .FirstOrDefault();

            return RetrieveForClone(request, data);
        }

        /// <summary>
        /// Creates a result object for retrieving data intended to be used as the basis for a 
        /// clone operation.
        /// </summary>
        /// <param name="request">
        /// The current request context, used for localization and other request-specific information.
        /// </param>
        /// <param name="data">
        /// The data item to be included in the result as the source for cloning.
        /// </param>
        /// <param name="title">
        /// An optional title to display for the clone operation. If null, a default localized title is used.
        /// </param>
        /// <returns>
        /// A result object containing the serialized data and a localized title for the clone operation.
        /// </returns>
        protected virtual IRestApiCrudResultRetrieve RetrieveForClone(IRequest request, TIndexItem data, string title = null)
        {
            return new RestApiCrudResultRetrieve()
            {
                Title = I18N.Translate(request, title ?? "webexpress.webapp:clone.title"),
                Data = ConvertToJson(data)
            };
        }

        /// <summary>
        /// Retrieves an item by its identifier for update operations.
        /// </summary>
        /// <param name="query">
        /// An object containing the query parameters used to filter and select index items. Cannot 
        /// be null.
        /// </param>
        /// <param name="request">The request.</param>
        /// <returns>
        /// A result instance representing the data and metadata required
        /// to initialize a new item for creation.
        /// </returns>
        protected virtual IRestApiCrudResultRetrieve RetrieveForUpdate(IQuery<TIndexItem> query, IRequest request)
        {
            using var context = CreateContext();
            var data = Retrieve(query, context)
                .FirstOrDefault();

            return RetrieveForUpdate(request, data);
        }

        /// <summary>
        /// Retrieves the specified item for update operations, preparing it for editing in the 
        /// API response.
        /// </summary>
        /// <param name="request">
        /// The current request context containing information about the API call. Cannot be null.
        /// </param>
        /// <param name="data">
        /// The item to be retrieved and prepared for update. Represents the data to be edited.
        /// </param>
        /// <param name="title">
        /// An optional title to use for the update operation. If null, a default localized title 
        /// is used.
        /// </param>
        /// <returns>
        /// A result object containing the item data and title, formatted for use in an 
        /// update (edit) operation.
        /// </returns>
        protected virtual IRestApiCrudResultRetrieve RetrieveForUpdate(IRequest request, TIndexItem data, string title = null)
        {
            return new RestApiCrudResultRetrieve()
            {
                Title = I18N.Translate(request, title ?? "webexpress.webapp:edit.title"),
                Data = ConvertToJson(data)
            };
        }

        /// <summary>
        /// Retrieves the item identified by the specified ID for the purpose of confirming 
        /// or preparing a delete operation.
        /// </summary>
        /// <param name="query">
        /// An object containing the query parameters used to filter and select index items. Cannot 
        /// be null.
        /// </param>
        /// <param name="request">The request.</param>
        /// <returns>
        /// A result instance representing the data and metadata required
        /// to initialize a new item for creation.
        /// </returns>
        protected virtual IRestApiCrudResultRetrieveDelete RetrieveForDelete(IQuery<TIndexItem> query, IRequest request)
        {
            using var context = CreateContext();
            var data = Retrieve(query, context)
                .FirstOrDefault();

            return RetrieveForDelete(request, data, null, data.Id.ToString());
        }

        /// <summary>
        /// Retrieves the specified item for delete operations, preparing the data and confirmation 
        /// details for the client.
        /// </summary>
        /// <param name="request">
        /// The current request context. Provides localization and user information for the 
        /// operation. Cannot be null.
        /// </param>
        /// <param name="data">
        /// The item to be retrieved and prepared for delete. Represents the data that will 
        /// be sent to the client.
        /// </param>
        /// <param name="title">
        /// An optional title to display for the delete operation. If null, a default localized 
        /// title is used.
        /// </param>
        /// <param name="confirm">
        /// The confirmation message to display to the user before proceeding with the delete.
        /// </param>
        /// <returns>
        /// An object containing the prepared data, title, and confirmation message for 
        /// the delete operation.
        /// </returns>
        protected virtual IRestApiCrudResultRetrieveDelete RetrieveForDelete(IRequest request, TIndexItem data, string title = null, string confirm = null)
        {
            return new RestApiCrudResultRetrieveDelete()
            {
                Title = I18N.Translate(request, title ?? "webexpress.webapp:delete.title"),
                Data = ConvertToJson(data),
                ConfirmItem = confirm,
            };
        }

        /// <summary>
        /// Updates data (EDIT).
        /// Handles HTTP PUT and validates inputs before applying the update.
        /// </summary>
        [Method(RequestMethod.PUT)]
        [Method(RequestMethod.PATCH)]
        public virtual IResponse Update(IRequest request)
        {
            // extract and validate the 'id' parameter
            var id = request.GetParameter<ParameterGuid>()?.Value;
            if (string.IsNullOrEmpty(id))
            {
                return new ResponseBadRequest(new StatusMessage("Missing 'id' parameter."));
            }

            var query = new Query<TIndexItem>()
                .WhereEquals(x => x.Id, Guid.Parse(id));

            // locate the existing item by Id
            using var context = CreateContext();
            var existingItem = Retrieve(query, context).FirstOrDefault();

            if (existingItem == null)
            {
                return new ResponseNotFound(new StatusMessage($"Item with id '{id}' not found."));
            }

            var fieldMap = GetFieldMap(request);
            if (fieldMap is null)
            {
                return new ResponseBadRequest(new StatusMessage("Invalid or empty JSON payload."))
                    .AddHeaderContentType("application/json");
            }

            // validate the update request using the existing item and the payload
            var validation = Validate(existingItem, fieldMap, request);
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
                var result = Update(existingItem, fieldMap, request);

                if (existingItem is IDomain domain)
                {
                    var messageQueueManager = WebEx.ComponentHub
                        .GetComponentManager<MessageQueueManager>();
                    var message = new Message("update");
                    var address = new AddressDomain(domain);

                    _ = messageQueueManager.SendAsync(address, message);
                }

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
        /// <param name="fieldMap">
        /// The dynamic payload containing updated fields.
        /// </param>
        /// <param name="request">
        /// The HTTP request providing additional context.
        /// </param>
        /// <returns>
        /// An IRestApiValidationResult indicating validation success or errors.
        /// </returns>
        protected virtual IRestApiValidationResult Validate(TIndexItem existingItem, RestApiCrudFormData fieldMap, IRequest request)
        {
            var result = fieldMap.Validate<TIndexItem>(request.Culture);

            return result;
        }

        /// <summary>
        /// Persists the newly created resource.
        /// Override this method in derived classes to implement the actual
        /// persistence logic and return a result describing the creation.
        /// </summary>
        /// <param name="fieldMap">
        /// The dynamic payload containing the fields required to create the resource.
        /// </param>
        /// <param name="request">
        /// The HTTP request providing additional context for the creation process.
        /// </param>
        /// <param name="newItem">
        /// When the method returns, contains the newly created index item,
        /// or the default value if creation was not successful.
        /// </param>
        /// A result object containing information about the create operation,
        /// including the created resource.
        /// </returns>
        protected virtual IRestApiCrudResultCreate Create(RestApiCrudFormData fieldMap, IRequest request, out TIndexItem newItem)
        {
            newItem = default;

            return new RestApiCrudResultCreate();
        }

        /// <summary>
        /// Persists the cloned resource.
        /// Override this method in derived classes to implement the actual
        /// persistence logic and return a result describing the creation.
        /// </summary>
        /// <param name="existingItem">
        /// The currently persisted item.
        /// </param>
        /// <param name="fieldMap">
        /// The dynamic payload containing the fields required to create the resource.
        /// </param>
        /// <param name="request">
        /// The HTTP request providing additional context for the creation process.
        /// </param>
        /// <param name="newItem">
        /// When the method returns, contains the newly created index item,
        /// or the default value if creation was not successful.
        /// </param>
        /// A result object containing information about the create operation,
        /// including the created resource.
        /// </returns>
        protected virtual IRestApiCrudResultCreate Clone(TIndexItem existingItem, RestApiCrudFormData fieldMap, IRequest request, out TIndexItem newItem)
        {
            newItem = default;

            return new RestApiCrudResultCreate();
        }

        /// <summary>
        /// Updates the data record.
        /// Derived classes should implement actual update logic here.
        /// </summary>
        /// <param name="existingItem">
        /// The currently persisted item.
        /// </param>
        /// <param name="payload">
        /// The dynamic payload containing updated fields.
        /// </param>
        /// <param name="request">
        /// The HTTP request providing additional context.
        /// </param>
        protected virtual IRestApiCrudResultUpdate Update(TIndexItem existingItem, RestApiCrudFormData fieldMap, IRequest request)
        {
            fieldMap.BindTo(existingItem);

            return new RestApiCrudResultUpdate()
            {
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

            var query = new Query<TIndexItem>()
                .WhereEquals(x => x.Id, Guid.Parse(id));

            using var context = CreateContext();
            var item = Retrieve(query, context).FirstOrDefault();

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
        protected virtual IRestApiCrudResultDelete Delete(TIndexItem existingItem, IRequest request)
        {
            return new RestApiCrudResultDelete()
            {
            };
        }

        /// <summary>
        /// Converts the specified index item to a dictionary representation suitable for JSON 
        /// serialization.
        /// </summary>
        /// <param name="source">
        /// The index item to convert. Cannot be null.
        /// </param>
        /// <returns>
        /// A dictionary containing the public property names and their corresponding values from the source object,
        /// suitable for JSON serialization; or null if the source is null.
        /// </returns>
        private static IDictionary<string, object> ConvertToJson(TIndexItem source)
        {
            if (source == null)
            {
                return null;
            }

            var result = new Dictionary<string, object>();
            var type = source.GetType();

            foreach (var prop in type.GetProperties(BindingFlags.Public | BindingFlags.Instance))
            {
                if (!prop.CanRead)
                {
                    continue;
                }

                var value = prop.GetValue(source);

                // look for RestConverter<T>
                var converterAttr = prop
                    .GetCustomAttributes(inherit: true)
                    .FirstOrDefault
                    (
                        a =>
                        a.GetType().IsGenericType &&
                        a.GetType().GetGenericTypeDefinition() == typeof(RestConverterAttribute<>)
                    );

                if (converterAttr != null)
                {
                    var converterType = (Type)converterAttr
                        .GetType()
                        .GetProperty(nameof(RestConverterAttribute<IRestValueConverter>.ConverterType))
                        .GetValue(converterAttr);

                    var converter = (IRestValueConverter)Activator.CreateInstance(converterType);

                    // convert to raw representation
                    var raw = converter.ToRaw(value, prop.PropertyType);

                    result[prop.Name] = raw;
                    continue;
                }

                // fallback
                result[prop.Name] = value;
            }

            return result;
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
        private RestApiCrudFormData GetFieldMap(IRequest request)
        {
            // parse JSON payload into a dynamic Payload structure
            var fieldMap = default(RestApiCrudFormData);
            var r = request as Request;

            if (r?.Content is null)
            {
                return null;
            }

            if (request.Header.ContentType?.Contains("application/json", StringComparison.OrdinalIgnoreCase) == true)
            {
                try
                {
                    // deserialize raw JSON into a JsonElement first
                    var root = JsonSerializer.Deserialize<JsonElement>(r.Content, _options);

                    // convert JsonElement → Payload (recursive)
                    fieldMap = root.ToFieldMap() as RestApiCrudFormData;
                }
                catch (JsonException)
                {
                    // JSON is malformed or cannot be parsed
                    return null;
                }
            }
            else if (request.Header.ContentType?.Contains("multipart/form-data", StringComparison.OrdinalIgnoreCase) == true)
            {
                fieldMap = [];

                foreach (var parameter in request.Parameters)
                {
                    fieldMap[parameter.Key.ToLower()] = parameter.Value;
                }
            }

            if (fieldMap is null)
            {
                // payload is missing or empty
                return null;
            }

            return fieldMap;
        }
    }
}