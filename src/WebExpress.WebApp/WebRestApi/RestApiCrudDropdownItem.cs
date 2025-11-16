using System;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a lightweight DTO for dropdown entries returned by a REST endpoint.
    /// </summary>
    public class RestApiCrudDropdownItem
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

        /// <summary>
        /// Returns or sets the icon uri for the item.
        /// </summary>
        [JsonPropertyName("icon")]
        public string Icon { get; set; }
        
        /// <summary>
        /// Returns or sets the image icon uri for the item.
        /// </summary>
        [JsonPropertyName("image")]
        public string Image { get; set; }
    }
}
