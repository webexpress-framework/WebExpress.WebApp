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
    /// typically through its route. An assignment is the pair (group,
    /// policy); a group may carry several policies, mirroring
    /// <c>IIdentityGroup.Policies</c>.
    ///
    /// Unlike the index-backed endpoints, the assignment data originates from
    /// identity management (see <c>IIdentityManager</c>) rather than from a
    /// WebIndex, so the base class filters and pages the assignment list
    /// itself and the contract stays free of index queries.
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
        /// paged assignments together with the pre-paging total, so the
        /// client-side pager can compute the page count.
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
                // chain and the assigned-group projection
                var assignments = (RetrieveAssignments(request) ?? []).ToList();
                var filtered = Filter(search, assignments, request).ToList();

                // clamp so a stale page request after removals still yields the last page
                var lastPage = Math.Max(0, (filtered.Count - 1) / Math.Max(1, pageSize));
                pageNumber = Math.Min(Math.Max(0, pageNumber), lastPage);

                var items = filtered
                    .Skip(pageNumber * Math.Max(1, pageSize))
                    .Take(Math.Max(1, pageSize))
                    .ToList();

                return Json(new RestApiPermissionResult
                {
                    Items = items,
                    Total = filtered.Count,
                    AssignedPairs = assignments
                        .Select(x => new RestApiPermissionPair { GroupId = x.GroupId, PolicyId = x.PolicyId })
                        .ToList()
                });
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "error processing get request.");
            }
        }

        /// <summary>
        /// Handles <c>POST {base}</c>: assigns a policy to a group. Assigning
        /// an already assigned pair is idempotent.
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
                if (payload is null || string.IsNullOrWhiteSpace(payload.GroupId) || string.IsNullOrWhiteSpace(payload.PolicyId))
                {
                    return new ResponseBadRequest(new StatusMessage("missing or invalid payload."));
                }

                var added = AddAssignment(payload.GroupId, payload.PolicyId, request);
                return added is null
                    ? new ResponseNotFound()
                    : Json(added);
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "error processing post request.");
            }
        }

        /// <summary>
        /// Handles <c>DELETE {base}/{groupId}/{policyId}</c>: revokes the
        /// assignment pair.
        /// </summary>
        /// <param name="request">The incoming request.</param>
        /// <returns>The HTTP response.</returns>
        [Method(RequestMethod.DELETE)]
        public virtual IResponse Delete(IRequest request)
        {
            try
            {
                var segments = GetRelativeSegments(request);
                if (segments.Count != 2)
                {
                    return new ResponseNotFound();
                }

                var removed = RemoveAssignment(segments[0], segments[1], request);
                return removed
                    ? new ResponseNoContent()
                    : new ResponseNotFound();
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "error processing delete request.");
            }
        }

        /// <summary>
        /// Returns the current group-to-policy assignments of the resource
        /// addressed by the request. Filtering and paging happen in the base
        /// class, so the implementation returns the full set.
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
        /// Applies the free-text filter to the assignments. The default
        /// matches the group and policy names case-insensitively; an
        /// implementation may override this to match additional fields.
        /// </summary>
        /// <param name="search">The free-text filter, may be empty.</param>
        /// <param name="assignments">The unfiltered assignments.</param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The assignments matching the filter.</returns>
        protected virtual IEnumerable<RestApiPermissionItem> Filter(string search, IEnumerable<RestApiPermissionItem> assignments, IRequest request)
        {
            if (string.IsNullOrWhiteSpace(search))
            {
                return assignments;
            }

            return assignments.Where(x =>
                (x.GroupName ?? string.Empty).Contains(search, StringComparison.OrdinalIgnoreCase) ||
                (x.PolicyName ?? string.Empty).Contains(search, StringComparison.OrdinalIgnoreCase));
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
