using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a lightweight DTO for avatar dropdown entries returned by a REST endpoint.
    /// Extends the base dropdown item with a section property to categorize items into
    /// preferences, primary, or secondary areas.
    /// </summary>
    public class RestApiAvatarDropdownItem : RestApiDropdownItem
    {
        /// <summary>
        /// Gets or sets the section to which the item belongs (e.g. "preferences", "primary", "secondary").
        /// </summary>
        [JsonPropertyName("section")]
        public string Section { get; set; }
    }
}
