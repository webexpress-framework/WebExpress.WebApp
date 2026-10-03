using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.WebMessage;

namespace WebExpress.WebApp.Test
{
    /// <summary>
    /// Provides a minimal in-memory implementation of <see cref="RestApiPermission"/>
    /// used to exercise the base class's HTTP wiring, filtering, paging and
    /// sub-path routing.
    /// </summary>
    public sealed class TestRestApiPermission : RestApiPermission
    {
        private readonly List<RestApiPermissionItem> _assignments;
        private readonly IDictionary<string, RestApiPermissionGroup> _groups;
        private readonly IDictionary<string, RestApiPermissionPolicy> _policies;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="seed">Optional seed of pre-existing assignments.</param>
        /// <param name="groups">Optional directory of resolvable groups (id → record). When omitted, the seeded assignments themselves act as the directory.</param>
        /// <param name="policies">Optional directory of resolvable policies (id → record). When omitted, the seeded assignments themselves act as the directory.</param>
        public TestRestApiPermission(
            IEnumerable<RestApiPermissionItem> seed = null,
            IDictionary<string, RestApiPermissionGroup> groups = null,
            IDictionary<string, RestApiPermissionPolicy> policies = null)
        {
            // a group or policy may appear in several seeded pairs, so the
            // derived directories key by the first occurrence
            _assignments = seed?.ToList() ?? [];
            _groups = groups ?? _assignments
                .GroupBy(x => x.GroupId)
                .ToDictionary(x => x.Key, x => new RestApiPermissionGroup { Id = x.Key, Name = x.First().GroupName });
            _policies = policies ?? _assignments
                .GroupBy(x => x.PolicyId)
                .ToDictionary(x => x.Key, x => new RestApiPermissionPolicy { Id = x.Key, Name = x.First().PolicyName });
        }

        /// <summary>
        /// Gets the assignments currently held in memory.
        /// </summary>
        public IReadOnlyList<RestApiPermissionItem> Assignments => _assignments;

        /// <summary>
        /// Returns the current group-to-policy assignments of the resource
        /// addressed by the request.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The assignments.</returns>
        protected override IEnumerable<RestApiPermissionItem> RetrieveAssignments(IRequest request) => _assignments;

        /// <summary>
        /// Persists a group-to-policy assignment pair against the in-memory
        /// store; an already existing pair is returned unchanged.
        /// </summary>
        /// <param name="groupId">The id of the group to be assigned.</param>
        /// <param name="policyId">The id of the policy the group is assigned to.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>
        /// The persisted assignment, or <see langword="null"/> when the group
        /// or the policy cannot be resolved.
        /// </returns>
        protected override RestApiPermissionItem AddAssignment(string groupId, string policyId, IRequest request)
        {
            if (!_groups.TryGetValue(groupId, out var group) || !_policies.TryGetValue(policyId, out var policy))
            {
                return null;
            }

            var existing = _assignments.FirstOrDefault(x => x.GroupId == groupId && x.PolicyId == policyId);
            if (existing is not null)
            {
                return existing;
            }

            var assignment = new RestApiPermissionItem
            {
                GroupId = group.Id,
                GroupName = group.Name,
                PolicyId = policy.Id,
                PolicyName = policy.Name
            };

            _assignments.Add(assignment);
            return assignment;
        }

        /// <summary>
        /// Revokes an assignment pair.
        /// </summary>
        /// <param name="groupId">The id of the assigned group.</param>
        /// <param name="policyId">The id of the assigned policy.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>
        /// <see langword="true"/> when the assignment existed and was revoked.
        /// </returns>
        protected override bool RemoveAssignment(string groupId, string policyId, IRequest request)
        {
            var existing = _assignments.FirstOrDefault(x => x.GroupId == groupId && x.PolicyId == policyId);
            if (existing is null)
            {
                return false;
            }

            _assignments.Remove(existing);
            return true;
        }
    }
}
