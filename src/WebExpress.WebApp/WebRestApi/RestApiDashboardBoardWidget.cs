using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents one widget of a full board update the dashboard sends when a
    /// widget is added, deleted or reconfigured. Unlike the arrangement-only
    /// layout, it carries the per-widget name, color and params, so the settings
    /// a user edits through the "…" menu round-trip to the server.
    /// </summary>
    public class RestApiDashboardBoardWidget
    {
        /// <summary>
        /// Gets or sets the widget type id (the client registry id).
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the widget name.
        /// </summary>
        [JsonPropertyName("title")]
        public string Title { get; set; }

        /// <summary>
        /// Gets or sets the widget accent color.
        /// </summary>
        [JsonPropertyName("color")]
        public string Color { get; set; }

        /// <summary>
        /// Gets or sets the type-specific widget params.
        /// </summary>
        [JsonPropertyName("params")]
        public Dictionary<string, string> Params { get; set; }
    }
}
