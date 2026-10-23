using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Carries the confirmed destination of a card move to the application persistence hook.
    /// </summary>
    public class RestApiKanbanMove
    {
        /// <summary>
        /// Gets or sets the card being moved.
        /// </summary>
        [JsonPropertyName("cardId")]
        public string CardId { get; set; }

        /// <summary>
        /// Gets or sets the destination column.
        /// </summary>
        [JsonPropertyName("columnId")]
        public string ColumnId { get; set; }

        /// <summary>
        /// Gets or sets the destination swimlane, or null for a board without swimlanes.
        /// </summary>
        [JsonPropertyName("swimlaneId")]
        public string SwimlaneId { get; set; }

        /// <summary>
        /// Gets or sets the confirmed destination status, or the unchanged status for a reorder.
        /// </summary>
        [JsonPropertyName("statusId")]
        public string StatusId { get; set; }
    }
}
