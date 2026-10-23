using System;
using System.Collections.Generic;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;
using WebExpress.WebCore.WebStatusPage;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Provides an abstract base class for the endpoint behind a graph viewer.
    /// It answers GET with the nodes and the edges of one graph.
    /// </summary>
    /// <remarks>
    /// The nodes and the edges are retrieved separately, because they usually
    /// come from different places: the nodes from the entities themselves and
    /// the edges from the relations between them. A source that has both at hand
    /// overrides <see cref="Retrieve(IRequest)"/> instead.
    /// </remarks>
    public abstract class RestApiGraph : IRestApi
    {
        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        protected RestApiGraph()
        {
        }

        /// <summary>
        /// Handles GET requests and returns the graph the viewer renders.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The response carrying the nodes and the edges.</returns>
        [Method(RequestMethod.GET)]
        public virtual IResponse Retrieve(IRequest request)
        {
            try
            {
                return new RestApiGraphResult()
                {
                    Nodes = RetrieveNodes(request),
                    Edges = RetrieveEdges(request)
                }
                    .ToResponse();
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "error processing get request.");
            }
        }

        /// <summary>
        /// Retrieves the nodes of the graph.
        /// </summary>
        /// <param name="request">The current request.</param>
        /// <returns>
        /// The nodes. An empty result renders an empty canvas, which is a valid
        /// graph rather than an error.
        /// </returns>
        protected virtual IEnumerable<RestApiGraphNode> RetrieveNodes(IRequest request)
        {
            // return empty by default
            return [];
        }

        /// <summary>
        /// Retrieves the edges of the graph.
        /// </summary>
        /// <param name="request">The current request.</param>
        /// <returns>
        /// The edges. An edge is drawn only when both of its endpoints are among
        /// the nodes, so a partially loaded relation never produces a dangling
        /// connector.
        /// </returns>
        protected virtual IEnumerable<RestApiGraphEdge> RetrieveEdges(IRequest request)
        {
            // return empty by default
            return [];
        }
    }
}
