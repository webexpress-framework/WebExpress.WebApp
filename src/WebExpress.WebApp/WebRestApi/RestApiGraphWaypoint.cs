using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a routing point of a graph edge, defined by its X and Y coordinates.
    /// </summary>
    public class RestApiGraphWaypoint
    {
        /// <summary>
        /// Gets or sets the X coordinate value.
        /// </summary>
        [JsonPropertyName("x")]
        public int X { get; set; }

        /// <summary>
        /// Gets or sets the Y coordinate value.
        /// </summary>
        [JsonPropertyName("y")]
        public int Y { get; set; }
    }
}
