using WebExpress.WebApp.Test.Model;
using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebIndex.Queries;

namespace WebExpress.WebApp.Test
{
    /// <summary>
    /// Provides a minimal in-memory implementation of <see cref="RestApiAssignment{TIndexItem}"/>
    /// used to exercise the protocol of the base class: the answers, the status codes and
    /// that a rejected write leaves the assignment untouched.
    /// </summary>
    public sealed class TestRestApiAssignment : RestApiAssignment<TestIndexItem>
    {
        private readonly TestIndexItem _item;
        private readonly IDictionary<string, RestApiAssignmentItem> _directory;
        private readonly string _selfId;
        private readonly bool _mayChange;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="item">The addressed object, or <see langword="null"/> for an unknown one.</param>
        /// <param name="directory">The people that can be assigned (id → record).</param>
        /// <param name="selfId">The id of the caller, or <see langword="null"/> for an anonymous caller.</param>
        /// <param name="assigneeId">The id of the initial assignee, or <see langword="null"/>.</param>
        /// <param name="mayChange">Whether the caller may change the assignment.</param>
        public TestRestApiAssignment(TestIndexItem item, IDictionary<string, RestApiAssignmentItem> directory, string selfId, string assigneeId = null, bool mayChange = true)
        {
            _item = item;
            _directory = directory ?? new Dictionary<string, RestApiAssignmentItem>();
            _selfId = selfId;
            _mayChange = mayChange;
            AssigneeId = assigneeId;
        }

        /// <summary>
        /// Gets the id of the person the object is currently assigned to.
        /// </summary>
        public string AssigneeId { get; private set; }

        /// <summary>
        /// Gets or sets the reason a write is refused with, or <see langword="null"/> to
        /// accept every write.
        /// </summary>
        public string Refusal { get; set; }

        /// <summary>
        /// Returns the addressed object.
        /// </summary>
        /// <param name="context">The query context.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The object, or <see langword="null"/>.</returns>
        protected override TestIndexItem RetrieveItem(IQueryContext context, IRequest request) => _item;

        /// <summary>
        /// Returns the assignee of the object.
        /// </summary>
        /// <param name="item">The object.</param>
        /// <param name="context">The query context.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The assignee, or <see langword="null"/>.</returns>
        protected override RestApiAssignmentItem RetrieveAssignee(TestIndexItem item, IQueryContext context, IRequest request)
            => AssigneeId is not null && _directory.TryGetValue(AssigneeId, out var assignee) ? assignee : null;

        /// <summary>
        /// Returns the caller.
        /// </summary>
        /// <param name="context">The query context.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The caller, or <see langword="null"/>.</returns>
        protected override RestApiAssignmentItem RetrieveSelf(IQueryContext context, IRequest request)
            => _selfId is not null && _directory.TryGetValue(_selfId, out var self) ? self : null;

        /// <summary>
        /// Returns whether the caller may change the assignment.
        /// </summary>
        /// <param name="item">The object.</param>
        /// <param name="context">The query context.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The configured right.</returns>
        protected override bool MayChange(TestIndexItem item, IQueryContext context, IRequest request) => _mayChange;

        /// <summary>
        /// Stores the new assignee.
        /// </summary>
        /// <param name="item">The object.</param>
        /// <param name="userId">The id of the new assignee.</param>
        /// <param name="context">The query context.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns><see langword="false"/> when the person is unknown.</returns>
        protected override bool Assign(TestIndexItem item, string userId, IQueryContext context, IRequest request)
        {
            if (Refusal is not null)
            {
                throw new RestApiRefusal(Refusal);
            }

            if (!_directory.ContainsKey(userId))
            {
                return false;
            }

            AssigneeId = userId;
            return true;
        }

        /// <summary>
        /// Removes the assignee.
        /// </summary>
        /// <param name="item">The object.</param>
        /// <param name="context">The query context.</param>
        /// <param name="request">The incoming request.</param>
        protected override void Unassign(TestIndexItem item, IQueryContext context, IRequest request)
        {
            if (Refusal is not null)
            {
                throw new RestApiRefusal(Refusal);
            }

            AssigneeId = null;
        }
    }
}
