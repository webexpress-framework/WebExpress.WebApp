using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Describes one widget type the server offers for adding to a dashboard.
    /// The server owns which widgets a board may use; the client resolves the
    /// render and any omitted display metadata from its widget registry by id.
    /// </summary>
    public class RestApiDashboardAvailableWidget
    {
        /// <summary>
        /// Gets or sets the widget type id (the client registry id).
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the optional display title, overriding the registry default.
        /// </summary>
        [JsonPropertyName("title")]
        public string Title { get; set; }

        /// <summary>
        /// Gets or sets the optional display icon, overriding the registry default.
        /// </summary>
        [JsonPropertyName("icon")]
        public string Icon { get; set; }

        /// <summary>
        /// Gets or sets the optional description shown under the add-menu entry.
        /// </summary>
        [JsonPropertyName("description")]
        public string Description { get; set; }
    }
}
