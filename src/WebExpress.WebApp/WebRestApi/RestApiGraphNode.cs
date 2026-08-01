using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a node of a graph as exposed by a REST API, including its
    /// identifier, display properties and layout configuration.
    /// </summary>
    public class RestApiGraphNode
    {
        /// <summary>
        /// Gets or sets the unique identifier of the node. The edges address the
        /// nodes by it, so an edge whose endpoint is unknown is dropped rather
        /// than drawn to nowhere.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the display label of the node. When empty the client
        /// falls back to the identifier, so a node is never unlabelled.
        /// </summary>
        [JsonPropertyName("label")]
        public string Label { get; set; }

        /// <summary>
        /// Gets or sets the X coordinate of the node's top left corner. Leave
        /// <see cref="X"/> and <see cref="Y"/> unset to let the layout
        /// simulation place the node.
        /// </summary>
        [JsonPropertyName("x")]
        public int? X { get; set; }

        /// <summary>
        /// Gets or sets the Y coordinate of the node's top left corner.
        /// </summary>
        [JsonPropertyName("y")]
        public int? Y { get; set; }

        /// <summary>
        /// Gets or sets the icon of the node. This is a CSS class (for example a
        /// FontAwesome glyph), never a URL; a node whose symbol is a picture uses
        /// <see cref="Image"/> instead, because the client renders the two
        /// through different SVG elements.
        /// </summary>
        [JsonPropertyName("icon")]
        public string Icon { get; set; }

        /// <summary>
        /// Gets or sets the URL of the image representing this node. It is the
        /// counterpart of <see cref="Icon"/> for graphs whose symbols are
        /// pictures rather than glyphs.
        /// </summary>
        [JsonPropertyName("image")]
        public string Image { get; set; }

        /// <summary>
        /// Gets or sets the URI the node links to.
        /// </summary>
        [JsonPropertyName("uri")]
        public string Uri { get; set; }

        /// <summary>
        /// Gets or sets the shape of the node background, either "rect" (the
        /// default) or "circle".
        /// </summary>
        [JsonPropertyName("shape")]
        public string Shape { get; set; }

        /// <summary>
        /// Gets or sets the layout of the node, either "label-inside" (the
        /// default) or "label-below". When empty the viewer's node style applies.
        /// </summary>
        [JsonPropertyName("layout")]
        public string Layout { get; set; }

        /// <summary>
        /// Gets or sets the background color of the node. An explicit color wins
        /// over <see cref="BackgroundCss"/> and over the theme default.
        /// </summary>
        [JsonPropertyName("backgroundColor")]
        public string BackgroundColor { get; set; }

        /// <summary>
        /// Gets or sets the CSS class applied to the node background, which
        /// keeps a themed node in step with the stylesheet instead of pinning it
        /// to a literal color.
        /// </summary>
        [JsonPropertyName("backgroundCss")]
        public string BackgroundCss { get; set; }

        /// <summary>
        /// Gets or sets the foreground color used for the label and the icon.
        /// </summary>
        [JsonPropertyName("foregroundColor")]
        public string ForegroundColor { get; set; }

        /// <summary>
        /// Gets or sets the CSS class applied to the label and the icon.
        /// </summary>
        [JsonPropertyName("foregroundCss")]
        public string ForegroundCss { get; set; }
    }
}
