using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the body of an assign request issued by the permission
    /// control. Assigning an already assigned group replaces its effective
    /// policy, because a group carries exactly one policy per resource.
    /// </summary>
    public class RestApiPermissionPayload
    {
        /// <summary>
        /// Gets or sets the id of the group to be assigned.
        /// </summary>
        [JsonPropertyName("groupId")]
        public string GroupId { get; set; }

        /// <summary>
        /// Gets or sets the id of the policy the group is assigned to.
        /// </summary>
        [JsonPropertyName("policyId")]
        public string PolicyId { get; set; }
    }
}
