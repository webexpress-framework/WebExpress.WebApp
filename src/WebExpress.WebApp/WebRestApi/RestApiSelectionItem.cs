using System;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a lightweight DTO for selection entries returned by a REST endpoint.
    /// </summary>
    public class RestApiSelectionItem
    {
        /// <summary>
        /// Returns or sets the unique item identifier.
        /// </summary>
        [JsonPropertyName("id")]
        public Guid Id { get; set; }

        /// <summary>
        /// Returns or sets the display text of the item.
        /// </summary>
        [JsonPropertyName("text")]
        public string Text { get; set; }

        /// <summary>
        /// Returns or sets the target uri for the item.
        /// </summary>
        [JsonPropertyName("uri")]
        public string Uri { get; set; }
    }
}
