using System;
using System.Collections.Generic;
using System.Text;
using System.Text.Json;
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
        private static readonly JsonSerializerOptions _jsonOptions = new()
        {
            WriteIndented = true
        };

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

                // a miss must not look like an empty workflow: the editor would
                // render a blank canvas and the user would have no way to tell
                // an unknown id from a workflow without states
                if (workflow is null)
                {
                    return new ResponseNotFound(new StatusMessage($"No workflow found for id '{id}'."));
                }

                return new RestApiWorkflowResult()
                {
                    Id = workflow.Id,
                    Name = workflow.Name,
                    State = workflow.State,
                    Description = workflow.Description,
                    Version = workflow.Version,
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
                return RestApiFault.BadRequest(request, ex, "Error processing request.");
            }
        }

        /// <summary>
        /// Processing of the resource that was called via the put request. The
        /// workflow editor autosaves its whole definition through this handler,
        /// so the payload mirrors the GET shape and the workflow id arrives as
        /// the same query parameter as on load.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The response containing the result of the operation.</returns>
        [Method(RequestMethod.PUT)]
        public virtual IResponse Update(IRequest request)
        {
            var id = request.GetParameter<ParameterId>()?.Value;
            if (string.IsNullOrWhiteSpace(id))
            {
                return new ResponseBadRequest(new StatusMessage("Missing workflow id."));
            }

            if (request is not Request requestData || requestData.Content is null || requestData.Content.Length == 0)
            {
                return new ResponseBadRequest(new StatusMessage("Missing request body."));
            }

            using var context = CreateContext();

            try
            {
                var bodyString = Encoding.UTF8.GetString(requestData.Content);
                var workflow = JsonSerializer.Deserialize<RestApiWorkflowResult>(bodyString, _jsonOptions);

                var current = Retrieve(id, context, request);
                if (current is null)
                {
                    return new ResponseNotFound(new StatusMessage($"No workflow found for id '{id}'."));
                }

                // optimistic concurrency: the editor autosaves, so two open
                // editors on the same workflow would otherwise overwrite each
                // other without either user noticing. A source that does not
                // version its workflows leaves Version empty and is unaffected.
                if (!string.IsNullOrEmpty(current.Version)
                    && !string.IsNullOrEmpty(workflow?.Version)
                    && !string.Equals(current.Version, workflow.Version, StringComparison.Ordinal))
                {
                    return new ResponseConflict(new StatusMessage
                        ($"The workflow '{id}' has been modified by someone else. Expected version '{workflow.Version}', found '{current.Version}'."));
                }

                Update(id, workflow, context, request);

                // the caller needs the version its next save has to present, so
                // the header is read back once the write went through
                var saved = Retrieve(id, context, request);
                var responseJson = JsonSerializer.Serialize(new { success = true, version = saved?.Version }, _jsonOptions);

                return new ResponseOK
                {
                    Content = Encoding.UTF8.GetBytes(responseJson)
                }
                    .AddHeaderContentType("application/json");
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "Error processing request.");
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
        /// when no matching workflow exists. Returning <c>null</c> makes the request
        /// answer with 404; it must not be used to express an empty workflow, which is
        /// a result with no states.
        /// </returns>
        /// <remarks>
        /// Set <see cref="RestApiWorkflowResult.Version"/> to opt the workflow into
        /// optimistic concurrency. The update handler then rejects a save that presents
        /// a stale version with 409 instead of letting it overwrite newer changes.
        /// </remarks>
        protected virtual RestApiWorkflowResult Retrieve(string workflowId, IQueryContext context, IRequest request)
        {
            return new RestApiWorkflowResult();
        }

        /// <summary>
        /// Persists the workflow definition delivered by the editor's autosave.
        /// The default implementation discards the payload, so a read-only
        /// workflow source needs no override.
        /// </summary>
        /// <param name="workflowId">
        /// The unique identifier of the workflow to update.
        /// </param>
        /// <param name="workflow">
        /// The workflow definition to persist, carrying the states and
        /// transitions in the same shape the GET request delivers.
        /// </param>
        /// <param name="context">
        /// The query context providing access to the underlying data store. Cannot be null.
        /// </param>
        /// <param name="request">
        /// The current API request. Cannot be null.
        /// </param>
        protected virtual void Update(string workflowId, RestApiWorkflowResult workflow, IQueryContext context, IRequest request)
        {
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