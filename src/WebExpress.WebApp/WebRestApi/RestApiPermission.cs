using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;
using WebExpress.WebCore.WebStatusPage;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Abstract base class for a permission REST endpoint. It manages the
    /// group-to-policy assignments of a protected resource, following the
    /// identity model (Identity -> Group -> Policy -> Permission): the
    /// concrete endpoint decides which resource the assignments belong to,
    /// typically through its route.
    ///
    /// The stored unit stays the pair (group, policy), which is what identity
    /// management persists, while the wire surface is group shaped: one entry
    /// per group carrying all of its policies. The base class performs that
    /// projection, so an implementation only supplies and mutates pairs, and
    /// the surface can page over groups without splitting a group's policies
    /// across two pages.
    ///
    /// Unlike the index-backed endpoints, the assignment data originates from
    /// identity management (see <c>IIdentityManager</c>) rather than from a
    /// WebIndex, so the base class filters and pages the entries itself and the
    /// contract stays free of index queries.
    /// </summary>
    public abstract class RestApiPermission : IRestApi
    {
        private static readonly JsonSerializerOptions _jsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = true
        };

        /// <summary>
        /// Handles <c>GET {base}?q=…&amp;p=…&amp;l=…</c>: returns the filtered and
        /// paged entries together with the pre-paging total, so the pagination
        /// control can compute the page count.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The HTTP response.</returns>
        [Method(RequestMethod.GET)]
        public virtual IResponse Retrieve(IRequest request)
        {
            var pageNumber = request.ParseIntParameter("p", 0);
            var pageSize = request.ParseIntParameter("l", 10);
            var search = request.GetParameter("q")?.Value ?? string.Empty;

            try
            {
                // materialized once, because the full set feeds both the filter
                // chain and the assigned-group projection of the add row
                var entries = Project(RetrieveAssignments(request)).ToList();
                var filtered = Filter(search, entries, request).ToList();

                // clamp so a stale page request after removals still yields the last page
                var lastPage = Math.Max(0, (filtered.Count - 1) / Math.Max(1, pageSize));
                pageNumber = Math.Min(Math.Max(0, pageNumber), lastPage);

                return Json(new RestApiPermissionResult
                {
                    Items = [.. filtered
                        .Skip(pageNumber * Math.Max(1, pageSize))
                        .Take(Math.Max(1, pageSize))],
                    Total = filtered.Count,
                    AssignedGroupIds = [.. entries.Select(x => x.GroupId)]
                });
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "error processing get request.");
            }
        }

        /// <summary>
        /// Handles <c>POST {base}</c>: adds a group with an initial policy set.
        /// Posting a group that already carries policies reconciles it against
        /// the payload, so the operation is idempotent.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The HTTP response.</returns>
        [Method(RequestMethod.POST)]
        public virtual IResponse Create(IRequest request)
        {
            try
            {
                var segments = GetRelativeSegments(request);
                if (segments.Count != 0)
                {
                    return new ResponseNotFound();
                }

                var payload = GetPayload<RestApiPermissionPayload>(request);
                if (payload is null || string.IsNullOrWhiteSpace(payload.GroupId))
                {
                    return new ResponseBadRequest(new StatusMessage("missing or invalid payload."));
                }

                return Apply(payload.GroupId, payload.PolicyIds, request);
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "error processing post request.");
            }
        }

        /// <summary>
        /// Handles <c>PUT {base}/{groupId}</c>: replaces the policy set of the
        /// group, which is the write the inline editing of the policy chips
        /// performs.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The HTTP response.</returns>
        [Method(RequestMethod.PUT)]
        public virtual IResponse Update(IRequest request)
        {
            try
            {
                var segments = GetRelativeSegments(request);
                if (segments.Count != 1)
                {
                    return new ResponseNotFound();
                }

                var payload = GetPayload<RestApiPermissionPayload>(request);
                if (payload is null)
                {
                    return new ResponseBadRequest(new StatusMessage("missing or invalid payload."));
                }

                return Apply(segments[0], payload.PolicyIds, request);
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "error processing put request.");
            }
        }

        /// <summary>
        /// Handles <c>DELETE {base}/{groupId}</c>: revokes every policy the
        /// group carries, which removes its row from the surface.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The HTTP response.</returns>
        [Method(RequestMethod.DELETE)]
        public virtual IResponse Delete(IRequest request)
        {
            try
            {
                var segments = GetRelativeSegments(request);
                if (segments.Count != 1)
                {
                    return new ResponseNotFound();
                }

                var assigned = PoliciesOf(segments[0], request);
                if (assigned.Count == 0)
                {
                    return new ResponseNotFound();
                }

                foreach (var policyId in assigned)
                {
                    RemoveAssignment(segments[0], policyId, request);
                }

                return new ResponseNoContent();
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "error processing delete request.");
            }
        }

        /// <summary>
        /// Returns the current group-to-policy assignments of the resource
        /// addressed by the request. Grouping, filtering and paging happen in
        /// the base class, so the implementation returns the full set.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The assignments.</returns>
        protected abstract IEnumerable<RestApiPermissionItem> RetrieveAssignments(IRequest request);

        /// <summary>
        /// Persists a group-to-policy assignment. A group may carry several
        /// policies; persisting an already existing pair is idempotent and
        /// returns the existing assignment.
        /// </summary>
        /// <param name="groupId">The id of the group to be assigned.</param>
        /// <param name="policyId">The id of the policy the group is assigned to.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>
        /// The persisted assignment, or <see langword="null"/> when the group
        /// or the policy cannot be resolved.
        /// </returns>
        protected abstract RestApiPermissionItem AddAssignment(string groupId, string policyId, IRequest request);

        /// <summary>
        /// Revokes an assignment pair.
        /// </summary>
        /// <param name="groupId">The id of the assigned group.</param>
        /// <param name="policyId">The id of the assigned policy.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>
        /// <see langword="true"/> when the assignment existed and was revoked.
        /// </returns>
        protected abstract bool RemoveAssignment(string groupId, string policyId, IRequest request);

        /// <summary>
        /// Applies the free-text filter to the entries. The default matches the
        /// group name case-insensitively; an implementation may override this to
        /// match additional fields.
        /// </summary>
        /// <param name="search">The free-text filter, may be empty.</param>
        /// <param name="entries">The unfiltered entries.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The entries matching the filter.</returns>
        protected virtual IEnumerable<RestApiPermissionEntry> Filter(string search, IEnumerable<RestApiPermissionEntry> entries, IRequest request)
        {
            if (string.IsNullOrWhiteSpace(search))
            {
                return entries;
            }

            return entries.Where(x => (x.GroupName ?? string.Empty).Contains(search, StringComparison.OrdinalIgnoreCase));
        }

        /// <summary>
        /// Reconciles the stored pairs of a group against the requested policy
        /// set and answers with the resulting entry. The reconciliation is a
        /// difference rather than a delete-and-recreate, so an unchanged
        /// assignment is never revoked and re-granted.
        /// </summary>
        /// <param name="groupId">The id of the group.</param>
        /// <param name="policyIds">The requested policy set, may be empty.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The HTTP response.</returns>
        private IResponse Apply(string groupId, IEnumerable<string> policyIds, IRequest request)
        {
            var requested = (policyIds ?? [])
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Distinct()
                .ToList();

            var assigned = PoliciesOf(groupId, request);

            foreach (var policyId in assigned.Where(x => !requested.Contains(x)))
            {
                RemoveAssignment(groupId, policyId, request);
            }

            // a group the directory cannot resolve yields no assignment at all,
            // which is reported instead of answering with an empty entry
            var resolved = false;
            var groupName = (string)null;

            foreach (var policyId in requested)
            {
                var added = AddAssignment(groupId, policyId, request);
                if (added is not null)
                {
                    resolved = true;
                    groupName ??= added.GroupName;
                }
            }

            var entry = Project(RetrieveAssignments(request))
                .FirstOrDefault(x => x.GroupId == groupId);

            if (entry is null && !resolved)
            {
                return new ResponseNotFound();
            }

            return Json(entry ?? new RestApiPermissionEntry { GroupId = groupId, GroupName = groupName });
        }

        /// <summary>
        /// Returns the ids of the policies a group currently carries.
        /// </summary>
        /// <param name="groupId">The id of the group.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The policy ids.</returns>
        private List<string> PoliciesOf(string groupId, IRequest request)
        {
            return [.. (RetrieveAssignments(request) ?? [])
                .Where(x => x is not null && x.GroupId == groupId)
                .Select(x => x.PolicyId)
                .Distinct()];
        }

        /// <summary>
        /// Projects the flat pair list into one entry per group, preserving the
        /// order in which the groups first appear so the surface stays stable
        /// across requests.
        /// </summary>
        /// <param name="assignments">The assignments, may be null.</param>
        /// <returns>The entries.</returns>
        private static IEnumerable<RestApiPermissionEntry> Project(IEnumerable<RestApiPermissionItem> assignments)
        {
            return (assignments ?? [])
                .Where(x => x is not null && !string.IsNullOrWhiteSpace(x.GroupId))
                .GroupBy(x => x.GroupId)
                .Select(group => new RestApiPermissionEntry
                {
                    GroupId = group.Key,
                    GroupName = group.Select(x => x.GroupName).FirstOrDefault(x => !string.IsNullOrWhiteSpace(x)) ?? group.Key,
                    PolicyIds = [.. group
                        .Select(x => x.PolicyId)
                        .Where(x => !string.IsNullOrWhiteSpace(x))
                        .Distinct()]
                });
        }

        /// <summary>
        /// Returns the path segments of the request below the endpoint's
        /// base path.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The remaining segments.</returns>
        private static IReadOnlyList<string> GetRelativeSegments(IRequest request)
        {
            var path = request?.Uri?.PathSegments?
                .Select(x => x?.Value)
                .Where(x => !string.IsNullOrWhiteSpace(x) && x != "/")
                .ToList() ?? [];

            var basePath = request?.Uri?.BasePath?.PathSegments?
                .Select(x => x?.Value)
                .Where(x => !string.IsNullOrWhiteSpace(x) && x != "/")
                .ToList() ?? [];

            if (basePath.Count > 0 && path.Count >= basePath.Count)
            {
                var matches = true;
                for (var i = 0; i < basePath.Count; i++)
                {
                    if (!string.Equals(path[i], basePath[i], StringComparison.OrdinalIgnoreCase))
                    {
                        matches = false;
                        break;
                    }
                }

                if (matches)
                {
                    return path.Skip(basePath.Count).ToList();
                }
            }

            return path;
        }

        /// <summary>
        /// Tries to deserialize the request body into the requested payload
        /// type.
        /// </summary>
        /// <typeparam name="T">The payload type.</typeparam>
        /// <param name="request">The incoming request.</param>
        /// <returns>The payload, or <see langword="null"/> when missing or invalid.</returns>
        private static T GetPayload<T>(IRequest request)
            where T : class
        {
            if (request is not Request data || data.Content is null || data.Content.Length == 0)
            {
                return null;
            }

            try
            {
                return JsonSerializer.Deserialize<T>(data.Content, _jsonOptions);
            }
            catch (JsonException)
            {
                return null;
            }
        }

        /// <summary>
        /// Builds an <c>application/json</c> 200 response containing the
        /// serialized payload.
        /// </summary>
        /// <param name="payload">The payload to serialize.</param>
        /// <returns>The HTTP response.</returns>
        private static IResponse Json(object payload)
        {
            var json = JsonSerializer.Serialize(payload, _jsonOptions);

            return new ResponseOK
            {
                Content = Encoding.UTF8.GetBytes(json)
            }
                .AddHeaderContentType("application/json");
        }
    }
}
