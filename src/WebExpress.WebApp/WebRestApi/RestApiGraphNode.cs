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
        /// icon of the active set), never a URL; a node whose symbol is a picture uses
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

        /// <summary>
        /// Gets or sets the second line of the node: what the thing the node stands for is,
        /// under the name it is called by.
        /// </summary>
        /// <remarks>
        /// A node whose label is an identifier - a record key, a host name - says what it is
        /// only by the company it keeps, and a reader following a graph of them has to open
        /// each one to find out. The viewer draws this line beneath the label and gives the
        /// node the room for it; without a description it keeps the compact shape it has
        /// always had.
        /// </remarks>
        [JsonPropertyName("description")]
        public string Description { get; set; }

        /// <summary>
        /// Gets or sets the state of the thing the node stands for, drawn as a captioned dot.
        /// </summary>
        /// <remarks>
        /// It is the third thing a reader asks of a node that stands for a record - what it is
        /// called, what it is, and where it stands - and the one that decides whether the
        /// connection still matters. <see cref="StateColor"/> or <see cref="StateCss"/> paints
        /// the dot; neither of them alone says anything, so a state without one is drawn in the
        /// neutral tone.
        /// </remarks>
        [JsonPropertyName("state")]
        public string State { get; set; }

        /// <summary>
        /// Gets or sets the color of the state dot.
        /// </summary>
        [JsonPropertyName("stateColor")]
        public string StateColor { get; set; }

        /// <summary>
        /// Gets or sets the CSS class of the state dot, for a host that paints its states
        /// through a stylesheet rather than through a stored color.
        /// </summary>
        [JsonPropertyName("stateCss")]
        public string StateCss { get; set; }
    }
}
