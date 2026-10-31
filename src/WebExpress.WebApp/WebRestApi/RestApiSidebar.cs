using System;
using System.Collections.Generic;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;
using WebExpress.WebCore.WebStatusPage;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// A REST API endpoint that supplies the navigation tree of a data bound
    /// sidebar (wx-webapp-sidebar). A concrete endpoint overrides
    /// <see cref="RetrieveItems"/> to return its items, which may be links,
    /// headers or dividers, carry badges and nest into collapsible groups.
    /// </summary>
    public class RestApiSidebar : IRestApi
    {
        /// <summary>
        /// Gets or sets the title associated with the endpoint.
        /// </summary>
        public string Title { get; protected set; }

        /// <summary>
        /// Handles get requests to retrieve the current navigation tree.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>A response carrying the navigation tree.</returns>
        [Method(RequestMethod.GET)]
        public IResponse Retrieve(IRequest request)
        {
            try
            {
                var result = new RestApiSidebarResult()
                {
                    Items = RetrieveItems(request)
                };

                return result.ToResponse();
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "error processing get request.");
            }
        }

        /// <summary>
        /// Retrieves the top level navigation items. The default implementation
        /// returns an empty tree, so an endpoint only overrides what it needs.
        /// </summary>
        /// <param name="request">The request context used to build the tree.</param>
        /// <returns>The top level items, empty when none are available.</returns>
        protected virtual IEnumerable<RestApiSidebarItem> RetrieveItems(IRequest request)
        {
            return [];
        }
    }
}
