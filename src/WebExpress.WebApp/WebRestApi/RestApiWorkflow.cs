using System;
using System.Collections.Generic;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;
using WebExpress.WebCore.WebStatusPage;
using WebExpress.WebIndex.Queries;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Provides an abstract base class for implementing REST API workflows 
    /// that handle HTTP GET requests and return list-shaped payloads.
    /// </summary>
    public abstract class RestApiWorkflow : IRestApi
    {
        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        protected RestApiWorkflow()
        {
        }

        /// <summary>
        /// Processing of the resource that was called via the get request.
        /// Returns a list-shaped payload with items, title and pagination.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The response containing the result of the operation.</returns>
        [Method(RequestMethod.GET)]
        public virtual IResponse Retrieve(IRequest request)
        {
            using var context = CreateContext();

            try
            {
                return new RestApiWorkflowResult()
                {
                    States = RetrieveStates(request),
                    Transitions = RetrieveTransitions(request)
                }
                    .ToResponse();
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
        /// Retrieves the collection of workflow states associated with the specified request.
        /// </summary>
        /// <param name="request">
        /// The request for which to retrieve workflow states. Must not be null.
        /// </param>
        /// <returns>
        /// An enumerable collection of workflow states for the specified request. Returns 
        /// an empty collection if no states are available.
        /// </returns>
        public virtual IEnumerable<RestApiWorkflowState> RetrieveStates(IRequest request)
        {
            // return empty by default
            return [];
        }

        /// <summary>
        /// Retrieves the collection of workflow transitions available for the specified request.
        /// </summary>
        /// <param name="request">
        /// The request for which to retrieve workflow transitions. Cannot be null.
        /// </param>
        /// <returns>
        /// An enumerable collection of workflow transitions associated with the request. Returns 
        /// an empty collection if no transitions are available.
        /// </returns>
        public virtual IEnumerable<RestApiWorkflowTransition> RetrieveTransitions(IRequest request)
        {
            // return empty by default
            return [];
        }
    }
}