using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a swimlane in a Kanban board as defined by a REST API response.
    /// </summary>
    public class RestApiKanbanSwimlane
    {
        /// <summary>
        /// Returns or sets the unique identifier for the swimlane.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Returns or sets the display label associated with the swimlane.
        /// </summary>
        [JsonPropertyName("label")]
        public string Label { get; set; }

        /// <summary>
        /// Returns or sets the CSS color value associated with this swimlane
        [JsonPropertyName("colorCss")]
        public string ColorCss { get; set; }

        /// <summary>
        /// Returns or sets a value indicating whether the swimlane is expanded.
        /// </summary>
        [JsonPropertyName("expanded")]
        public bool Expanded { get; set; }
    }
}
