using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a directed connection between two graph nodes as exposed by a
    /// REST API.
    /// </summary>
    public class RestApiGraphEdge
    {
        /// <summary>
        /// Gets or sets the unique identifier of the edge.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the identifier of the source node.
        /// </summary>
        [JsonPropertyName("from")]
        public string From { get; set; }

        /// <summary>
        /// Gets or sets the identifier of the target node.
        /// </summary>
        [JsonPropertyName("to")]
        public string To { get; set; }

        /// <summary>
        /// Gets or sets the label drawn in the middle of the edge.
        /// </summary>
        [JsonPropertyName("label")]
        public string Label { get; set; }

        /// <summary>
        /// Gets or sets the stroke color of the edge. The arrowhead is drawn in
        /// the same color.
        /// </summary>
        [JsonPropertyName("color")]
        public string Color { get; set; }

        /// <summary>
        /// Gets or sets the CSS class applied to the edge, which keeps a themed
        /// edge in step with the stylesheet instead of pinning it to a literal
        /// color.
        /// </summary>
        [JsonPropertyName("colorCss")]
        public string ColorCss { get; set; }

        /// <summary>
        /// Gets or sets the SVG stroke dash pattern of the edge, for example
        /// "5,5" for a dashed line.
        /// </summary>
        [JsonPropertyName("dasharray")]
        public string DashArray { get; set; }

        /// <summary>
        /// Gets or sets the points the edge is routed through. Without them the
        /// edge runs directly from the source to the target.
        /// </summary>
        [JsonPropertyName("waypoints")]
        public IEnumerable<RestApiGraphWaypoint> Waypoints { get; set; }
    }
}
