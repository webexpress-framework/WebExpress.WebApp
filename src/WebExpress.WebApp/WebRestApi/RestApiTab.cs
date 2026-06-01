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
    /// Abstract class providing tab responses for REST API.
    /// </summary>
    /// <typeparam name="TIndexItem">Type of the index item.</typeparam>
    public abstract class RestApiTab<TIndexItem> : IRestApi
        where TIndexItem : IIndexItem
    {
        /// <summary>
        /// Gets or sets the title associated with the current object.
        /// </summary>
        public string Title { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        protected RestApiTab()
        {
            // read attributes once
            Title = GetType().CustomAttributes
                .Where(x => x is not null && x.AttributeType == typeof(TitleAttribute))
                .Select(x => x.ConstructorArguments.FirstOrDefault().Value?.ToString())
                .FirstOrDefault();
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
                var items = RetrieveViews(context, request);

                var result = new RestApiTabResult()
                {
                    //Title = I18N.Translate(request, Title),
                    Views = items
                };

                return result.ToResponse();
            }
            catch (Exception ex)
            {
                return new ResponseBadRequest(new StatusMessage($"Error processing request.{ex}"));
            }
        }

        /// <summary>
        /// Handles POST requests to create a new tab.
        /// </summary>
        /// <param name="request">The incoming REST request containing JSON with at least 'label' or 'name'</param>
        /// <returns>
        /// The created RestApiTabView, or an error response.
        /// </returns>
        [Method(RequestMethod.POST)]
        public IResponse Create(IRequest request)
        {
            using var context = CreateContext();

            try
            {
                var templateId = ExtractTemplateId(request);

                // persist or sync content
                var newView = CreateView(context, request, templateId);

                var data = new
                {
                    newTab = newView,
                };

                // response corresponds to the JS mock (single new tab)
                var jsonData = JsonSerializer.Serialize(data, new JsonSerializerOptions { WriteIndented = true, PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
                var content = System.Text.Encoding.UTF8.GetBytes(jsonData);

                return new ResponseCreated
                {
                    Content = content
                }
                    .AddHeaderContentType("application/json");
            }
            catch (Exception ex)
            {
                return new ResponseBadRequest(new StatusMessage($"Error processing POST request: {ex.Message}"));
            }
        }

        /// <summary>
        /// Extracts the optional template id from request parameter or JSON request body.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The template id if provided; otherwise null.</returns>
        protected virtual string ExtractTemplateId(IRequest request)
        {
            var templateId = request?.GetParameter("templateId")?.Value;
            if (!string.IsNullOrWhiteSpace(templateId))
            {
                return templateId;
            }

            if (request is not Request typedRequest || typedRequest.Content is null || typedRequest.Content.Length == 0)
            {
                return null;
            }

            try
            {
                var json = Encoding.UTF8.GetString(typedRequest.Content);
                if (string.IsNullOrWhiteSpace(json))
                {
                    return null;
                }

                using var doc = JsonDocument.Parse(json);
                if (doc.RootElement.TryGetProperty("templateId", out var templateIdProperty))
                {
                    return templateIdProperty.GetString();
                }
            }
            catch
            {
                // ignore invalid json and continue without template id
            }

            return null;
        }

        /// <summary>
        /// Handles DELETE requests to remove a tab by id in the ?id=... query.
        /// </summary>
        /// <param name="request">The request specifying the tab id as query (?id=...)</param>
        /// <returns>HTTP 204 (Deleted) or 404 (Not found)</returns>
        [Method(RequestMethod.DELETE)]
        public IResponse Delete(IRequest request)
        {
            // parse view id from query (?id=...)
            var viewId = request.GetParameter("id")?.Value;

            if (string.IsNullOrWhiteSpace(viewId))
            {
                return new ResponseBadRequest(new StatusMessage("Missing id parameter for tab deletion."));
            }

            var removed = RemoveView(viewId);

            if (removed)
            {
                return new ResponseNoContent(); // HTTP 204
            }
            else
            {
                return new ResponseNotFound(new StatusMessage($"Tab with id='{viewId}' not found."));
            }
        }

        /// <summary>
        /// Handles PUT requests to persist a new tab order. The request body is
        /// expected to carry an <c>order</c> array of tab ids in their new
        /// sequence (sent by the client-side controller when tabs are
        /// reordered via drag and drop).
        /// </summary>
        /// <param name="request">The incoming REST request.</param>
        /// <returns>HTTP 204 (No Content) on success, otherwise an error response.</returns>
        [Method(RequestMethod.PUT)]
        public IResponse Update(IRequest request)
        {
            using var context = CreateContext();

            try
            {
                var order = ExtractOrder(request);
                if (order is null || order.Count == 0)
                {
                    return new ResponseBadRequest(new StatusMessage("Missing order payload for tab reordering."));
                }

                var reordered = ReorderViews(order, context, request);

                return reordered
                    ? new ResponseNoContent()
                    : new ResponseBadRequest(new StatusMessage("Tab reordering failed."));
            }
            catch (Exception ex)
            {
                return new ResponseBadRequest(new StatusMessage($"Error processing PUT request: {ex.Message}"));
            }
        }

        /// <summary>
        /// Extracts the ordered list of tab ids from the JSON request body's
        /// <c>order</c> array.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The ordered tab ids, or null when none are present.</returns>
        protected virtual IReadOnlyList<string> ExtractOrder(IRequest request)
        {
            if (request is not Request typedRequest || typedRequest.Content is null || typedRequest.Content.Length == 0)
            {
                return null;
            }

            try
            {
                var json = Encoding.UTF8.GetString(typedRequest.Content);
                if (string.IsNullOrWhiteSpace(json))
                {
                    return null;
                }

                using var doc = JsonDocument.Parse(json);
                if (doc.RootElement.TryGetProperty("order", out var orderProperty) && orderProperty.ValueKind == JsonValueKind.Array)
                {
                    var order = new List<string>();
                    foreach (var element in orderProperty.EnumerateArray())
                    {
                        var value = element.GetString();
                        if (!string.IsNullOrWhiteSpace(value))
                        {
                            order.Add(value);
                        }
                    }

                    return order;
                }
            }
            catch
            {
                // ignore invalid json
            }

            return null;
        }

        /// <summary>
        /// Persists a new tab order. Override this method in a derived class to
        /// implement custom reordering logic. The default implementation is a
        /// no-op that reports failure.
        /// </summary>
        /// <param name="order">The ordered list of tab ids in their new sequence.</param>
        /// <param name="context">
        /// The context in which the query is executed. Provides additional
        /// information or constraints for the operation. Cannot be null.
        /// </param>
        /// <param name="request">The incoming request.</param>
        /// <returns>
        /// <see langword="true"/> when the order was applied; otherwise
        /// <see langword="false"/>.
        /// </returns>
        protected virtual bool ReorderViews(IReadOnlyList<string> order, IQueryContext context, IRequest request)
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
        /// Retrieves the collection of tab views associated with the specified request.
        /// </summary>
        /// <param name="context">
        /// The context in which the query is executed. Provides additional information or constraints 
        /// for the retrieval operation. Cannot be null.
        /// </param>
        /// <param name="request">
        /// The request for which to retrieve tab views. Must not be null.
        /// </param>
        /// <returns>
        /// An enumerable collection of tab views for the specified request. Returns 
        /// an empty collection if no states are available.
        /// </returns>
        protected abstract IEnumerable<RestApiTabView> RetrieveViews(IQueryContext context, IRequest request);

        /// <summary>
        /// Creates a new instance of a REST API tab view based on the specified
        /// query context and request.
        /// </summary>
        /// <param name="context">
        /// The query context that provides information about the current state 
        /// and parameters of the query.
        /// </param>
        /// <param name="request">
        /// The request object containing details of the REST API call to be 
        /// represented in the view.
        /// </param>
        /// <returns>
        /// An object that implements the IRestApiTabView interface, representing 
        /// the created view for the specified request and context.
        /// </returns>
        protected virtual IRestApiTabView CreateView(IQueryContext context, IRequest request)
        {
            return null;
        }

        /// <summary>
        /// Creates a new instance of a REST API tab view and optionally applies a template id.
        /// </summary>
        /// <param name="context">The query context.</param>
        /// <param name="request">The request.</param>
        /// <param name="templateId">The optional template id from client request.</param>
        /// <returns>A tab view instance.</returns>
        protected virtual IRestApiTabView CreateView(IQueryContext context, IRequest request, string templateId)
        {
            var view = CreateView(context, request);

            if (!string.IsNullOrWhiteSpace(templateId) && view is RestApiTabView tabView)
            {
                tabView.TemplateId = templateId;
            }

            return view;
        }

        /// <summary>
        /// Removes the view with the specified ID from the collection of managed views.
        /// </summary>
        /// <remarks>
        /// Override this method in a derived class to implement custom view removal logic.
        /// </remarks>
        /// <param name="viewId">
        /// The unique identifier of the view to be removed. Must not be null or empty.
        /// </param>
        /// <returns>
        /// true if the view was successfully removed; otherwise, false.
        /// </returns>
        protected virtual bool RemoveView(string viewId)
        {
            return false;
        }
    }
}