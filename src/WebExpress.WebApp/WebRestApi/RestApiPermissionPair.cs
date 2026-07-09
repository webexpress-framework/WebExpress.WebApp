using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents an assignment pair as ids only, used by the paged result to
    /// carry the full assignment set across all pages without repeating the
    /// display names.
    /// </summary>
    public class RestApiPermissionPair
    {
        /// <summary>
        /// Gets or sets the unique identifier of the assigned group.
        /// </summary>
        [JsonPropertyName("groupId")]
        public string GroupId { get; set; }

        /// <summary>
        /// Gets or sets the unique identifier of the assigned policy.
        /// </summary>
        [JsonPropertyName("policyId")]
        public string PolicyId { get; set; }
    }
}
