using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the state of a workflow element as exposed by a REST API, 
    /// including its identifier, display properties, and layout configuration.
    /// </summary>
    public class RestApiWorkflowState
    {
        /// <summary>
        /// Gets or sets the unique identifier for the entity.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the display label associated with this object.
        /// </summary>
        [JsonPropertyName("label")]
        public string Label { get; set; }

        /// <summary>
        /// Gets or sets the value of X.
        /// </summary>
        [JsonPropertyName("x")]
        public int X { get; set; }

        /// <summary>
        /// Gets or sets the Y-coordinate value.
        /// </summary>
        [JsonPropertyName("y")]
        public int Y { get; set; }

        /// <summary>
        /// Gets or sets the background color for the element.
        /// </summary>
        [JsonPropertyName("backgroundColor")]
        public string BackgroundColor { get; set; }

        /// <summary>
        /// Gets or sets the foreground color to be used for display elements.
        /// </summary>
        [JsonPropertyName("foregroundColor")]
        public string ForegroundColor { get; set; }

        /// <summary>
        /// Gets or sets the icon identifier associated with this object.
        /// </summary>
        [JsonPropertyName("icon")]
        public string Icon { get; set; }

        /// <summary>
        /// Gets or sets the geometric shape represented by this object.
        /// </summary>
        [JsonPropertyName("shape")]
        public string Shape { get; set; }

        /// <summary>
        /// Gets or sets the layout configuration for the associated object.
        /// </summary>
        [JsonPropertyName("layout")]
        public string Layout { get; set; }
    }
}
