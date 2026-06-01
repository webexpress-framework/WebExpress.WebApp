using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the request body of a <c>POST</c> against the tag endpoint
    /// used to add a new tag.
    /// </summary>
    public class RestApiTagPayload
    {
        /// <summary>
        /// Gets or sets the value (display text) of the tag to add.
        /// </summary>
        [JsonPropertyName("value")]
        public string Value { get; set; }
    }
}
