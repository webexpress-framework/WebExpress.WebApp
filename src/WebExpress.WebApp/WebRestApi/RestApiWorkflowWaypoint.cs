using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a waypoint in a workflow, defined by its X and Y coordinates.
    /// </summary>
    public class RestApiWorkflowWaypoint
    {
        /// <summary>
        /// Gets or sets the X coordinate value.
        /// </summary>
        [JsonPropertyName("x")]
        public int X { get; set; }

        /// <summary>
        /// Gets or sets the Y-coordinate value.
        /// </summary>
        [JsonPropertyName("y")]
        public int Y { get; set; }
    }
}
