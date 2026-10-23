using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a single group-to-policy assignment of a protected resource
    /// as exposed by the REST API and rendered by the client-side
    /// <c>webexpress.webapp.PermissionCtrl</c>. The names travel alongside the
    /// ids so the client never resolves them a second time.
    /// </summary>
    public class RestApiPermissionItem
    {
        /// <summary>
        /// Gets or sets the unique identifier of the assigned group (see
        /// <c>IIdentityGroup.Id</c>).
        /// </summary>
        [JsonPropertyName("groupId")]
        public string GroupId { get; set; }

        /// <summary>
        /// Gets or sets the display name of the assigned group.
        /// </summary>
        [JsonPropertyName("groupName")]
        public string GroupName { get; set; }

        /// <summary>
        /// Gets or sets the unique identifier of the effective policy (see
        /// <c>IIdentityPolicy.Id</c>).
        /// </summary>
        [JsonPropertyName("policyId")]
        public string PolicyId { get; set; }

        /// <summary>
        /// Gets or sets the display name of the effective policy.
        /// </summary>
        [JsonPropertyName("policyName")]
        public string PolicyName { get; set; }
    }
}
