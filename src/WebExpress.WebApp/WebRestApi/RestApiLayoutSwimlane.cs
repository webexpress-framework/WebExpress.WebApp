using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a single swimlane in a swimlane-layout update (add / rename /
    /// reorder / delete) sent by the kanban control. The position in the list
    /// defines the new swimlane order.
    /// </summary>
    public class RestApiLayoutSwimlane
    {
        /// <summary>
        /// Gets or sets the swimlane id.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the (possibly renamed) swimlane title.
        /// </summary>
        [JsonPropertyName("title")]
        public string Title { get; set; }

        /// <summary>
        /// Gets or sets the optional WQL filter of the swimlane, submitted through
        /// the swimlane settings dialog.
        /// </summary>
        [JsonPropertyName("filter")]
        public string Filter { get; set; }
    }
}
