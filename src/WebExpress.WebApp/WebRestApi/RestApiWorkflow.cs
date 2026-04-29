using System;
using System.Collections.Generic;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebParameter;
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
            var id = request.GetParameter<ParameterId>()?.Value;
            if (string.IsNullOrWhiteSpace(id))
            {
                return new ResponseBadRequest(new StatusMessage("Missing workflow id."));
            }

            using var context = CreateContext();

            try
            {
                var workflow = Retrieve(id, context, request);

                return new RestApiWorkflowResult()
                {
                    Id = workflow?.Id,
                    Name = workflow?.Name,
                    Description = workflow?.Description,
                    Version = workflow?.Version,
                    States = RetrieveStates(id, context, request),
                    Transitions = RetrieveTransitions(id, context, request),
                    Guards = RetrieveGuards(id, context, request),
                    PostFunctions = RetrievePostFunctions(id, context, request),
                    Validations = RetrieveValidations(id, context, request)
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
        /// Retrieves the workflow identified by the specified identifier, including its
        /// associated states and transitions.
        /// </summary>
        /// <param name="workflowId">
        /// The unique identifier of the workflow to retrieve.
        /// </param>
        /// <param name="context">
        /// The query context providing access to the underlying data store. Cannot be null.
        /// </param>
        /// <param name="request">
        /// The current API request. Cannot be null.
        /// </param>
        /// <returns>
        /// A <see cref="RestApiWorkflowResult"/> representing the workflow, or <c>null</c>
        /// when no matching workflow exists.
        /// </returns>
        protected virtual RestApiWorkflowResult Retrieve(string workflowId, IQueryContext context, IRequest request)
        {
            return new RestApiWorkflowResult();
        }

        /// <summary>
        /// Retrieves the collection of workflow states associated with the specified request.
        /// </summary>
        /// <param name="workflowId">
        /// The unique identifier of the workflow whose states are to be retrieved.
        /// </param>
        /// <param name="context">
        /// The query context providing access to the underlying data store. Cannot be null.
        /// </param>
        /// <param name="request">
        /// The request for which to retrieve workflow states. Must not be null.
        /// </param>
        /// <returns>
        /// An enumerable collection of workflow states for the specified request. Returns 
        /// an empty collection if no states are available.
        /// </returns>
        protected virtual IEnumerable<RestApiWorkflowState> RetrieveStates(string workflowId, IQueryContext context, IRequest request)
        {
            // return empty by default
            return [];
        }

        /// <summary>
        /// Retrieves the collection of workflow transitions available for the specified request.
        /// </summary>
        /// <param name="workflowId">
        /// The unique identifier of the workflow whose states are to be retrieved.
        /// </param>
        /// <param name="context">
        /// The query context providing access to the underlying data store. Cannot be null.
        /// </param>
        /// <param name="request">
        /// The request for which to retrieve workflow transitions. Cannot be null.
        /// </param>
        /// <returns>
        /// An enumerable collection of workflow transitions associated with the request. Returns 
        /// an empty collection if no transitions are available.
        /// </returns>
        protected virtual IEnumerable<RestApiWorkflowTransition> RetrieveTransitions(string workflowId, IQueryContext context, IRequest request)
        {
            // return empty by default
            return [];
        }

        /// <summary>
        /// Retrieves the collection of validators to be applied for the specified workflow operation.
        /// </summary>
        /// <param name="workflowId">
        /// The unique identifier of the workflow operation for which validations are requested.
        /// </param>
        /// <param name="context">
        /// The query context that provides access to data and services relevant to the validation process.
        /// </param>
        /// <param name="request">
        /// The request object containing details about the current API request.
        /// </param>
        /// <returns>
        /// An enumerable collection of <see cref="RestApiWorkflowValidator"/> instances representing the 
        /// validations to apply. The collection may be empty if no validations are required.
        /// </returns>
        protected virtual IEnumerable<RestApiWorkflowValidator> RetrieveValidations(string workflowId, IQueryContext context, IRequest request)
        {
            // return empty by default
            return [];
        }

        /// <summary>
        /// Retrieves the collection of post functions associated with the specified identifier.
        /// </summary>
        /// <param name="workflowId">
        /// The unique identifier for which to retrieve post functions.
        /// </param>
        /// <param name="context">
        /// The query context that provides access to data and services required for retrieval.
        /// </param>
        /// <param name="request">
        /// The request information relevant to the retrieval operation.
        /// </param>
        /// <returns>
        /// An enumerable collection of post functions associated with the specified identifier. Returns 
        /// an empty collection if no post functions are found.
        /// </returns>
        protected virtual IEnumerable<RestApiWorkflowPostFunction> RetrievePostFunctions(string workflowId, IQueryContext context, IRequest request)
        {
            // return empty by default
            return [];
        }

        /// <summary>
        /// Retrieves the collection of workflow guards associated with the specified workflow.
        /// </summary>
        /// <param name="workflowId">
        /// The unique identifier of the workflow for which to retrieve guards.
        /// </param>
        /// <param name="context">
        /// The query context that provides access to relevant data and services during guard retrieval.
        /// </param>
        /// <param name="request">
        /// The request object containing details about the current API operation.
        /// </param>
        /// <returns>
        /// An enumerable collection of <see cref="RestApiWorkflowGuard"/> instances representing the guards 
        /// for the specified workflow. Returns an empty collection if no guards are defined.
        /// </returns>
        protected virtual IEnumerable<RestApiWorkflowGuard> RetrieveGuards(string workflowId, IQueryContext context, IRequest request)
        {
            // return empty by default
            return [];
        }
    }
}