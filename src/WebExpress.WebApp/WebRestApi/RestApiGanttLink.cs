using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a gantt dependency link as exchanged with the REST API. The
    /// type names the temporal relationship between the two tasks: FS
    /// (finish-to-start, the default), SS (start-to-start), FF (finish-to-finish)
    /// and SF (start-to-finish).
    /// </summary>
    public class RestApiGanttLink
    {
        /// <summary>
        /// Gets or sets the unique identifier of the link.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the id of the predecessor task.
        /// </summary>
        [JsonPropertyName("from")]
        public string From { get; set; }

        /// <summary>
        /// Gets or sets the id of the successor task.
        /// </summary>
        [JsonPropertyName("to")]
        public string To { get; set; }

        /// <summary>
        /// Gets or sets the dependency type: FS, SS, FF or SF.
        /// </summary>
        [JsonPropertyName("type")]
        public string Type { get; set; }
    }
}
