using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebIndex.Queries;

namespace WebExpress.WebApp.Test
{
    /// <summary>
    /// Provides a test implementation of the workflow REST API, backed by an
    /// in-memory store, so the lookup contract of the base class can be exercised
    /// end to end: an unknown id has to be distinguishable from a workflow without
    /// states, and a save that presents a stale version has to be rejected rather
    /// than silently overwrite a newer one.
    /// </summary>
    public class TestRestApiWorkflow : RestApiWorkflow
    {
        private readonly Dictionary<string, RestApiWorkflowResult> _workflows = [];
        private readonly Dictionary<string, List<RestApiWorkflowState>> _states = [];
        private readonly Dictionary<string, List<RestApiWorkflowTransition>> _transitions = [];

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        public TestRestApiWorkflow()
        {
        }

        /// <summary>
        /// Gets the payloads the update hook received, in the order they arrived.
        /// </summary>
        public List<RestApiWorkflowResult> Updates { get; } = [];

        /// <summary>
        /// Seeds the store with a workflow and its states and transitions.
        /// </summary>
        /// <param name="workflow">The workflow header.</param>
        /// <param name="states">The states of the workflow.</param>
        /// <param name="transitions">The transitions of the workflow.</param>
        public void Seed
        (
            RestApiWorkflowResult workflow,
            IEnumerable<RestApiWorkflowState> states = null,
            IEnumerable<RestApiWorkflowTransition> transitions = null
        )
        {
            _workflows[workflow.Id] = workflow;
            _states[workflow.Id] = [.. states ?? []];
            _transitions[workflow.Id] = [.. transitions ?? []];
        }

        /// <inheritdoc/>
        protected override RestApiWorkflowResult Retrieve(string workflowId, IQueryContext context, IRequest request)
        {
            return _workflows.TryGetValue(workflowId, out var workflow) ? workflow : null;
        }

        /// <inheritdoc/>
        protected override IEnumerable<RestApiWorkflowState> RetrieveStates(string workflowId, IQueryContext context, IRequest request)
        {
            return _states.TryGetValue(workflowId, out var states) ? states : [];
        }

        /// <inheritdoc/>
        protected override IEnumerable<RestApiWorkflowTransition> RetrieveTransitions(string workflowId, IQueryContext context, IRequest request)
        {
            return _transitions.TryGetValue(workflowId, out var transitions) ? transitions : [];
        }

        /// <inheritdoc/>
        protected override void Update(string workflowId, RestApiWorkflowResult workflow, IQueryContext context, IRequest request)
        {
            Updates.Add(workflow);

            if (!_workflows.TryGetValue(workflowId, out var stored))
            {
                return;
            }

            stored.Name = workflow?.Name ?? stored.Name;
            stored.Description = workflow?.Description ?? stored.Description;

            // a write advances the revision, which is what makes a concurrent
            // editor's next save conflict
            if (int.TryParse(stored.Version, out var revision))
            {
                stored.Version = (revision + 1).ToString();
            }

            _states[workflowId] = [.. workflow?.States ?? []];
            _transitions[workflowId] = [.. workflow?.Transitions ?? []];
        }
    }
}
