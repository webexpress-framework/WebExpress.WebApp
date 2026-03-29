using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a Kanban card as returned by the REST API.
    /// </summary>
    public class RestApiKanbanCard
    {
        /// <summary>
        /// Returns or sets the unique identifier for the card.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Returns or sets the display label associated with the card.
        /// </summary>
        [JsonPropertyName("label")]
        public string Label { get; set; }

        /// <summary>
        /// Returns or sets the HTML content associated with this card.
        /// </summary>
        [JsonPropertyName("html")]
        public string Html { get; set; }

        /// <summary>
        /// Gets or sets the unique identifier of the column.
        /// </summary>
        [JsonPropertyName("columnId")]
        public string ColumnId { get; set; }

        /// <summary>
        /// Returns or sets the unique identifier of the swimlane.
        /// </summary>
        [JsonPropertyName("swimlaneId")]
        public string SwimlaneId { get; set; }

        /// <summary>
        /// Returns or sets the CSS color value associated with this card.
        /// </summary>
        [JsonPropertyName("colorCss")]
        public string ColorCss { get; set; }
    }
}
