using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the paged assignment response of the permission endpoint.
    /// The total carries the count after filtering but before paging, so the
    /// pagination control can compute the page count without a second request.
    /// </summary>
    public class RestApiPermissionResult
    {
        /// <summary>
        /// Gets or sets the entries of the requested page, one per group.
        /// </summary>
        [JsonPropertyName("items")]
        public IEnumerable<RestApiPermissionEntry> Items { get; set; }

        /// <summary>
        /// Gets or sets the total number of entries matching the filter.
        /// </summary>
        [JsonPropertyName("total")]
        public int Total { get; set; }

        /// <summary>
        /// Gets or sets the identifiers of all groups that already carry a
        /// policy, independent of the filter and the paging. The assign dialog
        /// offers only the remaining groups, which the paged items alone could
        /// not determine.
        /// </summary>
        [JsonPropertyName("assignedGroupIds")]
        public IEnumerable<string> AssignedGroupIds { get; set; }
    }
}
