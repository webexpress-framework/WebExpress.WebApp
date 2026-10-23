using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the body of an assign request issued by the permission
    /// control. The policy set is sent as a whole, because the surface edits a
    /// group's chips rather than single assignments: the endpoint reconciles the
    /// stored pairs against it.
    /// </summary>
    public class RestApiPermissionPayload
    {
        /// <summary>
        /// Gets or sets the id of the group whose policies are set. It is only
        /// carried by the create request; an update addresses the group through
        /// its path segment.
        /// </summary>
        [JsonPropertyName("groupId")]
        public string GroupId { get; set; }

        /// <summary>
        /// Gets or sets the ids of the policies the group carries afterwards.
        /// </summary>
        [JsonPropertyName("policyIds")]
        public IEnumerable<string> PolicyIds { get; set; }
    }
}
