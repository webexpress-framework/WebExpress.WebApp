using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a guard condition within a REST API workflow, including its 
    /// identifier, type, label, and any nested child guards.
    /// </summary>
    public class RestApiWorkflowGuard
    {
        /// <summary>
        /// Gets or sets the unique identifier for the entity.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the type of the object represented by this instance.
        /// </summary>
        [JsonPropertyName("type")]
        public string Type { get; set; }

        /// <summary>
        /// Gets or sets the display label associated with the object.
        /// </summary>
        [JsonPropertyName("label")]
        public string Label { get; set; }

        /// <summary>
        /// Gets or sets the collection of child workflow guards associated with this guard.
        /// </summary>
        [JsonPropertyName("children")]
        public IEnumerable<RestApiWorkflowGuard> Children { get; set; }
    }
}
