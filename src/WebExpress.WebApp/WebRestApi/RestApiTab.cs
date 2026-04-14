using System;
using System.Collections.Generic;
using System.Linq;
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
                // persist or sync content
                var newView = CreateView(context, request);

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