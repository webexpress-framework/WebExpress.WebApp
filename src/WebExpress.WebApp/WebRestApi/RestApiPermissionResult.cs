using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the paged assignment response of the permission endpoint.
    /// The total carries the count after filtering but before paging, so the
    /// client-side pager can compute the page count without a second request.
    /// </summary>
    public class RestApiPermissionResult
    {
        /// <summary>
        /// Gets or sets the assignments of the requested page.
        /// </summary>
        [JsonPropertyName("items")]
        public IEnumerable<RestApiPermissionItem> Items { get; set; }

        /// <summary>
        /// Gets or sets the total number of assignments matching the filter.
        /// </summary>
        [JsonPropertyName("total")]
        public int Total { get; set; }

        /// <summary>
        /// Gets or sets the (group, policy) pairs of all assignments,
        /// independent of the filter and the paging. The client uses this set
        /// to exclude already assigned pairs from the assign selects, which
        /// the paged items alone could not provide.
        /// </summary>
        [JsonPropertyName("assignedPairs")]
        public IEnumerable<RestApiPermissionPair> AssignedPairs { get; set; }
    }
}
