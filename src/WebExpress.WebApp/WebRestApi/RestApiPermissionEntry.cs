using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents one row of the permission surface: a group together with all
    /// policies it carries on the protected resource, mirroring
    /// <c>IIdentityGroup.Policies</c> in the identity model. The endpoint pages
    /// over entries rather than over single assignments, so the policy chips of
    /// a group are never split across two pages.
    /// </summary>
    public class RestApiPermissionEntry
    {
        /// <summary>
        /// Gets or sets the unique identifier of the group (see
        /// <c>IIdentityGroup.Id</c>).
        /// </summary>
        [JsonPropertyName("groupId")]
        public string GroupId { get; set; }

        /// <summary>
        /// Gets or sets the display name of the group.
        /// </summary>
        [JsonPropertyName("groupName")]
        public string GroupName { get; set; }

        /// <summary>
        /// Gets or sets the identifiers of the policies the group carries. The
        /// client renders them as chips and resolves their labels through the
        /// policy directory, so the names are not repeated per row.
        /// </summary>
        [JsonPropertyName("policyIds")]
        public IEnumerable<string> PolicyIds { get; set; } = [];
    }
}
