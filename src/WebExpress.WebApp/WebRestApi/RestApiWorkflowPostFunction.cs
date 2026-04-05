using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a post function in a workflow as defined by a REST API response.
    /// </summary>
    public class RestApiWorkflowPostFunction
    {
        /// <summary>
        /// Returns or sets the unique identifier for the entity.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Returns or sets the type of the object represented by this instance.
        /// </summary>
        [JsonPropertyName("type")]
        public string Type { get; set; }

        /// <summary>
        /// Returns or sets the display label associated with the object.
        /// </summary>
        [JsonPropertyName("label")]
        public string Label { get; set; }
    }
}
