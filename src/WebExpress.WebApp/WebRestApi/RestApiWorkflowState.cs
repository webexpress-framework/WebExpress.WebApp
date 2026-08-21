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
        [JsonConverter(typeof(RestApiCoordinateConverter))]
        public int X { get; set; }

        /// <summary>
        /// Gets or sets the Y-coordinate value.
        /// </summary>
        [JsonPropertyName("y")]
        [JsonConverter(typeof(RestApiCoordinateConverter))]
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
        /// Gets or sets the icon identifier associated with this object. This is a
        /// CSS class (for example an icon of the active set), never a URL; a state whose
        /// symbol is a picture uses <see cref="Image"/> instead, because the client
        /// renders the two through different SVG elements.
        /// </summary>
        [JsonPropertyName("icon")]
        public string Icon { get; set; }

        /// <summary>
        /// Gets or sets the URL of the image that represents this state. It is the
        /// counterpart of <see cref="Icon"/> for applications whose state symbols are
        /// pictures rather than glyphs. Putting a URL into <see cref="Icon"/> would
        /// set it as a CSS class on an empty element and render nothing.
        /// </summary>
        [JsonPropertyName("image")]
        public string Image { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether this state is an entry point of the
        /// workflow. The editor needs a defined starting point to reason about
        /// reachability; without one it would have to guess, and the answer would
        /// depend on the order in which the states happen to arrive.
        /// </summary>
        [JsonPropertyName("isStart")]
        public bool IsStart { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether this state terminates the workflow.
        /// A terminal state legitimately has no outgoing transitions, which the editor
        /// must not report as a dead end.
        /// </summary>
        [JsonPropertyName("isEnd")]
        public bool IsEnd { get; set; }

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
