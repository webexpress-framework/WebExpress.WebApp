using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a selectable identity policy (see <c>IIdentityPolicy</c>) as
    /// served to the policy select of the permission control. The description
    /// surfaces as the option tooltip.
    /// </summary>
    public class RestApiPermissionPolicy
    {
        /// <summary>
        /// Gets or sets the unique identifier of the policy.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the display name of the policy.
        /// </summary>
        [JsonPropertyName("name")]
        public string Name { get; set; }

        /// <summary>
        /// Gets or sets the description of the policy.
        /// </summary>
        [JsonPropertyName("description")]
        public string Description { get; set; }
    }
}
