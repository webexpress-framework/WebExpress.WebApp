using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a workflow validator used in REST API models, including its 
    /// identifier, type, label, and any child validators.
    /// </summary>
    public class RestApiWorkflowValidator
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
        /// Returns or sets the display label associated with this object.
        /// </summary>
        [JsonPropertyName("label")]
        public string Label { get; set; }

        /// <summary>
        /// Returns or sets the collection of child workflow validators associated with this validator.
        /// </summary>
        [JsonPropertyName("children")]
        public IEnumerable<RestApiWorkflowValidator> Children { get; set; }
    }
}
