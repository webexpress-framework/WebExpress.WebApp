using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a selectable identity group (see <c>IIdentityGroup</c>) as
    /// served to the group select of the permission control.
    /// </summary>
    public class RestApiPermissionGroup
    {
        /// <summary>
        /// Gets or sets the unique identifier of the group.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the display name of the group.
        /// </summary>
        [JsonPropertyName("name")]
        public string Name { get; set; }
    }
}
