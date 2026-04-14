using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a Kanban column as defined by a REST API.
    /// </summary>
    public class RestApiKanbanColumn
    {
        /// <summary>
        /// Gets or sets the unique identifier for the column.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the display label associated with this column.
        /// </summary>
        [JsonPropertyName("label")]
        public string Label { get; set; }

        /// <summary>
        /// Gets or sets the CSS color value associated with this column.
        /// </summary>
        [JsonPropertyName("colorCss")]
        public string ColorCss { get; set; }
    }
}
